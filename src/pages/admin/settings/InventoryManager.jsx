import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  PackageOpen, Minus, Plus, ArrowLeft, CheckCircle2, AlertCircle, Save, RotateCcw,
  ShoppingCart, Truck, ClipboardList, Search, Settings, Undo2, PackageMinus,
  Edit2, Trash2, ArrowUp, ArrowDown, Layers, Printer, Send, Building2, Wand2, Copy
} from 'lucide-react';

const fullPageWrapper = {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
  display: 'flex', flexDirection: 'column', background: '#f0f2f5', zIndex: 9999, overflow: 'hidden' 
};

// --- スタイル定義 ---
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };
const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };

const InventoryManager = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const prodFormRef = useRef(null);
  
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [activeView, setActiveView] = useState('dashboard'); 
  const [message, setMessage] = useState('');

  // --- ポチポチ消費用のState ---
  const [originalProducts, setOriginalProducts] = useState([]);
  const [localProducts, setLocalProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('業務用');

  // --- 商品マスター用のState (CheckoutSettingsから引っ越し) ---
  const [productCategories, setProductCategories] = useState([]); 
  const [newProdCatName, setNewProdCatName] = useState('');
  const [editingProdCatId, setEditingProdCatId] = useState(null);
  const [selectedProdCat, setSelectedProdCat] = useState('');
  
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [newUsageType, setNewUsageType] = useState('店販用'); 
  const [newProdStock, setNewProdStock] = useState(0);
  const [newReorderPoint, setNewReorderPoint] = useState(0); 
  const [newDefaultOrderQty, setNewDefaultOrderQty] = useState(1);
  const [newManufacturerName, setNewManufacturerName] = useState(''); // 🌟 追加：メーカー名
  const [editingProdId, setEditingProdId] = useState(null);
  
  // --- ディーラー（取引先）用のState ---
  const [dealers, setDealers] = useState([]);
  const [newDealerName, setNewDealerName] = useState('');
  const [editingDealerId, setEditingDealerId] = useState(null);
  const [selectedDealerId, setSelectedDealerId] = useState(''); // 商品登録用

  // --- 発注管理用のState ---
  const [pendingOrders, setPendingOrders] = useState([]);
  const [activeOrderTab, setActiveOrderTab] = useState('all'); // 👈 タブ切り替え用
  const [orderSortType, setOrderSortType] = useState('priority'); // 🌟 並べ替え用（デフォルトは発注優先）

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900;

  useEffect(() => {
    if (shopId) {
      fetchShopProfile();
      fetchMasterData();
    }
  }, [shopId]);

  const fetchShopProfile = async () => {
    const { data } = await supabase.from('profiles').select('theme_color').eq('id', shopId).single();
    if (data?.theme_color) setThemeColor(data.theme_color);
  };

  const fetchMasterData = async () => {
    const [catRes, prodRes, ordersRes, dealersRes] = await Promise.all([
      supabase.from('service_categories').select('*').eq('shop_id', shopId).eq('is_product_cat', true).order('sort_order'),
      supabase.from('products').select('*').eq('shop_id', shopId).order('sort_order'),
      supabase.from('orders').select('*, products(name, category, dealer_id)').eq('shop_id', shopId).eq('status', 'pending').order('created_at', { ascending: false }), // 👈 dealer_id を追加
      supabase.from('dealers').select('*').eq('shop_id', shopId).order('created_at', { ascending: true })
    ]);

    if (catRes.data) setProductCategories(catRes.data);
    if (dealersRes.data) setDealers(dealersRes.data); // 👈 新規追加
    if (prodRes.data) {
      setOriginalProducts(prodRes.data);
      setLocalProducts(JSON.parse(JSON.stringify(prodRes.data)));
    }
    if (ordersRes.data) {
      setPendingOrders(ordersRes.data);
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  // ==========================================
  // ディーラー（取引先）ロジック
  // ==========================================
  const handleDealerSubmit = async (e) => {
    e.preventDefault();
    if (editingDealerId) {
      await supabase.from('dealers').update({ name: newDealerName }).eq('id', editingDealerId);
      showMsg('取引先を更新しました');
    } else {
      await supabase.from('dealers').insert([{ shop_id: shopId, name: newDealerName }]);
      showMsg('取引先を登録しました');
    }
    setNewDealerName(''); setEditingDealerId(null); fetchMasterData();
  };

  // ==========================================
  // 1. ポチポチ消費のロジック
  // ==========================================
  const adjustStock = (productId, delta) => {
    setLocalProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: Math.max(0, (p.stock || 0) + delta) } : p));
  };
  const hasChanges = JSON.stringify(originalProducts) !== JSON.stringify(localProducts);

  // 🚀 🌟 ここが修正ポイント：shop_id をログに含めて送信する
  const handleSaveLogs = async () => {
    const logsToInsert = [];
    localProducts.forEach(localP => {
      const origP = originalProducts.find(p => p.id === localP.id);
      const diff = (localP.stock || 0) - (origP.stock || 0);
      if (diff !== 0) {
        logsToInsert.push({ 
          shop_id: shopId, // 👈 🌟 自分のshopIdを追加！
          product_id: localP.id, 
          change_amount: diff, 
          reason: diff < 0 ? (localP.usage_type === '業務用' ? '業務用開封' : '店頭使用・棚卸減') : '入庫・棚卸増' 
        });
      }
    });

    if (logsToInsert.length > 0) {
      const { error } = await supabase.from('inventory_logs').insert(logsToInsert);
      if (!error) {
        showMsg('在庫の変更を保存しました！✨');
        fetchMasterData();
      } else alert('エラーが発生しました。');
    }
  };

  // ==========================================
  // 2. 商品マスターのロジック (お引っ越し分)
  // ==========================================
  const moveItem = async (type, list, id, direction) => {
    const idx = list.findIndex(item => item.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const itemA = list[idx];
    const itemB = list[targetIdx];
    const table = type === 'category' ? 'service_categories' : 'products';

    try {
      const updates = [{ ...itemA, sort_order: itemB.sort_order }, { ...itemB, sort_order: itemA.sort_order }];
      const { error } = await supabase.from(table).upsert(updates);
      if (error) throw error;
      fetchMasterData();
    } catch (err) {
      alert("並び替えができませんでした。一度ページを更新してください。");
    }
  };

  const handleProdCatSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: newProdCatName, shop_id: shopId, is_product_cat: true };

    if (editingProdCatId) {
      const oldCat = productCategories.find(c => c.id === editingProdCatId);
      await supabase.from('service_categories').update(payload).eq('id', editingProdCatId);
      if (oldCat?.name && oldCat.name !== newProdCatName) {
        await supabase.from('products').update({ category: newProdCatName }).eq('shop_id', shopId).eq('category', oldCat.name);
      }
    } else {
      await supabase.from('service_categories').insert([{ ...payload, sort_order: productCategories.length }]);
    }
    setNewProdCatName(''); setEditingProdCatId(null); fetchMasterData(); showMsg('商品カテゴリを更新しました');
  };
  
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const finalCat = selectedProdCat || (productCategories[0]?.name || '未分類');
    const payload = { 
      shop_id: shopId, 
      category: finalCat, 
      name: newProdName, 
      price: Number(newProdPrice),
      usage_type: newUsageType, 
      stock: Number(newProdStock), 
      reorder_point: Number(newReorderPoint),
      default_order_quantity: Number(newDefaultOrderQty),
      dealer_id: selectedDealerId || null,
      manufacturer_name: newUsageType === '店販用' ? newManufacturerName : null // 🌟 店販用なら保存
    };
    
    let error = null;
    if (editingProdId) {
      const res = await supabase.from('products').update(payload).eq('id', editingProdId);
      error = res.error;
    } else {
      const res = await supabase.from('products').insert([{ ...payload, sort_order: originalProducts.length }]);
      error = res.error;
    }

    if (error) {
      console.error("Supabase Error:", error);
      alert(`保存に失敗しました: ${error.message}`);
      return; 
    }
    
    // 🌟 リセット処理に追加
    setNewProdName(''); setNewProdPrice(0); setNewUsageType('店販用'); setNewProdStock(0); setNewReorderPoint(0); setNewDefaultOrderQty(1); setSelectedDealerId(''); setNewManufacturerName(''); setEditingProdId(null); 
    fetchMasterData(); 
    showMsg(editingProdId ? '商品を更新しました' : '商品を新規登録しました');
  };

  // ==========================================
  // 3. 発注機能のロジック
  // ==========================================
  const handleOrderQuantityChange = async (productId, currentQty, delta, defaultQty, currentStock) => {
    const newQty = Math.max(0, currentQty + delta);
    if (newQty === currentQty) return;

    const existingOrder = pendingOrders.find(o => o.product_id === productId);

    if (newQty === 0 && existingOrder) {
      // 0になったら発注リストから削除
      setPendingOrders(prev => prev.filter(o => o.id !== existingOrder.id));
      await supabase.from('orders').delete().eq('id', existingOrder.id);
    } else if (newQty > 0 && !existingOrder) {
      // 🌟 スマート発注計算：(デフォルト発注数 - 現在庫数)
      let smartQty = (defaultQty || 1) - (currentStock || 0);
      smartQty = Math.max(1, smartQty); // マイナスや0になる場合は、最低「1」にする

      const insertQty = currentQty === 0 && delta > 0 ? smartQty : newQty;
      const tempId = 'temp-' + Date.now();
      const productInfo = originalProducts.find(p => p.id === productId);
      
      // UIを即座に更新してサクサク動かす
      setPendingOrders(prev => [...prev, { id: tempId, product_id: productId, quantity: insertQty, products: productInfo }]);

      const { data } = await supabase.from('orders').insert([{ 
        shop_id: shopId, product_id: productId, quantity: insertQty, status: 'pending' 
      }]).select('*, products(name, category, dealer_id)').single();
      
      if (data) {
        setPendingOrders(prev => prev.map(o => o.id === tempId ? data : o));
      }
    } else if (newQty > 0 && existingOrder) {
      // 既存の数の更新
      setPendingOrders(prev => prev.map(o => o.id === existingOrder.id ? { ...o, quantity: newQty } : o));
      await supabase.from('orders').update({ quantity: newQty }).eq('id', existingOrder.id);
    }
  };

  const handleDeleteOrder = async (productId) => {
    const existingOrder = pendingOrders.find(o => o.product_id === productId);
    if (!existingOrder) return;
    if (!window.confirm('発注数を0にしてリストから除外しますか？')) return;
    
    setPendingOrders(prev => prev.filter(o => o.id !== existingOrder.id));
    await supabase.from('orders').delete().eq('id', existingOrder.id);
    showMsg('発注リストから除外しました');
  };

  // ==========================================
  // 🌟 追加：魔法の一括操作ロジック
  // ==========================================
  const handleSetAllDefault = async () => {
    const targetProducts = originalProducts.filter(p => activeOrderTab === 'all' ? true : activeOrderTab === 'unspecified' ? !p.dealer_id : p.dealer_id === activeOrderTab);
    if (targetProducts.length === 0) return;
    if (!window.confirm('表示中の全商品を「デフォルト発注数 - 現在庫数」で一括追加しますか？')) return;

    const targetProductIds = targetProducts.map(p => p.id);

    // 1. 一旦、対象商品の既存のオーダーをクリア
    await supabase.from('orders').delete().eq('shop_id', shopId).eq('status', 'pending').in('product_id', targetProductIds);

    // 2. 全商品に対してスマート計算を行い、インサートデータを作成
    const insertData = [];
    targetProducts.forEach(p => {
      let smartQty = (p.default_order_quantity || 1) - (p.stock || 0);
      // 🌟 修正：在庫が目標に達していない（プラスになる）場合のみ追加する
      if (smartQty > 0) {
        insertData.push({ shop_id: shopId, product_id: p.id, quantity: smartQty, status: 'pending' });
      }
    });

    // 3. 一気に保存して再読み込み
    if (insertData.length > 0) {
      await supabase.from('orders').insert(insertData);
    }
    fetchMasterData();
    showMsg('一括で必要数に設定しました✨');
  };

  const handleResetToReorderPoint = async () => {
    const targetProducts = originalProducts.filter(p => activeOrderTab === 'all' ? true : activeOrderTab === 'unspecified' ? !p.dealer_id : p.dealer_id === activeOrderTab);
    if (targetProducts.length === 0) return;
    if (!window.confirm('本来のルール（発注点に達しているもののみ）にリセットしますか？')) return;

    const targetProductIds = targetProducts.map(p => p.id);

    // 1. 一旦、対象商品の既存のオーダーをクリア
    await supabase.from('orders').delete().eq('shop_id', shopId).eq('status', 'pending').in('product_id', targetProductIds);

    // 2. 発注点以下のものだけを抽出し、スマート計算でインサートデータを作成
    const insertData = [];
    targetProducts.forEach(p => {
      if ((p.stock || 0) <= (p.reorder_point || 0)) {
        let smartQty = (p.default_order_quantity || 1) - (p.stock || 0);
        insertData.push({ shop_id: shopId, product_id: p.id, quantity: Math.max(1, smartQty), status: 'pending' });
      }
    });

    // 3. 保存して再読み込み
    if (insertData.length > 0) await supabase.from('orders').insert(insertData);
    fetchMasterData();
    showMsg('発注点ルールにリセットしました♻️');
  };

  // ==========================================
  // 🌟 追加：LINE用テキスト自動生成＆コピー機能
  // ==========================================
  const handleCopyOrderText = async () => {
    const targetProducts = originalProducts.filter(p => activeOrderTab === 'all' ? true : activeOrderTab === 'unspecified' ? !p.dealer_id : p.dealer_id === activeOrderTab);
    
    // 発注数が1以上のものだけを抽出
    const orderItems = targetProducts.map(p => {
      const order = pendingOrders.find(o => o.product_id === p.id);
      return { product: p, qty: order ? order.quantity : 0 };
    }).filter(item => item.qty > 0);

    if (orderItems.length === 0) {
      alert('発注する商品がありません。');
      return;
    }

    // カテゴリ（メーカー名があればメーカー名優先）でグループ化
    const grouped = {};
    orderItems.forEach(({ product, qty }) => {
      const catName = product.manufacturer_name || product.category || '未分類';
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push({ name: product.name, qty });
    });

    const dealerName = activeOrderTab === 'all' ? '各取引先' : activeOrderTab === 'unspecified' ? '指定なし' : dealers.find(d => d.id === activeOrderTab)?.name;
    let text = `お世話になっております。\n以下の発注をお願いいたします。\n\n【発注先：${dealerName} 御中】\n\n`;

    Object.keys(grouped).forEach(cat => {
      text += `【${cat}】\n`;
      grouped[cat].forEach(item => {
        text += `・${item.name} × ${item.qty}\n`;
      });
      text += `\n`;
    });
    text += `よろしくお願いいたします。`;

    try {
      await navigator.clipboard.writeText(text);
      showMsg('発注テキストをコピーしました！📋LINEに貼り付けてください。');
    } catch (err) {
      alert('コピーに失敗しました。');
    }
  };

  const handleFinalizeOrders = async () => {
    // 👈 現在開いているタブ（ディーラー）の注文だけを抽出
    const targetOrders = pendingOrders.filter(order => {
      if (activeOrderTab === 'all') return true;
      if (activeOrderTab === 'unspecified') return !order.products?.dealer_id;
      return order.products?.dealer_id === activeOrderTab;
    });

    if (targetOrders.length === 0) return;

    // 👈 確認メッセージを分かりやすく
    const dealerName = activeOrderTab === 'all' ? 'すべての' : 
                       activeOrderTab === 'unspecified' ? '指定なしの' : 
                       dealers.find(d => d.id === activeOrderTab)?.name + '宛ての';

    if (!window.confirm(`${dealerName}発注（計 ${targetOrders.length} 件）を確定済みにしますか？`)) return;

    const idsToUpdate = targetOrders.map(o => o.id);
    const { error } = await supabase.from('orders')
      .update({ status: 'ordered', ordered_at: new Date().toISOString() })
      .in('id', idsToUpdate)
      .eq('shop_id', shopId);

    if (!error) {
      showMsg('発注を確定しました！✨');
      fetchMasterData(); // リストを再取得して空にする
    } else {
      alert('エラーが発生しました。');
    }
  };

  return (
    <div style={fullPageWrapper} translate="no" className="notranslate">
      
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 10001, textAlign: 'center', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {message}
        </div>
      )}

      {/* 🚀 ヘッダー */}
      <div style={{ 
        background: '#0ea5e9', 
        padding: isPC ? '15px 25px' : '10px 15px', 
        color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={() => {
              if (activeView === 'consume' && hasChanges) {
                if (!window.confirm('未保存の変更があります。破棄して戻りますか？')) return;
                setLocalProducts(JSON.parse(JSON.stringify(originalProducts)));
              }
              if (activeView !== 'dashboard') setActiveView('dashboard');
              else navigate(-1); 
            }} 
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '8px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 style={{ margin: 0, fontStyle: 'italic', fontSize: isPC ? '1.4rem' : '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PackageOpen size={24} /> 在庫管理システム
          </h2>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: isPC ? '30px' : '15px', paddingLeft: isPC ? '40px' : '15px', paddingRight: isPC ? '40px' : '15px', paddingBottom: '120px' }}>
        
        {/* ==========================================
            🏠 ビュー1：総合ダッシュボード（トップ画面）
            ========================================== */}
        {activeView === 'dashboard' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            {isPC && <p style={{ color: '#64748b', fontSize: '1rem', marginTop: 0, marginBottom: '25px', fontWeight: 'bold' }}>美容室の商材・店販を管理する総合メニュー</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', alignItems: 'start' }}>

              {/* --- 📦 カテゴリ1：払出 --- */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ background: '#f59e0b', color: '#fff', padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '2px' }}>払 出 (消費)</div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => setActiveView('consume')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#f59e0b'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <PackageMinus size={20} color="#f59e0b" /> 払出入力 (ポチポチ)
                  </button>
                </div>
              </div>

              {/* --- 🚚 カテゴリ2：発注 --- */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ background: '#3b82f6', color: '#fff', padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '2px' }}>発 注</div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => setActiveView('order')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <ShoppingCart size={20} color="#3b82f6" /> 発注入力
                  </button>
                  <button onClick={() => alert('🚧 開発中')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }}>
                    <ClipboardList size={20} color="#94a3b8" /> 発注リスト印刷
                  </button>
                </div>
              </div>

              {/* --- 📦 カテゴリ3：仕入 --- */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ background: '#10b981', color: '#fff', padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '2px' }}>仕 入 (入庫)</div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => alert('🚧 開発中')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#10b981'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <Truck size={20} color="#10b981" /> 仕入入力
                  </button>
                  <button onClick={() => alert('🚧 開発中')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }}>
                    <ClipboardList size={20} color="#94a3b8" /> 仕入修正・履歴
                  </button>
                </div>
              </div>

              {/* --- ↩️ カテゴリ4：返品 --- */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ background: '#ef4444', color: '#fff', padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '2px' }}>返 品</div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => alert('🚧 開発中')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#ef4444'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <Undo2 size={20} color="#ef4444" /> 返品入力
                  </button>
                </div>
              </div>

              {/* --- 📋 カテゴリ5：棚卸 --- */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ background: '#ec4899', color: '#fff', padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '2px' }}>棚 卸</div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => alert('🚧 開発中')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#ec4899'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <ClipboardList size={20} color="#ec4899" /> 月末棚卸処理
                  </button>
                </div>
              </div>

              {/* --- 🔍 カテゴリ6：在庫照会 --- */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ background: '#8b5cf6', color: '#fff', padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '2px' }}>在庫照会</div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => alert('🚧 開発中')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#8b5cf6'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <Search size={20} color="#8b5cf6" /> 在庫照会
                  </button>
                  <button onClick={() => alert('🚧 開発中')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }}>
                    <ClipboardList size={20} color="#94a3b8" /> 在庫リスト印刷
                  </button>
                </div>
              </div>

              {/* --- ⚙️ カテゴリ7：マスター設定 --- */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ background: '#64748b', color: '#fff', padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '2px' }}>マスター設定</div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => setActiveView('master')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#64748b'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <Settings size={20} color="#64748b" /> 商品マスター登録
                  </button>
                  <button onClick={() => setActiveView('dealers')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#64748b'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <Building2 size={20} color="#64748b" /> 取引先(ディーラー)
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==========================================
            📦 ビュー2：払出（ポチポチ消費）画面
            ========================================== */}
        {activeView === 'consume' && (
          <div style={{ animation: 'fadeIn 0.3s', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
              {['業務用', '店販用'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s', background: activeTab === tab ? '#f59e0b' : '#fff', color: activeTab === tab ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
              {localProducts.filter(p => p.usage_type === activeTab).map(p => {
                const origP = originalProducts.find(op => op.id === p.id);
                const diff = (p.stock || 0) - (origP?.stock || 0);
                const isLowStock = p.stock <= p.reorder_point; 
                
                return (
                  <div key={p.id} style={{ background: '#fff', border: diff !== 0 ? `2px solid #f59e0b` : (isLowStock ? '2px solid #ef4444' : '1px solid #e2e8f0'), borderRadius: '16px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: '0.2s' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>{p.category}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>{p.name}</div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>現在庫:</span>
                          <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: isLowStock && diff === 0 ? '#ef4444' : '#1e293b' }}>{p.stock || 0}</span>
                          {isLowStock && <AlertCircle size={18} color="#ef4444" title="発注点を下回っています" />}
                        </div>
                        {diff !== 0 && (
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: diff < 0 ? '#ef4444' : '#10b981', background: diff < 0 ? '#fee2e2' : '#dcfce7', padding: '4px 8px', borderRadius: '8px' }}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button onClick={() => adjustStock(p.id, -1)} style={{ flex: 1.5, padding: '14px', background: '#fffbeb', border: '2px solid #fde68a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#b45309', fontWeight: 'bold', cursor: 'pointer' }}>
                        <Minus size={20} /> 開封 (-1)
                      </button>
                      <button onClick={() => adjustStock(p.id, 1)} style={{ flex: 1, padding: '14px', background: '#fff', border: '2px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>
                        <Plus size={20} /> (+1)
                      </button>
                    </div>
                  </div>
                );
              })}
              {localProducts.filter(p => p.usage_type === activeTab).length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  登録されている{activeTab}商品がありません。<br/>マスター設定から追加してください。
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            📝 ここに新しい「ビュー: 発注 (order)」を追加します
            ========================================== */}
        {activeView === 'order' && (
          <div style={{ animation: 'fadeIn 0.3s', maxWidth: '900px', margin: '0 auto' }}>
            <style>{`
              @media print {
                body * { visibility: hidden; }
                #print-area, #print-area * { visibility: visible; }
                #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
                .no-print { display: none !important; }
              }
            `}</style>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.4rem', color: '#1e293b', margin: 0, fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={24} color="#3b82f6" /> 発注待ちリスト
              </h2>
              {/* 🌟 変更：ボタンを束ねるdivを作り、一括操作ボタンを追加 */}
              <div style={{ display: 'flex', gap: '10px' }} className="no-print">
                <button onClick={handleSetAllDefault} style={{ padding: '10px 16px', background: '#e0f2fe', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#0369a1' }}>
                  <Wand2 size={18} /> デフォルト発注数にする
                </button>
                <button onClick={handleResetToReorderPoint} style={{ padding: '10px 16px', background: '#fee2e2', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#b91c1c' }}>
                  <RotateCcw size={18} /> リセット
                </button>
                {/* 🌟 追加：テキストコピーボタン */}
                <button onClick={handleCopyOrderText} style={{ padding: '10px 16px', background: '#ecfdf5', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#059669' }}>
                  <Copy size={18} /> LINE・メール用にコピー
                </button>
                <button onClick={() => window.print()} style={{ padding: '10px 16px', background: '#fff', border: '2px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#64748b' }}>
                  <Printer size={18} /> PDF出力 / 印刷
                </button>
              </div>
            </div>

            {/* 🌟 追加：タブ切り替えメニュー */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }} className="no-print">
              <button onClick={() => setActiveOrderTab('all')} style={{ flexShrink: 0, padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s', background: activeOrderTab === 'all' ? '#3b82f6' : '#fff', color: activeOrderTab === 'all' ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                すべて ({pendingOrders.length})
              </button>
              
              {dealers.map(d => {
                const count = pendingOrders.filter(o => o.products?.dealer_id === d.id).length;
                if (count === 0 && activeOrderTab !== d.id) return null; // 件数0のディーラーは非表示にしてスッキリ
                return (
                  <button key={d.id} onClick={() => setActiveOrderTab(d.id)} style={{ flexShrink: 0, padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s', background: activeOrderTab === d.id ? '#3b82f6' : '#fff', color: activeOrderTab === d.id ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    {d.name} ({count})
                  </button>
                );
              })}

              {pendingOrders.some(o => !o.products?.dealer_id) && (
                <button onClick={() => setActiveOrderTab('unspecified')} style={{ flexShrink: 0, padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s', background: activeOrderTab === 'unspecified' ? '#3b82f6' : '#fff', color: activeOrderTab === 'unspecified' ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  指定なし ({pendingOrders.filter(o => !o.products?.dealer_id).length})
                </button>
              )}
            </div>

            {/* 🌟 追加：並べ替えドロップダウン */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }} className="no-print">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>並べ替え:</span>
                <select 
                  value={orderSortType} 
                  onChange={(e) => setOrderSortType(e.target.value)} 
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontWeight: 'bold', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="priority">発注優先 (発注数アリを上へ)</option>
                  <option value="category">カテゴリ別 (あいうえお順)</option>
                  <option value="name">あいうえお順</option>
                </select>
              </div>
            </div>

            <div id="print-area" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '2px solid #e2e8f0', display: 'none' }} className="print-header">
                <h2 style={{ margin: '0 0 10px 0' }}>発注書</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
                    宛先: {activeOrderTab === 'all' ? '（全取引先）' : activeOrderTab === 'unspecified' ? '（指定なし）' : dealers.find(d => d.id === activeOrderTab)?.name || ''} 御中
                  </p>
                  <p style={{ margin: 0 }}>発注日: {new Date().toLocaleDateString('ja-JP')}</p>
                </div>
              </div>

              {(() => {
                // 対象タブの「全商品」を抽出
                let displayProducts = originalProducts.filter(p => activeOrderTab === 'all' ? true : activeOrderTab === 'unspecified' ? !p.dealer_id : p.dealer_id === activeOrderTab);
                
                // 🌟 追加：並べ替えロジック
                displayProducts = [...displayProducts].sort((a, b) => {
                  const hasOrderA = pendingOrders.some(o => o.product_id === a.id && o.quantity > 0) ? 1 : 0;
                  const hasOrderB = pendingOrders.some(o => o.product_id === b.id && o.quantity > 0) ? 1 : 0;
                  
                  const catCompare = (a.category || '').localeCompare(b.category || '', 'ja');
                  const nameCompare = (a.name || '').localeCompare(b.name || '', 'ja');

                  if (orderSortType === 'name') {
                    return nameCompare;
                  } else if (orderSortType === 'category') {
                    if (catCompare !== 0) return catCompare;
                    return nameCompare;
                  } else if (orderSortType === 'priority') {
                    // 発注数が1以上のものを強制的に上にする
                    if (hasOrderA !== hasOrderB) return hasOrderB - hasOrderA;
                    // 発注アリ同士（またはナシ同士）の場合は、カテゴリ別あいうえお順
                    if (catCompare !== 0) return catCompare;
                    return nameCompare;
                  }
                  return 0;
                });

                if (displayProducts.length === 0) {
                  return (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      <PackageOpen size={48} style={{ opacity: 0.5, marginBottom: '10px' }} /><br/>
                      この取引先に紐づいている商品はありません。<br/>マスター設定から商品と取引先を紐づけてください。
                    </div>
                  );
                }

                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.9rem' }}>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>商品名 / カテゴリ</th>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }} className="no-print">在庫状況</th>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>発注数</th>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }} className="no-print">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayProducts.map(product => {
                          // この商品に対する発注データがあるか探す
                          const order = pendingOrders.find(o => o.product_id === product.id);
                          const orderQty = order ? order.quantity : 0;
                          const isLowStock = product.stock <= product.reorder_point;
                          const hasOrder = orderQty > 0;

                          return (
                            <tr key={product.id} className={!hasOrder ? 'no-print' : ''} style={{ borderBottom: '1px solid #e2e8f0', background: hasOrder ? '#f0f9ff' : '#fff', transition: '0.2s' }}>
                              <td style={{ padding: '16px' }}>
                                <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1rem' }}>{product.name}</div>
                                {/* 🌟 変更：メーカー名があればそれを表示 */}
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                  {product.manufacturer_name ? `${product.manufacturer_name} (${product.category})` : product.category}
                                </div>
                              </td>
                              
                              <td style={{ padding: '16px' }} className="no-print">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isLowStock ? '#ef4444' : '#1e293b' }}>
                                    現在庫: {product.stock || 0}
                                    {isLowStock && <AlertCircle size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} />}
                                  </span>
                                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>発注点: {product.reorder_point || 0}</span>
                                  {/* 🌟 追加：デフォルト発注数の表示 */}
                                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>ﾃﾞﾌｫﾙﾄ発注数: {product.default_order_quantity || 1}</span>
                                </div>
                              </td>

                              <td style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: hasOrder ? '#3b82f6' : '#cbd5e1' }}>{orderQty}</span>
                                  <div className="no-print" style={{ display: 'flex', gap: '4px' }}>
                                    {/* 🌟 賢いスマート計算用に product.stock を引数に追加 */}
                                    <button onClick={() => handleOrderQuantityChange(product.id, orderQty, -1, product.default_order_quantity, product.stock)} disabled={!hasOrder} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: hasOrder ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasOrder ? '#64748b' : '#cbd5e1' }}><Minus size={16} /></button>
                                    <button onClick={() => handleOrderQuantityChange(product.id, orderQty, 1, product.default_order_quantity, product.stock)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><Plus size={16} /></button>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '16px' }} className="no-print">
                                {hasOrder && (
                                  <button onClick={() => handleDeleteOrder(product.id)} style={{ padding: '8px', background: '#fee2e2', border: 'none', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }} title="発注リストから除外">
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ==========================================
            🏢 ビュー：取引先（ディーラー）管理
            ========================================== */}
        {activeView === 'dealers' && (
          <div style={{ animation: 'fadeIn 0.3s', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.4rem', color: '#1e293b', margin: '0 0 20px 0', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={24} color="#64748b" /> 取引先（ディーラー）管理
            </h2>
            
            <section style={{ ...cardStyle, background: '#f8fafc', border: '2px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                <Plus size={18} /> 取引先の登録
              </h3>
              <form onSubmit={handleDealerSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <input placeholder="例：〇〇ビューティサプライ" value={newDealerName} onChange={(e) => setNewDealerName(e.target.value)} style={inputStyle} required />
                <button type="submit" style={{ padding: '0 25px', background: '#64748b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {editingDealerId ? '更新' : '＋作成'}
                </button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dealers.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>{d.name}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => { setEditingDealerId(d.id); setNewDealerName(d.name); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}><Edit2 size={16} /></button>
                      <button onClick={async () => { if(window.confirm('削除しますか？紐づく商品からは取引先が解除されます。')){ await supabase.from('dealers').delete().eq('id', d.id); fetchMasterData(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
                {dealers.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>登録されている取引先はありません</p>}
              </div>
            </section>
          </div>
        )}

        {/* ==========================================
            ⚙️ ビュー3：商品マスター登録
            ========================================== */}
        {activeView === 'master' && (
          <div style={{ animation: 'fadeIn 0.3s', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.4rem', color: '#1e293b', margin: '0 0 20px 0', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={24} color="#64748b" /> 商品マスター管理
            </h2>

            {/* カテゴリ作成 */}
            <section style={{ ...cardStyle, background: '#f8fafc', border: '2px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Layers size={18} /> 商品カテゴリの作成</h3>
              <form onSubmit={handleProdCatSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <input placeholder="例：カラー剤, シャンプー" value={newProdCatName} onChange={(e) => setNewProdCatName(e.target.value)} style={inputStyle} required />
                <button type="submit" style={{ padding: '0 25px', background: '#64748b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{editingProdCatId ? '更新' : '＋作成'}</button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {productCategories.map((c, idx) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>{c.name}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => moveItem('category', productCategories, c.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={16} /></button>
                      <button onClick={() => moveItem('category', productCategories, c.id, 'down')} disabled={idx === productCategories.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === productCategories.length - 1 ? 0.3 : 1 }}><ArrowDown size={16} /></button>
                      <button onClick={() => { setEditingProdCatId(c.id); setNewProdCatName(c.name); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}><Edit2 size={16} /></button>
                      <button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('products').delete().eq('category', c.name); await supabase.from('service_categories').delete().eq('id', c.id); fetchMasterData(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 商品の新規登録 */}
            <section ref={prodFormRef} style={{ ...cardStyle, border: '2px solid #64748b' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Plus size={20} /> 商品の登録・編集</h3>
              <form onSubmit={handleProductSubmit}>
                
                {/* 1段目：カテゴリ、メーカー名（店販時のみ）、取引先 */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>所属カテゴリ</label>
                    <select value={selectedProdCat} onChange={(e) => setSelectedProdCat(e.target.value)} style={inputStyle} required>
                      <option value="">-- カテゴリを選択 --</option>
                      {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* 🌟 追加：店販用の時だけメーカー名入力を表示 */}
                  {newUsageType === '店販用' && (
                    <div style={{ flex: 1, animation: 'fadeIn 0.3s' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>ﾒｰｶｰ名(発注書用)</label>
                      <input placeholder="例: FIOLE" value={newManufacturerName} onChange={(e) => setNewManufacturerName(e.target.value)} style={inputStyle} />
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>取引先（ディーラー）</label>
                    <select value={selectedDealerId} onChange={(e) => setSelectedDealerId(e.target.value)} style={inputStyle}>
                      <option value="">-- 指定なし --</option>
                      {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                
                {/* 2段目：商品名、価格 */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>商品名</label>
                    <input placeholder="商品名" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} style={inputStyle} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>販売価格（店販のみ）</label>
                    <input type="number" placeholder="金額" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                {/* 3段目：用途、現在庫数、発注点、デフォルト発注数 */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>用途</label>
                    <select value={newUsageType} onChange={(e) => setNewUsageType(e.target.value)} style={inputStyle}>
                      <option value="店販用">店販用</option>
                      <option value="業務用">業務用</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>現在庫数</label>
                    <input type="number" placeholder="0" value={newProdStock} onChange={(e) => setNewProdStock(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>発注点</label>
                    <input type="number" placeholder="例: 3" value={newReorderPoint} onChange={(e) => setNewReorderPoint(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>ﾃﾞﾌｫﾙﾄ発注数</label>
                    <input type="number" placeholder="例: 6" value={newDefaultOrderQty} onChange={(e) => setNewDefaultOrderQty(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <button type="submit" style={{ width: '100%', padding: '16px', background: '#64748b', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                  {editingProdId ? '商品を更新する' : '商品を新規登録'}
                </button>
              </form>
            </section>

            {/* 登録済み商品リスト */}
            {productCategories.map(cat => (
              <div key={cat.id} style={{ marginBottom: '30px' }}>
                <h4 style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '15px', borderLeft: '5px solid #64748b', paddingLeft: '12px', fontWeight: 'bold' }}>{cat.name}</h4>
                {originalProducts.filter(p => p.category === cat.name).map((p, idx, filteredList) => (
                  <div key={p.id} style={{ ...cardStyle, padding: '18px 25px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', background: p.usage_type === '業務用' ? '#f59e0b' : '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {p.usage_type || '店販用'}
                        </span>
                        <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{p.name}</div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px', display: 'flex', gap: '12px', fontWeight: 'bold' }}>
                        <span style={{ color: '#008000' }}>💰 ¥{(p.price || 0).toLocaleString()}</span>
                        <span>📦 在庫: {p.stock || 0}</span>
                        <span>⚠️ 発注点: {p.reorder_point || 0}</span>
                        <span>🛒 デフォルト発注数: {p.default_order_quantity || 1}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => moveItem('product', filteredList, p.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={20} /></button>
                      <button onClick={() => moveItem('product', filteredList, p.id, 'down')} disabled={idx === filteredList.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === filteredList.length - 1 ? 0.3 : 1 }}><ArrowDown size={20} /></button>
                      <button onClick={() => { 
                        setEditingProdId(p.id); setNewProdName(p.name); setNewProdPrice(p.price); 
                        setSelectedProdCat(p.category); setNewUsageType(p.usage_type || '店販用');
                        setNewProdStock(p.stock || 0); setNewReorderPoint(p.reorder_point || 0); 
                        setNewDefaultOrderQty(p.default_order_quantity || 1);
                        setSelectedDealerId(p.dealer_id || '');
                        setNewManufacturerName(p.manufacturer_name || ''); // 🌟 追加：メーカー名をフォームにセットする！
                        prodFormRef.current?.scrollIntoView({ behavior: 'smooth' }); 
                      }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#3b82f6' }}><Edit2 size={20} /></button>
                      <button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('products').delete().eq('id', p.id); fetchMasterData(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#ef4444' }}><Trash2 size={20} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* 🛑 払出画面専用 フッター（保存ボタン等） */}
      {activeView === 'consume' && (
        <>
          <style>{`@keyframes pulse-orange { 0% { box-shadow: 0 4px 15px rgba(245,158,11,0.4); } 50% { box-shadow: 0 4px 25px rgba(245,158,11,0.7); } 100% { box-shadow: 0 4px 15px rgba(245,158,11,0.4); } }`}</style>
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: isPC ? '15px 20px' : '10px 15px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', zIndex: 1000 }}>
            <div style={isPC ? { maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center' } : { display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
              
              {hasChanges && (
                <button onClick={() => setLocalProducts(JSON.parse(JSON.stringify(originalProducts)))} style={isPC ? { flex: '0 0 auto', padding: '15px 20px', background: '#fff', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' } : { flex: 1, padding: '10px 0', background: '#fff', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}>
                  <RotateCcw size={isPC ? 18 : 20} />
                  <span style={isPC ? {} : { fontSize: '0.75rem', fontWeight: 'bold' }}>リセット</span>
                </button>
              )}

              <button onClick={handleSaveLogs} disabled={!hasChanges} style={{ 
                flex: 1, padding: isPC ? '15px' : '10px 0', border: 'none', borderRadius: '12px', 
                display: 'flex', flexDirection: isPC ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: '0.3s',
                background: hasChanges ? '#f59e0b' : '#cbd5e1', color: '#fff', cursor: hasChanges ? 'pointer' : 'not-allowed', 
                animation: hasChanges ? 'pulse-orange 2s infinite' : 'none' 
              }}>
                <Save size={20} />
                <span style={{ fontSize: isPC ? '1rem' : '0.85rem', fontWeight: 'bold' }}>{hasChanges ? '変更を確定する' : '変更はありません'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 🛑 発注画面専用 フッター */}
      {activeView === 'order' && pendingOrders.length > 0 && (
        <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: isPC ? '15px 20px' : '10px 15px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', zIndex: 1000 }}>
          <div style={isPC ? { maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' } : { display: 'flex', width: '100%' }}>
            <button onClick={handleFinalizeOrders} style={{ flex: isPC ? '0 0 300px' : 1, padding: '15px', border: 'none', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s', background: '#3b82f6', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}>
              <Send size={20} />
              <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>発注を確定する</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default InventoryManager;