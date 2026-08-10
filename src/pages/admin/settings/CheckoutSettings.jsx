import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  ArrowLeft, Save, Edit2, Trash2, ArrowUp, ArrowDown,
  Layers, Plus, ShoppingBag, Settings2, RefreshCcw, CheckCircle2
} from 'lucide-react';

const CheckoutSettings = ({ reloadPreview }) => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const adjFormRef = useRef(null);
  const prodFormRef = useRef(null);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900; 

  const [message, setMessage] = useState('');
  
  // --- 1. 自動処理設定用 (GeneralSettingsから引っ越し) ---
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [autoSalesMatching, setAutoSalesMatching] = useState(false);
  const [allowBatchMatching, setAllowBatchMatching] = useState(false);

  // --- 2. お会計調整マスター用 (MenuSettingsから引っ越し) ---
  const [adjustments, setAdjustments] = useState([]);      
  const [adjCategories, setAdjCategories] = useState([]);   
  const [newAdjCatName, setNewAdjCatName] = useState('');   
  const [editingAdjCatId, setEditingAdjCatId] = useState(null);
  const [selectedAdjCat, setSelectedAdjCat] = useState(''); 
  const [newAdjName, setNewAdjName] = useState('');         
  const [adjType, setAdjType] = useState('minus');          
  const [adjValue, setAdjValue] = useState(0);              
  const [editingAdjId, setEditingAdjId] = useState(null);

  // --- 3. 店販商品マスター用 (MenuSettingsから引っ越し) ---
  const [products, setProducts] = useState([]);            
  const [productCategories, setProductCategories] = useState([]); 
  const [newProdCatName, setNewProdCatName] = useState('');
  const [editingProdCatId, setEditingProdCatId] = useState(null);
  const [selectedProdCat, setSelectedProdCat] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [editingProdId, setEditingProdId] = useState(null);

  useEffect(() => {
    if (shopId) {
      fetchGeneralSettings();
      fetchMasterDetails();
    }
  }, [shopId]);

  // GeneralSettings由来のデータ取得
  const fetchGeneralSettings = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setThemeColor(data.theme_color || '#2563eb');
      setAutoSalesMatching(data.auto_sales_matching || false);
      setAllowBatchMatching(data.allow_batch_matching || false);
    }
  };

  // MenuSettings由来のデータ取得
  const fetchMasterDetails = async () => {
    const adjCatRes = await supabase.from('service_categories').select('*').eq('shop_id', shopId).eq('is_adjustment_cat', true).order('sort_order');
    const prodCatRes = await supabase.from('service_categories').select('*').eq('shop_id', shopId).eq('is_product_cat', true).order('sort_order');
    const adjRes = await supabase.from('admin_adjustments').select('*').eq('shop_id', shopId).is('service_id', null).order('sort_order');
    const prodRes = await supabase.from('products').select('*').eq('shop_id', shopId).order('sort_order');

    if (adjCatRes.data) setAdjCategories(adjCatRes.data);
    if (prodCatRes.data) setProductCategories(prodCatRes.data);
    if (adjRes.data) setAdjustments(adjRes.data);
    if (prodRes.data) setProducts(prodRes.data);
  };

  const showMsg = (txt) => { 
    setMessage(txt); 
    setTimeout(() => setMessage(''), 3000); 
    if (typeof reloadPreview === 'function') {
      setTimeout(() => reloadPreview(), 300);
    }
  };

  const moveItem = async (type, list, id, direction) => {
    const idx = list.findIndex(item => item.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const itemA = list[idx];
    const itemB = list[targetIdx];
    const tableMap = { category: 'service_categories', adjustment: 'admin_adjustments', product: 'products' };
    const table = tableMap[type] || 'products';

    try {
      const updates = [{ ...itemA, sort_order: itemB.sort_order }, { ...itemB, sort_order: itemA.sort_order }];
      const { error } = await supabase.from(table).upsert(updates);
      if (error) throw error;
      fetchMasterDetails();
    } catch (err) {
      alert("並び替えができませんでした。一度ページを更新してください。");
    }
  };

  // --- 保存・登録ハンドラー ---

  // 1. 自動処理設定の保存
  const handleSaveGeneral = async () => {
    const { error } = await supabase.from('profiles').update({
      auto_sales_matching: autoSalesMatching,
      allow_batch_matching: allowBatchMatching
    }).eq('id', shopId);

    if (!error) showMsg('自動処理・効率化設定を保存しました！');
    else alert('保存に失敗しました。');
  };

  // 2. 調整マスターの保存
  const handleAdjCatSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: newAdjCatName, shop_id: shopId, is_adjustment_cat: true };

    if (editingAdjCatId) {
      const oldCat = adjCategories.find(c => c.id === editingAdjCatId);
      await supabase.from('service_categories').update(payload).eq('id', editingAdjCatId);
      if (oldCat?.name && oldCat.name !== newAdjCatName) {
        await supabase.from('admin_adjustments').update({ category: newAdjCatName }).eq('shop_id', shopId).eq('category', oldCat.name);
      }
    } else {
      await supabase.from('service_categories').insert([{ ...payload, sort_order: adjCategories.length }]);
    }
    setNewAdjCatName(''); setEditingAdjCatId(null); fetchMasterDetails(); showMsg('調整カテゴリを更新しました');
  };
  
  const handleAdjItemSubmit = async (e) => {
    e.preventDefault();
    const finalCat = selectedAdjCat || (adjCategories[0]?.name || 'その他');
    const payload = {
      shop_id: shopId, category: finalCat, name: newAdjName, price: Number(adjValue),
      is_percent: adjType === 'percent', is_minus: adjType === 'minus' || adjType === 'percent', service_id: null
    };
    if (editingAdjId) await supabase.from('admin_adjustments').update(payload).eq('id', editingAdjId);
    else await supabase.from('admin_adjustments').insert([{ ...payload, sort_order: adjustments.length }]);
    
    setNewAdjName(''); setAdjValue(0); setEditingAdjId(null); fetchMasterDetails(); showMsg('調整項目を保存しました');
  };

  // 3. 店販商品の保存
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
    setNewProdCatName(''); setEditingProdCatId(null); fetchMasterDetails(); showMsg('商品カテゴリを更新しました');
  };
  
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const finalCat = selectedProdCat || (productCategories[0]?.name || '未分類');
    const payload = { shop_id: shopId, category: finalCat, name: newProdName, price: Number(newProdPrice) };
    
    if (editingProdId) await supabase.from('products').update(payload).eq('id', editingProdId);
    else await supabase.from('products').insert([{ ...payload, sort_order: products.length }]);
    
    setNewProdName(''); setNewProdPrice(0); setEditingProdId(null); fetchMasterDetails(); showMsg('商品を登録しました');
  };

  const containerStyle = { fontFamily: 'sans-serif', width: '100%', maxWidth: '100%', margin: '0 auto', padding: '30px 40px', paddingBottom: '120px', position: 'relative', boxSizing: 'border-box' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };

  return (
    <div style={containerStyle}>
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '30px' }}>
        <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: isPC ? '10px 20px' : '10px 12px', borderRadius: '30px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isPC ? '1rem' : '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', whiteSpace: 'nowrap' }}>
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ' : '戻る'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        タスク・お会計設定
      </h2>

      {/* 🚀 引っ越し：自動処理・効率化設定 */}
      <section style={{ ...cardStyle, borderLeft: `8px solid #3b82f6`, background: '#f8faff' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <RefreshCcw size={20} /> 自動処理・効率化設定
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1, paddingRight: '15px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>一括売上確定モード</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>ONにすると、未処理の予約をボタン一つで一括確定できるようになります。</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
            <input type="checkbox" checked={allowBatchMatching} onChange={(e) => setAllowBatchMatching(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: allowBatchMatching ? themeColor : '#cbd5e1', transition: '.3s', borderRadius: '34px' }}>
              <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: allowBatchMatching ? '28px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' }}></span>
            </span>
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, paddingRight: '15px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>自動売上確定モード（深夜自動）</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>ONにすると、深夜に未処理の予約を自動的に集計します。</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoSalesMatching} onChange={(e) => setAutoSalesMatching(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: autoSalesMatching ? themeColor : '#cbd5e1', transition: '.3s', borderRadius: '34px' }}>
              <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: autoSalesMatching ? '28px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' }}></span>
            </span>
          </label>
        </div>
      </section>

      {/* 👇 修正：BookingScheduleSettings と同じ、フッター固定＆横幅いっぱいのデザインに統一 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '24px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', zIndex: 1000 }}>
        <button onClick={handleSaveGeneral} style={{ width: '100%', maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '18px', background: themeColor, color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: `0 10px 25px ${themeColor}66`, cursor: 'pointer' }}>
          <Save size={22} /> 自動設定を保存 💾
        </button>
      </div>

      {/* 🚀 引っ越し：店販商品マスター管理 */}
      <div style={{ marginTop: '50px', borderTop: '6px solid #008000', paddingTop: '30px' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#1e293b', margin: '0 0 20px 0', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingBag size={24} color="#008000" /> 店販商品マスター管理
        </h2>

        <section style={{ ...cardStyle, background: '#f0fdf4', border: '2px solid #bbf7d0' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#008000', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Layers size={18} /> 商品カテゴリの作成</h3>
          <form onSubmit={handleProdCatSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input placeholder="例：シャンプー, スタイリング剤" value={newProdCatName} onChange={(e) => setNewProdCatName(e.target.value)} style={inputStyle} required />
            <button type="submit" style={{ padding: '0 25px', background: '#008000', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{editingProdCatId ? '更新' : '＋作成'}</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {productCategories.map((c, idx) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => moveItem('category', productCategories, c.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={16} /></button>
                  <button onClick={() => moveItem('category', productCategories, c.id, 'down')} disabled={idx === productCategories.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === productCategories.length - 1 ? 0.3 : 1 }}><ArrowDown size={16} /></button>
                  <button onClick={() => { setEditingProdCatId(c.id); setNewProdCatName(c.name); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}><Edit2 size={16} /></button>
                  <button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('products').delete().eq('category', c.name); await supabase.from('service_categories').delete().eq('id', c.id); fetchMasterDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444' }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section ref={prodFormRef} style={{ ...cardStyle, border: '2px solid #008000' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#008000', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Plus size={20} /> 商品の新規登録</h3>
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

        {productCategories.map(cat => (
          <div key={cat.id} style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#008000', fontSize: '0.9rem', marginBottom: '15px', borderLeft: '5px solid #008000', paddingLeft: '12px', fontWeight: 'bold' }}>{cat.name}</h4>
            {products.filter(p => p.category === cat.name).map((p, idx, filteredList) => (
              <div key={p.id} style={{ ...cardStyle, padding: '18px 25px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #bbf7d0' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{p.name}</div>
                  <div style={{ fontSize: '0.95rem', color: '#008000', fontWeight: 'bold', marginTop: '4px' }}>¥{(p.price || 0).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => moveItem('product', filteredList, p.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={20} /></button>
                  <button onClick={() => moveItem('product', filteredList, p.id, 'down')} disabled={idx === filteredList.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === filteredList.length - 1 ? 0.3 : 1 }}><ArrowDown size={20} /></button>
                  <button onClick={() => { setEditingProdId(p.id); setNewProdName(p.name); setNewProdPrice(p.price); setSelectedProdCat(p.category); prodFormRef.current?.scrollIntoView({ behavior: 'smooth' }); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#3b82f6' }}><Edit2 size={20} /></button>
                  <button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('products').delete().eq('id', p.id); fetchMasterDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#ef4444' }}><Trash2 size={20} /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 🚀 引っ越し：お会計調整マスター管理 */}
      <div style={{ marginTop: '50px', borderTop: '6px solid #ef4444', paddingTop: '30px' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#1e293b', margin: '0 0 20px 0', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings2 size={24} color="#ef4444" /> お会計調整マスター管理
        </h2>

        <section style={{ ...cardStyle, background: '#fff5f5', border: '2px solid #feb2b2' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Layers size={18} /> 調整カテゴリの作成</h3>
          <form onSubmit={handleAdjCatSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input placeholder="例：割引, キャンペーン" value={newAdjCatName} onChange={(e) => setNewAdjCatName(e.target.value)} style={inputStyle} required />
            <button type="submit" style={{ padding: '0 25px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{editingAdjCatId ? '更新' : '＋作成'}</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {adjCategories.map((c, idx) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => moveItem('category', adjCategories, c.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={16} /></button>
                  <button onClick={() => moveItem('category', adjCategories, c.id, 'down')} disabled={idx === adjCategories.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === adjCategories.length - 1 ? 0.3 : 1 }}><ArrowDown size={16} /></button>
                  <button onClick={() => { setEditingAdjCatId(c.id); setNewAdjCatName(c.name); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6' }}><Edit2 size={16} /></button>
                  <button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('admin_adjustments').delete().eq('category', c.name); await supabase.from('service_categories').delete().eq('id', c.id); fetchMasterDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444' }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section ref={adjFormRef} style={{ ...cardStyle, border: '2px solid #ef4444' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}><Plus size={20} /> 調整ボタンの登録</h3>
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
                  <button onClick={() => moveItem('adjustment', filteredList, adj.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === 0 ? 0.3 : 1 }}><ArrowUp size={20} /></button>
                  <button onClick={() => moveItem('adjustment', filteredList, adj.id, 'down')} disabled={idx === filteredList.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', opacity: idx === filteredList.length - 1 ? 0.3 : 1 }}><ArrowDown size={20} /></button>
                  <button onClick={() => { setEditingAdjId(adj.id); setNewAdjName(adj.name); setAdjValue(adj.price); setSelectedAdjCat(adj.category); adjFormRef.current?.scrollIntoView({ behavior: 'smooth' }); }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#3b82f6' }}><Edit2 size={20} /></button>
                  <button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('admin_adjustments').delete().eq('id', adj.id); fetchMasterDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', color: '#ef4444' }}><Trash2 size={20} /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

    </div>
  );
};

export default CheckoutSettings;