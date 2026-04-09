import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  ArrowLeft, Sparkles, Save, Menu as MenuIcon, 
  Settings2, Plus, Edit2, Trash2, ArrowUp, ArrowDown,
  Layers, Link2, AlertCircle, CheckCircle2, ShoppingBag // 🆕 ShoppingBagを追加
} from 'lucide-react';

// 🆕 共通ヘルプパーツを読み込み
import HelpTooltip from '../../../components/ui/HelpTooltip';

const MenuSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const BIZ_URL = "https://questhub-portal.vercel.app";
  const menuFormRef = useRef(null);
  const adjFormRef = useRef(null);
  const prodFormRef = useRef(null);

  // 🆕 画面サイズ管理を追加（ボタンをレスポンシブにするため）
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900; 

  // --- 1. State 管理 ---
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [options, setOptions] = useState([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [slotIntervalMin, setSlotIntervalMin] = useState(30);

  // カテゴリ用State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newUrlKey, setNewUrlKey] = useState(''); 
  const [newCustomShopName, setNewCustomShopName] = useState(''); 
  const [newCustomDescription, setNewCustomDescription] = useState(''); 
  const [newCustomOfficialUrl, setNewCustomOfficialUrl] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingDisableCatId, setEditingDisableCatId] = useState(null);
  const [isFacilityOnlyCat, setIsFacilityOnlyCat] = useState(false);

  // メニュー用State
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceSlots, setNewServiceSlots] = useState(1);
  const [newServicePrice, setNewServicePrice] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingServiceId, setEditingServiceId] = useState(null);

  // 🆕 追加：1日貸切モード用のState
  const [isFullDay, setIsFullDay] = useState(false);
  const [isAdminOnly, setIsAdminOnly] = useState(false);

  // 🆕 追加：売上対象外（レジに表示しない）設定用のState
  const [isSalesExcluded, setIsSalesExcluded] = useState(false);

  // 🚀 🆕 追加：掲示用名簿（印刷物）に表示するかどうかの設定用State
  const [showOnPrint, setShowOnPrint] = useState(false);

  // ✅ 🆕 差し込み：時間制限用のStateを追加
  const [useRestriction, setUseRestriction] = useState(false);
  const [timeRanges, setTimeRanges] = useState([{ start: '08:00', end: '09:00' }]);

  // 枝メニュー用State
  const [activeServiceForOptions, setActiveServiceForOptions] = useState(null);
  const [optGroupName, setOptGroupName] = useState(''); 
  const [optName, setOptName] = useState('');                  
  const [optSlots, setOptSlots] = useState(0);
  const [optPrice, setOptPrice] = useState(0);
  const [optIsMultiple, setOptIsMultiple] = useState(false);
  const [optIsAdminOnly, setOptIsAdminOnly] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState(null);

  /* ==========================================
     🆕 追加：お会計調整マスター用の箱（State） [cite: 2026-03-08]
     ========================================== */
  const [adjustments, setAdjustments] = useState([]);      // 調整項目のリスト
  const [adjCategories, setAdjCategories] = useState([]);   // 調整カテゴリのリスト
  
  const [newAdjCatName, setNewAdjCatName] = useState('');   // 登録用：カテゴリ名
  const [editingAdjCatId, setEditingAdjCatId] = useState(null);

  const [selectedAdjCat, setSelectedAdjCat] = useState(''); // 登録用：選択中のカテゴリ
  const [newAdjName, setNewAdjName] = useState('');         // 登録用：ボタン名
  const [adjType, setAdjType] = useState('minus');          // 登録用：効果(＋－％)
  const [adjValue, setAdjValue] = useState(0);              // 登録用：数値
const [editingAdjId, setEditingAdjId] = useState(null);

  /* ==========================================
      🆕 追加：店販商品マスター用の箱 [cite: 2026-03-08]
     ========================================== */
  const [products, setProducts] = useState([]);            // 商品リスト
  const [productCategories, setProductCategories] = useState([]); // 商品カテゴリ
  const [newProdCatName, setNewProdCatName] = useState('');
  const [editingProdCatId, setEditingProdCatId] = useState(null);
  const [selectedProdCat, setSelectedProdCat] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [editingProdId, setEditingProdId] = useState(null);

  const themeColor = shopData?.theme_color || '#2563eb';
    useEffect(() => {
    if (shopId) {
      fetchInitialShopData();
      fetchMenuDetails();
    }
  }, [shopId]);

  const fetchInitialShopData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data);
      setAllowMultiple(data.allow_multiple_services);
      setSlotIntervalMin(data.slot_interval_min || 30);
    }
  };

// --- [135行目付近：fetchMenuDetails を丸ごと書き換え] ---
const fetchMenuDetails = async () => {
    // 1. 🟢 通常カテゴリ (調整用でも商品用でもない純粋なメニュー用)
    const catRes = await supabase.from('service_categories')
      .select('*')
      .eq('shop_id', shopId)
      // 💡 調整用フラグが false または null
      .or('is_adjustment_cat.is.null,is_adjustment_cat.eq.false')
      // 💡 商品用フラグが false または null
      .or('is_product_cat.is.null,is_product_cat.eq.false')
      .order('sort_order');

    // 2. 🔴 調整用カテゴリのみ
    const adjCatRes = await supabase.from('service_categories')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_adjustment_cat', true)
      .order('sort_order');

    // 3. 🔵 商品用カテゴリのみ
    const prodCatRes = await supabase.from('service_categories')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_product_cat', true)
      .order('sort_order');
    
    // --- [以下、既存のデータ取得（services, optRes, adjRes, prodRes）は維持] ---
    const servRes = await supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order');
    const optRes = await supabase.from('service_options').select('*'); 
    const adjRes = await supabase.from('admin_adjustments').select('*').eq('shop_id', shopId).is('service_id', null).order('sort_order');
    const prodRes = await supabase.from('products').select('*').eq('shop_id', shopId).order('sort_order');

    if (catRes.data) setCategories(catRes.data);
    if (adjCatRes.data) setAdjCategories(adjCatRes.data);
    if (servRes.data) setServices(servRes.data);
    if (optRes.data) setOptions(optRes.data);
    if (adjRes.data) setAdjustments(adjRes.data);
    if (prodCatRes.data) setProductCategories(prodCatRes.data);
    if (prodRes.data) setProducts(prodRes.data);
};
const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };
// 🚀 🆕 URLをクリップボードにコピーする関数
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showMsg('URLをコピーしました！ 📋');
  };

/* ==========================================
      🆕 修正：フリーズしない「交換式」の並び替え関数 [cite: 2026-03-08]
     ========================================== */
  const moveItem = async (type, list, id, direction) => {
    const idx = list.findIndex(item => item.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    
    // 移動先がない場合は何もしない
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const itemA = list[idx];       // 動かしたい項目
    const itemB = list[targetIdx]; // 入れ替え相手

    // 💡 テーブル名の判定 [cite: 2026-03-08]
    const tableMap = {
      category: 'service_categories',
      service: 'services',
      adjustment: 'admin_adjustments',
      product: 'products'
    };
    const table = tableMap[type] || 'services';

    try {
      // 💡 重要：全体を振り直さず、AとBの sort_order を「入れ替える」だけにする [cite: 2026-03-08]
      // これにより 400 Bad Request などの衝突エラーを物理的に回避します
      const updates = [
        { ...itemA, sort_order: itemB.sort_order },
        { ...itemB, sort_order: itemA.sort_order }
      ];

      const { error } = await supabase.from(table).upsert(updates);

      if (error) throw error;
      
      // 成功したら画面を更新
      fetchMenuDetails();
    } catch (err) {
      console.error("並び替えエラー:", err.message);
      alert("並び替えができませんでした。一度ページを更新してください。");
    }
  };

  const handleToggleDisableCat = async (catId, targetCatName) => {
    const targetCat = categories.find(c => c.id === catId);
    if (!targetCat) return; // 念のためのガード
    // (targetCat.disable_categories || '') とすることで null 回避します [cite: 2026-03-01]
    let currentDisables = (targetCat.disable_categories || '').split(',').map(s => s.trim()).filter(s => s);
        if (currentDisables.includes(targetCatName)) currentDisables = currentDisables.filter(name => name !== targetCatName);
    else currentDisables.push(targetCatName);
    await supabase.from('service_categories').update({ disable_categories: currentDisables.join(',') }).eq('id', catId);
    fetchMenuDetails();
  };

  const handleToggleRequiredCat = async (catId, targetCatName) => {
    const targetCat = categories.find(c => c.id === catId);
    let currentRequired = targetCat.required_categories ? targetCat.required_categories.split(',').map(s => s.trim()).filter(s => s) : [];
    if (currentRequired.includes(targetCatName)) currentRequired = currentRequired.filter(name => name !== targetCatName);
    else currentRequired.push(targetCatName);
    await supabase.from('service_categories').update({ required_categories: currentRequired.join(',') }).eq('id', catId);
    fetchMenuDetails();
  };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      allow_multiple_services: allowMultiple,
      slot_interval_min: slotIntervalMin
    }).eq('id', shopId);
    if (!error) showMsg('予約ルールを保存しました！');
    else alert('保存に失敗しました。');
  };

const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      name: newCategoryName, 
      url_key: newUrlKey, // 👈 これが識別キー（例: yukado）として保存されます
      custom_shop_name: newCustomShopName,
      custom_description: newCustomDescription, 
      custom_official_url: newCustomOfficialUrl,
      is_facility_only: isFacilityOnlyCat
    };

    if (editingCategoryId) {
      // 💡 🆕 追加：古いカテゴリ名を取得しておく
      const oldCategory = categories.find(c => c.id === editingCategoryId);
      const oldName = oldCategory?.name;

      // 1. カテゴリ自体の名前を更新
      await supabase.from('service_categories').update(payload).eq('id', editingCategoryId);

      // 2. 💡 🆕 追加：名前が変わった場合のみ、属するメニューも一括更新
      if (oldName && oldName !== newCategoryName) {
        await supabase
          .from('services')
          .update({ category: newCategoryName })
          .eq('shop_id', shopId)
          .eq('category', oldName);
      }
    } else {
      await supabase.from('service_categories').insert([{ ...payload, shop_id: shopId, sort_order: categories.length }]);
    }
    
    // 🆕 リセット処理
    setEditingCategoryId(null); 
    setNewCategoryName(''); 
    setNewUrlKey(''); 
    setNewCustomShopName(''); 
    setNewCustomDescription(''); // 🚀 🆕 これを追記
    setIsFacilityOnlyCat(false); 
    fetchMenuDetails(); showMsg('カテゴリを更新しました');
  };

const handleServiceSubmit = async (e) => {
    e.preventDefault();
    // カテゴリが0件の場合は、登録を中断してメッセージを出します [cite: 2026-03-06]
    if (categories.length === 0) {
      alert("先にカテゴリを登録してください。");
      return;
    }
    const finalCategory = selectedCategory || (categories[0]?.name || 'その他');
const serviceData = { 
      shop_id: shopId, 
      name: newServiceName, 
      slots: Number(newServiceSlots),
      price: Number(newServicePrice), 
      category: finalCategory,
      restricted_hours: useRestriction ? timeRanges : null,
      is_full_day: isFullDay,
      is_admin_only: isAdminOnly,
      // 🆕 修正：売上対象外フラグをデータベースへ保存
      is_sales_excluded: isSalesExcluded,
      // 🚀 🆕 掲示板表示フラグをデータベースへ保存
      show_on_print: showOnPrint
    };

    if (editingServiceId) await supabase.from('services').update(serviceData).eq('id', editingServiceId);
    else await supabase.from('services').insert([{ ...serviceData, sort_order: services.length }]);
    
    // 保存後は料金の入力欄も 0 にリセットします [cite: 2026-03-08]
    setEditingServiceId(null); 
    setNewServiceName(''); 
    setNewServiceSlots(1); 
    setNewServicePrice(0); 
    setIsFullDay(false);
    setIsAdminOnly(false);
    setShowOnPrint(false);
    fetchMenuDetails(); 
    showMsg('メニューを保存しました');
};

// 🆕 修正：枝メニュー（オプション）を保存する関数
const handleOptionSubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      service_id: activeServiceForOptions.id, 
      group_name: optGroupName, 
      option_name: optName, 
      additional_slots: Number(optSlots),
      additional_price: Number(optPrice),
      is_multiple: optIsMultiple,
      is_admin_only: optIsAdminOnly
    };

    if (editingOptionId) {
      // 編集モード
      await supabase.from('service_options').update(payload).eq('id', editingOptionId);
    } else {
      // 新規登録
      await supabase.from('service_options').insert([payload]);
    }

    // 保存後は入力をリセット（is_multipleはグループ内で維持したい場合が多いので、あえてリセットしない設定もアリです）
    setEditingOptionId(null);
    setOptName(''); 
    setOptSlots(0); 
    setOptPrice(0); 
    fetchMenuDetails(); 
    showMsg(editingOptionId ? '枝メニューを更新しました' : '枝メニューを追加しました');
};

// 🆕 追加：グループ単位で「単一選択 / 複数選択」を一括で切り替えるロジック
// これにより、グループ内の全ての項目の is_multiple を一度に更新できます
const handleToggleOptionGroupMultiple = async (serviceId, groupName, currentStatus) => {
    try {
      const { error } = await supabase
        .from('service_options')
        .update({ is_multiple: !currentStatus })
        .eq('service_id', serviceId)
        .eq('group_name', groupName);

      if (error) throw error;
      
      fetchMenuDetails();
      showMsg(`グループ「${groupName || '共通'}」を${!currentStatus ? '複数選択' : '単一選択'}に切り替えました`);
    } catch (err) {
      console.error("グループ更新エラー:", err.message);
      alert("設定の切り替えに失敗しました。");
    }
};

/* ==========================================
      🆕 追加：調整項目をDBに保存する関数 [cite: 2026-03-08]
      ========================================== */

// 1. 調整カテゴリを保存する
const handleAdjCatSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: newAdjCatName, shop_id: shopId, is_adjustment_cat: true };

    if (editingAdjCatId) {
      // 💡 🆕 追加：古いカテゴリ名の特定
      const oldCat = adjCategories.find(c => c.id === editingAdjCatId);
      const oldName = oldCat?.name;

      await supabase.from('service_categories').update(payload).eq('id', editingAdjCatId);

      // 💡 🆕 追加：属する調整項目のカテゴリ名を一括更新
      if (oldName && oldName !== newAdjCatName) {
        await supabase
          .from('admin_adjustments')
          .update({ category: newAdjCatName })
          .eq('shop_id', shopId)
          .eq('category', oldName);
      }
    } else {
      await supabase.from('service_categories').insert([{ ...payload, sort_order: adjCategories.length }]);
    }
    
    setNewAdjCatName(''); setEditingAdjCatId(null); 
    fetchMenuDetails(); showMsg('調整カテゴリと項目を更新しました');
  };
  
  // 2. 調整ボタン本体を保存する
  const handleAdjItemSubmit = async (e) => {
    e.preventDefault();
    const finalCat = selectedAdjCat || (adjCategories[0]?.name || 'その他');
    const payload = {
      shop_id: shopId,
      category: finalCat,
      name: newAdjName,
      price: Number(adjValue),
      is_percent: adjType === 'percent',
      is_minus: adjType === 'minus' || adjType === 'percent',
      service_id: null
    };
    if (editingAdjId) await supabase.from('admin_adjustments').update(payload).eq('id', editingAdjId);
    else await supabase.from('admin_adjustments').insert([{ ...payload, sort_order: adjustments.length }]);
    
    setNewAdjName(''); setAdjValue(0); setEditingAdjId(null); 
    fetchMenuDetails(); // 画面を更新 [cite: 2026-03-08]
    showMsg('調整項目を保存しました');
  };

  /* ==========================================
      🆕 追加：店販商品の保存関数 [cite: 2026-03-08]
     ========================================== */

  // 1. 商品カテゴリを保存 [cite: 2026-03-08]
const handleProdCatSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: newProdCatName, shop_id: shopId, is_product_cat: true };

    if (editingProdCatId) {
      // 💡 🆕 追加：古いカテゴリ名の特定
      const oldCat = productCategories.find(c => c.id === editingProdCatId);
      const oldName = oldCat?.name;

      await supabase.from('service_categories').update(payload).eq('id', editingProdCatId);

      // 💡 🆕 追加：属する商品のカテゴリ名を一括更新
      if (oldName && oldName !== newProdCatName) {
        await supabase
          .from('products')
          .update({ category: newProdCatName })
          .eq('shop_id', shopId)
          .eq('category', oldName);
      }
    } else {
      await supabase.from('service_categories').insert([{ ...payload, sort_order: productCategories.length }]);
    }
    
    setNewProdCatName(''); 
    setEditingProdCatId(null); 
    fetchMenuDetails();
    showMsg('商品カテゴリと在庫データを更新しました');
  };
  
  // 2. 商品本体を保存 [cite: 2026-03-08]
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    // カテゴリが未選択なら最初のカテゴリ、それもなければ '未分類' をセット
    const finalCat = selectedProdCat || (productCategories[0]?.name || '未分類');
    const payload = { shop_id: shopId, category: finalCat, name: newProdName, price: Number(newProdPrice) };
    
    if (editingProdId) {
      await supabase.from('products').update(payload).eq('id', editingProdId);
    } else {
      await supabase.from('products').insert([{ ...payload, sort_order: products.length }]);
    }
    
    setNewProdName(''); 
    setNewProdPrice(0); 
    setEditingProdId(null); 
    fetchMenuDetails();
    showMsg('商品を登録しました');
  };

  // --- 4. スタイル設定 ---
  const containerStyle = { fontFamily: 'sans-serif', width: '100%', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', position: 'relative', boxSizing: 'border-box' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };
  const btnActiveS = (val, target) => ({ flex: 1, padding: '12px 5px', background: val === target ? themeColor : '#fff', color: val === target ? '#fff' : '#333', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' });

  return (
    <div style={containerStyle}>
      {/* 🔔 通知メッセージ */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

{/* 🚀 ナビゲーションヘッダー（統一デザイン＆レスポンシブ版） */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', gap: '10px' }}>
        <button 
          onClick={() => navigate(`/admin/${shopId}/dashboard`)}
          style={{ 
            background: '#fff', 
            border: '1px solid #e2e8f0', 
            padding: isPC ? '10px 20px' : '10px 12px', 
            borderRadius: '30px', 
            fontWeight: 'bold', 
            color: '#64748b', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: isPC ? '1rem' : '0.8rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            whiteSpace: 'nowrap'
          }}
        >
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ' : '戻る'}
        </button>

        <button 
          // 🚀 🆕 案内人機能を一旦停止（リンク解除 ＆ 無効化）
          disabled={true} 
          style={{ 
            background: '#cbd5e1', // 鮮やかな色からグレーに変更
            border: 'none', 
            padding: isPC ? '10px 20px' : '10px 15px', 
            borderRadius: '30px', 
            fontSize: isPC ? '0.9rem' : '0.8rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'not-allowed', // 禁止マークを表示
            boxShadow: 'none', // 影を消す
            whiteSpace: 'nowrap'
          }}
        >
          <Sparkles size={16} /> {isPC ? '案内人（準備中）' : '準備中'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        メニュー設定
      </h2>

      {/* --- 🚀 🆕 予約フォームURL案内板（三土手さん仕様） --- */}
      <section style={{ ...cardStyle, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <Link2 size={18} /> 予約フォームURLのご案内
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* ① 通常の予約フォーム（共通） */}
          <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #dcfce7' }}>
            <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>全メニュー表示用（共通）</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <code style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {`${BIZ_URL}/shop/${shopId}/reserve`}
              </code>
              <button 
                onClick={() => copyToClipboard(`${BIZ_URL}/shop/${shopId}/reserve`)}
                style={{ padding: '6px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
              >コピー</button>
            </div>
          </div>

          {/* ② 識別キー（typeパラメータ）付URLの自動生成リスト */}
          {Array.from(new Set(categories.map(c => c.url_key).filter(Boolean))).map(key => (
            <div key={key} style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #dcfce7' }}>
              <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                事業専用：{categories.find(c => c.url_key === key)?.name || key}
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <code style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {`${BIZ_URL}/shop/${shopId}/reserve?type=${key}`}
                </code>
                <button 
                  onClick={() => copyToClipboard(`${BIZ_URL}/shop/${shopId}/reserve?type=${key}`)}
                  style={{ padding: '6px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >コピー</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* --- 🚀 🆕 ここまで --- */}

      {/* ⚙️ 予約エンジンの基本 */}
      <section style={{ ...cardStyle, border: `2px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Settings2 size={20} /> 予約エンジンの基本設定
        </h3>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', marginBottom: '10px', fontSize: '0.85rem', color: '#334155' }}>
  1コマの単位（推奨：30分）
  <HelpTooltip themeColor={themeColor} text="予約時間の最小単位です。すべてのメニューはこの「コマ数」を掛け合わせて時間を計算します。" />
</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[10, 15, 20, 30].map(min => (
              <button key={min} onClick={() => setSlotIntervalMin(min)} style={btnActiveS(slotIntervalMin, min)}>{min}分</button>
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '20px' }}>
          <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} style={{ width: '22px', height: '22px' }} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#334155' }}>複数のカテゴリ選択を許可する</span>
  <HelpTooltip themeColor={themeColor} text="お客様が「カット」と「カラー」など、異なるカテゴリのメニューを一度に複数選べるようにします。" />
</div>
        </label>
        <button onClick={handleSave} style={{ width: '100%', padding: '16px', background: themeColor, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', boxShadow: `0 4px 12px ${themeColor}33`, cursor: 'pointer' }}>
          <Save size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 基本設定を保存
        </button>
      </section>

      {/* 📂 カテゴリ設定 */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Layers size={20} color="#64748b" /> カテゴリ設定
        </h3>
        <form onSubmit={handleCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <input placeholder="カテゴリ名 (例: カット, カラー)" value={newCategoryName || ''} onChange={(e) => setNewCategoryName(e.target.value)} style={inputStyle} required />
{/* ラベル部分の修正 */}
<div style={{ display: 'flex', flexDirection: isPC ? 'row' : 'column', gap: '10px', alignItems: isPC ? 'center' : 'flex-start', marginBottom: '5px' }}>
  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>識別キー</span>
    <HelpTooltip themeColor={themeColor} text="英数字を入力すると、このカテゴリ専用の予約URLを作成できます（例：hair）。" />
  </div>
  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>専用屋号</span>
    <HelpTooltip themeColor={themeColor} text="このカテゴリの予約画面だけ、別の店名を表示したい場合に入力します。" />
  </div>
</div>

{/* 入力欄部分の修正 */}
<div style={{ display: 'flex', flexDirection: isPC ? 'row' : 'column', gap: '10px' }}>
  <input placeholder="例: yukado" value={newUrlKey} onChange={(e) => setNewUrlKey(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
  <input placeholder="例: 訪問カット 結美" value={newCustomShopName} onChange={(e) => setNewCustomShopName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
</div>
          {/* 🚀 🆕 ここから追加：専用説明文の入力欄 */}
          <textarea 
            placeholder="専用サブタイトル・説明文 (任意)" 
            value={newCustomDescription} 
            onChange={(e) => setNewCustomDescription(e.target.value)} 
            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} 
          />
          {/* 🆕 ここまで */}

{/* 🆕 カテゴリ単位の施設専用スイッチを追加 */}
<div style={{ padding: '12px', background: isFacilityOnlyCat ? '#f0f9ff' : '#f8fafc', borderRadius: '12px', border: isFacilityOnlyCat ? '2px solid #0ea5e9' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
  <input 
    type="checkbox" 
    checked={isFacilityOnlyCat} 
    onChange={(e) => setIsFacilityOnlyCat(e.target.checked)} 
    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
  />
  <div style={{ display: 'flex', alignItems: 'center' }}>
  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isFacilityOnlyCat ? '#0369a1' : '#64748b' }}>
    このカテゴリを【施設予約専用】にする
  </span>
  <HelpTooltip themeColor={themeColor} text="介護施設専用のメニューです" />
</div>
</div>

<button type="submit" style={{ width: '100%', padding: '14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            <Plus size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> {editingCategoryId ? 'カテゴリを更新' : '新しいカテゴリを登録'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {categories.map((c, idx) => (
            <div key={c.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e5e7eb', marginBottom: '12px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                
                {/* --- 🚀 汎用ラベル対応のバッジ表示（これだけで十分判別できます） --- */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{c.name}</span>
                  
                  {/* display_group_id が 1 や 2 の場合、店舗主が設定した名前でバッジを出す */}
                  {c.url_key && (
  <span style={{ 
    fontSize: '0.65rem', padding: '2px 8px', 
    background: '#f1f5f9', color: '#64748b', 
    borderRadius: '4px', fontWeight: 'bold',
    border: '1px solid #cbd5e1'
  }}>
    🔑 {c.url_key}
  </span>
)}

                  {c.is_facility_only && (
                    <span style={{ fontSize: '0.6rem', padding: '2px 8px', background: '#0ea5e9', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>施設専用</span>
                  )}
                </div>
                {/* ------------------------------------------ */}

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => moveItem('category', categories, c.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}><ArrowUp size={16} /></button>
                  <button onClick={() => moveItem('category', categories, c.id, 'down')} disabled={idx === categories.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}><ArrowDown size={16} /></button>
                  
                  {/* --- 🆕 編集ボタン：setIsFacilityOnlyCat を追加 --- */}
                  <button onClick={() => { 
                    setEditingCategoryId(c.id); 
                    setNewCategoryName(c.name); 
                    setNewUrlKey(c.url_key || ''); 
                    setNewCustomShopName(c.custom_shop_name || '');
                    setNewCustomDescription(c.custom_description || '');
                    setIsFacilityOnlyCat(!!c.is_facility_only);
                  }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}>
                    <Edit2 size={16} />
                  </button>
<button 
  onClick={async () => { 
    if(window.confirm(`「${c.name}」カテゴリを削除しますか？\n※このカテゴリに属するメニューもすべて削除されます。`)) { 
      // 1. 先にそのカテゴリに属するメニュー（services）を削除
      await supabase.from('services').delete().eq('shop_id', shopId).eq('category', c.name);
      // 2. その後にカテゴリ自体を削除
      await supabase.from('service_categories').delete().eq('id', c.id); 
      fetchMenuDetails(); 
      showMsg('カテゴリとメニューを削除しました');
    } 
  }} 
  style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444', cursor: 'pointer' }}
>
  <Trash2 size={16} />
</button>
              </div>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={async () => { await supabase.from('service_categories').update({ allow_multiple_in_category: !c.allow_multiple_in_category }).eq('id', c.id); fetchMenuDetails(); }} style={{ fontSize: '0.75rem', padding: '6px 12px', background: c.allow_multiple_in_category ? themeColor : '#fff', color: c.allow_multiple_in_category ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {c.allow_multiple_in_category ? '複数選択可' : '1つのみ選択'}
                </button>
                <button onClick={() => setEditingDisableCatId(editingDisableCatId === c.id ? null : c.id)} style={{ fontSize: '0.75rem', padding: '6px 12px', background: editingDisableCatId === c.id ? '#1e293b' : '#fff', color: editingDisableCatId === c.id ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Link2 size={14} /> 連動設定 {editingDisableCatId === c.id ? 'を閉じる' : ''}
                </button>
              </div>
              
              {editingDisableCatId === c.id && (
                <div style={{ marginTop: '16px', padding: '16px', background: '#fff', borderRadius: '16px', border: `2px solid ${themeColor}` }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={14} /> 同時に選べないカテゴリ：</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {categories.filter(t => t.id !== c.id).map(t => {
                      const isDis = c.disable_categories?.split(',').includes(t.name);
                      return <button key={t.id} onClick={() => handleToggleDisableCat(c.id, t.name)} style={{ fontSize: '0.7rem', padding: '5px 10px', borderRadius: '15px', border: '1px solid', borderColor: isDis ? '#ef4444' : '#cbd5e1', background: isDis ? '#fee2e2' : '#fff', color: isDis ? '#ef4444' : '#475569', cursor: 'pointer' }}>{t.name}</button>
                    })}
                  </div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: themeColor, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} /> セットで選ぶ必要があるカテゴリ：</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {categories.filter(t => t.id !== c.id).map(t => {
                      const isReq = c.required_categories?.split(',').includes(t.name);
                      return <button key={t.id} onClick={() => handleToggleRequiredCat(c.id, t.name)} style={{ fontSize: '0.7rem', padding: '5px 10px', borderRadius: '15px', border: '1px solid', borderColor: isReq ? themeColor : '#cbd5e1', background: isReq ? '#dbeafe' : '#fff', color: isReq ? themeColor : '#475569', cursor: 'pointer' }}>{t.name}</button>
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 📝 メニュー登録・編集 */}
      <section ref={menuFormRef} style={{ ...cardStyle, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Edit2 size={20} color="#64748b" /> メニュー登録・編集
        </h3>
        <form onSubmit={handleServiceSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>所属カテゴリ</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={inputStyle} required>
              <option value="">-- カテゴリを選択してください --</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
<div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>メニュー名</label>
            <input 
              value={newServiceName} 
              onChange={(e) => setNewServiceName(e.target.value)} 
              style={inputStyle} 
              placeholder="例: カット ＆ ブロー" 
              required 
            />
          </div>

          {/* 💰 追加：基本料金入力欄（ここを差し込みます） [cite: 2026-03-08] */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>基本料金 (税込)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 'bold' }}>¥</span>
              <input 
                type="number" 
                value={newServicePrice} 
                onChange={(e) => setNewServicePrice(e.target.value)} 
                style={{ ...inputStyle, paddingLeft: '30px', fontWeight: '900', color: '#d34817' }} 
                placeholder="0" 
                required 
              />
            </div>
          </div>

{/* ✅ 🆕 差し込み：受付時間制限の設定UI */}
          <div style={{ marginBottom: '20px', padding: '15px', background: useRestriction ? `${themeColor}08` : '#f1f5f9', borderRadius: '12px', border: useRestriction ? `1px solid ${themeColor}44` : '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: useRestriction ? '15px' : '0' }}>
              <input type="checkbox" checked={useRestriction} onChange={(e) => setUseRestriction(e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155' }}>このメニューの受付時間を制限する</span>
            </label>

            {useRestriction && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {timeRanges.map((range, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', animation: 'fadeIn 0.3s ease' }}>
                    <input 
                      type="time" 
                      value={range.start} 
                      onChange={(e) => {
                        const newRanges = [...timeRanges];
                        newRanges[index].start = e.target.value;
                        setTimeRanges(newRanges);
                      }} 
                      style={{ ...inputStyle, width: '120px', padding: '8px' }} 
                    />
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>〜</span>
                    <input 
                      type="time" 
                      value={range.end} 
                      onChange={(e) => {
                        const newRanges = [...timeRanges];
                        newRanges[index].end = e.target.value;
                        setTimeRanges(newRanges);
                      }} 
                      style={{ ...inputStyle, width: '120px', padding: '8px' }} 
                    />
                    
                    {/* 削除ボタン：2つ以上ある時だけ表示 */}
                    {timeRanges.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => setTimeRanges(timeRanges.filter((_, i) => i !== index))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                
                {/* ＋ 追加ボタン */}
                <button 
                  type="button"
                  onClick={() => setTimeRanges([...timeRanges, { start: '18:00', end: '20:00' }])}
                  style={{ alignSelf: 'flex-start', fontSize: '0.75rem', background: '#fff', border: `1px dashed ${themeColor}`, color: themeColor, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '5px' }}
                >
                  ＋ 時間帯を追加
                </button>
              </div>
            )}
          </div>

          {/* 🆕 1日貸切モードの設定UIを追加 */}
          <div style={{ marginBottom: '20px', padding: '15px', background: isFullDay ? '#fff7ed' : '#f8fafc', borderRadius: '12px', border: isFullDay ? '1px solid #ffedd5' : '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isFullDay} 
                onChange={(e) => setIsFullDay(e.target.checked)} 
                style={{ width: '18px', height: '18px' }} 
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isFullDay ? '#c2410c' : '#334155' }}>
    このメニューで1日（許可時間内）を貸切にする
  </span>
  <HelpTooltip themeColor={themeColor} text="1件でも予約が入ればその日の全スロットを自動で埋め、他のお客様が予約できないようにします。" />
</div>
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                  ※予約が入った際、設定された受付時間内の全スロットを自動で埋めます。
                </p>
              </div>
            </label>
          </div>

          {/* 🆕 管理者専用モードの設定UIを追加 */}
<div style={{ marginBottom: '20px', padding: '15px', background: isAdminOnly ? '#f1f5f9' : '#fff', borderRadius: '12px', border: isAdminOnly ? `2px solid #64748b` : '1px solid #e2e8f0' }}>
  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
    <input 
      type="checkbox" 
      checked={isAdminOnly} 
      onChange={(e) => setIsAdminOnly(e.target.checked)} 
      style={{ width: '18px', height: '18px' }} 
    />
    <div>
      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isAdminOnly ? '#1e293b' : '#334155' }}>
        【管理者専用】ねじ込み予約のみに表示する
      </span>
      <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#64748b' }}>
        ※ONにすると、一般の予約フォームからはこのメニューが見えなくなります。
      </p>
    </div>
  </label>
</div>

{/* 🆕 追加：売上対象外設定のスイッチ（レジに表示させない設定） */}
          <div style={{ 
            marginBottom: '20px', 
            padding: '15px', 
            background: isSalesExcluded ? '#fef2f2' : '#fff', 
            borderRadius: '12px', 
            border: isSalesExcluded ? `2px solid #ef4444` : '1px solid #e2e8f0' 
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isSalesExcluded} 
                onChange={(e) => setIsSalesExcluded(e.target.checked)} 
                style={{ width: '18px', height: '18px' }} 
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isSalesExcluded ? '#ef4444' : '#334155' }}>
    【売上対象外】カレンダーのみ表示し、レジには出さない
  </span>
  <HelpTooltip themeColor={themeColor} text="無料の相談会や現地調査など、カレンダーに予定は入れたいがお会計は発生しないメニューに使用します。" />
</div>
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                  ※見積りや現地調査など、お会計が発生しないメニューにチェックしてください。
                </p>
              </div>
            </label>
          </div>

          {/* 🚀 🆕 掲示用名簿フラグの追加 */}
          <div style={{ 
            marginBottom: '20px', 
            padding: '15px', 
            background: showOnPrint ? '#fffbeb' : '#fff', 
            borderRadius: '12px', 
            border: showOnPrint ? `2px solid #f59e0b` : '1px solid #e2e8f0' 
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={showOnPrint}
                onChange={(e) => setShowOnPrint(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: showOnPrint ? '#92400e' : '#334155' }}>
    【掲示用】施設に貼る名簿に「希望メニュー」として載せる
  </span>
  <HelpTooltip themeColor={themeColor} text="施設側で印刷して壁に貼る「アナログな予約名簿」に、選択肢としてこのメニューを載せます。" />
</div>
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                  ※ONにすると、施設側で印刷する「あつまれ綺麗にしたい人」名簿に選択肢として表示されます。
                </p>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', marginBottom: '10px', color: '#64748b' }}>
  <span>必要コマ数: <span style={{ color: themeColor, fontSize: '1.1rem' }}>{newServiceSlots}コマ（{newServiceSlots * slotIntervalMin}分）</span></span>
  <HelpTooltip themeColor={themeColor} text="このメニューを完了するのに必要な時間をコマ数で指定してください。" />
</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button key={n} type="button" onClick={() => setNewServiceSlots(n)} style={{ width: '45px', height: '45px', borderRadius: '12px', border: '2px solid', borderColor: newServiceSlots === n ? themeColor : '#e2e8f0', background: newServiceSlots === n ? themeColor : 'white', color: newServiceSlots === n ? 'white' : '#1e293b', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>{n}</button>
              ))}
            </div>
          </div>
          <button type="submit" style={{ width: '100%', padding: '16px', background: themeColor, color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', boxShadow: `0 4px 12px ${themeColor}44`, cursor: 'pointer' }}>
            <Save size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {editingServiceId ? 'メニューを更新する' : 'メニューを新規登録'}
          </button>
        </form>
      </section>

      {/* 表示エリア */}
      <div style={{ marginTop: '30px' }}>
        <h3 style={{ fontSize: '1rem', color: '#1e293b', marginBottom: '20px', fontWeight: 'bold' }}>現在のメニュー一覧</h3>
        {categories.map((cat) => (
          <div key={cat.id} style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '12px', borderLeft: `4px solid ${themeColor}`, paddingLeft: '10px', fontWeight: 'bold' }}>{cat.name}</h4>
            {services.filter(s => s.category === cat.name).map((s, idx, filteredList) => (
              <div key={s.id} style={{ ...cardStyle, marginBottom: '12px', border: activeServiceForOptions?.id === s.id ? `2px solid ${themeColor}` : '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#1e293b', lineHeight: '1.4' }}>
  {s.name.split('/').map((text, i) => (
    <React.Fragment key={i}>
      {text}
      {i !== s.name.split('/').length - 1 && <br />}
    </React.Fragment>
  ))}
</div>
                    {/* 金額を表示するために flex で横並びにします [cite: 2026-03-08] */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.8rem', color: themeColor, fontWeight: 'bold' }}>{s.slots}コマ（{s.slots * slotIntervalMin}分）</div>
                      {/* ✅ 料金表示を追加 [cite: 2026-03-08] */}
                      <div style={{ fontSize: '0.8rem', color: '#d34817', fontWeight: 'bold' }}>¥{(s.price || 0).toLocaleString()}</div>
                    </div>
                  </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setActiveServiceForOptions(activeServiceForOptions?.id === s.id ? null : s)} style={{ padding: '6px 12px', background: activeServiceForOptions?.id === s.id ? themeColor : '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', color: activeServiceForOptions?.id === s.id ? '#fff' : '#475569', cursor: 'pointer' }}>枝</button>
<button 
  onClick={() => moveItem('service', filteredList, s.id, 'up')} 
  disabled={idx === 0} 
  style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
>
  <ArrowUp size={16} />
</button>
<button 
  onClick={() => moveItem('service', filteredList, s.id, 'down')} 
  disabled={idx === filteredList.length - 1} 
  style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === filteredList.length - 1 ? 0.3 : 1, cursor: idx === filteredList.length - 1 ? 'not-allowed' : 'pointer' }}
>
  <ArrowDown size={16} />
</button>
<button 
                      onClick={() => { 
                        setEditingServiceId(s.id); 
                        setNewServiceName(s.name); 
                        setNewServiceSlots(s.slots); 
                        setNewServicePrice(s.price || 0); 
                        setSelectedCategory(s.category); 
                        setIsFullDay(s.is_full_day || false);
                        setIsAdminOnly(s.is_admin_only || false);
                        setIsSalesExcluded(s.is_sales_excluded || false);
                        setShowOnPrint(s.show_on_print || false);
                        
                        // ✅ 🆕 差し込み：制限データの復元
                        if (s.restricted_hours) {
                          setUseRestriction(true);
                          // 過去に単一オブジェクトで保存していた場合にも対応できるように Array.isArray で判定
                          setTimeRanges(Array.isArray(s.restricted_hours) ? s.restricted_hours : [s.restricted_hours]);
                        } else {
                          setUseRestriction(false);
                          setTimeRanges([{ start: '08:00', end: '09:00' }]); // デフォルト値
                        }

                        menuFormRef.current?.scrollIntoView({ behavior: 'smooth' }); 
                      }} 
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}
                    >
                      <Edit2 size={16} />
                    </button>
                                        <button onClick={async () => { if(window.confirm('メニューを削除しますか？')) { await supabase.from('services').delete().eq('id', s.id); fetchMenuDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444' }}><Trash2 size={16} /></button>
                  </div>
                </div>

                {/* 枝メニュー表示ロジック */}
                {activeServiceForOptions?.id === s.id && (
                  <div style={{ marginTop: '20px', background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 'bold', color: themeColor, marginBottom: '12px' }}>枝メニュー（追加オプション）の管理</p>
<form onSubmit={handleOptionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input placeholder="枝カテゴリ (例: シャンプー, 指名料)" value={optGroupName} onChange={(e) => setOptGroupName(e.target.value)} style={inputStyle} />
                      <input placeholder="枝メニュー名 (例: あり, 担当 A)" value={optName} onChange={(e) => setOptName(e.target.value)} style={inputStyle} required />
                      
                      {/* 🆕 1段目：数値入力グループ（ここで金額を広く取ります） */}
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>追加:</span>
                          <input type="number" value={optSlots} onChange={(e) => setOptSlots(parseInt(e.target.value))} style={{ width: '70px', ...inputStyle }} />
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>コマ</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>料金: +¥</span>
                          <input 
                            type="number" 
                            value={optPrice} 
                            onChange={(e) => setOptPrice(Number(e.target.value))} 
                            style={{ flex: 1, minWidth: '100px', ...inputStyle, fontWeight: 'bold', color: '#d34817' }} 
                            placeholder="0" 
                          />
                        </div>
                      </div>

                      {/* 🆕 2段目：設定スイッチ ＆ 登録ボタン */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={optIsMultiple} onChange={(e) => setOptIsMultiple(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>複数選択可</span>
                          </label>
                          
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={optIsAdminOnly} onChange={(e) => setOptIsAdminOnly(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: optIsAdminOnly ? '#ef4444' : '#64748b' }}>
                              {optIsAdminOnly ? '⚠️ 管理者専用' : '🌐 ユーザー可'}
                            </span>
                          </label>
                        </div>

                        <button type="submit" style={{ padding: '12px 25px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                          {editingOptionId ? '枝を更新' : '＋ 枝追加'}
                        </button>
                      </div>
                    </form>                    
<div style={{ marginTop: '20px' }}>
                      {/* (options || []) で配列であることを保証します [cite: 2026-03-01] */}
                      {Array.from(new Set((options || []).filter(o => o && o.service_id === s.id).map(o => o.group_name || '共通'))).map(group => (
<div key={group} style={{ marginBottom: '12px' }}>
    {/* 🆕 グループヘッダーに切り替えボタンを配置 */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8' }}>▼ {group || '共通'}</div>
      
      {(() => {
        // このグループの現在の設定値を取得（最初の1件を参照）
        const groupOptions = options.filter(o => o.service_id === s.id && o.group_name === group);
        const isMultiple = groupOptions[0]?.is_multiple;
        
        return (
          <button 
            type="button"
            onClick={() => handleToggleOptionGroupMultiple(s.id, group, isMultiple)}
            style={{ 
              fontSize: '0.65rem', 
              padding: '4px 10px', 
              background: isMultiple ? themeColor : '#fff', 
              color: isMultiple ? '#fff' : '#475569', 
              border: '1px solid #cbd5e1', 
              borderRadius: '20px', 
              fontWeight: 'bold', 
              cursor: 'pointer' 
            }}
          >
            {isMultiple ? '複数選択可' : '1つのみ選択'}
          </button>
        );
      })()}
    </div>

    {options.filter(o => o.service_id === s.id && o.group_name === group).map(o => (
      <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #eee', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 'bold', lineHeight: '1.4', display: 'block' }}>
  {o.option_name.split('/').map((text, i) => (
    <React.Fragment key={i}>
      {text}
      {i !== o.option_name.split('/').length - 1 && <br />}
    </React.Fragment>
  ))}
</span>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                                  <span style={{ color: themeColor }}>+{o.additional_slots}コマ</span>
                                  {/* ✅ 枝メニューの追加料金を表示 [cite: 2026-03-08] */}
                                  <span style={{ color: '#d34817', fontWeight: 'bold' }}>+¥{(o.additional_price || 0).toLocaleString()}</span>
                                </div>
                              </div>
                              
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {/* ✏️ 🆕 枝メニューの編集ボタン丸 [cite: 2026-03-08] */}
                                <button 
                                  onClick={() => {
                                    setEditingOptionId(o.id);
                                    setOptGroupName(o.group_name || '');
                                    setOptName(o.option_name);
                                    setOptSlots(o.additional_slots || 0);
                                    setOptPrice(o.additional_price || 0);
                                    setOptIsMultiple(o.is_multiple || false);
                                  }} 
                                  style={{ color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button onClick={async () => { if(window.confirm('この枝メニューを削除しますか？')) { await supabase.from('service_options').delete().eq('id', o.id); fetchMenuDetails(); } }} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                                                    ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
</div>
        ))}
</div>

      {/* ==========================================
          🆕 店販商品マスター管理 [cite: 2026-03-08]
         ========================================== */}
      <div style={{ marginTop: '60px', borderTop: '6px solid #008000', paddingTop: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
          <div style={{ background: '#008000', color: '#fff', padding: '8px', borderRadius: '10px' }}><ShoppingBag size={24} /></div>
          <h2 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0, fontWeight: '900' }}>店販商品マスター管理</h2>
        </div>

{/* 1. 商品カテゴリ作成 */}
        <section style={{ ...cardStyle, background: '#f0fdf4', border: '2px solid #bbf7d0' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#008000', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Layers size={18} /> 商品カテゴリの作成</h3>
          <form onSubmit={handleProdCatSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input placeholder="例：シャンプー, スタイリング剤" value={newProdCatName} onChange={(e) => setNewProdCatName(e.target.value)} style={inputStyle} required />
            <button type="submit" style={{ padding: '0 25px', background: '#008000', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              {editingProdCatId ? '更新' : '＋作成'}
            </button>
          </form>

{/* 🆕 商品カテゴリの一覧 [cite: 2026-03-08] */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {productCategories.map((c, idx) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => moveItem('category', productCategories, c.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={16} /></button>
                  <button onClick={() => moveItem('category', productCategories, c.id, 'down')} disabled={idx === productCategories.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === productCategories.length - 1 ? 0.3 : 1 }}><ArrowDown size={16} /></button>
                  
                  {/* ✅ adj ではなく c を使うように修正しました [cite: 2026-03-08] */}
                  <button onClick={() => { setEditingProdCatId(c.id); setNewProdCatName(c.name); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}><Edit2 size={16} /></button>
                  
<button 
  onClick={async () => { 
    if(window.confirm(`「${c.name}」商品カテゴリを削除しますか？\n※登録されている商品もすべて削除されます。`)) { 
      // 1. 商品を削除
      await supabase.from('products').delete().eq('shop_id', shopId).eq('category', c.name);
      // 2. カテゴリを削除
      await supabase.from('service_categories').delete().eq('id', c.id); 
      fetchMenuDetails(); 
      showMsg('商品カテゴリと在庫データを削除しました');
    } 
  }} 
  style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444', cursor: 'pointer' }}
>
  <Trash2 size={16} />
</button>
              </div>
              </div>
            ))}
          </div>
                  </section>

        {/* 2. 商品登録フォーム */}
<section ref={prodFormRef} style={{ ...cardStyle, border: '2px solid #008000' }}>
  <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#008000', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
    <Plus size={20} /> 商品の新規登録
  </h3>
          <form onSubmit={handleProductSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>所属カテゴリ</label>
              <select value={selectedProdCat} onChange={(e) => setSelectedProdCat(e.target.value)} style={inputStyle} required>
                <option value="">-- カテゴリを選択 --</option>
                {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 2 }}><input placeholder="商品名" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} style={inputStyle} required /></div>
              <div style={{ flex: 1 }}><input type="number" placeholder="金額" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} style={inputStyle} required /></div>
            </div>
            <button type="submit" style={{ width: '100%', padding: '16px', background: '#008000', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem' }}>
              {editingProdId ? '商品を更新する' : '商品を新規登録'}
            </button>
          </form>
        </section>

{/* 3. 商品一覧 */}
        {productCategories.map(cat => (
          <div key={cat.id} style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#008000', fontSize: '0.9rem', marginBottom: '15px', borderLeft: '5px solid #008000', paddingLeft: '12px', fontWeight: 'bold' }}>{cat.name}</h4>
{/* 緑色の店販商品の一覧部分 */}
            {products.filter(p => p.category === cat.name).map((p, idx, filteredList) => (
              <div key={p.id} style={{ ...cardStyle, padding: '18px 25px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #bbf7d0' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{p.name}</div>
                  <div style={{ fontSize: '0.95rem', color: '#008000', fontWeight: 'bold', marginTop: '4px' }}>¥{(p.price || 0).toLocaleString()}</div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* 💡 ここを修正：'product' と p.id を使います [cite: 2026-03-08] */}
                  <button 
                    onClick={() => moveItem('product', filteredList, p.id, 'up')} 
                    disabled={idx === 0} 
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    <ArrowUp size={20} />
                  </button>
                  <button 
                    onClick={() => moveItem('product', filteredList, p.id, 'down')} 
                    disabled={idx === filteredList.length - 1} 
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === filteredList.length - 1 ? 0.3 : 1, cursor: idx === filteredList.length - 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ArrowDown size={20} />
                  </button>
                  
<button 
  onClick={() => { 
    setEditingProdId(p.id); 
    setNewProdName(p.name); 
    setNewProdPrice(p.price); 
    setSelectedProdCat(p.category); 
    // 🆕 フォームの位置までスクロール
    prodFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  }} 
  style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#3b82f6' }}
>
  <Edit2 size={20} />
</button>
                <button onClick={async () => { if(window.confirm('削除しますか？')) { await supabase.from('products').delete().eq('id', p.id); fetchMenuDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#ef4444' }}><Trash2 size={20} /></button>
                </div>
              </div>
            ))}
                      </div>
        ))}
        </div>

      <div style={{ marginTop: '60px', borderTop: '6px solid #ef4444', paddingTop: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
          <div style={{ background: '#ef4444', color: '#fff', padding: '8px', borderRadius: '10px' }}><Settings2 size={24} /></div>
          <h2 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0, fontWeight: '900' }}>お会計調整マスター管理</h2>
        </div>

{/* 1. 調整カテゴリ作成 */}
        <section style={{ ...cardStyle, background: '#fff5f5', border: '2px solid #feb2b2' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Layers size={18} /> 調整カテゴリの作成</h3>
          <form onSubmit={handleAdjCatSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input placeholder="例：割引, キャンペーン" value={newAdjCatName} onChange={(e) => setNewAdjCatName(e.target.value)} style={inputStyle} required />
            <button type="submit" style={{ padding: '0 25px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              {editingAdjCatId ? '更新' : '＋作成'}
            </button>
          </form>

          {/* 🆕 追加：調整カテゴリの並び替え一覧 [cite: 2026-03-08] */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {adjCategories.map((c, idx) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => moveItem('category', adjCategories, c.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={16} /></button>
                  <button onClick={() => moveItem('category', adjCategories, c.id, 'down')} disabled={idx === adjCategories.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === adjCategories.length - 1 ? 0.3 : 1 }}><ArrowDown size={16} /></button>
                  <button onClick={() => { setEditingAdjCatId(c.id); setNewAdjCatName(c.name); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}><Edit2 size={16} /></button>
<button 
  onClick={async () => { 
    if(window.confirm(`「${c.name}」調整カテゴリを削除しますか？\n※中の調整ボタンもすべて削除されます。`)) { 
      // 1. 調整項目を削除
      await supabase.from('admin_adjustments').delete().eq('shop_id', shopId).eq('category', c.name);
      // 2. カテゴリを削除
      await supabase.from('service_categories').delete().eq('id', c.id); 
      fetchMenuDetails(); 
      showMsg('調整カテゴリと項目を削除しました');
    } 
  }} 
  style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444', cursor: 'pointer' }}
>
  <Trash2 size={16} />
</button>
              </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2. 調整ボタン登録 */}
<section ref={adjFormRef} style={{ ...cardStyle, border: '2px solid #ef4444' }}>
  <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
    <Plus size={20} /> 調整ボタンの登録
  </h3>
          <form onSubmit={handleAdjItemSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>所属カテゴリ</label>
              <select value={selectedAdjCat} onChange={(e) => setSelectedAdjCat(e.target.value)} style={inputStyle} required>
                <option value="">-- カテゴリを選択 --</option>
                {adjCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 2 }}><input placeholder="ボタン名" value={newAdjName} onChange={(e) => setNewAdjName(e.target.value)} style={inputStyle} required /></div>
              <div style={{ flex: 1 }}>
                <select value={adjType} onChange={(e) => setAdjType(e.target.value)} style={inputStyle}>
                  <option value="minus">－ (引く)</option>
                  <option value="plus">＋ (足す)</option>
                  <option value="percent">％ (割引)</option>
                </select>
              </div>
            </div>
            <input type="number" placeholder="数値" value={adjValue} onChange={(e) => setAdjValue(e.target.value)} style={inputStyle} required />
            <button type="submit" style={{ width: '100%', marginTop: '20px', padding: '16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem' }}>
              {editingAdjId ? '調整項目を更新する' : '調整ボタンを新規登録'}
            </button>
          </form>
        </section>

{/* 3. 調整ボタン一覧（並び替え・編集機能） [cite: 2026-03-08] */}
        {adjCategories.map(cat => (
          <div key={cat.id} style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '15px', borderLeft: '5px solid #ef4444', paddingLeft: '12px', fontWeight: 'bold' }}>{cat.name}</h4>
            {adjustments.filter(a => a.category === cat.name).map((adj, idx, filteredList) => (
              <div key={adj.id} style={{ ...cardStyle, padding: '18px 25px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #feb2b2' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{adj.name}</div>
                  <div style={{ fontSize: '0.95rem', color: '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>
                    {adj.is_minus ? '－' : adj.is_percent ? '' : '＋'}{adj.price}{adj.is_percent ? '%' : '円'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* ✅ 修正：調整項目(adjustment)として、正しいID(adj.id)を渡します [cite: 2026-03-08] */}
                  <button 
                    onClick={() => moveItem('adjustment', filteredList, adj.id, 'up')} 
                    disabled={idx === 0} 
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    <ArrowUp size={20} />
                  </button>
                  <button 
                    onClick={() => moveItem('adjustment', filteredList, adj.id, 'down')} 
                    disabled={idx === filteredList.length - 1} 
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === filteredList.length - 1 ? 0.3 : 1, cursor: idx === filteredList.length - 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ArrowDown size={20} />
                  </button>
                  
<button 
  onClick={() => { 
    setEditingAdjId(adj.id); 
    setNewAdjName(adj.name); 
    setAdjValue(adj.price); 
    setSelectedAdjCat(adj.category); 
    // 🆕 フォームの位置までスクロール
    adjFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  }} 
  style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#3b82f6' }}
>
  <Edit2 size={20} />
</button>
                <button onClick={async () => { if(window.confirm('削除しますか？')) { await supabase.from('admin_adjustments').delete().eq('id', adj.id); fetchMenuDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#ef4444' }}><Trash2 size={20} /></button>
                </div>
              </div>
            ))}
          </div>
        ))}      </div>

    </div>
  );
};
const bizBtnStyle = (active, color) => ({
  flex: 1,
  padding: '10px',
  borderRadius: '10px',
  fontSize: '0.8rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  border: `2px solid ${active ? color : '#e2e8f0'}`,
  background: active ? color : '#fff',
  color: active ? '#fff' : '#64748b',
  transition: '0.2s'
});
export default MenuSettings;