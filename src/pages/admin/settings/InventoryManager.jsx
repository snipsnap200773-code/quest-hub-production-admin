import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  PackageOpen, Minus, Plus, ArrowLeft, CheckCircle2, AlertCircle, Save, RotateCcw,
  ShoppingCart, Truck, ClipboardList, Search, Settings, Undo2, PackageMinus,
  Edit2, Trash2, ArrowUp, ArrowDown, Layers
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
  const [editingProdId, setEditingProdId] = useState(null);

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
    const [catRes, prodRes] = await Promise.all([
      supabase.from('service_categories').select('*').eq('shop_id', shopId).eq('is_product_cat', true).order('sort_order'),
      supabase.from('products').select('*').eq('shop_id', shopId).order('sort_order')
    ]);

    if (catRes.data) setProductCategories(catRes.data);
    if (prodRes.data) {
      setOriginalProducts(prodRes.data);
      setLocalProducts(JSON.parse(JSON.stringify(prodRes.data)));
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

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
      reorder_point: Number(newReorderPoint) 
    };
    
    if (editingProdId) await supabase.from('products').update(payload).eq('id', editingProdId);
    else await supabase.from('products').insert([{ ...payload, sort_order: originalProducts.length }]);
    
    setNewProdName(''); setNewProdPrice(0); setNewUsageType('店販用'); setNewProdStock(0); setNewReorderPoint(0); setEditingProdId(null); 
    fetchMasterData(); 
    showMsg(editingProdId ? '商品を更新しました' : '商品を新規登録しました');
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
                  <button onClick={() => alert('🚧 開発中')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseOut={e => e.currentTarget.style.borderColor = '#f1f5f9'}>
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
                  <button onClick={() => alert('🚧 開発中')} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px solid #f1f5f9', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#1e293b', fontSize: '1rem', transition: '0.2s' }}>
                    <Settings size={20} color="#64748b" /> 取引先(ディーラー)
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
            ⚙️ ビュー3：商品マスター登録（お引っ越し分）
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
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>所属カテゴリ</label>
                  <select value={selectedProdCat} onChange={(e) => setSelectedProdCat(e.target.value)} style={inputStyle} required>
                    <option value="">-- カテゴリを選択 --</option>
                    {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                
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
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => moveItem('product', filteredList, p.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={20} /></button>
                      <button onClick={() => moveItem('product', filteredList, p.id, 'down')} disabled={idx === filteredList.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === filteredList.length - 1 ? 0.3 : 1 }}><ArrowDown size={20} /></button>
                      <button onClick={() => { 
                        setEditingProdId(p.id); setNewProdName(p.name); setNewProdPrice(p.price); 
                        setSelectedProdCat(p.category); setNewUsageType(p.usage_type || '店販用');
                        setNewProdStock(p.stock || 0); setNewReorderPoint(p.reorder_point || 0); 
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

    </div>
  );
};

export default InventoryManager;