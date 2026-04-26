import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, Clipboard, Calendar, FolderPlus, PlusCircle, Trash2, 
  Tag, ChevronDown, RefreshCw, ChevronLeft, ChevronRight, Settings, Users, Percent, Plus, Minus, X, CheckCircle, User, FileText, History, ShoppingBag, Edit3, BarChart3,
  AlertCircle,
  Scissors,
  Search
} from 'lucide-react';

// 🚀 🆕 エラー解消！ スタイルの定義を関数（AdminManagement）の外、かつ上に移動します
const inputStyle = { 
  width: '100%', 
  boxSizing: 'border-box', 
  padding: '12px', 
  borderRadius: '12px', 
  border: '1px solid #cbd5e1', 
  outline: 'none' 
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

function AdminManagement() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const cleanShopId = shopId?.trim();

  // --- 画面管理・日付 ---
  const [activeMenu, setActiveMenu] = useState('work');
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [categoryMap, setCategoryMap] = useState({});
  const [viewMonth, setViewMonth] = useState(new Date());

  // --- 検索機能用State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // --- マスターデータ ---
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]); 
  const [adminAdjustments, setAdminAdjustments] = useState([]);
  const [products, setProducts] = useState([]); 
  const [staffs, setStaffs] = useState([]); // 🆕 追加済み（再確認）
  const [staffPickerRes, setStaffPickerRes] = useState(null);

  // 🆕 追加：全顧客データ用のState
  const [allCustomers, setAllCustomers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const BLOCK_NAMES = ['臨時休業', '管理者ブロック'];

  // --- 予約・売上データ保持 ---
  const [allReservations, setAllReservations] = useState([]);
  const [salesRecords, setSalesRecords] = useState([]);

  // --- レジパネル用State ---
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState(null);
  const [checkoutServices, setCheckoutServices] = useState([]); 
  const [checkoutAdjustments, setCheckoutAdjustments] = useState([]); 
  const [checkoutProducts, setCheckoutProducts] = useState([]); 
  // ✅ 追記：レジで選択中の枝分かれメニューを保持する箱
  const [checkoutOptions, setCheckoutOptions] = useState({});
  const [finalPrice, setFinalPrice] = useState(0);
  const [isManualPrice, setIsManualPrice] = useState(false); 
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [tempPrice, setTempPrice] = useState('0'); // 現在表示されている数字
  // 🆕 電卓の計算用State
  const [prevValue, setPrevValue] = useState(null); // 一つ前に入力した数字
  const [operator, setOperator] = useState(null);  // ＋－×÷ の種類
  const [waitingForNext, setWaitingForNext] = useState(false); // 次の数字を待っている状態か
  const [openAdjCategory, setOpenAdjCategory] = useState(null); 
　const [isMenuPopupOpen, setIsMenuPopupOpen] = useState(false); 
  // --- 🆕 売上分析用の新Stateを追加 ---
  const [viewYear, setViewYear] = useState(new Date().getFullYear()); // 表示する年
  const [selectedMonthData, setSelectedMonthData] = useState(null);   // ポップアップで表示する月のデータ
  // --- 顧客情報（カルテ）パネル用State ---
  const [isCustomerInfoOpen, setIsCustomerInfoOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [firstArrivalDate, setFirstArrivalDate] = useState(''); 
  const [pastVisits, setPastVisits] = useState([]);
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [editFields, setEditFields] = useState({
    name: '', furigana: '', email: '', phone: '', 
    zip_code: '', address: '', parking: '', 
    building_type: '', care_notes: '', company_name: '', 
    symptoms: '', request_details: '', 
    is_blocked: false, // 🚀 🆕 追加
    first_arrival_date: '', memo: '', custom_answers: {}
  });

  // --- 🆕 施設訪問の内訳ポップアップ用 ---
  const [showFacilityMembersModal, setShowFacilityMembersModal] = useState(false);
  const [selectedFacilitySale, setSelectedFacilitySale] = useState(null);

  const [memberSortMode, setMemberSortMode] = useState('name');
  const [showHistoryDetail, setShowHistoryDetail] = useState(false); // 表示フラグ
  const [selectedHistory, setSelectedHistory] = useState(null);     // 選択した履歴データ

  // ==========================================
  // --- 🆕 画面サイズ管理（エラー解決のために追加） ---
  // ==========================================
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // これで画面全体の isPC 判定が有効になります
  const isPC = windowWidth > 1024; 
  // ==========================================

// ✅ 共通並び替え関数
  const sortItems = (items) => [...items].sort((a, b) => {
    const catA = a.category || 'その他'; const catB = b.category || 'その他';
    if (catA !== catB) return catA.localeCompare(catB, 'ja');
    return (a.name || '').localeCompare(b.name || '', 'ja');
  });

  // 🆕 修正：管理画面の詳細モーダルで表示すべきか判定するロジック
  const shouldShowInAdmin = (key) => {
    // 1. 基本の4項目は設定に関わらず常に表示
    const basicFields = ['name', 'furigana', 'email', 'phone'];
    if (basicFields.includes(key)) return true;
    // 2. それ以外（住所、駐車場など）は、必須設定の場合のみ表示
    const cfg = shop?.form_config?.[key];
    return cfg?.required === true;
  };

  const getFieldLabel = (key) => shop?.form_config?.[key]?.label || key;

  useEffect(() => {
    if (cleanShopId) fetchInitialData();
  }, [cleanShopId, activeMenu, selectedDate, viewYear]); // viewYearが変わった時も再読込

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // --- 1. 自分のプロフィールを取得 ---
      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', cleanShopId).maybeSingle();
      if (myProfile && myProfile.business_name) setShop(myProfile);

      const startOfYear = `${viewYear}-01-01`;
      const endOfYear = `${viewYear}-12-31`;

      // --- 2. 予約 ＆ 施設訪問データを取得（常に自店のみ） ---
      const [resRes, visitRes] = await Promise.all([
        supabase.from('reservations')
          .select('*, staffs(name)') // 💡 profiles の結合は不要なので削除
          .eq('shop_id', cleanShopId) // 👈 .in ではなく .eq
          .or('is_block.is.null,is_block.eq.false')
          .order('start_time', { ascending: true }),
        
        supabase.from('visit_requests')
          .select('*, facility_data:facility_user_id(facility_name)')
          .eq('shop_id', cleanShopId) // 👈 .in ではなく .eq
      ]);

      const reservationsData = resRes.data || [];
      const visitsData = visitRes.data || [];
      const facilityIds = [...new Set(visitsData.map(v => v.facility_user_id))].filter(Boolean);

      // --- 3. 売上・顧客名簿・マスターを取得（常に自店のみ） ---
      const [catRes, servRes, optRes, adjRes, prodRes, sDataRes, custAllRes, membersRes, staffsRes] = await Promise.all([
        supabase.from('service_categories').select('*').eq('shop_id', cleanShopId).order('sort_order'),
        supabase.from('services').select('*').eq('shop_id', cleanShopId).order('sort_order'),
        supabase.from('service_options').select('*'),
        supabase.from('admin_adjustments').select('*').eq('shop_id', cleanShopId),
        supabase.from('products').select('*').eq('shop_id', cleanShopId).order('sort_order'),
        
        // 💰 売上データ：自分の店のみ
        supabase.from('sales')
          .select('*')
          .eq('shop_id', cleanShopId) // 👈 .in ではなく .eq
          .gte('sale_date', startOfYear)
          .lte('sale_date', endOfYear),
        
        // 👤 顧客名簿：自分の店のみ
        supabase.from('customers')
          .select('*')
          .eq('shop_id', cleanShopId) // 👈 .in ではなく .eq
          .order('last_arrival_at', { ascending: false }),
        
        facilityIds.length > 0 
          ? supabase.from('members').select('*').in('facility_user_id', facilityIds)
          : Promise.resolve({ data: [] }),
        
        supabase.from('staffs').select('*').eq('shop_id', cleanShopId)
      ]);

      // --- 4. データの整形とセット（以下、既存ロジックと同じ） ---
      const individualTasks = reservationsData.map(r => ({ ...r, task_type: 'individual' }));
      const facilityTasks = visitsData.map(v => {
        const fData = Array.isArray(v.facility_data) ? v.facility_data[0] : v.facility_data;
        return { 
          ...v, 
          task_type: 'facility', 
          customer_name: fData?.facility_name || '名称未設定施設', 
          start_time: `${v.scheduled_date}T09:00:00` 
        };
      });

      setAllReservations([...individualTasks, ...facilityTasks]);
      
      // 🚀 🆕 追加：url_key と 専用屋号 を紐付けるマップを作成
      const shopNameMap = {};
      const allCatsForMap = catRes.data || [];
      allCatsForMap.forEach(c => {
        if (c.url_key) shopNameMap[c.url_key] = c.custom_shop_name || c.name;
      });
      setCategoryMap(shopNameMap);

      setCategories(allCatsForMap.filter(c => !c.is_adjustment_cat && !c.is_product_cat) || []);
      setServices(servRes.data || []);
      setServiceOptions(optRes.data || []);
      setAdminAdjustments(adjRes.data || []);
      setProducts(prodRes.data || []);
      setSalesRecords(sDataRes.data || []); 
      setAllCustomers(custAllRes.data || []); 
      setAllMembers(membersRes.data || []);
      setStaffs(staffsRes.data || []);

    } catch (err) {
      console.error("データ取得エラー:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  // 🆕 --- ここから：顧客検索ロジックを追加 ---
  const handleSearch = async (val) => {
    setSearchTerm(val);
    if (val.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearchLoading(true);
    // ✅ 幽霊データを防ぐため、reservationsではなく「customers名簿」だけを検索
    const blockNamesStr = '("臨時休業","管理者ブロック","休憩","銀行","買い出し","移動")';

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, admin_name, phone')
      .eq('shop_id', cleanShopId)
      .or(`name.ilike.%${val}%,admin_name.ilike.%${val}%`)
      .not('name', 'in', blockNamesStr) // 👈 これを追加！
      .limit(5);
    
    if (error) console.error("Search Error:", error);
    setSearchResults(data || []);
    setIsSearchLoading(false);
  };

  // 🚀 🆕 修正：名前だけでなく ID も一緒に渡すように変更
  const selectSearchResult = (cust) => {
    // 💡 IDを渡すことで、openCustomerInfo が正確にDBから最新データを引けるようになります
    openCustomerInfo({ customer_name: cust.name, customer_id: cust.id });
    
    setSearchTerm('');
    setSearchResults([]);
    setShowSearchModal(false); // 👈 モーダルを閉じる
  };

// 🆕 キーボード操作（上下、エンター、エスケープ）を制御する
  const handleKeyDown = (e) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      // ↓キー：次の候補へ
      e.preventDefault();
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      // ↑キー：前の候補へ
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      // Enterキー：現在の選択を決定
      if (selectedIndex >= 0) {
        e.preventDefault();
        selectSearchResult(searchResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      // Escキー：閉じる
      setSearchResults([]);
      setSelectedIndex(-1);
    }
  };

  // 🚀 🆕 修正：レジ確定後のデータを最優先で取り出すように強化
const parseReservationDetails = (res) => {
  if (!res) return { menuName: '', totalPrice: 0, items: [], subItems: [], savedAdjustments: [], savedProducts: [] };
  const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
  
  const products = opt.products || [];
  const adjustments = opt.adjustments || [];
  let items = [];
  let subItems = [];

  // 💡 ここがポイント！：レジ確定フラグがある、またはpeopleデータがない場合はフラットなリスト（最新）を採用
  if (opt.isUpdatedFromCheckout || opt.isUpdatedFromTodayTasks || !opt.people) {
    items = opt.services || [];
    subItems = Object.values(opt.options || {});
  } else {
    // まだレジを通していない、予約したての状態
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

  // 🚀 🆕 計算が0円でも、DBに確定金額(res.total_price)が入っているならそちらを表示に使う
  if (calculatedTotal === 0 && res.total_price > 0) {
    calculatedTotal = res.total_price;
  }

  return { 
    menuName: fullMenuName, 
    totalPrice: Math.max(0, calculatedTotal), 
    items, 
    subItems, 
    savedAdjustments: adjustments, 
    savedProducts: products 
  };
};

  const calculateFinalTotal = (currentSvcs, currentAdjs, currentProds, currentOpts = checkoutOptions) => {
    // 🆕 手動入力モードなら、自動計算の結果を反映させない
    if (isManualPrice) return;

    let total = currentSvcs.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const optPrice = Object.values(currentOpts).reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);
    total += optPrice;

    currentProds.forEach(p => total += Number(p.price || 0) * (p.quantity || 1));
    currentAdjs.filter(a => !a.is_percent).forEach(a => {
      total += a.is_minus ? -Number(a.price) : Number(a.price);
    });
    currentAdjs.filter(a => a.is_percent).forEach(a => {
      total = total * (1 - (Number(a.price) / 100));
    });
    setFinalPrice(Math.max(0, Math.round(total)));
  };

  const toggleCheckoutAdj = (adj) => {
    const isSelected = checkoutAdjustments.find(a => a.id === adj.id);
    const newSelection = isSelected ? checkoutAdjustments.filter(a => a.id !== adj.id) : [...checkoutAdjustments, adj];
    setCheckoutAdjustments(newSelection);
    calculateFinalTotal(checkoutServices, newSelection, checkoutProducts);
  };

  const addCheckoutProduct = (prod) => {
    setCheckoutProducts(prev => {
      const existing = prev.find(p => p.id === prod.id);
      let next;
      if (existing) {
        // すでにリストにあれば、個数を+1
        next = prev.map(p => p.id === prod.id ? { ...p, quantity: (p.quantity || 1) + 1 } : p);
      } else {
        // なければ新しく追加（個数1）
        next = [...prev, { ...prod, quantity: 1 }];
      }
      calculateFinalTotal(checkoutServices, checkoutAdjustments, next);
      return next;
    });
  };

  // 🆕 商品を1個減らす（スマホのーボタンや右クリック用）
  const removeCheckoutProduct = (productId) => {
    setCheckoutProducts(prev => {
      const existing = prev.find(p => p.id === productId);
      let next;
      if (existing && existing.quantity > 1) {
        // 2個以上なら個数を-1
        next = prev.map(p => p.id === productId ? { ...p, quantity: p.quantity - 1 } : p);
      } else {
        // 1個ならリストから完全に削除
        next = prev.filter(p => p.id !== productId);
      }
      calculateFinalTotal(checkoutServices, checkoutAdjustments, next);
      return next;
    });
  };

  const toggleCheckoutService = (svc) => {
    const isSelected = checkoutServices.find(s => s.id === svc.id);
    const newSelection = isSelected ? checkoutServices.filter(s => s.id !== svc.id) : [...checkoutServices, svc];
    setCheckoutServices(newSelection);
    calculateFinalTotal(newSelection, checkoutAdjustments, checkoutProducts);
  };

const applyMenuChangeToLedger = () => {
    if (!selectedRes) return;
    const newBaseName = checkoutServices.map(s => s.name).join(', ');
    // 🆕 合計コマ数も計算
    const newTotalSlots = checkoutServices.reduce((sum, s) => sum + (s.slots ?? 1), 0);
    
    const info = parseReservationDetails(selectedRes);
    const branchNames = info.subItems.map(o => o.option_name).filter(Boolean);
    const fullDisplayName = branchNames.length > 0 ? `${newBaseName}（${branchNames.join(', ')}）` : newBaseName;

    setAllReservations(prev => prev.map(res => 
      // 🆕 total_slots も更新対象に含める
      res.id === selectedRes.id ? { ...res, menu_name: fullDisplayName, total_price: finalPrice, total_slots: newTotalSlots } : res
    ));
    setIsMenuPopupOpen(false);
  };
// 🚀 完成版：レジを開く際、その予約元の店舗マスターを読み込む
  const openCheckout = (res) => { // 💡 async は不要に
    setSelectedRes(res);
    
    // すでに fetchInitialData で取得済みのマスタ（State）を使用します
    const info = parseReservationDetails(res);

    // 有効なサービスと調整をセット
    setCheckoutServices(info.items);
    setCheckoutAdjustments(info.savedAdjustments);
    setCheckoutProducts(info.savedProducts);

    const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
    const initialOpts = opt.people 
      ? opt.people.flatMap(p => Object.entries(p.options || {})) 
      : Object.entries(opt.options || {});
    setCheckoutOptions(Object.fromEntries(initialOpts));

    setFinalPrice(res.total_price || info.totalPrice);
    setOpenAdjCategory(null); 
    setIsCheckoutOpen(true); 
    setIsCustomerInfoOpen(false);
  };

  const toggleCheckoutOption = (serviceId, groupName, opt) => {
    const key = `${serviceId}-${groupName}`;
    const newOptions = { ...checkoutOptions, [key]: opt };
    setCheckoutOptions(newOptions);
    calculateFinalTotal(checkoutServices, checkoutAdjustments, checkoutProducts, newOptions);
  };

const completePayment = async () => {
    try {
      setIsSavingMemo(true);

      // 🚀 🆕 追加：システム上の計算合計を算出
      let systemTotal = 0;
      systemTotal += checkoutServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      systemTotal += Object.values(checkoutOptions).reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);
      systemTotal += checkoutProducts.reduce((sum, p) => sum + (Number(p.price || 0) * (p.quantity || 1)), 0);
      
      // 既存の調整を計算
      checkoutAdjustments.filter(a => !a.is_percent).forEach(a => {
        systemTotal += a.is_minus ? -Number(a.price) : Number(a.price);
      });
      checkoutAdjustments.filter(a => a.is_percent).forEach(a => {
        systemTotal = systemTotal * (1 - (Number(a.price) / 100));
      });

      // 🚀 🆕 電卓で上書きされていたら差額を「手動調整」として作成
      let finalAdjustmentsForDb = [...checkoutAdjustments];
      const roundedSystemTotal = Math.round(systemTotal);
      
      if (isManualPrice && finalPrice !== roundedSystemTotal) {
        const gap = finalPrice - roundedSystemTotal;
        finalAdjustmentsForDb.push({
          id: 'manual-adjustment',
          name: '手動入力による金額調整',
          price: Math.abs(gap),
          is_minus: gap < 0,
          is_percent: false
        });
      }

      // 1. 基本情報の整理
      const totalSlots = checkoutServices.reduce((sum, s) => sum + (s.slots ?? 0), 0);
      const endTime = new Date(new Date(selectedRes.start_time).getTime() + totalSlots * (shop.slot_interval_min || 15) * 60000);
      const normalizedName = (editFields.name || selectedRes.customer_name).replace(/　/g, ' ').trim();

      const currentBaseName = checkoutServices.map(s => s.name).join(', ');
      const info = parseReservationDetails(selectedRes);
      const branchNames = info.subItems.map(o => o.option_name).filter(Boolean);
      const dbMenuName = branchNames.length > 0 ? `${currentBaseName}（${branchNames.join(', ')}）` : currentBaseName;

      // --- ステップA：顧客名簿の更新（常に自店） ---
      const { data: currentMaster } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', cleanShopId)
        .eq('name', normalizedName)
        .maybeSingle();

      const finalTargetId = currentMaster?.id || selectedCustomer?.id;

      const customerPayload = {
        shop_id: cleanShopId,
        name: normalizedName,
        admin_name: normalizedName,
        // 入力があれば採用、なければDBの既存データを維持（これで消えません！）
        furigana: editFields.furigana?.trim() || currentMaster?.furigana || null,
        phone: (editFields.phone?.replace(/[^0-9]/g, '')) || currentMaster?.phone || (selectedRes.customer_phone?.replace(/[^0-9]/g, '')) || null,
        email: editFields.email?.trim() || currentMaster?.email || null,
        address: editFields.address?.trim() || currentMaster?.address || null,
        zip_code: editFields.zip_code?.trim() || currentMaster?.zip_code || null,
        parking: editFields.parking || currentMaster?.parking || null,
        building_type: editFields.building_type || currentMaster?.building_type || null,
        care_notes: editFields.care_notes || currentMaster?.care_notes || null,
        memo: editFields.memo || currentMaster?.memo || null,
        custom_answers: editFields.custom_answers || currentMaster?.custom_answers || {},
        updated_at: new Date().toISOString()
      };

      if (finalTargetId) customerPayload.id = finalTargetId;
      const { data: savedCust } = await supabase.from('customers').upsert(customerPayload, { onConflict: 'id' }).select().single();
      const finalCustomerId = savedCust?.id || finalTargetId;

      // --- ステップB：過去の予約も一括で紐付け ---
      await supabase
        .from('reservations')
        .update({ customer_id: finalCustomerId })
        .eq('shop_id', cleanShopId)
        .eq('customer_name', normalizedName)
        .is('customer_id', null);

      // --- ステップC：今回の予約データを確定 ---
      await supabase.from('reservations').update({ 
        total_price: finalPrice, 
        status: 'completed', 
        customer_id: finalCustomerId, 
        customer_name: normalizedName,
        total_slots: totalSlots, 
        end_time: endTime.toISOString(), 
        menu_name: dbMenuName,
        options: { 
          ...(selectedRes.options || {}),
          services: checkoutServices, 
          adjustments: finalAdjustmentsForDb, // 👈 🚀 🆕 差額調整済みのリストを保存
          products: checkoutProducts, 
          options: checkoutOptions,
          isUpdatedFromCheckout: true
        }
      }).eq('id', selectedRes.id);

      // --- ステップD：売上データ（sales）の記録 ---
      const salePayload = { 
        shop_id: cleanShopId, 
        reservation_id: selectedRes.id, 
        customer_id: finalCustomerId, 
        total_amount: finalPrice, 
        sale_date: selectedDate, 
        details: { 
          services: checkoutServices, 
          options: checkoutOptions, 
          products: checkoutProducts, 
          adjustments: finalAdjustmentsForDb // 👈 🚀 🆕 ここも書き換え
        } 
      };

      const { error: saleError } = await supabase.from('sales').upsert(salePayload, { onConflict: 'reservation_id' });
      if (saleError) throw saleError;

      alert("お会計を完了しました！✨"); 
      setIsCheckoutOpen(false); 
      fetchInitialData(); 
    } catch (err) { 
      alert("確定失敗: " + err.message); 
    } finally {
      setIsSavingMemo(false);
    }
  };

  /* ==========================================
      🆕 追加：自動売上確定モード用の一括処理ロジック
      未処理の予約を、見積金額で一括して「売上確定」させます
     ========================================== */
  const handleAutoBatchProcess = async () => {
    if (!oldestIncompleteDate) return;
    if (!window.confirm(`${oldestIncompleteDate} 以前の未処理予約を、すべて見積金額で一括確定しますか？`)) return;

    setIsAutoProcessing(true); // 👈 fetchInitialData の前あたりに追加した State
    try {
      const todayStr = new Date().toLocaleDateString('sv-SE');
      
      // 1. 過去の未処理予約（完了・キャンセル以外、かつ売上対象外でないもの）を抽出
      const incompleteTasks = allReservations.filter(r => 
        r.status !== 'completed' && 
        r.status !== 'canceled' && 
        r.start_time.split('T')[0] < todayStr &&
        !isSalesExcludedRes(r)
      );

      if (incompleteTasks.length === 0) {
        alert("処理対象のタスクはありません。");
        return;
      }

      // 2. ループで1件ずつ処理
      for (const task of incompleteTasks) {
        const details = parseReservationDetails(task);
        const estimatedPrice = task.total_price || details.totalPrice || 0;

        // A. 予約データの更新
        await supabase.from('reservations').update({
          status: 'completed',
          total_price: estimatedPrice,
          options: { ...task.options, isAutoMatched: true }
        }).eq('id', task.id);

        // B. 売上台帳（sales）への書き込み
        await supabase.from('sales').upsert({
          shop_id: cleanShopId,
          reservation_id: task.id,
          customer_id: task.customer_id,
          total_amount: estimatedPrice,
          sale_date: task.start_time.split('T')[0],
          details: { ...task.options, note: '管理画面からの一括確定' }
        }, { onConflict: 'reservation_id' });
      }

      alert(`${incompleteTasks.length}件を一括確定し、台帳に記録しました！✨`);
      fetchInitialData(); // 最新状態にリロード
    } catch (err) {
      console.error("一括処理エラー:", err);
      alert("一括処理中にエラーが発生しました: " + err.message);
    } finally {
      setIsAutoProcessing(false);
    }
  };
  
  // 🆕 ここから追加：お会計リセット機能
  const handleResetCheckout = () => {
    if (!window.confirm("お会計内容を現在のマスター設定の状態にリセットしますか？\n（追加した店販や調整もリセットされます）")) return;

    // 1. 予約時の本来のメニュー（最新のマスター価格を反映）に再構築
    const info = parseReservationDetails(selectedRes);
    
    // 今のマスターに実在するメニューだけを最新価格で取得
    const freshServices = info.items.map(saved => 
      services.find(s => s.id === saved.id || s.name === saved.name)
    ).filter(Boolean);

    // 2. 各ステートを初期化
    setCheckoutServices(freshServices);
    setCheckoutAdjustments([]); // 調整をクリア
    setCheckoutProducts([]);    // 店販をクリア
    setCheckoutOptions({});     // 枝分かれ（シャンプー等）も一旦クリア
    
    // 3. 金額を再計算して画面に反映
    calculateFinalTotal(freshServices, [], [], {});
    
    alert("現在のマスター設定でリセットしました。");
  };

  const isSalesExcludedRes = (res) => {
    const info = parseReservationDetails(res);
    // 全てのメニューが「売上対象外」設定なら、売上処理の対象外とみなす
    return info.items.length > 0 && info.items.every(item => {
      const master = services.find(s => s.id === item.id || s.name === item.name);
      return master?.is_sales_excluded === true;
    });
  };

  // 🚀 🆕 修正：技術売上と店販売上を分離して集計するロジック
  const salesBreakdown = useMemo(() => {
    const breakdown = { total: 0, common: 0, technical: 0, product: 0, byBiz: {} };

    salesRecords.filter(s => {
      if (!s.sale_date) return false;
      const sDate = s.sale_date.toString().split('T')[0].replace(/\//g, '-');
      const tDate = selectedDate.toString().split('T')[0].replace(/\//g, '-');
      return sDate === tDate;
    }).forEach(s => {
      const amount = Number(s.total_amount) || 0;
      breakdown.total += amount;

      // 🛒 店販売上を計算（details内のproductsの合計）
      const prodSum = (s.details?.products || []).reduce((sum, p) => sum + (Number(p.price || 0) * (Number(p.quantity) || 1)), 0);
      breakdown.product += prodSum;
      breakdown.technical += (amount - prodSum); // 合計から店販を引いた残りが技術売上

      // 💡 事業別（屋号別）の集計
      const associatedRes = allReservations.find(r => r.id === s.reservation_id);
      const bType = associatedRes?.biz_type;
      if (bType && categoryMap[bType]) {
        const name = categoryMap[bType];
        breakdown.byBiz[name] = (breakdown.byBiz[name] || 0) + amount;
      } else {
        breakdown.common += amount;
      }
    });

    return breakdown;
  }, [salesRecords, selectedDate, allReservations, categoryMap]);

  // 🆕 修正：過去の「レジ処理忘れ」を自動検知するロジック
  const oldestIncompleteDate = useMemo(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    
    const incomplete = allReservations
      .filter(r => 
        // ✅ 完了でもなく、かつキャンセルでもないものだけを「未処理」とする
        (r.task_type === 'individual' || r.task_type === 'facility') && 
        r.status !== 'completed' && 
        r.status !== 'canceled' && // 🚀 ここを追記！
        r.start_time.split('T')[0] < today && 
        !isSalesExcludedRes(r)
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    return incomplete.length > 0 ? incomplete[0].start_time.split('T')[0] : null;
  }, [allReservations, services]);

// ✅ 売上の人数と金額のズレを完全に解消する集計ロジック（厳格・台帳連動版）
  const analyticsData = useMemo(() => {
    const currentYear = viewYear;
    const mainName = shop?.business_name || '通常';
    
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, total: 0, count: 0, technical: 0, product: 0, // 👈 月間合計用
      breakdown: { [mainName]: 0 }, 
      days: Array.from({ length: new Date(currentYear, i + 1, 0).getDate() }, (_, j) => ({ 
        day: j + 1, total: 0, count: 0, technical: 0, product: 0, breakdown: { [mainName]: 0 } // 👈 日別用
      }))
    }));

    salesRecords.forEach(s => {
      const d = new Date(s.sale_date);
      if (d.getFullYear() === currentYear) {
        const mIdx = d.getMonth();
        const dIdx = d.getDate() - 1;
        const amount = Number(s.total_amount) || 0;

        // 🛒 店販売上を算出（details.productsの合計）
        const prodSum = (s.details?.products || []).reduce((sum, p) => sum + (Number(p.price || 0) * (Number(p.quantity) || 1)), 0);
        const techSum = amount - prodSum;

        const res = allReservations.find(r => r.id === s.reservation_id);
        const bizName = (res?.biz_type && categoryMap[res.biz_type]) ? categoryMap[res.biz_type] : mainName;

        if (months[mIdx] && months[mIdx].days[dIdx]) {
          // 月間集計
          months[mIdx].total += amount;
          months[mIdx].count += 1;
          months[mIdx].technical += techSum;
          months[mIdx].product += prodSum;
          months[mIdx].breakdown[bizName] = (months[mIdx].breakdown[bizName] || 0) + amount;

          // 日別集計
          months[mIdx].days[dIdx].total += amount;
          months[mIdx].days[dIdx].count += 1;
          months[mIdx].days[dIdx].technical += techSum;
          months[mIdx].days[dIdx].product += prodSum;
          months[mIdx].days[dIdx].breakdown[bizName] = (months[mIdx].days[dIdx].breakdown[bizName] || 0) + amount;
        }
      }
    });
    return months;
  }, [allReservations, salesRecords, viewYear, categoryMap, shop]);

// 🚀 🆕 追加：全顧客を50音順（フリガナ順）にソートしたリストを作成
const sortedAllCustomers = useMemo(() => {
  const uniqueMap = new Map();
  
  allCustomers.forEach(c => {
    const nameKey = (c.name || "").trim();
    // 💡 すでに同じ名前がいても、住所があるデータや最新のIDを優先して残す
    if (!uniqueMap.has(nameKey) || (!uniqueMap.get(nameKey).address && c.address)) {
      uniqueMap.set(nameKey, c);
    }
  });

  // 🚀 🆕 修正：名簿リストからプライベートな予定名をすべて排除する
  const blockNames = ['臨時休業', '管理者ブロック', '休憩', '銀行', '買い出し', '移動'];

  return Array.from(uniqueMap.values())
    .filter(c => !blockNames.includes(c.name)) // 👈 フィルターを強化
    .sort((a, b) => (a.furigana || 'ー').localeCompare(b.furigana || 'ー', 'ja'));
}, [allCustomers]);
  // 選択中の顧客（施設）に関連する「利用者一覧」を売上データから抽出する
  const managedFacilityMembers = useMemo(() => {
    if (!selectedCustomer) return [];
    
    // 1. この施設の全売上データを取得
    const facilitySales = salesRecords.filter(s => s.customer_id === selectedCustomer.id);
    
    // 2. 名寄せMapを作成（最新の日付を保持）
    const memberMap = {};
    facilitySales.forEach(s => {
      const date = s.sale_date?.split('T')[0] || "";
      s.details?.members_list?.forEach(m => {
        if (!memberMap[m.name] || memberMap[m.name].date < date) {
          memberMap[m.name] = { date: date };
        }
      });
    });

    // 3. 配列に変換し、名簿(allMembers)から「ひらがな」を合流させる
    const list = Object.entries(memberMap).map(([name, val]) => {
      const memberInfo = allMembers.find(m => m.name === name); 
      return {
        name: name,
        // 🚀 🆕 追加：DBのフラグを見て「現役かどうか」を判定
        // DBに値がない（null）場合は true とみなします
        isActive: memberInfo ? memberInfo.is_active !== false : true,
        kana: (memberInfo?.kana || memberInfo?.furigana || name)
          .replace(/[\u30a1-\u30f6]/g, s => String.fromCharCode(s.charCodeAt(0) - 0x60)), 
        lastVisit: val.date
      };
    });

    // 4. 指定されたモードで並び替え
    return list.sort((a, b) => {
      if (memberSortMode === 'date') {
        return b.lastVisit.localeCompare(a.lastVisit); // 日付順（新しい順）
      } else {
        return a.kana.localeCompare(b.kana, 'ja'); // あいうえお順
      }
    });
  }, [selectedCustomer, salesRecords, memberSortMode, allMembers]);
  // 🏢 ここまで ======================================================
  const groupedWholeAdjustments = useMemo(() => {
    const sorted = sortItems(adminAdjustments.filter(adj => adj.service_id === null));
    return sorted.reduce((acc, adj) => { const cat = adj.category || 'その他'; if (!acc[cat]) acc[cat] = []; acc[cat].push(adj); return acc; }, {});
  }, [adminAdjustments]);

  // ✅ 🆕 データをCSV形式でダウンロードする関数
  const handleExportCSV = (monthData) => {
    if (!monthData) return;
    
    // ヘッダーに列を追加
    let csvContent = "日付,来客数,施術売上,商品売上,売上合計\n";
    
    monthData.days.forEach(d => {
      if (d.total > 0) {
        // 各項目の値をカンマ区切りで追加
        csvContent += `${viewYear}/${monthData.month}/${d.day},${d.count},${d.technical},${d.product},${d.total}\n`;
      }
    });
    
    csvContent += `合計,${monthData.count},${monthData.technical},${monthData.product},${monthData.total}\n`;

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `売上詳細_${viewYear}年${monthData.month}月.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🆕 修正後：お客様詳細（カルテ）を開く関数（400エラー回避・高速版）
  const openCustomerInfo = async (res) => {
    if (!res || (!res.customer_name && !res.customer_id)) {
      alert("顧客情報を特定できません。");
      return;
    }

    setPastVisits([]); 
    setIsCustomerInfoOpen(true); 
    setIsCheckoutOpen(false);

    try {
      const searchName = (res.customer_name || '').replace(/　/g, ' ').trim();

      // 1. DBから顧客情報を取得
      let query = supabase.from('customers').select('*').eq('shop_id', cleanShopId);
      if (res.customer_id) query = query.eq('id', res.customer_id);
      else query = query.eq('name', searchName);
      
      const { data: customer } = await query.maybeSingle();
      const currentCustomer = customer || { name: res.customer_name };

      // 🚩 2. 【施設同期】施設なら facility_users からも引く
      let facData = null;
      const isFac = currentCustomer.is_facility === true || res.task_type === 'facility';
      if (isFac) {
        const { data } = await supabase.from('facility_users').select('*').eq('facility_name', currentCustomer.name).maybeSingle();
        facData = data;
      }

      // 3. 入力項目をセット（施設データがあれば優先し、入力不可にする）
      const allFields = {
        is_facility: isFac,
        name: currentCustomer.name || '',
        furigana: facData?.furigana || currentCustomer.furigana || '',
        phone: facData?.tel || currentCustomer.phone || '',
        email: facData?.email || currentCustomer.email || '',
        zip_code: currentCustomer.zip_code || '',
        address: facData?.address || currentCustomer.address || '',
        parking: currentCustomer.parking || '',
        building_type: currentCustomer.building_type || '',
        care_notes: currentCustomer.care_notes || '',
        company_name: currentCustomer.company_name || '',
        symptoms: currentCustomer.symptoms || '',
        request_details: currentCustomer.request_details || '',
        first_arrival_date: currentCustomer.first_arrival_date || '',
        is_blocked: !!currentCustomer.is_blocked, 
        memo: currentCustomer.memo || '',
        line_user_id: currentCustomer.line_user_id || null,
        custom_answers: currentCustomer.custom_answers || {}
      };

      setSelectedCustomer(currentCustomer);
      setEditFields(allFields);

      // --- 4. 履歴の抽出 (以前直した 400エラー対策を維持) ---
      let historyData = [];
      if (isFac) {
        historyData = allReservations
          .filter(r => r.task_type === 'facility' && (r.customer_name === searchName || r.facility_id === currentCustomer?.id))
          .sort((a, b) => b.start_time.localeCompare(a.start_time));
      } else {
        let resQuery = supabase.from('reservations').select('*, staffs(name)').eq('shop_id', cleanShopId).in('status', ['completed', 'canceled']).order('start_time', { ascending: false });
        if (currentCustomer.id) resQuery = resQuery.or(`customer_id.eq.${currentCustomer.id},customer_name.eq.${searchName}`);
        else resQuery = resQuery.eq('customer_name', searchName);
        const { data } = await resQuery;
        historyData = data || [];
      }
      setPastVisits(historyData);
    } catch (err) {
      console.error("Customer Info Error:", err);
    }
  };

  // 🚀 🆕 ここに追加：履歴のカードをタップした時に詳細を開く「命令」
  const openHistoryDetail = (visit) => {
    setSelectedHistory(visit);
    setShowHistoryDetail(true);
  };

  const saveCustomerInfo = async () => {
    if (!selectedCustomer) return; 
    setIsSavingMemo(true);

    const normalizedName = (editFields.name || '').replace(/　/g, ' ').trim(); 

    try {
      // 🚀 🆕 修正：ここ！ 保存前に「同じ名前の人」がいないかDBを再チェックします
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('shop_id', cleanShopId)
        .eq('name', normalizedName)
        .maybeSingle();

      // 💡 今開いているデータのID、またはDBで見つかった同一名データのIDを特定
      // これを targetId に入れることで、新規作成ではなく「上書き」になります
      const targetId = selectedCustomer?.id || existingCust?.id;

      const payload = { 
        shop_id: cleanShopId, 
        name: normalizedName, 
        admin_name: normalizedName,
        furigana: editFields.furigana || null, 
        phone: editFields.phone || null, 
        email: editFields.email || null, 
        address: editFields.address || null,
        zip_code: editFields.zip_code || null,
        parking: editFields.parking || null,
        building_type: editFields.building_type || null,
        care_notes: editFields.care_notes || null,
        company_name: editFields.company_name || null,
        symptoms: editFields.symptoms || null,
        request_details: editFields.request_details || null,
        memo: editFields.memo || null, 
        first_arrival_date: editFields.first_arrival_date || null, 
        is_blocked: !!editFields.is_blocked, 
        updated_at: new Date().toISOString() 
      };
      
      // 2. IDがあるなら更新、なければ新規作成
      // 💡 update の時は .eq('id', targetId) で IDを指定しているので、
      // 💡 payload の中身に id が入っていなくても正しく動きます！
      const { error } = targetId 
        ? await supabase.from('customers').update(payload).eq('id', targetId)
        : await supabase.from('customers').insert([payload]);

      if (error) throw error;

      // 🚩 🚀 【ここが変更点！】
      // 以前の facility_users への update 処理は「削除」しました。
      // 店舗側の名簿(customers)は更新しますが、施設側の共通アカウント情報は守られます。

      alert("情報を更新しました！✨");
      setIsCustomerInfoOpen(false); // ポップアップを閉じる
      
      // 💡 これを呼ぶことで、画面全体のリスト（allCustomers）が最新になり、
      // 次に検索ボタンを押した時に「新しい住所」が反映されています。
      fetchInitialData(); 

    } catch (err) { 
      console.error("Save Error:", err);
      alert("保存に失敗しました: " + (err.message || "エラーが発生しました")); 
    } finally { 
      setIsSavingMemo(false); 
    }
  };

  const handleUpdateStaffDirectly = async (resId, newStaffId) => { 
    try {
      const { error } = await supabase.from('reservations').update({ staff_id: newStaffId }).eq('id', resId);
      if (error) throw error;
      setStaffPickerRes(null); 
      fetchInitialData();
    } catch (err) { 
      alert("担当者の変更に失敗しました"); 
    }
  };
  // 🚀 【ここまで入れ替え終了】

  const handleDateChangeUI = (days) => {
    
    const d = new Date(selectedDate); d.setDate(d.getDate() + days); setSelectedDate(d.toLocaleDateString('sv-SE')); };

  // 🆕 修正：開いているポップアップをすべて強制終了する関数
  const closeAllPopups = () => {
    setIsCustomerInfoOpen(false); // 顧客カルテ
    setIsCheckoutOpen(false);      // レジ
    setIsMenuPopupOpen(false);      // メニュー変更
    setStaffPickerRes(null);       // スタッフ選択
    setSelectedMonthData(null);    // 売上分析の詳細
    if (typeof setShowHistoryDetail === 'function') setShowHistoryDetail(false);
  };


return (
    <div style={fullPageWrapper} translate="no" className="notranslate">
      
      {/* 🆕 修正：サイドバー全体を isPC 条件で囲う */}
      {isPC && (
        <div style={sidebarStyle}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '2.2rem', fontStyle: 'italic', fontWeight: '900', color: '#4b2c85', margin: 0 }}>SOLO</h2>
            <p style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>MANAGEMENT</p>
          </div>
          <button style={navBtnStyle(activeMenu === 'work', '#d34817')} onClick={() => setActiveMenu('work')}>日常業務</button>
          <button style={navBtnStyle(activeMenu === 'customers', '#4285f4')} onClick={() => setActiveMenu('customers')}>顧客名簿</button>
          <button style={navBtnStyle(activeMenu === 'analytics', '#008000')} onClick={() => setActiveMenu('analytics')}>売上分析</button>

          {/* ミニカレンダー */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '10px', marginTop: '15px', border: '1px solid #4b2c85' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{viewMonth.getFullYear()}年{viewMonth.getMonth()+1}月</span>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth()-1)))} style={{ border: 'none', background: 'none' }}>◀</button>
                <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth()+1)))} style={{ border: 'none', background: 'none' }}>▶</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
              {['月','火','水','木','金','土','日'].map(d => <div key={d} style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{d}</div>)}
              {Array.from({length: 42}).map((_, i) => {
                const year = viewMonth.getFullYear(); const month = viewMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const d = new Date(year, month, i - (firstDay === 0 ? 6 : firstDay - 1) + 1);
                if (d.getMonth() !== month) return <div key={i} />;
                const isSelected = d.toLocaleDateString('sv-SE') === selectedDate;
                return <div key={i} onClick={() => setSelectedDate(d.toLocaleDateString('sv-SE'))} style={{ fontSize: '0.7rem', padding: '4px 0', cursor: 'pointer', borderRadius: '4px', background: isSelected ? '#4b2c85' : 'none', color: isSelected ? '#fff' : '#333' }}>{d.getDate()}</div>
              })}
            </div>
          </div>
          
          <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button style={navBtnStyle(false, '#4285f4')} onClick={() => navigate(`/admin/${cleanShopId}/reservations`)}>カレンダー</button>
            <button style={navBtnStyle(false, '#4b2c85')} onClick={() => navigate(`/admin/${cleanShopId}/timeline`)}>タイムライン</button>
          </div>
        </div>
      )}
      {/* 🆕 修正：ここまでサイドバーの囲い */}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
{activeMenu === 'work' && (
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    height: '100%', 
    // 🆕 修正：スマホの時だけ下を80px空けて、ボトムナビを避ける
    paddingBottom: isPC ? '0' : '80px' 
  }}>
            
            {/* 🚀 ヘッダー部分：スマホではボタンを小さく、分析ボタンを追加 */}
            <div style={{ 
              background: '#d34817', 
              padding: isPC ? '15px 25px' : '10px 15px', 
              color: '#fff', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <h2 style={{ margin: 0, fontStyle: 'italic', fontSize: isPC ? '1.4rem' : '1.1rem' }}>
                  台帳：{selectedDate.replace(/-/g, '/')}
                </h2>

                {/* 🚀 自動売上確定モードONなら一括確定ボタン、OFFなら日付ジャンプ */}
{oldestIncompleteDate && (
  <button
    disabled={isAutoProcessing}
    onClick={() => {
      // ✅ 新しい「一括売上確定モード」のスイッチを見るように変更
      if (shop?.allow_batch_matching) {
        handleAutoBatchProcess();
      } else {
        setSelectedDate(oldestIncompleteDate);
      }
    }}
    style={{
      // ✅ 色の判定も新しいスイッチに合わせる
      background: shop?.allow_batch_matching ? '#dcfce7' : '#ffeb3b',
      color: shop?.allow_batch_matching ? '#166534' : '#d34817',
      border: shop?.allow_batch_matching ? '1px solid #16653444' : 'none',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: '900',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      animation: isAutoProcessing ? 'none' : 'blinkRed 1.5s infinite',
      boxShadow: '0 0 15px rgba(255, 235, 59, 0.5)'
    }}
  >
    {isAutoProcessing ? (
      '処理中...'
    // ✅ ここも書き換え
    ) : shop?.allow_batch_matching ? ( 
      <><CheckCircle size={14} /> 未処理を一括確定</>
    ) : (
      <><AlertCircle size={14} /> 未処理あり！ ({oldestIncompleteDate.replace(/-/g, '/')})</>
    )}
  </button>
)}
              </div>
<div style={{ display: 'flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
  
  {/* 🚀 🆕 修正：PC・スマホ共通の「名簿検索ボタン」を設置 */}
  <button 
    onClick={() => {
      // fetchAllCustomersForSearch(); // もし関数があれば呼ぶ。なければそのままでOK
      setShowSearchModal(true); 
    }} 
    style={{ 
      ...headerBtnSmall, 
      display: 'flex', 
      alignItems: 'center', 
      gap: '6px', 
      padding: '6px 15px',
      marginRight: '10px',
      background: 'rgba(255,255,255,0.15)', 
      border: '1px solid rgba(255,255,255,0.4)'
    }}
  >
    <Search size={16} />
    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
      {isPC ? '顧客名簿から検索' : '検索'}
    </span>
  </button>

  <button onClick={() => handleDateChangeUI(-1)} style={headerBtnSmall}>前日</button>
                  <button onClick={() => setSelectedDate(new Date().toLocaleDateString('sv-SE'))} style={headerBtnSmall}>今日</button>
                <button onClick={() => handleDateChangeUI(1)} style={headerBtnSmall}>次日</button>
                {/* 📊 スマホ版のみ、サイドバーの代わりに「分析」ボタンを表示 */}
                {!isPC && (
                  <button onClick={() => setActiveMenu('analytics')} style={{ ...headerBtnSmall, background: '#008000', border: 'none' }}>📊 分析</button>
                )}
              </div>
            </div>

            {/* 🚀 メインエリア：ここで「PC（表）」と「スマホ（カード）」を切り替えます */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              background: isPC ? '#fff' : '#f4f7f9', 
              padding: isPC ? '0' : '15px' 
            }}>
              
              {isPC ? (
                /* ==========================================
                   💻 PC版：既存の正確なテーブル（表）形式
                   ========================================== */
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                    <tr style={{ background: '#f3f0ff', borderBottom: '2px solid #4b2c85' }}>
                      <th style={thStyle}>担当者</th>
                      <th style={thStyle}>時間</th>
                      <th style={thStyle}>お客様名 (カルテ)</th>
                      <th style={thStyle}>メニュー(予定)</th>
                      <th style={thStyle}>お会計 (レジ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ✅ 日付比較の形式を統一してフィルタリング */}
                    {allReservations.filter(r => {
                      const rDate = r.start_time.split('T')[0].replace(/\//g, '-');
                      const sDate = selectedDate.split('T')[0].replace(/\//g, '-');
                      return rDate === sDate && !isSalesExcludedRes(r);
                    }).length > 0 ? 
                      allReservations
                        .filter(r => {
                          const rDate = r.start_time.split('T')[0].replace(/\//g, '-');
                          const sDate = selectedDate.split('T')[0].replace(/\//g, '-');
                          return rDate === sDate && !isSalesExcludedRes(r);
                        })
                        .map((res) => {
                        const isFacility = res.task_type === 'facility';
                        const rowKey = `${res.task_type}-${res.id}`;
                        
                        // 1. 売上実績データ（確定済み）があるか探す
                        const saleRecord = salesRecords.find(s => 
                          isFacility ? s.visit_request_id === res.id : s.reservation_id === res.id
                        );
                        const isFinalized = !!saleRecord;

                        // 2. 予定金額を算出
                        const details = parseReservationDetails(res);
                        const estimatedPrice = isFacility ? (res.total_price || 0) : (res.total_price || details.totalPrice || 0);
                        const displayPrice = isFinalized ? saleRecord.total_amount : estimatedPrice;

                        return (
                          <tr key={rowKey} style={{ 
                            borderBottom: '1px solid #eee', 
                            cursor: 'pointer',
                            background: isFacility ? '#f5f3ff' : '#fff' 
                          }}>
                            {/* --- ① 担当者列 --- */}
                            <td 
                              onClick={(e) => { 
                                // スタッフが2人以上いる時だけ、クリックで選択パネルを開けるようにする
                                if(!isFacility && staffs.length > 1) { 
                                  e.stopPropagation(); 
                                  setStaffPickerRes(res); 
                                } 
                              }} 
                              style={{ 
                                ...tdStyle, 
                                fontWeight: 'bold', 
                                color: isFacility ? '#94a3b8' : '#4b2c85',
                                // 1人営業なら指マークを出さない
                                cursor: staffs.length > 1 ? 'pointer' : 'default'
                              }}
                            >
                              {/* ✅ 1人営業ならその人の名前、複数人なら既存の出し分けロジック */}
                              {staffs.length === 1 
                                ? staffs[0].name 
                                : (isFacility ? '---' : (res.staffs?.name || 'フリー'))
                              }
                            </td>

                            {/* --- ② 時間列 --- */}
                            <td style={tdStyle}>
                              {new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            {/* --- ③ お客様名 (カルテ/内訳) --- */}
                            <td 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if(isFacility) {
                                  if(isFinalized) {
                                    setSelectedFacilitySale(saleRecord);
                                    setShowFacilityMembersModal(true);
                                  } else {
                                    alert("施術完了後に内訳が確認できるようになります。");
                                  }
                                } else {
                                  openCustomerInfo(res); 
                                }
                              }} 
                              style={{ 
                                ...tdStyle, 
                                fontWeight: 'bold', 
                                color: isFacility ? '#4f46e5' : (res.status === 'completed' ? '#333' : '#fff'),
                                background: isFacility ? 'transparent' : (res.status === 'completed' ? '#eee' : '#008000'),
                                // 🆕 縦並びにするための設定
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', justifyContent: 'center'
                              }}
                            >
                              {/* 🚀 🆕 追加：屋号バッジ（施設以外で識別キーがある場合） */}
                              {!isFacility && categoryMap[res.biz_type] && (
                                <span style={{ 
                                  fontSize: '0.55rem', padding: '1px 5px', borderRadius: '4px',
                                  background: res.biz_type === 'foot' ? '#4285f4' : '#d34817',
                                  color: '#fff', fontWeight: '900', marginBottom: '2px'
                                }}>
                                  {categoryMap[res.biz_type].slice(0, 4)}
                                </span>
                              )}
                              <span>{isFacility && '🏢 '}{res.customer_name} {isFinalized && '✓'}</span>
                            </td>

                            {/* --- ④ メニュー(予定)列 --- */}
                            <td style={{ ...tdStyle, color: isFacility ? '#64748b' : '#333', fontSize: '0.8rem' }}>
                              {isFacility ? '施設訪問 施術一式' : details.menuName}
                            </td>

                            {/* --- ⑤ お会計 (レジ) 列 --- */}
                            {/* 🚀 🆕 キャンセル判定を追加 */}
<td 
  onClick={(e) => { 
    e.stopPropagation(); 
    // キャンセル済み、または施設訪問ならレジを開かせない
    if(!isFacility && res.status !== 'canceled') openCheckout(res); 
  }} 
  style={{
    ...tdStyle, 
    fontWeight: '900', 
    color: res.status === 'canceled' ? '#cbd5e1' : (isFinalized ? '#1e293b' : '#d34817'),
    cursor: (isFacility || res.status === 'canceled') ? 'default' : 'pointer',
    textDecoration: res.status === 'canceled' ? 'line-through' : 'none' // 🚀 キャンセルなら金額に斜線
  }}
>
  {res.status === 'canceled' ? 'キャンセル' : `¥ ${Number(displayPrice).toLocaleString()}`}
  {res.status !== 'canceled' && !isFinalized && displayPrice > 0 && (
    <span style={{ fontSize: '0.6rem', marginLeft: '4px', fontWeight: 'normal' }}>(予)</span>
  )}
</td>
                          </tr>
                        );
                    }) : (
                      <tr><td colSpan="5" style={{ padding: '50px', textAlign: 'center', color: '#999' }}>予約なし</td></tr>
                    )
                  }
                </tbody>
                </table>
              ) : (
                /* ==========================================
                   📱 スマホ版：見やすい「売上カード」形式
                   ========================================== */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allReservations
                    .filter(r => r.start_time.startsWith(selectedDate) && !isSalesExcludedRes(r))
                    .length > 0 ? (
                      allReservations
                        .filter(r => r.start_time.startsWith(selectedDate) && !isSalesExcludedRes(r))
                        .map((res) => {
                          // 🚀 🆕 1. 施設か個人かを判定
                          const isFacility = res.task_type === 'facility';

                          // 🚀 🆕 2. 売上台帳（salesRecords）の中から、この予約に紐づく「確定データ」を探す
                          // 施設なら visit_request_id、個人なら reservation_id で照合します
                          const saleRecord = salesRecords.find(s => 
                            isFacility ? s.visit_request_id === res.id : s.reservation_id === res.id
                          );
                          
                          // 確定済みかどうかのフラグ
                          const isFinalized = !!saleRecord;

                          // 予定金額を計算（レジを通す前の目安）
                          const details = parseReservationDetails(res);
                          const isCompleted = res.status === 'completed';
                          const isCanceled = res.status === 'canceled';

                          // 🚀 🆕 3. 表示する金額を決定！
                          // 確定済みなら「台帳の金額」、未確定なら「計算した予定金額」を採用します
                          const estimatedPrice = isFacility ? (res.total_price || 0) : (res.total_price || details.totalPrice || 0);
                          const displayPrice = isFinalized ? saleRecord.total_amount : estimatedPrice;

                          return (
                            <div 
                              key={res.id} 
                              style={{ 
                                background: isCanceled ? '#fcfcfc' : '#fff',
                                borderRadius: '16px', 
                                padding: '16px', 
                                boxShadow: '0 4px 15px rgba(0,0,0,0.05)', 
                                border: isCanceled ? '1px solid #e2e8f0' : `1px solid ${isCompleted ? '#e2e8f0' : '#d3481722'}`,
                                position: 'relative',
                                opacity: isCanceled ? 0.7 : 1
                              }}
                            >
                              {/* ステータスバー */}
                              <div style={{ 
                                position: 'absolute', left: 0, top: 15, bottom: 15, width: '4px', 
                                background: isCanceled ? '#cbd5e1' : (isCompleted ? '#94a3b8' : '#008000'), 
                                borderRadius: '0 4px 4px 0' 
                              }} />
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingLeft: '8px' }}>
                                <span style={{ 
                                  fontSize: '1.1rem', fontWeight: '900', 
                                  color: isCanceled ? '#94a3b8' : '#1e293b',
                                  textDecoration: isCanceled ? 'line-through' : 'none'
                                }}>
                                  {new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button 
                                  onClick={() => !isCanceled && setStaffPickerRes(res)}
                                  style={{ background: '#f3f0ff', color: '#4b2c85', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: isCanceled ? 'default' : 'pointer' }}
                                >
                                  👤 {res.staffs?.name || '担当者選択'}
                                </button>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', paddingLeft: '8px' }}>
                                <div 
                                  onClick={() => (res.res_type === 'private_task' || res.res_type === 'blocked') ? null : openCustomerInfo(res)} 
                                  style={{ 
                                    flex: 1, fontSize: '1.1rem', fontWeight: 'bold', 
                                    color: isCanceled ? '#94a3b8' : '#1e293b', 
                                    textDecoration: isCanceled ? 'line-through' : 'underline', 
                                    textDecorationColor: '#cbd5e1' 
                                  }}
                                >
                                  {(res.res_type === 'private_task' || res.res_type === 'blocked')
                                    ? (res.customer_name || '予定') 
                                    : `${isFacility ? '🏢 ' : ''}${res.customer_name || '名前なし'} 様`}
                                </div>
                                
                                <button 
                                  onClick={() => !isCanceled && openCheckout(res)}
                                  disabled={isCanceled}
                                  style={{ 
                                    background: isCanceled ? '#f1f5f9' : (isCompleted ? '#f1f5f9' : '#008000'), 
                                    color: isCanceled ? '#94a3b8' : (isCompleted ? '#94a3b8' : '#fff'), 
                                    border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold',
                                    cursor: isCanceled ? 'default' : 'pointer'
                                  }}
                                >
                                  {isCanceled ? 'キャンセル' : (isCompleted ? '確定済 ✓' : 'レジへ')}
                                </button>
                              </div>

                              <div style={{ 
                                fontSize: '0.8rem', 
                                color: isCanceled ? '#cbd5e1' : '#64748b', 
                                marginBottom: '10px', paddingLeft: '8px', lineHeight: '1.4',
                                textDecoration: isCanceled ? 'line-through' : 'none'
                              }}>
                                📋 {isFacility ? '施設訪問 施術一式' : details.menuName}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', paddingLeft: '8px' }}>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>お会計金額</span>
                                
                                {/* 🚀 🆕 4. 最終的な確定金額（displayPrice）を表示します */}
                                <span style={{ 
                                  fontSize: '1.3rem', fontWeight: '900', 
                                  color: isCanceled ? '#cbd5e1' : (isFinalized ? '#1e293b' : '#d34817'),
                                  textDecoration: isCanceled ? 'line-through' : 'none'
                                }}>
                                  ¥ {Number(displayPrice).toLocaleString()}
                                  {!isFinalized && !isCanceled && displayPrice > 0 && (
                                    <span style={{ fontSize: '0.6rem', marginLeft: '4px', fontWeight: 'normal' }}>(予)</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>予約なし</div>
                    )}
                </div>
              )}
            </div>

            {/* 🚀 🆕 修正：施術と店販の内訳が並ぶ新しいフッター */}
            <div style={{ 
              background: '#1e293b', 
              padding: isPC ? '15px 25px' : '10px 20px', 
              color: '#fff',
              boxShadow: '0 -4px 10px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'center' }}>
                
                {/* 📊 左側：事業（屋号）別の内訳 */}
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {salesBreakdown.common > 0 && (
                    <div style={{ fontSize: '0.8rem' }}>
                      <span style={{ opacity: 0.6, fontSize: '0.7rem', fontWeight: 'bold', marginRight: '4px' }}>{shop?.business_name || '通常'}</span>
                      <span style={{ fontWeight: 'bold' }}>¥{salesBreakdown.common.toLocaleString()}</span>
                    </div>
                  )}
                  {Object.entries(salesBreakdown.byBiz).map(([name, amount]) => (
                    <div key={name} style={{ fontSize: '0.8rem' }}>
                      <span style={{ padding: '1px 6px', borderRadius: '4px', marginRight: '5px', background: name.includes('フット') ? '#4285f4' : '#d34817', fontSize: '0.6rem', fontWeight: 'bold' }}>{name.slice(0,4)}</span>
                      <span style={{ fontWeight: 'bold' }}>¥{amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* 💰 右側：施術/店販の内訳 ＆ 総合計 */}
                <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
                  {/* 🚀 🆕 施術と店販の分離表示 */}
                  <div style={{ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '20px' }}>
                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '2px' }}>施術 / 店販</div>
                    <div style={{ fontSize: '1rem', fontWeight: '900' }}>
                      ¥{salesBreakdown.technical.toLocaleString()} / <span style={{color:'#4ade80'}}>¥{salesBreakdown.product.toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.8 }}>本日の総売上</span>
                    <span style={{ fontSize: isPC ? '2rem' : '1.5rem', fontWeight: '900', color: '#fbbf24' }}>
                      ¥ {salesBreakdown.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeMenu === 'customers' && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            background: '#f0f2f5',
            paddingBottom: isPC ? '0' : '80px' 
          }}>
            {/* ヘッダー：青系のデザインで名簿らしさを演出 */}
            <div style={{ 
              background: '#4285f4', 
              padding: isPC ? '15px 25px' : '10px 15px', 
              color: '#fff', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ margin: 0, fontStyle: 'italic', fontSize: isPC ? '1.4rem' : '1.1rem' }}>
                顧客名簿一覧 ({allCustomers.length}名)
              </h2>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="名前・電話で検索..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    border: 'none', 
                    fontSize: '0.8rem', 
                    width: isPC ? '200px' : '120px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* 名簿リストエリア */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: isPC ? '20px' : '10px',
              paddingBottom: isPC ? '20px' : '100px' 
            }}>
              {/* 🚀 🆕 修正：見出しを横いっぱいに広げるため、Grid から Flex 形式に変更 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(() => {
                  let lastLabel = ""; // 直前のグループ（あ行など）を記憶
                  
                  return sortedAllCustomers
                    .filter(c => (c.name || '').includes(searchTerm) || (c.phone || '').includes(searchTerm))
                    .map((cust) => {
                      // 🚀 🆕 行見出し（あ行など）を判定
                      const currentLabel = getKanaGroup(cust.furigana);
                      const isNewGroup = currentLabel !== lastLabel;
                      lastLabel = currentLabel;

                      // 完了済み予約のカウント
                      const realVisitCount = allReservations.filter(r => 
                        (r.customer_name === cust.name || r.customer_id === cust.id) && 
                        r.status === 'completed' && 
                        (r.task_type === 'individual' || r.task_type === 'facility')
                      ).length;

                      return (
                        <React.Fragment key={cust.id}>
                          {/* 🚀 🆕 グループが変わった瞬間にだけ「あ行」などの見出しを表示 */}
                          {isNewGroup && (
                            <div style={{
                              padding: '15px 10px 5px',
                              fontSize: '0.9rem',
                              fontWeight: '900',
                              color: '#4285f4', // 顧客名簿タブは青系の色
                              borderBottom: '2px solid #e2e8f0',
                              marginBottom: '8px',
                              background: 'linear-gradient(to right, #f0f2f5, #fff)',
                              position: 'sticky', // スクロール時に見出しが画面上に残る設定
                              top: 0,
                              zIndex: 2
                            }}>
                              {currentLabel}
                            </div>
                          )}

                          <div 
                            onClick={() => openCustomerInfo({ customer_name: cust.name })} 
                            style={{ 
                              background: cust.is_active === false ? '#f1f5f9' : '#fff', // 👈 前回の「灰色」ロジックも合流！
                              opacity: cust.is_active === false ? 0.6 : 1,
                              padding: '18px', 
                              borderRadius: '16px', 
                              boxShadow: '0 4px 6px rgba(0,0,0,0.05)', 
                              cursor: 'pointer', 
                              border: '1px solid #e2e8f0', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              maxWidth: isPC ? '700px' : '100%', // PCで横に伸びすぎないように制限
                              transition: 'transform 0.1s',
                            }}
                            onMouseEnter={(e) => isPC && (e.currentTarget.style.transform = 'translateY(-2px)')}
                            onMouseLeave={(e) => isPC && (e.currentTarget.style.transform = 'translateY(0)')}
                          >
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {cust.name} 様
                                {cust.is_blocked && <span style={{ color: '#ef4444' }} title="ブロック中">🚫</span>}
                                {(cust.cancel_count >= 3) && <span style={{ color: '#ef4444' }}>‼️</span>}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>📞 {cust.phone || '電話未登録'}</div>
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '8px' }}>
                                最終来店: {cust.last_arrival_at ? new Date(cust.last_arrival_at).toLocaleDateString() : '記録なし'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', borderLeft: '1px solid #f1f5f9', paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 'bold' }}>利用回数</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#4b2c85' }}>
                    {realVisitCount}<span style={{fontSize:'0.75rem', marginLeft: '2px'}}>回</span>
                  </div>
                </div>
              </div>
                          </div>
                        </React.Fragment>
                      );
                    });
                })()}
              </div>

              {allCustomers.filter(c => (c.name || '').includes(searchTerm) || (c.phone && c.phone.includes(searchTerm))).length === 0 && (
                <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>一致するお客様が見つかりません</div>
              )}
            </div>
          </div>
        )}

{activeMenu === 'analytics' && (
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    height: '100%', 
    background: '#f0f2f5',
    // 🆕 修正：スマホの時だけ下を80px空けて、ボトムナビを避ける
    paddingBottom: isPC ? '0' : '80px' 
  }}>
            {/* 🆕 年度切り替えヘッダー */}
            <div style={{ background: '#008000', padding: '15px 25px', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px' }}>
              <button onClick={() => setViewYear(v => v - 1)} style={yearBtnStyle}>◀</button>
              <h2 style={{ margin: 0, fontStyle: 'italic', fontSize: '1.6rem' }}>{viewYear}年 売上分析</h2>
              <button onClick={() => setViewYear(v => v + 1)} style={yearBtnStyle}>▶</button>
            </div>

            {/* 🆕 月別カードグリッド（タイル状に並べる） */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
              {analyticsData.map(m => (
                <div key={m.month} onClick={() => setSelectedMonthData(m)} style={monthCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#008000' }}>{m.month}月</span>
                    <BarChart3 size={20} color="#94a3b8" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>来客数</span>
                    <span style={{ fontWeight: 'bold' }}>{m.count} 名</span>
                  </div>

                  {/* 🚀 🆕 修正：施術と店販の内訳をメインに据える */}
                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '10px', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold' }}>✂️ 施術売上</span>
                      <span style={{ fontWeight: 'bold' }}>¥{m.technical.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '8px' }}>
                      <span style={{ color: '#008000', fontWeight: 'bold' }}>🛍 店販売上</span>
                      <span style={{ fontWeight: 'bold', color: '#008000' }}>¥{m.product.toLocaleString()}</span>
                    </div>

                    {/* 屋号別の内訳（これまで通り小さく表示） */}
                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '8px', marginBottom: '10px' }}>
                      {Object.entries(m.breakdown).map(([name, price]) => price > 0 && (
                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '2px', opacity: 0.8 }}>
                          <span style={{ color: '#64748b' }}>{name}</span>
                          <span>¥{price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px dashed #eee', paddingTop: '5px' }}>
                      <span style={{ color: '#1e293b', fontSize: '0.8rem', fontWeight: 'bold' }}>総合計</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#d34817' }}>¥ {m.total.toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '0.65rem', color: '#4285f4', textAlign: 'right', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>タップして日別詳細を表示 →</div>
                </div>
              ))}
            </div>

            {/* 🆕 日別詳細ポップアップ（モーダル） */}
            {selectedMonthData && (
              <div style={modalOverlayStyle} onClick={() => setSelectedMonthData(null)}>
                <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                  
                  {/* 💡 ここから書き換え：タイトルとボタンを横並びにします */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #008000', paddingBottom: '10px', marginBottom: '15px', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{viewYear}年 {selectedMonthData.month}月 日別詳細</h3>
                    
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button onClick={() => handleExportCSV(selectedMonthData)} style={{ padding: '6px 12px', background: '#008000', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        📥 CSV保存
                      </button>
                      <button onClick={() => setSelectedMonthData(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20}/></button>
                    </div>
                  </div>

                  {/* 🚀 🆕 ここに追加：この月の事業別合計内訳を表示するパネル */}
                  <div style={{ 
                    background: '#f8fafc', 
                    padding: '15px', 
                    borderRadius: '15px', 
                    marginBottom: '15px', 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '20px', 
                    border: '1px solid #e2e8f0' 
                  }}>
                    {Object.entries(selectedMonthData.breakdown).map(([name, price]) => (
                      <div key={name}>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold' }}>{name} 合計</div>
                        <div style={{ 
                          fontSize: '1.1rem', 
                          fontWeight: '900', 
                          // フットなら青、その他なら黒っぽい色
                          color: name.includes('フット') ? '#4285f4' : '#1e293b' 
                        }}>
                          ¥{price.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={thStyle}>日付</th>
                          <th style={thStyle}>客数</th>
                          <th style={thStyle}>施術</th>
                          <th style={thStyle}>店販</th>
                          <th style={thStyle}>合計</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMonthData.days.filter(d => d.total > 0).map(d => (
                          <tr key={d.day} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{d.day}日</td>
                            <td style={tdStyle}>{d.count}名</td>
                            <td style={{ ...tdStyle, color: '#475569' }}>¥{d.technical.toLocaleString()}</td>
                            <td style={{ ...tdStyle, color: '#008000', fontWeight: 'bold' }}>¥{d.product.toLocaleString()}</td>
                            <td style={{ ...tdStyle, fontWeight: '900', color: '#1e293b' }}>¥{d.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#008000' }}>{selectedMonthData.month}月 合計</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#d34817' }}>¥ {selectedMonthData.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeMenu === 'master_tech' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
            <div style={{ background: '#4285f4', padding: '15px 25px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontStyle: 'italic' }}>商品マスター設定</h2>
              <button onClick={saveAllMasters} disabled={isSaving} style={{ padding: '8px 30px', background: '#008000', color: '#fff', border: '1px solid #fff', fontWeight: 'bold' }}>一括保存</button>
            </div>
          </div>
        )}
      </div>

      {isCheckoutOpen && (
        <div style={checkoutOverlayStyle} onClick={() => setIsCheckoutOpen(false)}>
          <div 
            style={{ 
              ...checkoutPanelStyle, 
              // 🆕 修正：スマホの時は横幅100% ＆ 下に余白を作る
              width: isPC ? '450px' : '100%', 
              paddingBottom: isPC ? '0' : '80px' 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
<div style={checkoutHeaderStyle}>
  <div>
    <h3 style={{ margin: 0 }}>{selectedRes?.customer_name} 様</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <p style={{ fontSize: '0.8rem', margin: 0 }}>レジ・お会計</p>
      {/* 🆕 リセットボタンを追加 */}
      <button 
        onClick={handleResetCheckout}
        style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid #fff', color: '#fff', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
      >
        <RefreshCw size={10} style={{ marginRight: '4px' }} /> 設定リセット
      </button>
    </div>
  </div>
  <button onClick={() => setIsCheckoutOpen(false)} style={{ background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button>
</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #4b2c85', marginBottom: '15px' }}><div style={{ fontWeight: 'bold' }}>施術内容</div><button onClick={() => setIsMenuPopupOpen(true)} style={{ background: '#f3f0ff', color: '#4b2c85', border: '1px solid #4b2c85', padding: '2px 10px', fontSize: '0.75rem', cursor: 'pointer' }}><Edit3 size={12} /> 変更</button></div>
<div style={{ background: '#f9f9ff', padding: '15px', borderRadius: '10px', marginBottom: '25px', border: '1px dashed #4b2c85' }}>
  <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
    {(() => {
      // 1. 予約データを解析
      const opt = typeof selectedRes?.options === 'string' ? JSON.parse(selectedRes.options) : (selectedRes?.options || {});
      const people = Array.isArray(opt.people) ? opt.people : [];
      const services = Array.isArray(opt.services) ? opt.services : [];

      // 🟢 ケースA：本当に複数人の予約（グループ予約）の場合
      if (people.length > 1) {
        return people.map((person, pIdx) => {
          // その人の全メニューとオプションを結合
          const sText = person.services?.map(s => {
            const oNames = Object.values(person.options || {}).filter(o => o.service_id === s.id).map(o => o.option_name);
            return oNames.length > 0 ? `${s.name}（${oNames.join(', ')}）` : s.name;
          }).join(', ');

          return (
            <div key={pIdx} style={{ fontSize: '0.95rem', marginBottom: '8px', borderBottom: pIdx !== people.length - 1 ? '1px solid #eef' : 'none', paddingBottom: '4px' }}>
              <span style={{ color: '#4b2c85', fontWeight: '900' }}>{pIdx + 1}人目：</span>
              {sText || 'メニュー未設定'}
            </div>
          );
        });
      } 

      // ⚪ ケースB：1人予約の場合（メニューが複数あっても1つにまとめる）
      const targetServices = (people.length > 0 && people[0].services) ? people[0].services : services;
      const targetOptions = (people.length > 0 && people[0].options) ? people[0].options : (opt.options || {});

      if (targetServices.length > 0) {
        const sText = targetServices.map(s => {
          const oNames = Object.values(targetOptions).filter(o => o.service_id === s.id).map(o => o.option_name);
          return oNames.length > 0 ? `${s.name}（${oNames.join(', ')}）` : s.name;
        }).join(', ');

        return <div style={{ fontSize: '1rem' }}>{sText}</div>;
      }
      
      return <div style={{ fontSize: '1rem' }}>{selectedRes?.menu_name || 'メニュー未設定'}</div>;
    })()}
  </div>

  <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '8px' }}>
    <span>合計コマ数: {checkoutServices.reduce((sum, s) => sum + (s.slots ?? 1), 0)} コマ</span>
    <span style={{ fontWeight: 'bold', color: '#d34817', fontSize: '1rem' }}>
      施術合計: ¥ {selectedRes ? parseReservationDetails(selectedRes).totalPrice.toLocaleString() : '0'}
    </span>
  </div>
</div>
              <SectionTitle icon={<Settings size={16} />} title="プロの微調整" color="#ef4444" />
              {(() => {
                const resIds = checkoutServices.map(s => s.id);
                const proAdjs = adminAdjustments.filter(a => a.service_id !== null && resIds.includes(a.service_id));
                return proAdjs.length > 0 && (
                  <div style={{ marginBottom: '15px', padding: '10px', background: '#fff5f5', borderRadius: '8px' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#ef4444' }}>メニュー専用</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {proAdjs.map(adj => (<button key={adj.id} onClick={() => toggleCheckoutAdj(adj)} style={adjBtnStyle(checkoutAdjustments.some(a => a.id === adj.id))}>{adj.name} ({adj.is_minus ? '-' : ''}¥{adj.price})</button>))}
                    </div>
                  </div>
                );
              })()}
              {Object.entries(groupedWholeAdjustments).map(([catName, adjs]) => (
                <div key={catName} style={{ marginBottom: '10px' }}><button onClick={() => setOpenAdjCategory(openAdjCategory === catName ? null : catName)} style={categoryToggleStyle}><span>{catName}</span><ChevronRight size={18} /></button>
                {openAdjCategory === catName && (<div style={{display:'flex', flexWrap:'wrap', gap:'8px', padding:'10px'}}>{adjs.map(adj => (<button key={adj.id} onClick={() => toggleCheckoutAdj(adj)} style={adjBtnStyle(checkoutAdjustments.some(a => a.id === adj.id))}>{adj.name}</button>))}</div>)}</div>
              ))}
              <div style={{ marginTop: '30px' }}><SectionTitle icon={<ShoppingBag size={16} />} title="店販商品" color="#008000" /><div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', padding: '10px 0' }}>
  {products.map(prod => {
    const selected = checkoutProducts.find(p => p.id === prod.id);
    const qty = selected?.quantity || 0;

    return (
      <div key={prod.id} style={{ position: 'relative' }}>
        {/* 🚀 【マイナスボタン】個数が1以上の時だけ左肩に表示（スマホ対応） */}
        {qty > 0 && (
          <button
            onClick={(e) => { 
              e.stopPropagation(); // 下のプラス判定が動かないようにブロック
              removeCheckoutProduct(prod.id); 
            }}
            style={minusBtnBadge}
          >
            <Minus size={14} strokeWidth={3} />
          </button>
        )}

        {/* 🚀 【商品ボタン】タップで個数アップ */}
        <button 
          onClick={() => addCheckoutProduct(prod)}
          onContextMenu={(e) => { e.preventDefault(); removeCheckoutProduct(prod.id); }} // PCなら右クリックでも減らせる
          style={{ 
            ...adjBtnStyle(qty > 0), 
            borderColor: '#008000', 
            color: qty > 0 ? '#fff' : '#008000', 
            background: qty > 0 ? '#008000' : '#fff',
            position: 'relative',
            padding: '12px 25px',
            minWidth: '130px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px'
          }}
        >
          <span style={{ fontWeight: 'bold' }}>{prod.name}</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>¥{prod.price.toLocaleString()}</span>
          
          {/* 🔢 【個数バッジ】右肩に表示 */}
          {qty > 0 && (
            <span style={qtyBadgeStyle}>{qty}</span>
          )}
        </button>
      </div>
    );
  })}
</div>
                </div></div>
            </div>
<div style={checkoutFooterStyle}>
              {/* 合計金額表示行 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>最終合計</span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

                  {/* 🆕 B：電卓（テンキー呼び出し）ボタン */}
                  <button 
                    onClick={() => { setTempPrice(finalPrice.toString()); setIsCalculatorOpen(true); }}
                    style={{ 
                      background: isManualPrice ? '#e0e7ff' : '#f1f5f9', 
                      border: 'none', 
                      padding: '8px', 
                      borderRadius: '10px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      color: isManualPrice ? '#2563eb' : '#4b2c85',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    title="金額を手入力する"
                  >
                    <PlusCircle size={22} />
                  </button>

                  {/* 金額表示：手動入力時は青色(#2563eb)にして区別 */}
                  <span style={{ 
                    fontSize: '2.2rem', 
                    fontWeight: '900', 
                    color: isManualPrice ? '#2563eb' : '#d34817',
                    transition: 'color 0.3s'
                  }}>
                    ¥ {finalPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              <button onClick={completePayment} style={completeBtnStyle}>
                <CheckCircle size={20} /> 確定して台帳に記録
              </button>
            </div>
          </div>
        </div>
      )}

      {isCustomerInfoOpen && (
        <div style={checkoutOverlayStyle} onClick={() => setIsCustomerInfoOpen(false)}>
          <div 
            style={{ 
              ...checkoutPanelStyle, 
              // 🆕 修正：スマホの時は横幅100% ＆ 下にボトムナビ避用の余白を作る
              width: isPC ? '450px' : '100%', 
              paddingBottom: isPC ? '0' : '80px', 
              background: '#fdfcf5' 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ ...checkoutHeaderStyle, background: '#008000' }}><div><h3 style={{ margin: 0 }}>{selectedCustomer?.name} 様</h3><p style={{ fontSize: '0.8rem', margin: 0 }}>顧客カルテ編集</p></div><button onClick={() => setIsCustomerInfoOpen(false)} style={{ background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button></div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              
              {/* 🆕 🚀 ここから施設専用の利用者リストを表示！！ ================== */}
              {managedFacilityMembers.length > 0 && (
                <div style={{ marginBottom: '30px', background: '#f0f7ff', padding: '20px', borderRadius: '20px', border: '2px solid #4f46e5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <SectionTitle icon={<Users size={18} />} title="施設のご利用者・入居者様" color="#4f46e5" />
                    
                    {/* 🚀 🆕 並び替えスイッチ */}
                    <div style={{ display: 'flex', gap: '4px', background: '#fff', padding: '3px', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
                      <button onClick={() => setMemberSortMode('name')} style={miniSortBtn(memberSortMode === 'name')}>あいうえお</button>
                      <button onClick={() => setMemberSortMode('date')} style={miniSortBtn(memberSortMode === 'date')}>利用日順</button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(() => {
                      let lastLabel = "";
                      return managedFacilityMembers.map((m) => {
                        // 🚀 🆕 見出し札の文字を決定
                        let currentLabel = "";
                        if (memberSortMode === 'date') {
                          currentLabel = m.lastVisit ? m.lastVisit.substring(0, 7).replace('-', '/') : "未利用";
                        } else {
                          const first = (m.kana || "").charAt(0);
                          currentLabel = first.match(/^[ぁ-ん]$/) ? first : "他";
                        }

                        const isNewGroup = currentLabel !== lastLabel;
                        lastLabel = currentLabel;

                        return (
                          <React.Fragment key={m.name}>
                            {/* カテゴリが変わった瞬間にだけ「札」を出す */}
                            {isNewGroup && <div style={memberGroupLabel}>{currentLabel}</div>}
                            
                            <div 
                              onClick={() => openCustomerInfo({ customer_name: m.name })}
                              style={{
                                ...memberRowStyle,
                                // 🚀 🆕 亡くなった（非アクティブな）方は背景を灰色にし、文字を薄くする
                                background: m.isActive ? '#fff' : '#f1f5f9',
                                opacity: m.isActive ? 1 : 0.6,
                                border: m.isActive ? '1px solid #e0e7ff' : '1px dashed #cbd5e1'
                              }}
                            >
                              <span style={{ fontWeight: 'bold' }}>
                                {m.name} 様 {!m.isActive && '(退去/除籍済)'} 
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {m.lastVisit ? `最終: ${m.lastVisit.replace(/-/g, '/')}` : '記録なし'}
                              </span>
                            </div>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
              {/* 🏢 ここまで ====================================================== */}

              <SectionTitle icon={<User size={16} />} title={editFields.is_facility ? "施設プロフィール情報" : "基本情報"} color="#008000" />
              
              <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #eee', marginBottom: '20px' }}>
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

                      const label = getFieldLabel(key);

                      return (
                        <div key={key}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>{label}</label>
                          </div>
                          
                          {key === 'parking' ? (
                            <select 
                              disabled={editFields.is_facility} // 👈 施設なら選択不可
                              value={editFields[key] || ''} 
                              onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} 
                              style={{ 
                                ...editInputStyle, 
                                background: editFields.is_facility ? '#f1f5f9' : '#fff' // 👈 グレーアウト
                              }}
                            >
                              <option value="">未選択</option>
                              <option value="あり">あり</option>
                              <option value="なし">なし</option>
                            </select>
                          ) : (
                            <input 
      type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} 
      value={editFields[key] || ''} 
      onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} 
      style={editInputStyle} 
      placeholder="未登録" 
    />
                          )}
                        </div>
                      );
                    });
                  })()}

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>初回来店日</label>
                    <input type="date" value={editFields.first_arrival_date} onChange={(e) => setEditFields({...editFields, first_arrival_date: e.target.value})} style={editInputStyle} />
                  </div>

                  {/* 🆕 カスタム質問の回答 */}
                  {shop?.form_config?.custom_questions?.map((q) => {
                    const answer = editFields.custom_answers?.[q.id];
                    if (q.required || answer) {
                      return (
                        <div key={q.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: q.required ? `1px solid #00800033` : '1px solid #e2e8f0', marginTop: '5px' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: q.required ? '#008000' : '#64748b', display: 'block', marginBottom: '6px' }}>
                            🙋 {q.label} {q.required && <span style={{ color: '#ef4444' }}>(必須)</span>}
                          </label>
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>
                            {answer || <span style={{ color: '#cbd5e1', fontWeight: 'normal' }}>未回答</span>}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* 🚀 🆕 出禁（ブラックリスト）設定ボタン */}
              <div style={{ 
                marginBottom: '20px', padding: '15px', borderRadius: '15px', 
                background: editFields.is_blocked ? '#fff5f5' : '#f8fafc',
                border: `2px solid ${editFields.is_blocked ? '#ef4444' : '#e2e8f0'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: editFields.is_blocked ? '#ef4444' : '#1e293b' }}>
                    {editFields.is_blocked ? '🚫 ブラックリスト登録中' : '👤 通常のお客様'}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>
                    {editFields.is_blocked ? '警告アイコンが表示されています' : 'ONにすると各画面で警告アイコンが表示されます'}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={async () => {
                    // 🚀 1. 現在の状態を反転させる
                    const nextStatus = !editFields.is_blocked;
                    
                    // 🚀 2. 画面上の表示をまず切り替える
                    setEditFields({ ...editFields, is_blocked: nextStatus });

                    // 🚀 3. IDがあれば、その場でDBも更新（保存漏れ防止）
                    if (selectedCustomer?.id) {
                      const { error } = await supabase.from('customers').update({ is_blocked: nextStatus }).eq('id', selectedCustomer.id);
                      if (!error) {
                        fetchInitialData(); // 背後の名簿一覧も更新
                        alert(nextStatus ? "ブラックリストに登録しました 🚫" : "ブラックリストを解除しました ✅");
                      }
                    }
                  }}
                  style={{ 
                    padding: '8px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer',
                    background: editFields.is_blocked ? '#fff' : '#ef4444',
                    color: editFields.is_blocked ? '#ef4444' : '#fff',
                    border: `2px solid #ef4444`
                  }}
                >
                  {editFields.is_blocked ? '解除する' : '出禁にする'}
                </button>
              </div>

              <SectionTitle icon={<FileText size={16} />} title="顧客メモ" color="#d34817" />
<textarea 
  value={editFields.memo || ''} 
  onChange={(e) => setEditFields({ ...editFields, memo: e.target.value })} 
  style={{ width: '100%', minHeight: '120px', padding: '10px', borderRadius: '10px', border: '2px solid #d34817', marginBottom: '10px' }} 
  placeholder="お客様の好みや注意事項（全画面共通のメモです）"
/>
              <button onClick={saveCustomerInfo} disabled={isSavingMemo} style={{ width: '100%', padding: '15px', background: '#008000', color: '#fff', borderRadius: '10px', fontWeight: 'bold' }}>{isSavingMemo ? '保存中...' : '情報を保存'}</button>
              
              <SectionTitle icon={<History size={16} />} title="過去の履歴" color="#4b2c85" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(() => {
                  // 1. そもそも履歴がない時
                  if (pastVisits.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.8rem' }}>履歴はありません</div>;
                  }

// 🚀 2. 施設の場合：月ごとにカードを分けて「実施日」をバッジ表示
                  if (editFields.is_facility) {
                    const groups = {};
                    pastVisits.forEach(v => {
                      if (v.status === 'canceled') return; 
                      const d = new Date(v.start_time);
                      const monthKey = `${d.getFullYear()}年${d.getMonth() + 1}月`;
                      if (!groups[monthKey]) groups[monthKey] = { month: monthKey, visits: [] };
                      groups[monthKey].visits.push(v);
                    });

                    return Object.values(groups).map((group) => (
                      <div key={group.month} style={{ 
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', 
                        padding: '18px', marginBottom: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
                      }}>
                        {/* ヘッダー：月とステータス */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <span style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.05rem' }}>{group.month}度 訪問実績</span>
                          <span style={{ fontSize: '0.65rem', background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: '100px', fontWeight: 'bold', border: '1px solid #bbf7d0' }}>
                            COMPLETE
                          </span>
                        </div>
                        
                        {/* 📅 実施日バッジ：ここを一番目立たせる！ */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                          {group.visits.sort((a,b) => a.start_time.localeCompare(b.start_time)).map((v) => {
                            const date = new Date(v.start_time);
                            const dayNames = ['日','月','火','水','木','金','土'];
                            return (
                              <div key={v.id} style={{ 
                                background: '#f8fafc', border: '1px solid #cbd5e1', color: '#4b2c85',
                                padding: '6px 12px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '800',
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }}>
                                <Calendar size={14} style={{ opacity: 0.6 }} />
                                {date.getDate()}日<span style={{ fontSize: '0.7rem', fontWeight: 'bold', opacity: 0.7 }}>({dayNames[date.getDay()]})</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* 下段：メニュー名の注釈 */}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', paddingLeft: '4px' }}>
                          <Scissors size={13} /> {group.visits[0]?.menu_name || '施設訪問 施術一式'}
                        </div>
                      </div>
                    ));
                  }
                  // 🚀 3. 個人の場合：従来通りの1件ずつの詳細表示
                  return pastVisits.map(v => {
                        const details = parseReservationDetails(v);
                        const vBrandLabel = categoryMap[v.biz_type];
                        const isCanceled = v.status === 'canceled';

                        return (
                          <div 
                            key={v.id} 
                            // 🚀 🆕 修正：キャンセルでなければ、タップした時に詳細を開く
                            onClick={() => !isCanceled && openHistoryDetail(v)}
                            style={{ 
                              background: isCanceled ? '#fcfcfc' : '#fff', 
                              padding: '15px', // 少し広げました
                              borderRadius: '12px', 
                              border: '1px solid #e2e8f0',
                              opacity: isCanceled ? 0.7 : 1, 
                              position: 'relative',
                              // 🚀 🆕 修正：指マークを出し、少し浮き上がるような変化を追加
                              cursor: isCanceled ? 'default' : 'pointer',
                              transition: 'all 0.1s',
                              boxShadow: isCanceled ? 'none' : '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                            // 🚀 🆕 スマホでの押し心地を良くするためのエフェクト
                            onMouseDown={e => !isCanceled && (e.currentTarget.style.transform = 'scale(0.98)')}
                            onMouseUp={e => !isCanceled && (e.currentTarget.style.transform = 'scale(1)')}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <b style={{ textDecoration: isCanceled ? 'line-through' : 'none', color: isCanceled ? '#94a3b8' : '#1e293b' }}>
                                  {v.start_time.split('T')[0].replace(/-/g, '/')}
                                </b>
                                {vBrandLabel && (
                                  <span style={{ fontSize: '0.55rem', padding: '1px 5px', borderRadius: '4px', background: v.biz_type === 'foot' ? '#4285f4' : '#d34817', color: '#fff', fontWeight: '900' }}>
                                    {vBrandLabel.slice(0, 4)}
                                  </span>
                                )}
                                {isCanceled && <span style={{ fontSize: '0.6rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>キャンセル</span>}
                              </div>
                              <span style={{ color: isCanceled ? '#94a3b8' : '#d34817', fontWeight: 'bold', textDecoration: isCanceled ? 'line-through' : 'none' }}>
                                ¥{(v.total_price || details.totalPrice).toLocaleString()}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: isCanceled ? '#cbd5e1' : '#475569', textDecoration: isCanceled ? 'line-through' : 'none' }}>
                              <span style={{ fontWeight: 'bold', color: isCanceled ? '#cbd5e1' : '#4b2c85', marginRight: '8px' }}>👤 {v.staffs?.name || 'フリー'}</span>
                              {v.menu_name || details.menuName}
                            </p>

                            {/* 🚀 🆕 ここに追加：商品と調整の表示ロジック */}
                            {/* 🛍 商品リスト */}
                            {details.savedProducts?.length > 0 && (
                              <div style={{ marginTop: '5px', fontSize: '0.75rem', color: isCanceled ? '#cbd5e1' : '#008000', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <ShoppingBag size={12} />
                                <span>商品: {details.savedProducts.map(p => `${p.name}${p.quantity > 1 ? `(x${p.quantity})` : ''}`).join(', ')}</span>
                              </div>
                            )}

                            {/* ⚙️ 調整リスト */}
                            {details.savedAdjustments?.length > 0 && (
                              <div style={{ marginTop: '3px', fontSize: '0.7rem', color: isCanceled ? '#cbd5e1' : '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>⚙️ 調整: {details.savedAdjustments.map(a => `${a.name}${a.is_percent ? `(${a.price}%)` : ''}`).join(', ')}</span>
                              </div>
                            )}
                          </div>
                        );
                      });
                })()}
              </div>
            </div>
            {/* 🆕 修正：予約IDがある（台帳から開いた）場合のみ、お会計ボタンを表示する */}
            {selectedRes?.id && selectedRes.status !== 'canceled' && (
  <div style={{ padding: '25px', borderTop: '2px solid #ddd', background: '#fff' }}>
    <button 
      onClick={() => openCheckout(selectedRes)} 
      style={{ ...completeBtnStyle, background: '#d34817', borderRadius: '15px' }}
    >
      <Clipboard size={20} /> この予約のお会計（レジ）へ
    </button>
  </div>
)}

{/* 💡 おまけ：キャンセル済みの時は代わりにメッセージを出すと親切です */}
{selectedRes?.status === 'canceled' && (
  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 'bold' }}>
    ⚠️ この予約はキャンセル済みのためお会計できません
  </div>
)}
          </div>
        </div>
      )}

      {isMenuPopupOpen && (
        <div style={{ ...checkoutOverlayStyle, zIndex: 2000 }} onClick={() => setIsMenuPopupOpen(false)}>
          <div style={{ ...checkoutPanelStyle, width: isPC ? '400px' : '100%', borderRadius: isPC ? '25px 0 0 25px' : '30px 30px 0 0' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...checkoutHeaderStyle, background: '#4b2c85' }}>
              <h3 style={{ margin: 0 }}>メニューの追加・変更</h3>
              <button onClick={() => setIsMenuPopupOpen(false)} style={{ background: 'none', border: 'none', color: '#fff' }}><X size={24} /></button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: isPC ? '20px' : '100px' }}>
              {categories.map(cat => {
                // 🆕 カテゴリ内のサービスを抽出
                const filteredServices = services.filter(s => s.category === cat.name);
                
                // 🆕 サービスが0件のカテゴリ（店販用や調整用など）は表示をスキップ
                if (filteredServices.length === 0) return null;

                return (
                  <div key={cat.id} style={{ marginBottom: '25px' }}>
                    <h4 style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold', 
                      color: '#4b2c85', 
                      background: '#f3f0ff', 
                      padding: '4px 10px', 
                      borderRadius: '4px', 
                      marginBottom: '12px',
                      display: 'inline-block' 
                    }}>
                      {cat.name}
                    </h4>
                    
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {filteredServices.map(svc => {
                        const isSelected = checkoutServices.some(s => s.id === svc.id);
                        const svcOpts = serviceOptions.filter(o => o.service_id === svc.id);
                        const grouped = svcOpts.reduce((acc, o) => {
                          if (!acc[o.group_name]) acc[o.group_name] = [];
                          acc[o.group_name].push(o);
                          return acc;
                        }, {});

                        return (
                          <div key={svc.id} style={{ marginBottom: '10px', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
                            {/* メインのメニューボタン */}
                            <button 
                              onClick={() => toggleCheckoutService(svc)} 
                              style={{ width: '100%', padding: '15px', border: 'none', textAlign: 'left', background: isSelected ? '#f3f0ff' : '#fff', cursor: 'pointer' }}
                            >
                              <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{isSelected ? '✅ ' : ''}{svc.name}</span>
                                <span style={{ color: '#4b2c85', fontSize: '0.9rem' }}>¥{svc.price.toLocaleString()}</span>
                              </div>
                            </button>

                            {/* 枝分かれオプション（選択時のみ表示） */}
                            {isSelected && Object.keys(grouped).length > 0 && (
                              <div style={{ padding: '12px', background: '#f8fafc', borderTop: '1px solid #eee' }}>
                                {Object.keys(grouped).map(gn => (
                                  <div key={gn} style={{ marginBottom: '10px' }}>
                                    <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: '0 0 6px 0' }}>└ {gn}</p>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                      {grouped[gn].map(opt => {
                                        const isOptSelected = checkoutOptions[`${svc.id}-${gn}`]?.id === opt.id;
                                        return (
                                          <button
                                            key={opt.id}
                                            onClick={() => toggleCheckoutOption(svc.id, gn, opt)}
                                            style={{
                                              padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid',
                                              borderColor: isOptSelected ? '#4b2c85' : '#cbd5e1',
                                              background: isOptSelected ? '#4b2c85' : '#fff',
                                              color: isOptSelected ? '#fff' : '#475569', cursor: 'pointer'
                                            }}
                                          >
                                            {opt.option_name} {opt.additional_price > 0 ? `(+¥${opt.additional_price})` : ''}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ padding: '20px', background: '#f8fafc', borderTop: '1px solid #ddd' }}>
              <button onClick={applyMenuChangeToLedger} style={{ ...completeBtnStyle, background: '#4b2c85' }}>完了して反映</button>
            </div>
          </div>
        </div>
      )}

      {/* 👤 スタッフ選択モーダル */}
      {staffPickerRes && (
        <div style={modalOverlayStyle} onClick={() => setStaffPickerRes(null)}>
          <div style={{ ...modalContentStyle, maxWidth: '300px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', marginBottom: '20px', color: '#4b2c85' }}>
              「{staffPickerRes.customer_name}」様の<br />担当者を変更
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => handleUpdateStaffDirectly(staffPickerRes.id, null)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd', background: '#f8fafc', fontWeight: 'bold', cursor: 'pointer' }}>担当なし（フリー）</button>
              {staffs.map(s => (
                <button key={s.id} onClick={() => handleUpdateStaffDirectly(staffPickerRes.id, s.id)} style={{ padding: '12px', borderRadius: '10px', border: 'none', background: '#4b2c85', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>{s.name}</button>
              ))}
            </div>
            <button onClick={() => setStaffPickerRes(null)} style={{ marginTop: '20px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 📱 スマホ専用ボトムナビゲーション */}
      {!isPC && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '75px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 2000, paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -4px 15px rgba(0,0,0,0.05)' }}>
          <button onClick={() => { closeAllPopups(); setActiveMenu('work'); }} style={mobileTabStyle(activeMenu === 'work', '#d34817')}><Clipboard size={22} /><span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>台帳</span></button>
          <button onClick={() => { closeAllPopups(); setActiveMenu('customers'); }} style={mobileTabStyle(activeMenu === 'customers', '#4285f4')}><Users size={22} /><span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>名簿</span></button>
          <button onClick={() => { closeAllPopups(); setActiveMenu('analytics'); }} style={mobileTabStyle(activeMenu === 'analytics', '#008000')}><BarChart3 size={22} /><span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>分析</span></button>
          <button onClick={() => { closeAllPopups(); navigate(`/admin/${cleanShopId}/reservations`); }} style={mobileTabStyle(false, '#4b2c85')}><Calendar size={22} /><span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>戻る</span></button>
        </div>
      )}

      {/* 🆕 4. 一般的な電卓機能付きポップアップ */}
      {isCalculatorOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsCalculatorOpen(false)}>
          <div 
            style={{ ...modalContentStyle, maxWidth: '340px', padding: '20px', borderRadius: '30px' }} 
            onClick={e => e.stopPropagation()}
          >
            {/* 表示部 */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', height: '1rem' }}>
                {prevValue !== null ? `${prevValue.toLocaleString()} ${operator || ''}` : ''}
              </div>
              <div style={{ 
                fontSize: '2.4rem', 
                fontWeight: '900', 
                color: '#1e293b', 
                marginTop: '5px', 
                padding: '15px', 
                background: '#f8fafc', 
                borderRadius: '15px',
                border: '1px solid #e2e8f0',
                textAlign: 'right'
              }}>
                ¥ {Number(tempPrice).toLocaleString()}
              </div>
            </div>
            
            {/* 電卓ボタン配置（4列） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {/* ボタンの定義: 文字列は数字、オブジェクトは機能ボタン */}
              {[
                { label: 'AC', type: 'clear', color: '#fee2e2', txt: '#ef4444' },
                { label: '÷', type: 'op', op: '÷', color: '#f1f5f9', txt: '#4b2c85' },
                { label: '×', type: 'op', op: '×', color: '#f1f5f9', txt: '#4b2c85' },
                { label: '－', type: 'op', op: '－', color: '#f1f5f9', txt: '#4b2c85' },
                '7', '8', '9', { label: '＋', type: 'op', op: '＋', color: '#f1f5f9', txt: '#4b2c85' },
                '4', '5', '6', { label: '＝', type: 'equal', color: '#4b2c85', txt: '#fff' },
                '1', '2', '3', '0',
                '00', { label: 'OK', type: 'confirm', colSpan: 2, color: '#008000', txt: '#fff' }
              ].map((btn, i) => {
                const isObj = typeof btn === 'object';
                const label = isObj ? btn.label : btn;

                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (!isObj || btn === '00') {
                        // 🔢 数字入力のロジック
                        const val = isObj ? '00' : btn;
                        if (waitingForNext) {
                          setTempPrice(val);
                          setWaitingForNext(false);
                        } else {
                          setTempPrice(prev => prev === '0' ? val : prev + val);
                        }
                      } else if (btn.type === 'op') {
                        // ⚙️ 演算子（＋－×÷）のロジック
                        setPrevValue(Number(tempPrice));
                        setOperator(btn.op);
                        setWaitingForNext(true);
                      } else if (btn.type === 'equal') {
                        // ＝ のロジック
                        if (prevValue === null || !operator) return;
                        const current = Number(tempPrice);
                        let result = 0;
                        if (operator === '＋') result = prevValue + current;
                        if (operator === '－') result = prevValue - current;
                        if (operator === '×') result = prevValue * current;
                        if (operator === '÷') result = current !== 0 ? prevValue / current : 0;
                        setTempPrice(Math.round(result).toString());
                        setPrevValue(null);
                        setOperator(null);
                        setWaitingForNext(true);
                      } else if (btn.type === 'clear') {
                        // AC のロジック
                        setTempPrice('0');
                        setPrevValue(null);
                        setOperator(null);
                        setWaitingForNext(false);
                      } else if (btn.type === 'confirm') {
                        // OK（お会計に反映）
                        setFinalPrice(Number(tempPrice));
                        setIsManualPrice(true);
                        setIsCalculatorOpen(false);
                      }
                    }}
                    style={{
                      gridColumn: isObj && btn.colSpan ? `span ${btn.colSpan}` : 'auto',
                      gridRow: label === '＝' ? 'span 2' : 'auto', // ＝を縦長くする
                      padding: '18px 0', fontSize: '1.2rem', fontWeight: '900', borderRadius: '16px', border: 'none',
                      background: isObj ? btn.color : '#f1f5f9',
                      color: isObj ? btn.txt : '#1e293b',
                      cursor: 'pointer', boxShadow: '0 2px 0px rgba(0,0,0,0.05)', transition: 'transform 0.1s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setIsCalculatorOpen(false)} style={{ width: '100%', marginTop: '15px', padding: '10px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 🏢 ここから差し込む！！ ========================================== */}
      {showFacilityMembersModal && selectedFacilitySale && (
        <div style={modalOverlayStyle} onClick={() => setShowFacilityMembersModal(false)}>
          <div style={{ ...modalContentStyle, maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #4f46e5', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🏢 施術完了メンバー内訳</h3>
              <button onClick={() => setShowFacilityMembersModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            
            <div style={{ maxHeight: '40vh', overflowY: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc', fontSize: '0.75rem' }}>
                  <tr>
                    <th style={{ ...tdStyle, textAlign: 'left' }}>氏名</th>
                    <th style={tdStyle}>メニュー</th>
                    <th style={{ ...tdStyle, textAlign: 'right' }}>単価</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFacilitySale.details?.members_list?.map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ ...tdStyle, textAlign: 'left', fontSize: '0.85rem', fontWeight: 'bold' }}>{m.name} 様</td>
                      <td style={{ ...tdStyle, fontSize: '0.8rem' }}>{m.menu}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontSize: '0.85rem' }}>¥{m.price?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#f5f3ff', padding: '15px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#4f46e5' }}>合計 {selectedFacilitySale.details?.residents_count}名</span>
              <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b' }}>¥{selectedFacilitySale.total_amount?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
      {/* 🏢 ここまでが先ほど追加した「メンバー内訳」 */}


      {/* 🆕 追加：レジ忘れアラート用の点滅アニメーション命令 */}
      <style>{`
        @keyframes blinkRed {
          0% { background-color: #ffeb3b; transform: scale(1); box-shadow: 0 0 5px rgba(255, 235, 59, 0.5); }
          50% { background-color: #ff5722; color: #fff; transform: scale(1.05); box-shadow: 0 0 20px rgba(255, 87, 34, 0.8); }
          100% { background-color: #ffeb3b; transform: scale(1); box-shadow: 0 0 5px rgba(255, 235, 59, 0.5); }
        }
      `}</style>

      {/* 🚀 🆕 ここから差し込む！：過去の履歴・詳細内訳ポップアップ本体 */}
      <AnimatePresence>
        {showHistoryDetail && selectedHistory && (
          <div style={modalOverlayStyle} onClick={() => setShowHistoryDetail(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ ...modalContentStyle, maxWidth: '400px', padding: '0', overflow: 'hidden', borderRadius: '32px' }}
            >
              {/* ヘッダー */}
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
                  const productTotal = d.savedProducts.reduce((sum, p) => sum + (Number(p.price) * Number(p.quantity)), 0);
                  const technicalTotal = d.totalPrice - productTotal;

                  return (
                    <>
                      {/* ✂️ 技術セクション：1項目ずつ表示 */}
                      <div style={{ marginBottom: '25px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b2c85', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '12px' }}>
                          <Scissors size={16} /> 施術・技術メニュー
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* ① メインメニューの内訳（単価付き） */}
                          {d.items.map((item, i) => (
                            <div key={`item-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                              <span>{item.name}</span>
                              <span>¥{Number(item.price || 0).toLocaleString()}</span>
                            </div>
                          ))}

                          {/* ② 枝分かれオプション（シャンプー等）の内訳 */}
                          {d.subItems.map((opt, i) => (
                            <div key={`opt-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', paddingLeft: '15px' }}>
                              <span>└ {opt.option_name}</span>
                              <span>+¥{Number(opt.additional_price || 0).toLocaleString()}</span>
                            </div>
                          ))}

                          {/* ③ メニュー調整（割引・加算） */}
                          {d.savedAdjustments.map((adj, i) => (
                            <div key={`adj-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444', paddingLeft: '15px' }}>
                              <span>└ {adj.name}</span>
                              <span>{adj.is_minus ? '-' : '+'}¥{Number(adj.price).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 🛍 店販セクション */}
                      {d.savedProducts.length > 0 && (
                        <div style={{ marginBottom: '25px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#008000', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '12px' }}>
                            <ShoppingBag size={16} /> 店販商品
                          </div>
                          {d.savedProducts.map((p, i) => (
                            <div key={`prod-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: '8px', paddingLeft: '5px' }}>
                              <span style={{ fontWeight: 'bold' }}>{p.name} <small style={{ color: '#94a3b8' }}>x{p.quantity}</small></span>
                              <span style={{ fontWeight: '900' }}>¥{(p.price * p.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 最終集計パネル */}
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
                          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#d34817' }}>¥ {d.totalPrice.toLocaleString()}</span>
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
      {/* 🚀 🆕 ここまで差し込む！ */}
    </div>
  );
}

// スタイル定義
const SectionTitle = ({ icon, title, color }) => (<div style={{ display: 'flex', alignItems: 'center', gap: '8px', color, fontWeight: 'bold', borderBottom: `2px solid ${color}`, paddingBottom: '5px', marginBottom: '15px' }}>{icon} {title}</div>);
const fullPageWrapper = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', background: '#fff', zIndex: 9999, overflow: 'hidden' };
const sidebarStyle = { width: '260px', background: '#e0d7f7', borderRight: '2px solid #4b2c85', padding: '15px', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' };
const navBtnStyle = (active, color) => ({ width: '100%', padding: '12px', background: active ? '#fff' : color, color: active ? '#000' : '#fff', border: '1px solid #000', borderRadius: '2px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '6px', boxShadow: active ? 'inset 2px 2px 5px rgba(0,0,0,0.3)' : '2px 2px 0px rgba(0,0,0,0.5)' });
const thStyle = { padding: '12px', border: '1px solid #4b2c85', textAlign: 'center' };
const tdStyle = { padding: '12px', border: '1px solid #eee', textAlign: 'center' };
const cardStyle = { background: '#fff', border: '2px solid #4b2c85', borderRadius: '8px', marginBottom: '30px', overflow: 'hidden' };
const catHeaderStyle = { background: '#f3f0ff', padding: '15px 20px', borderBottom: '2px solid #4b2c85' };
const svcRowStyle = { padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px' };
const priceInputStyle = { border: '1px solid #ddd', padding: '5px', width: '100px', textAlign: 'right', fontWeight: '900', color: '#d34817' };
const optAddBtnStyle = { background: '#fff', border: '1px dashed #4285f4', color: '#4285f4', padding: '5px 12px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' };
const checkoutOverlayStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' };
const checkoutPanelStyle = { background: '#fff', height: '100%', boxShadow: '-5px 0px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' };
const checkoutHeaderStyle = { background: '#4b2c85', color: '#fff', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const checkoutFooterStyle = { background: '#f8fafc', padding: '25px', borderTop: '2px solid #ddd' };
const adjBtnStyle = (active) => ({ padding: '10px 15px', background: active ? '#ef4444' : '#fff', color: active ? '#fff' : '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' });
const completeBtnStyle = { width: '100%', padding: '15px', background: '#008000', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
const editInputStyle = { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '10px' };
const headerBtnSmall = { padding: '5px 12px', borderRadius: '6px', border: '1px solid #fff', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' };
const categoryToggleStyle = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', color: '#4b2c85' };
const miniPriceInput = { border: 'none', background: '#f1f5f9', width: '60px', textAlign: 'right', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' };
const adjChipStyle = { background: '#fff5f5', border: '1px solid #feb2b2', padding: '8px 12px', display: 'flex', gap: '5px', borderRadius: '10px' };
const typeBtnStyle = { border: '1px solid #ef4444', background: '#fff', borderRadius: '4px', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444' };
const optInputStyle = { background: 'transparent', border: 'none', fontSize: '0.9rem', fontWeight: 'bold' };
const optPriceStyle = { border: 'none', background: '#fff', width: '70px', textAlign: 'right', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' };
const yearBtnStyle = { background: 'rgba(255,255,255,0.2)', border: '1px solid #fff', color: '#fff', padding: '5px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const monthCardStyle = { background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', cursor: 'pointer' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 };
const modalContentStyle = { background: '#fff', padding: '25px', borderRadius: '24px', width: '90%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };

const mobileTabStyle = (active, color) => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
  background: 'none', border: 'none', color: active ? color : '#94a3b8',
  cursor: 'pointer', flex: 1, padding: '8px 0', transition: 'all 0.2s'
});

const badgeStyle = (color) => ({
  textDecoration: 'none', background: color, color: '#fff',
  padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem',
  fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', boxShadow: `0 2px 4px ${color}33`,
  marginLeft: '10px'
});

// 🆕 これをスタイル定義エリア（ファイルの末尾付近）に追加してください
const circleBtn = { 
  width: '44px', 
  height: '44px', 
  borderRadius: '50%', 
  border: '1px solid #cbd5e1', 
  backgroundColor: 'white', 
  cursor: 'pointer', 
  fontSize: '18px', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center',
  transition: 'all 0.2s'
};
const minusBtnBadge = {
  position: 'absolute',
  top: '-10px',
  left: '-10px',
  width: '30px',
  height: '30px',
  borderRadius: '50%',
  background: '#fff',
  border: '2px solid #ef4444',
  color: '#ef4444',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 10,
  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
  padding: 0
};

// 🆕 個数バッジ（右肩の白い数字）
const qtyBadgeStyle = {
  position: 'absolute',
  top: '-10px',
  right: '-10px',
  background: '#ef4444',
  color: '#fff',
  borderRadius: '50%',
  width: '26px',
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.8rem',
  fontWeight: '900',
  border: '2px solid #fff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  zIndex: 1
};

// 🚀 🆕 施設利用者リストの並び替えボタン
const miniSortBtn = (active) => ({
  padding: '4px 8px', 
  fontSize: '0.65rem', 
  fontWeight: 'bold', 
  border: 'none', 
  borderRadius: '6px',
  cursor: 'pointer', 
  background: active ? '#4f46e5' : 'transparent', 
  color: active ? '#fff' : '#64748b', 
  transition: '0.2s'
});

// 🚀 🆕 施設利用者リストの「見出し札（あ、い、2026/03...）」
const memberGroupLabel = {
  fontSize: '0.7rem', 
  fontWeight: '900', 
  color: '#4f46e5', 
  padding: '10px 5px 2px', 
  borderBottom: '1px solid #e0e7ff', 
  marginBottom: '4px'
};

// 🚀 🆕 施設利用者リストの「一行」のデザイン
const memberRowStyle = {
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  padding: '12px 15px',
  background: '#fff', 
  borderRadius: '12px', 
  border: '1px solid #e0e7ff', 
  cursor: 'pointer',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  marginTop: '4px'
};

/* --- 🚀 ここまで追加 --- */

export default AdminManagement;