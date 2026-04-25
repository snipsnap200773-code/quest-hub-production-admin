import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Clipboard, Activity, BarChart3, Calendar, Building2, Trash2, Clock, Settings, CheckCircle, Search, Scissors, ShoppingBag, X, Percent } from 'lucide-react';

// 🆕 予約者名から固有のパステルカラーを生成するロジック
const getCustomerColor = (name, type) => { // 💡 typeを引数に追加
  if (type === 'private_task') {
    // 💡 プライベート予定は落ち着いたグレー系の色にする
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
  const [facilityConnections, setFacilityConnections] = useState([]);
  const [message, setMessage] = useState('');
  const [categoryMap, setCategoryMap] = useState({});

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

  const [customers, setCustomers] = useState([]); 
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // 他のStateと一緒に定義してください
const [mergeCandidate, setMergeCandidate] = useState(null); // 重複が見つかった「大造」さん候補
const [showMergeConfirm, setShowMergeConfirm] = useState(false); // 3択モーダルの表示フラグ

/* 🆕 ここから追記：施設訪問名簿用のポップアップ管理 */
const [showVisitDetailModal, setShowVisitDetailModal] = useState(false);
const [visitResidents, setVisitResidents] = useState([]);

// 🏢 施設訪問詳細（入居者リスト）を開く関数
const [finalizedSale, setFinalizedSale] = useState(null); // 🆕 売上実績保存用のStateを追加

  const openVisitDetail = async (visitId, facilityName, visitData) => {
    if (!visitId) return;
    setLoading(true);
    setFinalizedSale(null); // 🆕 前のデータをクリア

    const targetId = visitData.parent_id || visitId;
    
    // 🚀 名簿と売上実績を同時に取得
    const [resRes, saleRes] = await Promise.all([
      supabase.from('visit_request_residents').select('status, menu_name, members (name, room, floor)').eq('visit_request_id', targetId),
      supabase.from('sales').select('*').eq('visit_request_id', visitId).maybeSingle() // 🆕 その日の売上実績を探す
    ]);

    if (!resRes.error) {
      setVisitResidents(resRes.data || []);
      setFinalizedSale(saleRes.data || null); // 🆕 あればセット
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
        // 🚀 A: 確定済み予約（visit_requests）の物理削除
        const { error } = await supabase.from('visit_requests').delete().eq('id', id);
        if (error) throw error;
      } else {
        // 🚀 B: キープ（定期・手動）の解除ロジック
        await supabase.from('regular_keep_exclusions').upsert([{ 
          facility_user_id: id, shop_id: shopId, excluded_date: date 
        }]);
        await supabase.from('keep_dates').delete().match({ 
          facility_user_id: id, shop_id: shopId, date: date 
        });
      }

      setShowFacCancelModal(false);
      showMsg(`${name} 様の予定をキャンセルしました。`);
      fetchData(); 
    } catch (err) {
      alert("実行エラー: " + err.message);
    }
  };

// 🚀 🆕 確定済みの施設訪問（visit_request）を削除する関数
const handleDeleteVisit = (visitId, dateStr, facilityName) => {
  // 🚀 window.confirm を廃止！ 
  // 🚀 パスワードモーダルを呼び出し、type: 'visit' をセットします
  setFacCancelTarget({ id: visitId, date: dateStr, name: facilityName, type: 'visit' });
  setFacCancelPass('');
  setShowFacCancelModal(true);
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
    if (location.state?.fromReserve) {
      setIsScrollLocked(true);
      const timer = setTimeout(() => {
        setIsScrollLocked(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

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

// 🆕 location.search を追加することで、予約完了後にURLが変わった瞬間に再取得が走るようにします
  useEffect(() => { fetchData(); }, [shopId, startDate, location.search]);

  // 🚀 🆕 ここから追加：履歴のカードをタップした時に詳細ポップアップを開く命令
  const openHistoryDetail = (visit) => {
    setSelectedHistory(visit);
    setShowHistoryDetail(true);
  };

  // ✅ ツイン・カレンダー対応版 fetchData
  const fetchData = async () => {
    setLoading(true);
    // 1. 自分の店舗プロフィールを取得
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (!profile) { setLoading(false); return; }
    setShop(profile);

    // 🆕 カテゴリと専用屋号のリストを取得
  const { data: catData } = await supabase
    .from('service_categories')
    .select('name, url_key, custom_shop_name')
    .eq('shop_id', shopId);
  
  const shopNameMap = {};
  catData?.forEach(c => {
    // 💡 識別キー(url_key)をキーにして、専用屋号を格納
    if (c.url_key) {
      shopNameMap[c.url_key] = c.custom_shop_name || c.name;
    }
  });
  setCategoryMap(shopNameMap); // 💡 あとで使えるようにStateに入れておきます

    // ✅ スタッフ一覧を取得（何人いるか判定するため）
    const { data: staffsData } = await supabase
      .from('staffs')
      .select('*')
      .eq('shop_id', shopId)
      .order('sort_order', { ascending: true });
    setStaffs(staffsData || []);

    // 2. スケジュール共有設定（schedule_sync_id）を確認
    let targetShopIds = [shopId];
    if (profile.schedule_sync_id) {
      const { data: siblingShops } = await supabase
        .from('profiles')
        .select('id')
        .eq('schedule_sync_id', profile.schedule_sync_id);
      if (siblingShops) {
        targetShopIds = siblingShops.map(s => s.id);
      }
    }

// 3. 全関連店舗の予約データを合算して取得（顧客マスタの最新名も取得）
// 1. 予約データの取得
const { data: resData } = await supabase
  .from('reservations')
  .select('*, profiles(business_name), staffs(name), customers(*)')
  .in('shop_id', targetShopIds);

// 2. 🆕 プライベート予定の取得
    const { data: privData } = await supabase
      .from('private_tasks')
      .select('*')
      .eq('shop_id', shopId);

    // 🆕 【ここを追加！】提携施設と定期ルールを取得
    const { data: connData } = await supabase
      .from('shop_facility_connections')
      .select('*, facility_users(facility_name)')
      .eq('shop_id', shopId)
      .eq('status', 'active');
    setFacilityConnections(connData || []);

    // 3. 🆕 施設訪問依頼の取得
    const { data: visitData } = await supabase
      .from('visit_requests')
      .select('*, facility_users(facility_name), visit_request_residents(count)')
      .eq('shop_id', shopId)
      // ✅ .neq('status', 'completed') を削除することで、完了分もカレンダーに表示されます
      .neq('status', 'canceled');

    // 🆕 【重要：ここがエラーの場所でした】
    // 変数名を mData に統一して定義し、正しく State にセットします
    const { data: mData } = await supabase
      .from('keep_dates')
      .select('*, facility_users(facility_name)')
      .eq('shop_id', shopId);

    // 🆕 定期訪問の除外リストも取得
    const { data: exclData } = await supabase
      .from('regular_keep_exclusions')
      .select('excluded_date')
      .eq('shop_id', shopId);

    setReservations(resData || []);
    setPrivateTasks(privData || []);
    setVisitRequests(visitData || []);
    setManualKeeps(mData || []); // 💡 manualKeepData ではなく mData を使う
    setExclusions(exclData?.map(e => e.excluded_date) || []);
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
    setSelectedRes(res);

    let cust = null;
    if (res.customer_id) {
      const { data: matched } = await supabase.from('customers').select('*').eq('id', res.customer_id).maybeSingle();
      cust = matched;
    }
    if (!cust) {
      const orConditions = [];
      if (res.customer_phone && res.customer_phone !== '---') orConditions.push(`phone.eq.${res.customer_phone}`);
      if (res.customer_email) orConditions.push(`email.eq.${res.customer_email}`);
      if (orConditions.length > 0) {
        const { data: matched } = await supabase.from('customers').select('*').eq('shop_id', shopId).or(orConditions.join(',')).maybeSingle();
        cust = matched;
      }
    }
    finalizeOpenDetail(res, cust);
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
    setCustomerHistory([]); 

    const isFac = cust?.is_facility || res.res_type === 'facility_visit';
    const searchName = (cust?.name || res.customer_name || "").trim(); 
    const visitSnapshot = res.options?.visit_info || {};

    let facData = null;
    if (isFac) {
      const { data } = await supabase.from('facility_users').select('*').eq('facility_name', searchName).maybeSingle();
      facData = data;
    }

    setEditFields({
      is_facility: isFac, 
      name: cust ? (cust.admin_name || cust.name || res.customer_name) : res.customer_name,
      furigana: facData?.furigana || cust?.furigana || visitSnapshot.furigana || '',
      phone: facData?.tel || cust?.phone || res.customer_phone || '',
      email: facData?.email || cust?.email || res.customer_email || '',
      zip_code: cust?.zip_code || visitSnapshot.zip_code || '',
      address: facData?.address || cust?.address || visitSnapshot.address || '',
      parking: cust?.parking || visitSnapshot.parking || '',
      building_type: cust?.building_type || visitSnapshot.building_type || '',
      care_notes: cust?.care_notes || visitSnapshot.care_notes || '',
      company_name: cust?.company_name || visitSnapshot.company_name || '',
      symptoms: cust?.symptoms || visitSnapshot.symptoms || '',
      request_details: cust?.request_details || visitSnapshot.request_details || '',
      memo: res.res_type === 'private_task' ? (res.note || '') : (cust?.memo || ''),
      line_user_id: cust?.line_user_id || res.line_user_id || null,
      custom_answers: cust?.custom_answers || visitSnapshot.custom_answers || {}
    });

    setSelectedCustomer(cust || null);

    let history = [];
    if (isFac) {
      history = visitRequests.filter(v => (v.facility_users?.facility_name === searchName || v.customer_name === searchName))
        .map(v => ({ ...v, start_time: v.scheduled_date }))
        .sort((a, b) => b.start_time.localeCompare(a.start_time));
    } else {
      history = reservations.filter(r => r.shop_id === shopId && r.res_type === 'normal' && (r.customer_name === searchName || (cust?.id && r.customer_id === cust.id)))
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    }
    setCustomerHistory(history);
    setShowDetailModal(true);
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
      // --- ここまで追加 ---

      // 1. まず同じ名前の人がいないかDBをチェック（名寄せ）
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('shop_id', shopId)
        .eq('name', normalizedName)
        .maybeSingle();

      const finalTargetId = selectedCustomer?.id || existingCust?.id;

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
            options: { ...currentOptions, visit_info: updatedVisitInfo } // 👈 予約票側の住所も同期
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
  const checkIsRegularKeep = (date) => {
    const dStr = getJapanDateStr(date);
    
    // 🆕 【ここを追加！】もし除外リストに入っていたら、予定なしとして返す
    if (exclusions.includes(dStr)) return null;

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
      return [{
        res_type: 'facility_keep',
        customer_name: `${mKeep.facility_users?.facility_name} 予定`,
        facility_user_id: mKeep.facility_user_id, // 🆕 追加
        start_time: `${dateStr}T${timeStr}:00`,
        isKeep: true
      }];
    }

    const rKeep = checkIsRegularKeep(dateObj);
    if (rKeep && rKeep.time === currentSlotTime) {
      return [{
        res_type: 'facility_keep',
        customer_name: `${rKeep.name} 予定`,
        facility_user_id: rKeep.facility_user_id, // 🆕 追加
        start_time: `${dateStr}T${timeStr}:00`,
        isKeep: true
      }];
    }

    // --- 🏆 優先度3：施設訪問日の「それ以外の時間」をステルスブロック ---
    const currentSlotStart = new Date(`${dateStr}T${timeStr}:00`).getTime();

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
      customer_name: '管理者ブロック', 
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
    <div style={{ display: 'flex', width: '100vw', height: '100dvh', background: '#fff', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      {/* 🆕 追記：通知メッセージを表示するボックス [cite: 2026-03-08] */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 10001, textAlign: 'center', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          {message}
        </div>
      )}
      {isPC && (
        
        <div style={{ width: '260px', flexShrink: 0, borderRight: '0.5px solid #cbd5e1', padding: '18px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#fff', zIndex: 100 }}>

{/* --- 1段目：タイトルと設定 --- */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* 💡 左側のアイコン内の文字も、店舗名の1文字目に自動で変わるようにしました */}
              <div style={{ width: '32px', height: '32px', background: themeColor, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {(shop?.business_name || 'S')[0]}
              </div>
              
              {/* 🚀 🆕 ここを店舗名に変更 */}
              <h1 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, color: '#1e293b' }}>
                {shop?.business_name || 'SnipSnap Admin'}
              </h1>
            </div>
            <button 
              onClick={() => navigate(`/admin/${shopId}/dashboard`)}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', padding: '6px', display: 'flex', alignItems: 'center', color: '#64748b' }}
            >
              ⚙️
            </button>
          </div>

          {/* --- 2段目：切り替えスイッチ（カレンダーも維持！） --- */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }}>
            <button style={{ ...switchBtnStyle(true), flex: 1 }}>カレンダー</button>
            <button 
              onClick={() => navigate(`/admin/${shopId}/timeline?date=${selectedDate}`)} 
              style={{ ...switchBtnStyle(false), flex: 1 }}
            >
              タイムライン
            </button>
          </div>

          <div style={{ border: '1px solid #eee', borderRadius: '12px', padding: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 'bold' }}>
              {viewMonth.getFullYear()}年 {viewMonth.getMonth() + 1}月
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth() - 1)))} style={miniBtnStyle}>＜</button>
                <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth() + 1)))} style={miniBtnStyle}>＞</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.8rem' }}>
              {['月','火','水','木','金','土','日'].map(d => <div key={d} style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold' }}>{d}</div>)}
              {miniCalendarDays.map((date, i) => date ? <div key={i} onClick={() => { setStartDate(date); setSelectedDate(getJapanDateStr(date)); }} style={{ padding: '8px 0', cursor: 'pointer', borderRadius: '50%', background: getJapanDateStr(date) === selectedDate ? themeColor : 'none', color: getJapanDateStr(date) === selectedDate ? '#fff' : '#475569' }}>{date.getDate()}</div> : <div key={i} />)}
            </div>
          </div>

<div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* ✅ 追加：現場での実行用「今日のタスク」ボタン [cite: 2026-03-06] */}
            <button 
              onClick={() => navigate(`/admin/${shopId}/today-tasks`)}
              style={{ 
                padding: '15px', 
                background: '#1e293b', // カレンダーと差別化するために深い色に
                color: '#fff', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              ⚡ 本日のタスク (実行)
            </button>

            <button 
              onClick={() => isManagementEnabled && navigate(`/admin/${shopId}/management`)} 
              style={{ 
                padding: '15px',
                background: isManagementEnabled ? themeColor : '#e2e8f0', 
                color: isManagementEnabled ? '#fff' : '#94a3b8', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: isManagementEnabled ? 'pointer' : 'not-allowed', 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              disabled={!isManagementEnabled}
            >               
              {isManagementEnabled ? '📊 顧客・売上管理へ' : '🔒 顧客・売上管理 (未解放)'}
            </button>
          </div>
                  </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ padding: isPC ? '15px 25px' : '15px 10px', borderBottom: '0.5px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          {isPC ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={goToday} style={headerBtnStylePC}>今日</button>
                <button onClick={goPrev} style={headerBtnStylePC}>前週</button>
                <button onClick={goNext} style={headerBtnStylePC}>次週</button>
              </div>

              {/* 🚀 🆕 修正：入力欄を消して、ポップアップを呼ぶボタンを設置 */}
              <button 
                onClick={() => {
                  fetchAllCustomersForSearch(); // 50音順リストをDBから取得
                  setShowMobileSearchModal(true); // ポップアップを開く
                }} 
                style={{ 
                  ...headerBtnStylePC, 
                  marginLeft: '10px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '10px 20px',
                  background: '#f8fafc',
                  color: themeColor
                }}
              >
                <Search size={18} />
                <span>顧客を検索</span>
              </button>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 0 auto', fontWeight: '900', color: '#1e293b' }}>{startDate.getFullYear()}年 {startDate.getMonth() + 1}月</h2>
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
            <th style={{ width: isPC ? '80px' : '55px', borderBottom: '0.5px solid #cbd5e1' }}></th>
            {weekDays.map(date => {
              const isToday = getJapanDateStr(new Date()) === getJapanDateStr(date);
              return (
                <th key={date.toString()} style={{ padding: '4px 0', borderBottom: '0.5px solid #cbd5e1' }}>
                  <div style={{ fontSize: '0.6rem', color: isToday ? themeColor : '#666' }}>{['日','月','火','水','木','金','土'][date.getDay()]}</div>
                  <div style={{ fontSize: isPC ? '1.5rem' : '0.9rem', fontWeight: 'bold', color: isToday ? '#fff' : '#333', background: isToday ? themeColor : 'none', width: isPC ? '40px' : '22px', height: isPC ? '40px' : '22px', borderRadius: '50%', margin: '2px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{date.getDate()}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(time => (
            <tr key={time} style={{ height: '60px' }}>
              {/* 左端の時間軸 */}
              <td style={{ borderRight: '0.5px solid #cbd5e1', borderBottom: '0.5px solid #cbd5e1', textAlign: 'center', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>{time}</span>
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
                  new Date(r.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }) === time
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
                    /* 🚀 🆕 【ここから修正箇所】 */
                    onClick={async () => { 
                      setSelectedDate(dStr); 
                      setTargetTime(time);
                      
                      const firstItem = Array.isArray(resAt) ? resAt[0] : resAt;
                      
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

                      // 🚀 施設訪問の本予約（実体）への対応
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
                      else if (activeTask.res_type === 'facility_keep') {
                        handleCancelKeep(activeTask.facility_user_id, dStr, activeTask.customer_name.replace(' 予定', ''));
                      }
                      else if (activeTask.res_type === 'normal' || activeTask.res_type === 'blocked' || activeTask.res_type === 'private_task') {
                        openDetail(activeTask); 
                      }
                    }}
                    /* 🚀 🆕 【ここまで修正箇所】 */
                    style={{ 
                      borderRight: '0.1px solid #cbd5e1', 
                      borderBottom: '0.1px solid #cbd5e1', 
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
    
    // --- 🏢 施設訪問の場合 ---
    if (res.res_type === 'facility_visit') {
      return (
        <div style={{ display: 'flex', flexDirection: isPC ? 'row' : 'column', alignItems: 'center', gap: '4px', color: '#4f46e5' }}>
          <Building2 size={isPC ? 16 : 12} strokeWidth={2.5} />
          {/* ✅ 施設名のみ表示（金額を削除しました） */}
          <span style={{ fontSize: isPC ? '0.8rem' : '0.65rem', fontWeight: 'bold' }}>
            {isPC ? res.customer_name : res.customer_name.slice(0, 4)}
          </span>
        </div>
      );
    }

    // --- 👤 個人・プライベート予定の場合 ---
    const masterName = res.res_type === 'private_task' ? res.customer_name : (res.customers?.name || res.customer_name);
    const name = masterName?.split(/[\s　]+/)[0] || "名前なし";
    const countSuffix = reservationCount > 1 ? ` (${reservationCount}名)` : (res.res_type === 'private_task' ? "" : " 様");

    // 🚀 🆕 追加：biz_type（識別キー）を使って、専用屋号を取得する
    const brandLabel = categoryMap[res.biz_type];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
        
        {/* 🚀 🆕 追加：屋号バッジの表示（識別キーがセットされている場合のみ） */}
        {brandLabel && (
          <div style={{ 
            fontSize: '0.6rem', 
            padding: '1px 5px', 
            borderRadius: '4px', 
            marginBottom: '3px',
            // キーによって色を分けるとさらに見やすいです
            background: res.biz_type === 'foot' ? '#4285f4' : '#d34817', 
            color: '#fff', 
            fontWeight: '900', 
            transform: 'scale(0.85)',
            whiteSpace: 'nowrap'
          }}>
            {brandLabel.slice(0, 5)} {/* 長い場合は5文字でカット */}
          </div>
        )}

        {isPC ? (
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
  {name}{countSuffix}
  {/* 🚀 🆕 カレンダー上にも 🚫 を出す */}
  {res.customers?.is_blocked && <span style={{ color: '#ef4444' }}>🚫</span>}
  {res.customers?.cancel_count >= 3 && <span style={{ color: '#ef4444' }}>‼️</span>}
</span>
        ) : (
          <span style={{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: '0.75rem', fontWeight: 'bold' }}>{name}</span>
        )}
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

{(showCustomerModal || showDetailModal) && (
        <div onClick={() => { if(selectedRes?.isRegularHoliday) return; setShowCustomerModal(false); setShowDetailModal(false); }} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '650px', position: 'relative' }}>
            
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
                 👤 パターンB：通常予約（リッチな顧客カルテ ＆ 履歴）
                 ========================================== */
              <div style={{ display: 'grid', gridTemplateColumns: isPC ? '1fr 1fr' : '1fr', gap: '25px' }}>
                
                {/* 📝 左側：入力フォーム一式 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    
                    {/* 📋 予約メニュー内訳 */}
                    <div style={{ background: themeColorLight, padding: '16px', borderRadius: '15px', marginBottom: '20px', border: `1px solid ${themeColor}` }}>
      {/* 🆕 事業名の表示を追加 */}
      {categoryMap[selectedRes?.category] && (
        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
          🏢 受付事業：{categoryMap[selectedRes?.category]}
        </div>
      )}
      
      <label style={{ fontSize: '0.75rem', fontWeight: '900', color: themeColor, display: 'block', marginBottom: '10px' }}>📋 予約・会計内訳</label>
      <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{selectedRes?.menu_name || 'メニュー未設定'}</div>
      
      {/* 🚀 🆕 会計済みの商品があればここに表示 */}
      {(() => {
        const details = parseReservationDetails(selectedRes);
        return details.products?.length > 0 && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(0,0,0,0.1)', fontSize: '0.85rem', color: '#008000', fontWeight: 'bold' }}>
            🛍 購入商品: {details.products.map(p => `${p.name} (x${p.quantity})`).join(', ')}
          </div>
        );
      })()}
    </div>

                    {/* 🆕 修正：ここから動的フォーム（順番固定版） */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        // 🏆 三土手さん理想の表示順を定義
                        const fieldOrder = [
                          'name', 'furigana', 'email', 'phone', 
                          'zip_code', 'address', 'parking', 
                          'building_type', 'care_notes', 'company_name', 
                          'symptoms', 'request_details'
                        ];

                        return fieldOrder.map((key) => {
  // 表示判定（基本4項目 or 必須設定項目）
  if (!shouldShowInAdmin(key)) return null;

  return (
    <div key={key}>
      {/* 🆕 ラベルとショートカットボタンを横並びにするコンテナ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{getFieldLabel(key)}</label>

        {/* 📞 電話をかけるボタン (phoneかつデータがある時のみ) */}
        {key === 'phone' && editFields.phone && (
          <a 
            href={`tel:${editFields.phone}`}
            style={{ 
              textDecoration: 'none', 
              background: '#10b981', 
              color: '#fff', 
              padding: '2px 8px', 
              borderRadius: '6px', 
              fontSize: '0.65rem', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 4px rgba(16,185,129,0.2)'
            }}
          >
            <span>電話をかける</span> 📞
          </a>
        )}

        {key === 'name' && editFields.line_user_id && (
                              <span style={badgeStyle('#06C755')}>LINE連携済み ✅</span>
                            )}

        {/* 📍 マップを開くボタン (addressかつデータがある時のみ) */}
        {key === 'address' && editFields.address && (
  <a 
    /* 🚀 修正ポイント：公式の検索URLに変更し、${ } で住所を囲む */
    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editFields.address)}`}
    target="_blank" 
    rel="noopener noreferrer"
    style={{ 
      textDecoration: 'none', 
      background: '#3b82f6', 
      color: '#fff', 
      padding: '2px 8px', 
      borderRadius: '6px', 
      fontSize: '0.65rem', 
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      boxShadow: '0 2px 4px rgba(59,130,246,0.2)'
    }}
  >
    <span>マップで開く</span> 📍
  </a>
)}
      </div>

      {/* 💡 入力欄はスッキリ配置 */}
      {key === 'parking' ? (
  <select 
    disabled={editFields.is_facility} 
    value={editFields[key] || ''} 
    onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} 
    style={{ 
      ...inputStyle, 
      background: editFields.is_facility ? '#f1f5f9' : '#fff',
      cursor: editFields.is_facility ? 'not-allowed' : 'pointer'
    }}
  >
    {/* 🚀 ここに具体的な選択肢を復活させます */}
    <option value="">未選択</option>
    <option value="あり">あり</option>
    <option value="なし">なし</option>
  </select>
) : (
    <input 
      type="text" 
      readOnly={editFields.is_facility} // 👈 施設なら入力不可
      value={editFields[key] || ''} 
      onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} 
      style={{ 
        ...inputStyle, 
        background: editFields.is_facility ? '#f1f5f9' : '#fff', // 👈 グレーアウト
        cursor: editFields.is_facility ? 'not-allowed' : 'text'   // 👈 禁止マーク
      }} 
      placeholder="未登録"
    />
  )}
    </div>
  );
});
                      })()}

                      {/* 🆕 カスタム質問（ラジオボタン）の回答表示セクション */}
                      {shop?.form_config?.custom_questions?.map((q) => {
                        // 💡 editFields.custom_answers から回答を抽出
                        const answer = editFields.custom_answers?.[q.id];
                        // 必須である、または回答がある場合のみ表示
                        if (q.required || answer) {
                          return (
                            <div key={q.id} style={{ 
                              background: '#fff', 
                              padding: '12px', 
                              borderRadius: '12px', 
                              border: q.required ? `2px solid ${themeColor}33` : '1px solid #e2e8f0',
                              marginTop: '5px'
                            }}>
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

                      {/* 顧客メモ（マスタ共通）は常に一番下 */}
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

                    {/* 🆕 2段構えの削除・キャンセルエリア */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <button 
  // 🚀 すでにキャンセル済みならボタンを無効化
  onClick={() => selectedRes?.status !== 'canceled' && cancelRes(selectedRes.id)} 
  disabled={selectedRes?.status === 'canceled'}
  style={{ 
    padding: '12px', 
    // 🚀 キャンセル済みなら灰色背景、そうでなければ白背景
    background: selectedRes?.status === 'canceled' ? '#f1f5f9' : '#fff', 
    // 🚀 キャンセル済みなら灰色文字、そうでなければ茶色文字
    color: selectedRes?.status === 'canceled' ? '#94a3b8' : '#8d5c08', 
    border: `1px solid ${selectedRes?.status === 'canceled' ? '#e2e8f0' : '#8d5c08'}`, 
    borderRadius: '10px', 
    fontWeight: 'bold', 
    cursor: selectedRes?.status === 'canceled' ? 'default' : 'pointer', 
    fontSize: '0.8rem' 
  }}
>
  {selectedRes?.status === 'canceled' ? 'キャンセル済み' : '当日キャンセル'}
</button>
                      <button 
                        onClick={() => deleteRes(selectedRes.id)} 
                        style={{ padding: '12px', background: '#e0dddd8d', color: '#780606', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        消去 & 掃除
                      </button>
                    </div>
                  </div>
                </div>

                {/* 🕒 右側：来店履歴エリア */}
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b' }}>🕒 来店履歴 ＆ 予定</h4>
                  <div style={{ height: isPC ? '420px' : '250px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '15px', background: '#f8fafc', padding: '5px' }}>
                    {(() => {
                      // 🚀 1. 施設の場合：月ごとにグルーピングして表示
                      if (editFields.is_facility === true || selectedRes?.res_type === 'facility_visit') {
                        const groups = {};
                        customerHistory.forEach(h => {
                          if (h.status === 'canceled') return; // キャンセル分はまとめに含めない
                          const d = new Date(h.start_time);
                          const monthKey = `${d.getFullYear()}年${d.getMonth() + 1}月`;
                          if (!groups[monthKey]) groups[monthKey] = { month: monthKey, visits: [] };
                          groups[monthKey].visits.push(h);
                        });

                        return Object.values(groups).map((group) => (
                          <div key={group.month} style={{ 
                            background: '#fff', border: '1px solid #e0e7ff', borderRadius: '16px', 
                            padding: '15px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(79,70,229,0.05)' 
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                              <span style={{ fontWeight: '900', color: '#4f46e5', fontSize: '1rem' }}>{group.month}度 訪問</span>
                              <span style={{ fontSize: '0.65rem', background: '#f5f3ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                完了
                              </span>
                            </div>
                            
                            {/* 📅 実施日を「・」で繋いで横並びにする */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', paddingLeft: '5px' }}>
                              {group.visits.sort((a,b) => new Date(a.start_time) - new Date(b.start_time)).map((v, i) => {
                                const date = new Date(v.start_time);
                                const dayName = ['日','月','火','水','木','金','土'][date.getDay()];
                                return (
                                  <span key={v.id} style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>
                                    {date.getDate()}日({dayName}){i < group.visits.length - 1 ? ' ・ ' : ''}
                                  </span>
                                );
                              })}
                            </div>

                            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clipboard size={14} /> 施設訪問 施術一式
                            </div>
                          </div>
                        ));
                      }

                      // 🚀 2. 個人の場合：従来通りの1件ずつ詳細表示
                      return customerHistory.map((h, idx) => {
                        const hDate = new Date(h.start_time);
                        const isToday = hDate.toLocaleDateString('sv-SE') === new Date().toLocaleDateString('sv-SE');
                        const isCanceled = h.status === 'canceled';

                        return (
                          <div 
                            key={h.id} 
                            // 🚀 🆕 修正：キャンセル分以外はタップで詳細を開く
                            onClick={() => !isCanceled && openHistoryDetail(h)}
                            style={{ 
                              padding: '15px', borderBottom: '1px solid #eee', 
                              background: isCanceled ? '#fcfcfc' : '#fff', 
                              borderRadius: isToday ? '12px' : '0', 
                              border: isToday ? `2px solid ${themeColor}` : 'none',
                              opacity: isCanceled ? 0.7 : 1, position: 'relative',
                              cursor: isCanceled ? 'default' : 'pointer' // 👈 指マークを追加
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: isCanceled ? '#94a3b8' : '#1e293b', textDecoration: isCanceled ? 'line-through' : 'none' }}>
                                  {hDate.toLocaleDateString('ja-JP')}
                                </span>
                                {isCanceled && <span style={{ fontSize: '0.6rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px' }}>キャンセル</span>}
                              </div>
                              <span style={{ color: isCanceled ? '#94a3b8' : '#e11d48', fontWeight: 'bold', fontSize: '0.9rem', textDecoration: isCanceled ? 'line-through' : 'none' }}>
                                ¥{(h.total_price || parseReservationDetails(h).totalPrice).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ color: isCanceled ? '#cbd5e1' : '#475569', fontSize: '0.8rem', textDecoration: isCanceled ? 'line-through' : 'none' }}>{h.menu_name}</div>

                            {/* 🚀 🆕 ここに追加：商品と調整の表示ロジック */}
                            {(() => {
                              // 各履歴データ(h)を最新の解析ロジックで読み込む
                              const details = parseReservationDetails(h);
                              return (
                                <>
                                  {/* 🛍 商品購入がある場合（緑色） */}
                                  {details.products?.length > 0 && (
                                    <div style={{ 
                                      marginTop: '5px', fontSize: '0.75rem', 
                                      color: isCanceled ? '#cbd5e1' : '#008000', 
                                      fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' 
                                    }}>
                                      <span>🛍 商品: {details.products.map(p => `${p.name}${p.quantity > 1 ? `(x${p.quantity})` : ''}`).join(', ')}</span>
                                    </div>
                                  )}

                                  {/* ⚙️ 調整（割引・加算）がある場合（赤色） */}
                                  {details.adjustments?.length > 0 && (
                                    <div style={{ 
                                      marginTop: '3px', fontSize: '0.75rem', 
                                      color: isCanceled ? '#cbd5e1' : '#ef4444', 
                                      fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' 
                                    }}>
                                      <span>⚙️ 調整: {details.adjustments.map(a => `${a.name}${a.is_percent ? `(${a.price}%)` : ''}`).join(', ')}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        );
                      });
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

{/* 👥 2. 予約者選択リストModal (複数予約がある場合に表示) */}
      {showSlotListModal && (
        <div onClick={() => setShowSlotListModal(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '450px', textAlign: 'center', background: '#f8fafc', padding: '25px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
              <p style={{ fontWeight: '900', color: themeColor, fontSize: '1.8rem', margin: 0 }}>{targetTime} の予約</p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>詳細を見たい方を選択してください</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto', padding: '5px' }}>
              {/* 🆕 最上部：ねじ込み予約ボタン (リストModal版) */}
              <div 
  onClick={() => {
    setShowSlotListModal(false);
    navigate(`/shop/${shopId}/reserve`, { 
      state: { 
        adminDate: selectedDate, 
        adminTime: targetTime, 
        fromView: 'calendar', // ✅ カレンダーから来た目印
        isAdminMode: true,
        adminStaffId: staffs.length === 1 ? staffs[0].id : null
      } 
    });
  }}
                style={{
                  background: themeColor,
                  padding: '18px',
                  borderRadius: '18px',
                  border: `2px solid ${themeColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: 'bold',
                  boxShadow: `0 4px 12px ${themeColor}44`,
                  marginBottom: '10px'
                }}
              >
                ➕ 新しい予約をねじ込む
              </div>

              {selectedSlotReservations.map((res, idx) => (
                <div key={res.id || idx} onClick={() => { setShowSlotListModal(false); openDetail(res); }} style={{ background: '#fff', padding: '18px', borderRadius: '18px', border: `1px solid #e2e8f0`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <div style={{ textAlign: 'left', flex: 1 }}>
<div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1e293b', marginBottom: '4px' }}>
  {/* 🚀 🆕 修正：プライベート予定(private_task)の時も「様」を外す */}
  {(res.res_type === 'blocked' || res.res_type === 'private_task') 
    ? `${res.res_type === 'blocked' ? '🚫' : '☕️'} ${res.customer_name}` 
    : `👤 ${res.customers?.admin_name || res.customer_name} 様`}
</div>
<div style={{ fontSize: '0.75rem', color: '#64748b' }}>
  {res.res_type === 'normal' ? (
    <>
      <div style={{ color: themeColor, fontWeight: 'bold' }}>📋 {res.menu_name || res.options?.services?.map(s => s.name).join(', ') || 'メニュー未設定'}</div>
      <div style={{ marginTop: '2px' }}>👤 担当: {res.staffs?.name || '店舗スタッフ'}</div>
    </>
  ) : 'スケジュールブロック'}
</div>
                  </div>
                  <div style={{ color: themeColor, fontSize: '1.2rem' }}>〉</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSlotListModal(false)} style={{ marginTop: '25px', padding: '12px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>

            {!isPC && (
              <button 
                onClick={() => setShowSlotListModal(false)} 
                style={{ 
                  position: 'fixed', 
                  bottom: '30px', 
                  left: '50%', 
                  transform: 'translateX(-50%)', 
                  background: '#1e293b', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '12px 40px', 
                  borderRadius: '50px', 
                  fontWeight: 'bold', 
                  boxShadow: '0 10px 20px rgba(0,0,0,0.3)', 
                  zIndex: 4000 
                }}
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
                          adminStaffId: staffs.length === 1 ? staffs[0].id : null
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

        return (
          <div style={{ background: '#fcfaf7', padding: '15px', borderRadius: '15px', border: '1px solid #f0e6d2', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#948b83', fontWeight: 'bold', marginBottom: '5px' }}>施術の進捗状況</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#3d2b1f' }}>
              残り <span style={{ color: '#c5a059', fontSize: '2rem' }}>{remaining}</span> 名 / 全体 {total} 名
            </div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '5px', fontWeight: 'bold' }}>
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
          .filter(r => r.status === 'pending') // 💡 未完了の人だけリストに出す（スッキリ！）
          .map((item, idx) => (
            <div key={idx} style={{ background: '#fff', padding: '10px 15px', borderRadius: '10px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' }}>{item.members?.name} 様</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.members?.room}号室</div>
              </div>
              <span style={{ fontSize: '0.8rem', color: themeColor, fontWeight: 'bold' }}>{item.menu_name}</span>
            </div>
        ))}
        {visitResidents.filter(r => r.status === 'pending').length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>すべて完了しました！✨</div>
        )}
      </div>

      <button onClick={() => setShowVisitDetailModal(false)} style={{ width: '100%', marginTop: '20px', padding: '15px', background: '#3d2b1f', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
        詳細を閉じる
      </button>
    </div>
  </div>
)}

{/* 🚀 🆕 追加：施設予約キャンセル確認モーダル */}
{showFacCancelModal && facCancelTarget && (
  <div style={overlayStyle} onClick={() => setShowFacCancelModal(false)}>
    <div 
      onClick={(e) => e.stopPropagation()} 
      style={{ ...modalContentStyle, maxWidth: '380px', textAlign: 'center', padding: '35px' }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>⚠️</div>
      <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontWeight: '900', fontSize: '1.2rem' }}>予定のキャンセル確認</h3>
      
      <div style={{ background: '#fff1f2', padding: '15px', borderRadius: '15px', border: '1px solid #fecdd3', marginBottom: '20px' }}>
        <p style={{ fontSize: '0.85rem', color: '#e11d48', margin: 0, fontWeight: 'bold', lineHeight: '1.6' }}>
          {facCancelTarget.date.replace(/-/g, '/')} の<br/>
          <span style={{ fontSize: '1.1rem', color: '#b91c1c' }}>{facCancelTarget.name} 様</span><br/>
          予定をキャンセルして枠を空けますか？
        </p>
      </div>

      <div style={{ textAlign: 'left', marginBottom: '25px' }}>
        <label style={labelStyle}>解除パスワード（1234）</label>
        <input 
          type="password" 
          inputMode="numeric"
          placeholder="数字4桁を入力"
          value={facCancelPass}
          onChange={(e) => setFacCancelPass(e.target.value)}
          style={{ ...inputStyle, textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.3em', marginBottom: 0, border: `2px solid ${themeColor}44` }}
        />
        <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
          ※誤操作防止のためパスワードが必要です
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button 
          onClick={executeFacCancel}
          style={{ width: '100%', padding: '16px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,29,72,0.2)' }}
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
    <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '95%', width: '450px', padding: '20px 10px', borderRadius: '30px' }}>
      
      {/* 🚩 ここから下の「年月ナビ」を差し替えます！ */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px', 
        padding: '10px 5px',
        background: '#f8fafc', 
        borderRadius: '15px'
      }}>
        {/* 前の月ボタン */}
        <button 
          onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth() - 1)))} 
          style={{ 
            border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderRadius: '12px', width: '50px', height: '50px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', color: themeColor, cursor: 'pointer'
          }}
        >
          ◀
        </button>

        {/* 年月表示 */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold' }}>{viewMonth.getFullYear()}年</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b' }}>{viewMonth.getMonth() + 1}月</div>
        </div>

        {/* 次の月ボタン */}
        <button 
          onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth() + 1)))} 
          style={{ 
            border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderRadius: '12px', width: '50px', height: '50px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', color: themeColor, cursor: 'pointer'
          }}
        >
          ▶
        </button>
      </div>
      {/* 🚩 ここまで差し替え */}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
              {['月','火','水','木','金','土','日'].map(d => (
                <div key={d} style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '10px' }}>{d}</div>
              ))}
              {miniCalendarDays.map((date, i) => {
                if (!date) return <div key={i} />;
                const dStr = getJapanDateStr(date);
                const isSelected = dStr === selectedDate;
                const isToday = dStr === getJapanDateStr(new Date());
                const summary = getDayEventSummary(date);

                // 🎨 予定に応じた丸の色を決定
                let circleColor = 'transparent';
                if (summary.hasReservation) circleColor = themeColor; // 予約
                else if (summary.hasFacility) circleColor = '#4f46e5'; // 施設
                else if (summary.hasPrivate) circleColor = '#64748b'; // プライベート

                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setStartDate(date);
                      setSelectedDate(dStr);
                      setShowMobileCalendar(false);
                      setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                    }}
                    style={{ 
                      padding: '5px 0 10px', cursor: 'pointer', borderRadius: '12px',
                      background: summary.isHoliday ? '#f1f5f9' : 'none', // 休日グレー
                      opacity: summary.isHoliday ? 0.6 : 1,
                      minHeight: '65px' // 👈 高さを固定して名前が入っても崩れないようにする
                    }}
                  >
                    {/* 💡 日付の丸囲み部分 */}
                    <div style={{
                      width: '28px', height: '28px', margin: '0 auto',
                      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1rem', fontWeight: 'bold',
                      background: isSelected ? themeColor : (isToday ? themeColorLight : 'none'),
                      color: isSelected ? '#fff' : (isToday ? themeColor : (summary.isHoliday ? '#94a3b8' : '#1e293b')),
                      border: !isSelected && circleColor !== 'transparent' ? `2px solid ${circleColor}` : 'none'
                    }}>
                      {date.getDate()}
                    </div>

                    {/* 💡 予定の名前を小さく表示 */}
                    <div style={{ 
                      fontSize: '0.55rem', 
                      fontWeight: 'bold', 
                      marginTop: '4px', 
                      color: circleColor === 'transparent' ? '#94a3b8' : circleColor,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      padding: '0 2px'
                    }}>
                      {summary.firstEntry ? summary.firstEntry.name.slice(0, 4) : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={() => setShowMobileCalendar(false)}
              style={{ width: '100%', marginTop: '20px', padding: '15px', background: '#f1f5f9', border: 'none', borderRadius: '15px', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}
            >
              閉じる
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