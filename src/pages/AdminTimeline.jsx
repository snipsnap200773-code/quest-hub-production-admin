import React, { useEffect, useState, useMemo, useRef } from 'react';
// 🚀 🆕 motion, AnimatePresence を追加
import { motion, AnimatePresence } from 'framer-motion'; 
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ChevronLeft, ChevronRight, Users, Calendar as CalendarIcon, 
  X, Clipboard, User, FileText, History, CheckCircle, Trash2,
  ShoppingBag, Scissors, Settings, Search, 
  PackageOpen, // 👈 🌟 🆕 追加：在庫管理アイコン
  BarChart3 // 🚀 🆕 追加：ボトムナビ用アイコン
} from 'lucide-react';

// 🆕 予約者名から固有のパステルカラーを生成するロジック
const getCustomerColor = (name) => {
  if (!name || name === '定休日' || name === '臨時休業') return { bg: '#f1f5f9', border: '#cbd5e1', line: '#94a3b8', text: '#64748b' };
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
// --- [30行目付近] ---
  };
};

// 🚀 🆕 修正：レジ確定後のデータを最優先し、単価も保持する版
const parseReservationDetails = (res) => {
  if (!res) return { menuName: '', totalPrice: 0, items: [], subItems: [], products: [], adjustments: [] };
  const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
  
  const products = opt.products || [];
  const adjustments = opt.adjustments || [];
  let items = [];
  let subItems = [];

  // 💡 レジ確定データがあればそれを最優先で採用
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

  return { 
    menuName: fullMenuName, 
    totalPrice: Math.max(0, Math.round(basePrice + optPrice + productPrice + adjAmount)), 
    items, subItems, products, adjustments 
  };
};

// 🆕 追加：定休日かどうかを判定するヘルパー関数（エラー解決用）
const isShopHoliday = (shop, date) => {
  if (!shop?.business_hours?.regular_holidays) return false;
  const holidays = shop.business_hours.regular_holidays || {};
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
  
  const isRegular = !!(holidays[`${nthWeek}-${dayName}`] || (isLastWeek && holidays[`L1-${dayName}`]) || (isSecondToLastWeek && holidays[`L2-${dayName}`]));
  if (isRegular) return true;

  if (shop.special_holidays && Array.isArray(shop.special_holidays)) {
    const dStr = date.toLocaleDateString('sv-SE');
    const isSpecial = shop.special_holidays.some(h => dStr >= h.start && dStr <= h.end);
    if (isSpecial) return true;
  }
  return false;
};

// 🚀 🆕 ここに追加！：フリガナから「あ行・か行...」を判定する関数
const getKanaGroup = (kana) => {
  if (!kana) return "その他";
  const firstChar = kana.charAt(0);
  if (firstChar.match(/[あ-おア-オ]/)) return "あ行";
  if (firstChar.match(/[か-こカ-コ]/)) return "か行";
  if (firstChar.match(/[さ-そサ-ソ]/)) return "さ行";
  if (firstChar.match(/[た-とタ-ト]/)) return "た行";
  if (firstChar.match(/[な-のナ-ノ]/)) return "な行";
  if (firstChar.match(/[は-ほハ-ホ]/)) return "は行";
  if (firstChar.match(/[ま-もマ-モ]/)) return "ま行";
  if (firstChar.match(/[や-よヤ-ヨ]/)) return "や行";
  if (firstChar.match(/[ら-ろラ-ロ]/)) return "ら行";
  if (firstChar.match(/[わ-をワ-ヲ]/)) return "わ行";
  return "その他";
};

function AdminTimeline() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  // --- 状態管理 ---
  const location = useLocation(); // 🚀 🆕 追加
  const [shop, setShop] = useState(null);
  const [staffs, setStaffs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 👇 🌟 🆕 ここから追加：アラート用のState（変数）と裏方関数たち
  const [irregularKeeps, setIrregularKeeps] = useState([]);
  const [urgentKeeps, setUrgentKeeps] = useState([]);
  const [timeChangedKeeps, setTimeChangedKeeps] = useState([]);
  const [dismissedKeeps, setDismissedIrregularIds] = useState(() => {
    const saved = localStorage.getItem(`dismissed_keeps_${shopId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [alertModalMode, setAlertModalMode] = useState(null);
  const [message, setMessage] = useState('');

  const showMsg = (txt) => { 
    setMessage(txt); 
    setTimeout(() => setMessage(''), 3000); 
  };

  const markKeepAsDismissed = (id) => {
    if (!id || dismissedKeeps.includes(id)) return;
    const newDismissed = [...dismissedKeeps, id];
    setDismissedIrregularIds(newDismissed);
    localStorage.setItem(`dismissed_keeps_${shopId}`, JSON.stringify(newDismissed));
  };

  const handleEmailNudge = async (keep) => {
    if (!window.confirm(`${keep.facility_users?.facility_name} 様へ、名簿作成の催促メールを送信しますか？`)) return;
    try {
      showMsg("メールを送信中...");
      const { error } = await supabase.functions.invoke('resend', {
        body: { type: 'facility_nudge', shopId, facilityId: keep.facility_user_id, keepDate: keep.date, shopName: shop?.business_name, ownerName: shop?.owner_name }
      });
      if (error) throw error;
      showMsg("催促メールを送信しました！📬");
    } catch (err) {
      alert("送信に失敗しました: " + err.message);
    }
  };

  const handleForceDeleteKeep = async (keep) => {
    const facilityName = keep.facility_users?.facility_name || "施設";
    if (!window.confirm(`【強制キャンセル】\n${facilityName} 様の ${keep.date.replace(/-/g, '/')} のキープ枠を強制的に削除しますか？\nこの操作は取り消せません。`)) return;
    setLoading(true);
    try {
      if (keep.isRegular) {
        await supabase.from('regular_keep_exclusions').upsert([{ facility_user_id: keep.facility_user_id, shop_id: shopId, excluded_date: keep.date }]);
        if (!String(keep.id).startsWith('reg-')) await supabase.from('keep_dates').delete().eq('id', keep.id);
      } else {
        const { error } = await supabase.from('keep_dates').delete().eq('id', keep.id);
        if (error) throw error;
      }
      showMsg("キープ枠を強制的に解放しました。");
      fetchData();
    } catch (err) {
      alert("解除に失敗しました: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  // 👆 追加ここまで

  // 🚀 🆕 修正：URLパラメータに日付があればそれを優先して初期表示する
  const [selectedDate, setSelectedDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    return dateParam || new Date().toLocaleDateString('sv-SE');
  });
  const [categoryMap, setCategoryMap] = useState({});

  // 🚀 🆕 追加：画面遷移で戻ってきた時にURLの日付パラメータを検知して更新する
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date');
    if (dateParam && dateParam !== selectedDate) {
      setSelectedDate(dateParam);
    }
  }, [location.search]);
  
  // モーダル・操作用
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [targetTime, setTargetTime] = useState('');
  const [targetStaffId, setTargetStaffId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRes, setSelectedRes] = useState(null);
  
  // 🚀 🆕 メニュー移植のために追加する2行
  const [showBlockEndSelector, setShowBlockEndSelector] = useState(false); 
  const [isTargetOutsideHours, setIsTargetOutsideHours] = useState(false); 

  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);

  // 🚀 🆕 ここから追加：検索＆カレンダーポップアップ用のState
  const [showMobileCalendar, setShowMobileCalendar] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date()); 
  const [showMobileSearchModal, setShowMobileSearchModal] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const touchStartX = useRef(0);

  const [expandedYears, setExpandedYears] = useState({});

  // 🆕 重複予約リスト用
  const [showSlotListModal, setShowSlotListModal] = useState(false);
  const [selectedSlotReservations, setSelectedSlotReservations] = useState([]);

  // ✅ 🆕 追加：プライベート予定用のState
  const [privateTasks, setPrivateTasks] = useState([]);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [privateTaskFields, setPrivateTaskFields] = useState({ title: '', note: '' });

  // 👤 顧客詳細用（ここがコメントアウトされていました）
const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [customerHistory, setCustomerHistory] = useState([]);

  // 👇 🌟 🆕 ここから追加：ハイブリッド店舗用のフィルターロジック
  const [activeFilter, setActiveFilter] = useState('all'); 
  
  // 👇 🌟 🆕 追加：訪問フィルターが選択されているかどうかの判定（これが抜けてエラーになっていました！）
  const isVisitFilter = activeFilter.includes('訪問') || activeFilter.includes('出張');

  // 店舗が持っている業種を配列化
  const shopIndustries = useMemo(() => {
    if (!shop?.business_type) return [];
    return shop.business_type.split(',').map(s => s.trim()).filter(Boolean);
  }, [shop]);

  // 選択されたタブに応じてスタッフを絞り込む
  const filteredStaffs = useMemo(() => {
    if (activeFilter === 'all') return staffs;
    return staffs.filter(s => {
      // 担当業種が未設定のスタッフは「全対応」として常に表示
      if (!s.capable_categories || s.capable_categories.length === 0) return true;
      return s.capable_categories.includes(activeFilter);
    });
  }, [staffs, activeFilter]);
  // 👆 追加ここまで

// ✅ 🆕 修正：カレンダー版と同じフル項目セットに拡張
  const [editFields, setEditFields] = useState({ 
    name: '',
    admin_name: '', 
    furigana: '', phone: '', email: '', 
    address: '', parking: '', symptoms: '', request_details: '', 
    memo: '', line_user_id: null 
  });

  // ✅ 🆕 追加：カレンダー版からコピーしたヘルパー関数
  const shouldShowInAdmin = (key) => {
    // 1. 基本の4項目は常に表示
    const basicFields = ['name', 'furigana', 'email', 'phone'];
    if (basicFields.includes(key)) return true;
    // 2. それ以外は「必須」設定の場合のみ表示
    const cfg = shop?.form_config?.[key];
    return cfg?.required === true;
  };

  const getFieldLabel = (key) => shop?.form_config?.[key]?.label || key;
    
  // 🆕 名寄せ（マージ）確認用
  const [mergeCandidate, setMergeCandidate] = useState(null); 
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  // ドラッグスクロール用
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
// --- [100行目付近] ---
  const [hasMoved, setHasMoved] = useState(false);

  // ✅ 🆕 追加：この変数が抜けていたためエラーが出ていました
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // 🚀 🆕 追加：プレビューモードかどうかを判定し、スマホ幅として扱う
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('mode') === 'preview';
  const isPC = isPreviewMode ? false : windowWidth > 1024; 

  // 🚀 🆕 追加：日付移動の関数
  const goPrev = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toLocaleDateString('sv-SE')); };
  const goNext = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toLocaleDateString('sv-SE')); };
  const goToday = () => setSelectedDate(new Date().toLocaleDateString('sv-SE'));

  // 🚀 🆕 追加：ヘッダーボタンのスタイル
  const headerBtnStylePC = { padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' };

  useEffect(() => { fetchData(); }, [shopId, selectedDate]);

  // 🚀 🆕 追加：履歴カードをタップした時に詳細を開く命令
  const openHistoryDetail = (visit) => {
    setSelectedHistory(visit);
    setShowHistoryDetail(true);
  };

  const fetchData = async () => {
    setLoading(true);
    // 1. 店舗プロフィール取得
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (profile) setShop(profile);

    // 🚀 🆕 追加：カテゴリと専用屋号のリストを取得してマップを作る
    const { data: catData } = await supabase
      .from('service_categories')
      .select('name, url_key, custom_shop_name')
      .eq('shop_id', shopId);
    
    const shopNameMap = {};
    catData?.forEach(c => {
      if (c.url_key) shopNameMap[c.url_key] = c.custom_shop_name || c.name;
    });
    setCategoryMap(shopNameMap);

    // 2. スタッフ一覧取得
    const { data: staffsData } = await supabase
      .from('staffs')
      .select('*')
      .eq('shop_id', shopId)
      .eq('role_type', 'stylist') // 🚀 🆕 技術者(stylist)のみを表示し、アシスタントを除外
      .order('created_at', { ascending: true }); // 🚀 🆕 StaffSettingsと同じく「登録順」で表示
    setStaffs(staffsData || []);

// 3. 予約データ取得（担当者名結合）
    const { data: resData } = await supabase
      .from('reservations')
      .select('*, staffs(name), customers(*)')
      .eq('shop_id', shopId)
      .gte('start_time', `${selectedDate}T00:00:00`)
      .lte('start_time', `${selectedDate}T23:59:59`);

    // ✅ 🆕 追加：4. プライベート予定の取得
    const { data: privData } = await supabase
      .from('private_tasks')
      .select('*')
      .eq('shop_id', shopId)
      .gte('start_time', `${selectedDate}T00:00:00`)
      .lte('start_time', `${selectedDate}T23:59:59`);

    // 👇 🌟 🆕 追加：5. 施設用のキープと確定予約を取得し、担当者を紐付ける
    const [keepRes, visitRes, connRes] = await Promise.all([
      supabase.from('keep_dates').select('*, facility_users(facility_name)').eq('shop_id', shopId).eq('date', selectedDate),
      supabase.from('visit_requests').select('*, facility_users(facility_name)').eq('shop_id', shopId).eq('scheduled_date', selectedDate).neq('status', 'canceled'),
      // 🚀 アラート計算のために regular_rules と facility_users(*) を追加取得するように変更
      supabase.from('shop_facility_connections').select('facility_user_id, assigned_staff_id, regular_rules, facility_users(*)').eq('shop_id', shopId)
    ]);

    const getAssignedStaffId = (facId) => {
      const conn = connRes.data?.find(c => c.facility_user_id === facId);
      return conn?.assigned_staff_id || null; // 担当がいなければフリー(null)になる
    };

    const formattedKeeps = (keepRes.data || []).map(k => {
      // 👇 🌟 修正：秒数がついていても大丈夫なように先頭5文字だけを切り取り、日本時間（+09:00）を明記する
      const timeStr = (k.start_time || '09:00').substring(0, 5);
      const start = new Date(`${k.date}T${timeStr}:00+09:00`);
      const end = new Date(start.getTime() + 60 * 60000); // タイムライン上は1時間幅で表示
      
      return {
        id: `keep_${k.id}`,
        res_type: 'keep',
        customer_name: `[ｷｰﾌﾟ] ${k.facility_users?.facility_name || '施設'}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        staff_id: getAssignedStaffId(k.facility_user_id),
        biz_type: 'visit' 
      };
    });

    const formattedVisits = (visitRes.data || []).map(v => {
      // 👇 🌟 修正：秒数がついていても大丈夫なように先頭5文字だけを切り取り、日本時間（+09:00）を明記する
      const timeStr = (v.start_time || '09:00').substring(0, 5);
      const start = new Date(`${v.scheduled_date}T${timeStr}:00+09:00`);
      const end = new Date(start.getTime() + 60 * 60000); 
      
      return {
        id: `visit_${v.id}`,
        res_type: 'visit',
        customer_name: `[確定] ${v.facility_users?.facility_name || '施設'}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        staff_id: getAssignedStaffId(v.facility_user_id),
        biz_type: 'visit'
      };
    });

    // 全部ガッチャンコしてReservationsに入れる
    setReservations([...(resData || []), ...formattedKeeps, ...formattedVisits]);
    setPrivateTasks(privData || []); 

    // 👇 🌟 🆕 ここから追加：アラートバナー用の「未来の全データ」取得と集計ロジック
    const today = new Date();
    const todayStr = today.toLocaleDateString('sv-SE');
    const [allKeepRes, allVisitRes, exclRes] = await Promise.all([
      supabase.from('keep_dates').select('*, facility_users(*)').eq('shop_id', shopId).gte('date', todayStr),
      supabase.from('visit_requests').select('scheduled_date, facility_user_id, status').eq('shop_id', shopId).gte('scheduled_date', todayStr).neq('status', 'canceled'),
      supabase.from('regular_keep_exclusions').select('excluded_date').eq('shop_id', shopId)
    ]);

    const irregularList = []; const urgentList = []; const timeChangedList = []; const processedKeys = new Set();
    (allKeepRes.data || []).forEach(k => {
      processedKeys.add(`${k.facility_user_id}_${k.date}`);
      const isBooked = (allVisitRes.data || []).some(v => (v.status === 'confirmed' || v.status === 'completed') && v.facility_user_id === k.facility_user_id && v.scheduled_date === k.date);
      if (isBooked) return;
      const dObj = new Date(k.date);
      const diffDays = Math.round((dObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); 
      if (diffDays >= 0 && diffDays <= 3) urgentList.push({ ...k, diffDays });
      else irregularList.push({ ...k });
    });

    (connRes.data || []).forEach(conn => {
      if (!conn.regular_rules) return;
      let scanDate = new Date(today);
      for (let i = 0; i < 90; i++) {
        const dStr = scanDate.toLocaleDateString('sv-SE');
        const comboKey = `${conn.facility_user_id}_${dStr}`;
        if (!processedKeys.has(comboKey)) {
           const day = scanDate.getDay(); const dom = scanDate.getDate(); const m = scanDate.getMonth() + 1;
           const nthWeek = Math.ceil(dom / 7);
           const isLast = new Date(scanDate).getMonth() !== new Date(new Date(scanDate).setDate(dom + 7)).getMonth();
           let isRegular = conn.regular_rules.some(r => (r.monthType===0 || (r.monthType===1 && m%2!==0) || (r.monthType===2 && m%2===0)) && r.day===day && (r.week===nthWeek || (r.week===-1 && isLast)));
           if (isRegular && !exclRes.data?.some(e => e.excluded_date === dStr)) {
              const isBooked = (allVisitRes.data || []).some(v => v.facility_user_id === conn.facility_user_id && v.scheduled_date === dStr);
              if (!isBooked) {
                 const fakeKeep = { id: `reg-${conn.facility_user_id}-${dStr}`, date: dStr, facility_user_id: conn.facility_user_id, facility_users: conn.facility_users, isRegular: true };
                 const diffDays = Math.round((scanDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
    // 👆 アラート計算ここまで

    setLoading(false);
  };

  // =========================================================
  // 🚀 🆕 ここから追加：検索＆カレンダーを動かすためのロジック群
  // =========================================================
  const fetchAllCustomersForSearch = async () => {
    const { data } = await supabase.from('customers').select('*').eq('shop_id', shopId).order('furigana', { ascending: true });
    if (data) {
      const uniqueMap = new Map();
      data.forEach(c => {
        const nameKey = (c.name || "").trim();
        if (!uniqueMap.has(nameKey) || (c.address && !uniqueMap.get(nameKey).address)) uniqueMap.set(nameKey, c);
      });
      const blockNames = ['臨時休業', '管理者ブロック', '休憩', '銀行', '買い出し', '移動'];
      setAllCustomers(Array.from(uniqueMap.values()).filter(c => !blockNames.includes(c.name)));
    }
  };

  const openCustomerDetail = async (customer) => {
    setCustomerHistory([]); 
    const { data: latestCust } = await supabase.from('customers').select('*').eq('id', customer.id).maybeSingle();
    if (!latestCust) return;

    setEditFields({ 
      name: latestCust.name || '', admin_name: latestCust.admin_name || '', furigana: latestCust.furigana || '',
      phone: latestCust.phone || '', email: latestCust.email || '', address: latestCust.address || '',
      zip_code: latestCust.zip_code || '', parking: latestCust.parking || '', memo: latestCust.memo || '',
      line_user_id: latestCust.line_user_id || null, custom_answers: latestCust.custom_answers || {}
    });
    setSelectedCustomer(latestCust);
    setSelectedRes({ res_type: 'normal', customer_id: latestCust.id, customer_name: latestCust.name, status: 'completed' });

    const { data } = await supabase.from('reservations').select('*, staffs(name)').eq('shop_id', shopId)
      .or(`customer_id.eq.${latestCust.id},customer_name.eq.${latestCust.name}`).order('start_time', { ascending: false });
      
    setCustomerHistory(data || []);
    setSearchTerm('');
    setShowMobileSearchModal(false);
    setShowDetailModal(true);
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

  const getDayEventSummary = (date) => {
    if (!date) return { isHoliday: false, firstEntry: null };
    return { isHoliday: isShopHoliday(shop, date), firstEntry: null }; // タイムライン用の軽量版
  };
  // =========================================================
  // 🚀 🆕 追加ここまで
  // =========================================================

// 🆕 1. スカウター発動：予約をタップした瞬間に重複を検知
const openDetail = async (res) => {
  // 👇 🌟 🆕 追加：施設予約をタップした場合は案内を出してブロックする
  if (res.res_type === 'keep' || res.res_type === 'visit') {
    alert("施設訪問の詳細は「カレンダー画面」からご確認ください。");
    return;
  }

  setSelectedRes(res);
  setTargetStaffId(res.staff_id);

  // ✅ 🆕 修正：最初にあらかじめ cust を定義しておく
  let cust = null;

  if (res.res_type === 'private_task') {
    finalizeOpenDetail(res, null);
    return;
  }

  if (res.customer_id) {
    const { data: matched } = await supabase.from('customers').select('*').eq('id', res.customer_id).maybeSingle();
    cust = matched;
  }
  
  // 以降、電話番号等での検索ロジックへ続く...

  // もしIDでヒットしなかった場合のみ、既存のスカウター（電話・メール検索）を回す
  if (!cust) {
    const orConditions = [];
    if (res.customer_phone && res.customer_phone !== '---') orConditions.push(`phone.eq.${res.customer_phone}`);
    if (res.customer_email) orConditions.push(`email.eq.${res.customer_email}`);

    if (orConditions.length > 0) {
      const { data: matched } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .or(orConditions.join(','))
        .maybeSingle();
      cust = matched;
    }
  }

  // 判定：連絡先は一致するが、紐付いているIDが違う（名寄せが必要）
  if (cust && cust.id !== res.customer_id) {
    // ...以下、マージ確認ロジックへ
      setMergeCandidate(cust); 
      setShowMergeConfirm(true); 
      return; 
    }

    // 重複がない、または既に統合済みならそのまま表示へ
    finalizeOpenDetail(res, cust);
  };

  // 🆕 2. 統合実行：三土手さんが選んだ名前でマスタを確定
  const handleMergeAction = async (masterId, finalName) => {
    try {
      // 予約データの紐付け更新
      await supabase.from('reservations').update({ 
        customer_id: masterId,
        customer_name: finalName 
      }).eq('id', selectedRes.id);

      // マスタ側の名前も確定
      await supabase.from('customers').update({ 
        name: finalName,
        updated_at: new Date().toISOString()
      }).eq('id', masterId);

      setShowMergeConfirm(false);
      fetchData(); // 画面リロード
      finalizeOpenDetail(selectedRes, { ...mergeCandidate, name: finalName }); 
    } catch (err) {
      alert("統合に失敗しました");
    }
  };

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

    // 💡 2. 予約データ(res)の options カラムから詳細情報を引っ張り出す
    const visitInfo = res.options?.visit_info || {};

    // 🆕 3. 修正の核心：全ての項目 ＆ カスタム質問を State (editFields) にまとめる
    // 名簿データ(cust)を優先しつつ、予約時データ(visitInfo/res)で補完します
    const allFields = {
      name: cust ? (cust.admin_name || cust.name || res.customer_name) : res.customer_name,
      admin_name: cust?.admin_name || '',
      furigana: cust?.furigana || visitInfo.furigana || '',
      phone: cust?.phone || res.customer_phone || '',
      email: cust?.email || res.customer_email || '',
      zip_code: cust?.zip_code || visitInfo.zip_code || '', // 👈 郵便番号を追加
      address: cust?.address || visitInfo.address || '', 
      parking: cust?.parking || visitInfo.parking || '', 
      building_type: cust?.building_type || visitInfo.building_type || '', // 👈 建物種別を追加
      care_notes: cust?.care_notes || visitInfo.care_notes || '',           // 👈 介助状況を追加
      company_name: cust?.company_name || visitInfo.company_name || '',     // 👈 会社名を追加
      symptoms: cust?.symptoms || visitInfo.symptoms || '', 
      request_details: cust?.request_details || visitInfo.request_details || '', 
      memo: cust?.memo || '',
      line_user_id: cust?.line_user_id || res.line_user_id || null,
      // 💡 最重要：カスタム質問の回答をセット
      custom_answers: visitInfo.custom_answers || cust?.custom_answers || {}
    };

    // 💡 4. 作成した allFields を State に反映
    if (cust) {
      setSelectedCustomer(cust);
      setEditFields(allFields);
    } else {
      setSelectedCustomer(null);
      setEditFields(allFields);
    }

    const { data: history } = await supabase
      .from('reservations')
      .select('*, staffs(name)')
      .eq('shop_id', shopId)
      .eq('res_type', 'normal')
      .or(`customer_name.eq."${res.customer_name}"${cust?.id ? `,customer_id.eq.${cust.id}` : ''}`)
      .order('start_time', { ascending: false });

    setCustomerHistory(history || []);
    setShowDetailModal(true);
    };

  // --- 顧客情報の更新 ---
const handleUpdateCustomer = async () => {
    try {
      const normalizedName = editFields.name.replace(/　/g, ' ').trim();
      if (!normalizedName) {
        alert("名前を入力してください。");
        return;
      }

      // ✅ 🆕 追加：ブロック枠(blocked) または プライベート予定(private_task) の場合
      if (selectedRes?.res_type === 'private_task' || selectedRes?.res_type === 'blocked') {
      const isPrivate = selectedRes.res_type === 'private_task';
      const targetTable = isPrivate ? 'private_tasks' : 'reservations';
      
      const updateData = isPrivate 
        ? { title: normalizedName, note: editFields.memo } 
        : { customer_name: normalizedName };

      await supabase.from(targetTable).update(updateData).eq('id', selectedRes.id);
      showMsg('内容を更新しました！');
      setShowDetailModal(false); fetchData(); return;
    }

    let targetCustomerId = selectedCustomer?.id;

    // 🔍 ステップ2：顧客情報の準備
    const customerPayload = {
      shop_id: shopId,
      name: normalizedName,
      admin_name: editFields.admin_name || normalizedName,
      phone: editFields.phone || null,
      email: editFields.email || null,
      memo: editFields.memo || null, // 👈 メモはここに集約！
      line_user_id: editFields.line_user_id || null,
      updated_at: new Date().toISOString()
    };

    if (targetCustomerId) customerPayload.id = targetCustomerId;

    // 🔍 ステップ3：顧客マスタ（customers）を更新
    const { data: savedCust, error: custError } = await supabase
      .from('customers')
      .upsert(customerPayload, { onConflict: 'id' })
      .select()
      .single();
    
    if (custError) throw custError;
    targetCustomerId = savedCust.id;

    // 🔍 ステップ4：予約データ（reservations）を更新してガッチリ紐付け
    const { error: resError } = await supabase
      .from('reservations')
      .update({ 
        customer_name: normalizedName,
        customer_phone: editFields.phone,
        customer_id: targetCustomerId, // 👈 IDを紐付ける
        staff_id: selectedRes.staff_id,
        memo: null // 👈 予約側のメモは一本化のため空にする
      })
      .eq('id', selectedRes.id);

    if (resError) throw resError;

// --- [196行目付近] ---
    alert('情報を名簿に保存し、予約と紐付けました！✨');
    setShowDetailModal(false);
    fetchData();
  } catch (err) {
    alert('更新に失敗しました: ' + err.message);
  }
};

// ✅ 🆕 追加：プライベート予定(private_tasksテーブル)をスタッフ毎に保存する関数
const handleSavePrivateTask = async () => {
  if (!privateTaskFields.title) {
    alert("予定の内容を入力してください。");
    return;
  }

  try {
    const start = new Date(`${selectedDate}T${targetTime}:00`);
    const intervalMin = shop?.slot_interval_min || 15;
    const end = new Date(start.getTime() + intervalMin * 60000);

    const { error } = await supabase.from('private_tasks').insert([{
      shop_id: shopId,
      staff_id: targetStaffId, // 💡 タイムラインで選択した「スタッフID」を正確に紐付け
      title: privateTaskFields.title,
      note: privateTaskFields.note,
      start_time: start.toISOString(),
      end_time: end.toISOString()
    }]);

    if (error) throw error;

    // 保存が成功したらモーダルを閉じて入力をリセット
    setShowPrivateModal(false);
    setPrivateTaskFields({ title: '', note: '' });
    fetchData(); // 画面を再読み込み
  } catch (err) {
    console.error("保存エラー:", err.message);
    alert("プライベート予定の保存に失敗しました。");
  }
};

// 🚀 🆕 ここにキャンセル関数を差し込みます
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
      fetchData(); // 🔄 画面を最新にする
      alert("キャンセルとして記録しました"); 
    } catch (err) {
      alert("エラー: " + err.message);
    }
  };
  
  // --- 予約の削除 ---
  const deleteRes = async (id) => {
    const isPrivate = selectedRes?.res_type === 'private_task';
    const msg = isPrivate ? 'このプライベート予定を削除しますか？' : 'この予約データを消去して予約を「可能」に戻しますか？';
    
    if (window.confirm(msg)) {
      // ✅ 🆕 修正：ここも reservations 固定ではなく targetTable を使う
      const targetTable = isPrivate ? 'private_tasks' : 'reservations';
      const { error } = await supabase.from(targetTable).delete().eq('id', id);
      
      if (error) {
        alert('削除失敗: ' + error.message);
      } else {
        setShowDetailModal(false); 
        fetchData();
      }
    }
  };

  // 🚀 🆕 修正：カレンダーと同じ、終了時間を選択できる「✕」ブロック処理
  const executeBlockTime = async (slots) => {
    const interval = shop?.slot_interval_min || 15;
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
      staff_id: targetStaffId, 
      options: { type: 'admin_block' }
    };
    
    const { error } = await supabase.from('reservations').insert([insertData]);
    if (error) {
      alert(`エラー: ${error.message}`); 
    } else { 
      setShowMenuModal(false); 
      setShowBlockEndSelector(false); 
      fetchData(); 
    }
  };

  const handleBlockFullDay = async () => {
    const staffName = staffs.find(s => s.id === targetStaffId)?.name || 'フリー枠';
    if (!window.confirm(`${staffName} の ${selectedDate.replace(/-/g, '/')} を終日「予約不可」にしますか？`)) return;
    
    const intervalMin = shop?.slot_interval_min || 15;
    // 09:00 - 21:00 をブロック（適宜店舗時間に合わせる）
    const start = new Date(`${selectedDate}T09:00:00`);
    const end = new Date(`${selectedDate}T21:00:00`);
    const slotsCount = Math.ceil((end - start) / (intervalMin * 60000));

    const insertData = {
      shop_id: shopId, 
      customer_name: '臨時休業', 
      res_type: 'blocked',
      is_block: true, // 🚀 🆕 「これは売上ではない」という目印を追加！
      staff_id: targetStaffId, 
      start_time: start.toISOString(), 
      end_time: end.toISOString(),
      total_slots: slotsCount, 
      customer_email: null, 
      customer_phone: '---',
      options: { isFullDay: true }
    };
    await supabase.from('reservations').insert([insertData]);
    setShowMenuModal(false); fetchData();
  };

  // --- ドラッグ＆クリック制御 ---
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; 
    setIsDragging(true); setHasMoved(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) setHasMoved(true);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };
const handleCellClick = (slotMatches, time, staffId) => {
    if (hasMoved) return;
    setTargetTime(time);
    const actualStaffId = staffId === 'free' ? null : staffId;
    setTargetStaffId(actualStaffId); 

    // 💡 1. DBに記録があるもの（予約、プライベート予定、ブロック）を探す
    // 👇 🌟 修正：施設予約（keep, visit）もタップ対象に含める！
    const dbRecords = slotMatches.filter(r => r.id && (r.res_type === 'normal' || r.res_type === 'private_task' || r.res_type === 'blocked' || r.res_type === 'keep' || r.res_type === 'visit'));
    const activeTask = dbRecords[0];

    // 💡 2. すでに予定（ブロック含む）がある場合は詳細を開く
    if (activeTask) {
      if (dbRecords.length > 1) {
        setSelectedSlotReservations(dbRecords); setShowSlotListModal(true);
      } else {
        // 👇 🌟 修正：キープ枠の場合は、詳細モーダルではなく警告モーダル(SlotListModal)を開く！
        if (activeTask.res_type === 'keep') {
          setSelectedSlotReservations([activeTask]); 
          setShowSlotListModal(true);
        } else {
          openDetail(activeTask);
        }
      }
      return;
    }

    // 💡 3. 本当に何もない空き枠、またはシステム上の定休日の判定
    const targetDate = new Date(selectedDate);
    const dayIndex = targetDate.getDay();
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayIndex];
    const hours = shop?.business_hours?.[dayName];
    const isStandardTime = hours && !hours.is_closed && time >= hours.open && time < hours.close;
    
    // 🚀 🆕 修正：店舗の定休日に加え、スタッフのシフト（時間外）も厳密にチェック！
    const isShopClosed = isShopHoliday(shop, targetDate);
    const staffObj = staffs.find(s => s.id === actualStaffId);
    
    let isStaffHoliday = false;
    let isOutsideShift = false;

    if (staffObj) {
      if (staffObj.weekly_holidays?.includes(dayIndex)) isStaffHoliday = true;
      const shift = staffObj.custom_shifts?.[selectedDate];
      if (shift) {
        if (shift.type === 'off') isStaffHoliday = true;
        else if (shift.type === 'time') {
          isStaffHoliday = false;
          if (time < shift.start || time >= shift.end) isOutsideShift = true;
        }
      }
    }

    // 🚀 🆕 修正：店舗休み・スタッフ休み・シフト時間外の場合は「時間外（2択メニュー）」として扱う！
    setIsTargetOutsideHours(!isStandardTime || isShopClosed || isStaffHoliday || isOutsideShift);
    setShowMenuModal(true);
  };
// --- 修正後：動的に時間軸を計算するコード ---
const timeSlots = useMemo(() => {
  if (!shop?.business_hours) return [];
  
  let minTotalMinutes = 24 * 60;
  let maxTotalMinutes = 0;
  let hasOpenDay = false;

  // 全曜日の設定から最小・最大時間を特定
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

  const interval = shop.slot_interval_min || 15;
  const extraBefore = shop.extra_slots_before || 0; // 💡 表示拡張
  const extraAfter = shop.extra_slots_after || 0;   // 💡 表示拡張

  const finalStart = minTotalMinutes - (extraBefore * interval);
  const finalEnd = maxTotalMinutes + (extraAfter * interval);

  const slots = [];
  for (let m = finalStart; m <= finalEnd; m += interval) {
    const h = Math.floor(m / 60); const mm = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return slots;
}, [shop]);

  // ✅ 🆕 【Step B：自動スクロール実行ロジック】ここから差し込み
  useEffect(() => {
    if (!loading && timeSlots.length > 0 && scrollRef.current) {
      const now = new Date();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // 今の時間帯がタイムラインのどこにあるか探す
      const targetIdx = timeSlots.findIndex(slot => slot >= currentTimeStr);
      
      if (targetIdx !== -1) {
        const columnWidth = 120; // <td> で設定している minWidth
        // 今の時間が左端に来るようにスクロール（1列分だけ余裕を持たせる）
        const scrollOffset = Math.max(0, (targetIdx - 1) * columnWidth);
        
        scrollRef.current.scrollLeft = scrollOffset;
      }
    }
  }, [loading, timeSlots]);
  // ✅ 🆕 差し込みここまで
  
  const themeColor = shop?.theme_color || '#4b2c85';

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>読み込み中...</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      
      {/* 🚀 🆕 修正：AdminReservationsからヘッダーを完全移植 */}
      <div style={{ padding: isPC ? '15px 25px' : '15px 10px', borderBottom: '0.5px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', zIndex: 1000, flexShrink: 0 }}>
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
              <h1 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, color: '#1e293b', whiteSpace: 'nowrap' }}>
                {shop?.business_name || 'SnipSnap Admin'}
              </h1>
            </div>

            {/* 📅 ナビゲーション 🚀 🆕 【引っ越しその2】「前週」➔「今日」➔「次週」の並び順に変更！ */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={goPrev} style={headerBtnStylePC}>◀</button>
              <button onClick={goToday} style={headerBtnStylePC}>今日</button>
              <button onClick={goNext} style={headerBtnStylePC}>▶</button>
            </div>

            {/* 左サイドバーから引っ越してきたPC用横並びナビゲーションメニュー一式 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginLeft: '10px' }}>
              <button 
                onClick={() => navigate(`/admin/${shopId}/reservations?date=${selectedDate}`)} 
                style={{ ...switchBtnStyle(false), padding: '6px 14px' }}
              >
                カレンダー
              </button>
              <button style={{ ...switchBtnStyle(true), padding: '6px 14px' }}>
                タイムライン
              </button>
            </div>

            {/* ⚡ 本日のタスク（実行）ボタン */}
            <button 
              onClick={() => navigate(`/admin/${shopId}/today-tasks`)}
              style={{ ...headerBtnStylePC, background: '#13a11a', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', border: 'none' }}
            >
              <span>タスク</span>
            </button>

            {/* 🌟 🆕 追加：在庫管理（ポチポチ）ボタン */}
            <button 
              onClick={() => navigate(`/admin/${shopId}/inventory`)}
              style={{ ...headerBtnStylePC, background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', border: 'none' }}
            >
              <PackageOpen size={16} />
              <span>在庫</span>
            </button>

            {/* 📊 顧客・売上管理ボタン */}
            <button 
              onClick={() => shop?.is_management_enabled && navigate(`/admin/${shopId}/management`)} 
              disabled={!shop?.is_management_enabled}
              style={{ 
                ...headerBtnStylePC, 
                background: shop?.is_management_enabled ? '#0b63d7' : '#f1f9f6', 
                color: shop?.is_management_enabled ? '#ffffff' : '#94a3b8',
                cursor: shop?.is_management_enabled ? 'pointer' : 'not-allowed',
                border: shop?.is_management_enabled ? '1px solid #cbd5e1' : '1px solid #e2e8f0'
              }}
            >
              売上管理
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
                setViewMonth(new Date(selectedDate)); // 🚀 🆕 修正：カレンダーを開く際、選択中の日付の月を初期表示にする
                setShowMobileCalendar(true);       
              }}
              style={{
                ...headerBtnStylePC,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: `${themeColor}15`, // 🚀 🆕 修正：themeColorLight を直接指定
                border: `1px solid ${themeColor}44`,
                color: themeColor
              }}
            >
              <CalendarIcon size={18} />
            </button>

            {/* 🚀 🆕 修正：現在表示中の年月（日はテーブル左上に表示するため省略） */}
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 0 auto', fontWeight: '900', color: '#1e293b', whiteSpace: 'nowrap' }}>
              {(() => {
                const d = new Date(selectedDate);
                return `${d.getFullYear()}年${d.getMonth() + 1}月`;
              })()}
            </h2>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '12px' }}>
            {/* 上段：カレンダーボタン ＆ 年月ナビ ＆ 検索ボタン */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '10px', position: 'relative' }}>
              {/* 📅 左：カレンダーボタン */}
              <button 
                onClick={() => {
                  setViewMonth(new Date(selectedDate)); // 🚀 🆕 修正：カレンダーを開く際、選択中の日付の月を初期表示にする
                  setShowMobileCalendar(true);
                }}
                style={{ 
                  position: 'absolute', left: '0', background: `${themeColor}15`, border: `1px solid ${themeColor}33`, // 🚀 🆕 修正：themeColorLight を直接指定
                  color: themeColor, padding: '8px', borderRadius: '10px'
                }}
              >
                <CalendarIcon size={20} />
              </button>

              <button onClick={goPrev} style={{ background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer' }}>◀</button>
              <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '900', color: '#1e293b' }}>
                {(() => {
                  const d = new Date(selectedDate);
                  return `${d.getFullYear()}年${d.getMonth() + 1}月`; // 🚀 🆕 修正：年月だけにする
                })()}
              </h2>
              <button onClick={goNext} style={{ background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer' }}>▶</button>

              {/* 🔍 🚀 🆕 右：検索ポップアップ起動ボタン */}
              <button 
                onClick={() => {
                  fetchAllCustomersForSearch();
                  setShowMobileSearchModal(true);
                }}
                style={{ 
                  position: 'absolute', right: '0', background: `${themeColor}15`, border: `1px solid ${themeColor}33`, // 🚀 🆕 修正：themeColorLight を直接指定
                  color: themeColor, padding: '8px', borderRadius: '10px'
                }}
              >
                <Search size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 👇 🌟 🆕 ここから追加：業種フィルタータブ（複数の業種がある場合のみ自動で出現） */}
      {shopIndustries.length > 1 && (
        <div style={{ background: '#f8fafc', padding: '10px 15px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', overflowX: 'auto', flexShrink: 0 }}>
          <button
            onClick={() => setActiveFilter('all')}
            style={{
              padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', border: 'none',
              background: activeFilter === 'all' ? themeColor : '#e2e8f0',
              color: activeFilter === 'all' ? '#fff' : '#64748b',
              transition: '0.2s', boxShadow: activeFilter === 'all' ? `0 4px 10px ${themeColor}44` : 'none'
            }}
          >
            全体
          </button>
          {shopIndustries.map(ind => {
            // 👇 🌟 🆕 追加：表示名をスッキリ短く変換する
            let displayInd = ind;
            if (ind === '美容室・理容室') displayInd = '店舗';
            else if (ind === '訪問サービス') displayInd = '訪問';

            return (
              <button
                key={ind}
                onClick={() => setActiveFilter(ind)}
                style={{
                  padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', border: 'none',
                  background: activeFilter === ind ? themeColor : '#e2e8f0',
                  color: activeFilter === ind ? '#fff' : '#64748b',
                  transition: '0.2s', boxShadow: activeFilter === ind ? `0 4px 10px ${themeColor}44` : 'none'
                }}
              >
                {displayInd}
              </button>
            );
          })}
        </div>
      )}
      {/* 👆 追加ここまで */}

  {/* 🚀 🆕 【追加】フェーズ1: トライアル終了間近の警告バナー */}
  {(() => {
        if (shop?.subscription_status !== 'trialing' || !shop?.trial_ends_at) return null;
        const endsAt = new Date(shop.trial_ends_at);
        const now = new Date();
        const diffTime = endsAt.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 7 && diffDays >= 0) {
          return (
            <div style={{ 
              zIndex: 105, padding: '12px 20px', background: '#fffbeb', borderBottom: '2px solid #fde68a', 
              display: 'flex', flexDirection: isPC ? 'row' : 'column', gap: '10px',
              justifyContent: 'space-between', alignItems: isPC ? 'center' : 'stretch',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '1.4rem', marginTop: '2px' }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#d97706' }}>
                    無料トライアル終了まで あと <span style={{fontSize: '1.2rem', color: '#b45309'}}>{diffDays}</span> 日
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '4px', lineHeight: '1.4' }}>
                    期限を過ぎると一部機能が制限されます。継続利用をご希望の場合はプランをアップグレードしてください。
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate(`/admin/${shopId}/billing`)} 
                style={{ 
                  background: '#d97706', color: '#fff', border: 'none', padding: '10px 20px', 
                  borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem',
                  textAlign: 'center', whiteSpace: 'nowrap'
                }}
              >
                プラン・お支払い設定へ
              </button>
            </div>
          );
        }
        return null;
      })()}

      {/* 👇 🌟 🆕 ここから追加：確定期限間近・新着キープのアラートバナー（赤・青） */}
      {(() => {
        if (activeFilter !== 'all' && !isVisitFilter) return null;

        const hasUrgent = urgentKeeps.length > 0;
        const hasTimeChange = timeChangedKeeps.filter(k => !dismissedKeeps.includes(k.id)).length > 0;
        if (!hasUrgent && !hasTimeChange) return null;

        return (
          <div style={{ zIndex: 100, padding: '8px 20px', background: hasUrgent ? '#fef2f2' : '#fff7ed', borderBottom: hasUrgent ? '1px solid #fecdd3' : '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.1rem' }}>{hasUrgent ? '🚨' : '⚠️'}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '900', color: hasUrgent ? '#be123c' : '#c2410c' }}>
                {hasUrgent 
                  ? '未確定のキープ枠があります' 
                  : '定期訪問の時間変更通知が届いています'}
              </span>
            </div>
            <button
              onClick={() => setAlertModalMode('urgent')}
              style={{ background: hasUrgent ? '#be123c' : '#f97316', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', flexShrink: 0 }}
            >
              確認 
            </button>
          </div>
        );
      })()}

      {(() => {
        if (activeFilter !== 'all' && !isVisitFilter) return null;

        const activeIrregulars = irregularKeeps.filter(k => !dismissedKeeps.includes(k.id));
        if (activeIrregulars.length === 0) return null;

        return (
          <div style={{ zIndex: 100, padding: '8px 20px', background: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0369a1' }}>
                施設から新しい「単発キープ」が届いています（確認・枠タップで非表示になります）
              </span>
            </div>
            <button
              onClick={() => setAlertModalMode('single')}
              style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', flexShrink: 0 }}
            >
              確認 
            </button>
          </div>
        );
      })()}
      {/* 👆 アラートバナー追加ここまで */}

      {/* タイムライン本体 */}
      {/* 🚀 🆕 修正：スマホの時はボトムナビが被らないように paddingBottom を空ける */}
      <div ref={scrollRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)} style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#fff', cursor: isDragging ? 'grabbing' : 'default', userSelect: 'none', paddingBottom: !isPC && !isPreviewMode ? '85px' : '0' }}>
        
        {isPC ? (
          /* =======================================================
             💻 PC版タイムライン（横軸：時間 / 縦軸：スタッフ）
             ======================================================= */
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 110, background: '#e2e8f0', padding: '10px', borderRight: '3px solid #94a3b8', borderBottom: '3px solid #94a3b8', width: '140px', color: '#1e293b', fontSize: '1.2rem', fontWeight: '900', textAlign: 'center' }}>
                  {(() => {
                    const d = new Date(selectedDate);
                    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                    return `${d.getDate()}日(${dayNames[d.getDay()]})`;
                  })()}
                </th>
                {timeSlots.map(time => (
                  <th key={time} style={{ padding: '8px 4px', minWidth: '70px', borderRight: '1px solid #cbd5e1', borderBottom: '3px solid #94a3b8', color: '#1e293b', fontSize: '1.3rem', background: '#e2e8f0', textAlign: 'center' }}>{time}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 👇 🌟 修正：staffs を filteredStaffs に変更 */}
              {[...filteredStaffs, { id: 'free', name: '担当なし' }].map((staff, idx) => (
                <tr key={staff.id} style={{ height: '80px', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 90, background: idx % 2 === 0 ? '#fff' : '#f8fafc', padding: '8px', borderRight: '3px solid #94a3b8', borderBottom: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.1rem', color: '#1e293b' }}>{staff.name}</span>
                    </div>
                  </td>
                  {timeSlots.map(time => {
                    const currentSlotStart = new Date(`${selectedDate}T${time}:00`).getTime();
                    const staffIdVal = staff.id === 'free' ? null : staff.id;

                    const targetDate = new Date(selectedDate);
                    const dayIndex = targetDate.getDay();
                    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayIndex];
                    const hours = shop?.business_hours?.[dayName];
                    
                    const isShopClosed = isShopHoliday(shop, targetDate);
                    let isStaffHoliday = false;
                    let isOutsideShift = false;

                    if (staff.id !== 'free') {
                      if (staff.weekly_holidays?.includes(dayIndex)) isStaffHoliday = true;
                      const shift = staff.custom_shifts?.[selectedDate];
                      if (shift) {
                        if (shift.type === 'off') isStaffHoliday = true;
                        else if (shift.type === 'time') {
                          isStaffHoliday = false;
                          if (time < shift.start || time >= shift.end) isOutsideShift = true;
                        }
                      }
                    }

                    const isStandardTime = hours && !hours.is_closed && time >= hours.open && time < hours.close;
                    const isRestTime = hours && hours.rest_start && hours.rest_end && time >= hours.rest_start && time < hours.rest_end;
                    
                    const resMatches = reservations.filter(r => (r.staff_id === staffIdVal) && currentSlotStart >= new Date(r.start_time).getTime() && currentSlotStart < new Date(r.end_time).getTime());
                    const privMatches = privateTasks.filter(p => (p.staff_id === staffIdVal) && currentSlotStart >= new Date(p.start_time).getTime() && currentSlotStart < new Date(p.end_time).getTime()).map(p => ({ ...p, res_type: 'private_task', customer_name: p.title }));
                    const matches = [...resMatches, ...privMatches];
                    const hasRes = matches.length > 0;
                    const startingHere = matches.filter(r => new Date(r.start_time).getTime() === currentSlotStart);
                    const isStart = startingHere.length > 0;
                    const isMultiple = matches.length > 1;
                    const firstRes = matches[0];
                    const intervalMin = shop?.slot_interval_min || 15;
                    const isEnd = hasRes && matches.some(r => new Date(r.end_time).getTime() === (currentSlotStart + intervalMin * 60000));
                    
                    // 👇 🌟 修正：施設予約の場合は専用の色にする
                    let colors = getCustomerColor(firstRes?.customer_name);
                    if (firstRes?.res_type === 'keep') {
                      colors = { bg: '#e0f2fe', border: '#7dd3fc', line: '#38bdf8', text: '#0284c7' }; // 水色
                    } else if (firstRes?.res_type === 'visit') {
                      colors = { bg: '#dcfce7', border: '#86efac', line: '#4ade80', text: '#166534' }; // 緑
                    }

                    return (
                      <td key={time} onClick={() => handleCellClick(matches, time, staffIdVal)} style={{ minWidth: '120px', borderRight: '1.5px solid #cbd5e1', borderBottom: '1.5px solid #cbd5e1', position: 'relative', background: (isShopClosed || isStaffHoliday || isRestTime || isOutsideShift) ? '#f1f5f9' : (isStandardTime ? '#fff' : '#fffff3'), padding: 0, cursor: 'pointer' }}>
                        {hasRes && (
                          <div style={{ position: 'absolute', inset: '6px 0', background: isMultiple ? '#e0e7ff' : colors.bg, borderTop: `1.5px solid ${isMultiple ? themeColor : colors.border}`, borderBottom: `1.5px solid ${isMultiple ? themeColor : colors.border}`, borderLeft: isStart ? `1.5px solid ${isMultiple ? themeColor : colors.border}` : 'none', borderRight: isEnd ? `1.5px solid ${isMultiple ? themeColor : colors.border}` : 'none', borderRadius: `${isStart ? '8px' : '0'} ${isEnd ? '8px' : '0'} ${isEnd ? '8px' : '0'} ${isStart ? '8px' : '0'}`, display: 'flex', alignItems: 'center', justifyContent: isStart ? 'flex-start' : 'center', padding: isStart ? '0 10px' : '0', zIndex: 5, overflow: 'hidden' }}>
                            {isStart ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', width: '100%' }}>
                                {categoryMap[firstRes?.biz_type] && (
                                  <span style={{ fontSize: '0.55rem', padding: '1px 4px', borderRadius: '3px', background: firstRes.biz_type === 'foot' ? '#4285f4' : '#d34817', color: '#fff', fontWeight: '900', whiteSpace: 'nowrap', transform: 'scale(0.9)', flexShrink: 0 }}>
                                    {categoryMap[firstRes.biz_type].slice(0, 4)}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: isMultiple ? themeColor : colors.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {(() => {
                                    if (startingHere.length === 1) {
                                      const res = startingHere[0];
                                      const masterName = res.customers?.admin_name || res.customers?.name || res.customer_name;
                                      
                                      // 👇 🌟 修正：施設の場合は [ｷｰﾌﾟ] などのタグを消し、スペースで分割しない！
                                      let name = masterName || "名前なし";
                                      if (res.res_type === 'keep' || res.res_type === 'visit') {
                                        name = name.replace(/\[ｷｰﾌﾟ\]\s*/, '').replace(/\[確定\]\s*/, '');
                                      } else {
                                        name = name.split(/[\s ]+/)[0];
                                      }

                                      const blockedIcon = res.customers?.is_blocked ? '🚫' : '';
                                      const cancelIcon = res.customers?.cancel_count >= 3 ? '‼️' : '';
                                      const icons = `${blockedIcon}${cancelIcon}`;
                                      
                                      const isSystemTask = res.res_type === 'blocked' || res.res_type === 'private_task';
                                      const isFacility = res.res_type === 'keep' || res.res_type === 'visit';
                                      const suffix = isSystemTask ? '' : (isFacility ? ' 様' : ' 様');
                                      
                                      return isMultiple ? `${name} (${matches.length}名)${icons}` : `${name}${suffix}${icons}`;
                                    }
                                    return `👥 ${matches.length}名`;
                                  })()}
                                </span>
                              </div>
                            ) : (
                              <div style={{ width: '100%', height: '3px', background: isMultiple ? themeColor : colors.line, opacity: 0.4 }} />
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
        ) : (
          /* =======================================================
             📱 スマホ版タイムライン（縦軸：時間 / 横軸：スタッフ）
             ======================================================= */
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed', minWidth: `${50 + (staffs.length + 1) * 70}px` }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
              <tr>
                {/* 左上の日付セル */}
                <th style={{ position: 'sticky', left: 0, zIndex: 110, background: '#e2e8f0', padding: '10px 4px', borderRight: '1.5px solid #cbd5e1', borderBottom: '3px solid #94a3b8', width: '50px', color: '#1e293b', fontSize: '0.8rem', fontWeight: '900', textAlign: 'center' }}>
                  {(() => {
                    const d = new Date(selectedDate);
                    return `${d.getDate()}日`;
                  })()}
                </th>
                {/* 横軸にスタッフを展開 */}
                {/* 👇 🌟 修正：staffs を filteredStaffs に変更 */}
                {[...filteredStaffs, { id: 'free', name: 'フリー' }].map((staff, idx) => (
                  // 🚀 🆕 修正：文字がはみ出さないように overflow: 'hidden' と textOverflow: 'ellipsis' を追加
                  <th key={staff.id} style={{ padding: '8px 4px', minWidth: '70px', borderRight: '1px solid #cbd5e1', borderBottom: '3px solid #94a3b8', color: '#1e293b', fontSize: '0.9rem', background: idx % 2 === 0 ? '#fff' : '#f8fafc', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {staff.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 縦軸に時間を展開 */}
              {timeSlots.map(time => (
                <tr key={time} style={{ height: '70px' }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 90, background: '#f8fafc', padding: '0 4px', borderRight: '1.5px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', fontWeight: 'bold', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{time}</span>
                  </td>
                  
                  {/* 👇 🌟 修正：staffs を filteredStaffs に変更 */}
                  {[...filteredStaffs, { id: 'free', name: '担当なし' }].map((staff, idx) => {
                    const currentSlotStart = new Date(`${selectedDate}T${time}:00`).getTime();
                    const staffIdVal = staff.id === 'free' ? null : staff.id;

                    const targetDate = new Date(selectedDate);
                    const dayIndex = targetDate.getDay();
                    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayIndex];
                    const hours = shop?.business_hours?.[dayName];
                    
                    const isShopClosed = isShopHoliday(shop, targetDate);
                    let isStaffHoliday = false;
                    let isOutsideShift = false;

                    if (staff.id !== 'free') {
                      if (staff.weekly_holidays?.includes(dayIndex)) isStaffHoliday = true;
                      const shift = staff.custom_shifts?.[selectedDate];
                      if (shift) {
                        if (shift.type === 'off') isStaffHoliday = true;
                        else if (shift.type === 'time') {
                          isStaffHoliday = false;
                          if (time < shift.start || time >= shift.end) isOutsideShift = true;
                        }
                      }
                    }

                    const isStandardTime = hours && !hours.is_closed && time >= hours.open && time < hours.close;
                    const isRestTime = hours && hours.rest_start && hours.rest_end && time >= hours.rest_start && time < hours.rest_end;
                    
                    const resMatches = reservations.filter(r => (r.staff_id === staffIdVal) && currentSlotStart >= new Date(r.start_time).getTime() && currentSlotStart < new Date(r.end_time).getTime());
                    const privMatches = privateTasks.filter(p => (p.staff_id === staffIdVal) && currentSlotStart >= new Date(p.start_time).getTime() && currentSlotStart < new Date(p.end_time).getTime()).map(p => ({ ...p, res_type: 'private_task', customer_name: p.title }));
                    const matches = [...resMatches, ...privMatches];
                    const hasRes = matches.length > 0;
                    const startingHere = matches.filter(r => new Date(r.start_time).getTime() === currentSlotStart);
                    const isStart = startingHere.length > 0;
                    const isMultiple = matches.length > 1;
                    const firstRes = matches[0];
                    const intervalMin = shop?.slot_interval_min || 15;
                    const isEnd = hasRes && matches.some(r => new Date(r.end_time).getTime() === (currentSlotStart + intervalMin * 60000));
                    
                    // 👇 🌟 修正：施設予約の場合は専用の色にする
                    let colors = getCustomerColor(firstRes?.customer_name);
                    if (firstRes?.res_type === 'keep') {
                      colors = { bg: '#e0f2fe', border: '#7dd3fc', line: '#38bdf8', text: '#0284c7' }; // 水色
                    } else if (firstRes?.res_type === 'visit') {
                      colors = { bg: '#dcfce7', border: '#86efac', line: '#4ade80', text: '#166534' }; // 緑
                    }

                    return (
                      <td key={staff.id} onClick={() => handleCellClick(matches, time, staffIdVal)} style={{ minWidth: '70px', borderRight: '1.5px solid #cbd5e1', borderBottom: '1.5px solid #cbd5e1', position: 'relative', background: (isShopClosed || isStaffHoliday || isRestTime || isOutsideShift) ? '#f1f5f9' : (isStandardTime ? '#fff' : '#fffff3'), padding: 0, cursor: 'pointer' }}>
                        {hasRes && (
                          <div style={{ position: 'absolute', inset: '0 4px', background: isMultiple ? '#e0e7ff' : colors.bg, borderLeft: `1.5px solid ${isMultiple ? themeColor : colors.border}`, borderRight: `1.5px solid ${isMultiple ? themeColor : colors.border}`, borderTop: isStart ? `1.5px solid ${isMultiple ? themeColor : colors.border}` : 'none', borderBottom: isEnd ? `1.5px solid ${isMultiple ? themeColor : colors.border}` : 'none', borderRadius: `${isStart ? '6px 6px' : '0 0'} ${isEnd ? '6px 6px' : '0 0'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: isStart ? 'flex-start' : 'center', padding: isStart ? '4px' : '0', zIndex: 5, overflow: 'hidden' }}>
                            {isStart ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', overflow: 'hidden', width: '100%' }}>
                                {categoryMap[firstRes?.biz_type] && (
                                  <span style={{ fontSize: '0.55rem', padding: '1px 4px', borderRadius: '3px', background: firstRes.biz_type === 'foot' ? '#4285f4' : '#d34817', color: '#fff', fontWeight: '900', whiteSpace: 'nowrap', transform: 'scale(0.8)', flexShrink: 0 }}>
                                    {categoryMap[firstRes.biz_type].slice(0, 4)}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isMultiple ? themeColor : colors.text, textAlign: 'center', wordBreak: 'break-all', lineHeight: '1.1' }}>
                                  {(() => {
                                    if (startingHere.length === 1) {
                                      const res = startingHere[0];
                                      const masterName = res.customers?.admin_name || res.customers?.name || res.customer_name;
                                      
                                      // 👇 🌟 修正：施設の場合は [ｷｰﾌﾟ] 等のタグを消し、スペースで分割しない！
                                      let name = masterName || "名前なし";
                                      if (res.res_type === 'keep' || res.res_type === 'visit') {
                                        name = name.replace(/\[ｷｰﾌﾟ\]\s*/, '').replace(/\[確定\]\s*/, '');
                                      } else {
                                        name = name.split(/[\s ]+/)[0];
                                      }

                                      const blockedIcon = res.customers?.is_blocked ? '🚫' : '';
                                      const cancelIcon = res.customers?.cancel_count >= 3 ? '‼️' : '';
                                      
                                      // 👇 🌟 修正：施設枠の場合は5文字まで施設名を表示
                                      if (res.res_type === 'keep' || res.res_type === 'visit') return `${name.slice(0,5)}様`;
                                      
                                      return isMultiple ? `${name.slice(0,3)}(${matches.length})${blockedIcon}${cancelIcon}` : `${name.slice(0,4)}${blockedIcon}${cancelIcon}`;
                                    }
                                    return `👥 ${matches.length}名`;
                                  })()}
                                </span>
                              </div>
                            ) : (
                              <div style={{ width: '3px', height: '100%', background: isMultiple ? themeColor : colors.line, opacity: 0.4 }} />
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
        )}
      </div>

      {/* 🆕 ここから追記：3択の名寄せ（マージ）確認モーダル */}
      {showMergeConfirm && (
        <div 
          style={{ ...overlayStyle, zIndex: 5000 }} 
          onClick={() => setShowMergeConfirm(false)}
        >
          <div 
            style={{ 
              ...modalContentStyle, maxWidth: '400px', textAlign: 'center', 
              padding: '35px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' 
            }} 
            onClick={e => e.stopPropagation()}
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
              {/* 選択肢A：店側の名前を守る */}
              <button 
                onClick={() => handleMergeAction(mergeCandidate.id, mergeCandidate.name)}
                style={{ 
                  padding: '18px', background: themeColor, color: '#fff', border: 'none', 
                  borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' 
                }}
              >
                👤 既存の「{mergeCandidate?.name}」様に統合
              </button>

              {/* 選択肢B：今回の名前を採用する */}
              <button 
                onClick={() => handleMergeAction(mergeCandidate.id, selectedRes.customer_name)}
                style={{ 
                  padding: '16px', background: '#fff', color: themeColor, 
                  border: `2px solid ${themeColor}`, borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer' 
                }}
              >
                🐹 今回の「{selectedRes?.customer_name}」様へ名前を更新
              </button>

              {/* 選択肢C：別人として扱う */}
              <button 
                onClick={() => {
                  setShowMergeConfirm(false);
                  finalizeOpenDetail(selectedRes, null); 
                }}
                style={{ padding: '12px', background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                🙅 同姓同名の別人として別名簿で管理
              </button>

              <button 
                onClick={() => setShowMergeConfirm(false)}
                style={{ marginTop: '10px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🆕 追記ここまで */}

      {/* ⚙️ モーダル1：管理メニュー (予約管理画面から完全移植) */}
      {showMenuModal && (
        <div onClick={() => { setShowMenuModal(false); setShowBlockEndSelector(false); }} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: '35px', borderRadius: '30px', width: '90%', maxWidth: '340px', textAlign: 'center', position: 'relative' }}>
            
            {showBlockEndSelector ? (
              /* A：終了時間選択モード（✕専用） */
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
              /* B：基本メニューモード（2択 or 4択） */
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
                <p style={{ fontWeight: '900', color: themeColor, fontSize: '2.2rem', margin: '0 0 25px 0' }}>{targetTime}</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button 
                    onClick={() => {
                      setShowBlockEndSelector(false);
                      navigate(`/shop/${shopId}/reserve`, { 
                        state: { 
                          adminDate: selectedDate, 
                          adminTime: targetTime, 
                          fromView: 'timeline', 
                          isAdminMode: true,
                          adminStaffId: targetStaffId
                        } 
                      });
                    }} 
                    style={{ padding: '20px', background: themeColor, color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer', boxShadow: `0 4px 10px ${themeColor}44` }}
                  >
                    予約を入れる
                  </button>

                  {/* ☕️ プライベート予定 */}
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

                  {/* 🔴 ✕ と 休み（営業時間内 && 定休日でない場合のみ表示） */}
                  {!isTargetOutsideHours && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', animation: 'fadeIn 0.3s' }}>
                      <button 
                        onClick={() => setShowBlockEndSelector(true)}
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
          </div>
        </div>
      )}

{/* 👤 モーダル2：予約詳細・名簿 (AdminReservationsから全機能を完全移植) */}
      {showDetailModal && (
  <div onClick={() => { if(selectedRes?.isRegularHoliday) return; setShowDetailModal(false); }} style={overlayStyle}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '950px', width: '90vw', position: 'relative' }}>
            
{selectedRes?.res_type === 'normal' && (
              <button 
                onClick={() => {
                  // 💡 1人営業ならその人のIDを、そうでなければクリックした枠の担当IDを渡す
                  const finalStaffId = staffs.length === 1 ? staffs[0].id : targetStaffId;
                  
                  navigate(`/shop/${shopId}/reserve`, { 
                    state: { 
                      adminDate: selectedDate, 
                      adminTime: targetTime, 
                      adminStaffId: finalStaffId, // ✅ ここを修正
                      fromView: 'timeline', 
                      isAdminMode: true 
                    } 
                  });
                }}
                style={{ width: '100%', padding: '16px', background: themeColor, color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: `0 4px 12px ${themeColor}44` }}
              >
                ➕ この時間にさらに予約を入れる（ねじ込み）
              </button>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedRes?.res_type === 'private_task' ? '🕒 プライベート予定' : '📅 予約詳細・名簿更新'}</h2>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {/* ============================================================
               🆕 ここから「出し分け命令（三項演算子）」の開始： { 条件 ? (
               ============================================================ */}
            {(selectedRes?.res_type === 'blocked' || selectedRes?.res_type === 'private_task') ? (
              
              /* 🚫 パターンA：管理用（ブロック枠・プライベート予定） */
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

                  {/* プライベート予定の時だけメモ欄を出す */}
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

              /* 👤 パターンB：接客用（通常のお客様予約） */
              <div style={{ display: 'grid', gridTemplateColumns: isPC ? '1fr 1fr' : '1fr', gap: '25px' }}>
                
                {/* 📝 左側：入力フォーム */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    
                    {/* 予約メニュー内訳 */}
                    <div style={{ background: `${themeColor}15`, padding: '16px', borderRadius: '15px', marginBottom: '15px', border: `1px solid ${themeColor}` }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '900', color: themeColor, display: 'block', marginBottom: '10px' }}>📋 予約メニュー内訳</label>
                      <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{selectedRes?.menu_name || 'メニュー未設定'}</div>
                    </div>

                    {staffs.length > 1 && (
                      <>
                        <label style={labelStyle}>担当スタッフの変更</label>
                        <select 
                          value={selectedRes?.staff_id || ''} 
                          onChange={(e) => setSelectedRes({...selectedRes, staff_id: e.target.value || null})} 
                          style={inputStyle}
                        >
                          <option value="">フリー（担当なし）</option>
                          {staffs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        // 三土手さん理想の順番
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
                                  <a href={`tel:${editFields.phone}`} style={badgeStyle('#10b981')}>電話 📞</a>
                                )}
                                {key === 'address' && editFields.address && (
  <a 
    /* 🚀 修正ポイント：公式のURL形式に直し、${ } で囲みました */
    href={`https://www.google.co.jp/maps/search/${encodeURIComponent(editFields.address)}`} 
    target="_blank" 
    rel="noopener noreferrer" 
    style={badgeStyle('#3b82f6')}
  >
    マップ 📍
  </a>
)}
                              </div>
                              
                              {key === 'parking' ? (
                                <select value={editFields[key] || ''} onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} style={inputStyle}>
                                  <option value="">未選択</option>
                                  <option value="あり">あり</option>
                                  <option value="なし">なし</option>
                                </select>
                              ) : (
                                <input type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={editFields[key] || ''} onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} style={inputStyle} placeholder="未登録" />
                              )}
                            </div>
                          );
                        });
                      })()}

                      {/* 🆕 カスタム質問の回答表示 */}
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
                        <textarea value={editFields.memo} onChange={(e) => setEditFields({...editFields, memo: e.target.value})} style={{ ...inputStyle, height: '100px' }} placeholder="管理者用の控えメモです" />
                      </div>
                    </div>
                    
                    <button onClick={handleUpdateCustomer} style={{ width: '100%', padding: '12px', background: themeColor, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>情報を保存</button>

{/* 🚀 🆕 ここを2段構えに修正（キャンセルボタンを追加） */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
  <button 
  // 🚀 すでにキャンセル済みならボタンを無効化
  onClick={() => selectedRes?.status !== 'canceled' && cancelRes(selectedRes.id)} 
  disabled={selectedRes?.status === 'canceled'}
  style={{ 
    padding: '12px', 
    // 🚀 キャンセル済みなら灰色背景、そうでなければ白背景
    background: selectedRes?.status === 'canceled' ? '#f1f5f9' : '#fff', 
    // 🚀 キャンセル済みなら灰色文字、そうでなければオレンジ文字
    color: selectedRes?.status === 'canceled' ? '#94a3b8' : '#f59e0b', 
    border: `1px solid ${selectedRes?.status === 'canceled' ? '#e2e8f0' : '#f59e0b'}`, 
    borderRadius: '10px', 
    fontWeight: 'bold', 
    cursor: selectedRes?.status === 'canceled' ? 'default' : 'pointer', 
    fontSize: '0.8rem' 
  }}
>
  {selectedRes?.status === 'canceled' ? 'キャンセル済み' : 'キャンセル処理'}
</button>
  <button 
    onClick={() => deleteRes(selectedRes.id)} 
    style={{ padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}
  >
    消去 & 掃除
  </button>
</div>
                  </div>
                </div>

                {/* 🕒 右側：来店履歴 */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b' }}>🕒 来店履歴 ＆ 予定</h4>
  <div style={{ 
    flex: 1,             /* 🚀 高さ固定を解除し、親の空きスペースをすべて使う */
    overflowY: 'auto',   /* リストが長い時だけここでスクロール */
    border: '1px solid #f1f5f9', 
    borderRadius: '15px', 
    background: '#f8fafc', 
    padding: '5px' 
  }}>
    {(() => {
      // 1. 年ごとにグループ化
      const groups = customerHistory.reduce((acc, h) => {
        const year = new Date(h.start_time).getFullYear();
        if (!acc[year]) acc[year] = [];
        acc[year].push(h);
        return acc;
      }, {});

      const sortedYears = Object.keys(groups).sort((a, b) => b - a);

      return sortedYears.map((year) => (
        <div key={year} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', overflow: 'hidden' }}>
          {/* アコーディオン・ヘッダー */}
          <div 
            onClick={() => setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }))}
            style={{ 
              padding: '12px 15px', background: '#f8fafc', cursor: 'pointer', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: expandedYears[year] ? '1px solid #e2e8f0' : 'none'
            }}
          >
            <span style={{ fontWeight: '900', color: themeColor }}>{year}年</span>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{expandedYears[year] ? '▼' : '▶'} {groups[year].length}件</span>
          </div>

          {/* 展開時の中身 */}
          {expandedYears[year] && (
            <div style={{ padding: '5px' }}>
              {groups[year].sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).map((h) => {
                const hDate = new Date(h.start_time);
                const isCanceled = h.status === 'canceled';
                const d = parseReservationDetails(h); // 詳細解析

                return (
                  <div 
                    key={h.id} 
                    onClick={() => !isCanceled && (setSelectedHistory(h), setShowHistoryDetail(true))}
                    style={{ 
                      padding: '12px', borderBottom: '1px solid #f1f5f9', 
                      background: isCanceled ? '#fcfcfc' : '#fff', 
                      opacity: isCanceled ? 0.6 : 1, cursor: isCanceled ? 'default' : 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: isCanceled ? '#94a3b8' : '#1e293b' }}>
                        {hDate.toLocaleDateString('ja-JP')}
                      </span>
                      <span style={{ color: isCanceled ? '#cbd5e1' : '#e11d48', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        ¥{d.totalPrice.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}>{h.menu_name}</div>
                    
                    {/* 詳細情報（商品・調整・担当者） */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem', color: '#64748b' }}>
                      {d.products.length > 0 && <div>🛍 {d.products.map(p => `${p.name}(x${p.quantity})`).join(', ')}</div>}
                      {d.adjustments.length > 0 && <div style={{ color: '#ef4444' }}>⚙️ {d.adjustments.map(a => a.name).join(', ')}</div>}
                      {h.staffs?.name && <div style={{ fontWeight: 'bold', color: '#4b2c85' }}>👤 {h.staffs.name}</div>}
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
            {/* ✅ 🆕 ここが出し分けの閉じ： )} */}

          </div>
        </div>
      )}
      
                  {/* 👥 3. 予約者選択リストModal (AdminReservationsから完全移植) */}
      {showSlotListModal && (
        <div onClick={() => setShowSlotListModal(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '450px', textAlign: 'center', background: '#f8fafc', padding: '25px' }}>
            
            {/* 👇 🌟 🆕 追加：単発キープの場合は専用の警告ヘッダーを表示 */}
            {selectedSlotReservations.length === 1 && selectedSlotReservations[0].res_type === 'keep' ? (
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
              {/* ねじ込みボタン */}
              <div 
                onClick={() => {
                  setShowSlotListModal(false);
                  navigate(`/shop/${shopId}/reserve`, { 
                    state: { adminDate: selectedDate, adminTime: targetTime, isAdminMode: true, adminStaffId: targetStaffId, fromView: 'timeline' } 
                  });
                }}
                style={{ background: themeColor, padding: '18px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontWeight: 'bold', boxShadow: `0 4px 12px ${themeColor}44`, marginBottom: '10px' }}
              >
                ➕ 新しい予約をねじ込む
              </div>

              {selectedSlotReservations.map((res, idx) => {
                // 🚀 🆕 キープ枠かどうかを判定
                const isKeep = res.res_type === 'keep';
                // 表示用のお名前から [ｷｰﾌﾟ] という内部タグを掃除して綺麗にする
                const displayName = res.customer_name.replace('[ｷｰﾌﾟ] ', '');

                return (
                <div 
                  key={res.id || idx} 
                  onClick={() => { 
                    // 👇 🌟 修正：キープ枠ならアラートを出して何もしない！
                    if (isKeep) {
                      alert("施設側で日程を検討中です。\n名簿が確定するまで詳細はありません。");
                      return;
                    }
                    setShowSlotListModal(false); 
                    openDetail(res); 
                  }} 
                  style={{ background: '#fff', padding: '18px', borderRadius: '18px', border: `1px solid ${isKeep ? '#f97316' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: isKeep ? 'default' : 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}
                >
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1e293b', marginBottom: '4px' }}>
                      {res.res_type === 'blocked' ? `🚫 ${displayName}` 
                        : isKeep ? `🏢 ${displayName} 様 (キープ中)` 
                        : `👤 ${displayName} 様`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {isKeep ? (
                        <div style={{ color: '#f97316', fontWeight: 'bold' }}>施設側で日程確保されています</div>
                      ) : (
                        <>
                          <div style={{ color: themeColor, fontWeight: 'bold' }}>📋 {res.menu_name || 'メニュー未設定'}</div>
                          <div style={{ marginTop: '2px' }}>👤 担当: {res.staffs?.name || '店舗スタッフ'}</div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* 👇 🌟 修正：キープ枠なら「〉」ではなく「⏳」を表示して詳細がないことをアピール */}
                  <div style={{ color: isKeep ? '#f97316' : themeColor, fontSize: '1.2rem' }}>{isKeep ? '⏳' : '〉'}</div>
                </div>
              )})}
            </div>
            <button onClick={() => setShowSlotListModal(false)} style={{ marginTop: '25px', padding: '12px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* ✅ 🆕 追加：プライベート予定入力用モーダル */}
      {showPrivateModal && (
        <div style={overlayStyle} onClick={() => setShowPrivateModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ ...modalContentStyle, maxWidth: '400px', textAlign: 'center', position: 'relative', padding: '35px' }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🕒</div>
            <h3 style={{ margin: '0 0 5px 0', color: themeColor, fontWeight: '900' }}>プライベート予定</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '5px' }}>
              {selectedDate.replace(/-/g, '/')} {targetTime}
            </p>
            {/* 💡 どのスタッフの枠に入れているかを表示 */}
            <p style={{ fontSize: '0.75rem', color: themeColor, fontWeight: 'bold', marginBottom: '25px' }}>
              👤 担当：{staffs.find(s => s.id === targetStaffId)?.name || '担当なし'}
            </p>
            
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={labelStyle}>予定の内容（必須）</label>
              <input 
                type="text" 
                placeholder="例：休憩、買い出し、ミーティングなど" 
                value={privateTaskFields.title}
                onChange={(e) => setPrivateTaskFields({ ...privateTaskFields, title: e.target.value })}
                style={inputStyle}
              />
              
              <label style={labelStyle}>メモ (任意)</label>
              <textarea 
                placeholder="詳細があれば入力してください"
                value={privateTaskFields.note}
                onChange={(e) => setPrivateTaskFields({ ...privateTaskFields, note: e.target.value })}
                style={{ ...inputStyle, height: '100px', lineHeight: '1.5' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={handleSavePrivateTask}
                style={{ width: '100%', padding: '18px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              >
                予定を保存する
              </button>
              <button 
                onClick={() => setShowPrivateModal(false)} 
                style={{ padding: '12px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 🆕 ここから差し込む！：過去の履歴・詳細内訳ポップアップ本体（単価表示版） */}
      <AnimatePresence>
        {showHistoryDetail && selectedHistory && (
          <div style={overlayStyle} onClick={() => setShowHistoryDetail(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ ...modalContentStyle, maxWidth: '400px', padding: '0', overflow: 'hidden', borderRadius: '32px' }}
            >
              {/* ヘッダー：管理画面と同じ紫のデザイン */}
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
                  // 店販売上の計算
                  const productTotal = (d.savedProducts || []).reduce((sum, p) => sum + (Number(p.price) * Number(p.quantity)), 0);
                  const technicalTotal = d.totalPrice - productTotal;

                  return (
                    <>
                      {/* ✂️ 技術セクション：1項目ずつ金額を表示 */}
                      <div style={{ marginBottom: '25px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b2c85', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '12px' }}>
                          <Scissors size={16} /> 施術・技術メニュー
                        </div>

                        {/* 🚀 🆕 追加：担当スタッフ名の表示（技術者が2人以上の場合のみ） */}
                        {staffs.length > 1 && (
                          <div style={{ fontSize: '0.85rem', color: '#4b2c85', fontWeight: 'bold', marginBottom: '15px', paddingLeft: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={14} /> 担当: {selectedHistory.staffs?.name || '担当なし'}
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* ① メインメニューの内訳（単価付き） */}
                          {/* 🚀 🆕 修正：.map の前に ? を追加 */}
                          {d.items?.map((item, i) => (
                            <div key={`item-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                              <span>{item.name}</span>
                              <span>¥{Number(item.price || 0).toLocaleString()}</span>
                            </div>
                          ))}

                          {/* ② 枝分かれオプション */}
                          {/* 🚀 🆕 修正：.map の前に ? を追加 */}
                          {d.subItems?.map((opt, i) => (
                            <div key={`opt-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', paddingLeft: '15px' }}>
                              <span>└ {opt.option_name}</span>
                              <span>+¥{Number(opt.additional_price || 0).toLocaleString()}</span>
                            </div>
                          ))}

                          {/* ③ メニュー調整（割引・加算） */}
                          {/* 🚀 🆕 修正：.map の前に ? を追加 */}
                          {d.savedAdjustments?.map((adj, i) => (
                            <div key={`adj-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444', paddingLeft: '15px' }}>
                              <span>└ {adj.name}</span>
                              <span>{adj.is_minus ? '-' : '+'}¥{Number(adj.price).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 🛍 店販商品セクション（ある場合のみ） */}
                      {d.savedProducts?.length > 0 && (
                        <div style={{ marginBottom: '25px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#008000', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '12px' }}>
                            <ShoppingBag size={16} /> 店販商品
                          </div>
                          {/* 🚀 🆕 修正：ここも .map の前に ? を追加 */}
                          {d.savedProducts?.map((p, i) => (
                            <div key={`prod-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: '8px', paddingLeft: '5px' }}>
                              <span style={{ fontWeight: 'bold' }}>{p.name} <small style={{ color: '#94a3b8' }}>x{p.quantity}</small></span>
                              <span style={{ fontWeight: '900' }}>¥{(p.price * p.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 💰 最終集計パネル */}
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
                      
                      <button onClick={() => setShowHistoryDetail(false)} style={{ width: '100%', marginTop: '25px', padding: '15px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}>詳細を閉じる</button>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 🚀 🆕 ここから追加：カレンダーポップアップ本体 */}
      {/* ======================================================== */}
      {showMobileCalendar && (
        <div style={overlayStyle} onClick={() => setShowMobileCalendar(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ ...modalContentStyle, maxWidth: isPC ? '580px' : '95%', width: '580px', padding: '25px 20px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', padding: '10px', background: '#f8fafc', borderRadius: '18px' }}>
              <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} style={{ border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: '12px', width: '46px', height: '46px', fontSize: '1.1rem', color: themeColor, cursor: 'pointer' }}>◀</button>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>{viewMonth.getFullYear()}年</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '2px' }}>{viewMonth.getMonth() + 1}月</div>
              </div>
              <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} style={{ border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: '12px', width: '46px', height: '46px', fontSize: '1.1rem', color: themeColor, cursor: 'pointer' }}>▶</button>
            </div>

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
                const dStr = date.toLocaleDateString('sv-SE');
                const isSelected = dStr === selectedDate;
                const isToday = dStr === new Date().toLocaleDateString('sv-SE');
                const summary = getDayEventSummary(date);

                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedDate(dStr);
                      setShowMobileCalendar(false);
                    }}
                    style={{ 
                      padding: '6px 0', cursor: 'pointer', borderRadius: '16px',
                      background: summary.isHoliday ? '#f1f5f9' : 'none',
                      opacity: summary.isHoliday ? 0.6 : 1,
                      minHeight: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center'
                    }}
                  >
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.05rem', fontWeight: 'bold',
                      background: isSelected ? themeColor : (isToday ? `${themeColor}15` : 'none'),
                      color: isSelected ? '#fff' : (isToday ? themeColor : (summary.isHoliday ? '#94a3b8' : '#1e293b'))
                    }}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={() => setShowMobileCalendar(false)} style={isPC ? { width: '100%', marginTop: '20px', padding: '14px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' } : { position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>
              閉じる ✕
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🚀 🆕 ここに追加：全顧客検索モーダル本体 */}
      {/* ======================================================== */}
      {showMobileSearchModal && (
        <div style={overlayStyle} onClick={() => { setShowMobileSearchModal(false); setSearchTerm(''); }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '450px', height: '85vh', padding: '0', display: 'flex', flexDirection: 'column', borderRadius: '30px', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>👤 顧客名簿 (50音順)</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', background: '#fcfcfc' }}>
              {(() => {
                let lastLabel = ""; 
                return allCustomers
                  .filter(c => (c.admin_name || c.name || '').includes(searchTerm) || (c.furigana || '').includes(searchTerm) || (c.phone || '').includes(searchTerm))
                  .map((c) => {
                    const currentLabel = getKanaGroup(c.furigana);
                    const isNewGroup = currentLabel !== lastLabel;
                    lastLabel = currentLabel;
                    return (
                      <React.Fragment key={c.id}>
                        {isNewGroup && (
                          <div style={{ padding: '12px 10px 4px', fontSize: '0.8rem', fontWeight: '900', color: themeColor, borderBottom: '1px solid #eee', marginBottom: '8px', background: 'linear-gradient(to right, #fcfcfc, #fff)', position: 'sticky', top: 0, zIndex: 2 }}>
                            {currentLabel}
                          </div>
                        )}
                        <div onClick={() => openCustomerDetail(c)} style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fff', borderRadius: '12px', marginBottom: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1e293b' }}>{c.admin_name || c.name} 様</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>{c.furigana || '---'} / {c.phone || '電話未登録'}</div>
                          </div>
                          <div style={{ color: themeColor, opacity: 0.3 }}>〉</div>
                        </div>
                      </React.Fragment>
                    );
                  });
              })()}
              {allCustomers.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>顧客データを読み込んでいます...</div>}
            </div>
            <div style={{ padding: '20px', background: '#fff', borderTop: '1px solid #f1f5f9', boxShadow: '0 -10px 20px rgba(0,0,0,0.05)', flexShrink: 0 }}>
              <div style={{ position: 'relative', marginBottom: '15px' }}>
                <input type="text" placeholder="名前・フリガナ・電話番号で絞り込み..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...inputStyle, marginBottom: 0, paddingLeft: '40px', background: '#f8fafc', border: `1px solid ${themeColor}22` }} />
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              </div>
              <button onClick={() => { setShowMobileSearchModal(false); setSearchTerm(''); }} style={{ width: '100%', padding: '16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* 👇 🌟 🆕 ここから追加：確定期限間近・新着キープのアラート詳細モーダル */}
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
      {/* 👆 アラート詳細モーダル追加ここまで */}

      {/* 🚀 🆕 【追加】スマホ用：ボトムナビゲーション */}
      {!isPC && !isPreviewMode && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: '75px',
          background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex',
          justifyContent: 'space-around', alignItems: 'center', zIndex: 2000,
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 15px rgba(0,0,0,0.05)'
        }}>
          <button onClick={() => { navigate(`/admin/${shopId}/dashboard`); }} style={mobileTabStyle(false, '#64748b')}>
            <Settings size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>設定</span>
          </button>

          <button onClick={() => { navigate(`/admin/${shopId}/today-tasks`); }} style={mobileTabStyle(false, '#1e293b')}>
            <Clipboard size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>タスク</span>
          </button>

          <button onClick={() => { navigate(`/admin/${shopId}/inventory`); }} style={mobileTabStyle(false, '#f59e0b')}>
            <PackageOpen size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>在庫</span>
          </button>

          <button onClick={() => { goToday(); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: `${themeColor}15`, border: `1px solid ${themeColor}33`, color: themeColor, borderRadius: '15px', padding: '8px 15px', cursor: 'pointer' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>今日</span>
          </button>

          <button onClick={() => { navigate(`/admin/${shopId}/management`); }} style={mobileTabStyle(false, '#008000')}>
            <BarChart3 size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>管理</span>
          </button>
        </div>
      )}

    </div>
  );
}

// スタイル (省略なし)
const switchBtnStyle = (active) => ({ padding: '5px 15px', borderRadius: '6px', border: 'none', background: active ? '#fff' : 'transparent', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', boxShadow: active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', color: active ? '#1e293b' : '#64748b' });

// 🚀 🆕 追加：ボトムナビゲーション用のスタイル
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

// 🆕 ここに差し込み：電話やマップの小さなボタン用スタイル
const badgeStyle = (color) => ({
  textDecoration: 'none',
  background: color,
  color: '#fff',
  padding: '2px 10px',
  borderRadius: '6px',
  fontSize: '0.65rem',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  boxShadow: `0 2px 4px ${color}33`, // ボタンの色に合わせた薄い影
  transition: 'transform 0.1s active',
  cursor: 'pointer'
});

const navBtnStyle = { background: '#f1f5f9', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' };
const modalContentStyle = { background: '#fff', width: '95%', borderRadius: '25px', padding: '30px', maxHeight: '85vh', overflowY: 'auto' };
const labelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', fontSize: '1rem', boxSizing: 'border-box' };

export default AdminTimeline;