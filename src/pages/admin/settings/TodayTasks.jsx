import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  CheckCircle2, Clock, User, ArrowLeft, 
  Calendar, CheckCircle, AlertCircle,
  PlusCircle,
  Minus,
  Building2, ClipboardCheck,
  ShoppingBag,
  X,
  Loader2,
  RefreshCw
} from 'lucide-react';

// 🚀 🆕 追加：予約データを解析して、商品や調整を取り出す道具箱
const parseReservationDetails = (res) => {
  if (!res) return { menuName: '', totalPrice: 0, products: [], adjustments: [] };
  const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
  const products = opt.products || [];
  const adjustments = opt.adjustments || [];
  let items = opt.people ? opt.people.flatMap(p => p.services || []) : (opt.services || []);
  let subItems = opt.people ? opt.people.flatMap(p => Object.values(p.options || {})) : Object.values(opt.options || {});

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
    products, 
    adjustments 
  };
};

// 五十音順のグループ判定用関数
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

const TodayTasks = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [categoryMap, setCategoryMap] = useState({});

  // 🆕 お客様情報ポップアップ用の状態 [cite: 2026-03-08]
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [customerMemo, setCustomerMemo] = useState('');
  const [isSavingMemo, setIsSavingMemo] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [targetDate, setTargetDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [oldestIncompleteDate, setOldestIncompleteDate] = useState(null);
  const [shopData, setShopData] = useState(null);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  // 🆕 金額計算のためにマスターを保持する箱を追加
  const [services, setServices] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);

  // 🆕 追加：レジ用の状態管理
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [facilityResidents, setFacilityResidents] = useState([]);
  const [facilitySaleRecord, setFacilitySaleRecord] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [adjCategories, setAdjCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedAdjustments, setSelectedAdjustments] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [finalPrice, setFinalPrice] = useState(0);
  // 🆕 電卓（手動金額入力）用のState一式
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [tempPrice, setTempPrice] = useState('0');
  const [prevValue, setPrevValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForNext, setWaitingForNext] = useState(false);

  const [openAdjCatId, setOpenAdjCatId] = useState(null);
  const [productCategories, setProductCategories] = useState([]); 
  const [openProdCatId, setOpenProdCatId] = useState(null);
  
  const [isCustomerModeOpen, setIsCustomerModeOpen] = useState(false);
  // 🆕 追加：メニュー変更ポップアップの管理 [cite: 2026-03-08]
  const [isMenuEditOpen, setIsMenuEditOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]); 
  const [selectedOptions, setSelectedOptions] = useState({});

  const [categories, setCategories] = useState([]);
  // 🆕 追加：名簿情報を自動更新するためのState（これがないとエラーになります）
  const [editFields, setEditFields] = useState({
    name: '', furigana: '', email: '', phone: '', 
    zip_code: '', address: '', parking: '', 
    building_type: '', care_notes: '', company_name: '', 
    symptoms: '', request_details: '', 
    memo: '', custom_answers: {}
  });

  useEffect(() => {
      if (shopId) {
      fetchShopData();
      fetchTodayTasks();
      fetchMasterData(); // 🆕 マスター情報を取得 [cite: 2026-03-08]
    }
  }, [shopId, targetDate]);

// 🆕 調整項目とカテゴリを並び順通りに取得（NULL/falseの揺れに強い版）
const fetchMasterData = async () => {
    // 1. カテゴリ、調整、店販、メニュー、オプションを並列で取得
    const [allCatsRes, adjRes, prodRes, servRes, optRes] = await Promise.all([
      // 全カテゴリをまとめて取得（並び順通り）
      supabase.from('service_categories').select('*').eq('shop_id', shopId).order('sort_order'),
      // 調整・店販・サービスも取得
      supabase.from('admin_adjustments').select('*').eq('shop_id', shopId).is('service_id', null).order('sort_order'),
      supabase.from('products').select('*').eq('shop_id', shopId).order('sort_order'),
      supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order'),
      supabase.from('service_options').select('*')
    ]);

    const allCats = allCatsRes.data || [];

    // 💡 JS側で振り分けることで、DBに「null」と「false」が混ざっていても確実にキャッチします
    const normalCats = allCats.filter(c => !c.is_adjustment_cat && !c.is_product_cat);
    const adjustmentCats = allCats.filter(c => c.is_adjustment_cat === true);
    const productCats = allCats.filter(c => c.is_product_cat === true);

    // 各Stateへセット
    setCategories(normalCats);         // メニュー用
    setAdjCategories(adjustmentCats); // 調整用
    setProductCategories(productCats); // 店販用
    
    // 🚀 🆕 追加：url_key と 専用屋号 を紐付けるマップを作成
    const shopNameMap = {};
    allCats.forEach(c => {
      if (c.url_key) shopNameMap[c.url_key] = c.custom_shop_name || c.name;
    });
    setCategoryMap(shopNameMap);

    setAdjustments(adjRes.data || []);
    setProducts(prodRes.data || []);
    setServices(servRes.data || []);
    setServiceOptions(optRes.data || []);
};
  // 画面サイズ管理
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900;

  useEffect(() => {
    if (shopId) {
      fetchShopData();
      fetchTodayTasks();
    }
  }, [shopId]);

  const fetchShopData = async () => {
    const { data } = await supabase.from('profiles')
      // ✅ ここに allow_batch_matching を追加して取得するようにします
      .select('theme_color, business_name, auto_sales_matching, allow_batch_matching') 
      .eq('id', shopId).single();
    if (data) setShopData(data);
  };

const fetchTodayTasks = async () => {
  setLoading(true);
  const dateStr = targetDate;
  try {
    // 💡 シンプルに「自分の店舗ID」で予約を検索するだけ！
    const { data: resData, error: resError } = await supabase
      .from('reservations')
      .select('*, customers(name, admin_name, memo)') // 👈 memo を追加
      .eq('shop_id', shopId)
      .gte('start_time', `${dateStr} 00:00:00`)
      .lte('start_time', `${dateStr} 23:59:59`)
      .or('is_block.is.null,is_block.eq.false')
      .eq('res_type', 'normal');

    if (resError) throw resError;

    // 施設訪問依頼の取得（もともと自店のみなのでそのまま）
    const { data: visitData, error: visitError } = await supabase
      .from('visit_requests')
      .select('*, facility_users(facility_name)')
      .eq('shop_id', shopId)
      .eq('scheduled_date', dateStr);

    if (visitError) throw visitError;

    const individualTasks = (resData || []).map(r => ({ ...r, task_type: 'individual' }));
    const facilityTasks = (visitData || []).map(v => ({
      ...v,
      task_type: 'facility',
      start_time: `${v.scheduled_date} 09:00:00`, 
      customer_name: v.facility_users?.facility_name 
    }));

    const combined = [...individualTasks, ...facilityTasks].sort((a, b) => {
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });

    setTasks(combined);
    
    // ==========================================
    // 🚀 🆕 過去のレジ忘れ（未処理）チェック：個人と施設の両方を探す
    // ==========================================
    const todayStr = new Date().toLocaleDateString('sv-SE');
    
    const [resRes2, visitRes2] = await Promise.all([
      // 1. 個人の未処理
      supabase.from('reservations').select('start_time')
        .eq('shop_id', shopId)
        .neq('status', 'completed').neq('status', 'canceled')
        .lt('start_time', `${todayStr} 00:00:00`)
        .or('is_block.is.null,is_block.eq.false')
        .eq('res_type', 'normal'),
      
      // 2. 施設の未処理
      supabase.from('visit_requests').select('scheduled_date')
        .eq('shop_id', shopId)
        .eq('status', 'confirmed') // 施設はconfirmedが未完了
        .lt('scheduled_date', todayStr)
    ]);

    // 両方のデータを日付形式に統一して合体
    const iTasks = (resRes2.data || []).map(r => r.start_time.split('T')[0]);
    const fTasks = (visitRes2.data || []).map(v => v.scheduled_date);
    const allIncompleteDates = [...iTasks, ...fTasks].sort();

    // 一番古い日付をセット
    if (allIncompleteDates.length > 0) {
      setOldestIncompleteDate(allIncompleteDates[0]);
    } else {
      setOldestIncompleteDate(null);
    }
    // ==========================================

  } catch (error) {
    console.error("タスク取得エラー:", error.message);
  } finally {
    setLoading(false);
  }
};
    
const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

// 🆕 Step 3: AdminManagement.jsx から移植した「正確な金額集計」ロジック [cite: 2026-03-08]
// 予約データの JSON(options) を解読して、メニューと枝分かれの合計額を算出します
const calculateInitialPrice = (task) => {
  if (!task) return 0;
  // すでにレジで確定済み（total_priceがある）なら、その確定金額を優先して返します [cite: 2026-03-08]
  if (task.total_price && task.total_price > 0) return task.total_price;

  // 予約時の options(JSON) を解析します
  const opt = typeof task.options === 'string' ? JSON.parse(task.options) : (task.options || {});
  
  // 1人予約かグループ予約かを判定してサービス一覧を抽出します
  const items = opt.people ? opt.people.flatMap(p => p.services || []) : (opt.services || []);
  const subItems = opt.people ? opt.people.flatMap(p => Object.values(p.options || {})) : Object.values(opt.options || {});

  // 1. メニュー基本料金の集計（価格がなければマスターから補完） [cite: 2026-03-08]
  const basePrice = items.reduce((sum, item) => {
    let p = Number(item.price);
    if (!p || p === 0) {
      const master = services.find(s => s.id === item.id || s.name === item.name);
      p = master ? Number(master.price) : 0;
    }
    return sum + p;
  }, 0);

  // 2. 枝分かれオプション（シャンプー等）の追加料金を集計
  const optPrice = subItems.reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);

  // 🚀 🆕 3. 商品（店販）代金の集計を追加
  const productItems = opt.products || [];
  const productPrice = productItems.reduce((sum, p) => sum + (Number(p.price || 0) * (p.quantity || 1)), 0);

  // 全てを合算して返す
  return basePrice + optPrice + productPrice;
};

// 🆕 修正：追加
// その予約が「売上対象外（見積りなど）」のみで構成されているか判定する
const isSalesExcludedTask = (task) => {
  const opt = typeof task.options === 'string' ? JSON.parse(task.options) : (task.options || {});
  const servicesInRes = opt.services || (opt.people ? opt.people.flatMap(p => p.services || []) : []);
  
  // メニューが設定されており、かつ「すべてのメニュー」が売上対象外設定なら true
  return servicesInRes.length > 0 && servicesInRes.every(s => {
    const master = services.find(m => m.id === s.id || m.name === s.name);
    return master?.is_sales_excluded === true;
  });
};

/* ==========================================
    🆕 追加：変更を即座にSupabaseへ同期する関数 [cite: 2026-03-08]
   ========================================== */
const syncReservationToSupabase = async (newSvcs, newOpts) => {
  if (!selectedTask) return;
  const newMenuName = newSvcs.map(s => s.name).join(', ');
  
  // 💡 変更があった瞬間にDBを更新することで、戻ってもリセットされなくなります [cite: 2026-03-08]
  const { error } = await supabase.from('reservations').update({ 
    menu_name: newMenuName,
    options: { ...selectedTask.options, services: newSvcs, options: newOpts } 
  }).eq('id', selectedTask.id);

  if (error) console.error("自動保存エラー:", error.message);
  fetchTodayTasks(); // リスト表示も最新に更新
};

// 🆕 レジを開く時 [cite: 2026-03-08]
const openQuickCheckout = (task) => { // 💡 asyncを削除してOK
    setSelectedTask(task);
    setSelectedAdjustments([]);
    setSelectedProducts([]);

    // 🆕 現在の情報を editFields にセット
    const visitInfo = task.options?.visit_info || {};
    setEditFields({
      name: task.customers?.name || task.customer_name || '',
      furigana: task.customers?.furigana || visitInfo.furigana || '',
      phone: task.customers?.phone || task.customer_phone || '',
      email: task.customers?.email || task.customer_email || '',
      address: task.customers?.address || visitInfo.address || '',
      memo: task.customers?.memo || '',
      line_user_id: task.customers?.line_user_id || task.line_user_id || null,
      custom_answers: visitInfo.custom_answers || task.customers?.custom_answers || {}
    });
    
    const opt = typeof task.options === 'string' ? JSON.parse(task.options) : (task.options || {});
    const initialSvcs = opt.services || (opt.people ? opt.people.flatMap(p => p.services || []) : []);
    setSelectedServices(initialSvcs);

    const initialOpts = opt.options || (opt.people ? opt.people[0]?.options : {});
    setSelectedOptions(initialOpts || {});

    const initialPrice = calculateInitialPrice(task);
    setFinalPrice(initialPrice); 
    setIsManualPrice(false);
    setIsCheckoutOpen(true);
  };
  
  /* 🚀 🆕 【ここから追加】商品を個数つきで増減させるための関数 🚀 */
  
  // 商品を1個増やす（または新規追加）
  const addCheckoutProduct = (prod) => {
    setSelectedProducts(prev => {
      const existing = prev.find(p => p.id === prod.id);
      if (existing) {
        // すでにリストにあれば、個数(quantity)をプラス1する
        return prev.map(p => p.id === prod.id ? { ...p, quantity: (p.quantity || 1) + 1 } : p);
      }
      // なければ新しく個数1として追加する
      return [...prev, { ...prod, quantity: 1 }];
    });
  };

  // 商品を1個減らす（左肩のマイナスボタン用）
  const removeCheckoutProduct = (productId) => {
    setSelectedProducts(prev => {
      const existing = prev.find(p => p.id === productId);
      if (existing && (existing.quantity || 1) > 1) {
        // 2個以上あれば、個数をマイナス1する
        return prev.map(p => p.id === productId ? { ...p, quantity: p.quantity - 1 } : p);
      }
      // 1個しかなければ、リストから消す
      return prev.filter(p => p.id !== productId);
    });
  };

  /* 🚀 【ここまで追加】 🚀 */
  
// 🆕 修正：有効なオプションのみを集計するロジック [cite: 2026-03-08]
  useEffect(() => {
    if (!selectedTask) return;
    
    // 💡 選択中のメニューIDに含まれるオプションだけを抽出（ゴミデータを計算に入れない） [cite: 2026-03-08]
    const validOptions = Object.entries(selectedOptions).filter(([key]) => 
      selectedServices.some(s => key.startsWith(`${s.id}-`))
    ).map(([_, val]) => val);

    const optPrice = validOptions.reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);
    let total = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0) + optPrice;

    selectedAdjustments.forEach(adj => {
      if (adj.is_percent) total = total * (1 - (adj.price / 100));
      else total += adj.is_minus ? -adj.price : adj.price;
    });

    selectedProducts.forEach(prod => total += (prod.price || 0) * (prod.quantity || 1));
    setFinalPrice(Math.max(0, Math.round(total)));
  }, [selectedServices, selectedOptions, selectedAdjustments, selectedProducts, selectedTask]);
  
  // 🚀 アップグレード：お会計確定 ＆ サービス完了（売上台帳へも記録） [cite: 2026-03-08]
  const handleCompleteTask = async () => {
  try {
    setIsSavingMemo(true);

    // 1. お名前とメニュー名の整理
    const normalizedName = (editFields.name || selectedTask.customer_name).replace(/　/g, ' ').trim();
    const newMenuName = selectedServices.map(s => s.name).join(', ');

    // --- ステップA：顧客マスタ（名簿）の更新 ---
    let targetCustomerId = selectedTask.customer_id;
    if (!targetCustomerId) {
      const { data: existingCust } = await supabase.from('customers').select('id').eq('shop_id', shopId).eq('name', normalizedName).maybeSingle();
      targetCustomerId = existingCust?.id;
    }

    // 🚀 🆕 修正：既存データを「空っぽ」で上書きしないためのスマート・ペイロード作成
    const customerPayload = {
      shop_id: shopId,
      name: normalizedName,
      updated_at: new Date().toISOString()
    };

    // 【重要】各項目において、入力がある時だけ上書き対象に加える（これで既存データが守られます）
    if (editFields.furigana?.trim()) customerPayload.furigana = editFields.furigana;
    if (editFields.email?.trim()) customerPayload.email = editFields.email;
    if (editFields.address?.trim()) customerPayload.address = editFields.address;
    
    // 💡 メモの保護：入力があれば採用、なければ既存名簿のメモを維持
    if (editFields.memo?.trim()) {
      customerPayload.memo = editFields.memo;
    } else if (selectedTask.customers?.memo) {
      customerPayload.memo = selectedTask.customers.memo;
    }

    // 電話番号の保護：入力があれば採用、なければ既存を維持
    const inputPhone = editFields.phone?.replace(/[^0-9]/g, '');
    if (inputPhone) {
      customerPayload.phone = inputPhone;
    } else if (selectedTask.customer_phone && selectedTask.customer_phone !== '---') {
      customerPayload.phone = selectedTask.customer_phone.replace(/[^0-9]/g, '');
    }

    // LINE連携情報の維持
    if (editFields.line_user_id || selectedTask.line_user_id) {
      customerPayload.line_user_id = editFields.line_user_id || selectedTask.line_user_id;
    }

    // 保存実行
    if (targetCustomerId) customerPayload.id = targetCustomerId;
    const { data: savedCust } = await supabase.from('customers').upsert(customerPayload, { onConflict: 'id' }).select().single();
    const finalCustomerId = savedCust?.id || targetCustomerId;

    // --- ステップB：過去予約の紐付け ---
    await supabase
      .from('reservations')
      .update({ customer_id: finalCustomerId })
      .eq('shop_id', shopId)
      .eq('customer_name', normalizedName)
      .is('customer_id', null);

    // --- ステップC：今回の予約データを確定 ---
    const { error: resError } = await supabase
      .from('reservations')
      .update({ 
        status: 'completed', 
        customer_id: finalCustomerId, 
        customer_name: normalizedName,
        total_price: finalPrice,
        menu_name: newMenuName,
        options: { 
          ...selectedTask.options, 
          services: selectedServices,
          options: selectedOptions,
          adjustments: selectedAdjustments,
          products: selectedProducts,
          isUpdatedFromTodayTasks: true 
        } 
      })
      .eq('id', selectedTask.id);

    if (resError) throw resError;

    // --- ステップD：売上データ（sales）の記録 ---
    const salePayload = {
      shop_id: shopId,
      reservation_id: selectedTask.id,
      customer_id: finalCustomerId,
      total_amount: finalPrice,
      sale_date: targetDate,
      details: { 
          services: selectedServices, 
          options: selectedOptions, 
          adjustments: selectedAdjustments, 
          products: selectedProducts 
      }
    };

    const { error: saleError } = await supabase
      .from('sales')
      .upsert(salePayload, { onConflict: 'reservation_id' });

    if (saleError) throw saleError;

    // 来店回数の更新
    if (finalCustomerId) {
      const { data: cData } = await supabase.from('customers').select('total_visits').eq('id', finalCustomerId).single();
      await supabase.from('customers').update({ total_visits: (cData?.total_visits || 0) + 1 }).eq('id', finalCustomerId);
    }

    showMsg("お会計を完了しました！✨");
    setIsCheckoutOpen(false);
    fetchTodayTasks(); 

  } catch (err) {
    alert("確定失敗: " + err.message);
  } finally {
    setIsSavingMemo(false);
  }
};

/* ==========================================
    🆕 追加：自動売上確定モード用の一括処理ロジック
    過去の未処理予約をすべて「見積額」で一括確定します
   ========================================== */
const handleAutoBatchProcess = async () => {
  if (!oldestIncompleteDate) return;
  if (!window.confirm(`${oldestIncompleteDate} 以前の未処理予約を、すべて見積金額で一括確定しますか？`)) return;

  setIsAutoProcessing(true); // 👈 前の手順でStateに追加したもの
  try {
    const todayStr = new Date().toLocaleDateString('sv-SE');
    
    // 1. 過去の未処理予約（キャンセル・完了以外）をすべて取得
    const { data: incompleteTasks, error: fetchError } = await supabase
      .from('reservations')
      .select('*, customers(name)')
      .eq('shop_id', shopId)
      .neq('status', 'completed')
      .neq('status', 'canceled')
      .lt('start_time', `${todayStr} 00:00:00`)
      .or('is_block.is.null,is_block.eq.false')
      .eq('res_type', 'normal');

    if (fetchError) throw fetchError;
    if (!incompleteTasks || incompleteTasks.length === 0) {
      showMsg("処理対象のタスクはありませんでした。");
      return;
    }

    // 2. 1件ずつ確定処理を実行（ループ）
    for (const task of incompleteTasks) {
      const estimatedPrice = calculateInitialPrice(task); // 既存の見積計算ロジックを利用
      
      // A. 予約ステータスを「完了」に更新
      await supabase.from('reservations').update({
        status: 'completed',
        total_price: estimatedPrice,
        options: { ...task.options, isAutoMatched: true, processed_at: new Date().toISOString() }
      }).eq('id', task.id);

      // B. 売上台帳（sales）へ記録
      await supabase.from('sales').upsert({
        shop_id: shopId,
        reservation_id: task.id,
        customer_id: task.customer_id,
        total_amount: estimatedPrice,
        sale_date: task.start_time.split('T')[0],
        details: { ...task.options, note: '自動売上確定モードによる一括処理' }
      }, { onConflict: 'reservation_id' });
    }

    showMsg(`${incompleteTasks.length}件の予約を一括で売上確定しました！✨`);
    fetchTodayTasks(); // リストを再読み込み
  } catch (err) {
    console.error("一括確定エラー:", err);
    alert("一括処理中にエラーが発生しました: " + err.message);
  } finally {
    setIsAutoProcessing(false);
  }
};

  // 🚀 🆕 修正：古い handleRevertTask をこれに差し替えます
  // 事務的なアラートを無くし、処理後に自動で施設画面へジャンプする最新版です
  const executeRevertAndJump = async () => {
    // 💡 1. 選択中のタスクがない場合は何もしない
    if (!selectedTask) return;
    
    const task = selectedTask;
    const isFacility = task.task_type === 'facility';
    
    try {
      // ステータスを戻す先を決定
      const targetTable = isFacility ? 'visit_requests' : 'reservations';
      const updatePayload = { status: isFacility ? 'confirmed' : 'pending' };
      
      // 個人の時だけ金額を0にリセット
      if (!isFacility) {
        updatePayload.total_price = 0;
      }

      // 2. データベースのステータスを戻す
      const { error: statusError } = await supabase
        .from(targetTable)
        .update(updatePayload)
        .eq('id', task.id);

      if (statusError) throw statusError;

      // 3. 売上台帳（sales）からデータを削除する
      const deleteField = isFacility ? 'visit_request_id' : 'reservation_id';
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq(deleteField, task.id);

      if (deleteError) throw deleteError;

      // 4. 開いている確認モーダルをすべて閉じる
      setShowRevertConfirm(false);
      setShowSummaryModal(false);
      
      // 🚀 5. 【ここがポイント！】施設の場合は、そのまま名簿画面へジャンプ！
      if (isFacility) {
        // 施設訪問のポチポチ画面（AdminFacilityVisit_PC）へワープ
        navigate(`/admin/${shopId}/visit-requests/${task.id}`);
      } else {
        // 個人の場合は今のリストを更新してメッセージを出すだけ
        showMsg("お会計を差し戻しました。");
        fetchTodayTasks();
      }

    } catch (err) {
      console.error("Revert Error:", err.message);
      alert("エラーが発生しました: " + err.message);
    }
  };

  const handleCancelTask = async (task) => {
    if (!window.confirm("この予約を「キャンセル扱い」にして記録に残しますか？\n（本日の予定から除外されます）")) return;

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
      showMsg("キャンセルとして記録しました");
      fetchTodayTasks(); // 🔄 リストを再読み込みして表示を更新
    } catch (err) {
      alert("エラー: " + err.message);
    }
  };
  
/* ==========================================
    🆕 お客様の詳細情報（名簿マスタからメモを取得 ＆ 履歴を名前でも検索）
   ========================================== */
const openCustomerInfo = async (task) => {
    setSelectedTask(task);
    let cust = null;
    const searchName = task.customer_name;

    try {
      // 1. まずIDで検索
      if (task.customer_id) {
        const { data } = await supabase.from('customers').select('*').eq('id', task.customer_id).maybeSingle();
        cust = data;
      }

      // 2. IDで見つからない、または施設の場合は「名前」で名簿を検索
      if (!cust && searchName) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('shop_id', shopId)
          .eq('name', searchName) // 👈 名前でガサ入れ！
          .maybeSingle();
        cust = data;
      }

      // 3. それでも見つからない場合（電話・メール検索）
      if (!cust && (task.customer_phone || task.customer_email)) {
        const orConditions = [];
        if (task.customer_phone && task.customer_phone !== '---') orConditions.push(`phone.eq.${task.customer_phone.replace(/[^0-9]/g, '')}`);
        if (task.customer_email) orConditions.push(`email.eq.${task.customer_email}`);
        if (orConditions.length > 0) {
          const { data } = await supabase.from('customers').select('*').eq('shop_id', shopId).or(orConditions.join(',')).maybeSingle();
          cust = data;
        }
      }

      // 結果をセット
      if (cust) {
        setSelectedCustomer(cust);
        setCustomerMemo(cust.memo || '');
      } else {
        setSelectedCustomer({ name: searchName, id: null });
        setCustomerMemo('');
      }

    // 3. 🆕 過去の来店履歴を取得（AdminReservationsのロジックを移植）
    const searchId = cust?.id || task.customer_id;
    const isFacility = task.task_type === 'facility' || cust?.is_facility;
    let historyData = [];

    if (isFacility) {
      // 🏢 施設の場合：visit_requestsテーブルから取得
      // 🚀 400エラー修正：存在しないカラムでの検索を避け、正しい facility_user_id を使う
      const targetFacId = task.facility_user_id;

      if (targetFacId) {
        const { data, error } = await supabase
          .from('visit_requests')
          .select('*')
          .eq('shop_id', shopId)
          .eq('facility_user_id', targetFacId) // 👈 正しいカラム名で検索
          .eq('status', 'completed') // 完了したものだけ
          .order('scheduled_date', { ascending: false });

        if (!error) {
          historyData = (data || []).map(v => ({ 
            ...v, 
            start_time: v.scheduled_date, // 表示用にキーを合わせる
            menu_name: '施設訪問 施術一式' 
          }));
        } else {
          console.error("施設履歴エラー:", error);
        }
      }
    } else {
      // 👤 個人の場合：reservationsテーブルから取得
      let historyQuery = supabase
        .from('reservations')
        .select('*')
        .eq('shop_id', shopId)
        .eq('res_type', 'normal')
        .in('status', ['completed', 'canceled']);

      if (searchId) {
        historyQuery = historyQuery.or(`customer_id.eq.${searchId},customer_name.eq.${task.customer_name}`);
      } else {
        historyQuery = historyQuery.eq('customer_name', task.customer_name);
      }

      const { data } = await historyQuery.order('start_time', { ascending: false });
      historyData = data || [];
    }

    setCustomerHistory(historyData);
    setShowCustomerModal(true);
  } catch (err) {
    console.error("データ取得エラー:", err);
    setShowCustomerModal(true);
  }
};

/* ==========================================
    🆕 顧客メモを保存（マスタ共通 ＆ 予約と名簿を紐付け）
   ========================================== */
const handleSaveMemo = async () => {
    setIsSavingMemo(true);
    try {
      // 1. 保存用データを作成（名簿テーブルに存在する項目だけに絞る）
      const customerPayload = {
        shop_id: shopId,
        name: selectedCustomer?.name || selectedTask.customer_name,
        memo: customerMemo, // 最新のメモ内容
        updated_at: new Date().toISOString()
      };

      if (selectedCustomer?.id) customerPayload.id = selectedCustomer.id;

      // 2. 顧客マスタ（customers）を更新
      const { data: savedCust, error: custError } = await supabase
        .from('customers')
        .upsert(customerPayload, { onConflict: 'id' })
        .select()
        .single();

      if (custError) throw custError;

      // 🚀 🆕 修正：個人予約（individual）の場合のみ紐付けを更新
      // 施設（visit_requests）はカラムがないので、この処理をスキップしてエラーを回避します
      if (selectedTask.task_type === 'individual') {
        await supabase
          .from('reservations')
          .update({ customer_id: savedCust.id, memo: null })
          .eq('id', selectedTask.id);
      }

      // 3. 画面の表示を更新
      setSelectedCustomer(savedCust);
      await fetchTodayTasks(); // 背景のリストも最新にする
      showMsg("名簿の共通メモを更新しました！✨");

    } catch (err) {
      console.error("Save Error:", err.message);
      alert("保存失敗: " + err.message);
    } finally {
      setIsSavingMemo(false);
    }
  };
  const themeColor = shopData?.theme_color || '#2563eb';

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>読み込み中...</div>;
  
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', paddingBottom: '100px', fontFamily: 'sans-serif' }}>
      
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', fontWeight: 'bold', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}>
          {message}
        </div>
      )}

      {/* --- 🆕 ここからヘッダー修正 --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e293b', fontWeight: '900' }}>⚡ タスク実行</h2>
          
          {/* 📅 日付切り替えコントローラー */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '12px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '12px', width: 'fit-content' }}>
            <button 
              onClick={() => {
                const d = new Date(targetDate);
                d.setDate(d.getDate() - 1);
                setTargetDate(d.toLocaleDateString('sv-SE'));
              }}
              style={arrowBtnStyle}
            >◀</button>
            
            <div 
              onClick={() => setTargetDate(new Date().toLocaleDateString('sv-SE'))}
              style={{ padding: '4px 12px', fontWeight: 'bold', fontSize: '0.9rem', color: '#334155', cursor: 'pointer', textAlign: 'center', minWidth: '100px' }}
            >
              {targetDate === new Date().toLocaleDateString('sv-SE') ? (
                <span style={{ color: themeColor }}>今日</span>
              ) : (
                targetDate.replace(/-/g, '/')
              )}
            </div>

            <button 
              onClick={() => {
                const d = new Date(targetDate);
                d.setDate(d.getDate() + 1);
                setTargetDate(d.toLocaleDateString('sv-SE'));
              }}
              style={arrowBtnStyle}
            >▶</button>
          </div>

          {/* 🚀 自動売上確定モードに応じたアラート表示の切り替え */}
  {oldestIncompleteDate && (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      disabled={isAutoProcessing}
      onClick={() => {
        // ✅ 「一括ボタンを表示」がONなら一括処理、OFFなら日付ジャンプ
        if (shopData?.allow_batch_matching) {
          handleAutoBatchProcess();
        } else {
          setTargetDate(oldestIncompleteDate);
        }
      }}
      style={{
        ...alertBadgeStyle,
        // ✅ すべて「一括ボタン」用のフラグに書き換えます
        background: shopData?.allow_batch_matching ? '#dcfce7' : '#ffeb3b',
        color: shopData?.allow_batch_matching ? '#166534' : '#d34817',
        border: shopData?.allow_batch_matching ? '1px solid #16653444' : 'none'
      }}
    >
      {isAutoProcessing ? (
        '処理中...'
      // ✅ ここも一括ボタン用のフラグに書き換えます
      ) : shopData?.allow_batch_matching ? ( 
        <><CheckCircle size={14} /> 過去の未処理を一括確定する</>
      ) : (
        <><AlertCircle size={14} /> 未処理あり！ ({oldestIncompleteDate.replace(/-/g, '/')})</>
      )}
    </motion.button>
  )}
        </div>

        {/* ✅ 帰り道スイッチ（既存のまま） */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', gap: '4px' }}>
          <button 
            onClick={() => navigate(`/admin/${shopId}/reservations`)}
            style={navSwitchBtnStyle}
          >
            <Calendar size={14} /> 📅 カレンダーへ
          </button>
          <button 
            onClick={() => navigate(`/admin/${shopId}/timeline`)}
            style={{ ...navSwitchBtnStyle, color: '#4b2c85' }}
          >
            <Clock size={14} /> 🕒 タイムラインへ
          </button>
        </div>
      </div>      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {/* 🆕 修正：売上対象外（見積りなど）をリストから除外して判定 */}
        {tasks.filter(t => !isSalesExcludedTask(t)).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '20px', color: '#64748b' }}>
            <Calendar size={40} style={{ marginBottom: '10px', opacity: 0.5 }} />
            <p>今日の売上対象タスクはありません</p>
          </div>
        ) : (
          tasks.map(task => {
            const isFacility = task.task_type === 'facility';
            // 🚀 1. キャンセル判定のフラグを作成
            const isCanceled = task.status === 'canceled';
            
            return (
              <div key={task.id} style={{ 
                // キャンセル時は背景をわずかにグレーに
                background: isCanceled ? '#fcfcfc' : (task.status === 'completed' ? '#f8fafc' : '#fff'), 
                padding: '20px', 
                borderRadius: '20px', 
                border: isCanceled ? '1px solid #e2e8f0' : (task.status === 'completed' ? '1px solid #e2e8f0' : (isFacility ? `2px solid #4f46e544` : `2px solid ${themeColor}22`)),
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                // 🚀 完了 or キャンセルなら全体を薄くする
                opacity: (task.status === 'completed' || isCanceled) ? 0.7 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <Clock size={16} color={isCanceled ? '#94a3b8' : (isFacility ? '#4f46e5' : themeColor)} />
                      <span style={{ 
                        fontWeight: 'bold', 
                        fontSize: '1.1rem', 
                        color: isCanceled ? '#94a3b8' : '#1e293b',
                        // 🚀 2. キャンセルなら時間に斜線
                        textDecoration: isCanceled ? 'line-through' : 'none' 
                      }}>
                        {isFacility ? '訪問予定' : new Date(task.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) + ' 〜'}
                      </span>

                      {/* 🚀 3. キャンセルバッジを表示 */}
                      {isCanceled && (
                        <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid #fecaca' }}>
                          当日キャンセル
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isCanceled ? '#94a3b8' : '#1e293b' }}>
                      {isFacility ? <Building2 size={18} color={isCanceled ? '#cbd5e1' : "#4f46e5"} strokeWidth={2.5} /> : <User size={18} />}
                      <span style={{ 
                        fontWeight: '900', 
                        fontSize: '1.2rem',
                        textDecoration: isCanceled ? 'line-through' : 'none',
                        display: 'inline-flex', alignItems: 'center', gap: '5px' // 🚀 🆕 追加
                      }}>
                        {task.customer_name} {isFacility ? '' : '様'}
                        
                        {/* 🚀 🆕 名前ラベルの中に追加 */}
                        {task.customers?.is_blocked && <span style={{ color: '#ef4444', textDecoration: 'none' }}>🚫</span>}
                        {task.customers?.cancel_count >= 3 && <span style={{ color: '#ef4444', textDecoration: 'none' }}>‼️</span>}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: isCanceled ? '#cbd5e1' : (isFacility ? '#4f46e5' : themeColor), marginTop: '8px', fontWeight: 'bold', paddingLeft: '26px' }}>
                      {isFacility ? '施設訪問カット（名簿あり）' : (task.menu_name || 'メニュー未設定')}
                    </div>
                  </div>

                  {/* 🚀 5. 右側のボタンエリアの出し分け */}
                  {isCanceled ? (
                    // キャンセル済みなら「予約中止」の文字だけ出す
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 'bold', padding: '10px' }}>
                      予約中止
                    </div>
                  ) : task.status === 'completed' ? (
                    /* 🚀 🆕 修正：完了済みエリアを「内容確認ボタン」へアップグレード */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                      <button 
                        onClick={async () => { 
                          setSelectedTask(task); 
                          if (task.task_type === 'facility') {
                            // 🚀 🆕 修正：金額ではなく「ふりがな(kana)」を含めて施術者リストを取得する
                            const { data } = await supabase
                              .from('visit_request_residents')
                              .select('*, members(name, kana, floor)')
                              .eq('visit_request_id', task.id)
                              .eq('status', 'completed');
                            setFacilityResidents(data || []);
                          }
                          setShowSummaryModal(true); 
                        }}
                        style={{ 
                          padding: '10px 18px', background: '#f0fdf4', color: '#10b981', 
                          border: '2px solid #10b981', borderRadius: '14px', fontWeight: 'bold', 
                          fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' 
                        }}
                      >
                        <CheckCircle size={18} /> 内容を確認
                      </button>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>お会計完了 ✓</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* 🚀 🆕 キャンセルを削除し、詳細（カルテ）ボタンを復活 */}
                      <button 
                        onClick={() => openCustomerInfo(task)} 
                        style={{ 
                          padding: '12px 15px', 
                          background: '#fff', 
                          color: '#64748b', 
                          border: '1px solid #cbd5e1', 
                          borderRadius: '12px', 
                          fontWeight: 'bold', 
                          cursor: 'pointer', 
                          fontSize: '0.85rem' 
                        }}
                      >
                        詳細
                      </button>

                      <button
                        onClick={() => isFacility ? navigate(`/admin/${shopId}/visit-requests/${task.id}`) : openQuickCheckout(task)}
                        style={{ 
                          padding: '12px 20px', 
                          background: isFacility ? '#4f46e5' : themeColor, 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '12px', 
                          fontWeight: 'bold', 
                          cursor: 'pointer', 
                          fontSize: '0.9rem' 
                        }}
                      >
                        {isFacility ? '名簿入力' : 'お会計 ＆ 完了'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

{/* --- 省略 --- */}
      <div style={{ marginTop: '30px', padding: '20px', background: '#fefce8', borderRadius: '16px', border: '1px solid #fef08a', display: 'flex', gap: '12px' }}>
        <AlertCircle size={20} color="#a16207" />
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#854d0e', lineHeight: '1.6' }}>
          <b>店主様へ：</b><br />
          施術が完了したら「サービス完了」を押してください。これがトリガーとなり、お客様のマイページにアクション（卵の付与など）が発生します。[cite: 2026-03-01, 2026-03-06]
        </p>
      </div>

{/* ✅ 修正：外側タップで閉じる機能を追加 [cite: 2026-03-08] */}
      {isCheckoutOpen && (
        <div 
          onClick={() => setIsCheckoutOpen(false)} // 💡 外側をタップしたら閉じる
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'flex-end' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} // 💡 中身をタップしても閉じないようにする
            style={{ background: '#fff', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', padding: '30px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}
          >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedTask?.customers?.admin_name || selectedTask?.customer_name} 様</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>レジ・お会計確定</p>
              </div>
              <button onClick={() => setIsCheckoutOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>

{/* 🆕 カテゴリごとに整理してボタンを表示 [cite: 2026-03-08] */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#4b2c85', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                メニュー調整マスター（割引・加算）
              </div>

{/* 🆕 Step 1: カテゴリを2列のスリムなタイルカードで表示 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' }}>
              {adjCategories.map(cat => (
                <div 
                  key={cat.id} 
                  onClick={() => setOpenAdjCatId(cat.id)}
                  style={{ 
                    height: '48px', background: '#fff', borderRadius: '12px', textAlign: 'center',
                    border: '1px solid #e2e8f0', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.name}
                  </span>
                </div>
              ))}
            </div>

            {/* 🆕 Step 2: カテゴリ専用の調整項目ポップアップ */}
            {openAdjCatId && (
              <div 
                onClick={() => setOpenAdjCatId(null)} // 💡 追加：外側タップで閉じる
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(4px)' }}
              >
                <div 
                  onClick={(e) => e.stopPropagation()} // 💡 追加：中身のタップでは閉じないようにする
                  style={{ background: '#fff', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}
                >
                  
                  {/* 【固定ヘッダー】スクロールしても常に表示 */}
                  <div style={{ padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>
                      {adjCategories.find(c => c.id === openAdjCatId)?.name} を選択
                    </h3>
                    {/* 右上の閉じるボタン */}
                    <button onClick={() => setOpenAdjCatId(null)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>

                  {/* 【スクロールエリア】項目を縦1列に並べる */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {adjustments
                      .filter(a => a.category === adjCategories.find(c => c.id === openAdjCatId)?.name)
                      .map(adj => {
                        const isSel = selectedAdjustments.find(a => a.id === adj.id);
                        return (
                          <button 
                            key={adj.id} 
                            onClick={() => setSelectedAdjustments(prev => isSel ? prev.filter(a => a.id !== adj.id) : [...prev, adj])}
                            style={{ 
                              width: '100%', padding: '18px', borderRadius: '15px', textAlign: 'left',
                              border: `2px solid ${isSel ? themeColor : '#f1f5f9'}`, 
                              background: isSel ? `${themeColor}15` : '#fff', 
                              color: isSel ? themeColor : '#475569', 
                              fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                            }}
                          >
                            <span>{isSel ? '✅ ' : ''}{adj.name}</span>
                            <span style={{ fontWeight: '900' }}>
                              {adj.is_minus ? '-' : '+'}{adj.is_percent ? `${adj.price}%` : `¥${adj.price.toLocaleString()}`}
                            </span>
                          </button>
                        );
                    })}
                  </div>

                  {/* 【固定フッター】常に表示される完了ボタン */}
                  <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                    <button 
                      onClick={() => setOpenAdjCatId(null)} 
                      style={{ width: '100%', padding: '16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    >
                      選択を完了して閉じる
                    </button>
                  </div>
                </div>
              </div>
            )}
                                      </div>

{/* 🆕 Step 1: 店販商品カテゴリを2列のスリムなタイルカードで表示 [cite: 2026-03-08] */}
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#008000', marginBottom: '12px' }}>店販商品</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' }}>
              {productCategories.map(cat => (
                <div 
                  key={cat.id} 
                  onClick={() => setOpenProdCatId(cat.id)}
                  style={{ 
                    height: '48px', background: '#fff', borderRadius: '12px', textAlign: 'center',
                    border: '1px solid #e2e8f0', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.name}
                  </span>
                </div>
              ))}
            </div>

            {/* 🆕 Step 2: 商品カテゴリ専用の選択ポップアップ [cite: 2026-03-08] */}
{openProdCatId && (
              <div 
                onClick={() => setOpenProdCatId(null)} // 💡 追加：外側タップで閉じる
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(4px)' }}
              >
                <div 
                  onClick={(e) => e.stopPropagation()} // 💡 追加：中身のタップでは閉じないようにする
                  style={{ background: '#fff', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}
                >                  
                  <div style={{ padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#008000' }}>
                      {productCategories.find(c => c.id === openProdCatId)?.name} を選択
                    </h3>
                    <button onClick={() => setOpenProdCatId(null)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {products
                      .filter(p => p.category === productCategories.find(c => c.id === openProdCatId)?.name)
                      .map(prod => {
                        const selected = selectedProducts.find(p => p.id === prod.id);
                        const qty = selected?.quantity || 0;
                        return (
                          <div key={prod.id} style={{ position: 'relative', width: '100%', marginBottom: '10px' }}>
                            {/* 🚀 左肩：個数を減らすボタン（スマホ対応） */}
                            {qty > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); removeCheckoutProduct(prod.id); }}
                                style={minusBtnBadge}
                              >
                                <Minus size={16} strokeWidth={3} />
                              </button>
                            )}

                            {/* 🚀 メイン：商品ボタン */}
                            <button 
                              onClick={() => addCheckoutProduct(prod)}
                              style={{ 
                                width: '100%', padding: '20px 18px', borderRadius: '15px', textAlign: 'left',
                                border: `2px solid ${qty > 0 ? '#008000' : '#f1f5f9'}`, 
                                background: qty > 0 ? '#f0fdf4' : '#fff', 
                                color: qty > 0 ? '#008000' : '#475569', 
                                fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                              }}
                            >
                              <span>{qty > 0 ? '✅ ' : ''}{prod.name}</span>
                              <span style={{ fontWeight: '900' }}>¥{(prod.price || 0).toLocaleString()}</span>

                              {/* 🚀 右肩：個数バッジ */}
                              {qty > 0 && (
                                <span style={qtyBadgeStyle}>{qty}</span>
                              )}
                            </button>
                          </div>
                        );
                    })}
                  </div>

                  <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                    <button 
                      onClick={() => setOpenProdCatId(null)} 
                      style={{ width: '100%', padding: '16px', background: '#008000', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,128,0,0.1)' }}
                    >
                      商品の選択を完了して閉じる
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 合計表示エリア */}
{/* 🆕 選択内容の内訳サマリー [cite: 2026-03-08] */}
            <div style={{ marginBottom: '20px', padding: '18px', background: '#f9fafb', borderRadius: '18px', border: '1px dashed #cbd5e1', fontSize: '0.85rem', color: '#475569' }}>
              
              {/* 💡 ここ！メニュー名の横に変更ボタンを設置しました [cite: 2026-03-08] */}
              {selectedServices.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>メニュー:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ color: '#1e293b', fontWeight: 'bold', textAlign: 'right' }}>
                      {selectedServices.map(s => s.name).join(', ')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: themeColor, fontWeight: 'bold' }}>
                      施術予定額: ¥{calculateInitialPrice(selectedTask).toLocaleString()}
                    </span>
                    {/* 🆕 このボタンがメニュー変更ポップアップを呼び出します [cite: 2026-03-08] */}
                    <button 
                      onClick={() => setIsMenuEditOpen(true)} 
                      style={{ padding: '4px 10px', background: themeColor, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      変更
                    </button>
                  </div>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: '10px' }}>調整メニュー:</span>
                <span style={{ textAlign: 'right', color: '#1e293b' }}>
                  {selectedAdjustments.length > 0 ? selectedAdjustments.map(a => a.name).join(', ') : 'なし'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', marginRight: '10px' }}>店販商品:</span>
                <span style={{ textAlign: 'right', color: '#1e293b' }}>
                  {selectedProducts.length > 0 
                    ? selectedProducts.map(p => `${p.name}${p.quantity > 1 ? ` x ${p.quantity}` : ''}`).join(', ') 
                    : 'なし'}
                </span>
              </div>
            </div>

{/* 🆕 追加：お客様提示ボタン [cite: 2026-03-08] */}
            <button 
              onClick={() => setIsCustomerModeOpen(true)}
              style={{ width: '100%', marginBottom: '15px', padding: '10px', background: '#fff', color: themeColor, border: `1px solid ${themeColor}`, borderRadius: '12px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              お客様に金額を提示する
            </button>

            {/* 🆕 修正：電卓ボタン付きの合計金額エリア */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', marginBottom: '25px', border: isManualPrice ? `2px solid ${themeColor}` : '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>最終合計金額</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  
                  {/* 電卓呼び出しボタン */}
                  <button 
                    onClick={() => { setTempPrice(finalPrice.toString()); setIsCalculatorOpen(true); }}
                    style={{ background: isManualPrice ? `${themeColor}22` : '#fff', border: `1px solid ${isManualPrice ? themeColor : '#e2e8f0'}`, padding: '6px', borderRadius: '10px', cursor: 'pointer', color: themeColor, display: 'flex', alignItems: 'center' }}
                  >
                    <PlusCircle size={20} />
                  </button>

                  <span style={{ 
                    fontSize: '2.2rem', 
                    fontWeight: '900', 
                    color: isManualPrice ? '#2563eb' : themeColor,
                    transition: 'color 0.3s'
                  }}>
                    ¥{finalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
              {/* ✅ 🆕 ここに追加：自動計算であることを伝えるラベル */}
              {!isManualPrice && (
                <div style={{ textAlign: 'right', fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px' }}>
                  ※マスター設定に基づき自動計算中
                </div>
              )}
            </div>

            {/* 確定ボタン */}
<button onClick={handleCompleteTask} style={{ width: '100%', padding: '20px', background: themeColor, color: '#fff', border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: `0 10px 20px ${themeColor}44`, cursor: 'pointer' }}>確定して完了 ✓</button>
          </div>
        </div>
      )}

{/* ==========================================
      ✨ 修正後：MenuSettingsの並び順を100%再現する書き方
    ========================================== */}
{isMenuEditOpen && (
  <div 
    onClick={() => setIsMenuEditOpen(false)} 
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(4px)' }}
  >
    <div 
      onClick={(e) => e.stopPropagation()} 
      style={{ background: '#fff', width: '100%', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 25px rgba(0,0,0,0.2)' }}
    >
      {/* ポップアップヘッダー */}
      <div style={{ padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>メニューの追加・変更</h3>
        <button onClick={() => setIsMenuEditOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ✅ ポイント：取得済みの categories (マスタ順) をベースにループさせる */}
        {categories.map(cat => {
          // このカテゴリに属するサービスを抽出（これらも fetchMasterData で sort_order 順に取得済み）
          const filteredServices = services.filter(s => s.category === cat.name);
          
          // メニューが1つも登録されていないカテゴリは表示しない
          if (filteredServices.length === 0) return null;

          return (
            <div key={cat.id}>
              {/* カテゴリ名の表示 */}
              <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '10px' }}>📁 {cat.name}</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {filteredServices.map(svc => {
                  const isSel = selectedServices.find(s => s.id === svc.id);
                  return (
                    <div key={svc.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      <button 
                        onClick={async () => {
                          let nextSvcs;
                          let nextOpts = { ...selectedOptions };
                          if (isSel) {
                            nextSvcs = selectedServices.filter(s => s.id !== svc.id);
                            Object.keys(nextOpts).forEach(key => {
                              if (key.startsWith(`${svc.id}-`)) delete nextOpts[key];
                            });
                          } else {
                            nextSvcs = [...selectedServices, svc];
                          }
                          setSelectedServices(nextSvcs);
                          setSelectedOptions(nextOpts);
                          await syncReservationToSupabase(nextSvcs, nextOpts);
                        }}
                        style={{ 
                          width: '100%', padding: '15px 10px', borderRadius: isSel ? '12px 12px 0 0' : '12px',
                          border: `2px solid ${isSel ? themeColor : '#f1f5f9'}`, 
                          background: isSel ? `${themeColor}15` : '#fff', 
                          color: isSel ? themeColor : '#1e293b', 
                          fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' 
                        }}
                      >
                        {isSel ? '✅ ' : ''}{svc.name}<br />
                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>¥{svc.price?.toLocaleString()}</span>
                      </button>

                      {/* 枝分かれオプション（選択時のみ表示） */}
                      {isSel && (
                        <div style={{ padding: '10px', background: '#f8fafc', border: `2px solid ${themeColor}`, borderTop: 'none', borderRadius: '0 0 12px 12px', marginBottom: '10px' }}>
                          {Array.from(new Set(serviceOptions.filter(o => o.service_id === svc.id).map(o => o.group_name))).map(groupName => (
                            <div key={groupName} style={{ marginBottom: '10px' }}>
                              <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: '0 0 4px 0' }}>└ {groupName}</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {serviceOptions.filter(o => o.service_id === svc.id && o.group_name === groupName).map(opt => {
                                  const isOptSel = selectedOptions[`${svc.id}-${groupName}`]?.id === opt.id;
                                  return (
                                    <button 
                                      key={opt.id} 
                                      onClick={async () => {
                                        const nextOpts = { ...selectedOptions, [`${svc.id}-${groupName}`]: opt };
                                        setSelectedOptions(nextOpts);
                                        await syncReservationToSupabase(selectedServices, nextOpts);
                                      }}
                                      style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold', border: `1px solid ${isOptSel ? themeColor : '#cbd5e1'}`, background: isOptSel ? themeColor : '#fff', color: isOptSel ? '#fff' : '#475569', cursor: 'pointer' }}
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

      <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
        <button onClick={() => setIsMenuEditOpen(false)} style={{ width: '100%', padding: '16px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
          メニューの選択を完了して閉じる
        </button>
      </div>
    </div>
  </div>
)}

{/* ==========================================
📱 Step 3: お客様提示用 フルスクリーン横向き画面（スクロール修正版） [cite: 2026-03-08]
========================================== */}
      {isCustomerModeOpen && (
        <div 
          onClick={() => setIsCustomerModeOpen(false)} 
          style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          {/* 回転コンテナ：高さ(height)を画面幅(85vw)に制限して固定します [cite: 2026-03-08] */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ width: '90vh', height: '85vw', transform: 'rotate(90deg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 0' }}
          >
            {/* 【固定ヘッダー】 */}
            <div style={{ borderBottom: `4px solid ${themeColor}`, paddingBottom: '10px', marginBottom: '10px', textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '900' }}>お会計内容のご確認</h2>
            </div>

            {/* 💡 【スクロールエリア】項目が増えてもここだけが動きます [cite: 2026-03-08] */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {selectedServices.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#64748b' }}>メニュー</span>
                  <span style={{ fontWeight: '900', color: '#1e293b', textAlign: 'right' }}>
                    {selectedServices.map(s => s.name).join(', ')}
                    {/* 🆕 枝分かれも表示 [cite: 2026-03-08] */}
                    {Object.values(selectedOptions).map(o => `(${o.option_name})`).join('')}
                  </span>
                </div>
              )}

              {selectedAdjustments.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#64748b' }}>調整・割引</span>
                  <span style={{ fontWeight: '900', color: '#ef4444', textAlign: 'right' }}>{selectedAdjustments.map(a => a.name).join(', ')}</span>
                </div>
              )}

              {selectedProducts.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#64748b' }}>店販商品</span>
                  <span style={{ fontWeight: '900', color: '#008000', textAlign: 'right' }}>{selectedProducts.map(p => p.name).join(', ')}</span>
                </div>
              )}
            </div>

            {/* 【固定フッター】金額と戻るボタンが絶対に隠れないようにします [cite: 2026-03-08] */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', background: '#fff' }}>
              <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#1e293b' }}>合計金額</span>
                <span style={{ fontSize: '3.8rem', fontWeight: '900', color: themeColor }}>¥{finalPrice.toLocaleString()}</span>
              </div>

              <button 
                onClick={() => setIsCustomerModeOpen(false)}
                style={{ width: '100%', marginTop: '15px', padding: '10px', background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                タップしてレジに戻る
              </button>
            </div>
          </div>
        </div>
      )}

{/* 🆕 追加：お客様情報 ＆ 来店履歴 ＆ メモのポップアップ [cite: 2026-03-08] */}
      <AnimatePresence>
        {showCustomerModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '20px' }} onClick={() => setShowCustomerModal(false)}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '25px', padding: '25px', maxHeight: '85vh', overflowY: 'auto' }}>
              
              {/* ヘッダー：お名前のみ */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>
                  👤 {selectedCustomer?.name} 様
                </h3>
                <button onClick={() => setShowCustomerModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>

              {/* 🕒 履歴エリア（ここがメインになります） */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                <div style={{ width: '4px', height: '18px', background: themeColor, borderRadius: '2px' }} />
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 'bold' }}>🕒 来店履歴 ＆ 予定</h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(() => {
                  if (customerHistory.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '20px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 'bold' }}>履歴はありません</div>;
                  }

                  // 🏢 施設か個人の判別
                  const isFac = selectedTask?.task_type === 'facility' || selectedCustomer?.is_facility;

                  if (isFac) {
                    const groups = {};
                    customerHistory.forEach(v => {
                      if (v.status === 'canceled') return; 
                      const d = new Date(v.start_time);
                      const monthKey = `${d.getFullYear()}年${d.getMonth() + 1}月`;
                      if (!groups[monthKey]) groups[monthKey] = { month: monthKey, visits: [] };
                      groups[monthKey].visits.push(v);
                    });

                    return Object.values(groups).map((group) => (
                      <div key={group.month} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '18px', marginBottom: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <span style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.05rem' }}>{group.month}度 訪問実績</span>
                          <span style={{ fontSize: '0.65rem', background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: '100px', fontWeight: 'bold', border: '1px solid #bbf7d0' }}>COMPLETE</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {group.visits.sort((a,b) => a.start_time.localeCompare(b.start_time)).map((v) => {
                            const date = new Date(v.start_time);
                            return (
                              <div key={v.id} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#4b2c85', padding: '6px 12px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '800' }}>
                                {date.getDate()}日
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  }

                  // 👤 個人の場合
                  return customerHistory.map((h) => {
                    const hDate = new Date(h.start_time);
                    const isToday = hDate.toLocaleDateString('sv-SE') === new Date().toLocaleDateString('sv-SE');
                    const details = parseReservationDetails(h);

                    return (
                      <div key={h.id} style={{ padding: '15px', background: isToday ? '#fff' : '#f8fafc', borderRadius: '16px', border: isToday ? `2px solid ${themeColor}` : '1px solid #f1f5f9', boxShadow: isToday ? `0 4px 15px ${themeColor}33` : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '6px' }}>
                          <span style={{ color: isToday ? themeColor : '#1e293b' }}>📅 {hDate.toLocaleDateString('ja-JP')}</span>
                          <div style={{ color: '#d34817', fontWeight: 'bold' }}>¥{calculateInitialPrice(h).toLocaleString()}</div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 'bold' }}>{h.menu_name || 'メニュー記録なし'}</div>
                        
                        {/* 商品 ＆ 調整の表示 */}
                        {details.products?.length > 0 && (
                          <div style={{ marginTop: '5px', fontSize: '0.75rem', color: '#008000', fontWeight: 'bold' }}>
                            🛍 商品: {details.products.map(p => `${p.name}${p.quantity > 1 ? `(x${p.quantity})` : ''}`).join(', ')}
                          </div>
                        )}
                        {details.adjustments?.length > 0 && (
                          <div style={{ marginTop: '3px', fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold' }}>
                            ⚙️ 調整: {details.adjustments.map(a => `${a.name}${a.is_percent ? `(${a.price}%)` : ''}`).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* 閉じるボタン */}
              <button onClick={() => setShowCustomerModal(false)} style={{ width: '100%', marginTop: '25px', padding: '15px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}>
                詳細を閉じる
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🆕 4. 一般的な電卓機能付きポップアップ（スマホ特化版） */}
      {isCalculatorOpen && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}
          onClick={() => setIsCalculatorOpen(false)}
        >
          <div 
            style={{ background: '#fff', width: '90%', maxWidth: '340px', padding: '20px', borderRadius: '30px' }} 
            onClick={e => e.stopPropagation()}
          >
            {/* 表示部 */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', height: '1.2rem', fontWeight: 'bold' }}>
                {prevValue !== null ? `${prevValue.toLocaleString()} ${operator || ''}` : 'CALCULATOR'}
              </div>
              <div style={{ 
                fontSize: '2.6rem', 
                fontWeight: '900', 
                color: '#1e293b', 
                marginTop: '5px', 
                padding: '15px', 
                background: '#f1f5f9', 
                borderRadius: '18px',
                textAlign: 'right'
              }}>
                ¥ {Number(tempPrice).toLocaleString()}
              </div>
            </div>
            
            {/* 電卓ボタン配置 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { label: 'AC', type: 'clear', color: '#fee2e2', txt: '#ef4444' },
                { label: '÷', type: 'op', op: '÷', color: '#f8fafc', txt: themeColor },
                { label: '×', type: 'op', op: '×', color: '#f8fafc', txt: themeColor },
                { label: '－', type: 'op', op: '－', color: '#f8fafc', txt: themeColor },
                '7', '8', '9', { label: '＋', type: 'op', op: '＋', color: '#f8fafc', txt: themeColor },
                '4', '5', '6', { label: '＝', type: 'equal', color: themeColor, txt: '#fff' },
                '1', '2', '3', '0',
                '00', { label: 'OK', type: 'confirm', colSpan: 2, color: '#008000', txt: '#fff' }
              ].map((btn, i) => {
                const isObj = typeof btn === 'object';
                const label = isObj ? btn.label : btn;

                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (!isObj || label === '00') {
                        const val = isObj ? '00' : btn;
                        if (waitingForNext) { setTempPrice(val); setWaitingForNext(false); }
                        else { setTempPrice(prev => prev === '0' ? val : prev + val); }
                      } else if (btn.type === 'op') {
                        setPrevValue(Number(tempPrice)); setOperator(btn.op); setWaitingForNext(true);
                      } else if (btn.type === 'equal') {
                        if (prevValue === null || !operator) return;
                        const current = Number(tempPrice);
                        let result = 0;
                        if (operator === '＋') result = prevValue + current;
                        if (operator === '－') result = prevValue - current;
                        if (operator === '×') result = prevValue * current;
                        if (operator === '÷') result = current !== 0 ? prevValue / current : 0;
                        setTempPrice(Math.round(result).toString()); setPrevValue(null); setOperator(null); setWaitingForNext(true);
                      } else if (btn.type === 'clear') {
                        setTempPrice('0'); setPrevValue(null); setOperator(null); setWaitingForNext(false);
                      } else if (btn.type === 'confirm') {
                        setFinalPrice(Number(tempPrice));
                        setIsManualPrice(true);
                        setIsCalculatorOpen(false);
                        showMsg("金額を手動で確定しました");
                      }
                    }}
                    style={{
                      gridColumn: isObj && btn.colSpan ? `span ${btn.colSpan}` : 'auto',
                      gridRow: label === '＝' ? 'span 2' : 'auto',
                      padding: '18px 0', fontSize: '1.4rem', fontWeight: '900', borderRadius: '16px', border: 'none',
                      background: isObj ? btn.color : '#f1f5f9',
                      color: isObj ? btn.txt : '#1e293b',
                      cursor: 'pointer', boxShadow: '0 3px 0px rgba(0,0,0,0.05)', transition: 'all 0.1s'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setIsCalculatorOpen(false)} style={{ width: '100%', marginTop: '20px', padding: '15px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}>閉じる</button>
          </div>
        </div>
      )}

      {/* 🚀 🆕 修正：個人と施設でデザインを完全に出し分ける全画面明細 */}
      <AnimatePresence>
        {showSummaryModal && selectedTask && (
          <div 
            style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 5000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* 1. 【スリムヘッダー】日付を右側に配置 */}
            <div style={{ padding: '20px 25px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  {/* タグ ＆ 日付の行 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', paddingRight: '15px' }}>
                    <div style={{ fontSize: '0.8rem', color: themeColor, fontWeight: '900', letterSpacing: '1px' }}>
                      {selectedTask.task_type === 'facility' ? '🏢 施設訪問・明細一覧' : '内容確認'}
                    </div>
                    {/* 🚀 🆕 日付を右側に小さく配置 */}
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>
                      {new Date(selectedTask.start_time).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  {/* お名前を大きく表示 */}
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', lineHeight: '1.2' }}>
                    {selectedTask.customer_name} <small style={{ fontSize: '1rem', fontWeight: 'bold' }}>様</small>
                  </h2>
                </div>
                {/* ✕ ボタン */}
                <button onClick={() => setShowSummaryModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={24} color="#94a3b8"/>
                </button>
              </div>
            </div>

            {/* 2. 【メインエリア】 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 25px' }}>
              {selectedTask.task_type === 'facility' ? (
                /* --- 🏢 施設バージョンの表示 --- */
                (() => {
                  const sorted = [...facilityResidents].sort((a, b) => (a.members?.kana || "").localeCompare(b.members?.kana || "", 'ja'));
                  let lastLabel = "";
                  return (
                    <div style={{ paddingBottom: '30px' }}>
                      <div style={{ marginTop: '15px', background: '#f0fdf4', color: '#10b981', padding: '10px 15px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle size={18} />
                        <span style={{ fontSize: '1rem', fontWeight: '900' }}>本日合計：{facilityResidents.length} 名</span>
                      </div>
                      {sorted.map((res) => {
                        const currentLabel = getKanaGroup(res.members?.kana);
                        const isNewGroup = currentLabel !== lastLabel;
                        lastLabel = currentLabel;
                        return (
                          <div key={res.id}>
                            {isNewGroup && <div style={{ padding: '25px 10px 8px', fontSize: '0.85rem', fontWeight: '900', color: '#4f46e5', borderBottom: '2px solid #e0e7ff', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>{currentLabel}</div>}
                            <div style={{ padding: '15px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' }}>{res.members?.name} 様</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              {/* 🚀 🆕 修正：Fの重複を防ぎ、大文字小文字を問わずチェックします */}
                              {res.members?.kana} / {res.members?.floor ? (String(res.members.floor).toUpperCase().endsWith('F') ? res.members.floor : `${res.members.floor}F`) : '-'}
                            </div>
                          </div>
                              <div style={{ background: '#f3f4f6', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', color: '#4b5563' }}>{res.menu_name}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                /* --- 👤 個人バージョンの表示（金額あり） --- */
                (() => {
                  const details = parseReservationDetails(selectedTask);
                  return (
                    <div style={{ padding: '30px 0' }}>
                      {/* 確定メニュー */}
                      <div style={{ marginBottom: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: themeColor }}>
                          <CheckCircle size={20} />
                          <span style={{ fontSize: '1rem', fontWeight: '900' }}>確定メニュー</span>
                        </div>
                        <div style={{ padding: '20px', background: '#fff', borderRadius: '20px', border: `2px solid ${themeColor}22`, fontSize: '1.2rem', fontWeight: 'bold', color: '#1e293b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                          {details.menuName}
                        </div>
                      </div>

                      {/* 調整項目 */}
                      {details.adjustments?.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#ef4444' }}>
                            <AlertCircle size={20} />
                            <span style={{ fontSize: '1rem', fontWeight: '900' }}>メニュー調整</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {details.adjustments.map((adj, i) => (
                              <div key={i} style={{ padding: '12px 18px', background: '#fff5f5', color: '#ef4444', borderRadius: '15px', border: '1px solid #fee2e2', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                {adj.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 店販商品 */}
                      {details.products?.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#008000' }}>
                            <ShoppingBag size={20} />
                            <span style={{ fontSize: '1rem', fontWeight: '900' }}>店販商品</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {details.products.map((prod, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', background: '#f0fdf4', color: '#166534', borderRadius: '18px', border: '1px solid #dcfce7', fontSize: '1rem', fontWeight: 'bold' }}>
                                <span>{prod.name}</span>
                                <span>x {prod.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 💰 合計金額 */}
                      <div style={{ marginTop: '20px', padding: '25px', background: '#f5f3ff', borderRadius: '25px', border: `2px solid ${themeColor}44`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: themeColor }}>最終会計合計</span>
                        <span style={{ fontSize: '2rem', fontWeight: '900', color: '#1e293b' }}>
                          ¥ {Number(selectedTask.total_price || details.totalPrice).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* 3. 【フッター】やり直しボタンのみ */}
            <div style={{ padding: '15px 20px 30px', background: '#fff', borderTop: '1px solid #e2e8f0', textAlign: 'center', flexShrink: 0 }}>
              <button 
                onClick={() => setShowRevertConfirm(true)}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', textDecoration: 'underline' }}
              >
                内容を修正する（お会計をやり直す）
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div> // 👈 ファイルの最後、一番外側の div
  );
};

// 日付切り替えボタンのスタイル
const arrowBtnStyle = {
  border: 'none',
  background: '#fff',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.8rem',
  color: '#64748b',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  fontWeight: 'bold'
};

// 帰り道スイッチの共通スタイル（既存のインラインを整理）
const navSwitchBtnStyle = {
  padding: '8px 12px',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  color: '#475569',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
};
const minusBtnBadge = {
  position: 'absolute', top: '-8px', left: '-8px',
  width: '32px', height: '32px', borderRadius: '50%',
  background: '#fff', border: '2px solid #ef4444', color: '#ef4444',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)', padding: 0
};

// 🆕 個数バッジ（右肩の白い数字）
const qtyBadgeStyle = {
  position: 'absolute', top: '-8px', right: '-8px',
  background: '#ef4444', color: '#fff', borderRadius: '50%',
  width: '28px', height: '28px', display: 'flex', alignItems: 'center', 
  justifyContent: 'center', fontSize: '0.85rem', fontWeight: '900',
  border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 1
};

const alertBadgeStyle = {
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
  marginTop: '10px',
  animation: 'blinkRed 1.5s infinite',
  boxShadow: '0 4px 12px rgba(255, 235, 59, 0.4)'
};

// 🆕 点滅アニメーションの定義（グローバルなstyleタグとして追加）
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes blinkRed {
      0% { background-color: #ffeb3b; transform: scale(1); }
      50% { background-color: #ff5722; color: #fff; transform: scale(1.05); }
      100% { background-color: #ffeb3b; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

export default TodayTasks;