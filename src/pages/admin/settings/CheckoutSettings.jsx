import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  ArrowLeft, Save, Edit2, Trash2, ArrowUp, ArrowDown,
  Layers, Plus, Settings2, RefreshCcw, CheckCircle2, Globe
} from 'lucide-react';

const CheckoutSettings = ({ reloadPreview, setShowMobilePreview }) => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const adjFormRef = useRef(null);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900; 

  const [message, setMessage] = useState('');
  
  // --- 1. 自動処理設定用 ---
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [autoSalesMatching, setAutoSalesMatching] = useState(false);
  const [allowBatchMatching, setAllowBatchMatching] = useState(false);

  const [initialDataStr, setInitialDataStr] = useState(null);
  const [isDataReady, setIsDataReady] = useState(false);

  const currentDataStr = JSON.stringify({
    autoSalesMatching, allowBatchMatching
  });
  const hasChanges = initialDataStr !== null && initialDataStr !== currentDataStr;

  useEffect(() => {
    if (isDataReady) {
      setInitialDataStr(currentDataStr);
      setIsDataReady(false);
    }
  }, [isDataReady, currentDataStr]);

  // --- 2. お会計調整マスター用 ---
  const [adjustments, setAdjustments] = useState([]);      
  const [adjCategories, setAdjCategories] = useState([]);   
  const [newAdjCatName, setNewAdjCatName] = useState('');   
  const [editingAdjCatId, setEditingAdjCatId] = useState(null);
  const [selectedAdjCat, setSelectedAdjCat] = useState(''); 
  const [newAdjName, setNewAdjName] = useState('');         
  const [adjType, setAdjType] = useState('minus');          
  const [adjValue, setAdjValue] = useState(0);              
  const [editingAdjId, setEditingAdjId] = useState(null);

  useEffect(() => {
    if (shopId) {
      fetchGeneralSettings();
      fetchMasterDetails();
    }
  }, [shopId]);

  const fetchGeneralSettings = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setThemeColor(data.theme_color || '#2563eb');
      setAutoSalesMatching(data.auto_sales_matching || false);
      setAllowBatchMatching(data.allow_batch_matching || false);
      setIsDataReady(true);
    }
  };

  const fetchMasterDetails = async () => {
    const adjCatRes = await supabase.from('service_categories').select('*').eq('shop_id', shopId).eq('is_adjustment_cat', true).order('sort_order');
    const adjRes = await supabase.from('admin_adjustments').select('*').eq('shop_id', shopId).is('service_id', null).order('sort_order');

    if (adjCatRes.data) setAdjCategories(adjCatRes.data);
    if (adjRes.data) setAdjustments(adjRes.data);
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
    const table = type === 'category' ? 'service_categories' : 'admin_adjustments';

    try {
      const updates = [{ ...itemA, sort_order: itemB.sort_order }, { ...itemB, sort_order: itemA.sort_order }];
      const { error } = await supabase.from(table).upsert(updates);
      if (error) throw error;
      fetchMasterDetails();
    } catch (err) {
      alert("並び替えができませんでした。一度ページを更新してください。");
    }
  };

  const handleSaveGeneral = async () => {
    const { error } = await supabase.from('profiles').update({
      auto_sales_matching: autoSalesMatching,
      allow_batch_matching: allowBatchMatching
    }).eq('id', shopId);

    if (!error) {
      showMsg('自動処理・効率化設定を保存しました！');
      setInitialDataStr(currentDataStr);
    } else {
      alert('保存に失敗しました。');
    }
  };

  const handleAdjCatSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: newAdjCatName, shop_id: shopId, is_adjustment_cat: true };

    if (editingAdjCatId) {
      const oldCat = adjCategories.find(c => c.id === editingAdjCatId);
      await supabase.from('service_categories').update(payload).eq('id', editingAdjCatId);
      // 🔧 修正：同名の別カテゴリが他にもある場合、名前ベースの付け替えが別カテゴリの項目まで巻き込むため中止する
      const sameNameOthers = adjCategories.filter(c => c.id !== editingAdjCatId && c.name === oldCat?.name).length;
      if (oldCat?.name && oldCat.name !== newAdjCatName && sameNameOthers === 0) {
        await supabase.from('admin_adjustments').update({ category: newAdjCatName }).eq('shop_id', shopId).eq('category', oldCat.name);
      }
    } else {
      // 🔧 修正：配列の要素数ではなく、既存の最大sort_order+1を使うことで、削除後の重複を防ぐ
      const nextSortOrder = adjCategories.length > 0
        ? Math.max(...adjCategories.map(c => c.sort_order ?? 0)) + 1
        : 0;
      await supabase.from('service_categories').insert([{ ...payload, sort_order: nextSortOrder }]);
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
    else {
      // 🔧 修正：配列の要素数ではなく、既存の最大sort_order+1を使うことで、削除後の重複を防ぐ
      const nextSortOrder = adjustments.length > 0
        ? Math.max(...adjustments.map(a => a.sort_order ?? 0)) + 1
        : 0;
      await supabase.from('admin_adjustments').insert([{ ...payload, sort_order: nextSortOrder }]);
    }
    
    setNewAdjName(''); setAdjValue(0); setEditingAdjId(null); fetchMasterDetails(); showMsg('調整ボタンを保存しました');
  };

  const containerStyle = { fontFamily: 'sans-serif', width: '100%', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', position: 'relative', boxSizing: 'border-box' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };

  return (
    <div style={containerStyle}>
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {message}
        </div>
      )}

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        タスク・お会計設定
      </h2>

      <section style={{ ...cardStyle, borderLeft: `8px solid #3b82f6`, background: '#f8faff' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <RefreshCcw size={20} /> 自動処理・効率化設定
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1, paddingRight: '15px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>一括確定ボタンを表示する（手動）</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>ONにすると、未処理の予約をボタン一つで一括確定できるようになります。スタッフが手動で押す必要があります。</div>
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
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>毎日深夜に自動で確定する（放置OK）</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>ONにすると、深夜に未処理の予約を自動的に集計します。ボタンを押し忘れても翌朝には反映されています。</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoSalesMatching} onChange={(e) => setAutoSalesMatching(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: autoSalesMatching ? themeColor : '#cbd5e1', transition: '.3s', borderRadius: '34px' }}>
              <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: autoSalesMatching ? '28px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' }}></span>
            </span>
          </label>
        </div>
      </section>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: isPC ? '15px 20px' : '10px 15px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', zIndex: 1000 }}>
        <style>{`
          @keyframes pulse-btn {
            0% { transform: scale(1); box-shadow: 0 4px 15px ${themeColor}66; }
            50% { transform: scale(1.02); box-shadow: 0 4px 25px ${themeColor}99; }
            100% { transform: scale(1); box-shadow: 0 4px 15px ${themeColor}66; }
          }
        `}</style>
        {isPC ? (
          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ flex: '0 0 auto', padding: '15px 25px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={18} /> 戻る
            </button>
            <button 
              onClick={handleSaveGeneral} 
              disabled={!hasChanges} 
              style={{ 
                flex: 1, padding: '15px', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s',
                background: hasChanges ? themeColor : '#cbd5e1', 
                color: '#fff', 
                cursor: hasChanges ? 'pointer' : 'not-allowed', 
                animation: hasChanges ? 'pulse-btn 2s infinite' : 'none' 
              }}
            >
              <Save size={20} /> 保存する
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ flex: 1, padding: '10px 0', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>戻る</span>
            </button>
            <button 
              onClick={handleSaveGeneral} 
              disabled={!hasChanges} 
              style={{ 
                flex: 1.8, padding: '10px 0', border: 'none', borderRadius: '12px', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: '0.3s',
                background: hasChanges ? themeColor : '#cbd5e1', 
                color: '#fff', 
                cursor: hasChanges ? 'pointer' : 'not-allowed', 
                animation: hasChanges ? 'pulse-btn 2s infinite' : 'none' 
              }}
            >
              <Save size={20} />
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>保存する</span>
            </button>
            <button 
              onClick={() => {
                navigate(`?preview=tasks`, { replace: true });
                if (setShowMobilePreview) setShowMobilePreview(true);
              }} 
              style={{ flex: 1, padding: '10px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(37,99,235,0.4)' }}
            >
              <Globe size={20} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>プレビュー</span>
            </button>
          </div>
        )}
      </div>

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
                  <button onClick={async () => { 
                    // 🔧 修正：同名カテゴリが他にもある場合は、名前ベースの一括削除が別カテゴリを巻き込むため警告して止める
                    const sameNameCount = adjCategories.filter(other => other.name === c.name).length;
                    if (sameNameCount > 1) {
                      alert(`「${c.name}」という名前のカテゴリが複数存在するため、安全のため削除を中止しました。\n先にカテゴリ名を重複しないように変更してから、再度削除してください。`);
                      return;
                    }
                    if(window.confirm('削除しますか？')){ await supabase.from('admin_adjustments').delete().eq('category', c.name); await supabase.from('service_categories').delete().eq('id', c.id); fetchMasterDetails(); } 
                  }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444' }}><Trash2 size={16} /></button>
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
              {editingAdjId ? '調整ボタンを更新する' : '調整ボタンを新規登録'}
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