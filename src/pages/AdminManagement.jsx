import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Save, Clipboard, Calendar, FolderPlus, PlusCircle, Trash2, 
  Tag, ChevronDown, RefreshCw, ChevronLeft, ChevronRight, Settings, Users, Percent, Plus, Minus, X, CheckCircle, User, FileText, History, ShoppingBag, Edit3, BarChart3,
  AlertCircle,
  ReceiptText
} from 'lucide-react';

function AdminManagement() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const cleanShopId = shopId?.trim();

  // --- 画面管理・日付 ---
  const [activeMenu, setActiveMenu] = useState('work');
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [customerMemo, setCustomerMemo] = useState('');
  const [firstArrivalDate, setFirstArrivalDate] = useState(''); 
  const [pastVisits, setPastVisits] = useState([]);
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [editFields, setEditFields] = useState({
    name: '', furigana: '', email: '', phone: '', 
    zip_code: '', address: '', parking: '', 
    building_type: '', care_notes: '', company_name: '', 
    symptoms: '', request_details: '', 
    first_arrival_date: '', memo: '', custom_answers: {}
  });

  // --- 🆕 施設訪問の内訳ポップアップ用 ---
  const [showFacilityMembersModal, setShowFacilityMembersModal] = useState(false);
  const [selectedFacilitySale, setSelectedFacilitySale] = useState(null);

  // 🆕 請求書用State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState(null); // { customer_id, name }
  // 🆕 追記：請求書の対象年月を管理（初期値は現在の年月）
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear());
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1);
  const [memberSortMode, setMemberSortMode] = useState('name');

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
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone') // 電話番号も取得しておくと後で便利です
      .eq('shop_id', cleanShopId)
      .ilike('name', `%${val}%`) // あいまい検索
      .limit(5); // 候補は5件まで
    
    if (error) console.error("Search Error:", error);
    setSearchResults(data || []);
    setIsSearchLoading(false);
  };

  // 検索結果の候補をクリックした時の処理
  const selectSearchResult = (cust) => {
    // 幽霊データを防ぐため、ダミーの予約オブジェクト形式にしてカルテ関数に渡す
    openCustomerInfo({ customer_name: cust.name });
    
    // 検索窓をきれいにする
    setSearchTerm('');
    setSearchResults([]);
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

  const parseReservationDetails = (res) => {
    if (!res) return { menuName: '', totalPrice: 0, items: [], subItems: [], savedAdjustments: [], savedProducts: [] };
    const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
    let items = [];
    let subItems = [];

    if (opt.people && Array.isArray(opt.people)) {
      items = opt.people.flatMap(p => p.services || []);
      subItems = opt.people.flatMap(p => Object.values(p.options || {}));
    } else {
      items = opt.services || [];
      subItems = Object.values(opt.options || {});
    }

    const baseNames = items.map(s => s.name).join(', ');
    const optionNames = subItems.map(o => o.option_name).join(', ');
    const fullMenuName = res.menu_name || (optionNames ? `${baseNames}（${optionNames}）` : (baseNames || 'メニューなし'));

    let basePrice = items.reduce((sum, item) => {
      let p = Number(item.price);
      if (!p || p === 0) {
        const master = services.find(s => s.id === item.id || s.name === item.name);
        p = master ? Number(master.price) : 0;
      }
      return sum + p;
    }, 0);

    const optPrice = subItems.reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);

    return { 
      menuName: fullMenuName, 
      totalPrice: basePrice + optPrice, 
      items, 
      subItems, 
      savedAdjustments: opt.adjustments || [], 
      savedProducts: opt.products || [] 
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
        furigana: editFields.furigana || currentMaster?.furigana || '',
        phone: editFields.phone || currentMaster?.phone || selectedRes.customer_phone || '',
        email: editFields.email || currentMaster?.email || selectedRes.customer_email || '',
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
          adjustments: checkoutAdjustments, 
          products: checkoutProducts, 
          options: checkoutOptions,
          isUpdatedFromCheckout: true
        }
      }).eq('id', selectedRes.id);

      // --- ステップD：売上データ（sales）の記録（シンプルupsert） ---
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
          adjustments: checkoutAdjustments 
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

  // 🆕 修正：台帳（sales）にある「その日の確定売上」をすべて合計するロジック
  const salesBreakdown = useMemo(() => {
    const breakdown = { total: 0, common: 0, byBiz: {} };

    salesRecords.filter(s => {
      if (!s.sale_date) return false;
      const sDate = s.sale_date.toString().split('T')[0].replace(/\//g, '-');
      const tDate = selectedDate.toString().split('T')[0].replace(/\//g, '-');
      return sDate === tDate;
    }).forEach(s => {
      const amount = Number(s.total_amount) || 0;
      breakdown.total += amount;

      // 💡 売上記録に関連する予約を探して、識別キー(biz_type)を確認する
      const associatedRes = allReservations.find(r => r.id === s.reservation_id);
      const bType = associatedRes?.biz_type;

      if (bType && categoryMap[bType]) {
        const name = categoryMap[bType];
        breakdown.byBiz[name] = (breakdown.byBiz[name] || 0) + amount;
      } else {
        // 識別キーがない、または通常の予約の場合
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
        // ✅ 個人予約(individual)または施設訪問(facility)の両方を対象にする
        (r.task_type === 'individual' || r.task_type === 'facility') && 
        r.status !== 'completed' && 
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
    month: i + 1, total: 0, count: 0,
    // 🆕 事業別の内訳を保持する箱を追加
    breakdown: { [mainName]: 0 }, 
    days: Array.from({ length: new Date(currentYear, i + 1, 0).getDate() }, (_, j) => ({ 
      day: j + 1, total: 0, count: 0, breakdown: { [mainName]: 0 } 
    }))
  }));

  const validTasks = allReservations.filter(r => (r.task_type === 'individual' || r.task_type === 'facility') && r.is_block !== true);
  const validResIds = new Set(validTasks.filter(r => r.task_type === 'individual').map(r => r.id));

  salesRecords.forEach(s => {
    const d = new Date(s.sale_date);
    if (d.getFullYear() === currentYear) {
      const mIdx = d.getMonth();
      const dIdx = d.getDate() - 1;
      const amount = Number(s.total_amount) || 0;

      // 💡 どの事業か特定する
      const res = allReservations.find(r => r.id === s.reservation_id);
      const bizName = (res?.biz_type && categoryMap[res.biz_type]) ? categoryMap[res.biz_type] : mainName;

      if (months[mIdx] && months[mIdx].days[dIdx]) {
        months[mIdx].total += amount;
        months[mIdx].count += 1;
        // 🆕 事業別の加算
        months[mIdx].breakdown[bizName] = (months[mIdx].breakdown[bizName] || 0) + amount;

        months[mIdx].days[dIdx].total += amount;
        months[mIdx].days[dIdx].count += 1;
        months[mIdx].days[dIdx].breakdown[bizName] = (months[mIdx].days[dIdx].breakdown[bizName] || 0) + amount;
      }
    }
  });

  return months;
}, [allReservations, salesRecords, viewYear, categoryMap, shop]);

  // 🆕 🚀 ここから追加！！ ==========================================
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
        // ひらがなを正規化（カタカナをひらがなに変換して「あいうえお順」を確実にする）
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
    
    // 1. ヘッダー行を作成
    let csvContent = "日付,来客数,売上合計\n";
    
    // 2. 日ごとのデータを1行ずつ作成
    monthData.days.forEach(d => {
      // 売上が1円でもある日だけ出力します
      if (d.total > 0) {
        csvContent += `${viewYear}/${monthData.month}/${d.day},${d.count},${d.total}\n`;
      }
    });
    
    // 3. 最後に月の合計行を追加
    csvContent += `合計,${monthData.count},${monthData.total}\n`;

    // 4. ファイルとしてダウンロードするための「魔法の処理」
    // \uFEFF はExcelで開いた時に文字化けしないためのおまじない（BOM）です
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `売上台帳_${viewYear}年${monthData.month}月.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🆕 ここから追加：お客様詳細（カルテ）を開く関数
  const openCustomerInfo = async (res) => {
    if (!res || !res.customer_name) {
      alert("顧客名が記録されていないため、カルテを開けません。");
      return;
    }

    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', cleanShopId)
        .eq('name', res.customer_name)
        .maybeSingle();

      // 🚀 🆕 施設の場合、facility_users テーブルからも詳細を取得する
      let facilityDetail = null;
      if (customer?.is_facility) {
        const { data: fData } = await supabase
          .from('facility_users')
          .select('*')
          .eq('facility_name', customer.name)
          .maybeSingle();
        facilityDetail = fData;
      }

      const visitInfo = res.options?.visit_info || {};
      const allFields = {
        is_facility: customer?.is_facility || false, // 🚀 🆕 施設判定を保持
        name: customer?.name || res.customer_name || '',
        // 🚀 🆕 施設なら「担当者名」、個人なら「ふりがな」をセット
        furigana: facilityDetail?.contact_name || customer?.furigana || visitInfo.furigana || '',
        phone: facilityDetail?.tel || customer?.phone || res.customer_phone || '',
        email: facilityDetail?.email || customer?.email || res.customer_email || '',
        zip_code: customer?.zip_code || visitInfo.zip_code || '',
        address: facilityDetail?.address || customer?.address || visitInfo.address || '',
        parking: customer?.parking || visitInfo.parking || '',
        building_type: customer?.building_type || visitInfo.building_type || '',
        care_notes: customer?.care_notes || visitInfo.care_notes || '',
        company_name: customer?.company_name || visitInfo.company_name || '',
        symptoms: customer?.symptoms || visitInfo.symptoms || '',
        request_details: customer?.request_details || visitInfo.request_details || '',
        first_arrival_date: customer?.first_arrival_date || '',
        memo: customer?.memo || '',
        line_user_id: customer?.line_user_id || res.line_user_id || null,
        custom_answers: visitInfo.custom_answers || customer?.custom_answers || {}
      };

      setSelectedCustomer(customer || { name: res.customer_name });
      setEditFields(allFields);
      setSelectedRes(res);

      // 2. 過去の来店履歴（完了済み予約）を取得
      const { data: visits } = await supabase
        .from('reservations')
        .select('*, staffs(name)')
        .eq('shop_id', cleanShopId)
        .eq('customer_name', res.customer_name)
        .eq('status', 'completed')
        .order('start_time', { ascending: false });

      setPastVisits(visits || []);
      
      // パネルを表示
      setIsCustomerInfoOpen(true);
      setIsCheckoutOpen(false); // レジが開いていたら閉じる
    } catch (err) {
      console.error("Customer Info Error:", err);
    }
  };

  const saveCustomerInfo = async () => {
    if (!selectedCustomer) return; 
    setIsSavingMemo(true);

    // 🆕 修正：editFields.name を使うように変更
    const normalizedName = (editFields.name || '').replace(/　/g, ' ').trim(); 

    try {
      const currentId = selectedCustomer.id;
      const { data: duplicate } = await supabase.from('customers').select('*').eq('shop_id', cleanShopId).eq('name', normalizedName).neq('id', currentId || '00000000-0000-0000-0000-000000000000').maybeSingle();
      
      if (duplicate && window.confirm(`「${normalizedName}」様を統合しますか？`)) {
          await supabase.from('customers').update({ 
            memo: `${duplicate.memo || ''}\n\n${editFields.memo}`.trim(), 
            total_visits: (duplicate.total_visits || 0) + (selectedCustomer.total_visits || 0), 
            phone: editFields.phone || duplicate.phone, 
            email: editFields.email || duplicate.email, 
            updated_at: new Date().toISOString() 
          }).eq('id', duplicate.id);
          await supabase.from('reservations').update({ customer_name: normalizedName }).eq('shop_id', cleanShopId).eq('customer_name', selectedCustomer.name);
          if (currentId) await supabase.from('customers').delete().eq('id', currentId);
          alert("統合完了！"); setIsCustomerInfoOpen(false); fetchInitialData(); return;
      }
      
      // 🆕 修正：送信データを一括Stateから取得
      const payload = { 
        shop_id: cleanShopId, 
        name: normalizedName, 
        furigana: editFields.furigana, // 施設ならここが担当者名として保存される
        phone: editFields.phone, 
        email: editFields.email, 
        address: editFields.address,
        is_facility: editFields.is_facility, // 🚀 🆕 施設フラグを維持
        zip_code: editFields.zip_code,
        parking: editFields.parking,
        building_type: editFields.building_type,
        care_notes: editFields.care_notes,
        company_name: editFields.company_name,
        symptoms: editFields.symptoms,
        request_details: editFields.request_details,
        memo: editFields.memo, 
        first_arrival_date: editFields.first_arrival_date, 
        updated_at: new Date().toISOString() 
      };
      
      if (currentId) await supabase.from('customers').update(payload).eq('id', currentId); 
      else await supabase.from('customers').insert([payload]);

      // 🚀 🆕 施設の場合、facility_users テーブル側も更新する
      if (editFields.is_facility) {
        await supabase.from('facility_users').update({
          contact_name: editFields.furigana, // ふりがな欄を「担当者名」として同期
          tel: editFields.phone,
          email: editFields.email,
          address: editFields.address
        }).eq('facility_name', normalizedName);
      }

      alert("情報を更新しました。"); 
      fetchInitialData();
    } catch (err) { alert("失敗: " + err.message); } 
    finally { setIsSavingMemo(false); }
  };

  const handleUpdateStaffDirectly = async (resId, newStaffId) => {
    try {
      const { error } = await supabase.from('reservations').update({ staff_id: newStaffId }).eq('id', resId);
      if (error) throw error;
      setStaffPickerRes(null); 
      fetchInitialData();
    } catch (err) { alert("担当者の変更に失敗しました"); }
  };

  const handleDateChangeUI = (days) => { const d = new Date(selectedDate); d.setDate(d.getDate() + days); setSelectedDate(d.toLocaleDateString('sv-SE')); };

  // 🆕 修正：開いているポップアップをすべて強制終了する関数
  const closeAllPopups = () => {
    setIsCustomerInfoOpen(false); // 顧客カルテ
    setIsCheckoutOpen(false);     // レジ
    setIsMenuPopupOpen(false);     // メニュー変更
    setStaffPickerRes(null);      // スタッフ選択
    setSelectedMonthData(null);    // 売上分析の詳細
    setShowInvoiceModal(false);
  };

  // 🆕 🚀 ここから差し込む！！ ==========================================
  const handlePrintInvoice = (mode, data) => {
    const printWin = window.open('', '_blank', 'width=900,height=1000');
    
    const members = data.flatMap(s => {
      if (s.details?.members_list) {
        return s.details.members_list.map(m => ({ ...m, date: s.sale_date }));
      }
      const baseNames = (s.details?.services || []).map(svc => svc.name).join(', ');
      const optNames = s.details?.options ? Object.values(s.details.options).map(o => o.option_name).join(', ') : '';
      const fullMenu = optNames ? `${baseNames}（${optNames}）` : (baseNames || 'メニューなし');
      return [{
        date: s.sale_date,
        name: invoiceTarget.name,
        floor: '-',
        menu: fullMenu,
        price: s.total_amount
      }];
    });

    members.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const total = data.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const displayMonth = invoiceMonth;

    let content = `
      <html>
        <head>
          <title> </title>
          <style>
            @page { 
              size: A4; 
              margin: ${mode === 'full' ? '20mm 15mm' : '0'}; 
            }
            body { 
              font-family: "MS Mincho", "Hiragino Mincho ProN", serif; 
              margin: 0; padding: 0; background: white; color: black;
            }
            .page { width: 100%; box-sizing: border-box; position: relative; }
            .flex { display: flex; justify-content: space-between; align-items: flex-start; }
            
            /* テーブルデザイン：左右の線を消し、ストライプを導入 */
            table { 
              width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed;
              border-top: 2px solid #000; 
            }
            th, td { 
              padding: 10px 4px; text-align: left; font-size: 10.5pt; word-wrap: break-word; 
              border: none; border-bottom: 1px solid #ccc; 
            }
            th { 
              background: #fff; text-align: center; font-weight: bold; border-bottom: 1px solid #000; 
            }
            tbody tr:nth-child(even) { background-color: #f8fafc; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            
            .summary-total-container { margin-top: 30px; text-align: center; margin-bottom: 30px; }
            .summary-total { font-size: 20pt; font-weight: 900; border-bottom: 3px double #000; padding: 10px 20px; display: inline-block; }
            .bank-info { margin-top: 0px; border: 1px solid #000; padding: 15px; font-size: 11pt; line-height: 1.6; page-break-inside: avoid; }
            .ticket-page { width: 210mm; height: 297mm; display: flex; flex-wrap: wrap; align-content: flex-start; page-break-after: always; }
            .ticket { width: 105mm; height: 74.25mm; padding: 10mm; box-sizing: border-box; display: flex; flex-direction: column; border: 0.1mm dashed #ccc; position: relative; }
          </style>
        </head>
        <body>
    `;

    if (mode === 'full') {
      content += `
        <div class="page">
          
          <div class="flex" style="margin-bottom: 40px; align-items: flex-start;">
            <div style="font-size: 20pt; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 5px; width: 350px;">
              ${displayMonth}月度 請求明細書
            </div>
            
            <div style="text-align: right; line-height: 1.4; font-size: 10pt; width: 300px;">
              <p style="font-weight: bold; font-size: 12pt; margin: 0 0 5px 0;">${shop?.business_name || '美容室名'}</p>
              <p style="margin: 0;">〒${shop?.zip_code || ''}</p>
              <p style="margin: 0;">${shop?.address || ''}</p>
              <p style="margin: 0;">TEL: ${shop?.phone || ''}</p>
            </div>
          </div>

          <div style="text-align: left; margin-bottom: 30px;">
             <div style="font-size: 22pt; font-weight: bold; border-bottom: 3px solid #000; display: inline-block; padding-bottom: 5px; min-width: 400px; ">
               ${invoiceTarget?.name} 御中
             </div>
             <p style="margin: 15px 0 0 0; font-size: 12pt;">下記の通り、御請求申し上げます。</p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;">No</th>
                <th style="width: 12%;">日付</th>
                <th style="width: 9%;">階数</th>
                <th style="width: 22%;">名前</th>
                <th style="width: 39%;">メニュー</th>
                <th style="width: 13%; text-align:right;">金額</th>
              </tr>
            </thead>
            <tbody>
              ${members.map((m, index) => {
                const dateObj = m.date ? new Date(m.date) : null;
                const formattedDate = dateObj ? `${dateObj.getMonth() + 1}/${dateObj.getDate()}` : '---';
                return `
                  <tr>
                    <td style="text-align:center;">${index + 1}</td>
                    <td style="text-align:center;">${formattedDate}</td>
                    <td style="text-align:center;">${m.floor || '-'}</td>
                    <td><strong>${m.name} 様</strong></td>
                    <td style="font-size: 9.5pt;">${m.menu}</td>
                    <td style="text-align:right; font-weight: bold;">¥${Number(m.price || 0).toLocaleString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="summary-total-container">
            <div class="summary-total">
               ご請求金額： ¥ ${total.toLocaleString()} - (税込)
            </div>
          </div>

          <div class="bank-info">
            <span style="font-weight:bold; text-decoration:underline;">【お振込先】</span><br/>
            ${shop?.bank_name || '---'} ${shop?.bank_branch || '---'} / ${shop?.bank_account_type || '普通'} ${shop?.bank_account_number || '---'} / ${shop?.bank_account_holder || '---'}
          </div>
        </div>
      `;
    } else {
      // --- ✂️ 8分割領収書モード（デザイン修正版） ---
      const pages = Math.ceil(members.length / 8);
      
      for (let p = 0; p < pages; p++) {
        content += `<div class="ticket-page">`;
        
        // 1ページ内の8件分を処理
        members.slice(p * 8, (p + 1) * 8).forEach((m, i) => {
          // 🚀 全体での通し番号（No.）を計算
          const absoluteNo = (p * 8) + i + 1;

          content += `
            <div class="ticket">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 5px;">
                <div style="font-size: 11pt;">領収書</div>
                <div style="font-size: 10pt; font-weight: bold;">No. ${absoluteNo}</div>
              </div>

              <div style="text-align: center; margin: 12px 0;">
                <span style="font-size: 16pt; font-weight: bold; border-bottom: 1px solid #000; padding: 0 15px;">
                  ${m.name} 様
                </span>
              </div>

              <div style="background: #eee; text-align: center; font-size: 20pt; font-weight: bold; padding: 8px; -webkit-print-color-adjust: exact;">
                ¥${Number(m.price || 0).toLocaleString()}
              </div>

              <div style="border-bottom: 1px solid #000; margin: 10px 0; font-size: 10pt;">
                但 ${m.menu} 代として
              </div>

              <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end;">
                <span style="font-size: 12pt; font-weight: bold;">
                  ${m.date?.replace(/-/g, '/')}
                </span>
                <div style="text-align: right; font-size: 9pt;">
                  <strong>${shop?.business_name}</strong>
                </div>
              </div>
            </div>
          `;
        });
        content += `</div>`;
      }
    }

    content += `
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `;
    printWin.document.write(content);
    printWin.document.close();
  };
  // 🏢 ここまで ======================================================

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

                {/* 🆕 修正：レジ忘れアラートボタン */}
                {oldestIncompleteDate && (
                  <button
                    onClick={() => setSelectedDate(oldestIncompleteDate)}
                    style={{
                      background: '#ffeb3b',
                      color: '#d34817',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '900',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      animation: 'blinkRed 1.5s infinite', // 💡 下で定義する点滅アニメーション
                      boxShadow: '0 0 15px rgba(255, 235, 59, 0.5)'
                    }}
                  >
                    <AlertCircle size={14} /> 
                    未処理あり！ ({oldestIncompleteDate.replace(/-/g, '/')})
                  </button>
                )}
              </div>
<div style={{ display: 'flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
  {/* 🔍 検索入力エリア */}
  <div style={{ position: 'relative' }}>
    <input 
      type="text" 
      placeholder="顧客検索..." 
      value={searchTerm}
      onChange={(e) => {
        handleSearch(e.target.value);
        setSelectedIndex(-1);
      }}
      onKeyDown={handleKeyDown}
      style={{ 
        padding: '5px 10px', 
        borderRadius: '6px', 
        border: 'none', 
        fontSize: '0.8rem', 
        width: isPC ? '150px' : '100px',
        marginRight: '10px',
        outline: 'none'
      }} 
    />

    {/* 検索結果のドロップダウン（スッキリ版に統合） */}
    {searchResults.length > 0 && (
      <div style={{ 
        position: 'absolute', top: '35px', left: 0, width: '220px', 
        background: '#fff', color: '#333', borderRadius: '8px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 100,
        overflow: 'hidden', border: '1px solid #ddd'
      }}>
        {searchResults.map((cust, index) => (
          <div 
            key={cust.id} 
            onClick={() => selectSearchResult(cust)}
            onMouseEnter={() => setSelectedIndex(index)}
            style={{ 
              padding: '12px 15px', 
              borderBottom: '1px solid #f1f5f9', 
              cursor: 'pointer', 
              fontSize: '0.85rem',
              background: selectedIndex === index ? '#f3f0ff' : '#fff',
              color: selectedIndex === index ? '#4b2c85' : '#333',
            }}
          >
            <div style={{ fontWeight: 'bold' }}>{cust.name} 様</div>
            {cust.phone && (
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                📞 {cust.phone}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>

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
                            <td 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if(!isFacility) openCheckout(res); 
                              }} 
                              style={{ 
                                ...tdStyle, 
                                fontWeight: '900', 
                                color: isFinalized ? '#1e293b' : '#d34817', 
                                cursor: isFacility ? 'default' : 'pointer'
                              }}
                            >
                              ¥ {Number(displayPrice).toLocaleString()}
                              {!isFinalized && displayPrice > 0 && (
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
  .filter(r => r.start_time.startsWith(selectedDate) && !isSalesExcludedRes(r)) // 💡 res_type の縛りを解除！
  .length > 0 ? (
    allReservations
      .filter(r => r.start_time.startsWith(selectedDate) && !isSalesExcludedRes(r))
      .map((res) => {
                      const details = parseReservationDetails(res);
                      const isCompleted = res.status === 'completed';
                      return (
                        <div 
                          key={res.id} 
                          style={{ 
                            background: '#fff', 
                            borderRadius: '16px', 
                            padding: '16px', 
                            boxShadow: '0 4px 15px rgba(0,0,0,0.05)', 
                            border: `1px solid ${isCompleted ? '#e2e8f0' : '#d3481722'}`,
                            position: 'relative'
                          }}
                        >
                          {/* ステータスバー（左端の色） */}
                          <div style={{ position: 'absolute', left: 0, top: 15, bottom: 15, width: '4px', background: isCompleted ? '#94a3b8' : '#008000', borderRadius: '0 4px 4px 0' }} />
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingLeft: '8px' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>
                              {new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button 
                              onClick={() => setStaffPickerRes(res)}
                              style={{ background: '#f3f0ff', color: '#4b2c85', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold' }}
                            >
                              👤 {res.staffs?.name || '担当者選択'}
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', paddingLeft: '8px' }}>
<div 
  onClick={() => openCustomerInfo(res)} 
  style={{ flex: 1, fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}
>
  {/* 🆕 ここも同様にガードを入れます */}
  {res.customer_name || '名前なし'} 様
</div>
                            <button 
                              onClick={() => openCheckout(res)}
                              style={{ 
                                background: isCompleted ? '#f1f5f9' : '#008000', 
                                color: isCompleted ? '#94a3b8' : '#fff', 
                                border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold' 
                              }}
                            >
                              {isCompleted ? '確定済 ✓' : 'レジへ'}
                            </button>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px', paddingLeft: '8px', lineHeight: '1.4' }}>
                            📋 {details.menuName}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', paddingLeft: '8px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>お会計金額</span>
                            <span style={{ fontSize: '1.3rem', fontWeight: '900', color: isCompleted ? '#1e293b' : '#d34817' }}>
                              ¥ {Number(res.total_price || details.totalPrice).toLocaleString()}
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

            {/* 🚀 フッター：合計金額表示 */}
            <div style={{ 
              background: '#1e293b', // 深い色で引き締める
              padding: isPC ? '15px 25px' : '10px 20px', 
              color: '#fff',
              boxShadow: '0 -4px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'center' }}>
                
                {/* 📊 各事業の内訳 */}
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                  
                  {/* メイン店舗（business_name）の売上 */}
                  {salesBreakdown.common > 0 && (
                    <div style={{ fontSize: '0.8rem' }}>
                      <span style={{ 
                        opacity: 0.8, 
                        fontWeight: 'bold',
                        color: '#94a3b8', // メインは少し落ち着いた色に
                        marginRight: '5px'
                      }}>
                        {shop?.business_name || '通常'}：
                      </span>
                      <span style={{ fontWeight: '900' }}>
                        ¥{salesBreakdown.common.toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {/* 各屋号ごとの売上 */}
                  {Object.entries(salesBreakdown.byBiz).map(([name, amount]) => (
                    <div key={name} style={{ fontSize: '0.8rem' }}>
                      <span style={{ 
                        padding: '1px 6px', borderRadius: '4px', marginRight: '5px',
                        background: name.includes('フット') ? '#4285f4' : '#d34817',
                        fontSize: '0.65rem', fontWeight: 'bold'
                      }}>{name}</span>
                      <span style={{ fontWeight: 'bold' }}>¥{amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* 🏆 総計 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.8 }}>本日の総売上</span>
                  <span style={{ fontSize: isPC ? '1.8rem' : '1.4rem', fontWeight: '900', color: '#fbbf24' }}>
                    ¥ {salesBreakdown.total.toLocaleString()}
                  </span>
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
    // 🆕 修正：スマホの時だけ下を80px空けて、ボトムナビを避ける
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
              paddingBottom: isPC ? '20px' : '100px' // スマホ時は下タブの分余白を作る
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isPC ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', 
                gap: '15px' 
              }}>
                {allCustomers
  // 🚀 🆕 ブロック用の名前（臨時休業、管理者ブロック）を持つ顧客は名簿に表示しない
  .filter(c => !['臨時休業', '管理者ブロック'].includes(c.name)) 
  .filter(c => (c.name || '').includes(searchTerm) || (c.phone || '').includes(searchTerm))
  .map(cust => {
                    // 🆕 修正：ここでお客様ごとの「完了済み予約」をリアルタイムに計算します
                    const realVisitCount = allReservations.filter(r => 
  (r.customer_name === cust.name || r.customer_id === cust.id) && 
  r.status === 'completed' && 
  // ✅ res_type ではなく task_type または存在確認で判定する
  (r.task_type === 'individual' || r.task_type === 'facility')
).length;

                    return (
                      <div 
                        key={cust.id} 
                        onClick={() => openCustomerInfo({ customer_name: cust.name })} 
                        style={{ 
                          background: '#fff', 
                          padding: '18px', 
                          borderRadius: '16px', 
                          boxShadow: '0 4px 6px rgba(0,0,0,0.05)', 
                          cursor: 'pointer', 
                          border: '1px solid #e2e8f0', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          transition: 'transform 0.1s',
                        }}
                        onMouseEnter={(e) => isPC && (e.currentTarget.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => isPC && (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>{cust.name} 様</div>
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
                          
                          {/* 🚀 🆕 スッキリ！DBの施設フラグが true の顧客のみボタンを表示 */}
                          {cust.is_facility === true && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                setInvoiceTarget({ id: cust.id, name: cust.name });
                setShowInvoiceModal(true);
              }}
              style={{ 
                padding: '4px 10px', background: '#f3f0ff', color: '#4b2c85', 
                border: '1px solid #4b2c85', borderRadius: '6px', fontSize: '0.7rem', 
                fontWeight: 'bold', cursor: 'pointer', marginTop: '5px'
              }}
            >
              <ReceiptText size={12} style={{marginRight:'3px'}} /> 請求書発行
            </button>
          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
              
              {allCustomers.filter(c => c.name.includes(searchTerm) || (c.phone && c.phone.includes(searchTerm))).length === 0 && (
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
                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '10px', paddingTop: '10px' }}>
                    {Object.entries(m.breakdown).map(([name, price]) => price > 0 && (
                      <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '3px' }}>
                        <span style={{ 
                          color: name === (shop?.business_name || '通常') ? '#94a3b8' : (name.includes('フット') ? '#4285f4' : '#d34817'),
                          fontWeight: 'bold'
                        }}>{name}</span>
                        <span style={{ fontWeight: 'bold' }}>¥{price.toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '5px' }}>
                      <span style={{ color: '#1e293b', fontSize: '0.8rem', fontWeight: 'bold' }}>合計</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#d34817' }}>¥ {m.total.toLocaleString()}</span>
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
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}><tr style={{ background: '#f8fafc' }}><th style={thStyle}>日付</th><th style={thStyle}>来客数</th><th style={thStyle}>売上高</th></tr></thead>
                      <tbody>
                        {selectedMonthData.days.filter(d => d.total > 0).length > 0 ? (
                          selectedMonthData.days.filter(d => d.total > 0).map(d => (
                            <tr key={d.day} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={tdStyle}>{d.day}日</td>
                              <td style={tdStyle}>{d.count}名</td>
                              <td style={{ ...tdStyle, fontWeight: 'bold', color: '#d34817' }}>¥ {d.total.toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>売上データなし</td></tr>
                        )}
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
                              style={memberRowStyle}
                            >
                              <span style={{ fontWeight: 'bold' }}>{m.name} 様</span>
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
                  
                  {/* 🚀 🆕 施設でない（個人客の）場合のみ、提携チェックボックスを表示する */}
                  {!editFields.is_facility && (
                    <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={editFields.is_facility || false}
                          onChange={(e) => setEditFields({...editFields, is_facility: e.target.checked})}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534' }}>
                          提携施設として登録（請求書発行機能を有効にする）
                        </span>
                      </label>
                    </div>
                  )}

                  {(() => {
                    const fieldOrder = [
                      'name', 'furigana', 'email', 'phone', 
                      'zip_code', 'address', 'parking', 
                      'building_type', 'care_notes', 'company_name', 
                      'symptoms', 'request_details'
                    ];

                    return fieldOrder.map((key) => {
                      if (!shouldShowInAdmin(key)) return null;

                      // 🚀 🆕 ラベル名の出し分けロジック
                      let label = getFieldLabel(key);
                      if (editFields.is_facility) {
                        if (key === 'name') label = '施設名';
                        if (key === 'furigana') label = '施設担当者名';
                        if (key === 'phone') label = '施設電話番号（代表）';
                        if (key === 'address') label = '施設住所';
                      }

                      return (
                        <div key={key}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>{label}</label>
                          </div>
                          
                          {key === 'parking' ? (
                            <select value={editFields[key] || ''} onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} style={editInputStyle}>
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

              <SectionTitle icon={<FileText size={16} />} title="顧客メモ" color="#d34817" />
              <textarea value={customerMemo} onChange={(e) => setCustomerMemo(e.target.value)} style={{ width: '100%', minHeight: '120px', padding: '10px', borderRadius: '10px', border: '2px solid #d34817', marginBottom: '10px' }} />
              <button onClick={saveCustomerInfo} disabled={isSavingMemo} style={{ width: '100%', padding: '15px', background: '#008000', color: '#fff', borderRadius: '10px', fontWeight: 'bold' }}>{isSavingMemo ? '保存中...' : '情報を保存'}</button>
              
              <SectionTitle icon={<History size={16} />} title="過去の履歴" color="#4b2c85" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pastVisits.map(v => {
                  const details = parseReservationDetails(v);
                  // 🚀 🆕 履歴用の事業名を取得
                  const vBrandLabel = categoryMap[v.biz_type];

                  return (
                    <div key={v.id} style={{ background: '#fff', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <b>{v.start_time.split('T')[0]}</b>
                          
                          {/* 🚀 🆕 追加：履歴リスト用の小さなバッジ */}
                          {vBrandLabel && (
                            <span style={{ 
                              fontSize: '0.55rem', padding: '1px 5px', borderRadius: '4px',
                              background: v.biz_type === 'foot' ? '#4285f4' : '#d34817', 
                              color: '#fff', fontWeight: '900'
                            }}>
                              {vBrandLabel.slice(0, 4)}
                            </span>
                          )}
                        </div>
                        <span style={{color:'#d34817', fontWeight: 'bold'}}>¥{Number(v.total_price || 0).toLocaleString()}</span>
                      </div>
<p style={{ margin: 0, fontSize: '0.8rem' }}>
  <span style={{ fontWeight: 'bold', color: '#4b2c85', marginRight: '8px' }}>👤 {v.staffs?.name || 'フリー'}</span> {/* 🆕 追加 */}
  {details.menuName}
                          {details.savedProducts?.length > 0 && (
                          <span style={{ color: '#008000', fontWeight: 'bold' }}>
                            {" "}＋({details.savedProducts.map(p => p.name).join(', ')})
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 🆕 修正：予約IDがある（台帳から開いた）場合のみ、お会計ボタンを表示する */}
            {selectedRes?.id && (
              <div style={{ padding: '25px', borderTop: '2px solid #ddd', background: '#fff' }}>
                <button 
                  onClick={() => openCheckout(selectedRes)} 
                  style={{ ...completeBtnStyle, background: '#d34817', borderRadius: '15px' }}
                >
                  <Clipboard size={20} /> この予約のお会計（レジ）へ
                </button>
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

      {/* 🧾 ここから差し込む！！ ========================================== */}
      {/* 🧾 【完全版】年月選択 ＆ 別ウィンドウ印刷対応 請求書モーダル */}
      {showInvoiceModal && invoiceTarget && (
        <div style={modalOverlayStyle} onClick={() => setShowInvoiceModal(false)}>
          <div style={{ ...modalContentStyle, maxWidth: '800px', width: '95%', background: '#f8fafc' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ padding: '20px', borderBottom: '2px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>📄 請求書類 作成・発行</h3>
              <button onClick={() => setShowInvoiceModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={24}/></button>
            </div>

            <div style={{ padding: '25px' }}>
              {/* --- ① 年月選択エリア（稼働中システムのUIを再現） --- */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                  <button style={circleBtn} onClick={() => setInvoiceYear(y => y - 1)}>◀</button>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{invoiceYear}年</span>
                  <button style={circleBtn} onClick={() => setInvoiceYear(y => y + 1)}>▶</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <button 
                      key={m} 
                      onClick={() => setInvoiceMonth(m)}
                      style={{
                        padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold',
                        backgroundColor: invoiceMonth === m ? '#1e293b' : 'white',
                        color: invoiceMonth === m ? 'white' : '#334155'
                      }}
                    >{m}月</button>
                  ))}
                </div>
              </div>

              {/* --- ② プレビュー情報の集計 --- */}
              {(() => {
                const filteredSales = salesRecords.filter(s => {
                  const d = new Date(s.sale_date);
                  return s.customer_id === invoiceTarget.id && 
                         d.getFullYear() === invoiceYear && 
                         (d.getMonth() + 1) === invoiceMonth;
                });
                const total = filteredSales.reduce((sum, s) => sum + Number(s.total_amount), 0);

                return (
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 10px 0', color: '#64748b' }}>{invoiceTarget.name} 様 / {invoiceYear}年{invoiceMonth}月分</p>
                    <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#1e293b' }}>
                      合計金額：¥ {total.toLocaleString()} <small>(税込)</small>
                    </div>
                    
                    {/* --- ③ 印刷実行ボタン（別ウィンドウ方式） --- */}
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '25px' }}>
                      <button 
                        onClick={() => handlePrintInvoice('full', filteredSales)}
                        style={{ ...completeBtnStyle, background: '#1e293b', width: 'auto', padding: '12px 25px', fontSize: '1rem' }}
                      >
                        📄 明細請求書を発行
                      </button>
                      <button 
                        onClick={() => handlePrintInvoice('tickets', filteredSales)}
                        style={{ ...completeBtnStyle, background: '#ed32ea', width: 'auto', padding: '12px 25px', fontSize: '1rem' }}
                      >
                        ✂️ 8分割領収書を発行
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 🆕 印刷用スタイル定義（レイアウト保護版） */}
      <style>{`
        @media print {
          /* 1. 印刷に不要な要素を「物理的に」消す（visibilityではなくdisplayを使う） */
          .no-print, 
          header, 
          nav, 
          .sidebar, 
          button, 
          aside,
          [role="navigation"] {
            display: none !important;
          }

          /* 2. 画面全体の背景や固定配置をリセットして白紙にする */
          html, body, #root {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* 3. 請求書エリアの重なりを解消し、正しく配置する */
          #invoice-print-area {
            display: block !important; /* flexからblockに変更して安定させる */
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            padding: 10mm !important; /* A4の余白 */
            margin: 0 !important;
            visibility: visible !important;
          }

          /* 4. 請求書内の横並び（タイトルと住所など）を印刷でも維持する */
          #invoice-print-area div[style*="display: flex"] {
            display: flex !important;
            visibility: visible !important;
          }

          /* ブラウザのヘッダー・フッター（URLなど）を消す設定 */
          @page {
            margin: 0;
          }
        }
      `}</style>
      {/* 🧾 ここまで ====================================================== */}

      {/* 🆕 追加：レジ忘れアラート用の点滅アニメーション命令 */}
      <style>{`
        @keyframes blinkRed {
          0% { background-color: #ffeb3b; transform: scale(1); box-shadow: 0 0 5px rgba(255, 235, 59, 0.5); }
          50% { background-color: #ff5722; color: #fff; transform: scale(1.05); box-shadow: 0 0 20px rgba(255, 87, 34, 0.8); }
          100% { background-color: #ffeb3b; transform: scale(1); box-shadow: 0 0 5px rgba(255, 235, 59, 0.5); }
        }
      `}</style>
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