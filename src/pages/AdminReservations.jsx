import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Clipboard, Activity, BarChart3, Calendar, Building2, Trash2, Clock, Settings, CheckCircle, Search, Scissors, ShoppingBag, X, Percent, User } from 'lucide-react';

// 🆕 予約者名から固有のパステルカラーを生成するロジック
const getCustomerColor = (name, type) => {
  // 🚀 🆕 施設キープの種類によって色を変える
  if (type === 'facility_keep_single') {
    // ⚠️ 単発キープ：目立つオレンジ（警告色）
    return { bg: '#fff7ed', border: '#fb923c', line: '#f97316', text: '#9a3412' };
  }
  if (type === 'facility_keep_regular') {
    // 📅 定期キープ：馴染みやすい薄いブルーグレー
    return { bg: '#f8fafc', border: '#cbd5e1', line: '#94a3b8', text: '#475569' };
  }
  
  if (type === 'private_task') {
    return { bg: '#f8fafc', border: '#e2e8f0', line: '#94a3b8', text: '#475569' };
  }
  if (!name || name === '定休日' || name === '臨時休業' || name === 'ｲﾝﾀｰﾊﾞﾙ') 
    return { bg: '#f1f5f9', border: '#cbd5e1', line: '#94a3b8', text: '#64748b' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return {
    bg: `hsl(${h}, 85%, 94%)`,
    border: `hsl(${h}, 60%, 80%)`,
    line: `hsl(${h}, 60%, 60%)`,
    text: `hsl(${h}, 70%, 25%)`
  };
};

// 🚀 🆕 ここに追加！：フリガナから「あ行・か行...」を判定する関数
const getKanaGroup = (kana) => {
  if (!kana) return "その他";
  const firstChar = kana.charAt(0);
  if (firstChar.match(/[あ-お]/)) return "あ行";
  if (firstChar.match(/[か-こ]/)) return "か行";
  if (firstChar.match(/[さ-そ]/)) return "さ行";
  if (firstChar.match(/[た-と]/)) return "た行";
  if (firstChar.match(/[な-の]/)) return "な行";
  if (firstChar.match(/[は-ほ]/)) return "は行";
  if (firstChar.match(/[ま-も]/)) return "ま行";
  if (firstChar.match(/[や-よ]/)) return "や行";
  if (firstChar.match(/[ら-ろ]/)) return "ら行";
  if (firstChar.match(/[わ-を]/)) return "わ行";
  return "その他";
};

const parseReservationDetails = (res) => {
  if (!res) return { menuName: '', totalPrice: 0, items: [], subItems: [], products: [], adjustments: [] };
  const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
  
  const products = opt.products || [];
  const adjustments = opt.adjustments || [];
  let items = [];
  let subItems = [];

  // 💡 レジ確定データがあればそちらを優先
  if (opt.isUpdatedFromCheckout || opt.isUpdatedFromTodayTasks || !opt.people) {
    items = opt.services || [];
    subItems = Object.values(opt.options || {});
  } else {
    items = opt.people.flatMap(p => p.services || []);
    subItems = opt.people.flatMap(p => Object.values(p.options || {}));
  }

  const baseNames = items.map(s => s.name).join(', ');
  const optionNames = subItems.map(o => o.option_name).join(', ');
  const fullMenuName = res.menu_name || (optionNames ? `${baseNames}（${optionNames}）` : (baseNames || 'メニューなし'));

  let basePrice = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const optPrice = subItems.reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);
  const productPrice = products.reduce((sum, p) => sum + (Number(p.price || 0) * (p.quantity || 1)), 0);

  let adjAmount = 0;
  adjustments.forEach(a => {
    if (a.is_percent) adjAmount -= (basePrice + optPrice) * (Number(a.price) / 100);
    else adjAmount += a.is_minus ? -Number(a.price) : Number(a.price);
  });

  let calculatedTotal = Math.round(basePrice + optPrice + productPrice + adjAmount);

  // 🚀 🆕 もし計算が0円になってしまっても、DBの確定金額(res.total_price)があるならそちらを採用する
  if (calculatedTotal === 0 && res.total_price > 0) {
    calculatedTotal = res.total_price;
  }

  return { 
    menuName: fullMenuName, 
    totalPrice: Math.max(0, calculatedTotal), 
    items, 
    subItems,
    products,
    adjustments
  };
};

function AdminReservations() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // 🆕 予約から戻った直後のスクロールを止めるフラグ
  const [isScrollLocked, setIsScrollLocked] = useState(false);

  // --- 状態管理 ---
  const [shop, setShop] = useState(null);
  const [staffs, setStaffs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [visitRequests, setVisitRequests] = useState([]);
  const [manualKeeps, setManualKeeps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exclusions, setExclusions] = useState([]);
  const [irregularKeeps, setIrregularKeeps] = useState([]);
  const [urgentKeeps, setUrgentKeeps] = useState([]);
  const [timeChangedKeeps, setTimeChangedKeeps] = useState([]);
  const [dismissedKeeps, setDismissedIrregularIds] = useState(() => {
    const saved = localStorage.getItem(`dismissed_keeps_${shopId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [facilityConnections, setFacilityConnections] = useState([]);
  const [message, setMessage] = useState('');
  const [categoryMap, setCategoryMap] = useState({});
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertModalMode, setAlertModalMode] = useState(null);

  const [startDate, setStartDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam) {
      const d = new Date(dateParam);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  }); 

  const [selectedDate, setSelectedDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    return dateParam || new Date().toLocaleDateString('sv-SE');
  }); 
  
  // --- デザイン（スタイル）の定義をここに追加 ---
const resItemRowStyle = { 
  fontSize: '0.9rem', 
  color: '#1e293b', 
  background: '#fff', 
  padding: '8px 12px', 
  borderRadius: '8px', 
  border: '1px solid rgba(0,0,0,0.05)', 
  display: 'flex',
  alignItems: 'flex-start',
  lineHeight: '1.4',
  marginBottom: '5px'
};

const resIndexStyle = (color) => ({ 
  fontWeight: '900', 
  color: color, 
  marginRight: '10px', 
  whiteSpace: 'nowrap' 
});
// ------------------------------------------

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [targetTime, setTargetTime] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRes, setSelectedRes] = useState(null);
  const [showSlotListModal, setShowSlotListModal] = useState(false);
  const [showBlockEndSelector, setShowBlockEndSelector] = useState(false);
  const [isTargetOutsideHours, setIsTargetOutsideHours] = useState(false);

  // 🚀 🆕 追加：スマホ用ミニカレンダー表示フラグ
  const [showMobileCalendar, setShowMobileCalendar] = useState(false);

  // 🚀 🆕 追加：スマホ用・全顧客検索ポップアップ用
  const [showMobileSearchModal, setShowMobileSearchModal] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]); // 50音順リスト用

// 施設予約キャンセル専用のState
  const [showFacCancelModal, setShowFacCancelModal] = useState(false);
  const [facCancelTarget, setFacCancelTarget] = useState(null); // {id, date, name} を入れる
  const [facCancelPass, setFacCancelPass] = useState('');

  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);

// 🆕 プライベート予定用のState
  const [privateTasks, setPrivateTasks] = useState([]);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [privateTaskFields, setPrivateTaskFields] = useState({ title: '', note: '' });
  // --- ✨ 修正後：現在時刻保持用のStateを追加 ---
  const [selectedSlotReservations, setSelectedSlotReservations] = useState([]);
  const [customerHistory, setCustomerHistory] = useState([]);
  // 🚀 🆕 追加：現在時刻を管理するState
  const [now, setNow] = useState(new Date());
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMonth, setViewMonth] = useState(new Date(startDate)); 
  const touchStartX = useRef(0);

  const [customers, setCustomers] = useState([]); 
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // 他のStateと一緒に定義してください
const [mergeCandidate, setMergeCandidate] = useState(null); // 重複が見つかった「大造」さん候補
const [showMergeConfirm, setShowMergeConfirm] = useState(false); // 3択モーダルの表示フラグ

/* 🆕 ここから追記：施設訪問名簿用のポップアップ管理 */
const [showVisitDetailModal, setShowVisitDetailModal] = useState(false);
const [expandedYears, setExpandedYears] = useState({ 
  [new Date().getFullYear()]: true 
});
const [visitResidents, setVisitResidents] = useState([]);

// 🏢 施設訪問詳細（入居者リスト）を開く関数
const [finalizedSale, setFinalizedSale] = useState(null); // 🆕 売上実績保存用のStateを追加

// 🚀 🆕 追加：引き継ぎ（延長）機能用のState
  const [showCarryoverPicker, setShowCarryoverPicker] = useState(false);
  const [carryoverDate, setCarryoverDate] = useState('');
  const [carryoverTime, setCarryoverTargetTime] = useState('09:00'); // 🚀 🆕 追加
  const [carryoverViewMonth, setCarryoverViewMonth] = useState(new Date()); // 🚀 🆕 カレンダーの表示月用

  const openVisitDetail = async (visitId, facilityName, visitData) => {
    if (!visitId) return;
    setLoading(true);
    setFinalizedSale(null);

    // 🚀 1. シリーズの親（Master ID）を特定
    const masterId = visitData.parent_id || visitId;
    
    // 🚀 2. 名簿、売上、そして「親予約の作成日時」を取得（新旧判定用）
    const [resRes, saleRes, masterRes] = await Promise.all([
      supabase.from('visit_request_residents')
        .select('*, members (name, room, floor)')
        .eq('visit_request_id', masterId) // 親に紐付く全員を取得
        .order('created_at', { ascending: true }),
      supabase.from('sales').select('*').eq('visit_request_id', visitId).maybeSingle(),
      supabase.from('visit_requests').select('created_at').eq('id', masterId).single()
    ]);

    if (!resRes.error) {
      // 🚀 3. 新規追加メンバーの判定（親予約が作られた10分以上後なら「新規」とする）
      const masterTime = new Date(masterRes.data?.created_at).getTime();
      const enrichedResidents = (resRes.data || []).map(r => ({
        ...r,
        isNewAddition: (new Date(r.created_at).getTime() - masterTime) > 600000 
      }));

      setVisitResidents(enrichedResidents);
      setFinalizedSale(saleRes.data || null);
      setSelectedRes({ ...visitData, id: visitId, customer_name: facilityName, res_type: 'facility_visit' });
      setShowVisitDetailModal(true);
    }
    setLoading(false);
  };

// 🆕 施設予約のキャンセル実行
const handleCancelKeep = (facilityId, dateStr, facilityName) => {
    // 🚀 type: 'keep' を追加して、実行時に処理を分岐できるようにします
    setFacCancelTarget({ id: facilityId, date: dateStr, name: facilityName, type: 'keep' });
    setFacCancelPass('');
    setShowFacCancelModal(true);
  };

  // 🚀 🆕 追加：パスワード確認後に実行される本当のキャンセル処理
  const executeFacCancel = async () => {
    if (facCancelPass !== '1234') {
      alert("パスワードが正しくありません。");
      return;
    }

    try {
      const { id, date, name, type } = facCancelTarget;

      if (type === 'visit') {
        // ❌ delete() ではなく ⭕️ update() に変更します
        // これにより、関連データ（引き継ぎ先など）とのリンクを壊さずに済みます
        const { error } = await supabase
          .from('visit_requests')
          .update({ status: 'canceled' }) // ステータスを「キャンセル」に変更
          .eq('id', id);

        if (error) throw error;
      } else {
        // 🚀 B: キープ（定期・手動）の解除ロジック（こちらは既存のままでOK）
        await supabase.from('regular_keep_exclusions').upsert([{ 
        
          facility_user_id: id, shop_id: shopId, excluded_date: date 
        }]);
        await supabase.from('keep_dates').delete().match({ 
          facility_user_id: id, shop_id: shopId, date: date 
        });
      }

      setShowFacCancelModal(false);
      showMsg(`${name} 様の予定をキャンセルしました。`);
      fetchData(); // 🔄 これでカレンダーから消えます
    } catch (err) {
      alert("実行エラー: " + err.message);
    }
  };

// 🚀 修正：単発の日程キャンセルを許容する
const handleDeleteVisit = async (visitId, dateStr, facilityName) => {
  setLoading(true);
  
  // 表示中の予約データを特定
  const visit = visitRequests.find(v => v.id === visitId);
  // 名簿の親玉（Master ID）を特定
  const masterId = visit?.parent_id || visitId;

  // 確認画面用に、その「月」の全名簿を取得（これは表示用）
  const { data: allResidents } = await supabase 
    .from('visit_request_residents')
    .select('members(name), menu_name, status')
    .eq('visit_request_id', masterId);

  setFacCancelTarget({ 
    id: visitId, // 🚩 消すのは「この日（visitId）」だけ！
    date: dateStr, 
    name: facilityName, 
    type: 'visit',
    residents: allResidents || [],
    totalCount: allResidents?.length || 0
  });

  setFacCancelPass('');
  setShowFacCancelModal(true);
  setLoading(false);
};

  // 🚀 🆕 追加：未完了者を別日に引き継ぐ（延長予約）
  const handleCarryoverVisit = async () => {
    const pendingResidents = visitResidents.filter(r => r.status === 'pending');
    
    if (!carryoverDate) { alert("引き継ぎ先の日付を選択してください。"); return; }
    if (pendingResidents.length === 0) { alert("引き継ぐ対象（未完了の方）がいません。"); return; }
    if (!window.confirm(`${carryoverDate.replace(/-/g, '/')} に ${pendingResidents.length} 名を引き継いで予約を作成しますか？`)) return;

    setLoading(true);
    try {
      // 1. 新しい訪問予約（visit_requests）を作成
      // 🚀 確実に存在する列（shop_id, facility_user_id, scheduled_date, start_time, status, parent_id）だけに絞りました
      const { data: newVisit, error: vError } = await supabase
        .from('visit_requests')
        .insert([{
          shop_id: shopId,
          facility_user_id: selectedRes.facility_user_id,
          scheduled_date: carryoverDate,
          start_time: carryoverTime, 
          status: 'confirmed',
          parent_id: selectedRes.parent_id || selectedRes.id
        }])
        .select()
        .single();

      if (vError) throw vError;

      // 2. 未完了の住民を新しい予約IDでコピー登録（ここも visit_request_residents テーブルで合っています）
      const residentInserts = pendingResidents.map(r => ({
        visit_request_id: newVisit.id,
        member_id: r.members.id,
        menu_name: r.menu_name,
        status: 'pending'
      }));

      const { error: rError } = await supabase.from('visit_request_residents').insert(residentInserts);
      if (rError) throw rError;

      showMsg(`${carryoverDate.replace(/-/g, '/')} へ ${pendingResidents.length} 名を引き継ぎました！✨`);
      setShowVisitDetailModal(false);
      setShowCarryoverPicker(false);
      fetchData(); // カレンダーを最新の状態に更新
    } catch (err) {
      console.error("Carryover Error:", err);
      alert("引き継ぎに失敗しました: " + err.message);
    } finally {
      setLoading(false);
    }
  };

const [editFields, setEditFields] = useState({ 
    name: '',       // ✅ 表のお名前用
    admin_name: '', // ✅ 裏のメモ名用
    furigana: '', phone: '', email: '', 
    address: '', parking: '', symptoms: '', request_details: '', 
    memo: '', line_user_id: null 
  });
    // キーボード選択用のIndex管理
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const scrollContainerRef = useRef(null);

  // --- ✨ 修正後：1分ごとに時間を更新するタイマーをセット ---
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // 1分ごとに更新
    return () => clearInterval(timer);
  }, []);

  // 🆕 ここに差し込み！（予約画面から戻った時の5秒ロック）
  useEffect(() => {
    const state = location.state;
    if (state?.fromReserve) {
      // 1. 成功メッセージを表示
      showMsg('予約を正常に受け付けました！✨');

      // 2. 予約した時間があれば、そこまでスクロール
      if (state?.targetTime) {
        setTimeout(() => {
          const element = document.getElementById(`time-row-${state.targetTime}`);
          if (element) {
            element.scrollIntoView({ 
              behavior: 'smooth', // 滑らかに動かす
              block: 'center'     // 画面の真ん中に持ってくる
            });
          }
        }, 800); // データの読み込み完了を少し待ってから実行
      }

      // 履歴に残らないように state をクリア
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!showMobileCalendar) {
      setViewMonth(new Date()); 
    }
  }, [showMobileCalendar]);

const isPC = windowWidth > 1024;

  // 🆕 項目が有効（WebまたはLINEのいずれか）か判定し、ラベルを取得するヘルパー
  const shouldShowInAdmin = (key) => {
    // 1. 基本の4項目は常に表示
    const basicFields = ['name', 'furigana', 'email', 'phone'];
    if (basicFields.includes(key)) return true;

    // 2. それ以外（住所、駐車場、症状など）は、FormCustomizerで「必須」になっている場合のみ表示
    const cfg = shop?.form_config?.[key];
    return cfg?.required === true;
  };

  // ラベル名を取得するヘルパー（既存のものを流用・整理）
  const getFieldLabel = (key) => {
    const customLabel = shop?.form_config?.[key]?.label;
    if (customLabel) return customLabel;

    // デフォルトの日本語名
    const defaults = {
      name: editFields.is_facility ? '施設名' : 'お名前',
      furigana: editFields.is_facility ? '施設名のふりがな' : 'ふりがな',
      email: 'メールアドレス',
      phone: '電話番号',
      address: '住所',
      zip_code: '郵便番号'
    };
    return defaults[key] || key;
  };

// 🚀 🆕 【追っかけトリガー】メイン画面の週移動、またはポップアップカレンダーの月変更を検知して通信を小分け実行
  useEffect(() => { 
    // ポップアップカレンダーが開いている時はカレンダーの表示月、閉じている時はメインの選択週をターゲットにする
    const activeTargetDate = showMobileCalendar ? viewMonth : startDate;
    fetchData(activeTargetDate); 
  }, [shopId, startDate, viewMonth, showMobileCalendar, location.search]);

  // 🚀 🆕 ここから追加：履歴のカードをタップした時に詳細ポップアップを開く命令
  const openHistoryDetail = (visit) => {
    setSelectedHistory(visit);
    setShowHistoryDetail(true);
  };

// 🚀 🆕 【小分け通信の仕掛け】表示されている日付に応じて賢く追加ロードするツインエンジン版
  const fetchData = async (customTargetDate = null) => {
    setLoading(true);
    
    // 1. 店舗設定・カテゴリ・スタッフ取得 (既存どおり)
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (!profile) { setLoading(false); return; }
    setShop(profile);

    const { data: catData } = await supabase.from('service_categories').select('name, url_key, custom_shop_name').eq('shop_id', shopId);
    const shopNameMap = {};
    catData?.forEach(c => { if (c.url_key) shopNameMap[c.url_key] = c.custom_shop_name || c.name; });
    setCategoryMap(shopNameMap);

    const { data: staffsData } = await supabase.from('staffs').select('*').eq('shop_id', shopId).eq('role_type', 'stylist').order('created_at', { ascending: true });
    setStaffs(staffsData || []);

    // 2. 基本の爆速レンジ（過去30日〜未来13か月）を計算
    const realToday = new Date();
    const historyPast = new Date(realToday.getTime() - (30 * 24 * 60 * 60 * 1000));
    const futureLimit = new Date(realToday.getFullYear(), realToday.getMonth() + 13, 0);

    let startRangeStr = historyPast.toLocaleDateString('sv-SE') + "T00:00:00Z";
    let endRangeStr = futureLimit.toLocaleDateString('sv-SE') + "T23:59:59Z";
    let finalStartDayStr = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}-01`;
    let finalEndDayStr = futureLimit.toLocaleDateString('sv-SE');

    // 💡 🚀 【ここが最大のキモ！】もしめくった先の日付（ customTargetDate ）が指定され、それが基本範囲外なら、その月だけを「小分け通信」で狙い撃ち
    if (customTargetDate) {
      const activeDate = new Date(customTargetDate);
      // 基本範囲外かチェック
      if (activeDate < historyPast || activeDate > futureLimit) {
        const firstDayOfMonth = new Date(activeDate.getFullYear(), activeDate.getMonth(), 1);
        const lastDayOfMonth = new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 0);
        
        startRangeStr = firstDayOfMonth.toLocaleDateString('sv-SE') + "T00:00:00Z";
        endRangeStr = lastDayOfMonth.toLocaleDateString('sv-SE') + "T23:59:59Z";
        finalStartDayStr = firstDayOfMonth.toLocaleDateString('sv-SE');
        finalEndDayStr = lastDayOfMonth.toLocaleDateString('sv-SE');
        console.log(`⏱ 範囲外データを検知: ${activeDate.getFullYear()}年${activeDate.getMonth()+1}月分を追っかけロードします。`);
      }
    }

    // 3. データ一斉取得
    const targetShopIds = profile.schedule_sync_id ? 
      (await supabase.from('profiles').select('id').eq('schedule_sync_id', profile.schedule_sync_id)).data.map(s => s.id) : [shopId];

    const [resRes, privRes, connRes, visitRes, keepRes, exclRes] = await Promise.all([
      supabase.from('reservations').select('id, shop_id, customer_id, customer_name, customer_phone, customer_email, start_time, end_time, status, res_type, biz_type, menu_name, total_price, total_slots, staff_id, created_at, staffs(name), customers(id, name, furigana, is_blocked, cancel_count)').in('shop_id', targetShopIds).gte('start_time', startRangeStr).lte('start_time', endRangeStr),
      supabase.from('private_tasks').select('*').eq('shop_id', shopId).gte('start_time', startRangeStr).lte('start_time', endRangeStr),
      supabase.from('shop_facility_connections').select('*, facility_users(id, facility_name, furigana, address, tel, email)').eq('shop_id', shopId).eq('status', 'active'),
      supabase.from('visit_requests').select('*, facility_users(facility_name), visit_request_residents(count)').eq('shop_id', shopId).neq('status', 'canceled').gte('scheduled_date', finalStartDayStr).lte('scheduled_date', finalEndDayStr),
      supabase.from('keep_dates').select('*, facility_users(*)').eq('shop_id', shopId).gte('date', finalStartDayStr).lte('date', finalEndDayStr),
      supabase.from('regular_keep_exclusions').select('excluded_date').eq('shop_id', shopId)
    ]);

    // 💡 🚀 もし追っかけロード（追加通信）だったら、既存のデータと合体（マージ）させて蓄積する
    if (customTargetDate && (new Date(customTargetDate) < historyPast || new Date(customTargetDate) > futureLimit)) {
      setReservations(prev => {
        const unique = new Map([...prev, ...(resRes.data || [])].map(item => [item.id, item]));
        return Array.from(unique.values());
      });
      setPrivateTasks(prev => {
        const unique = new Map([...prev, ...(privRes.data || [])].map(item => [item.id, item]));
        return Array.from(unique.values());
      });
      setVisitRequests(prev => {
        const unique = new Map([...prev, ...(visitRes.data || [])].map(item => [item.id, item]));
        return Array.from(unique.values());
      });
      setManualKeeps(prev => {
        const unique = new Map([...prev, ...(keepRes.data || [])].map(item => [item.id, item]));
        return Array.from(unique.values());
      });
    } else {
      // 通常（初期ロード範囲内）ならそのままセット
      setReservations(resRes.data || []);
      setPrivateTasks(privRes.data || []);
      setVisitRequests(visitRes.data || []);
      setManualKeeps(keepRes.data || []);
    }

    setFacilityConnections(connRes.data || []);
    setExclusions(exclRes.data?.map(e => e.excluded_date) || []);
    
    // 4. アラート用集計ロジック
    const todayStr = getJapanDateStr(realToday);
    const irregularList = []; const urgentList = []; const timeChangedList = []; const processedKeys = new Set();

    (keepRes.data || []).forEach(k => {
      if (k.date < todayStr) return;
      processedKeys.add(`${k.facility_user_id}_${k.date}`);
      const isBooked = (visitRes.data || []).some(v => (v.status === 'confirmed' || v.status === 'completed') && v.facility_user_id === k.facility_user_id && v.scheduled_date === k.date);
      if (isBooked) return;
      const [y, mon, d] = k.date.split('-').map(Number);
      const dObj = new Date(y, mon - 1, d);
      const diffDays = Math.round((dObj.getTime() - realToday.getTime()) / (1000 * 60 * 60 * 24)); 
      if (diffDays >= 0 && diffDays <= 3) urgentList.push({ ...k, diffDays });
      else irregularList.push({ ...k });
    });

    // B: 定期キープの自動スキャン
    (connRes.data || []).forEach(conn => {
      if (!conn.regular_rules) return;
      let scanDate = new Date(realToday);
      for (let i = 0; i < 90; i++) {
        const dStr = getJapanDateStr(scanDate);
        if (dStr < todayStr) { scanDate.setDate(scanDate.getDate() + 1); continue; }
        const comboKey = `${conn.facility_user_id}_${dStr}`;
        if (!processedKeys.has(comboKey)) {
           const day = scanDate.getDay(); const dom = scanDate.getDate(); const m = scanDate.getMonth() + 1;
           const nthWeek = Math.ceil(dom / 7);
           const isLast = new Date(scanDate).getMonth() !== new Date(new Date(scanDate).setDate(dom + 7)).getMonth();
           let isRegular = conn.regular_rules.some(r => (r.monthType===0 || (r.monthType===1 && m%2!==0) || (r.monthType===2 && m%2===0)) && r.day===day && (r.week===nthWeek || (r.week===-1 && isLast)));
           if (isRegular && !exclRes.data?.some(e => e.excluded_date === dStr)) {
              const isBooked = (visitRes.data || []).some(v => v.facility_user_id === conn.facility_user_id && v.scheduled_date === dStr);
              if (!isBooked) {
                 const fakeKeep = { id: `reg-${conn.facility_user_id}-${dStr}`, date: dStr, facility_user_id: conn.facility_user_id, facility_users: conn.facility_users, isRegular: true };
                 const diffDays = Math.round((scanDate.getTime() - realToday.getTime()) / (1000 * 60 * 60 * 24));
                 if (diffDays >= 0 && diffDays <= 3) urgentList.push({ ...fakeKeep, diffDays });
              }
           }
        }
        scanDate.setDate(scanDate.getDate() + 1);
      }
    });

    setIrregularKeeps(irregularList);
    setUrgentKeeps(urgentList);
    setTimeChangedKeeps(timeChangedList);
    setLoading(false);
  };
  // 🚀 🆕 追加：全顧客を50音順（フリガナ順）で取得
  const fetchAllCustomersForSearch = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('furigana', { ascending: true });

    if (data) {
      const uniqueMap = new Map();
      data.forEach(c => {
        const nameKey = (c.name || "").trim();
        if (!uniqueMap.has(nameKey) || (c.address && !uniqueMap.get(nameKey).address)) {
          uniqueMap.set(nameKey, c);
        }
      });

      // 💡 修正：お客様ではない特定の名前を除外してセットする
      const blockNames = ['臨時休業', '管理者ブロック', '休憩', '銀行', '買い出し', '移動'];
      const filteredCustomers = Array.from(uniqueMap.values()).filter(c => 
        !blockNames.includes(c.name)
      );

      setAllCustomers(filteredCustomers);
    }
  };

  useEffect(() => {
    const searchCustomers = async () => {
      if (!searchTerm) { setCustomers([]); setSelectedIndex(-1); return; }

      // 💡 修正：検索クエリに「ブロック名を除外する」条件を追加
      const blockNamesStr = '("臨時休業","管理者ブロック","休憩","銀行","買い出し","移動")';

      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .or(`name.ilike.%${searchTerm}%,admin_name.ilike.%${searchTerm}%`)
        .not('name', 'in', blockNamesStr) // 👈 これで検索から消えます！
        .limit(5);

      setCustomers(data || []);
      setSelectedIndex(-1); 
    };
    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, shopId]);

  // 🚀 ❶【ここから openDetail を追加：エラーを解消します】
  const openDetail = async (res) => {
    if (res.shop_id && res.shop_id !== shopId) {
      alert(`こちらは他店舗の予約です。`);
      return;
    }
    setLoading(true);

    try {
      let fullResData = res;
      if (res.id && res.res_type === 'normal') {
        const { data: freshRes } = await supabase
          .from('reservations')
          .select('id, shop_id, customer_id, start_time, end_time, status, res_type, customer_name, customer_phone, customer_email, menu_name, total_price, total_slots, staff_id, options')
          .eq('id', res.id)
          .maybeSingle();
        if (freshRes) fullResData = freshRes;
      }
      
      setSelectedRes(fullResData);

      let cust = null;
      if (fullResData.customer_id) {
        const { data: matched } = await supabase.from('customers').select('*').eq('id', fullResData.customer_id).maybeSingle();
        cust = matched;
      }
      if (!cust) {
        const orConditions = [];
        if (fullResData.customer_phone && fullResData.customer_phone !== '---') orConditions.push(`phone.eq.${fullResData.customer_phone}`);
        if (fullResData.customer_email) orConditions.push(`email.eq.${fullResData.customer_email}`);
        if (orConditions.length > 0) {
          const { data: matched } = await supabase.from('customers').select('*').eq('shop_id', shopId).or(orConditions.join(',')).maybeSingle();
          cust = matched;
        }
      }

      // 🚀 🆕 【全期間履歴のオンデマンド強制復活】
      // 画面読み込み軽量化の影響で、初期State（reservations）からは過去のデータが抜かれているため、
      // タップされたこのお客様の「過去全ての施術履歴」と「未来の全予定」を、期間制限なしでSupabaseから直接引っ張り出します！
      const isFac = cust?.is_facility || fullResData.res_type === 'facility_visit';
      const searchName = (cust?.name || fullResData.customer_name || "").trim();
      
      let allHistory = [];
      if (isFac) {
        // 🏢 施設訪問の場合：全期間の履歴を取得
        const { data: facHistory } = await supabase
          .from('visit_requests')
          .select('*, facility_users(facility_name)')
          .eq('shop_id', shopId)
          .neq('status', 'canceled')
          .or(`customer_name.eq.${searchName},facility_user_id.eq.${cust?.id || fullResData.facility_user_id}`);
        
        allHistory = (facHistory || [])
          .map(v => ({ ...v, start_time: v.scheduled_date }))
          .sort((a, b) => b.start_time.localeCompare(a.start_time));
      } else {
        // 👤 個人の場合：期間のフィルター（gte, lte）を一切かけず、この人名またはIDに紐づく全データを狙い撃ち取得！
        let resQuery = supabase
          .from('reservations')
          .select('*, staffs(name)')
          .eq('shop_id', shopId)
          .in('status', ['completed', 'confirmed', 'canceled'])
          .order('start_time', { ascending: false });
          
        if (cust?.id) {
          resQuery = resQuery.or(`customer_id.eq.${cust.id},customer_name.eq.${searchName}`);
        } else {
          resQuery = resQuery.eq('customer_name', searchName);
        }
        
        const { data: personalHistory } = await resQuery;
        allHistory = personalHistory || [];
      }

      // 💡 修正箇所③（finalizeOpenDetail内）で再度フィルターされてしまうのを防ぐため、
      // 先にここでお取り寄せした全期間の重い履歴データをバチッと流し込んでおきます！
      setCustomerHistory(allHistory);

      finalizeOpenDetail(fullResData, cust);
      
      // 🚀 🆕 呼び出し先の finalizeOpenDetail 側でせっかくの全期間履歴が上書き消去されないよう、
      // ほんの少しだけタイミングを遅らせて全履歴データをStateに確実に固定します！
      setTimeout(() => setCustomerHistory(allHistory), 50);

    } catch (err) {
      console.error("Open Detail Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 ❷【openCustomerDetail：履歴を確実に復活させる修正版】
  const openCustomerDetail = async (customer) => {
    setCustomerHistory([]); 

    const { data: latestCust } = await supabase.from('customers').select('*').eq('id', customer.id).maybeSingle();
    if (!latestCust) return;

    let facData = null;
    if (latestCust.is_facility) {
      const { data } = await supabase.from('facility_users').select('*').eq('facility_name', latestCust.name).maybeSingle();
      facData = data;
    }

    const isFac = latestCust.is_facility === true;
    const searchName = (latestCust.name || "").trim(); // 💡 空白を除去して確実にヒットさせる

    setEditFields({ 
      is_facility: isFac,
      name: latestCust.name || '', 
      admin_name: latestCust.admin_name || '',
      furigana: facData?.furigana || latestCust.furigana || '',
      phone: facData?.tel || latestCust.phone || '',
      email: facData?.email || latestCust.email || '', 
      address: facData?.address || latestCust.address || '',
      zip_code: latestCust.zip_code || '',
      parking: latestCust.parking || '', 
      memo: latestCust.memo || '',
      line_user_id: latestCust.line_user_id || null 
    });

    setSelectedCustomer(latestCust);
    setSelectedRes(null);

    let historyData = [];
    if (isFac) {
      // 🏢 施設名または本人名で過去の訪問名簿(visitRequests)を検索
      historyData = visitRequests
        .filter(v => (v.facility_users?.facility_name === searchName || v.customer_name === searchName))
        .map(v => ({ ...v, start_time: v.scheduled_date }))
        .sort((a, b) => b.start_time.localeCompare(a.start_time));
    } else {
      // 👤 個人名またはIDで過去の予約(reservations)を検索
      const { data } = await supabase.from('reservations').select('*, staffs(name)').eq('shop_id', shopId)
        .or(`customer_id.eq.${latestCust.id},customer_name.eq.${searchName}`)
        .order('start_time', { ascending: false });
      historyData = data || [];
    }

    setCustomerHistory(historyData);
    setSearchTerm('');
    setSelectedIndex(-1);
    setShowCustomerModal(true);
  };

  // 🚀 ❸【finalizeOpenDetail：施設情報の同期 ＆ 履歴復活】
  const finalizeOpenDetail = async (res, cust) => {
    // 💡 1. プライベート予定（休憩など）の場合は専用の処理
    if (res.res_type === 'private_task') {
      setSelectedCustomer(null);
      setEditFields({ 
        name: res.title, admin_name: '', phone: '', email: '', 
        memo: res.note || '', line_user_id: null, custom_answers: {} 
      });
      setCustomerHistory([]); setShowDetailModal(true); return;
    }

    // 💡 2. 予約データ(res)から情報を取得
    const isFac = cust?.is_facility || 
                  res.res_type === 'facility_visit' || 
                  res.res_type === 'facility_keep_single' || 
                  res.res_type === 'facility_keep_regular';

    const searchName = (cust?.name || res.customer_name || "").trim(); 

    // 施設データ等の取得（既存処理）
    let facData = null;
    if (isFac) {
      const targetFacId = res.facility_user_id || cust?.id;
      const query = supabase.from('facility_users').select('*');
      const { data } = targetFacId 
        ? await query.eq('id', targetFacId).maybeSingle()
        : await query.eq('facility_name', searchName).maybeSingle();
      facData = data;
    }

    setEditFields({
      is_facility: isFac, 
      name: cust ? (cust.admin_name || cust.name || res.customer_name) : res.customer_name,
      furigana: facData?.furigana || cust?.furigana || '',
      phone: facData?.tel || cust?.phone || res.customer_phone || '',
      email: facData?.email || cust?.email || res.customer_email || '',
      zip_code: facData?.zip_code || cust?.zip_code || '',
      address: facData?.address || cust?.address || '',
      parking: facData?.parking_info || cust?.parking || '',
      building_type: cust?.building_type || '',
      care_notes: cust?.care_notes || '',
      memo: res.res_type === 'private_task' ? (res.note || '') : (cust?.memo || ''),
      line_user_id: cust?.line_user_id || res.line_user_id || null,
      custom_answers: cust?.custom_answers || {}
    });

    setSelectedCustomer(cust || null);

    // 🚀 3. 【重要】ここを修正：過去〜未来の全データをSupabaseから直接読み込む
    setLoading(true);
    try {
      if (isFac) {
        // 施設訪問の場合は全期間取得
        const { data: historyData } = await supabase
          .from('visit_requests')
          .select('*, facility_users(facility_name)')
          .eq('shop_id', shopId)
          .or(`customer_name.eq.${searchName},facility_user_id.eq.${res.facility_user_id || cust?.id}`)
          .order('scheduled_date', { ascending: false });
        
        setCustomerHistory((historyData || []).map(v => ({ ...v, start_time: v.scheduled_date })));
      } else {
        // 個人の場合は期間制限なしで全件取得
        const { data: personalHistory } = await supabase
          .from('reservations')
          .select('*, staffs(name)')
          .eq('shop_id', shopId)
          .eq('res_type', 'normal')
          .or(`customer_name.eq.${searchName}${cust?.id ? `,customer_id.eq.${cust.id}` : ''}`)
          .order('start_time', { ascending: false }); // 過去〜未来すべて取得
        
        setCustomerHistory(personalHistory || []);
      }
    } catch (err) {
      console.error("履歴取得エラー:", err);
    } finally {
      setLoading(false);
      setShowDetailModal(true);
    }
  };

  // 🆕 ここから追記：理想の名寄せ：名前の選択肢を持たせた統合処理
  const handleMergeAction = async (masterId, finalName) => {
    try {
      // 1. 予約データのIDと名前を、選んだ名前に書き換えてマスタに紐付ける
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          customer_id: masterId,
          customer_name: finalName // 予約票上の表示名も統一する
        })
        .eq('id', selectedRes.id);

      if (resError) throw resError;

      // 2. 顧客マスタ側の名前も、三土手さんが選んだ「正解の名前」で更新
      const customerUpdate = { 
        name: finalName,
        updated_at: new Date().toISOString()
      };

      // Google IDがあれば紐付けを維持/追加
      if (selectedRes.auth_id) {
        customerUpdate.auth_id = selectedRes.auth_id;
      }

      const { error: custError } = await supabase
        .from('customers')
        .update(customerUpdate)
        .eq('id', masterId);

      if (custError) throw custError;

      console.log(`✅ 統合完了: 「${finalName}」様としてマスタを確定しました`);
      
      setShowMergeConfirm(false);
      fetchData(); // カレンダーの表示名を更新するために再取得
      finalizeOpenDetail(selectedRes, { ...mergeCandidate, name: finalName }); 
    } catch (err) {
      console.error("名寄せエラー:", err);
      alert("統合処理に失敗しました。");
    }
  };
// 🆕 追記ここまで

  // 🆕 追加：画面に通知を出す関数 [cite: 2026-03-08]
  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  // 🚀 🆕 追加：特定の単発キープを既読（非表示）にする共通関数
  const markKeepAsDismissed = (id) => {
    if (!id || dismissedKeeps.includes(id)) return;
    const newDismissed = [...dismissedKeeps, id];
    setDismissedIrregularIds(newDismissed);
    localStorage.setItem(`dismissed_keeps_${shopId}`, JSON.stringify(newDismissed));
  };

  // 🚀 🆕 追加：Edge Function を呼び出して施設を「つつく（メール送信）」
  const handleEmailNudge = async (keep) => {
    if (!window.confirm(`${keep.facility_users?.facility_name} 様へ、名簿作成の催促メールを送信しますか？`)) return;

    try {
      showMsg("メールを送信中...");
      
      const { data, error } = await supabase.functions.invoke('resend', {
        body: {
          type: 'facility_nudge',
          shopId: shopId,
          facilityId: keep.facility_user_id,
          keepDate: keep.date,
          // 🚀 🆕 ここを追加！
          shopName: shop?.business_name, 
          ownerName: shop?.owner_name
        }
      });

      if (error) throw error;
      showMsg("催促メールを送信しました！📬");
    } catch (err) {
      console.error("Nudge Error:", err);
      alert("送信に失敗しました: " + err.message);
    }
  };

  /* ============================================================
     🌟🌟🌟 ここに追加します！ 🌟🌟🌟
     ============================================================ */
  // 🚀 🆕 追加：キープ枠を強制削除する命令
  const handleForceDeleteKeep = async (keep) => {
    const facilityName = keep.facility_users?.facility_name || "施設";
    if (!window.confirm(`【強制キャンセル】\n${facilityName} 様の ${keep.date.replace(/-/g, '/')} のキープ枠を強制的に削除しますか？\nこの操作は取り消せません。`)) return;

    setLoading(true);
    try {
      if (keep.isRegular) {
        // 定期枠の場合：除外テーブルに放り込む
        await supabase.from('regular_keep_exclusions').upsert([{ 
          facility_user_id: keep.facility_user_id, shop_id: shopId, excluded_date: keep.date 
        }]);
        // もしすでに時間変更等で keep_dates 側に実体レコードがあればそれも消す
        if (!String(keep.id).startsWith('reg-')) {
          await supabase.from('keep_dates').delete().eq('id', keep.id);
        }
      } else {
        // 純粋な単発キープの場合
        const { error } = await supabase.from('keep_dates').delete().eq('id', keep.id);
        if (error) throw error;
      }

      showMsg("キープ枠を強制的に解放しました。");
      fetchData();
    } catch (err) {
      console.error("Force Delete Error:", err);
      alert("解除に失敗しました: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  /* ============================================================
     🌟🌟🌟 追加ここまで 🌟🌟🌟
     ============================================================ */

  // 🚀 🆕 ここに追加：単発キープの強制削除（連絡がない場合など）
  const handleForceCancelKeep = async (keep) => {
    if (!window.confirm(`${keep.facility_users?.facility_name} 様のこのキープ枠を強制キャンセルしますか？\n（カレンダーから削除され、一般予約が受けられるようになります）`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('keep_dates')
        .delete()
        .eq('id', keep.id);

      if (error) throw error;

      showMsg("キープ枠を解除しました。一般予約の受付が可能です。✨");
      fetchData(); // カレンダーを更新
    } catch (err) {
      console.error("Cancel Error:", err);
      alert("解除に失敗しました: " + err.message);
    } finally {
      setLoading(false);
    }
  };

// ✅ 重複防止・データ保護・一括紐付けロジック：完全版
  const handleUpdateCustomer = async () => {
    try {
      const normalizedName = editFields.name.replace(/　/g, ' ').trim();
      if (!normalizedName) { alert("お名前を入力してください。"); return; }

      // --- 🚀 ここから追加 ---
      // 💡 A: ブロック枠 または プライベート予定 の場合（メモは 'note' カラムに保存）
      if (selectedRes?.res_type === 'blocked' || selectedRes?.res_type === 'private_task') {
        const isPrivate = selectedRes.res_type === 'private_task';
        const targetTable = isPrivate ? 'private_tasks' : 'reservations';
        const updateData = isPrivate 
          ? { title: normalizedName, note: editFields.memo } // 👈 editFields.memo を note に保存
          : { customer_name: normalizedName };

        const { error } = await supabase.from(targetTable).update(updateData).eq('id', selectedRes.id);
        if (error) throw error;
        
        showMsg('予定を更新しました！✨');
        setShowDetailModal(false);
        fetchData();
        return; // プライベート予定の時はここで終了
      }

      // 1. まず同じ名前の人がいないかDBをチェック（名寄せ）
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('shop_id', shopId)
        .eq('name', normalizedName)
        .maybeSingle();

      const finalTargetId = selectedCustomer?.id || existingCust?.id;

      // --- 🚀 🆕 ここから「強力な名寄せ（統合）」ロジックを追加 ---
      const cleanPhone = editFields.phone?.replace(/[^0-9]/g, '');
      const cleanEmail = editFields.email?.trim();

      // 💡 IDが確定していて、かつ電話かメールが入力されている場合のみ実行
      if (finalTargetId && (cleanPhone || cleanEmail)) {
        // 自分自身(finalTargetId)以外の、同じ電話番号またはメールアドレスを持つ人を探す
        let dupQuery = supabase.from('customers').select('id, name').eq('shop_id', shopId).neq('id', finalTargetId);
        
        const conditions = [];
        if (cleanPhone) conditions.push(`phone.eq.${cleanPhone}`);
        if (cleanEmail) conditions.push(`email.eq.${cleanEmail}`);
        
        const { data: duplicates } = await dupQuery.or(conditions.join(','));

        if (duplicates && duplicates.length > 0) {
          const oldCust = duplicates[0];
          // 三土手さんに確認（家族で番号共有している場合などの誤爆防止）
          if (window.confirm(`【名寄せ検知】\n別のIDで登録されている「${oldCust.name}」様のデータが見つかりました。\n\n過去のすべての予約・売上記録を、今のデータに統合して、古い名簿を削除してもよろしいですか？`)) {
            
            // A. 予約データの引っ越し
            await supabase.from('reservations').update({ customer_id: finalTargetId }).eq('customer_id', oldCust.id);
            
            // B. 売上データの引っ越し
            await supabase.from('sales').update({ customer_id: finalTargetId }).eq('customer_id', oldCust.id);
            
            // C. 履歴が空になった古い顧客マスタを削除
            await supabase.from('customers').delete().eq('id', oldCust.id);
            
            console.log("✅ 同一人物のデータを統合し、古いIDを削除しました:", oldCust.id);
          }
        }
      }

      // 2. 保存用データの作成（フォームの全項目を名簿のカラムにマッピング）
      const customerPayload = {
        id: finalTargetId,
        shop_id: shopId,
        name: normalizedName,
        admin_name: normalizedName,
        furigana: editFields.furigana || null,
        phone: editFields.phone || null,
        email: editFields.email || null,
        address: editFields.address || null, // 👈 住所を名簿に保存
        zip_code: editFields.zip_code || null,
        parking: editFields.parking || null, // 👈 駐車場を名簿に保存
        building_type: editFields.building_type || null,
        care_notes: editFields.care_notes || null,
        company_name: editFields.company_name || null,
        symptoms: editFields.symptoms || null,
        request_details: editFields.request_details || null,
        memo: editFields.memo || null,
        line_user_id: editFields.line_user_id || selectedRes?.line_user_id || null,
        updated_at: new Date().toISOString()
      };

      // 3. 【最重要】顧客名簿（customersテーブル）を更新
      const { data: savedCust, error: custError } = await supabase
        .from('customers')
        .upsert(customerPayload, { onConflict: 'id' })
        .select()
        .single();
      
      if (custError) throw custError;
      const finalCustomerId = savedCust.id;

      // 🚩 🚀 【ここが変更点！】
      // 以前提案した facility_users への update 処理は「まるごと削除」してください。
      // これにより、施設様側の情報を勝手に書き換えることはなくなります。

      // 4. 以降、予約データの更新やリフレッシュ処理へと続く...
      if (selectedRes?.id && selectedRes.res_type === 'normal') {
        const currentOptions = selectedRes.options || {};
        const updatedVisitInfo = {
          ...(currentOptions.visit_info || {}),
          address: editFields.address,
          parking: editFields.parking,
          furigana: editFields.furigana,
          zip_code: editFields.zip_code
        };

        await supabase
          .from('reservations')
          .update({ 
            customer_name: normalizedName,
            customer_phone: editFields.phone,
            customer_id: finalCustomerId,
            staff_id: selectedRes.staff_id, // 🚀 🆕 変更したスタッフIDを保存対象に追加！
            options: { ...currentOptions, visit_info: updatedVisitInfo }
          })
          .eq('id', selectedRes.id);
      }

      // 5. 画面の表示を最新にする
      showMsg('名簿情報を更新しました！✨'); 
      setShowDetailModal(false); 
      setShowCustomerModal(false); // 👈 検索モーダルも確実に閉じる
      
      // 💡 保存した瞬間に「検索用の全顧客リスト」を最新に作り直す
      await fetchAllCustomersForSearch(); 
      
      fetchData(); // カレンダー表示を更新
    } catch (err) {
      console.error(err);
      alert('保存エラー: ' + err.message);
    }
  };

  // 🆕 追加：プライベート予定(private_tasksテーブル)を保存する関数
  const handleSavePrivateTask = async (slots) => {
    if (!privateTaskFields.title) {
      alert("予定の内容（タイトル）を入力してください。");
      return;
    }

    try {
      const start = new Date(`${selectedDate}T${targetTime}:00`);
      const interval = shop.slot_interval_min || 15;
      // 💡 選ばれたコマ数（slots）を掛けて終了時間を計算する
      const end = new Date(start.getTime() + (interval * slots) * 60000);

      const { error } = await supabase.from('private_tasks').insert([{
        shop_id: shopId,
        title: privateTaskFields.title,
        note: privateTaskFields.note,
        start_time: start.toISOString(),
        end_time: end.toISOString()
      }]);

      if (error) throw error;

      // 成功したらリセットして閉じる
      setShowPrivateModal(false);
      setPrivateTaskFields({ title: '', note: '' });
      showMsg(`「${privateTaskFields.title}」を 〜${end.toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})} まで追加しました☕️`);
      fetchData(); // カレンダーに反映
    } catch (err) {
      console.error("保存エラー:", err.message);
      alert("保存に失敗しました。");
    }
  };

// --- [330行目付近] ---
  // 🆕 キャンセル（記録を残す）処理
  const cancelRes = async (id) => {
    if (!window.confirm("この予約を「キャンセル扱い」にして記録に残しますか？\n（予約枠は空きます）")) return;

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'canceled' })
        .eq('id', id);

      if (error) throw error;

      // 🚀 🆕 追加：顧客マスタのキャンセル回数を +1 する
      if (selectedRes?.customer_id) {
        const { data: cust } = await supabase.from('customers').select('cancel_count').eq('id', selectedRes.customer_id).single();
        await supabase.from('customers').update({ cancel_count: (cust?.cancel_count || 0) + 1 }).eq('id', selectedRes.customer_id);
      }
      
      setShowDetailModal(false);
      fetchData();
      showMsg("キャンセルとして記録しました");
    } catch (err) {
      alert("エラー: " + err.message);
    }
  };

  const deleteRes = async (id) => {
    const isPrivate = selectedRes?.res_type === 'private_task';
    const isBlock = selectedRes?.res_type === 'blocked';
    
    // メッセージの出し分け
    let msg = 'この予約データを消去して予約を「可能」に戻しますか？';
    if (isPrivate) msg = 'このプライベート予定を削除しますか？';
    if (isBlock) msg = 'このブロックを解除して予約を「可能」に戻しますか？';
    
    if (window.confirm(msg)) {
      // ✅ 🆕 修正：テーブルを使い分ける
      const targetTable = isPrivate ? 'private_tasks' : 'reservations';
      const { error: deleteError } = await supabase.from(targetTable).delete().eq('id', id);

      if (deleteError) { alert('削除に失敗しました: ' + deleteError.message); return; }

      // 予約（normal）の場合のみ、顧客マスタの来店回数を減らすロジック（既存）
      if (!isPrivate && selectedRes.res_type === 'normal') {
        const { customer_name } = selectedRes;
        const { count } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('customer_name', customer_name);
        if (count === 0) {
          await supabase.from('customers').delete().eq('shop_id', shopId).eq('name', customer_name);
        } else {
          const { data: cust } = await supabase.from('customers').select('id, total_visits').eq('shop_id', shopId).eq('name', customer_name).maybeSingle();
          if (cust) {
            await supabase.from('customers').update({ total_visits: Math.max(0, (cust.total_visits || 1) - 1) }).eq('id', cust.id);
          }
        }
      }
      
      setShowDetailModal(false); 
      fetchData(); // 再読み込み
      showMsg(isPrivate ? "予定を削除しました" : "予約を削除しました");
    }
  };

  // 開いているポップアップをすべて強制終了する「お掃除」関数
  const closeAllPopups = () => {
    setShowMenuModal(false);         // 時間枠クリックメニュー（2択/4択）
    setShowDetailModal(false);       // 予約詳細・カルテ画面
    setShowSlotListModal(false);     // 複数予約が重なった時の選択リスト
    setShowMobileCalendar(false);    // スマホ用ミニカレンダー
    setShowMobileSearchModal(false); // スマホ用50音検索ポップアップ
    setShowHistoryDetail(false);     // 📜 今回新しく作った「履歴詳細」
  };
  
  // 🆕 定期キープ（施設とのお約束）の判定：エラー修正版
  const checkIsRegularKeep = (date, ignoreExclusion = false) => {
    const dStr = getJapanDateStr(date);
    
    // 🚀 修正：ignoreExclusion が false の時だけ除外リストをチェックする
    if (!ignoreExclusion && exclusions.includes(dStr)) return null;

    const day = date.getDay(); // 0:日, 1:月...
    const dom = date.getDate();
    const m = date.getMonth() + 1;
    const nthWeek = Math.ceil(dom / 7);

    // 最終週・最後から2番目の判定用
    const tempNext = new Date(date); tempNext.setDate(dom + 7);
    const isLastWeek = tempNext.getMonth() !== date.getMonth();
    const tempNext2 = new Date(date); tempNext2.setDate(dom + 14);
    const isSecondToLastWeek = (tempNext2.getMonth() !== date.getMonth()) && !isLastWeek;

    let result = null; 
    
    // facilityConnections をループして条件に合うルールを探す
    facilityConnections.forEach(conn => {
      conn.regular_rules?.forEach(rule => {
        // 月・曜日・週の条件が一致するかチェック
        const monthMatch = (rule.monthType === 0) || (rule.monthType === 1 && m % 2 !== 0) || (rule.monthType === 2 && m % 2 === 0);
        const dayMatch = (rule.day === day);
        let weekMatch = (rule.week === nthWeek);
        if (rule.week === -1) weekMatch = isLastWeek;
        if (rule.week === -2) weekMatch = isSecondToLastWeek;

        if (monthMatch && dayMatch && weekMatch) {
          result = {
            name: conn.facility_users?.facility_name,
            time: rule.time || '09:00',
            // 🆕 キャンセル実行用にIDをセット
            facility_user_id: conn.facility_user_id 
          };
        }
      });
    });
    return result;
  };

  const checkIsRegularHoliday = (date) => {
    if (!shop?.business_hours?.regular_holidays) return false;
    const holidays = shop.business_hours.regular_holidays;
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[date.getDay()];
    const dom = date.getDate();
    const nthWeek = Math.ceil(dom / 7);
    const tempDate = new Date(date);
    const currentMonth = tempDate.getMonth();
    const checkLast = new Date(date); checkLast.setDate(dom + 7);
    const isLastWeek = checkLast.getMonth() !== currentMonth;
    const checkSecondLast = new Date(date); checkSecondLast.setDate(dom + 14);
    const isSecondToLastWeek = (checkSecondLast.getMonth() !== currentMonth) && !isLastWeek;
    if (holidays[`${nthWeek}-${dayName}`]) return true;
    if (isLastWeek && holidays[`L1-${dayName}`]) return true;
    if (isSecondToLastWeek && holidays[`L2-${dayName}`]) return true;
    return false;
  };

  // ✅ 🆕 追加：長期休暇（夏休み等）の期間中か判定する
  const checkIsSpecialHoliday = (date) => {
    // 💡 DBの新カラム special_holidays を参照します
    if (!shop?.special_holidays || !Array.isArray(shop.special_holidays)) return false;
    
    const dStr = getJapanDateStr(date); // YYYY-MM-DD形式
    return shop.special_holidays.some(h => dStr >= h.start && dStr <= h.end);
  };

  // 🚀 🆕 追加：引き継ぎカレンダー用の「空き状況」判定ロジック
  const getCarryoverDayStatus = (dateStr) => {
    const d = new Date(dateStr);
    const todayStr = getJapanDateStr(new Date());
    if (dateStr <= todayStr) return 'past';

    // 1. 🚀 【Hard Block】基本の休み（定休日・長期休暇） -> ✕
    if (checkIsRegularHoliday(d) || checkIsSpecialHoliday(d)) return 'ng';

    // 2. 🚀 【Hard Block】他施設の「定期キープ」チェック -> ✕
    const regKeep = checkIsRegularKeep(d);
    if (regKeep && regKeep.facility_user_id !== selectedRes?.facility_user_id && !exclusions.includes(dateStr)) {
      return 'ng';
    }

    // 3. 🚀 【Hard Block】他施設の「確定予約・単発キープ」チェック -> ✕
    const hasOtherFacilityEvent = [
      ...visitRequests.filter(v => 
        v.status !== 'canceled' && 
        v.id !== selectedRes?.id && 
        (v.scheduled_date === dateStr || (Array.isArray(v.visit_date_list) && v.visit_date_list.some(dv => (typeof dv === 'string' ? dv : dv.date) === dateStr)))
      ),
      ...manualKeeps.filter(k => 
        k.date === dateStr && 
        k.facility_user_id !== selectedRes?.facility_user_id
      )
    ].length > 0;

    if (hasOtherFacilityEvent) return 'ng';

    // 4. 🚀 【Soft Block】個人予約 or プライベート予定の重なりチェック -> △ (partial)
    const personalEvents = [
      ...reservations.filter(r => 
        r.start_time.startsWith(dateStr) && 
        r.status !== 'canceled' && 
        r.res_type === 'normal'
      ).map(r => ({ start: new Date(r.start_time).getTime(), end: new Date(r.end_time).getTime() })),
      ...privateTasks.filter(p => 
        p.start_time.startsWith(dateStr)
      ).map(p => ({ start: new Date(p.start_time).getTime(), end: new Date(p.end_time).getTime() }))
    ];

    if (personalEvents.length > 0) {
      const bHours = shop?.business_hours || {};
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayKey = dayNames[d.getDay()];
      
      const startStr = bHours[dayKey]?.open || '09:00';
      const endStr = bHours[dayKey]?.close || '18:00';

      const bizStart = new Date(`${dateStr}T${startStr}:00`).getTime();
      const bizEnd = new Date(`${dateStr}T${endStr}:00`).getTime();

      // 営業時間に少しでも重なっている個人予定があれば △ を返す
      const hasOverlap = personalEvents.some(e => e.start < bizEnd && e.end > bizStart);
      if (hasOverlap) return 'partial'; 
    }

    // 5. 何もなければ ◎
    return 'available';
  };

  // 🚀 🆕 修正：カレンダー表示用の状態判定（一番早い予定の名前を取得するように強化）
  const getDayEventSummary = (date) => {
    if (!date) return { isHoliday: false, firstEntry: null, types: [] };
    const dStr = getJapanDateStr(date);

    const isRegHoliday = checkIsRegularHoliday(date);
    const isSpecHoliday = checkIsSpecialHoliday(date);

    // その日の全予定をかき集める
    const dayEntries = [];

    // ① 一般予約・ねじ込み
    reservations.forEach(r => {
      if (r.start_time.startsWith(dStr) && r.res_type === 'normal' && r.status !== 'canceled') {
        dayEntries.push({ time: r.start_time, name: r.customer_name, type: 'normal' });
      }
    });

    // ② 施設（確定・手動キープ）
    visitRequests.forEach(v => {
      if ((v.scheduled_date === dStr || (Array.isArray(v.visit_date_list) && v.visit_date_list.some(d => (typeof d === 'string' ? d : d.date) === dStr))) && v.status !== 'canceled') {
        dayEntries.push({ time: `${dStr}T${v.start_time || '09:00'}`, name: v.facility_users?.facility_name || '施設', type: 'facility' });
      }
    });
    manualKeeps.forEach(k => {
      if (k.date === dStr) {
        dayEntries.push({ time: `${dStr}T${k.start_time || '09:00'}`, name: k.facility_users?.facility_name || '施設予定', type: 'facility' });
      }
    });

    // ③ 施設の定期キープ
    const rKeep = checkIsRegularKeep(date);
    if (rKeep) {
      dayEntries.push({ time: `${dStr}T${rKeep.time}`, name: rKeep.name, type: 'facility' });
    }

    // ④ プライベート予定
    privateTasks.forEach(p => {
      if (p.start_time.startsWith(dStr)) {
        dayEntries.push({ time: p.start_time, name: p.title, type: 'private' });
      }
    });

    // 時間順に並び替えて一番早いものを特定
    dayEntries.sort((a, b) => a.time.localeCompare(b.time));
    const first = dayEntries[0] || null;

    return { 
      isHoliday: isRegHoliday || isSpecHoliday, 
      firstEntry: first,
      hasReservation: dayEntries.some(e => e.type === 'normal'),
      hasFacility: dayEntries.some(e => e.type === 'facility'),
      hasPrivate: dayEntries.some(e => e.type === 'private')
    };
  };

  const weekDays = useMemo(() => {
    const days = [];
    const base = new Date(startDate);
    const dayOfWeek = base.getDay(); 
    base.setDate(base.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); 
    for (let i = 0; i < 7; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i); days.push(d);
    }
    return days;
  }, [startDate]);

  const timeSlots = useMemo(() => {
    if (!shop?.business_hours) return [];
    let minTotalMinutes = 24 * 60;
    let maxTotalMinutes = 0;
    let hasOpenDay = false;
    Object.values(shop.business_hours).forEach(h => {
      if (typeof h === 'object' && !h.is_closed && h.open && h.close) {
        hasOpenDay = true;
        const [openH, openM] = h.open.split(':').map(Number);
        const [closeH, closeM] = h.close.split(':').map(Number);
        if (openH * 60 + openM < minTotalMinutes) minTotalMinutes = openH * 60 + openM;
        if (closeH * 60 + closeM > maxTotalMinutes) maxTotalMinutes = closeH * 60 + closeM;
      }
    });
    if (!hasOpenDay) { minTotalMinutes = 9 * 60; maxTotalMinutes = 18 * 60; }
    const slots = [];
    const interval = shop.slot_interval_min || 15;
    const extraBefore = shop.extra_slots_before || 0;
    const extraAfter = shop.extra_slots_after || 0;

    // 1. 【前方の拡張枠】30分固定で計算
    for (let i = extraBefore; i > 0; i--) {
      const m = minTotalMinutes - (i * 30);
      const h = Math.floor(m / 60); const mm = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }

    // 2. 【営業時間内】設定されたインターバル（10分など）で計算
    for (let m = minTotalMinutes; m < maxTotalMinutes; m += interval) {
      const h = Math.floor(m / 60); const mm = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
    
    // 閉店時間ちょうどを最後に追加（営業時間ループの終着点）
    const hEnd = Math.floor(maxTotalMinutes / 60); const mmEnd = maxTotalMinutes % 60;
    slots.push(`${String(hEnd).padStart(2, '0')}:${String(mmEnd).padStart(2, '0')}`);

    // 3. 【後方の拡張枠】30分固定で計算
    for (let i = 1; i <= extraAfter; i++) {
      const m = maxTotalMinutes + (i * 30);
      const h = Math.floor(m / 60); const mm = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
    return slots;
  }, [shop]);

  const getJapanDateStr = (date) => date.toLocaleDateString('sv-SE');

const getStatusAt = (dateStr, timeStr) => {
    const dateObj = new Date(dateStr);
    const currentSlotTime = timeStr; // "09:00"

    // --- 🏆 優先度1：確定した施設訪問（visit_requests） ---
    const confirmedVisit = visitRequests.find(v => {
      // 🚀 🆕 確定(confirmed) だけでなく 完了(completed) も対象に含める
      if (!['confirmed', 'completed'].includes(v.status)) return false;
      const vStart = v.start_time?.substring(0, 5) || "09:00";
      if (Array.isArray(v.visit_date_list)) {
        return v.visit_date_list.some(d => {
          if (typeof d === 'string') return d === dateStr && vStart === currentSlotTime;
          return d.date === dateStr && (d.start_time || d.time)?.substring(0, 5) === currentSlotTime;
        });
      }
      return v.scheduled_date === dateStr && vStart === currentSlotTime;
    });

    if (confirmedVisit) {
      return [{
        res_type: 'facility_visit',
        customer_name: confirmedVisit.facility_users?.facility_name, 
        visitId: confirmedVisit.id,
        start_time: `${dateStr}T${timeStr}:00`,
        visitData: confirmedVisit 
      }];
    }

    // --- 🏆 優先度2：手動追加のキープ（★） ---
    const mKeep = manualKeeps.find(k => {
      const kTime = (k.start_time || "09:00").substring(0, 5);
      return k.date === dateStr && kTime === currentSlotTime;
    });

    if (mKeep) {
      // 🚀 修正：ignoreExclusion を true にして「本来は定期か」を判定！
      const matchedRule = checkIsRegularKeep(dateObj, true); 
      const isRegular = matchedRule && matchedRule.facility_user_id === mKeep.facility_user_id;

      return [{
        // 🚀 🆕 ここを追加！ これがないと markKeepAsDismissed(activeTask.id) が動きません
        id: mKeep.id, 
        res_type: isRegular ? 'facility_keep_regular' : 'facility_keep_single',
        customer_name: mKeep.facility_users?.facility_name,
        facility_user_id: mKeep.facility_user_id,
        start_time: `${dateStr}T${timeStr}:00`,
        isKeep: true,
        isRegular: isRegular
      }];
    }

    const rKeep = checkIsRegularKeep(dateObj);
    if (rKeep && rKeep.time === currentSlotTime) {
      // 🚀 🆕 追加：この施設に対して、同じ日に「手動変更(manualKeeps)」または「確定予約」があるかチェック
      const hasManualOverride = manualKeeps.some(k => k.date === dateStr && k.facility_user_id === rKeep.facility_user_id);
      const hasConfirmedVisit = visitRequests.some(v => v.scheduled_date === dateStr && v.facility_user_id === rKeep.facility_user_id);

      // 💡 もし既に実体データがあるなら、計算上の「定期枠」は表示しない（これで重複が消えます！）
      if (hasManualOverride || hasConfirmedVisit) return null;

      return [{
        res_type: 'facility_keep',
        customer_name: `${rKeep.name} 予定`,
        facility_user_id: rKeep.facility_user_id,
        start_time: `${dateStr}T${timeStr}:00`,
        isKeep: true
      }];
    }

    // --- 🏆 優先度3：施設訪問日の「それ以外の時間」をステルスブロック ---
    const currentSlotStart = new Date(`${dateStr}T${timeStr}:00+09:00`).getTime();

    // 1. お客様の予約（ねじ込み含む）
    const resMatches = reservations.filter(r => {
      const start = new Date(r.start_time).getTime();
      const end = new Date(r.end_time).getTime();
      
      // 基本的な時間一致判定
      const isTimeMatch = currentSlotStart >= start && currentSlotStart < end;
      
      if (isTimeMatch) {
        // 🚀 🆕 修正：optionsの奥深く（peopleの中）にあるメニュー情報まで探りに行く
        const opt = typeof r.options === 'string' ? JSON.parse(r.options) : (r.options || {});
        const items = opt.people && Array.isArray(opt.people) 
                        ? opt.people.flatMap(p => p.services || []) 
                        : (opt.services || []);
                        
        // メニューの中に「1日貸切（is_full_day: true）」が含まれているかチェック
        const isFullDay = opt.isFullDay === true || items.some(s => s.is_full_day === true);
        
        if (isFullDay) {
          // 💡 貸切なら、開始時間の「最初の1コマ」だけを表示する
          return currentSlotStart === start;
        }

        // ブロック枠の判定（既存のまま）
        if (r.res_type === 'blocked') return r.staff_id === null;
        return true;
      }
      return false;
    });

    // 2. プライベート予定
    const privMatches = privateTasks.filter(p => {
      const start = new Date(p.start_time).getTime();
      const end = new Date(p.end_time).getTime();
      return currentSlotStart >= start && currentSlotStart < end;
    }).map(p => ({ ...p, res_type: 'private_task', customer_name: p.title }));

    const matches = [...resMatches, ...privMatches];
    if (matches.length > 0) return matches; // ✅ 予約があれば即座にそれを表示！

    // --- 🏆 優先度4：予約がない枠だけ、施設訪問日の「ステルスブロック」をかける ---
    // status に 'completed' も含めることで、お会計後もブロックを維持します
    const hasAnyConfirmedVisitThisDay = visitRequests.some(v => 
      (v.status === 'confirmed' || v.status === 'completed') && 
      (v.scheduled_date === dateStr || (Array.isArray(v.visit_date_list) && v.visit_date_list.some(d => d.date === dateStr)))
    );
    const hasAnyKeepThisDay = manualKeeps.some(k => k.date === dateStr) || checkIsRegularKeep(dateObj);

    if (hasAnyConfirmedVisitThisDay || hasAnyKeepThisDay) {
      return [{ res_type: 'facility_day_stealth', customer_name: '', start_time: `${dateStr}T${timeStr}:00` }];
    }

    // --- 🏆 優先度5：定休日・長期休暇・営業時間内判定 ---
    const isSpecialHoliday = checkIsSpecialHoliday(dateObj);
    if (checkIsRegularHoliday(dateObj) || isSpecialHoliday) {
      return { 
        res_type: 'blocked', 
        customer_name: isSpecialHoliday ? (shop.special_holidays.find(h => getJapanDateStr(dateObj) >= h.start && getJapanDateStr(dateObj) <= h.end)?.name || '長期休暇') : '定休日', 
        start_time: `${dateStr}T${timeStr}:00`, isRegularHoliday: true 
      };
    }

    // 営業時間内のインターバルや自動詰め表示（略：既存ロジックを継続）
    // ...
    return null;
  };
  const executeBlockTime = async (slots) => {
    const interval = shop.slot_interval_min || 15;
    const start = new Date(`${selectedDate}T${targetTime}:00`);
    const end = new Date(start.getTime() + (interval * slots) * 60000);
    
    const insertData = {
      shop_id: shopId, 
      customer_name: '✕', 
      res_type: 'blocked',
      is_block: true, 
      start_time: start.toISOString(), 
      end_time: end.toISOString(),
      total_slots: slots, 
      customer_email: null, 
      customer_phone: '---', 
      options: { type: 'admin_block' }
    };
    
    const { error } = await supabase.from('reservations').insert([insertData]);
    if (error) {
      alert(`エラー: ${error.message}`); 
    } else { 
      setShowMenuModal(false); 
      setShowBlockEndSelector(false); 
      fetchData(); 
      showMsg(`${slots}コマ分（〜${end.toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})}）を「✕」にしました`); 
    }
  };

  const handleBlockFullDay = async () => {
    if (!window.confirm(`${selectedDate.replace(/-/g, '/')} を終日「予約不可」にしますか？`)) return;
    const interval = shop.slot_interval_min || 15;
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(selectedDate).getDay()];
    const hours = shop.business_hours?.[dayName];
    const openStr = (hours && !hours.is_closed && hours.open) ? hours.open : "09:00";
    const closeStr = (hours && !hours.is_closed && hours.close) ? hours.close : "18:00";
    const start = new Date(`${selectedDate}T${openStr}:00`);
    const end = new Date(`${selectedDate}T${closeStr}:00`);
    const [oh, om] = openStr.split(':').map(Number); const [ch, cm] = closeStr.split(':').map(Number);
    const totalMinutes = (ch * 60 + cm) - (oh * 60 + om);
    const slotsCount = Math.ceil(totalMinutes / interval);
    const insertData = {
      shop_id: shopId, 
      customer_name: '臨時休業', 
      res_type: 'blocked',
      is_block: true, // 🚀 🆕 「これは予約枠のブロックです」という印を付ける
      start_at: start.toISOString(), 
      end_at: end.toISOString(),
      start_time: start.toISOString(), 
      end_time: end.toISOString(),
      total_slots: slotsCount, 
      customer_email: null, 
      customer_phone: '---',
      options: { services: [], isFullDay: true }
    };
    const { error } = await supabase.from('reservations').insert([insertData]);
    if (error) alert(`エラー: ${error.message}`); else { setShowMenuModal(false); fetchData(); }
  };

  const miniCalendarDays = useMemo(() => {
    const year = viewMonth.getFullYear(); const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [viewMonth]);

  const goPrev = () => setStartDate(new Date(new Date(startDate).setDate(new Date(startDate).getDate() - 7)));
  const goNext = () => setStartDate(new Date(new Date(startDate).setDate(new Date(startDate).getDate() + 7)));
  const goPrevMonth = () => setStartDate(new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() - 1)));
  const goNextMonth = () => setStartDate(new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)));
  const goToday = () => { const today = new Date(); setStartDate(today); setSelectedDate(today.toLocaleDateString('sv-SE')); navigate(`/admin/${shopId}/reservations`, { replace: true }); };

  const themeColor = shop?.theme_color || '#2563eb';
  const themeColorLight = `${themeColor}15`; 

  const isManagementEnabled = shop?.is_management_enabled === true;

  const miniBtnStyle = { border: 'none', background: 'none', cursor: 'pointer', color: themeColor };
  const floatNavBtnStyle = { border: 'none', background: 'none', width: '60px', height: '50px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' };
  const modalContentStyle = { background: '#fff', width: '95%', borderRadius: '25px', padding: '30px', maxHeight: '85vh', overflowY: 'auto' };
  const headerBtnStylePC = { padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' };
  const mobileArrowBtnStyle = { background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer' };
  const labelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', fontSize: '1rem', boxSizing: 'border-box' };

  const getFamilyName = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.split(/[\s\u3000]+/); 
    return parts[0];
  };

  // 🚀 🆕 ここに追加：現在地の赤い線の位置（高さ・列）を計算するロジック
  // 🚀 🆕 「今の時間枠」かどうかを判定する関数
  const applyCurrentTimeMarker = (dateStr, slotTime) => {
    const today = new Date();
    // 1. 今日かどうかチェック
    if (getJapanDateStr(today) !== dateStr) return false;

    // 2. このスロットの時間内（例：11:00 〜 11:30）に現在時刻があるか
    const [h, m] = slotTime.split(':').map(Number);
    const slotStartMin = h * 60 + m;
    const interval = shop?.slot_interval_min || 30;
    const slotEndMin = slotStartMin + interval;

    const nowMin = today.getHours() * 60 + today.getMinutes();

    return nowMin >= slotStartMin && nowMin < slotEndMin;
  };

return (
    // 🚀 🆕 2カラムを廃止し、全体を上から下の1カラム構造（flexDirection: 'column'）に大リフォーム！
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100dvh', background: '#fff', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      {/* 🆕 追記：通知メッセージを表示するボックス */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 10001, textAlign: 'center', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          {message}
        </div>
      )}

      {/* 🚀 🆕 メインコンテンツを包むコンテナ（ここからヘッダーとテーブルが縦に並びます） */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ padding: isPC ? '15px 25px' : '15px 10px', borderBottom: '0.5px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', flexShrink: 0 }}>
          {isPC ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', flexWrap: 'wrap' }}>
              
              {/* 🚀 🆕 【引っ越しその1】設定（歯車）ボタンを一番左端に配置！ */}
              <button 
                onClick={() => navigate(`/admin/${shopId}/dashboard`)}
                style={{ ...headerBtnStylePC, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="基本設定"
              >
                <Settings size={16} color="#64748b" />
              </button>

              {/* 🏢 店舗ロゴ ＆ タイトル */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '15px' }}>
                <div style={{ width: '32px', height: '32px', background: themeColor, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {(shop?.business_name || 'S')[0]}
                </div>
                <h1 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, color: '#1e293b', whiteSpace: 'nowrap' }}>
                  {shop?.business_name || 'SnipSnap Admin'}
                </h1>
              </div>

              {/* 📅 ナビゲーション 🚀 🆕 【引っ越しその2】「前週」➔「今日」➔「次週」の並び順に変更！ */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={goPrev} style={headerBtnStylePC}>前週</button>
                <button onClick={goToday} style={headerBtnStylePC}>今日</button>
                <button onClick={goNext} style={headerBtnStylePC}>次週</button>
              </div>

              {/* 左サイドバーから引っ越してきたPC用横並びナビゲーションメニュー一式 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginLeft: '10px' }}>
                <button style={{ ...switchBtnStyle(true), padding: '6px 14px' }}>カレンダー</button>
                <button 
                  onClick={() => navigate(`/admin/${shopId}/timeline?date=${selectedDate}`)} 
                  style={{ ...switchBtnStyle(false), padding: '6px 14px' }}
                >
                  タイムライン
                </button>
              </div>

              {/* ⚡ 本日のタスク（実行）ボタン */}
              <button 
                onClick={() => navigate(`/admin/${shopId}/today-tasks`)}
                style={{ ...headerBtnStylePC, background: '#1e293b', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', border: 'none' }}
              >
                <Clipboard size={16} />
                <span>タスク</span>
              </button>

              {/* 📊 顧客・売上管理ボタン */}
              <button 
                onClick={() => isManagementEnabled && navigate(`/admin/${shopId}/management`)} 
                disabled={!isManagementEnabled}
                style={{ 
                  ...headerBtnStylePC, 
                  background: isManagementEnabled ? '#f8fafc' : '#f1f5f9', 
                  color: isManagementEnabled ? '#1e293b' : '#94a3b8',
                  cursor: isManagementEnabled ? 'pointer' : 'not-allowed',
                  border: isManagementEnabled ? '1px solid #cbd5e1' : '1px solid #e2e8f0'
                }}
              >
                📊 売上管理
              </button>

              <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 5px' }} />

              {/* 🔍 顧客検索ポップアップボタン */}
              <button 
                onClick={() => {
                  fetchAllCustomersForSearch(); 
                  setShowMobileSearchModal(true); 
                }} 
                style={{ 
                  ...headerBtnStylePC, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: '#f8fafc',
                  color: themeColor
                }}
              >
                <Search size={18} />
              </button>

              {/* 📅 1か月カレンダー起動ボタン */}
              <button
                onClick={() => {
                  setViewMonth(new Date(startDate)); 
                  setShowMobileCalendar(true);       
                }}
                style={{
                  ...headerBtnStylePC,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: themeColorLight,
                  border: `1px solid ${themeColor}44`,
                  color: themeColor
                }}
              >
                <Calendar size={18} />
              </button>

              {/* 現在表示中の年月 */}
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 0 auto', fontWeight: '900', color: '#1e293b', whiteSpace: 'nowrap' }}>{startDate.getFullYear()}年 {startDate.getMonth() + 1}月</h2>
            </div>
          ) : (
  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '12px' }}>
    {/* 上段：カレンダーボタン ＆ 年月ナビ ＆ 検索ボタン */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '10px', position: 'relative' }}>
      {/* 📅 左：カレンダーボタン */}
      <button 
        onClick={() => setShowMobileCalendar(true)}
        style={{ 
          position: 'absolute', left: '0', background: themeColorLight, border: `1px solid ${themeColor}33`, 
          color: themeColor, padding: '8px', borderRadius: '10px'
        }}
      >
        <Calendar size={20} />
      </button>

      <button onClick={goPrev} style={mobileArrowBtnStyle}>◀</button>
      <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '900', color: '#1e293b' }}>{startDate.getFullYear()}年 {startDate.getMonth() + 1}月</h2>
      <button onClick={goNext} style={mobileArrowBtnStyle}>▶</button>

      {/* 🔍 🚀 🆕 右：検索ポップアップ起動ボタン */}
      <button 
        onClick={() => {
          fetchAllCustomersForSearch();
          setShowMobileSearchModal(true);
        }}
        style={{ 
          position: 'absolute', right: '0', background: themeColorLight, border: `1px solid ${themeColor}33`, 
          color: themeColor, padding: '8px', borderRadius: '10px'
        }}
      >
        <Search size={20} />
      </button>
    </div>
    
    {/* 💡 元々ここにあった検索バーは、不要であれば削除してOKです */}
  </div>
)}
          </div>

  {/* 🚀 🆕 修正：ヘッダーを占領しないスッキリ1行の「まとめバナー」に変更！ */}
  {(() => {
    const hasUrgent = urgentKeeps.length > 0;
    const hasTimeChange = timeChangedKeeps.filter(k => !dismissedKeeps.includes(k.id)).length > 0;
    if (!hasUrgent && !hasTimeChange) return null;

    return (
      <div style={{ zIndex: 100, padding: '8px 20px', background: hasUrgent ? '#fef2f2' : '#fff7ed', borderBottom: hasUrgent ? '1px solid #fecdd3' : '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.1rem' }}>{hasUrgent ? '🚨' : '⚠️'}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '900', color: hasUrgent ? '#be123c' : '#c2410c' }}>
            {hasUrgent 
              ? '未確定のキープ枠があります' 
              : '定期訪問の時間変更通知が届いています'}
          </span>
        </div>
        <button
          onClick={() => setAlertModalMode('urgent')} // 🚀 🆕 3日以内の緊急枠だけをポップアップする命令
          style={{ background: hasUrgent ? '#be123c' : '#f97316', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
        >
          確認 
        </button>
      </div>
    );
  })()}

  {/* 🚀 ❷ 【新設】3日前より前の「新着単発キープ専用」アラートバナー（青色） */}
  {(() => {
    const activeIrregulars = irregularKeeps.filter(k => !dismissedKeeps.includes(k.id));
    if (activeIrregulars.length === 0) return null;

    return (
      <div style={{ zIndex: 100, padding: '8px 20px', background: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0369a1' }}>
            施設から新しい「単発キープ」が届いています（確認・枠タップで非表示になります）
          </span>
        </div>
        <button
          onClick={() => setAlertModalMode('single')} // 🚀 🆕 3日前より前の単発相談枠だけをポップアップする命令
          style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
        >
          確認 
        </button>
      </div>
    );
  })()}

{/* ✅ 親要素：はみ出しを隠し、高さを固定 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
        key={startDate.toISOString()}
        ref={scrollContainerRef}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.2, opacity: { duration: 0.1 } }}
        drag="x"
        dragDirectionLock={true}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0}
        onDragEnd={(e, { offset }) => {
          const swipeThreshold = 50;
          if (offset.x > swipeThreshold) goPrev();
          else if (offset.x < -swipeThreshold) goNext();
        }}
        // 🚀 styleの中に paddingBottom を追加しました
        style={{ 
          flex: 1, 
          width: '100%', 
          overflowY: 'auto', 
          overflowX: isPC ? 'auto' : 'hidden', 
          cursor: 'grab', 
          touchAction: 'pan-y',
          paddingBottom: isPC ? '20px' : '100px' // 👈 スマホ時に120pxの余白を作り、ボトムナビを避けます
        }}
        whileTap={{ cursor: 'grabbing' }}
      >

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: isPC ? '900px' : '100%' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
          <tr>
            <th style={{ width: isPC ? '80px' : '55px', borderBottom: '1px solid #cbd5e1' }}></th>
            {weekDays.map(date => {
              const isToday = getJapanDateStr(new Date()) === getJapanDateStr(date);
              return (
                <th key={date.toString()} style={{ padding: '4px 0', borderBottom: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: isPC ? '120%' : '80%', color: isToday ? themeColor : '#666' }}>{['日','月','火','水','木','金','土'][date.getDay()]}</div>
                  <div style={{ fontSize: isPC ? '150%' : '100%', fontWeight: 'bold', color: isToday ? '#fff' : '#333', background: isToday ? themeColor : 'none', width: isPC ? '40px' : '22px', height: isPC ? '40px' : '22px', borderRadius: '50%', margin: '2px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{date.getDate()}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(time => (
            <tr key={time} id={`time-row-${time}`} style={{ height: '60px' }}>
              {/* 左端の時間軸 */}
              <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', textAlign: 'center', background: '#f8fafc' }}>
                <span style={{ fontSize: isPC ? '140%' : '100%', color: '#64748b', fontWeight: 'bold' }}>{time}</span>
              </td>

              {weekDays.map(date => {
                const dStr = getJapanDateStr(date);
                const resAt = getStatusAt(dStr, time);
                const isArray = Array.isArray(resAt);
                const hasRes = resAt !== null;
                const firstRes = isArray ? resAt[0] : resAt;
                const reservationCount = isArray ? resAt.length : 0;

                const isNew = isArray && resAt.some(r => {
                  if (!r.created_at) return false;
                  return (new Date().getTime() - new Date(r.created_at).getTime()) < 10000;
                });

                const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
                const hours = shop?.business_hours?.[dayName];
                const isStandardTime = hours && !hours.is_closed && time >= hours.open && time < hours.close;

                // この枠でちょうど開始するか
                const startingHere = isArray ? resAt.filter(r => 
  new Date(r.start_time).toLocaleTimeString('ja-JP', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false, 
    timeZone: 'Asia/Tokyo' // 👈 ここに追加！
  }) === time
) : [];
                const isStart = startingHere.length > 0;

                const colors = getCustomerColor(firstRes?.customer_name, firstRes?.res_type);
                const isOtherShop = isArray && resAt.some(r => r.shop_id !== shopId);
                const isBlocked = (isArray && resAt.some(r => r.res_type === 'blocked')) || (firstRes?.res_type === 'blocked');
                const isRegularHoliday = !isArray && firstRes?.isRegularHoliday;
                const isSystemBlocked = !isArray && firstRes?.res_type === 'system_blocked';

                return (
                  <td 
                    key={`${dStr}-${time}`} 
                    onClick={async () => { 
                      setSelectedDate(dStr); 
                      setTargetTime(time);
                      
                      // 🚀 🆕 オブジェクト形式でデータが返ってきた時も、安全に [ ] 配列化してエラーを完全ブロックします
                      const normalizedItems = Array.isArray(resAt) ? resAt : (resAt ? [resAt] : []);
                      const firstItem = normalizedItems.length > 0 ? normalizedItems[0] : null;
                      
                      // 💡 判定用：定休日、システムブロック、または施設日のステルスブロックか
                      const isBgBlock = firstItem?.isRegularHoliday || 
                                        firstItem?.res_type === 'system_blocked' || 
                                        firstItem?.res_type === 'facility_day_stealth';

                      // --- 1. データが完全に空、または「背景色が付いているだけの枠」の場合 ---
                      if (!hasRes || isBgBlock) {
                        // 🚀 ここで「時間外か定休日か」を判定して記録
                        setIsTargetOutsideHours(!isStandardTime || firstItem?.isRegularHoliday);
                        // 🚀 どんな背景（定休日・施設日・時間外）でも、まずは2択/4択メニューを開く！
                        setShowMenuModal(true);
                        return;
                      }

                      // --- 2. 実際の予約・確定済みデータ（実体）がある場合 ---
                      const items = Array.isArray(resAt) ? resAt : [resAt];

                      if (items.length > 1) {
                        setSelectedSlotReservations(items);
                        setShowSlotListModal(true);
                        return;
                      }

                      const activeTask = items[0];

// 🚀 'facility_keep' (定期枠) を判定条件に追加しました
if (activeTask.res_type === 'facility_visit') {
  const targetIdForCount = activeTask.visitData?.parent_id || activeTask.visitId;
  const { count } = await supabase
    .from('visit_request_residents')
    .select('id', { count: 'exact', head: true })
    .eq('visit_request_id', targetIdForCount)
    .eq('status', 'completed');

  if (count > 0 || activeTask.visitData?.status === 'completed') {
    openVisitDetail(activeTask.visitId, activeTask.customer_name, activeTask.visitData);
  } else {
    handleDeleteVisit(activeTask.visitId, dStr, activeTask.customer_name);
  }
} 
// 🚀 修正ポイント：定期(regular)か単発(single)かでポップアップを出し分ける
else if (
                      activeTask.res_type === 'facility_keep' || 
                      activeTask.res_type === 'facility_keep_regular' || 
                      activeTask.res_type === 'facility_keep_single'
                    ) {
                      // 🚀 🆕 3日前より前の単発キープの場合、カレンダー上で枠をタップした瞬間に青バナーから即座に消去！
                      if (activeTask.res_type === 'facility_keep_single' && activeTask.id) {
                        markKeepAsDismissed(activeTask.id);
                      }

                      if (activeTask.res_type === 'facility_keep_single') {
                        // ⚠️ 3日前より前の単発：警告（検討中）用ポップアップを開く
                        setSelectedSlotReservations([activeTask]); 
                        setShowSlotListModal(true);
                      } else {
                        // 📅 定期キープ（または3日前を過ぎて赤アラートになった定期・単発キープ）：通常のキャンセル画面へ
                        handleCancelKeep(
                          activeTask.facility_user_id, 
                          dStr, 
                          activeTask.customer_name.replace(' 予定', '')
                        );
                      }
                    }
                      else if (activeTask.res_type === 'normal' || activeTask.res_type === 'blocked' || activeTask.res_type === 'private_task') {
                        openDetail(activeTask); 
                      }
                    }}
                    /* 🚀 🆕 【ここまで修正箇所】 */
                    style={{ 
                      borderRight: '1px solid #e2e8f0', 
                      borderBottom: '1px solid #e2e8f0', 
                      position: 'relative', 
                      cursor: 'pointer', 
                      background: isStandardTime ? '#fff' : '#fffff3',
                      
                      ...(applyCurrentTimeMarker(dStr, time) && {
                        borderLeft: '3px solid #14a9d7',
                        zIndex: 10 
                      })
                    }}
                  >
                    {hasRes && !isSystemBlocked && (
                      <div style={{ 
                        position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: (firstRes?.res_type === 'facility_day_stealth') ? 'transparent' : 
                                    (isRegularHoliday || isBlocked) ? '#f1f5f9' : 
                                    (isOtherShop ? '#f8fafc' : (isStart ? colors.bg : '#fff')),
                        borderLeft: (firstRes?.res_type === 'facility_day_stealth' || isRegularHoliday || isBlocked) ? 'none' : 
                                    `2px solid ${isOtherShop ? '#cbd5e1' : colors.line}`,
                        animation: (isNew && isStart) ? 'flashGold 2s ease-out' : 'none'
                      }}>
                        {firstRes?.res_type !== 'facility_day_stealth' && (
                          <>
                            {(isRegularHoliday || isBlocked) ? (
                              isStart && <span style={{fontSize:'0.65rem', fontWeight:'bold', color:'#94a3b8'}}>{firstRes.customer_name}</span>
                            ) : (
                              isStart ? (
                                <div style={{ fontWeight: 'bold', fontSize: isPC ? '0.85rem' : '0.7rem', color: isOtherShop ? '#94a3b8' : colors.text, textAlign: 'center', whiteSpace: 'nowrap', padding: '0 4px' }}>
                                  {(() => {
  if (startingHere.length === 1) {
    const res = startingHere[0];
    
    // 🚀 1. 【苗字切り出し ＆ 様付け制御ロジック】
    const rawName = res.res_type === 'private_task' ? res.customer_name : (res.customer_name || '名前無');
    
    let processedName = '';
    const trimmedName = rawName.trim();
    const spaceIndex = trimmedName.search(/[\s ]/);
    
    if (res.res_type === 'private_task') {
      // 🌟 プライベート予定は様を付けない
      processedName = trimmedName.replace(/[\s ]+/g, '').slice(0, 3);
    } else {
      // 施設や個人予約はスペースで苗字切り出し
      const baseName = spaceIndex !== -1 ? trimmedName.substring(0, spaceIndex) : trimmedName.replace(/様$/g, '');
      
      if (isPC) {
        processedName = baseName + ' 様'; // PC版は様付け
      } else {
        processedName = baseName.slice(0, 3); // スマホ版は様なし
      }
    }

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: '100%', 
        height: '100%',
        boxSizing: 'border-box',
        padding: '1px 2px',
        overflow: 'hidden'
      }}>
        
        {/* アイコン・バッジ類 */}
        {res.res_type === 'facility_visit' && (
          <div style={{ color: '#4f46e5', marginBottom: '1px', flexShrink: 0 }}>
          </div>
        )}
        
        {categoryMap[res.biz_type] && (
          <div style={{ 
            fontSize: '9px', padding: '1px 3px', borderRadius: '4px', marginBottom: '1px',
            background: res.biz_type === 'foot' ? '#4285f4' : '#d34817', color: '#fff', fontWeight: 'bold', 
            transform: 'scale(0.8)', whiteSpace: 'nowrap', flexShrink: 0
          }}>
            {categoryMap[res.biz_type].slice(0, 3)}
          </div>
        )}

        {/* 🚀 【細身・枠いっぱい自動フィット】 */}
        <div style={{
          fontSize: isPC ? '150%' : '140%', 
          fontWeight: '400', 
          color: colors.text,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'clip',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          writingMode: isPC ? 'horizontal-tb' : 'vertical-rl',
          textOrientation: 'upright',
          letterSpacing: isPC ? '0.02em' : '-0.02em',
          lineHeight: 1,
          flexShrink: 0,
          WebkitTextSizeAdjust: 'none',
          textSizeAdjust: 'none'
        }}>
          {processedName}
          
          {isPC && (
            <span style={{ fontSize: '85%', marginLeft: '2px', fontWeight: 'normal' }}>
              {res.customers?.is_blocked && '🚫'}
              {res.customers?.cancel_count >= 3 && '‼️'}
            </span>
          )}
        </div>
      </div>
    );
  }
  return <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#64748b' }}>👥 {reservationCount}名</div>;
})()}
                                </div>
                              ) : null
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  </AnimatePresence>
</div>
        
        {!isPC && (
        <div style={{ 
          position: 'fixed', bottom: 0, left: 0, right: 0, height: '75px', 
          background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', 
          justifyContent: 'space-around', alignItems: 'center', zIndex: 2000, 
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 15px rgba(0,0,0,0.05)' 
        }}>
          {/* 🆕 1. 設定：移動前にお掃除を実行 */}
          <button 
            onClick={() => { closeAllPopups(); navigate(`/admin/${shopId}/dashboard`); }} 
            style={mobileTabStyle(false, '#64748b')}
          >
            <Settings size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>設定</span>
          </button>

          {/* 2. タスク：移動前にお掃除を実行 */}
          <button 
            onClick={() => { closeAllPopups(); navigate(`/admin/${shopId}/today-tasks`); }} 
            style={mobileTabStyle(false, '#1e293b')}
          >
            <Clipboard size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>タスク</span>
          </button>

          {/* 3. 今日：関数 goToday の前にお掃除を実行 */}
          <button 
            onClick={() => { closeAllPopups(); goToday(); }} 
            style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              background: themeColorLight, border: `1px solid ${themeColor}33`, 
              color: themeColor, borderRadius: '15px', padding: '8px 15px', cursor: 'pointer' 
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>今日</span>
          </button>

          {/* 4. 管理：移動前にお掃除を実行 */}
          <button 
            onClick={() => { closeAllPopups(); navigate(`/admin/${shopId}/management`); }} 
            style={mobileTabStyle(false, '#008000')}
          >
            <BarChart3 size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>管理</span>
          </button>
        </div>
      )}
      </div>

{/* 🆕 3択の名寄せ（マージ）確認モーダル */}
{showMergeConfirm && (
  <div 
    onClick={() => setShowMergeConfirm(false)} 
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 5000, 
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' 
    }}
  >
    <div 
      onClick={(e) => e.stopPropagation()} 
      style={{ 
        background: '#fff', width: '90%', maxWidth: '400px', borderRadius: '30px', 
        padding: '35px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' 
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '15px' }}>👤</div>
      <h3 style={{ fontSize: '1.2rem', fontWeight: '900', marginBottom: '10px', color: '#1e293b' }}>
        同一人物の可能性があります
      </h3>
      <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6', marginBottom: '30px' }}>
        連絡先が一致するお客様が既に登録されています。<br/>
        <strong>「{mergeCandidate?.name}」</strong> 様として管理しますか？
      </p>

<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* 選択肢A：店主が把握している名前（大造さん）を守る */}
        <button 
          onClick={() => handleMergeAction(mergeCandidate.id, mergeCandidate.name)}
          style={{ 
            padding: '18px', background: themeColor, color: '#fff', border: 'none', 
            borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' 
          }}
        >
          👤 既存の「{mergeCandidate?.name}」様に統合
        </button>

        {/* 選択肢B：お客様が新しく名乗った名前（ハム太郎）を正式採用してあげる */}
        <button 
          onClick={() => handleMergeAction(mergeCandidate.id, selectedRes.customer_name)}
          style={{ 
            padding: '16px', background: '#fff', color: themeColor, 
            border: `2px solid ${themeColor}`, borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer' 
          }}
        >
          🐹 今回の「{selectedRes?.customer_name}」様へ名前を更新
        </button>

        {/* 選択肢C：同姓同名の別人として新規登録 */}
        <button 
          onClick={() => {
            setShowMergeConfirm(false);
            finalizeOpenDetail(selectedRes, null); 
          }}
          style={{ padding: '12px', background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          🙅 同姓同名の別人として別名簿で管理
        </button>
      </div>
          </div>
  </div>
)}

{/* 🚀 🆕 新設：未確定アラート詳細ポップアップモーダル */}
{alertModalMode === 'urgent' && (
  <div style={overlayStyle} onClick={() => setAlertModalMode(null)}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '550px', padding: '0', overflow: 'hidden', borderRadius: '28px' }}>
      <div style={{ background: urgentKeeps.length > 0 ? '#be123c' : '#f97316', color: '#fff', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: '900' }}>🚨 確定期限間近・変更通知の内訳</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '2px' }}>訪問予定日の3日前を過ぎた未確定枠です（至急処理が必要です）</div>
        </div>
        <button onClick={() => setAlertModalMode(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }}>✕</button>
      </div>

      <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* 🚨 確定期限間近（定期・単発問わず3日以内になったもの） */}
        {urgentKeeps.map((keep) => (
          <div key={`modal-urg-${keep.id}`} style={{ background: '#fff', border: '1px solid #fecdd3', padding: '12px 15px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#be123c' }}>
                🚨 名簿未確定({keep.isRegular ? '定期' : '単発'})：{keep.facility_users?.facility_name} 様
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                予定日：<strong>{keep.date.replace(/-/g, '/')}</strong> （あと <span style={{color:'#ef4444', fontWeight:'bold'}}>{keep.diffDays}</span> 日）
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => { setAlertModalMode(null); handleEmailNudge(keep); }} style={{ background: '#fff', color: '#be123c', border: '1px solid #be123c', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>📧 つつく</button>
              <button onClick={() => { setAlertModalMode(null); handleForceDeleteKeep(keep); }} style={{ background: '#be123c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>🗑 強制解放</button>
            </div>
          </div>
        ))}

        {/* ℹ️ 定期訪問の時間変更通知 */}
        {timeChangedKeeps
          .filter(k => !dismissedKeeps.includes(k.id))
          .map((keep) => (
            <div key={`modal-change-${keep.id}`} style={{ background: '#fff', border: '1px solid #bae6fd', padding: '12px 15px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0369a1' }}>
                  ℹ️ 定期訪問の時間変更：{keep.facility_users?.facility_name} 様
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                  {keep.date.replace(/-/g, '/')} （本来 {keep.originalTime} ➔ <span style={{color:'#0ea5e9', fontWeight:'bold'}}>変更後 {keep.start_time.substring(0, 5)}</span>）
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => { setAlertModalMode(null); setStartDate(new Date(keep.date)); setSelectedDate(keep.date); }} style={{ background: '#0ea5e9', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>枠を確認</button>
                <button onClick={() => { markKeepAsDismissed(keep.id); }} style={{ background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>既読にする</button>
              </div>
            </div>
          ))}
      </div>
      <div style={{ padding: '15px 20px', background: '#fff', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <button onClick={() => setAlertModalMode(null)} style={{ width: '100%', padding: '12px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>一覧を閉じる</button>
      </div>
    </div>
  </div>
)}

{/* 🚀 【青専用ポップアップ】3日前より前の新着単発キープ（了解ボタンで消去できる） */}
{alertModalMode === 'single' && (
  <div style={overlayStyle} onClick={() => setAlertModalMode(null)}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '550px', padding: '0', overflow: 'hidden', borderRadius: '28px' }}>
      <div style={{ background: '#0284c7', color: '#fff', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: '900' }}>🔷 新着単発キープ（相談枠）の一覧</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '2px' }}>施設側から臨時に日程確保された、3日前より前の相談枠です</div>
        </div>
        <button onClick={() => setAlertModalMode(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }}>✕</button>
      </div>

      <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {irregularKeeps
          .filter(k => !dismissedKeeps.includes(k.id))
          .map((keep) => (
            <div key={`modal-irreg-${keep.id}`} style={{ background: '#fff', border: '1px solid #bae6fd', padding: '12px 15px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0369a1' }}>
                  🔷 新着単発キープ：{keep.facility_users?.facility_name} 様
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                  希望日：<strong>{keep.date.replace(/-/g, '/')}</strong> （3日前より前の相談枠）
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {/* 🛠 修正：↓ここの onClick の矢印関数を正しく修正しました */}
                <button onClick={() => { setAlertModalMode(null); setStartDate(new Date(keep.date)); setSelectedDate(keep.date); }} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>枠を確認</button>
                <button onClick={() => { markKeepAsDismissed(keep.id); }} style={{ background: '#fff', color: '#0284c7', border: '1px solid #bae6fd', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>了解(非表示)</button>
              </div>
            </div>
          ))}
      </div>
      <div style={{ padding: '15px 20px', background: '#fff', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <button onClick={() => setAlertModalMode(null)} style={{ width: '100%', padding: '12px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>一覧を閉じる</button>
      </div>
    </div>
  </div>
)}

{(showCustomerModal || showDetailModal) && (
        <div onClick={() => { if(selectedRes?.isRegularHoliday) return; setShowCustomerModal(false); setShowDetailModal(false); }} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '950px', position: 'relative' }}>
            
            {/* 🆕 最上部：ねじ込み予約ボタン (通常予約がある場合のみ表示) */}
            {selectedRes?.res_type === 'normal' && (
              <button 
  onClick={() => navigate(`/shop/${shopId}/reserve`, { 
    state: { 
      adminDate: selectedDate, 
      adminTime: targetTime, 
      fromView: 'calendar', // ✅ カレンダーから来た目印
      isAdminMode: true,
      adminStaffId: staffs.length === 1 ? staffs[0].id : null
    } 
  })} 
                style={{ 
                  width: '100%', 
                  padding: '16px', 
                  background: themeColor, 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '15px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  marginBottom: '20px',
                  fontSize: '1rem',
                  boxShadow: `0 4px 12px ${themeColor}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                ➕ この時間にさらに予約を入れる（ねじ込み）
              </button>
            )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                {showCustomerModal ? '👤 顧客マスター編集' : (selectedRes?.res_type === 'blocked' ? (selectedRes.isRegularHoliday ? '📅 定休日' : '🚫 ブロック設定') : '📅 予約詳細・名簿更新')}
              </h2>
              <button onClick={() => { setShowCustomerModal(false); setShowDetailModal(false); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '5px' }}>×</button>
            </div>

            {/* ✅ 🆕 修正：ブロック枠 または プライベート予定 の場合はシンプルUIを表示 */}
            {(selectedRes?.res_type === 'blocked' || selectedRes?.res_type === 'private_task') ? (
              
              /* ==========================================
                 🚫 A：シンプルUI（ブロック・プライベート予定専用）
                 ========================================== */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                <div style={{ background: '#f8fafc', padding: '30px', borderRadius: '25px', border: `2px solid ${themeColor}22`, textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>
                    {selectedRes.res_type === 'private_task' ? '☕️' : '🚫'}
                  </div>
                  
                  <label style={labelStyle}>予定名・ブロック理由</label>
                  <input 
                    type="text" 
                    value={editFields.name} 
                    onChange={(e) => setEditFields({...editFields, name: e.target.value})} 
                    style={{ ...inputStyle, fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', borderRadius: '15px' }} 
                  />

                  {/* 🆕 プライベート予定の場合のみ「メモ」を表示 */}
                  {selectedRes.res_type === 'private_task' && (
                    <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                      <label style={labelStyle}>メモ・詳細</label>
                      <textarea 
                        value={editFields.memo} 
                        onChange={(e) => setEditFields({...editFields, memo: e.target.value})} 
                        style={{ ...inputStyle, height: '80px', fontSize: '0.9rem' }}
                      />
                    </div>
                  )}
                  
                  <button onClick={handleUpdateCustomer} style={{ width: '100%', padding: '18px', background: themeColor, color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', fontSize: '1.1rem', boxShadow: `0 8px 20px ${themeColor}44` }}>
                    情報を保存
                  </button>

                  <button onClick={() => deleteRes(selectedRes.id)} style={{ width: '100%', padding: '15px', background: '#fff', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {selectedRes.res_type === 'private_task' ? '🗑 予定を削除する' : '🔓 ブロック解除（予約可能に戻す）'}
                  </button>
                </div>
              </div>

            ) : (

              /* ==========================================
                 👤 パターンB：通常予約（リッチな顧客カルテ ＆ 履歴・スマホ爆広リフォーム版）
                 ========================================== */
              <div style={{ 
  display: 'flex', 
  flexDirection: isPC ? 'row' : 'column', 
  gap: '25px',
  alignItems: 'stretch',
  width: '100%',     /* 追記 */
  minWidth: 0        /* 🚀 これが横スクロールを防ぐ重要設定です */
}}>
                
                {/* 📝 左側：入力フォーム一式 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', minWidth: isPC ? '300px' : '100%' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    
                    {/* 📋 予約メニュー内訳 */}
                    <div style={{ background: themeColorLight, padding: '16px', borderRadius: '15px', marginBottom: '15px', border: `1px solid ${themeColor}` }}>
                      {categoryMap[selectedRes?.category] && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
                          🏢 受付事業：{categoryMap[selectedRes?.category]}
                        </div>
                      )}
                      
                      <label style={{ fontSize: '0.75rem', fontWeight: '900', color: themeColor, display: 'block', marginBottom: '10px' }}>📋 予約・会計内訳</label>
                      <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{selectedRes?.menu_name || 'メニュー未設定'}</div>
                      
                      {(() => {
                        const details = parseReservationDetails(selectedRes);
                        return details.products?.length > 0 && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(0,0,0,0.1)', fontSize: '0.85rem', color: '#008000', fontWeight: 'bold' }}>
                            🛍 購入商品: {details.products.map(p => `${p.name} (x${p.quantity})`).join(', ')}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 担当スタッフの変更 */}
                    {staffs.length > 1 && !editFields.is_facility && (
                      <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>担当スタッフの変更</label>
                        <select 
                          value={selectedRes?.staff_id || ''} 
                          onChange={(e) => setSelectedRes({ ...selectedRes, staff_id: e.target.value || null })} 
                          style={inputStyle}
                        >
                          <option value="">フリー（担当なし）</option>
                          {staffs.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 動的フォーム */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        const fieldOrder = [
                          'name', 'furigana', 'email', 'phone', 
                          'zip_code', 'address', 'parking', 
                          'building_type', 'care_notes', 'company_name', 
                          'symptoms', 'request_details'
                        ];

                        return fieldOrder.map((key) => {
                          if (!shouldShowInAdmin(key)) return null;

                          return (
                            <div key={key}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <label style={{ ...labelStyle, marginBottom: 0 }}>{getFieldLabel(key)}</label>

                                {key === 'phone' && editFields.phone && (
                                  <a 
                                    href={`tel:${editFields.phone}`}
                                    style={{ textDecoration: 'none', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}
                                  >
                                    <span>電話をかける</span> 📞
                                  </a>
                                )}

                                {key === 'name' && editFields.line_user_id && (
                                  <span style={badgeStyle('#06C755')}>LINE連携済み ✅</span>
                                )}

                                {key === 'address' && editFields.address && (
                                  <a 
                                    href={`http://maps.google.com/?q=${encodeURIComponent(editFields.address)}`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ textDecoration: 'none', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(59,130,246,0.2)' }}
                                  >
                                    <span>マップで開く</span> 📍
                                  </a>
                                )}
                              </div>

                              {key === 'parking' ? (
                                <select 
                                  disabled={editFields.is_facility} 
                                  value={editFields[key] || ''} 
                                  onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} 
                                  style={{ ...inputStyle, background: editFields.is_facility ? '#f1f5f9' : '#fff', cursor: editFields.is_facility ? 'not-allowed' : 'pointer' }}
                                >
                                  <option value="">未選択</option>
                                  <option value="あり">あり</option>
                                  <option value="なし">なし</option>
                                </select>
                              ) : (
                                <input 
                                  type="text" 
                                  readOnly={editFields.is_facility} 
                                  value={editFields[key] || ''} 
                                  onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} 
                                  style={{ ...inputStyle, background: editFields.is_facility ? '#f1f5f9' : '#fff', cursor: editFields.is_facility ? 'not-allowed' : 'text' }} 
                                  placeholder="未登録"
                                />
                              )}
                            </div>
                          );
                        });
                      })()}

                      {shop?.form_config?.custom_questions?.map((q) => {
                        const answer = editFields.custom_answers?.[q.id];
                        if (q.required || answer) {
                          return (
                            <div key={q.id} style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: q.required ? `2px solid ${themeColor}33` : '1px solid #e2e8f0', marginTop: '5px' }}>
                              <label style={{ ...labelStyle, color: q.required ? themeColor : '#64748b', marginBottom: '8px' }}>
                                🙋 {q.label} {q.required && <span style={{ color: '#ef4444' }}>(必須)</span>}
                              </label>
                              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {answer || <span style={{ color: '#cbd5e1', fontWeight: 'normal' }}>未回答</span>}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}

                      <div>
                        <label style={labelStyle}>顧客メモ（マスタ共通・内部用）</label>
                        <textarea 
                          value={editFields.memo} 
                          onChange={(e) => setEditFields({...editFields, memo: e.target.value})} 
                          style={{ ...inputStyle, height: '100px' }} 
                          placeholder="お客様には見えない管理者用メモです" 
                        />
                      </div>
                    </div>
                    
                    <button onClick={handleUpdateCustomer} style={{ width: '100%', padding: '14px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' }}>情報を保存</button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <button 
                        onClick={() => selectedRes?.status !== 'canceled' && cancelRes(selectedRes.id)} 
                        disabled={selectedRes?.status === 'canceled'}
                        style={{ padding: '12px', background: selectedRes?.status === 'canceled' ? '#f1f5f9' : '#fff', color: selectedRes?.status === 'canceled' ? '#94a3b8' : '#8d5c08', border: `1px solid ${selectedRes?.status === 'canceled' ? '#e2e8f0' : '#8d5c08'}`, borderRadius: '10px', fontWeight: 'bold', cursor: selectedRes?.status === 'canceled' ? 'default' : 'pointer', fontSize: '0.8rem' }}
                      >
                        {selectedRes?.status === 'canceled' ? 'キャンセル済み' : '当日キャンセル'}
                      </button>
                      <button onClick={() => deleteRes(selectedRes.id)} style={{ padding: '12px', background: '#e0dddd8d', color: '#780606', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>消去 & 掃除</button>
                    </div>
                  </div>
                </div>

                {/* 🕒 右側：来店履歴エリア */}
                <div style={{ flex: 1, minWidth: isPC ? '300px' : '100%' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b' }}>🕒 来店履歴 ＆ 予定</h4>
                  
                  <div style={{ 
                  flex: 1, // ← 親の余白を全部埋めるように変更
                  overflowY: 'auto', // リストが長い時だけここでスクロール
                  border: '1px solid #f1f5f9', 
                  borderRadius: '15px', 
                  background: '#f8fafc', 
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                    {(() => {
                      // 🚀 1. 年ごとにグループ化するロジック
                      const groups = customerHistory.reduce((acc, h) => {
                        const date = new Date(h.start_time);
                        const year = date.getFullYear();
                        if (!acc[year]) acc[year] = [];
                        acc[year].push(h);
                        return acc;
                      }, {});

                      // 🚀 2. 年を新しい順にソートして表示
                      const sortedYears = Object.keys(groups).sort((a, b) => b - a);

                      return sortedYears.map((year) => (
                        <div key={year} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', overflow: 'hidden' }}>
                          {/* 年アコーディオン・ヘッダー */}
                          <div 
                            onClick={() => setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }))}
                            style={{ 
                              padding: '12px 15px', background: '#f8fafc', cursor: 'pointer', 
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              borderBottom: expandedYears[year] ? '1px solid #e2e8f0' : 'none'
                            }}
                          >
                            <span style={{ fontWeight: '900', color: themeColor }}>{year}年</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                              {expandedYears[year] ? '▼' : '▶'} {groups[year].length}件
                            </span>
                          </div>

                          {/* 展開時の中身 */}
                          {expandedYears[year] && (
                            <div style={{ padding: '5px' }}>
                              {groups[year].sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).map((h) => {
  const hDate = new Date(h.start_time);
  const isCanceled = h.status === 'canceled';
  
  // 🚀 ここがポイント！詳細情報を解析してデータを取り出します
  const d = parseReservationDetails(h); 

  return (
    <div 
      key={h.id} 
      onClick={() => !isCanceled && openHistoryDetail(h)}
      style={{ 
        padding: '12px', 
        borderBottom: '1px solid #f1f5f9', 
        background: isCanceled ? '#fcfcfc' : '#fff', 
        opacity: isCanceled ? 0.6 : 1, 
        cursor: isCanceled ? 'default' : 'pointer'
      }}
    >
      {/* 1行目：日付と金額 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: isCanceled ? '#94a3b8' : '#1e293b' }}>
          {hDate.toLocaleDateString('ja-JP')}
        </span>
        <span style={{ color: isCanceled ? '#cbd5e1' : '#e11d48', fontWeight: 'bold', fontSize: '0.85rem' }}>
          ¥{d.totalPrice.toLocaleString()}
        </span>
      </div>

      {/* 2行目：メニュー名 */}
      <div style={{ fontSize: '0.85rem', color: '#1e293b', marginBottom: '6px' }}>{d.menuName}</div>

      {/* 3行目：商品・調整詳細エリア（ここが復活します） */}
      <div style={{ fontSize: '0.75rem', color: '#086e3a' }}>
        {d.products.length > 0 && (
          <div style={{ marginBottom: '2px' }}>
            🛍 {d.products.map(p => `${p.name}(x${p.quantity})`).join(', ')}
          </div>
        )}
        {d.adjustments.length > 0 && (
          <div style={{ color: '#de1515' }}>
            ⚙️ {d.adjustments.map(a => a.name).join(', ')}
          </div>
        )}
        {/* スタッフ表示（staffsが存在する場合） */}
        {h.staffs && (
           <div style={{ marginTop: '2px', fontWeight: 'bold' }}>👤 {h.staffs.name}</div>
        )}
      </div>
    </div>
  );
})}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

            )}              
            {!isPC && (
              <button onClick={() => { setShowCustomerModal(false); setShowDetailModal(false); }} style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>閉じる ✕</button>
            )}
          </div>
        </div>
      )}

{/* 👥 2. 予約者選択リストModal (複数予約がある場合に表示 / 単発キープ確認用) */}
      {showSlotListModal && (
        <div onClick={() => setShowSlotListModal(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ 
  ...modalContentStyle, 
  maxWidth: '950px', 
  width: '90vw',
  maxHeight: '90vh', // 少し広げる
  position: 'relative' 
}}>
            
            {/* 🚀 🆕 単発キープの場合は専用の警告ヘッダーを表示 */}
            {selectedSlotReservations.length === 1 && selectedSlotReservations[0].res_type === 'facility_keep_single' ? (
              <div style={{ marginBottom: '20px', background: '#fff7ed', padding: '15px', borderRadius: '15px', border: '2px solid #fed7aa' }}>
                <div style={{ fontSize: '2rem', marginBottom: '5px' }}>⚠️</div>
                <h3 style={{ margin: '0 0 5px 0', color: '#c2410c', fontSize: '1.1rem', fontWeight: '900' }}>イレギュラーなキープ枠</h3>
                <p style={{ fontWeight: 'bold', color: '#f97316', fontSize: '1.4rem', margin: 0 }}>{selectedDate.replace(/-/g, '/')} {targetTime}〜</p>
                <p style={{ fontSize: '0.85rem', color: '#9a3412', marginTop: '8px', lineHeight: '1.5' }}>
                  施設側がこの日時をキープ（検討中）しています。<br/>
                  下のリストから詳細を確認し、確定させてください。
                </p>
              </div>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
                <p style={{ fontWeight: '900', color: themeColor, fontSize: '1.8rem', margin: 0 }}>{targetTime} の予約</p>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>詳細を見たい方を選択してください</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto', padding: '5px' }}>
              
              {/* 🚀 🆕 修正：「新しい予約をねじ込む」ボタンを削除しました */}

              {selectedSlotReservations.map((res, idx) => (
                <div key={res.id || idx} 
                  onClick={async () => { 
                    setShowSlotListModal(false); 
                    // 🚀 🆕 もし単発キープなら、ここで既読にする（念のためここでも実行）
                    if (res.res_type === 'facility_keep_single') markKeepAsDismissed(res.id);

                    // 🚀 🆕 施設キープの場合は、最新の施設プロフィールを取得して詳細を開く
                    if (res.isKeep) {
                      const { data: fac } = await supabase.from('facility_users').select('*').eq('id', res.facility_user_id).single();
                      if (fac) {
                        // 施設側の最新住所・電話・ふりがなをセットして詳細画面へ
                        finalizeOpenDetail(res, { ...fac, name: fac.facility_name, is_facility: true });
                      } else {
                        openDetail(res);
                      }
                    } else {
                      openDetail(res); 
                    }
                  }} 
                  style={{ 
                    background: '#fff', 
                    padding: '18px', 
                    borderRadius: '18px', 
                    border: `2px solid ${res.res_type === 'facility_keep_single' ? '#f97316' : '#e2e8f0'}`, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    cursor: 'pointer' 
                  }}
                >
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1e293b', marginBottom: '4px' }}>
                      {(res.res_type === 'blocked' || res.res_type === 'private_task') 
                        ? `${res.res_type === 'blocked' ? '🚫' : '☕️'} ${res.customer_name}` 
                        : (res.res_type === 'facility_keep_single' ? `🏢 ${res.customer_name} 様 (キープ中)` : `👤 ${res.customers?.admin_name || res.customer_name} 様`)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {res.res_type === 'facility_keep_single' ? '施設側で日程確保されています' : (res.res_type === 'normal' ? '一般予約' : 'スケジュールブロック')}
                    </div>
                  </div>
                  <div style={{ color: res.res_type === 'facility_keep_single' ? '#f97316' : themeColor, fontSize: '1.2rem' }}>〉</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSlotListModal(false)} style={{ marginTop: '25px', padding: '12px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>

            {!isPC && (
              <button 
                onClick={() => setShowSlotListModal(false)} 
                style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}
              >
                閉じる ✕
              </button>
            )}
          </div>
        </div>
      )}
{/* ⚙️ 3. 管理メニューModal (本家再現：ねじ込み予約・ブロック) */}
      {showMenuModal && (
        <div onClick={() => { setShowMenuModal(false); setShowBlockEndSelector(false); }} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: '35px', borderRadius: '30px', width: '90%', maxWidth: '340px', textAlign: 'center', position: 'relative' }}>
            
            {showBlockEndSelector ? (
              /* ==========================================
                 🕒 A：終了時間選択モード（✕専用）
                 ========================================== */
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#ef4444', fontSize: '1.1rem', fontWeight: '900' }}>何時まで「✕」にしますか？</h3>
                <p style={{ fontWeight: 'bold', color: '#64748b', marginBottom: '20px', fontSize: '0.85rem' }}>開始: {targetTime} 〜</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', padding: '5px' }}>
                  {timeSlots.slice(timeSlots.indexOf(targetTime) + 1).map((endTime, idx) => {
                    const slotsCount = idx + 1;
                    return (
                      <button
                        key={endTime}
                        onClick={() => executeBlockTime(slotsCount)}
                        style={{
                          padding: '16px', background: '#f8fafc', border: '2px solid #e2e8f0',
                          borderRadius: '16px', color: '#1e293b', fontWeight: 'bold', fontSize: '1rem',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                        }}
                      >
                        <span>〜 {endTime} まで</span>
                        <span style={{ color: '#ef4444', fontSize: '0.8rem', background: '#fee2e2', padding: '2px 8px', borderRadius: '6px' }}>
                          {slotsCount}コマ
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setShowBlockEndSelector(false)} style={{ marginTop: '15px', padding: '10px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}>
                  ◀ 戻る
                </button>
              </div>
            ) : (
              /* ==========================================
                 ⚙️ B：基本メニューモード（2択 or 4択）
                 ========================================== */
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
                <p style={{ fontWeight: '900', color: themeColor, fontSize: '2.2rem', margin: '0 0 25px 0' }}>{targetTime}</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* 🟢 1. 予約を入れる */}
                  <button 
                    onClick={() => {
                      setShowBlockEndSelector(false);
                      navigate(`/shop/${shopId}/reserve`, { 
                        state: { 
                          adminDate: selectedDate, adminTime: targetTime, 
                          fromView: 'calendar', isAdminMode: true,
  // 🚀 🆕 優先順位：①デフォルトスタッフID ➔ ②1人しかいない場合はそのID ➔ ③null(フリー)
  adminStaffId: staffs.find(s => s.is_default_for_admin)?.id || (staffs.length === 1 ? staffs[0].id : null)
} 
                      });
                    }} 
                    style={{ padding: '20px', background: themeColor, color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer', boxShadow: `0 4px 10px ${themeColor}44` }}
                  >
                    予約を入れる
                  </button>

                  {/* ☕️ 2. プライベート予定 */}
                  <button 
                    onClick={() => {
                      setShowMenuModal(false); 
                      setShowBlockEndSelector(false);
                      setPrivateTaskFields({ title: '', note: '' });
                      setShowPrivateModal(true); 
                    }} 
                    style={{ padding: '15px', background: '#f8fafc', color: '#475569', border: '2px solid #cbd5e1', borderRadius: '20px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    ☕️ プライベート予定
                  </button>

                  {/* 🔴 3. ✕ と 休み（営業時間内 && 定休日でない場合のみ表示） */}
                  {!isTargetOutsideHours && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', animation: 'fadeIn 0.3s' }}>
                      <button 
                        onClick={() => setShowBlockEndSelector(true)} // 🚀 ここで時間選択リストへ！
                        style={{ padding: '15px', background: '#fff', color: '#ef4444', border: `2px solid #fca5a5`, borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        ✕ (枠を閉じる)
                      </button>
                      <button onClick={handleBlockFullDay} style={{ padding: '15px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}>
                        今日を休みにする
                      </button>
                    </div>
                  )}

                  <button onClick={() => { setShowMenuModal(false); setShowBlockEndSelector(false); }} style={{ padding: '10px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold', marginTop: '5px' }}>
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {!isPC && (
              <button onClick={() => { setShowMenuModal(false); setShowBlockEndSelector(false); }} style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>閉じる ✕</button>
            )}
          </div>
        </div>
      )}

      {/* ⬇️⬇️⬇️ ここに以下のコードを貼り付けて復活させてください！ ⬇️⬇️⬇️ */}

      {/* ☕️ 復活：プライベート予定入力用モーダル */}
      {showPrivateModal && (
        <div style={overlayStyle} onClick={() => setShowPrivateModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ ...modalContentStyle, maxWidth: '400px', textAlign: 'center', position: 'relative', padding: '30px 20px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '5px' }}>☕️</div>
            <h3 style={{ margin: '0 0 5px 0', color: themeColor, fontWeight: '900' }}>プライベート予定</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '15px' }}>開始: {selectedDate.replace(/-/g, '/')} {targetTime} 〜</p>
            
            <div style={{ textAlign: 'left', marginBottom: '15px', flexShrink: 0 }}>
              <label style={labelStyle}>予定の内容（必須）</label>
              <input 
                type="text" 
                placeholder="例：休憩、買い出し、銀行など" 
                value={privateTaskFields.title}
                onChange={(e) => setPrivateTaskFields({ ...privateTaskFields, title: e.target.value })}
                style={{ ...inputStyle, marginBottom: '10px' }}
              />
              <label style={labelStyle}>メモ (任意)</label>
              <textarea 
                placeholder="詳細な内容があれば入力してください"
                value={privateTaskFields.note}
                onChange={(e) => setPrivateTaskFields({ ...privateTaskFields, note: e.target.value })}
                style={{ ...inputStyle, height: '60px', lineHeight: '1.5', marginBottom: '0' }}
              />
            </div>

            {/* 🚀 終了時間を選ぶリスト（スクロール可能） */}
            <div style={{ textAlign: 'left', flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, color: themeColor }}>何時まで？（タップして確定）</label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', padding: '5px' }}>
                {timeSlots.slice(timeSlots.indexOf(targetTime) + 1).map((endTime, idx) => {
                  const slotsCount = idx + 1;
                  return (
                    <button
                      key={endTime}
                      onClick={() => handleSavePrivateTask(slotsCount)}
                      style={{
                        padding: '14px', background: '#f8fafc', border: '2px solid #e2e8f0',
                        borderRadius: '12px', color: '#1e293b', fontWeight: 'bold', fontSize: '0.95rem',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                      }}
                    >
                      <span>〜 {endTime} まで</span>
                      <span style={{ color: '#475569', fontSize: '0.75rem', background: '#e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>
                        {slotsCount}コマ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px', flexShrink: 0 }}>
              <button 
                onClick={() => setShowPrivateModal(false)} 
                style={{ padding: '12px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}
              >
                キャンセル
              </button>
            </div>
            
            {!isPC && (
              <button onClick={() => setShowPrivateModal(false)} style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>閉じる ✕</button>
            )}
          </div>
        </div>
      )}

      {/* ⬆️⬆️⬆️ ここまで ⬆️⬆️⬆️ */}

      {/* 🆕 ここから追記：🏢 施設訪問詳細（名簿）モーダル本体 */}
{showVisitDetailModal && (
  <div style={overlayStyle} onClick={() => setShowVisitDetailModal(false)}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '500px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>🏢</div>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e293b' }}>{selectedRes?.customer_name}</h2>
        {/* 🆕 親予約がある場合に「継続分」と表示 */}
        {selectedRes?.parent_id && <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>※ 複数日訪問の継続分</span>}
      </div>

      {/* 🆕 【重要】残り人数のカウント計算 */}
{(() => {
        const total = visitResidents.length;
        const remaining = visitResidents.filter(r => r.status === 'pending').length;
        const done = total - remaining;

        // 🚀 🆕 【ここを追加！】この予約(selectedRes.id)を「親」に持つ予約が既に存在するか判定
        const isAlreadyExtended = visitRequests.some(v => v.parent_id === selectedRes?.id && v.status !== 'canceled');

        return (
          <div style={{ background: '#fcfaf7', padding: '15px', borderRadius: '15px', border: '1px solid #f0e6d2', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#948b83', fontWeight: 'bold', marginBottom: '5px' }}>施術の進捗状況</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#3d2b1f' }}>
              残り <span style={{ color: '#c5a059', fontSize: '2rem' }}>{remaining}</span> 名 / 全体 {total} 名
            </div>
            
            {/* 🚀 🆕 引き継ぎボタンエリア（条件付き表示） */}
            {remaining > 0 && (
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #f0e6d2' }}>
                {isAlreadyExtended ? (
                  // ✅ 既に引き継ぎ済みの場合は、ボタンの代わりに安心感のあるメッセージを表示
                  <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '10px', color: '#166534', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> 次回分への引き継ぎを作成済みです
                  </div>
                ) : !showCarryoverPicker ? (
                  <button 
                    onClick={() => { setShowCarryoverPicker(true); setCarryoverViewMonth(new Date()); }}
                    style={{ background: '#3d2b1f', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', width: '100%', boxShadow: '0 4px 10px rgba(61,43,31,0.2)' }}
                  >
                    ⏩ 終わらない分を別日に引き継ぐ
                  </button>
                ) : (
                  /* 📅 カレンダーピッカー表示モード */
                  <div style={{ background: '#fff', padding: '15px', borderRadius: '20px', border: '2px solid #c5a059', animation: 'fadeIn 0.3s', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <button onClick={() => setCarryoverViewMonth(new Date(carryoverViewMonth.setMonth(carryoverViewMonth.getMonth() - 1)))} style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>◀</button>
                      <span style={{ fontWeight: '900', color: '#3d2b1f' }}>{carryoverViewMonth.getFullYear()}年 {carryoverViewMonth.getMonth() + 1}月</span>
                      <button onClick={() => setCarryoverViewMonth(new Date(carryoverViewMonth.setMonth(carryoverViewMonth.getMonth() + 1)))} style={{ border: 'none', background: '#f1f5f9', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>▶</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', fontSize: '0.7rem', textAlign: 'center' }}>
                      {/* 🚀 曜日ラベルを月曜始まりに変更 */}
                      {['月','火','水','木','金','土','日'].map(w => <div key={w} style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '0.65rem' }}>{w}</div>)}
                      {(() => {
                        const year = carryoverViewMonth.getFullYear();
                        const month = carryoverViewMonth.getMonth();
                        
                        const rawFirstDay = new Date(year, month, 1).getDay();
                        const firstDayCount = rawFirstDay === 0 ? 6 : rawFirstDay - 1; 

                        const lastDate = new Date(year, month + 1, 0).getDate();
                        const daysArray = [...Array(firstDayCount).fill(null), ...[...Array(lastDate).keys()].map(i => i + 1)];
                        
                        return daysArray.map((day, i) => {
                          if (!day) return <div key={`empty-carry-${i}`} />;
                          
                          // 🚀 タイムゾーンのズレを完全に防ぐ、ローカルセーフな日付文字列の作成
                          const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const currentLoopDate = new Date(`${dStr}T00:00:00`); 
                          
                          // 🚀 1. 〇△✕のステータスを取得（AdminReservationsに元からある本物）
                          const status = getCarryoverDayStatus(dStr);
                          
                          // 🚀 2. その日の予定詳細を取得（AdminReservationsに元からある本物）
                          const summary = getDayEventSummary(currentLoopDate);
                          
                          const isSelected = carryoverDate === dStr;
                          const isSelectable = status !== 'past';
                          
                          // 🎨 状態（○ △ ✕）に合わせた記号ラベルと配色の決定
                          let symbolLabel = '○';
                          let statusColor = '#10b981'; // ○（空き）の緑
                          
                          if (status === 'partial') {
                            symbolLabel = '△';
                            statusColor = '#f59e0b'; // △（一部埋まり）のオレンジ
                          } else if (status === 'ng') {
                            symbolLabel = '✕';
                            statusColor = '#ef4444'; // ✕（不可）の赤
                          } else if (status === 'past') {
                            symbolLabel = '';
                          }

                          // 🚀 🆕 「他○件」の計算用：その日の個人予約とプライベート予定の合計件数を割り出す
                          const dayPersonalCount = reservations.filter(r => r.start_time.startsWith(dStr) && r.res_type === 'normal' && r.status !== 'canceled').length;
                          const dayPrivateCount = privateTasks.filter(p => p.start_time.startsWith(dStr)).length;
                          const totalEventsCount = dayPersonalCount + dayPrivateCount;

                          // 🚀 🆕 先頭の開始時間を綺麗にHH:mm形式にする（例: "2026-05-23T10:00:00" ➔ "10:00"）
                          let eventTimeStr = '';
                          if (summary.firstEntry && summary.firstEntry.time) {
                            const timePart = summary.firstEntry.time.split('T')[1];
                            if (timePart) {
                              eventTimeStr = timePart.substring(0, 5);
                            } else if (summary.firstEntry.time.includes(':')) {
                              // すでに "09:00" などの形式で入っている場合の安全装置
                              eventTimeStr = summary.firstEntry.time.substring(0, 5);
                            }
                          }

                          return (
                            <div 
                              key={i} 
                              onClick={() => isSelectable && setCarryoverDate(dStr)} 
                              style={{ 
                                padding: '4px 0', 
                                cursor: isSelectable ? 'pointer' : (status === 'past' ? 'not-allowed' : 'default'), 
                                borderRadius: '10px', 
                                background: isSelected ? '#3d2b1f' : 'none', 
                                color: isSelected ? '#fff' : '#1e293b', 
                                opacity: status === 'past' ? 0.25 : 1,
                                minHeight: '64px', // 🚀 文字拡大に合わせて高さを2pxだけ微調整
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'center',
                                boxSizing: 'border-box'
                              }}
                            >
                              {/* 💡 1行目: 日付の数字（少しクッキリ大きく） */}
                              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isSelected ? '#fff' : (summary.isHoliday ? '#94a3b8' : '#1e293b') }}>
                                {day}
                              </div>

                              {/* 💡 2行目: ○ △ ✕ の記号（サイズと太さをキープ） */}
                              <div style={{ fontSize: '0.75rem', fontWeight: '900', color: isSelected ? '#fff' : statusColor, marginTop: '1px', lineHeight: '1' }}>
                                {symbolLabel}
                              </div>

                              {/* 💡 3行目: 🚀 🆕 限界まで文字を大きくした予定名・時間表示エリア */}
                              {(status === 'ng' || status === 'partial') && (
                                <div style={{ 
                                  fontSize: '0.6rem', // 🚀 0.5rem から 0.6rem へ拡大！
                                  fontWeight: '900', 
                                  lineHeight: '1.1', 
                                  marginTop: '2px',
                                  transform: 'scale(0.9)', // 🚀 縮小率を 0.82 から 0.9 へ緩和して文字を大きく！
                                  transformOrigin: 'top center',
                                  color: isSelected ? '#fff' : (status === 'ng' ? '#be123c' : '#b45309'),
                                  textAlign: 'center',
                                  whiteSpace: 'nowrap',
                                  width: '100%'
                                }}>
                                  {status === 'partial' && totalEventsCount > 1 ? (
                                    <>
                                      {eventTimeStr && <div>{eventTimeStr}</div>}
                                      <div style={{ color: '#d97706', fontWeight: '900' }}>他{totalEventsCount - 1}件</div>
                                    </>
                                  ) : (
                                    <>
                                      <div>{summary.firstEntry ? summary.firstEntry.name.slice(0, 3) : (summary.isHoliday ? 'お休み' : '')}</div>
                                      {eventTimeStr && <div>{eventTimeStr}</div>}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {carryoverDate && (
                      <div style={{ marginTop: '20px', borderTop: '2px dashed #f1f5f9', paddingTop: '15px', textAlign: 'left' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#c5a059', display: 'block', marginBottom: '10px' }}>🕛 何時から開始しますか？</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                          {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'].map(t => (
                            <button key={t} onClick={() => setCarryoverTargetTime(t)} style={{ padding: '8px', borderRadius: '8px', border: carryoverTime === t ? '2px solid #3d2b1f' : '1px solid #e2e8f0', background: carryoverTime === t ? '#3d2b1f' : '#fff', color: carryoverTime === t ? '#fff' : '#3d2b1f', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>{t}</button>
                          ))}
                        </div>
                        <button onClick={handleCarryoverVisit} style={{ width: '100%', marginTop: '15px', padding: '14px', background: '#c5a059', color: '#3d2b1f', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '1rem', cursor: 'pointer' }}>引き継ぎを確定する</button>
                      </div>
                    )}
                    <button onClick={() => { setShowCarryoverPicker(false); setCarryoverDate(''); }} style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>キャンセル</button>
                  </div>
                )}
              </div>
            )}
            
            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '10px', fontWeight: 'bold' }}>
              （現在までに {done} 名が完了済み）
            </div>
          </div>
        );
      })()}

      {/* 🚀 🆕 ここを追加！：売上確定済みのメンバーリスト */}
      {finalizedSale && finalizedSale.details?.members_list && (
        <div style={{ marginBottom: '25px', background: '#f0fdf4', padding: '15px', borderRadius: '20px', border: '2px solid #10b981' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
            <CheckCircle size={18} /> 本日の完了実績（確定済み）
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {finalizedSale.details.members_list.map((m, idx) => (
              <div key={idx} style={{ 
                background: '#fff', padding: '10px 12px', borderRadius: '10px', display: 'flex', 
                justifyContent: 'space-between', alignItems: 'center', border: '1px solid #bbf7d0' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.7rem', background: '#10b981', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', minWidth: '35px', textAlign: 'center' }}>
  {/* 🚀 🆕 もしデータに「F」が含まれていればそのまま、なければ「F」を足す */}
  {m.floor ? (String(m.floor).includes('F') ? m.floor : `${m.floor}F`) : '-'}
</span>
                  <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' }}>{m.name} 様</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold' }}>{m.menu}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '0.8rem', fontWeight: '900', color: '#166534' }}>
             完了分合計：{finalizedSale.details.members_list.length} 名 / ¥{finalizedSale.total_amount?.toLocaleString()}
          </div>
        </div>
      )}

      {/* 📋 施術予定者リスト（まだ残っている人を優先して表示） */}
      <p style={{ color: '#64748b', fontWeight: 'bold', marginBottom: '10px', fontSize: '0.85rem' }}>👥 本日の施術予定者（未完了の方）</p>
      <div style={{ maxHeight: '250px', overflowY: 'auto', background: '#f8fafc', borderRadius: '15px', padding: '10px', border: '1px solid #eee' }}>
        {visitResidents
          .filter(r => r.status === 'pending')
          // 🚀 完了していない人の中でも、新規追加分を上に並べる
          .sort((a, b) => (a.isNewAddition === b.isNewAddition) ? 0 : a.isNewAddition ? -1 : 1)
          .map((item, idx) => (
            <div key={idx} style={{ 
              background: '#fff', 
              padding: '10px 15px', 
              borderRadius: '10px', 
              marginBottom: '6px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              // 🚀 新規追加ならオレンジの枠線にする
              border: item.isNewAddition ? '2px solid #f59e0b' : '1px solid #e2e8f0' 
            }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.members?.name} 様
                  {/* 🚀 🆕 店舗側でも「新規追加」がわかる！ */}
                  {item.isNewAddition && (
                    <span style={{ fontSize: '0.6rem', background: '#f59e0b', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>新規追加</span>
                  )}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {item.members?.floor ? `${String(item.members.floor).replace('F','')}F ` : ''}{item.members?.room}号室
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', color: item.isNewAddition ? '#d97706' : themeColor, fontWeight: 'bold' }}>{item.menu_name}</span>
            </div>
        ))}
        {visitResidents.filter(r => r.status === 'pending').length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>すべて完了しました！✨</div>
        )}
      </div>

      {/* 🚀 🆕 特定の日だけをキャンセルするボタンを追加 */}
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button 
          onClick={() => {
            setShowVisitDetailModal(false); // 一旦詳細を閉じて
            handleDeleteVisit(selectedRes.id, selectedRes.scheduled_date, selectedRes.customer_name); // 削除確認へ
          }}
          style={{ width: '100%', padding: '12px', background: '#fff', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          🗑 この日の訪問をキャンセル（枠を解放）
        </button>

        <button onClick={() => setShowVisitDetailModal(false)} style={{ width: '100%', padding: '15px', background: '#3d2b1f', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
          詳細を閉じる
        </button>
      </div>
    </div>
  </div>
)}

{/* 🚀 🆕 追加：施設予約キャンセル確認モーダル */}
{showFacCancelModal && facCancelTarget && (
  <div style={overlayStyle} onClick={() => setShowFacCancelModal(false)}>
    <div 
      onClick={(e) => e.stopPropagation()} 
      style={{ ...modalContentStyle, maxWidth: '600px', width: '95%', textAlign: 'center', padding: '35px' }} // 🚀 横幅を600pxに拡大
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>⚠️</div>
      <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontWeight: '900', fontSize: '1.3rem' }}>予定のキャンセル・削除</h3>
      
      <div style={{ background: '#fff1f2', padding: '20px', borderRadius: '20px', border: '1px solid #fecdd3', marginBottom: '25px' }}>
        <p style={{ fontSize: '1rem', color: '#e11d48', margin: '0 0 15px 0', fontWeight: 'bold' }}>
          {facCancelTarget.date.replace(/-/g, '/')} の訪問予定を消去しますか？
        </p>
        
        {/* 🚀 🆕 【目玉機能】メニュー別の人員集計 */}
        {facCancelTarget.residents?.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.6)', padding: '15px', borderRadius: '15px', marginBottom: '15px', textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #fecdd3', paddingBottom: '5px' }}>📋 メニュー別集計</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {(() => {
                const counts = facCancelTarget.residents.reduce((acc, r) => {
                  const m = r.menu_name || '未設定';
                  acc[m] = (acc[m] || 0) + 1;
                  return acc;
                }, {});
                return Object.entries(counts).map(([name, count]) => (
                  <div key={name} style={{ background: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '900', color: '#be123c', border: '1px solid #fecdd3' }}>
                    {name}：{count}名
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* 🚀 修正：名簿リストを「名前 ＋ メニュー」形式で表示 */}
        <div style={{ background: '#fff', padding: '15px', borderRadius: '15px', border: '1px solid rgba(225,29,72,0.1)', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>名簿プレビュー</span>
            <span style={{ fontSize: '0.9rem', color: '#b91c1c', fontWeight: '900' }}>合計 {facCancelTarget.totalCount || 0} 名</span>
          </div>
          
          <div style={{ maxHeight: '350px', overflowY: 'auto', fontSize: '0.9rem', color: '#3d2b1f' }}>
            {facCancelTarget.residents?.length > 0 ? (
              facCancelTarget.residents.map((res, idx) => (
                <div key={idx} style={{ borderBottom: '1px solid #fff5f5', padding: '10px 5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold' }}>{res.members?.name} 様</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#f8fafc', padding: '2px 8px', borderRadius: '4px' }}>{res.menu_name}</span>
                </div>
              ))
            ) : (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>（名簿データがありません）</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'left', marginBottom: '25px', maxWidth: '300px', margin: '0 auto 25px' }}>
        <label style={labelStyle}>解除パスワード（1234）</label>
        <input 
  type="text" // ❌ password ではなく text に変更
  inputMode="numeric"
  pattern="\d{4}"
  placeholder="数字4桁を入力"
  value={facCancelPass}
  onChange={(e) => {
    // 🚀 入力は数字4桁だけに制限
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setFacCancelPass(val);
  }}
  // 🚀 ブラウザの自動入力を徹底的に遮断する属性のフルセット
  autoComplete="off"
  autoCorrect="off"
  autoCapitalize="off"
  spellCheck="false"
  name="otp_pin_input" // 🚀 passwordという名前を徹底排除
  style={{ 
    ...inputStyle, 
    textAlign: 'center', 
    fontSize: '1.4rem', 
    letterSpacing: '0.3em', 
    borderRadius: '15px', 
    border: `2px solid ${themeColor}44`,
    // 🚀 type="text" なので文字が見えてしまうのを隠すための設定
    WebkitTextSecurity: 'disc', // iOS/Chrome用：文字を●で隠す
    textSecurity: 'disc'          // その他ブラウザ用
  }}
/>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
        <button 
          onClick={executeFacCancel}
          style={{ width: '100%', padding: '18px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '18px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(225,29,72,0.2)' }}
        >
          パスワードを確認して削除
        </button>
        <button 
          onClick={() => setShowFacCancelModal(false)} 
          style={{ padding: '12px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}
        >
          戻る（何もしない）
        </button>
      </div>
    </div>
  </div>
)}

      {/* 🚀 🆕 修正：スマホ用カレンダー（予定名表示 ＆ 横幅拡大版） */}
      {showMobileCalendar && (
        <div style={overlayStyle} onClick={() => setShowMobileCalendar(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              ...modalContentStyle, 
              maxWidth: isPC ? '580px' : '95%', // 🚀 PCなら横幅にゆとりを持たせて文字潰れを完全防止
              width: '580px', 
              padding: '25px 20px', 
              borderRadius: '32px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              position: 'relative'
            }}
          >
            
            {/* 年月ナビゲーション */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', padding: '10px', background: '#f8fafc', borderRadius: '18px' }}>
              <button 
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} 
                style={{ border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: '12px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: themeColor, cursor: 'pointer' }}
              >
                ◀
              </button>

              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>{viewMonth.getFullYear()}年</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '2px' }}>{viewMonth.getMonth() + 1}月</div>
              </div>

              <button 
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} 
                style={{ border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: '12px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: themeColor, cursor: 'pointer' }}
              >
                ▶
              </button>
            </div>

            {/* カレンダーメイングリッド（PCマウスホイール＆スマホスワイプ両対応） */}
            <div 
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const diff = touchStartX.current - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 50) {
                  if (diff > 0) setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
                  else setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
                }
              }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}
            >
              {['月','火','水','木','金','土','日'].map(d => (
                <div key={d} style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '12px' }}>{d}</div>
              ))}
              
              {miniCalendarDays.map((date, i) => {
                if (!date) return <div key={i} />;
                const dStr = getJapanDateStr(date);
                const isSelected = dStr === selectedDate;
                const isToday = dStr === getJapanDateStr(new Date());
                const summary = getDayEventSummary(date);

                let circleColor = 'transparent';
                if (summary.hasReservation) circleColor = themeColor;
                else if (summary.hasFacility) circleColor = '#4f46e5';
                else if (summary.hasPrivate) circleColor = '#64748b';

                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setStartDate(date);
                      setSelectedDate(dStr);
                      setShowMobileCalendar(false);
                    }}
                    style={{ 
                      padding: '6px 0', cursor: 'pointer', borderRadius: '16px',
                      background: summary.isHoliday ? '#f1f5f9' : 'none',
                      opacity: summary.isHoliday ? 0.6 : 1,
                      minHeight: '72px', // 🚀 文字サイズ拡大に伴い、PCでも絶対につぶれない絶妙な高さをキープ！
                      display: 'flex', flexDirection: 'column', alignItems: 'center'
                    }}
                  >
                    {/* 日付サークル */}
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.05rem', fontWeight: 'bold',
                      background: isSelected ? themeColor : (isToday ? themeColorLight : 'none'),
                      color: isSelected ? '#fff' : (isToday ? themeColor : (summary.isHoliday ? '#94a3b8' : '#1e293b')),
                      border: !isSelected && circleColor !== 'transparent' ? `2px solid ${circleColor}` : 'none'
                    }}>
                      {date.getDate()}
                    </div>

                    {/* 🚀 施設名・予定名テキスト（要望通りの3文字カット版！） */}
                    <div style={{ 
                      fontSize: '0.8rem', // 🚀 見やすさを極限まで高めるためにPC/大画面ポップアップ用に文字をクッキリ拡大！
                      fontWeight: '800', 
                      marginTop: '5px', 
                      color: circleColor === 'transparent' ? '#94a3b8' : circleColor,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', padding: '0 2px', textAlign: 'center'
                    }}>
                      {summary.firstEntry ? summary.firstEntry.name.slice(0, 3) : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* フッター閉じるボタン：PCとスマホで表示位置をスマートに出し分け */}
            <button 
              type="button"
              onClick={() => {
                setShowMobileCalendar(false);
              }}
              style={isPC ? {
                width: '100%', marginTop: '20px', padding: '14px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem'
              } : {
                position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000
              }}
            >
              閉じる ✕
            </button>

          </div>
        </div>
      )}

      {/* 🚀 🆕 追加：スマホ用 全顧客検索モーダル（50音順 ＆ 下部検索バー常駐） */}
      {showMobileSearchModal && (
        <div style={overlayStyle} onClick={() => { setShowMobileSearchModal(false); setSearchTerm(''); }}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ ...modalContentStyle, maxWidth: '450px', height: '85vh', padding: '0', display: 'flex', flexDirection: 'column', borderRadius: '30px', overflow: 'hidden' }}
          >
            {/* 📋 ヘッダー：タイトル */}
            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>👤 顧客名簿 (50音順)</h3>
            </div>

            {/* 📜 メイン：顧客リスト（スクロールエリア） */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', background: '#fcfcfc' }}>
              {(() => {
                let lastLabel = ""; // 🚀 直前のグループを記憶する変数
                
                return allCustomers
                  .filter(c => 
                    (c.admin_name || c.name || '').includes(searchTerm) || 
                    (c.furigana || '').includes(searchTerm) || 
                    (c.phone || '').includes(searchTerm)
                  )
                  .map((c) => {
                    // 🚀 🆕 修正：今回のお客様が何行か判定
                    const currentLabel = getKanaGroup(c.furigana);
                    const isNewGroup = currentLabel !== lastLabel;
                    lastLabel = currentLabel;

                    return (
                      <React.Fragment key={c.id}>
                        {/* 🚀 🆕 グループが変わった瞬間にだけ「あ行」などの見出しを表示 */}
                        {isNewGroup && (
                          <div style={{
                            padding: '12px 10px 4px',
                            fontSize: '0.8rem',
                            fontWeight: '900',
                            color: themeColor,
                            borderBottom: '1px solid #eee',
                            marginBottom: '8px',
                            background: 'linear-gradient(to right, #fcfcfc, #fff)',
                            position: 'sticky',
                            top: 0,
                            zIndex: 2
                          }}>
                            {currentLabel}
                          </div>
                        )}

                        <div 
                          onClick={() => {
                            openCustomerDetail(c); // カルテ（詳細）を開く
                            setShowMobileSearchModal(false);
                            setSearchTerm('');
                          }}
                          style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fff', borderRadius: '12px', marginBottom: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1e293b' }}>
                              {c.admin_name || c.name} 様
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                              {c.furigana || '---'} / {c.phone || '電話未登録'}
                            </div>
                          </div>
                          <div style={{ color: themeColor, opacity: 0.3 }}>〉</div>
                        </div>
                      </React.Fragment>
                    );
                  });
              })()}
              {allCustomers.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>顧客データを読み込んでいます...</div>}
            </div>

            {/* 🔍 フッター：ここに検索バーと閉じるボタンを固定 */}
            <div style={{ padding: '20px', background: '#fff', borderTop: '1px solid #f1f5f9', boxShadow: '0 -10px 20px rgba(0,0,0,0.05)', flexShrink: 0 }}>
              <div style={{ position: 'relative', marginBottom: '15px' }}>
                <input 
                  type="text" 
                  placeholder="名前・フリガナ・電話番号で絞り込み..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, paddingLeft: '40px', background: '#f8fafc', border: `1px solid ${themeColor}22` }}
                />
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              </div>
              <button 
                onClick={() => { setShowMobileSearchModal(false); setSearchTerm(''); }}
                style={{ width: '100%', padding: '16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      

{/* 🆕 追記：予約枠をピカッと光らせるアニメーション */}
<style>{`
        @keyframes flashGold {
          0% { 
            background-color: #fdd835 !important; /* 強めの黄色 */
            box-shadow: 0 0 40px #fdd835, inset 0 0 20px #fff; 
            transform: scale(1.1); /* 少し大きく浮かび上がる */
            z-index: 100;
          }
          70% {
            transform: scale(1.05);
          }
          100% { 
            /* 最終的には元の色に戻る（アニメーション終了で style の背景色に戻ります） */
            transform: scale(1);
            box-shadow: 0 0 0px transparent;
          }
        }
      `}</style>
      
      {/* 🚀 🆕 ここから差し込む！：過去の履歴・詳細内訳ポップアップ本体 */}
      <AnimatePresence>
        {showHistoryDetail && selectedHistory && (
          <div style={overlayStyle} onClick={() => setShowHistoryDetail(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ ...modalContentStyle, maxWidth: '400px', padding: '0', overflow: 'hidden', borderRadius: '32px' }}
            >
              <div style={{ background: '#4b2c85', color: '#fff', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 'bold' }}>施術履歴の詳細内訳</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900' }}>
                    {selectedHistory.start_time.split('T')[0].replace(/-/g, '/')} の記録
                  </div>
                </div>
                <button onClick={() => setShowHistoryDetail(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#fff' }}>✕</button>
              </div>

              <div style={{ padding: '25px', maxHeight: '70vh', overflowY: 'auto' }}>
                {(() => {
                  const d = parseReservationDetails(selectedHistory);
                  const productTotal = d.products.reduce((sum, p) => sum + (Number(p.price) * Number(p.quantity)), 0);
                  const technicalTotal = d.totalPrice - productTotal;

                  return (
                    <>
                      {/* ✂️ 技術メニュー：1項目ずつ金額を表示 */}
                      <div style={{ marginBottom: '25px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b2c85', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '12px' }}>
                          <Scissors size={16} /> 施術・技術メニュー
                        </div>

                        {/* 🚀 🆕 追加：担当スタッフ名の表示（2人以上の場合のみ） */}
                        {staffs.length > 1 && (
                          <div style={{ fontSize: '0.85rem', color: '#4b2c85', fontWeight: 'bold', marginBottom: '15px', paddingLeft: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={14} /> 担当: {selectedHistory.staffs?.name || '担当なし'}
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* ① メインメニューの内訳（カット・カラー等） */}
                          {d.items.map((item, i) => (
                            <div key={`item-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                              <span>{item.name}</span>
                              <span>¥{Number(item.price || 0).toLocaleString()}</span>
                            </div>
                          ))}

                          {/* ② 枝分かれオプション（シャンプー等） */}
                          {d.subItems.map((opt, i) => (
                            <div key={`opt-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', paddingLeft: '15px' }}>
                              <span>└ {opt.option_name}</span>
                              <span>+¥{Number(opt.additional_price || 0).toLocaleString()}</span>
                            </div>
                          ))}

                          {/* ③ 調整（割引・加算） */}
                          {d.adjustments.map((adj, i) => (
                            <div key={`adj-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444', paddingLeft: '15px' }}>
                              <span>└ {adj.name}</span>
                              <span>{adj.is_minus ? '-' : '+'}¥{Number(adj.price).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 🛍 店販商品 */}
                      {d.products.length > 0 && (
                        <div style={{ marginBottom: '25px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#008000', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '12px' }}>
                            <ShoppingBag size={16} /> 店販商品
                          </div>
                          {d.products.map((p, i) => (
                            <div key={`prod-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: '8px', paddingLeft: '5px' }}>
                              <span style={{ fontWeight: 'bold' }}>{p.name} <small style={{ color: '#94a3b8' }}>x{p.quantity}</small></span>
                              <span style={{ fontWeight: '900' }}>¥{(p.price * p.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 最終集計 */}
                      <div style={{ marginTop: '30px', padding: '20px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', marginBottom: '8px' }}>
                          <span>技術計（調整込）</span>
                          <span>¥{technicalTotal.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#008000', marginBottom: '15px' }}>
                          <span>商品売上</span>
                          <span>¥{productTotal.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px dashed #cbd5e1', paddingTop: '15px' }}>
                          <span style={{ fontWeight: '900', color: '#1e293b' }}>総計</span>
                          <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#d34817' }}>¥ {d.totalPrice.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <button onClick={() => setShowHistoryDetail(false)} style={{ width: '100%', marginTop: '25px', padding: '15px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}>閉じる</button>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* 🚀 🆕 ここまで差し込む！ */}
      
    </div> // コンポーネント全体の閉じ
  );
}
// 🆕 画面切り替えスイッチ用のスタイル（これを追加してください）
const switchBtnStyle = (active) => ({ 
  padding: '5px 15px', 
  borderRadius: '6px', 
  border: 'none', 
  background: active ? '#fff' : 'transparent', 
  fontWeight: 'bold', 
  fontSize: '0.75rem', 
  cursor: 'pointer', 
  boxShadow: active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', 
  color: active ? '#1e293b' : '#64748b',
  transition: 'all 0.2s'
});
const mobileTabStyle = (active, color) => ({
  display: 'flex', 
  flexDirection: 'column', 
  alignItems: 'center', 
  justifyContent: 'center', 
  gap: '4px',
  background: 'none', 
  border: 'none', 
  color: active ? color : '#94a3b8',
  cursor: 'pointer', 
  flex: 1, 
  padding: '8px 0', 
  transition: 'all 0.2s'
});

const badgeStyle = (color) => ({
  textDecoration: 'none', 
  background: color, 
  color: '#fff',
  padding: '2px 8px', 
  borderRadius: '6px', 
  fontSize: '0.65rem',
  fontWeight: 'bold', 
  display: 'inline-flex', // 横並びにする
  alignItems: 'center', 
  gap: '4px',
  boxShadow: `0 2px 4px ${color}33`,
  marginLeft: '10px' // お名前の横に少し隙間を作る
});

export default AdminReservations;