import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  PackageOpen, Minus, Plus, ArrowLeft, CheckCircle2, AlertCircle, Save, RotateCcw,
  ShoppingCart, Truck, ClipboardList, Search, Settings, Undo2, PackageMinus,
  Edit2, Trash2, ArrowUp, ArrowDown, Layers, Printer, Send, Building2, Wand2, Copy,
  HelpCircle // 🌟 追加
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
  const [newCostPrice, setNewCostPrice] = useState(0); // 🌟 追加：仕入価格
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
  const [activeOrderTab, setActiveOrderTab] = useState(''); // 🌟 'all'を廃止し、後で初期化
  const [orderSortType, setOrderSortType] = useState('priority');

  // ▼▼▼ 追加：仕入・入庫管理用のState ▼▼▼
  const [orderedItems, setOrderedItems] = useState([]);
  const [activeReceiveTab, setActiveReceiveTab] = useState('');
  const [receiveLogs, setReceiveLogs] = useState([]);
  
  // 🌟🌟🌟 追加：履歴アコーディオン＆分析用State
  const [historyViewTab, setHistoryViewTab] = useState('list'); // 'list' または 'analytics'
  const [expandedMonths, setExpandedMonths] = useState([]); // 開いている月の管理
  const [analyticsPeriod, setAnalyticsPeriod] = useState('month'); // 'month', 'year', 'all'
  
  // 🌟🌟🌟 追加：分納・一部入庫用のState
  const [receiveInputs, setReceiveInputs] = useState({}); // { product_id: 今回入庫する数 }
  
  const [showHelpModal, setShowHelpModal] = useState(false); // 🌟 追加：使い方ガイド用
  // ▲▲▲ ここまで ▲▲▲

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
      // 🌟変更： pending(発注待ち)だけでなく、ordered(発注済み=入庫待ち)も取得するように in を使用
      supabase.from('orders').select('*, products(name, category, dealer_id)').eq('shop_id', shopId).in('status', ['pending', 'ordered']).order('created_at', { ascending: false }), 
      supabase.from('dealers').select('*').eq('shop_id', shopId).order('created_at', { ascending: true })
    ]);

    if (catRes.data) setProductCategories(catRes.data);
    if (dealersRes.data) {
      setDealers(dealersRes.data);
      
      // 発注画面のタブ初期化
      setActiveOrderTab(prevTab => {
        if (prevTab === 'all' || prevTab === '') {
          return dealersRes.data.length > 0 ? dealersRes.data[0].id : 'unspecified';
        }
        return prevTab;
      });

      // 🌟 追加：入庫画面のタブも最初のディーラーで初期化
      setActiveReceiveTab(prevTab => {
        if (prevTab === 'all' || prevTab === '') {
          return dealersRes.data.length > 0 ? dealersRes.data[0].id : 'unspecified';
        }
        return prevTab;
      });
    }
    if (prodRes.data) {
      setOriginalProducts(prodRes.data);
      setLocalProducts(JSON.parse(JSON.stringify(prodRes.data)));
    }
    if (ordersRes.data) {
      // 🌟変更：取得したデータをステータスごとに分けてStateにセット
      setPendingOrders(ordersRes.data.filter(o => o.status === 'pending'));
      setOrderedItems(ordersRes.data.filter(o => o.status === 'ordered'));
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
      cost_price: Number(newCostPrice), // 🌟 追加
      price: newUsageType === '店販用' ? Number(newProdPrice) : 0, // 業務用なら強制的に0にする
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
    setNewProdName(''); setNewCostPrice(0); setNewProdPrice(0); setNewUsageType('店販用'); setNewProdStock(0); setNewReorderPoint(0); setNewDefaultOrderQty(1); setSelectedDealerId(''); setNewManufacturerName(''); setEditingProdId(null);
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
      setPendingOrders(prev => prev.filter(o => o.id !== existingOrder.id));
      await supabase.from('orders').delete().eq('id', existingOrder.id);
    } else if (newQty > 0 && !existingOrder) {
      // 🌟 修正3：すでに入庫待ちがあるかチェック
      const isAlreadyOrdered = orderedItems.some(o => o.product_id === productId);
      
      // 🌟 修正4：入庫待ちがなく、初めて「＋」を押した時だけスマート計算。それ以外は普通に「1」追加する
      let insertQty = newQty;
      if (!isAlreadyOrdered && currentQty === 0 && delta > 0) {
        let smartQty = (defaultQty || 1) - (currentStock || 0);
        insertQty = Math.max(1, smartQty);
      }

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
  // 🌟 「デフォルト発注数にする」関数は廃止しました

  // ▼▼▼ 追加：発注画面へ行くときの自動同期（オートシンク）ロジック ▼▼▼
  const handleGoToOrder = async () => {
    setActiveView('order'); 
    
    let hasChanges = false;
    const ordersToInsert = [];
    const ordersToUpdate = []; // 🌟 追加：補正用
    const ordersToDelete = []; // 🌟 追加：削除用

    originalProducts.forEach(p => {
      const incomingQty = orderedItems.filter(o => o.product_id === p.id).reduce((sum, o) => sum + o.quantity, 0);
      if (incomingQty > 0) return; 

      const existingPending = pendingOrders.find(o => o.product_id === p.id);
      let smartQty = (p.default_order_quantity || 1) - (p.stock || 0);
      
      if (smartQty > 0) {
        if (!existingPending) {
          // リストにない場合は賢い計算（デフォルト-現在庫）で新規追加
          ordersToInsert.push({ shop_id: shopId, product_id: p.id, quantity: smartQty, status: 'pending' });
          hasChanges = true;
        } else {
          // 🌟 修正：裏側のDBトリガーが「デフォルト発注数」で勝手に作ってしまったデータを検知して補正する
          // （発注数がデフォルト数そのままで、本来の賢い数と違う場合のみ上書き。手動で微調整した数字は尊重します）
          if (existingPending.quantity === p.default_order_quantity && existingPending.quantity !== smartQty) {
            ordersToUpdate.push({ id: existingPending.id, quantity: smartQty });
            hasChanges = true;
          }
        }
      } else if (existingPending) {
        // 🌟 追加：在庫が足りているのにDBトリガーが勝手に作ってしまった不要な注文は削除
        ordersToDelete.push(existingPending.id);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      if (ordersToInsert.length > 0) await supabase.from('orders').insert(ordersToInsert);
      for (const up of ordersToUpdate) {
        await supabase.from('orders').update({ quantity: up.quantity }).eq('id', up.id);
      }
      if (ordersToDelete.length > 0) await supabase.from('orders').delete().in('id', ordersToDelete);
      fetchMasterData(); 
      showMsg('最新の在庫変動を検知し、発注リストを自動補正しました✨');
    }
  };
  // ▲▲▲ ここまで ▲▲▲

  const handleResetToReorderPoint = async () => {
    // 🌟 'all'条件を削除
    const targetProducts = originalProducts.filter(p => activeOrderTab === 'unspecified' ? !p.dealer_id : p.dealer_id === activeOrderTab);
    if (targetProducts.length === 0) return;
    if (!window.confirm('自動計算（デフォルト発注数 - 現在庫数）にリセットしますか？')) return;

    const targetProductIds = targetProducts.map(p => p.id);
    await supabase.from('orders').delete().eq('shop_id', shopId).eq('status', 'pending').in('product_id', targetProductIds);

    const insertData = [];
    targetProducts.forEach(p => {
      const incomingQty = orderedItems.filter(o => o.product_id === p.id).reduce((sum, o) => sum + o.quantity, 0);

      // 🌟 大幅変更：発注点ルールを廃止。「デフォルト発注数 - (現在庫 + 入庫待ち)」が1以上ならリストに入れる！
      let smartQty = (p.default_order_quantity || 1) - ((p.stock || 0) + incomingQty);
      if (smartQty > 0) {
        insertData.push({ shop_id: shopId, product_id: p.id, quantity: smartQty, status: 'pending' });
      }
    });

    if (insertData.length > 0) await supabase.from('orders').insert(insertData);
    fetchMasterData();
    showMsg('自動計算で発注数をリセットしました♻️');
  };

  // ==========================================
  // 🌟 追加：LINE用テキスト自動生成＆コピー機能
  // ==========================================
  const handleCopyOrderText = async () => {
    // 🌟 'all'条件を削除
    const targetProducts = originalProducts.filter(p => activeOrderTab === 'unspecified' ? !p.dealer_id : p.dealer_id === activeOrderTab);
    
    const orderItems = targetProducts.map(p => {
      const order = pendingOrders.find(o => o.product_id === p.id);
      return { product: p, qty: order ? order.quantity : 0 };
    }).filter(item => item.qty > 0);

    if (orderItems.length === 0) {
      alert('発注する商品がありません。');
      return;
    }

    const grouped = {};
    orderItems.forEach(({ product, qty }) => {
      const catName = product.manufacturer_name || product.category || '未分類';
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push({ name: product.name, qty });
    });

    const dealerName = activeOrderTab === 'unspecified' ? '指定なし' : dealers.find(d => d.id === activeOrderTab)?.name;
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
    // 🌟 'all'条件を削除
    const targetOrders = pendingOrders.filter(order => {
      if (activeOrderTab === 'unspecified') return !order.products?.dealer_id;
      return order.products?.dealer_id === activeOrderTab;
    });

    if (targetOrders.length === 0) return;

    const dealerName = activeOrderTab === 'unspecified' ? '指定なしの' : 
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

  // ▼▼▼ 追加：入庫待ち（発注済み）画面用のLINEコピー機能 ▼▼▼
  const handleCopyReceiveText = async () => {
    const currentTabReceive = orderedItems.filter(order => {
      if (activeReceiveTab === 'unspecified') return !order.products?.dealer_id;
      return order.products?.dealer_id === activeReceiveTab;
    });

    if (currentTabReceive.length === 0) {
      alert('コピーする発注済み商品がありません。');
      return;
    }

    // 🌟 同一商品を合算
    const groupedForTotal = {};
    currentTabReceive.forEach(o => {
      if (!groupedForTotal[o.product_id]) groupedForTotal[o.product_id] = 0;
      groupedForTotal[o.product_id] += o.quantity;
    });

    // 🌟 カテゴリ（またはメーカー名）ごとに分類
    const groupedByCategory = {};
    Object.keys(groupedForTotal).forEach(pid => {
      const product = originalProducts.find(p => p.id === pid);
      if (!product) return;
      const catName = product.manufacturer_name || product.category || '未分類';
      if (!groupedByCategory[catName]) groupedByCategory[catName] = [];
      groupedByCategory[catName].push({ name: product.name, qty: groupedForTotal[pid] });
    });

    const dealerName = activeReceiveTab === 'unspecified' ? '指定なし' : dealers.find(d => d.id === activeReceiveTab)?.name;
    let text = `お世話になっております。\n以下の発注をお願いいたします。\n\n【発注先：${dealerName} 御中】\n\n`;

    Object.keys(groupedByCategory).forEach(cat => {
      text += `【${cat}】\n`;
      groupedByCategory[cat].forEach(item => {
        text += `・${item.name} × ${item.qty}\n`;
      });
      text += `\n`;
    });
    text += `よろしくお願いいたします。`;

    try {
      await navigator.clipboard.writeText(text);
      showMsg('発注済みテキストをコピーしました！📋LINEに貼り付けてください。');
    } catch (err) {
      alert('コピーに失敗しました。');
    }
  };
  // ▲▲▲ ここまで ▲▲▲

  // ▼▼▼ 追加：分納・欠品キャンセルのロジック ▼▼▼
  // 個数調整（＋/－）
  const handleReceiveQtyChange = (productId, delta, maxQty) => {
    setReceiveInputs(prev => {
      const current = prev[productId] !== undefined ? prev[productId] : maxQty;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      return { ...prev, [productId]: next };
    });
  };

  // ゴミ箱ボタン（発注の完全取消）
  const handleCancelReceiveOrder = async (productId) => {
    const product = originalProducts.find(p => p.id === productId);
    if (!window.confirm(`「${product?.name || 'この商品'}」の発注をリストから完全に削除しますか？\n（廃盤や欠品で今後も届かない場合に使用します）`)) return;

    try {
      // 対象商品の発注済みデータをすべて削除
      await supabase.from('orders').delete().eq('shop_id', shopId).eq('product_id', productId).eq('status', 'ordered');
      showMsg('発注をリストからキャンセルしました');
      fetchMasterData();
    } catch (err) {
      alert('エラーが発生しました: ' + err.message);
    }
  };

  // ▼▼▼ 追加：一括取り消し（注文をやり直す）ロジック ▼▼▼
  const handleCancelAllReceiveOrders = async () => {
    const currentTabReceive = orderedItems.filter(order => {
      if (activeReceiveTab === 'unspecified') return !order.products?.dealer_id;
      return order.products?.dealer_id === activeReceiveTab;
    });

    if (currentTabReceive.length === 0) return;

    const dealerName = activeReceiveTab === 'unspecified' ? '指定なしの' : dealers.find(d => d.id === activeReceiveTab)?.name + '宛ての';
    if (!window.confirm(`${dealerName}発注（計 ${currentTabReceive.length} 件）をすべて取り消して、発注前の状態に戻しますか？\n（発注リストに未発注として復活します）`)) return;

    try {
      const orderIdsToDelete = currentTabReceive.map(o => o.id);
      await supabase.from('orders').delete().in('id', orderIdsToDelete);
      showMsg('発注を一括で取り消しました。発注リストからやり直してください。');
      fetchMasterData();
    } catch (err) {
      alert('エラーが発生しました: ' + err.message);
    }
  };
  // ▲▲▲ ここまで ▲▲▲

  // ▼▼▼ 修正：仕入・入庫機能のロジック（分納・個別調整対応版） ▼▼▼
  const handleFinalizeReceive = async () => {
    const currentTabReceive = orderedItems.filter(order => {
      if (activeReceiveTab === 'unspecified') return !order.products?.dealer_id;
      return order.products?.dealer_id === activeReceiveTab;
    });

    if (currentTabReceive.length === 0) return;

    // 1. 商品ごとにまとめる
    const groupedOrders = {};
    currentTabReceive.forEach(o => {
      if(!groupedOrders[o.product_id]) groupedOrders[o.product_id] = { product_id: o.product_id, totalQty: 0, orders: [] };
      groupedOrders[o.product_id].totalQty += o.quantity;
      groupedOrders[o.product_id].orders.push(o);
    });

    // 2. 今回本当に入庫する合計数を計算
    let totalReceiveCount = 0;
    Object.values(groupedOrders).forEach(g => {
      const qty = receiveInputs[g.product_id] !== undefined ? receiveInputs[g.product_id] : g.totalQty;
      totalReceiveCount += qty;
    });

    if (totalReceiveCount === 0) {
      alert('入庫する数が 0 個です。個数を調整してください。');
      return;
    }

    const dealerName = activeReceiveTab === 'unspecified' ? '指定なしの' : dealers.find(d => d.id === activeReceiveTab)?.name + 'からの';
    if (!window.confirm(`${dealerName}入荷分（今回入庫する数：計 ${totalReceiveCount} 個）を在庫に追加しますか？\n※入庫しなかった残りの数は引き続きリストに残ります。`)) return;

    try {
      const logsToInsert = [];
      const orderUpdates = []; // 減らす注文（分納用）
      const orderDeletes = []; // 0になって消す注文
      const cleanupUpdates = []; 
      const pendingIdsToDelete = []; 

      for (const group of Object.values(groupedOrders)) {
        const receiveQty = receiveInputs[group.product_id] !== undefined ? receiveInputs[group.product_id] : group.totalQty;
        if (receiveQty === 0) continue;

        // ① 履歴用データ（これをinsertすればDBの魔法トリガーが勝手に在庫を増やしてくれる）
        logsToInsert.push({
          shop_id: shopId,
          product_id: group.product_id,
          change_amount: receiveQty,
          reason: '仕入・入庫増'
        });

        // ② 分納ロジック：古い注文レコードから順番に入庫数を消化していく
        let remainingToReceive = receiveQty;
        const sortedOrders = group.orders.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

        for (const order of sortedOrders) {
          if (remainingToReceive <= 0) break;
          
          if (order.quantity <= remainingToReceive) {
            orderDeletes.push(order.id); // 全て届いたので削除
            remainingToReceive -= order.quantity;
          } else {
            orderUpdates.push({ id: order.id, quantity: order.quantity - remainingToReceive }); // 一部届いたので数を減らして残す
            remainingToReceive = 0;
          }
        }

        // ③ クリーンアップ判定（オートシンク用）
        const currentProduct = originalProducts.find(p => p.id === group.product_id);
        const expectedStock = (currentProduct?.stock || 0) + receiveQty;
        const existingPending = pendingOrders.find(o => o.product_id === group.product_id);

        if (existingPending) {
          let smartQty = (currentProduct?.default_order_quantity || 1) - expectedStock;
          if (smartQty <= 0) {
            pendingIdsToDelete.push(existingPending.id);
          } else {
            cleanupUpdates.push({ id: existingPending.id, quantity: smartQty });
          }
        }
      }

      // === データベース一括更新 ===
      if (orderDeletes.length > 0) await supabase.from('orders').delete().in('id', orderDeletes);
      for (const up of orderUpdates) {
        await supabase.from('orders').update({ quantity: up.quantity }).eq('id', up.id);
      }
      if (logsToInsert.length > 0) await supabase.from('inventory_logs').insert(logsToInsert); // 魔法発動（在庫増）
      
      if (pendingIdsToDelete.length > 0) await supabase.from('orders').delete().in('id', pendingIdsToDelete);
      for (const cu of cleanupUpdates) {
        await supabase.from('orders').update({ quantity: cu.quantity }).eq('id', cu.id);
      }

      showMsg('入庫処理が完了し、在庫に追加されました！📦✨');
      setReceiveInputs({}); // 入力をリセット
      fetchMasterData();
    } catch (error) {
      console.error("Receive Error:", error);
      alert(`エラーが発生しました: ${error.message}`);
    }
  };
  // ▲▲▲ ここまで ▲▲▲

  // ▼▼▼ 追加：仕入履歴の取得 ＆ 取消ロジック ▼▼▼
  const fetchReceiveLogs = async () => {
    const { data } = await supabase
      .from('inventory_logs')
      .select('*')
      .eq('shop_id', shopId)
      .eq('reason', '仕入・入庫増')
      .order('created_at', { ascending: false });
      // 🌟 修正：分析のために .limit(50) を外し、全期間を取得

    if (data) {
      setReceiveLogs(data);
      // 🌟 修正：画面を開いた時、自動的に「最新の月」のアコーディオンだけを開いておく
      if (data.length > 0) {
        const d = new Date(data[0].created_at);
        setExpandedMonths([`${d.getFullYear()}年${d.getMonth() + 1}月`]);
      }
    }
  };

  const handleRevertReceive = async (log) => {
    const product = originalProducts.find(p => p.id === log.product_id);
    const pName = product ? product.name : '不明な商品';
    
    if (!window.confirm(`「${pName}」の入庫（${log.change_amount}個）を取り消し、在庫からマイナスしますか？\n※この操作は元に戻せません。`)) return;

    try {
      if (product) {
        // 在庫を取り消し分だけ減らす（0未満にはならないようにガード）
        const newStock = Math.max(0, (product.stock || 0) - log.change_amount);
        await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
      }
      // 履歴から削除
      await supabase.from('inventory_logs').delete().eq('id', log.id);
      
      showMsg('入庫を取り消し、在庫を修正しました♻️');
      fetchMasterData(); // マスター在庫を最新化
      fetchReceiveLogs(); // 履歴リストを最新化
    } catch (err) {
      alert('エラーが発生しました: ' + err.message);
    }
  };
  // ▲▲▲ ここまで ▲▲▲

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
        
        {/* 🌟 追加：使い方ガイドボタン */}
        <button 
          onClick={() => setShowHelpModal(true)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '8px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '0.9rem' }}
        >
          <HelpCircle size={20} />
          {isPC && '使い方ガイド'}
        </button>
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
                  {/* ▼▼▼ 変更：onClickを handleGoToOrder に変更 ▼▼▼ */}
                  <button onClick={handleGoToOrder} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
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
                  {/* ▼▼▼ 変更：onClickを setActiveView('receive') に変更 ▼▼▼ */}
                  <button onClick={() => setActiveView('receive')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#10b981'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <Truck size={20} color="#10b981" /> 仕入入力
                  </button>
                  {/* 🌟 変更：onClick時に画面切り替えと履歴読み込みを実行 */}
                  <button onClick={() => { setActiveView('receive_history'); fetchReceiveLogs(); }} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#10b981'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
                    <ClipboardList size={20} color="#10b981" /> 仕入修正・履歴
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
              <div style={{ display: 'flex', gap: '10px' }} className="no-print">
                {(() => {
                  // 🌟 'all'条件を削除し、現在のディーラータブのみで判定
                  const hasAlreadyOrderedInTab = orderedItems.some(o => {
                    if (activeOrderTab === 'unspecified') return !o.products?.dealer_id;
                    return o.products?.dealer_id === activeOrderTab;
                  });

                  return (
                    <>
                      {/* 🌟 「デフォルト発注数にする」ボタンを削除 */}
                      
                      {/* 🌟 リセットボタン：入庫待ちがある場合は完全ロック */}
                      <button 
                        onClick={handleResetToReorderPoint} 
                        disabled={hasAlreadyOrderedInTab}
                        style={{ 
                          padding: '10px 16px', 
                          background: hasAlreadyOrderedInTab ? '#f1f5f9' : '#fee2e2', 
                          border: 'none', 
                          borderRadius: '10px', 
                          cursor: hasAlreadyOrderedInTab ? 'not-allowed' : 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          fontWeight: 'bold', 
                          color: hasAlreadyOrderedInTab ? '#94a3b8' : '#b91c1c' 
                        }}
                        title={hasAlreadyOrderedInTab ? "入庫待ちの商品があるためリセットできません" : "発注数（デフォルト-現在庫）にリセット"}
                      >
                        <RotateCcw size={18} /> リセット
                      </button>
                      
                      <button onClick={handleCopyOrderText} style={{ padding: '10px 16px', background: '#ecfdf5', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#059669' }}>
                        <Copy size={18} /> LINE・メール用にコピー
                      </button>
                    </>
                  );
                })()}
                <button onClick={() => window.print()} style={{ padding: '10px 16px', background: '#fff', border: '2px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#64748b' }}>
                  <Printer size={18} /> PDF出力 / 印刷
                </button>
              </div>
            </div>

            {/* 🌟 追加：タブ切り替えメニュー */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }} className="no-print">
              {/* 🌟 「すべて」タブを削除 */}
              
              {dealers.map(d => {
                // 🌟 修正：「発注待ちの数」ではなく、「そのディーラーに紐づく商品があるか」で判定
                const hasProducts = originalProducts.some(p => p.dealer_id === d.id);
                if (!hasProducts) return null; // 商品マスターに登録がないディーラーだけ隠す
                
                const pendingCount = pendingOrders.filter(o => o.products?.dealer_id === d.id).length;
                
                return (
                  <button key={d.id} onClick={() => setActiveOrderTab(d.id)} style={{ flexShrink: 0, padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s', background: activeOrderTab === d.id ? '#3b82f6' : '#fff', color: activeOrderTab === d.id ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    {d.name} {pendingCount > 0 ? `(${pendingCount})` : ''}
                  </button>
                );
              })}

              {originalProducts.some(p => !p.dealer_id) && (
                <button onClick={() => setActiveOrderTab('unspecified')} style={{ flexShrink: 0, padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s', background: activeOrderTab === 'unspecified' ? '#3b82f6' : '#fff', color: activeOrderTab === 'unspecified' ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  指定なし {pendingOrders.filter(o => !o.products?.dealer_id).length > 0 ? `(${pendingOrders.filter(o => !o.products?.dealer_id).length})` : ''}
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
                // 🌟 'all'条件を削除
                let displayProducts = originalProducts.filter(p => activeOrderTab === 'unspecified' ? !p.dealer_id : p.dealer_id === activeOrderTab);
                
                // 🌟 追加：並べ替えロジック
                displayProducts = [...displayProducts].sort((a, b) => {
                  const hasOrderA = pendingOrders.some(o => o.product_id === a.id && o.quantity > 0) ? 1 : 0;
                  const hasOrderB = pendingOrders.some(o => o.product_id === b.id && o.quantity > 0) ? 1 : 0;
                  
                  // 🌟 追加：発注点以下かどうかの判定（並べ替え用）
                  const isLowStockA = (a.stock || 0) <= (a.reorder_point || 0) ? 1 : 0;
                  const isLowStockB = (b.stock || 0) <= (b.reorder_point || 0) ? 1 : 0;
                  
                  const catCompare = (a.category || '').localeCompare(b.category || '', 'ja');
                  const nameCompare = (a.name || '').localeCompare(b.name || '', 'ja');

                  if (orderSortType === 'name') {
                    return nameCompare;
                  } else if (orderSortType === 'category') {
                    if (catCompare !== 0) return catCompare;
                    return nameCompare;
                  } else if (orderSortType === 'priority') {
                    // 1. 発注数が1以上のものを強制的に上にする
                    if (hasOrderA !== hasOrderB) return hasOrderB - hasOrderA;
                    // 2. 🌟 追加：発注点以下のものをさらに上にする（赤文字が先、青文字がその下になる）
                    if (isLowStockA !== isLowStockB) return isLowStockB - isLowStockA;
                    // 3. その後はカテゴリ別あいうえお順
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
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>発注数 / 金額</th>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }} className="no-print">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayProducts.map(product => {
                          const order = pendingOrders.find(o => o.product_id === product.id);
                          const orderQty = order ? order.quantity : 0;
                          
                          // 🌟 修正：すでに発注済みのデータを「すべて」取得して合計する（複数回の追加注文に対応）
                          const alreadyOrderedList = orderedItems.filter(o => o.product_id === product.id);
                          const totalAlreadyOrderedQty = alreadyOrderedList.reduce((sum, o) => sum + o.quantity, 0);
                          const hasAlreadyOrdered = totalAlreadyOrderedQty > 0;
                          
                          const isLowStock = product.stock <= product.reorder_point;
                          const hasOrder = orderQty > 0;

                          const getOrderedDate = (dateStr) => {
                            if (!dateStr) return '';
                            const d = new Date(dateStr);
                            const days = ['日', '月', '火', '水', '木', '金', '土'];
                            return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
                          };

                          // 🌟 追加：デフォルト発注数に足りていない（青文字対象）かの判定
                          const isPaddingNeeded = (product.default_order_quantity || 1) - (product.stock || 0) >= 1;
                          
                          // 🌟 追加：文字色の決定ロジック
                          let stockColor = '#1e293b'; // デフォルトは黒
                          if (!hasAlreadyOrdered) {
                            if (isLowStock) stockColor = '#ef4444'; // 発注点以下は赤
                            else if (isPaddingNeeded) stockColor = '#3b82f6'; // デフォルトに足りていない場合は青
                          }

                          return (
                            // 🌟 変更：発注待ち(hasOrder)か、発注済み(hasAlreadyOrdered)がある場合は行を表示
                            <tr key={product.id} className={!hasOrder && !hasAlreadyOrdered ? 'no-print' : ''} style={{ borderBottom: '1px solid #e2e8f0', background: hasOrder ? '#f0f9ff' : hasAlreadyOrdered ? '#ecfdf5' : '#fff', transition: '0.2s' }}>
                              <td style={{ padding: '16px' }}>
                                <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1rem' }}>{product.name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                  {product.manufacturer_name ? `${product.manufacturer_name} (${product.category})` : product.category}
                                </div>
                              </td>
                              
                              <td style={{ padding: '16px' }} className="no-print">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {/* 🌟 変更：判定した stockColor を適用 */}
                                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: stockColor }}>
                                    現在庫: {product.stock || 0}
                                    {isLowStock && !hasAlreadyOrdered && <AlertCircle size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} />}
                                  </span>
                                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>発注点: {product.reorder_point || 0}</span>
                                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>ﾃﾞﾌｫﾙﾄ発注数: {product.default_order_quantity || 1}</span>
                                </div>
                              </td>

                              <td style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {/* 🌟 変更：発注済みのラベルを小さく表示しつつ、下の＋/－ボタンは残す */}
                                  {hasAlreadyOrdered && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981', background: '#dcfce7', padding: '4px 8px', borderRadius: '8px' }}>
                                        発注済: {totalAlreadyOrderedQty}個
                                      </span>
                                      <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold' }}>
                                        {getOrderedDate(alreadyOrderedList[0].ordered_at)}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* 🌟 変更：常に追加注文（＋/－）ができるようにボタンを表示 */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: hasOrder ? '#3b82f6' : '#cbd5e1' }}>{orderQty}</span>
                                    <div className="no-print" style={{ display: 'flex', gap: '4px' }}>
                                      {/* 🌟 賢いポイント：＋を押した時のスマート計算用に「現在庫＋すでに入庫待ちの数」を渡す */}
                                      <button onClick={() => handleOrderQuantityChange(product.id, orderQty, -1, product.default_order_quantity, (product.stock || 0) + totalAlreadyOrderedQty)} disabled={!hasOrder} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: hasOrder ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasOrder ? '#64748b' : '#cbd5e1' }}><Minus size={16} /></button>
                                      <button onClick={() => handleOrderQuantityChange(product.id, orderQty, 1, product.default_order_quantity, (product.stock || 0) + totalAlreadyOrderedQty)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><Plus size={16} /></button>
                                    </div>
                                  </div>
                                  
                                  {/* 🌟 追加：小計金額の表示 */}
                                  {hasOrder && (
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>
                                      ¥{(orderQty * (product.cost_price || 0)).toLocaleString()}
                                    </div>
                                  )}

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
                
                {/* 2段目：商品名、仕入価格、販売価格（店販のみ） */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>商品名</label>
                    <input placeholder="商品名" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} style={inputStyle} required />
                  </div>
                  
                  {/* 🌟 追加：仕入価格（これは常に表示） */}
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>仕入価格</label>
                    <input type="number" placeholder="原価" value={newCostPrice} onChange={(e) => setNewCostPrice(e.target.value)} style={inputStyle} />
                  </div>

                  {/* 🌟 変更：店販用の時だけ販売価格を表示 */}
                  {newUsageType === '店販用' && (
                    <div style={{ flex: 1, animation: 'fadeIn 0.3s' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>販売価格</label>
                      <input type="number" placeholder="定価" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} style={inputStyle} />
                    </div>
                  )}
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
                        setEditingProdId(p.id); 
                        setNewProdName(p.name); 
                        setNewCostPrice(p.cost_price || 0); // 🌟 ここに追加！仕入価格をセット
                        setNewProdPrice(p.price || 0); 
                        setSelectedProdCat(p.category); 
                        setNewUsageType(p.usage_type || '店販用');
                        setNewProdStock(p.stock || 0); 
                        setNewReorderPoint(p.reorder_point || 0); 
                        setNewDefaultOrderQty(p.default_order_quantity || 1);
                        setSelectedDealerId(p.dealer_id || '');
                        setNewManufacturerName(p.manufacturer_name || '');
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

        {/* ▼▼▼ 追加：ビュー：仕入（入庫）画面 ▼▼▼ */}
        {activeView === 'receive' && (
          <div style={{ animation: 'fadeIn 0.3s', maxWidth: '900px', margin: '0 auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.4rem', color: '#1e293b', margin: 0, fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={24} color="#10b981" /> 入庫待ち（発注済み）リスト
              </h2>
              {/* 🌟 追加：入庫待ちリスト用のコピーボタン */}
              <div className="no-print">
                <button onClick={handleCopyReceiveText} style={{ padding: '10px 16px', background: '#ecfdf5', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#059669' }}>
                  <Copy size={18} /> LINE・メール用にコピー
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
              {/* 🌟 「すべて」タブを削除 */}
              
              {dealers.map(d => {
                // 🌟 発注画面と同様に、商品登録がないディーラーは隠す
                const hasProducts = originalProducts.some(p => p.dealer_id === d.id);
                if (!hasProducts) return null; 

                const count = orderedItems.filter(o => o.products?.dealer_id === d.id).length;
                return (
                  <button key={d.id} onClick={() => setActiveReceiveTab(d.id)} style={{ flexShrink: 0, padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s', background: activeReceiveTab === d.id ? '#10b981' : '#fff', color: activeReceiveTab === d.id ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    {d.name} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              {(() => {
                const displayOrders = orderedItems.filter(order => {
                  // 🌟 'all'条件を削除
                  if (activeReceiveTab === 'unspecified') return !order.products?.dealer_id;
                  return order.products?.dealer_id === activeReceiveTab;
                });

                if (displayOrders.length === 0) {
                  return (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      <Truck size={48} style={{ opacity: 0.5, marginBottom: '10px' }} /><br/>
                      現在、この取引先からの入庫待ち（発注済み）商品はありません。
                    </div>
                  );
                }

                // 🌟 追加：同じ商品を1行にまとめる（合算する）処理
                const groupedOrders = [];
                displayOrders.forEach(order => {
                  const existing = groupedOrders.find(g => g.product_id === order.product_id);
                  if (existing) {
                    existing.quantity += order.quantity;
                    // 最新の発注日を表示する
                    if (new Date(order.ordered_at) > new Date(existing.ordered_at)) {
                      existing.ordered_at = order.ordered_at;
                    }
                  } else {
                    groupedOrders.push({ ...order }); // コピーして追加
                  }
                });

                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.9rem' }}>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>商品名 / カテゴリ</th>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>最新発注日</th>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>入庫予定数 / 金額</th>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>今回入庫する数</th>
                          <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 🌟 変更：displayOrders ではなく groupedOrders をマップする */}
                        {groupedOrders.map(order => {
                          const product = originalProducts.find(p => p.id === order.product_id) || {};
                          const maxQty = order.quantity; // 🌟 追加：もともとの発注数
                          const currentQty = receiveInputs[order.product_id] !== undefined ? receiveInputs[order.product_id] : maxQty; // 🌟 追加：入力された数

                          return (
                            // 🌟 変更：keyを product_id に変更
                            <tr key={order.product_id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                              <td style={{ padding: '16px' }}>
                                <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1rem' }}>{order.products?.name || '不明な商品'}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                  {product.manufacturer_name ? `${product.manufacturer_name} (${order.products?.category})` : order.products?.category}
                                </div>
                              </td>
                              <td style={{ padding: '16px', color: '#64748b', fontSize: '0.9rem' }}>
                                {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString('ja-JP') : '-'}
                              </td>
                              <td style={{ padding: '16px' }}>
                                {/* 🌟 変更：元の数はグレー表示に変更 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#94a3b8' }}>{maxQty}</span>
                                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>
                                    ¥{(maxQty * (product.cost_price || 0)).toLocaleString()}
                                  </span>
                                </div>
                              </td>

                              {/* 🌟 追加：今回入庫する数コントローラー */}
                              <td style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: currentQty === maxQty ? '#10b981' : '#f59e0b' }}>{currentQty}</span>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => handleReceiveQtyChange(order.product_id, -1, maxQty)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><Minus size={16} /></button>
                                    <button onClick={() => handleReceiveQtyChange(order.product_id, 1, maxQty)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><Plus size={16} /></button>
                                  </div>
                                </div>
                                {currentQty < maxQty && (
                                  <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'bold', marginTop: '4px' }}>
                                    ※残り {maxQty - currentQty} 個は未入庫に残ります
                                  </div>
                                )}
                              </td>

                              {/* 🌟 追加：ゴミ箱（完全キャンセル） */}
                              <td style={{ padding: '16px' }}>
                                <button onClick={() => handleCancelReceiveOrder(order.product_id)} style={{ padding: '8px', background: '#fee2e2', border: 'none', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }} title="欠品・廃盤で発注を取り消す">
                                  <Trash2 size={18} />
                                </button>
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
        {/* ▲▲▲ ここまで ▲▲▲ */}

        {/* ▼▼▼ 追加：ビュー：仕入修正・履歴画面（超高機能版） ▼▼▼ */}
        {activeView === 'receive_history' && (
          <div style={{ animation: 'fadeIn 0.3s', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.4rem', color: '#1e293b', margin: 0, fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={24} color="#10b981" /> 仕入・入庫履歴 ＆ 分析
              </h2>
            </div>

            {/* 🌟 画面切り替えタブ（一覧 vs 分析） */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button 
                onClick={() => setHistoryViewTab('list')}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', background: historyViewTab === 'list' ? '#10b981' : '#fff', color: historyViewTab === 'list' ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
              >
                📋 履歴一覧（取消）
              </button>
              <button 
                onClick={() => setHistoryViewTab('analytics')}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', background: historyViewTab === 'analytics' ? '#10b981' : '#fff', color: historyViewTab === 'analytics' ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
              >
                📊 傾向と対策（集計）
              </button>
            </div>

            {receiveLogs.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '16px' }}>
                <ClipboardList size={48} style={{ opacity: 0.5, marginBottom: '10px' }} /><br/>
                入庫の履歴がありません。
              </div>
            ) : historyViewTab === 'list' ? (
              
              /* ==================================
                 A. アコーディオン形式の履歴一覧
              ================================== */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(() => {
                  // 🌟 魔法：データを「〇〇年〇〇月」ごとに自動でグループ分けする
                  const groupedLogs = receiveLogs.reduce((acc, log) => {
                    const d = new Date(log.created_at);
                    const monthStr = `${d.getFullYear()}年${d.getMonth() + 1}月`;
                    if (!acc[monthStr]) acc[monthStr] = [];
                    acc[monthStr].push(log);
                    return acc;
                  }, {});

                  return Object.entries(groupedLogs).map(([month, logs]) => {
                    const isExpanded = expandedMonths.includes(month);
                    return (
                      <div key={month} style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                        {/* アコーディオンのボタン部分 */}
                        <button 
                          onClick={() => setExpandedMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month])}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: isExpanded ? '#f0fdf4' : '#fff', border: 'none', cursor: 'pointer', transition: '0.2s' }}
                        >
                          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: isExpanded ? '#15803d' : '#1e293b' }}>
                            {month} <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginLeft: '8px', fontWeight: 'normal' }}>({logs.length}件)</span>
                          </span>
                          <span style={{ fontSize: '1.2rem', color: '#94a3b8', transition: '0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                        </button>

                        {/* 開いた時の中身（テーブル） */}
                        {isExpanded && (
                          <div style={{ overflowX: 'auto', borderTop: '1px solid #e2e8f0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.85rem' }}>
                                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>日時</th>
                                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>商品名 / カテゴリ</th>
                                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>入庫数</th>
                                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                {logs.map(log => {
                                  const product = originalProducts.find(p => p.id === log.product_id) || {};
                                  const d = new Date(log.created_at);
                                  const dateStr = `${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                                  
                                  return (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold' }}>{dateStr}</td>
                                      <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.95rem' }}>{product.name || '削除された商品'}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{product.category || '-'}</div>
                                      </td>
                                      <td style={{ padding: '12px 16px' }}>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981' }}>+{log.change_amount}</span>
                                      </td>
                                      <td style={{ padding: '12px 16px' }}>
                                        <button onClick={() => handleRevertReceive(log)} style={{ padding: '6px 10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                          <Undo2 size={14} /> 取消
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

            ) : (

              /* ==================================
                 B. 傾向と対策（分析・ランキング）
              ================================== */
              <div style={{ background: '#fff', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>📦 商品別 入庫ランキング</h3>
                  <select 
                    value={analyticsPeriod} 
                    onChange={(e) => setAnalyticsPeriod(e.target.value)}
                    style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 'bold', color: '#1e293b', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="month">今月</option>
                    <option value="year">今年度</option>
                    <option value="all">全期間</option>
                  </select>
                </div>

                {(() => {
                  const now = new Date();
                  // 🌟 期間で絞り込み
                  const filtered = receiveLogs.filter(log => {
                    const d = new Date(log.created_at);
                    if (analyticsPeriod === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                    if (analyticsPeriod === 'year') return d.getFullYear() === now.getFullYear();
                    return true;
                  });

                  if (filtered.length === 0) return <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>指定期間のデータがありません</div>;

                  // 🌟 商品ごとに数を集計
                  const stats = {};
                  let totalQty = 0;
                  let totalAmount = 0;

                  filtered.forEach(log => {
                    if (!stats[log.product_id]) stats[log.product_id] = { qty: 0, amount: 0 };
                    stats[log.product_id].qty += log.change_amount;
                    
                    const p = originalProducts.find(prod => prod.id === log.product_id);
                    const cost = p?.cost_price || 0;
                    stats[log.product_id].amount += log.change_amount * cost;
                    
                    totalQty += log.change_amount;
                    totalAmount += log.change_amount * cost;
                  });

                  // 🌟 数が多い順（降順）に並べ替え
                  const sortedStats = Object.entries(stats)
                    .map(([id, data]) => ({ id, ...data }))
                    .sort((a, b) => b.qty - a.qty);

                  return (
                    <>
                      {/* 期間の総合計パネル */}
                      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold' }}>期間合計 入庫数</div>
                          <div style={{ fontSize: '1.4rem', color: '#15803d', fontWeight: '900' }}>{totalQty} 個</div>
                        </div>
                        <div style={{ width: '1px', background: '#bbf7d0' }} />
                        <div>
                          <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold' }}>期間合計 仕入額 (概算)</div>
                          <div style={{ fontSize: '1.4rem', color: '#15803d', fontWeight: '900' }}>¥{totalAmount.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* ランキング表 */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>
                            <th style={{ padding: '10px 8px' }}>順位</th>
                            <th style={{ padding: '10px 8px' }}>商品名</th>
                            <th style={{ padding: '10px 8px', textAlign: 'right' }}>入庫総数</th>
                            <th style={{ padding: '10px 8px', textAlign: 'right' }}>仕入総額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedStats.map((item, idx) => {
                            const product = originalProducts.find(p => p.id === item.id) || {};
                            return (
                              <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 8px', fontWeight: '900', color: idx < 3 ? '#f59e0b' : '#94a3b8', fontSize: '1.1rem' }}>
                                  {idx + 1}
                                </td>
                                <td style={{ padding: '12px 8px' }}>
                                  <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{product.name || '削除された商品'}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{product.category || '-'}</div>
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: '#10b981', fontSize: '1.1rem' }}>
                                  {item.qty}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: '#64748b' }}>
                                  ¥{item.amount.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        {/* ▲▲▲ ここまで ▲▲▲ */}

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
          {/* 🌟 変更：flexDirectionを調整して、スマホでは金額とボタンが縦並びになるように */}
          <div style={isPC ? { maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'flex-end' } : { display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            
            {/* 🌟 追加：合計金額の計算と表示 */}
            {(() => {
              const currentTabOrders = pendingOrders.filter(order => {
                if (activeOrderTab === 'unspecified') return !order.products?.dealer_id;
                return order.products?.dealer_id === activeOrderTab;
              });
              
              // 表示中のタブに発注商品がない場合は非表示
              if (currentTabOrders.length === 0) return null;

              const totalAmount = currentTabOrders.reduce((sum, order) => {
                const product = originalProducts.find(p => p.id === order.product_id);
                return sum + (order.quantity * (product?.cost_price || 0));
              }, 0);

              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: isPC ? '10px' : '0', justifyContent: isPC ? 'flex-end' : 'space-between', width: isPC ? 'auto' : '100%' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b' }}>現在の発注合計:</span>
                  <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#1e293b' }}>¥{totalAmount.toLocaleString()}</span>
                </div>
              );
            })()}

            <button onClick={handleFinalizeOrders} style={{ flex: isPC ? '0 0 300px' : 1, padding: '15px', border: 'none', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s', background: '#3b82f6', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}>
              <Send size={20} />
              <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>発注を確定する</span>
            </button>
          </div>
        </div>
      )}

      {/* ▼▼▼ 追加：仕入・入庫画面専用 フッター（金額計算も連動版） ▼▼▼ */}
      {activeView === 'receive' && orderedItems.filter(o => activeReceiveTab === 'unspecified' ? !o.products?.dealer_id : o.products?.dealer_id === activeReceiveTab).length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: isPC ? '15px 20px' : '10px 15px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', zIndex: 1000 }}>
          {/* 🌟 変更：justifyContentをspace-betweenにして左に取消ボタン、右に入庫ボタンを配置。スマホは縦並び（取消が下） */}
          <div style={isPC ? { maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'space-between' } : { display: 'flex', flexDirection: 'column-reverse', gap: '12px', width: '100%' }}>
            
            {/* 🌟 追加：一括取り消しボタン */}
            <button 
              onClick={handleCancelAllReceiveOrders}
              style={{ width: isPC ? 'auto' : '100%', padding: '12px 20px', border: 'none', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.3s', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <RotateCcw size={18} />
              <span style={{ fontSize: '0.9rem' }}>発注を一括取消（やり直す）</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', justifyContent: 'flex-end', flexDirection: isPC ? 'row' : 'column', width: isPC ? 'auto' : '100%' }}>
              {(() => {
                const currentTabReceive = orderedItems.filter(order => {
                  if (activeReceiveTab === 'unspecified') return !order.products?.dealer_id;
                  return order.products?.dealer_id === activeReceiveTab;
                });
                if (currentTabReceive.length === 0) return null;

                const groupedForTotal = {};
                currentTabReceive.forEach(o => {
                  if(!groupedForTotal[o.product_id]) groupedForTotal[o.product_id] = 0;
                  groupedForTotal[o.product_id] += o.quantity;
                });

                let totalAmount = 0;
                Object.keys(groupedForTotal).forEach(pid => {
                  const qty = receiveInputs[pid] !== undefined ? receiveInputs[pid] : groupedForTotal[pid];
                  const product = originalProducts.find(p => p.id === pid);
                  totalAmount += qty * (product?.cost_price || 0);
                });

                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: isPC ? '10px' : '0', justifyContent: isPC ? 'flex-end' : 'space-between', width: isPC ? 'auto' : '100%' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b' }}>今回入庫の合計:</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#10b981' }}>¥{totalAmount.toLocaleString()}</span>
                  </div>
                );
              })()}

              <button onClick={handleFinalizeReceive} style={{ width: isPC ? '300px' : '100%', padding: '15px', border: 'none', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s', background: '#10b981', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}>
                <Truck size={20} />
                <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>入庫を確定する</span>
              </button>
            </div>
            
          </div>
        </div>
      )}
      {/* ▲▲▲ ここまで ▲▲▲ */}

      {/* ▼▼▼ 追加：使い方ガイド（ヘルプモーダル） ▼▼▼ */}
      {showHelpModal && (
        <div 
          onClick={() => setShowHelpModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '20px' }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', width: '100%', maxWidth: '600px', borderRadius: '24px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <div style={{ padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={24} color="#0ea5e9" /> 在庫管理システム 使い方ガイド
              </h3>
              <button onClick={() => setShowHelpModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#64748b', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '25px', color: '#334155', lineHeight: '1.6', fontSize: '0.95rem' }}>
              <h4 style={{ color: '#0ea5e9', borderBottom: '2px solid #e0f2fe', paddingBottom: '8px', marginTop: 0 }}>1. 基本の流れ</h4>
              <ol style={{ paddingLeft: '20px', marginBottom: '25px' }}>
                <li style={{ marginBottom: '8px' }}><b>払出入力：</b>カラー剤などを使ったら、ここで「開封(-1)」を押します。</li>
                <li style={{ marginBottom: '8px' }}><b>発注入力：</b>在庫が減ると自動計算されリストに並びます。確認して確定します。</li>
                <li style={{ marginBottom: '8px' }}><b>仕入入力：</b>商品が届いたら、ここで「入庫する」を押して在庫にプラスします。</li>
              </ol>

              <h4 style={{ color: '#0ea5e9', borderBottom: '2px solid #e0f2fe', paddingBottom: '8px' }}>💡 よくある質問・トラブル対応</h4>
              
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#1e293b' }}>Q. 発注後に「間違えた！やり直したい！」という時は？</strong>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginTop: '8px', borderLeft: '4px solid #3b82f6' }}>
                  A. 「仕入（入庫待ち）リスト」に行き、間違えた商品の<b>🗑️ゴミ箱ボタン</b>を押してください。<br/>
                  その後「発注リスト」に戻ると、自動的に未発注の状態に復活しているので、そこで数を直して再度確定できます。
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#1e293b' }}>Q. ディーラーから「一部だけ欠品で後から届く」と言われたら？</strong>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginTop: '8px', borderLeft: '4px solid #10b981' }}>
                  A. 「仕入リスト」で、<b>今回届いた数だけ</b>に「＋/－」で調整してから入庫ボタンを押してください。届かなかった分はリストに残り続けます（分納対応）。
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#1e293b' }}>Q. 廃盤になって今後も届かない商品はどうする？</strong>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginTop: '8px', borderLeft: '4px solid #f59e0b' }}>
                  A. 最後の在庫を使い切るまでは、マスター設定で「デフォルト発注数」を<b>0</b>にしてください（発注リストに上がらなくなります）。<br/>
                  在庫が完全に0になったら、マスターから削除してください。
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: '#1e293b' }}>Q. 入庫ボタンを間違えて押しちゃった！</strong>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginTop: '8px', borderLeft: '4px solid #ef4444' }}>
                  A. 「仕入修正・履歴」画面に行き、間違えた履歴の<b>取消ボタン</b>を押せば、在庫が元に戻り、発注リストに自動で復活します。
                </div>
              </div>
            </div>
            
            <div style={{ padding: '15px 25px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
              <button onClick={() => setShowHelpModal(false)} style={{ padding: '12px 30px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ▲▲▲ ここまで ▲▲▲ */}

    </div>
  );
};

export default InventoryManager;