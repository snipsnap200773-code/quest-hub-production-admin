import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase, supabaseAnon } from '../supabaseClient';
import { Loader2, Sparkles, Clock } from 'lucide-react';
// 🎮 🆕 ゲームとの連絡係をインポート [cite: 2026-03-01]
import { triggerGameEvent } from '../components/game/GameBridge';
// 🚀 🆕 admin側：ConfirmReservation.jsx の最上部（Step 1）
import { gameServices } from '../components/game/services/gameServices';

// 🆕 ねじ込み予約の顧客検索・一覧用の道具
// 顧客名簿に紛れているブロック用の名前（予約管理画面の顧客名簿と同じ）
const BLOCK_NAMES = ['臨時休業', '管理者ブロック', '休憩', '銀行', '買い出し', '移動'];

// 検索用に文字をそろえる：全角/半角・大文字/小文字・カタカナ/ひらがな・空白の違いをなくす
const normalizeForSearch = (s) =>
  (s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '');

// あいうえお順の見出し（濁音・半濁音・小さい字も含める）
const KANA_ROWS = [
  ['あ行', 'ぁ', 'お'], ['か行', 'か', 'ご'], ['さ行', 'さ', 'ぞ'], ['た行', 'た', 'ど'],
  ['な行', 'な', 'の'], ['は行', 'は', 'ぽ'], ['ま行', 'ま', 'も'], ['や行', 'ゃ', 'よ'],
  ['ら行', 'ら', 'ろ'], ['わ行', 'ゎ', 'ん']
];
const KANA_ROW_ORDER = [...KANA_ROWS.map(r => r[0]), 'その他'];
const getKanaRow = (key) => {
  const ch = (key || '').charAt(0);
  const row = KANA_ROWS.find(([, from, to]) => ch >= from && ch <= to);
  return row ? row[0] : 'その他';
};

function ConfirmReservation() {
  const { shopId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // 🆕 修正1：Stateの追加（ここに4つのStateを定義します）
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 🆕 ねじ込み予約：お客様の選び方（'existing' 既存 / 'new' 新規）
  const [customerMode, setCustomerMode] = useState('existing');
  const [allCustomers, setAllCustomers] = useState([]);   // 既存のお客様（検索・一覧用）
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showAllList, setShowAllList] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [staffName, setStaffName] = useState('');
  // 🆕 追記：自動入力通知の表示管理 [cite: 2025-12-01]
  const [showAutoFillToast, setShowAutoFillToast] = useState(false);
  const [customAnswers, setCustomAnswers] = useState({});

  const { 
    people, 
    totalSlotsNeeded, 
    date, 
    time, 
    adminDate, 
    adminTime, 
    lineUser, 
    customShopName,
    staffId,
    fromView,
    visitorZip,
    visitorAddress,
    travelTimeMinutes,
    authUserProfile,
    isSalesExcluded,
    adminBizType,
    serviceMode
  } = location.state || {};
  
// 🚀 🆕 追加：URLの末尾にある ?type=○○ を読み取る処理
  const params = new URLSearchParams(window.location.search);
  const urlBizType = params.get('type');
  
  // 👇 追加：プレビューモードかどうかを判定
  const isPreviewMode = params.get('mode') === 'preview';

  // 💡 管理者ねじ込みならstateの値を、お客様予約ならURLの値を最終的なキーとして採用する
  const finalBizType = adminBizType || urlBizType;
  
  const isAdminEntry = !!adminDate;


  const [shop, setShop] = useState(null);

  

  // 🆕 一括管理用のStateに変更
const [customerData, setCustomerData] = useState({
    name: '', 
    furigana: '', 
    email: '', 
    phone: '', 
    zip_code: visitorZip || '', 
    address: visitorAddress || '', // 🆕 届いた住所があればそれをセット、なければ空
    parking: '', 
    building_type: '', 
    care_notes: '', 
    company_name: '', 
    symptoms: '', 
    request_details: '', 
    notes: ''
  });
    const [formConfig, setFormConfig] = useState(null); // 🆕 フォーム設定用

// 🆕 46行目付近：fetchShop
  const fetchShop = async () => {
    try {
      console.log("🔍 クエストデータ取得開始... shopId:", shopId);
      // ⚠️ 2026/09/06：profiles への直接アクセスを廃止し、予約用ビュー
      //    public_booking_settings に変更しました。
      //    店舗の連絡先メール（email_contact）は Edge Function 側が
      //    shopId から自分で引くため、ここでは不要になっています。
      const { data, error } = await supabase
        .from('public_booking_settings')
        .select('*')
        .eq('id', shopId)
        .maybeSingle();
      
      if (error) {
        console.error("❌ Supabaseエラー:", error.message);
        return;
      }

if (data) {
        console.log("✅ クエストデータ取得成功:", data.business_name);
        setShop(data);
        const config = data.form_config || {};
        setFormConfig(config);
        
        // 🆕 カスタム質問があれば、回答Stateの初期値をセット
        if (config.custom_questions) {
          const initialAnswers = {};
          config.custom_questions.forEach(q => {
            initialAnswers[q.id] = ''; // 最初は未選択
          });
          setCustomAnswers(initialAnswers);
        }
      }
            else {
        console.warn("⚠️ データが空です。IDが間違っている可能性があります。");
      }
    } catch (err) {
      console.error("🔥 通信エラー:", err);
    }
  };

  // 🆕 修正：fetchStaffName をここに定義します！
const fetchStaffName = async () => {
    try {
      if (staffId) {
        // 1. 指名（staffId）がある場合はその人を優先
        // ⚠️ 2026/09/25：staffs への直接アクセスを廃止し、公開用ビュー public_booking_staffs に変更（memo などを出さないため）
        const { data } = await supabase.from('public_booking_staffs').select('name').eq('id', staffId).single();
        if (data) setStaffName(data.name);
      } else {
        // 🆕 2. 指名がない場合、店舗の全スタッフを確認
        const { data: staffs } = await supabase.from('public_booking_staffs').select('name').eq('shop_id', shopId);
        
        if (staffs && staffs.length === 1) {
          // 🏆 スタッフが1人しかいないなら、その人を自動的に担当者にセット
          console.log("👤 1人営業のため担当者を自動設定:", staffs[0].name);
          setStaffName(staffs[0].name);
        }
      }
    } catch (err) {
      console.error("🔥 スタッフ取得エラー:", err);
    }
  };

// --- 修正後：Google/LINE共通でDBから全13項目を詳細に反映 ---
useEffect(() => {
  const checkUserAndStore = async () => {
    // 🆕 もし管理者による「ねじ込み（isAdminEntry）」なら、
    // ログイン中のGoogleユーザー（ハム太郎）の情報は一切使わず、真っさらな状態で始める
    if (isAdminEntry) {
      console.log("⚡ 管理者ねじ込みモード：ログインユーザー情報を無視します");
      return; 
    }

    // 以下は、一般客がマイページ等から予約する場合の既存ロジック
    if (authUserProfile) {
      setCustomerData(prev => ({
        ...prev,
        name: prev.name || authUserProfile.display_name || '',
        email: prev.email || authUserProfile.email || '',
        phone: prev.phone || authUserProfile.phone || '',
        zip_code: prev.zip_code || authUserProfile.zip_code || '',
        address: prev.address || authUserProfile.address || '',
      }));

      // 🆕 通知をフワッと出す [cite: 2025-12-01]
      setShowAutoFillToast(true);
      setTimeout(() => setShowAutoFillToast(false), 3000); // 3秒後に消す
    }

    // ⚠️ 2026/09/16：LINE ID による customers の検索（過去の入力内容の自動入力）を廃止しました（【AX】）。
    //    LINE の userId はブラウザから送られる値で本人確認にならず、
    //    他人の userId を送るとその人の症状・住所などが読めてしまうためです。
    if (lineUser?.displayName) {
      setCustomerData(prev => ({ ...prev, name: prev.name || lineUser.displayName }));
    }
  };
  checkUserAndStore();
  fetchShop();
  fetchStaffName();
}, [lineUser, authUserProfile, shopId]);

// 🆕 ねじ込み予約（既存）：この店舗のお客様をまとめて読み込む（1000件の壁を越えて全件）
  useEffect(() => {
    if (!isAdminEntry) return;
    const loadCustomers = async () => {
      setIsCustomersLoading(true);
      const pageSize = 1000;
      let page = 0;
      let rows = [];
      while (true) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, admin_name, furigana, phone, email, zip_code, address, parking, is_facility')
          .eq('shop_id', shopId)
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) { console.error('顧客一覧の取得に失敗しました:', error.message); break; }
        if (!data || data.length === 0) break;
        rows = rows.concat(data);
        if (data.length < pageSize) break;
        page++;
      }
      const list = rows
        .filter(c => !c.is_facility && !BLOCK_NAMES.includes((c.name || '').trim()))
        .map(c => {
          const displayName = c.admin_name || c.name || '';
          const sortKey = normalizeForSearch(c.furigana) || normalizeForSearch(displayName);
          return {
            ...c,
            displayName,
            sortKey,
            kanaRow: getKanaRow(sortKey),
            searchKey: [c.name, c.admin_name, c.furigana].map(normalizeForSearch).join('|'),
            phoneDigits: (c.phone || '').replace(/[^0-9]/g, '')
          };
        })
        .sort((a, b) => {
          const ra = KANA_ROW_ORDER.indexOf(a.kanaRow);
          const rb = KANA_ROW_ORDER.indexOf(b.kanaRow);
          if (ra !== rb) return ra - rb;
          return a.sortKey.localeCompare(b.sortKey, 'ja');
        });
      setAllCustomers(list);
      setIsCustomersLoading(false);
    };
    loadCustomers();
  }, [isAdminEntry, shopId]);

  // 🆕 画面に出すリスト（検索語があれば絞り込み、なければ「一覧」を開いたときだけ全員）
  const visibleCustomers = useMemo(() => {
    const q = normalizeForSearch(searchText);
    if (!q) return showAllList ? allCustomers : [];
    const digits = q.replace(/[^0-9]/g, '');
    const isPhoneQuery = /^[0-9-]+$/.test(q) && digits.length >= 2;
    return allCustomers.filter(c =>
      c.searchKey.includes(q) || (isPhoneQuery && c.phoneDigits.includes(digits))
    );
  }, [searchText, showAllList, allCustomers]);

  // 🆕 既存のお客様を選ぶ
  const handleSelectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustomerData(prev => ({
      ...prev,
      name: c.name || c.admin_name || '',
      furigana: c.furigana || '',
      phone: c.phone || '',
      email: c.email || '',
      zip_code: c.zip_code || '',
      address: c.address || '',
      parking: c.parking || ''
    }));
    setSearchText('');
    setShowAllList(false);
    setSelectedIndex(-1);
  };

  // 🆕 選んだお客様を外す
  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerData(prev => ({
      ...prev, name: '', furigana: '', phone: '', email: '', zip_code: '', address: '', parking: ''
    }));
  };

  // 🆕 「既存」「新規」の切り替え（前のモードの入力は持ち越さない）
  const switchCustomerMode = (mode) => {
    if (mode === customerMode) return;
    setCustomerMode(mode);
    clearSelectedCustomer();
    setSearchText('');
    setShowAllList(false);
    setSelectedIndex(-1);
  };

  // 🆕 PC：↑↓で候補を移動、Enterで選択、Escで閉じる
  const handleSearchKeyDown = (e) => {
    if (visibleCustomers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, visibleCustomers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectCustomer(visibleCustomers[selectedIndex]);
    } else if (e.key === 'Escape') {
      setSearchText('');
      setShowAllList(false);
      setSelectedIndex(-1);
    }
  };

  // 🆕 2. 入力ハンドラとスタイルの追加
  // 様々な入力項目（名前、住所、備考など）を一つのStateで管理するための関数
const handleInputChange = (e) => {
    let { name, value } = e.target;
    
    // 🆕 電話番号（phone）の場合は数字以外をその場で消す [cite: 2025-12-01]
    if (name === 'phone') {
      value = value.replace(/[^0-9]/g, '');
    }

    setCustomerData(prev => ({ ...prev, [name]: value }));
  };

  // 動的に生成される入力フォーム（input/select/textarea）で共通利用するスタイル定義
  const inputStyle = { 
    width: '100%', 
    padding: '14px', 
    borderRadius: '10px', 
    border: '1px solid #ddd', 
    boxSizing: 'border-box', 
    fontSize: '1rem' 
  };

// ✅ 修正後の保存ロジック（handleReserve）
const handleReserve = async () => {
    // 🆕 ねじ込み：既存はお客様を選んでから、新規はお名前を入れてから
    if (isAdminEntry) {
      if (customerMode === 'existing' && !selectedCustomer) {
        alert('お客様を選択してください。');
        return;
      }
      if (customerMode === 'new' && !customerData.name.trim()) {
        alert('お名前を入力してください。');
        return;
      }
    }

    // 🚀 🆕 【ガード1】そもそも名前や日時がない場合は処理を完全に中断する
    if (!customerData.name || (!adminDate && !date) || (!adminTime && !time)) {
      console.error("🚫 予約データが不足しています。処理を中断しました。");
      alert("予約情報が正しく読み込めていません。もう一度最初からやり直してください。");
      return;
    }
    // A. 標準項目のチェック（お名前、電話番号、住所など）
    for (const [key, config] of Object.entries(formConfig)) {
      // 🆕 カスタム質問の配列はここではスキップする [cite: 2025-12-01]
      if (key === 'custom_questions') continue;

      const isEnabled = lineUser ? config.line_enabled : config.enabled;
      
      // 🆕 「設定画面で必須にチェックされている」かつ「表示されている」場合のみチェック [cite: 2025-12-01]
      if (isEnabled && config.required) {
        if (isAdminEntry && key !== 'name') continue; // 管理者ねじ込み時は名前以外スルー
        
        if (!customerData[key]) {
          alert(`${config.label}を入力してください`);
          return;
        }
      }
    }

    // 🆕 B. カスタム質問（ラジオボタン）の必須チェックを追加 [cite: 2025-12-01]
    if (formConfig.custom_questions && !isAdminEntry) {
      for (const q of formConfig.custom_questions) {
        const isEnabled = lineUser ? q.line_enabled : q.enabled;
        
        // 🆕 必須設定になっていて、かつ回答（customAnswers）が空の場合 [cite: 2025-12-01]
        if (isEnabled && q.required) {
          if (!customAnswers[q.id]) {
            alert(`質問「${q.label}」に回答してください`);
            return;
          }
        }
      }
    }

    setIsSubmitting(true);

    try {
      // --- 🛡️ 修正：日時と終了バッファの計算を先に行う（最終チェックで終了時刻が必要なため） ---
      const targetDate = adminDate || date;
      const targetTime = adminTime || time;
      const startDateTime = new Date(`${targetDate}T${targetTime}:00+09:00`);

      // 🆕 日時と終了バッファの計算（準備時間を確実に含める）
      // 🆕 1日貸切モード対応：終了時刻の算出ロジック
      const interval = shop.slot_interval_min || 15;
      const buffer = shop.buffer_preparation_min || 0;

      // 現在選択されている全メニューの中から「1日貸切」設定のものを探す
      const selectedServicesList = (people || []).flatMap(p => p.services || []);
      const fullDayMenu = selectedServicesList.find(s => s.is_full_day);

      let totalMinutes;

      if (fullDayMenu) {
        // 💡 1日貸切の場合
        if (fullDayMenu.restricted_hours && fullDayMenu.restricted_hours.length > 0) {
          // 設定された「受付時間制限」の終了時刻までを占有
          const activeRange = fullDayMenu.restricted_hours.find(r => targetTime >= r.start && targetTime < r.end);
          if (activeRange) {
            const [startH, startM] = targetTime.split(':').map(Number);
            const [endH, endM] = activeRange.end.split(':').map(Number);
            totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
          } else {
            totalMinutes = (totalSlotsNeeded * interval) + buffer + (travelTimeMinutes || 0);
          }
        } else {
          // 制限がない場合は「店舗の閉店時間」までを占有
          const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(targetDate).getDay()];
          const closeTime = shop.business_hours?.[dayOfWeek]?.close || "18:00";
          const [startH, startM] = targetTime.split(':').map(Number);
          const [closeH, closeM] = closeTime.split(':').map(Number);
          totalMinutes = (closeH * 60 + closeM) - (startH * 60 + startM);
        }
      } else {
        // 通常メニューの場合
        totalMinutes = (totalSlotsNeeded * interval) + buffer + (travelTimeMinutes || 0);
      }

      const endDateTime = new Date(startDateTime.getTime() + totalMinutes * 60000);

      // 💡 🛡️ 修正：ここでは「容量の数字」だけを計算する。
      // 実際の重複チェック（本当に空いているか）は、後段の book_reservation_safely 関数の中で、
      // 排他ロックを取った状態でDB側が最終的に行う（ここでのカウントクエリはもう不要なので削除）。
      let finalStaffMax = null;   // null = 容量チェックの対象外（管理者ねじ込み時など）
      let finalStoreMax = null;

      if (!isAdminEntry) {
        // 1. 店舗の全スタッフの最新シフトを取得
        const { data: allStaffs } = await supabase.from('public_booking_staffs').select('*').eq('shop_id', shopId);
        if (allStaffs) {
          // 🆕 修正：曜日判定も日本時間基準に統一する
          const dObj = new Date(`${targetDate}T00:00:00+09:00`);
          const dayIdx = dObj.getDay();
          
          // 2. その時間に出勤しているスタッフを厳選
          const workingStaffs = allStaffs.filter(s => {
            if (s.weekly_holidays?.includes(dayIdx)) return false;
            const shift = s.custom_shifts?.[targetDate];
            if (shift) {
              if (shift.type === 'off') return false;
              if (shift.type === 'time' && (targetTime < shift.start || targetTime >= shift.end)) return false;
            }
            return true;
          });

          // 3. 役割ごとに分類し、お店全体の動的キャパシティを計算
          const workingStylists = workingStaffs.filter(s => s.role_type === 'stylist' || !s.role_type);
          const workingAssistants = workingStaffs.filter(s => s.role_type === 'assistant');
          const hasAssistant = workingAssistants.length > 0;
          finalStoreMax = workingStylists.length + workingAssistants.reduce((sum, a) => sum + (a.concurrent_capacity || 1), 0);

          // 4. 【ガード1】指名スタッフがそもそも出勤しているか？（レースコンディションと無関係な事前チェックなので、そのまま残す）
          if (staffId) {
            const targetStaff = workingStaffs.find(s => s.id === staffId);
            if (!targetStaff) {
              alert('申し訳ありません。選択された担当スタッフのシフト（お休み・時間外）と重なってしまいました。別の日時を選択してください。');
              setIsSubmitting(false);
              return;
            }

            // 5. 指名スタッフの「個人上限」を計算（実際のチェックはDB関数側で行う）
            finalStaffMax = targetStaff.concurrent_capacity || 1;
            if (!hasAssistant && shop?.restrict_stylist_without_assistant) {
              finalStaffMax = 1; // 🛡️ 平等モード：アシスタント不在時は強制的に1名に制限
            }
          }
        }
      }

      // --- ここから下は既存の保存処理 ---
      const getDetailedMenuLabel = () => {
        if (!people || people.length === 0) return 'メニューなし';
        
        return people.map((p, i) => {
          const personPrefix = people.length > 1 ? `${i + 1}人目: ` : '';
          const mainService = p.services.map(s => s.name).join(', ');
          
          // 💡 optionsが配列(複数選択)でもオブジェクト(単一選択)でも対応
          const allOpts = Object.values(p.options || {}).flat().filter(Boolean);
          const optNames = allOpts.map(o => o.option_name).join(', ');
          
          return optNames ? `${personPrefix}${mainService}（${optNames}）` : `${personPrefix}${mainService}`;
        }).join(' / ');
      };

      const menuLabel = getDetailedMenuLabel();

      // ⚠️ 2026/09/16：一般客の予約ではトークンをサーバーが発行します（下で上書き）。
      let cancelToken = crypto.randomUUID();
      let cancelUrl = `https://questhub-portal.vercel.app/cancel?token=${cancelToken}`;

      let finalStaffId = staffId;
      let finalStaffName = staffName;

      // スタッフ自動特定（1名のみの場合）
      if (!finalStaffId) {
        const { data: staffs } = await supabase.from('public_booking_staffs').select('id, name').eq('shop_id', shopId);
        if (staffs && staffs.length === 1) {
          finalStaffId = staffs[0].id;
          finalStaffName = staffs[0].name;
        }
      }

      // ⚠️ 2026/09/16：一般客の予約は RPC book_public_reservation に一本化しました（【AX】）。
      //    既存客の検索・顧客名簿の更新・予約登録をサーバー側で行い、
      //    ブラウザには顧客情報を一切返しません。
      //    店舗のねじ込み（isAdminEntry）は従来どおりです。
      const handleBookError = (err) => {
        const msg = err?.message || '';
        if (msg.includes('STAFF_FULL')) {
          alert('申し訳ありません！タッチの差で指名スタッフの予約枠が埋まってしまいました。');
          navigate(`/shop/${shopId}/reserve`);
          return true;
        }
        if (msg.includes('STORE_FULL')) {
          alert('申し訳ありません！タッチの差でお店全体の予約が埋まってしまいました。もう一度時間を選び直してください。');
          navigate(`/shop/${shopId}/reserve`);
          return true;
        }
        if (msg.includes('SHOP_UNAVAILABLE')) {
          alert('現在、この店舗はWeb予約を受け付けていません。');
          return true;
        }
        if (msg.includes('INVALID_STAFF') || msg.includes('INVALID_INPUT')) {
          alert('予約情報が正しく読み込めていません。もう一度最初からやり直してください。');
          return true;
        }
        return false;
      };

      let existingCust = null;
      let finalDisplayName = customerData.name;

      if (!isAdminEntry) {
        const { data: booked, error: bookError } = await supabase.rpc('book_public_reservation', {
          p_shop_id: shopId,
          p_staff_id: finalStaffId || null,
          p_start_time: startDateTime.toISOString(),
          p_end_time: endDateTime.toISOString(),
          p_staff_max: finalStaffMax,
          p_store_max: finalStoreMax,
          p_reservation_date: targetDate,
          p_total_slots: totalSlotsNeeded,
          p_biz_type: location.state?.bizType || null,
          p_line_user_id: lineUser?.userId || null,
          p_menu_name: menuLabel,
          p_options: {
            people: people,
            applied_shop_name: customShopName || shop.business_name,
            is_sales_excluded: isSalesExcluded,
            visit_info: {
              address: customerData.address,
              parking: customerData.parking,
              custom_answers: customAnswers
            },
            // ⚠️ 2026/09/23【BH】：予約ごとの入力内容を予約の行に残します。
            //    既存客の場合、customers は空の項目しか更新しないため、
            //    今回の備考・症状などが DB のどこにも残っていませんでした。
            //    resend（booking）はここから読んで店舗に通知します。
            form_input: {
              furigana: customerData.furigana || '',
              building_type: customerData.building_type || '',
              care_notes: customerData.care_notes || '',
              company_name: customerData.company_name || '',
              symptoms: customerData.symptoms || '',
              request_details: customerData.request_details || '',
              notes: customerData.notes || '',
              service_mode: location.state?.serviceMode || 'salon'
            }
          },
          p_customer: {
            name: customerData.name,
            furigana: customerData.furigana,
            phone: customerData.phone,
            email: customerData.email,
            zip_code: customerData.zip_code || visitorZip || '',
            address: customerData.address,
            parking: customerData.parking,
            building_type: customerData.building_type,
            care_notes: customerData.care_notes,
            company_name: customerData.company_name,
            symptoms: customerData.symptoms,
            request_details: customerData.request_details,
            notes: customerData.notes,
            custom_answers: customAnswers
          }
        });

        if (bookError) {
          if (handleBookError(bookError)) { setIsSubmitting(false); return; }
          throw bookError;
        }

        cancelToken = booked.cancel_token;
        cancelUrl = `https://questhub-portal.vercel.app/cancel?token=${cancelToken}`;

      } else {
        // --- 店舗のねじ込み ---
        let finalCustomerId = null;

        if (customerMode === 'existing') {
          // 🆕 既存：選んだお客様を、最新の来店回数・表示名ごと読み直す
          //    （以前は候補から選ぶと existingCust が空のままで、来店回数が 1 に戻っていました）
          const { data: picked, error: pickError } = await supabase
            .from('customers')
            .select('id, name, admin_name, total_visits')
            .eq('id', selectedCustomer.id)
            .eq('shop_id', shopId)
            .maybeSingle();
          if (pickError) throw pickError;
          if (!picked) {
            alert('選択したお客様が見つかりませんでした。もう一度選び直してください。');
            return;
          }
          finalCustomerId = picked.id;
          existingCust = picked;
        }
        // 🆕 新規：照合はせず、下の insert で新しい名簿を作る

        if (finalCustomerId) {
          const updatePayload = {
            total_visits: (existingCust?.total_visits || 0) + 1,
            last_arrival_at: startDateTime.toISOString(),
            updated_at: new Date().toISOString()
          };
          if (customerData.furigana?.trim()) updatePayload.furigana = customerData.furigana;
          const cleanPhone = customerData.phone?.replace(/[^0-9]/g, '');
          if (cleanPhone) updatePayload.phone = cleanPhone;
          if (customerData.email?.trim()) updatePayload.email = customerData.email;
          await supabase.from('customers').update(updatePayload).eq('id', finalCustomerId);
        } else {
          const { data: newCust, error: insError } = await supabase.from('customers').insert([{
            shop_id: shopId,
            name: customerData.name,
            furigana: customerData.furigana || null,
            phone: customerData.phone?.replace(/[^0-9]/g, '') || null,
            email: customerData.email || null,
            total_visits: 1,
            last_arrival_at: startDateTime.toISOString(),
            updated_at: new Date().toISOString()
          }]).select().single();
          if (insError) throw insError;
          finalCustomerId = newCust.id;
        }

        finalDisplayName = existingCust?.admin_name || existingCust?.name || customerData.name;

        const { error: dbError } = await supabase.rpc('book_reservation_safely', {
          p_shop_id: shopId,
          p_staff_id: finalStaffId,
          p_start_time: startDateTime.toISOString(),
          p_end_time: endDateTime.toISOString(),
          p_staff_max: finalStaffMax,
          p_store_max: finalStoreMax,
          p_bypass_check: true,
          p_customer_id: finalCustomerId,
          p_reservation_date: targetDate,
          p_customer_name: finalDisplayName,
          p_customer_phone: customerData.phone || '---',
          p_customer_email: customerData.email || null,
          p_zip_code: customerData.zip_code || null,
          p_total_slots: totalSlotsNeeded,
          p_biz_type: location.state?.bizType || null,
          p_line_user_id: null,
          p_cancel_token: cancelToken,
          p_menu_name: menuLabel,
          p_options: {
            people: people,
            applied_shop_name: customShopName || shop.business_name,
            is_sales_excluded: isSalesExcluded,
            visit_info: { address: customerData.address, parking: customerData.parking, custom_answers: customAnswers }
          }
        });

        if (dbError) {
          if (handleBookError(dbError)) { setIsSubmitting(false); return; }
          throw dbError;
        }
      }

      // 🚀 🆕 【ガード2】isAdminEntryでない、かつ名前・日付・時間が揃っている時だけ通知を送る

      if (!isAdminEntry && finalDisplayName && targetDate && targetTime) {
        // ⚠️ 2026/09/23【BH】：予約を特定する鍵（cancelToken）だけを送ります。
        //    resend はこの値で予約を DB から読み、宛先・名前・入力内容・店舗名は
        //    すべてサーバー側で決めます（ブラウザの値は使いません）。
        //    予約ごとの入力内容は、上の book_public_reservation で options.form_input に保存済みです。
        await supabaseAnon.functions.invoke('resend', {
          body: {
            type: 'booking',
            cancelToken: cancelToken
          }
        });
      } else if (!isAdminEntry) {
        // 🚀 🆕 データが空だった場合のログを残す（デバッグ用）
        console.warn("⚠️ 予約データが不完全なため通知をスキップしました:", { finalDisplayName, targetDate, targetTime });
      }
      
      // 🏨 🎮 🚀 【創世神・直撃インジェクション電線（Supabase直叩き補強版）】
      console.log("🔥 [爆速チェック] 今まさに予約が成功し、画面が遷移する直前です！");

      // 💡 既存の引き継ぎがundefinedでも、ここでSupabaseの最新セッションから直接ユーザーIDをもぎ取る！[cite: 7]
      let finalUserId = authUserProfile?.id;
      if (!finalUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        finalUserId = session?.user?.id;
      }
      
      console.log("👤 確定したログインユーザーID ➔:", finalUserId);

            let resChar = null;

      // ⚠️ 2026/09/22：ゲームは開発中で未公開のため、キャラ付与は開発者のアカウントだけにしました。
      //    以前は「今ログインしている人」全員に付与していたため、店舗オーナーが
      //    ねじ込みをするとオーナー自身にキャラクターが作られていました。
      //    公開時にこの条件を外し、「予約したお客様本人」に付与する形へ作り直すこと。
      const GAME_DEV_USER_ID = 'd1669717-95f4-4f80-932f-d412576d55a7';

      if (finalUserId && finalUserId === GAME_DEV_USER_ID) {
        try {
          console.log("⚙️ ユーザーIDを正常に掴みました。gameServices.grantCharacterFromReservation を実行！");
          // 💡 非同期（await）で確実にインサートを完了させてから画面を遷移させる鉄壁の同期
          resChar = await gameServices.grantCharacterFromReservation(finalUserId, shopId);
        } catch (gameErr) {
          console.error("🚨 ゲーム支給関数がクラッシュしました:", gameErr);
        }
      }

      // 🚀 ここから画面遷移ロジックへ
      if (isAdminEntry) {
        // 🚀 🆕 修正：タイムラインから来た場合はタイムラインに戻る分岐を追加
        if (fromView === 'timeline') {
          navigate(`/admin/${shopId}/timeline?date=${targetDate}`, { 
            state: { 
              newlyAdded: true, 
              fromReserve: true, 
              targetTime: adminTime || time 
            } 
          });
        } else {
          // 従来のルート（カレンダーから来た場合はカレンダーに戻る）
          navigate(`/admin/${shopId}/reservations?date=${targetDate}`, { 
            state: { 
              newlyAdded: true, 
              fromReserve: true, 
              targetTime: adminTime || time 
            } 
          });
        }
      } else {
        // 🚀 🆕 インジェクション成功データからキャラクターのカスタムネームを安全に抽出
        const acquiredName = resChar?.success && resChar.character ? resChar.character.custom_name : null;

        // 🚀 一般ユーザーは達成感を味わってもらうために「完了ページ」へ
        navigate('/reserved-success', { 
          state: { 
            shopName: customShopName || shop.business_name,
            startTime: `${targetDate.replace(/-/g, '/')} ${targetTime}`,
            acquiredCharacter: acquiredName // 🚀 🆕 これで『クレリック』などの名前が完了画面へ向けてシュートされます！
          } 
        });
      }

    } catch (err) {
      console.error(err);
      alert(`エラーが発生しました: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };    
// 🆕 読み込み中であることを視覚化する
  if (!shop) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ marginBottom: '20px', fontSize: '2rem', animation: 'spin 2s linear infinite' }}>⌛</div>
        <p style={{ fontWeight: 'bold' }}>クエスト情報を読み込み中...</p>
        <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>画面が変わらない場合は、DB接続を確認してください。</p>
      </div>
    );
  }
  
  const themeColor = shop?.theme_color || '#2563eb';
  
  // 👇 修正：プレビュー画面などで日付がない場合のクラッシュを防ぐ安全処理を追加
  const displayDate = (adminDate || date) ? String(adminDate || date).replace(/-/g, '/') : '----/--/--';
  const displayTime = adminTime || time || '--:--';

  // ✅ 🆕 修正：選択中の全メニューから「時間制限」があるものを抽出
  const selectedServices = (people || []).flatMap(p => p.services || []);
  const restrictedServices = selectedServices.filter(s => s.restricted_hours && s.restricted_hours.length > 0);

return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333' }}>

      {/* 🚀 🆕 ここから追加：送信中のフルスクリーン・メッセージ */}
      {isSubmitting && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.9)', // 白背景で少し透けさせる
          zIndex: 10000, // 他の要素より一番上に
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          backdropFilter: 'blur(5px)' // 背景をぼかすとおしゃれです
        }}>
          {/* グルグル回るアイコン */}
          <Loader2 size={48} color={themeColor} style={{ animation: 'spin 1s linear infinite' }} />
          
          <div style={{ textAlign: 'center', padding: '0 20px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontWeight: '900' }}>
              予約を送信中...
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: '1.6' }}>
              <b>この処理は10秒ほどかかる場合があります。</b><br />
              画面を閉じずにお待ちください。
            </p>
          </div>
        </div>
      )}
      {/* 🚀 🆕 ここまで追加 */}
      
      {/* 🆕 1. ここに追加：自動入力通知 [cite: 2025-12-01] */}
      <div style={{
        position: 'fixed',
        top: showAutoFillToast ? '20px' : '-60px', // showAutoFillToastがtrueの時だけ降りてくる
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#07aadb', // ポータルカラー
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '50px',
        fontSize: '0.85rem',
        fontWeight: '900',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 10px 25px rgba(7, 170, 219, 0.4)',
        transition: 'all 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28)', // 弾むようなアニメーション [cite: 2026-03-02]
        pointerEvents: 'none' // 下にあるボタンの邪魔をしない
      }}>
        <Sparkles size={18} />
        <span>マイページの情報を反映しました</span>
      </div>

      {/* --- 以下、既存の「戻る」ボタンなどが続きます --- */}
      <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', border: 'none', background: 'none', color: '#666', cursor: 'pointer', fontWeight: 'bold' }}>← 戻る</button>
      
      <h2 style={{ borderLeft: isAdminEntry ? '4px solid #e11d48' : `4px solid ${themeColor}`, paddingLeft: '10px', fontSize: '1.2rem', marginBottom: '25px' }}>
          {isAdminEntry ? '⚡ 店舗ねじ込み予約（入力短縮）' : '予約内容の確認'}
      </h2>

      {lineUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
          <img src={lineUser.pictureUrl} style={{ width: '40px', height: '40px', borderRadius: '50%' }} alt="LINE" />
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534' }}>LINE連携：{lineUser.displayName} 様</div>
        </div>
      )}

      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '15px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
        <p style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 'bold', color: themeColor }}>
          🏨 {customShopName || shop.business_name}
        </p>
        
        {/* 👇 🌟 🆕 追加：ご利用形式の表示 */}
        {location.state?.serviceMode && (
          <p style={{ margin: '0 0 12px 0' }}>
            📍 <b>ご利用形式：</b> {location.state.serviceMode === 'visit' ? '🚗 訪問・出張' : '🏢 店舗へ行く（来店）'}
          </p>
        )}
        
        <p style={{ margin: '0 0 12px 0' }}>📅 <b>日時：</b> {displayDate} {displayTime} 〜</p>
        
        {staffName ? (
          <p style={{ margin: '0 0 12px 0' }}>👤 <b>担当：</b> {staffName}</p>
        ) : (isAdminEntry && !staffId) && (
          // 🆕 ねじ込みで担当なしのときも、そうと分かるように表示する
          <p style={{ margin: '0 0 12px 0' }}>👤 <b>担当：</b> フリー（担当なし）</p>
        )}

        <p style={{ margin: '0 0 8px 0' }}>📋 <b>選択メニュー：</b></p>
        <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '0.85rem' }}>
          {people && people.map((person, idx) => (
            <div key={idx} style={{ marginBottom: idx < people.length - 1 ? '10px' : 0, paddingBottom: idx < people.length - 1 ? '10px' : 0, borderBottom: idx < people.length - 1 ? '1px dashed #eee' : 'none' }}>
              {people.length > 1 && (
                <div style={{ fontWeight: 'bold', color: themeColor, marginBottom: '4px' }}>{idx + 1}人目</div>
              )}
              <div style={{ fontWeight: 'bold', lineHeight: '1.4' }}>
  {person.fullName.split('/').map((text, i) => (
    <React.Fragment key={i}>
      {text.trim()}
      {i < person.fullName.split('/').length - 1 && <br />}
    </React.Fragment>
  ))}
</div>
            </div>
          ))}

          {/* ✅ 🆕 差し込み：時間制限があるメニューへの補足案内 */}
          {restrictedServices.length > 0 && (
            <div style={{ 
              marginTop: '15px', 
              padding: '12px', 
              background: '#fff7ed', 
              borderRadius: '10px', 
              border: '1px solid #ffedd5', 
              animation: 'fadeIn 0.5s ease' 
            }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#c2410c', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> 受付時間に関するお知らせ
              </p>
              {restrictedServices.map((s, idx) => (
                <div key={idx} style={{ fontSize: '0.75rem', color: '#9a3412', lineHeight: '1.4' }}>
<div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
  <span>・</span>
  <div style={{ flex: 1 }}>
    <b style={{ lineHeight: '1.3' }}>
      {s.name.split('/').map((text, i) => (
        <React.Fragment key={i}>
          {text.trim()}
          {i < s.name.split('/').length - 1 && <br />}
        </React.Fragment>
      ))}
    </b>
    <span> は、専用枠（{s.restricted_hours.map(r => `${r.start}〜${r.end}`).join(', ')}）でのみ受け付けております。</span>
  </div>
</div>                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* 🆕 ねじ込み予約：「既存」「新規」の切り替え */}
        {isAdminEntry && (
          <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '6px', borderRadius: '14px' }}>
            {[{ mode: 'existing', label: '既存' }, { mode: 'new', label: '新規' }].map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchCustomerMode(mode)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '0.95rem', transition: '0.2s',
                  background: customerMode === mode ? '#e11d48' : 'transparent',
                  color: customerMode === mode ? '#fff' : '#64748b'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 🆕 ねじ込み予約（既存）：検索・一覧から選ぶ */}
        {isAdminEntry && customerMode === 'existing' && (
          selectedCustomer ? (
            <div style={{ padding: '16px', borderRadius: '12px', border: '2px solid #e11d48', background: '#fff1f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: 'bold', marginBottom: '4px' }}>選択中のお客様</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' }}>{selectedCustomer.displayName} 様</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  {selectedCustomer.furigana || 'ふりがな未登録'} ／ {selectedCustomer.phone || '電話未登録'}
                </div>
              </div>
              <button type="button" onClick={clearSelectedCustomer} style={{ flexShrink: 0, background: '#fff', color: '#e11d48', border: '1px solid #e11d48', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
                変更
              </button>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>検索</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  autoComplete="off"
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setSelectedIndex(-1); }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="名前・ふりがな・電話番号の一部"
                  style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  onClick={() => { setShowAllList(v => !v); setSelectedIndex(-1); }}
                  style={{ flexShrink: 0, padding: '0 16px', borderRadius: '10px', border: '1px solid #cbd5e1', background: showAllList ? '#1e293b' : '#f1f5f9', color: showAllList ? '#fff' : '#475569', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  一覧
                </button>
              </div>

              {isCustomersLoading && (
                <div style={{ padding: '12px', fontSize: '0.8rem', color: '#94a3b8' }}>お客様を読み込み中...</div>
              )}

              {!isCustomersLoading && (searchText || showAllList) && (
                <div style={{ marginTop: '10px', maxHeight: '50vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
                  {visibleCustomers.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>
                      該当するお客様がいません（「新規」から登録できます）
                    </div>
                  ) : (
                    visibleCustomers.map((c, index) => {
                      const isNewRow = index === 0 || c.kanaRow !== visibleCustomers[index - 1].kanaRow;
                      return (
                        <React.Fragment key={c.id}>
                          {isNewRow && (
                            <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '6px 12px', fontSize: '0.75rem', fontWeight: '900', color: '#e11d48', background: '#fff1f2', borderBottom: '1px solid #fecdd3' }}>
                              {c.kanaRow}
                            </div>
                          )}
                          <div
                            onClick={() => handleSelectCustomer(c)}
                            style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: index === selectedIndex ? '#fff1f2' : '#fff' }}
                          >
                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>{c.displayName} 様</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                              {c.furigana || 'ふりがな未登録'} ／ {c.phone || '電話未登録'}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )
        )}

        {/* --- 1. 基本項目 & 業種別項目のループ --- */}
        {formConfig && Object.entries(formConfig).map(([key, config]) => {
          const isEnabled = lineUser ? config.line_enabled : config.enabled;
          
          // 表示しない条件
          if (!isEnabled) return null;
          if (isAdminEntry && key !== 'name') return null;
          // 🆕 ねじ込み（既存）はお名前欄を出さない（上の検索で選ぶ）
          if (isAdminEntry && customerMode === 'existing') return null;

          // 👇 🌟 🆕 追加：設定画面で決めた「表示対象（salon / visit）」を判定して出し分ける！
          const targetMode = config.target_mode || 'all';
          if (targetMode === 'salon' && serviceMode === 'visit') return null;
          if (targetMode === 'visit' && serviceMode === 'salon') return null;
          
          // ⚠️ ふりがな、備考欄、郵便番号はこのループ内では直接描画しない（位置を固定するため）
          if (key === 'furigana' || key === 'notes' || key === 'zip_code') return null;

          return (
            <React.Fragment key={key}>
              {/* 各入力項目の div */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
<span style={{ lineHeight: '1.2' }}>
  {config.label.split('/').map((text, i) => (
    <React.Fragment key={i}>
      {text.trim()}
      {i < config.label.split('/').length - 1 && <br />}
    </React.Fragment>
  ))}
</span>
{config.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>

                {key === 'name' ? (
                  <input 
                    name="name"
                    type="text" 
                    autoComplete="off"
                    value={customerData.name} 
                    onChange={handleInputChange} 
                    placeholder={`${config.label}を入力`} 
                    style={inputStyle} 
                  />
                ) : key === 'parking' ? (
                  <select name={key} value={customerData[key]} onChange={handleInputChange} style={inputStyle} required={config.required}>
                    <option value="">選択してください</option>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                  </select>
                // 👇 🌟 🆕 追加：建物の種類も選択式（プルダウン）にする
                ) : key === 'building_type' ? (
                  <select name={key} value={customerData[key] || ''} onChange={handleInputChange} style={inputStyle} required={config.required}>
                    <option value="">選択してください</option>
                    <option value="戸建て">戸建て</option>
                    <option value="集合住宅">集合住宅</option>
                    <option value="介護施設">介護施設</option>
                    <option value="病院">病院</option>
                  </select>
                ) : (
                  <input 
                    name={key}
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} 
                    value={customerData[key] || ''} 
                    onChange={handleInputChange} 
                    style={inputStyle} 
                    placeholder={`${config.label}を入力`}
                    required={config.required} 
                  />
                )}
              </div>

              {/* 🏆 お名前の直後に強制的に「ふりがな」を挿入 */}
              {key === 'name' && formConfig.furigana && (lineUser ? formConfig.furigana.line_enabled : formConfig.furigana.enabled) && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {formConfig.furigana.label} {formConfig.furigana.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input 
                    name="furigana"
                    type="text" 
                    value={customerData.furigana} 
                    onChange={handleInputChange} 
                    style={inputStyle} 
                    placeholder={`${formConfig.furigana.label}を入力`}
                    required={formConfig.furigana.required} 
                  />
                </div>
              )}

              {/* 🏆 電話番号（phone）の直後に「郵便番号」を挿入するよう変更 */}
              {key === 'phone' && formConfig.zip_code && (lineUser ? formConfig.zip_code.line_enabled : formConfig.zip_code.enabled) && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {formConfig.zip_code.label} {formConfig.zip_code.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input 
                    name="zip_code"
                    type="text" 
                    value={customerData.zip_code} 
                    onChange={handleInputChange} 
                    style={inputStyle} 
                    placeholder="例: 123-4567"
                    required={formConfig.zip_code.required} 
                  />
                </div>
              )}
            </React.Fragment>
          );
})}

        {/* 🆕 【新設】カスタム質問（ラジオボタン）の表示エリア */}
        {formConfig?.custom_questions?.map((q) => {
          const isEnabled = lineUser ? q.line_enabled : q.enabled;
          if (!isEnabled || isAdminEntry) return null; // 管理者ねじ込み時は表示しない

          // 👇 🌟 🆕 追加：カスタム質問の「表示対象」もここで判定
          const targetMode = q.target_mode || 'all';
          if (targetMode === 'salon' && serviceMode === 'visit') return null;
          if (targetMode === 'visit' && serviceMode === 'salon') return null;

          return (
            <div key={q.id} style={{ marginBottom: '20px', padding: '15px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '12px', color: '#1e293b' }}>
                {q.label} {q.required && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {(q.options || '').split(',').map((opt) => (
                  <label key={opt} style={{ 
                    flex: '1', minWidth: '100px', padding: '10px', borderRadius: '10px', border: '2px solid',
                    borderColor: customAnswers[q.id] === opt ? themeColor : '#e2e8f0',
                    background: customAnswers[q.id] === opt ? `${themeColor}05` : '#fff',
                    textAlign: 'center', cursor: 'pointer', fontSize: '0.9rem', transition: '0.2s'
                  }}>
                    <input 
                      type="radio" 
                      name={q.id} 
                      value={opt} 
                      checked={customAnswers[q.id] === opt}
                      onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                      style={{ display: 'none' }} 
                    />
                    <span style={{ color: customAnswers[q.id] === opt ? themeColor : '#64748b', fontWeight: customAnswers[q.id] === opt ? 'bold' : 'normal' }}>
                      {opt}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* --- 2. 備考欄を一番最後に固定 --- */}
                {!isAdminEntry && formConfig.notes && (lineUser ? formConfig.notes.line_enabled : formConfig.notes.enabled) && (
          <div style={{ marginTop: '10px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
              {formConfig.notes.label} {formConfig.notes.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <textarea 
              name="notes" 
              value={customerData.notes} 
              onChange={handleInputChange} 
              style={{ ...inputStyle, minHeight: '100px', resize: 'none' }} 
              placeholder={`${formConfig.notes.label}があれば入力してください`}
              required={formConfig.notes.required} 
            />
          </div>
        )}

<button 
          onClick={handleReserve} 
          // 👇 修正：プレビューモードの時は無効化する
          disabled={isSubmitting || isPreviewMode} 
          style={{ 
            marginTop: '20px', padding: '18px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            // 👇 修正：プレビューモードの時は強制的に灰色にする
            background: isPreviewMode ? '#cbd5e1' : (isSubmitting ? '#94a3b8' : (isAdminEntry ? '#e11d48' : themeColor)), 
            color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', 
            // 👇 修正：プレビューモードの時はカーソルを禁止マークに
            cursor: (isSubmitting || isPreviewMode) ? 'not-allowed' : 'pointer',
            boxShadow: isPreviewMode ? 'none' : `0 4px 12px ${themeColor}33`,
            width: '100%' 
          }}
        >
          {isPreviewMode ? (
            // 👇 追加：プレビュー用のテキスト
            'プレビュー表示（操作不可）'
          ) : isSubmitting ? (
            <>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
              <span>予約を確定しています...</span>
            </>
          ) : (
            isAdminEntry ? '🚀 ねじ込んで名簿登録' : '予約を確定する'
          )}
        </button>

        {/* 🆕 グルグル回すための専用のアニメーション命令（一度書けばOK） */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
              </div>
    </div>
  );
}

export default ConfirmReservation;