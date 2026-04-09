import React, { useEffect, useState, useRef, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  ChevronRight, ChevronLeft, Check, List, Tag, 
  Plus, Trash2, ShieldCheck, Link, ArrowUp, ArrowDown, 
  Layers, Eye, SkipForward, LayoutGrid, Clock, Smartphone, X, Settings2
} from 'lucide-react';

// --- 📋 スタイル定数 (ReferenceError防止) ---
const themeColorDefault = '#2563eb';
const inputBaseStyle = { width: '100%', padding: '16px', borderRadius: '14px', background: '#1e293b', border: '2px solid #334155', color: '#fff', fontSize: '1rem', marginBottom: '12px', boxSizing: 'border-box', outline: 'none' };

// --- 📦 独立フォームコンポーネント (フリーズ防止の要) ---

// 1. カテゴリフォーム
const CategoryForm = ({ onSaved, themeColor }) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
const handleSubmit = async () => {
  if(!name) return;
  await onSaved({ name }); // 名前だけ送る（url_keyは送らない）
  setName('');
};
  return (
    <div style={{width: '100%', marginBottom: '24px'}}>
      <input placeholder="カテゴリ名（例：カット）" style={inputBaseStyle} value={name} onChange={e => setName(e.target.value)} />
      <button onClick={handleSubmit} style={{...inputBaseStyle, background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold'}}>+ カテゴリを登録</button>
    </div>
  );
};

// 2. メニューフォーム (0-10コマ対応)
const ServiceForm = ({ categories, onSaved, themeColor, slotIntervalMin }) => {
  const [name, setName] = useState('');
  const [slots, setSlots] = useState(1);
  const [cat, setCat] = useState('');
  const handleSubmit = async () => {
    if(!name) return;
    await onSaved(name, slots, cat || categories[0]?.name);
    setName(''); setSlots(1);
  };
  return (
    <div style={{width: '100%', marginBottom: '32px'}}>
      <select value={cat} onChange={e => setCat(e.target.value)} style={inputBaseStyle}>
        <option value="">-- カテゴリ選択 --</option>
        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
      </select>
      <input placeholder="メニュー名" style={inputBaseStyle} value={name} onChange={e => setName(e.target.value)} />
      <div style={{textAlign: 'left', marginBottom: '12px'}}>
        <label style={{fontSize: '0.8rem', color: themeColor, fontWeight: 'bold'}}>必要コマ数: {slots}コマ（{slots * slotIntervalMin}分）</label>
        <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px'}}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n} onClick={() => setSlots(n)} style={{width: '38px', height: '38px', borderRadius: '8px', background: slots === n ? themeColor : '#1e293b', border: '1px solid #334155', color: '#fff', cursor: 'pointer', fontSize: '0.8rem'}}>{n}</button>
          ))}
        </div>
      </div>
      <button onClick={handleSubmit} style={{...inputBaseStyle, background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold'}}>+ メニューを保存</button>
    </div>
  );
};

// 3. 枝メニューフォーム (0-10コマ対応 & 履歴)
const BranchOptionForm = ({ activeService, onSaved, themeColor, existingGroups }) => {
  const [optGroupName, setOptGroupName] = useState('');
  const [optName, setOptName] = useState('');
  const [optSlots, setOptSlots] = useState(0);
  const handleSubmit = async () => {
    if (!optName || !activeService) return;
    await onSaved(activeService.id, optGroupName, optName, optSlots);
    setOptName(''); setOptSlots(0);
  };
  return (
    <div style={{background: '#1e293b', padding: '20px', borderRadius: '16px', width: '100%', boxSizing: 'border-box', textAlign: 'left', border: '1px solid #334155'}}>
      <label style={{fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', display: 'block'}}>枝カテゴリ (例: シャンプー)</label>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px'}}>
        {existingGroups.map(g => (
          <button key={g} onClick={() => setOptGroupName(g)} style={{background: '#334155', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '15px', fontSize: '0.7rem', cursor: 'pointer'}}>{g}</button>
        ))}
      </div>
      <input placeholder="枝カテゴリ名を入力" value={optGroupName} onChange={(e) => setOptGroupName(e.target.value)} style={inputBaseStyle} />
      <label style={{fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', display: 'block'}}>枝メニュー名</label>
      <input placeholder="枝メニュー名を入力" value={optName} onChange={(e) => setOptName(e.target.value)} style={inputBaseStyle} />
      <label style={{fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', display: 'block'}}>追加コマ数 (＋{optSlots}コマ)</label>
      <div style={{display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'16px'}}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button key={n} onClick={() => setOptSlots(n)} style={{width: '38px', height: '38px', borderRadius: '8px', background: optSlots === n ? themeColor : '#0f172a', color: '#fff', border: '1px solid #334155', cursor: 'pointer', fontSize: '0.8rem'}}>{n}</button>
        ))}
      </div>
      <button onClick={handleSubmit} style={{width: '100%', padding: '18px', borderRadius: '40px', background: themeColor, color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}><Plus size={20} /> 枝を追加</button>
    </div>
  );
};

// --- 🏛️ メインコンポーネント ---

const MenuSettingsGuide = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(0);
  const [shopData, setShopData] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [options, setOptions] = useState([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [slotIntervalMin, setSlotIntervalMin] = useState(30);
  const [showPreview, setShowPreview] = useState(false);
  const [activeServiceForOptions, setActiveServiceForOptions] = useState(null);

  const themeColor = shopData?.theme_color || themeColorDefault;
  const containerStyle = { minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif', width: '100%', display: 'flex', flexDirection: 'column' };

  useEffect(() => { if (shopId) { fetchInitialShopData(); fetchMenuDetails(); } }, [shopId]);

  const fetchInitialShopData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) { setShopData(data); setAllowMultiple(data.allow_multiple_services); setSlotIntervalMin(data.slot_interval_min || 30); }
  };

  const fetchMenuDetails = async () => {
    const catRes = await supabase.from('service_categories').select('*').eq('shop_id', shopId).order('sort_order', { ascending: true });
    const servRes = await supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order', { ascending: true });
    const optRes = await supabase.from('service_options').select('*'); 
    if (catRes.data) setCategories(catRes.data);
    if (servRes.data) setServices(servRes.data);
    if (optRes.data) setOptions(optRes.data);
  };

  // --- アクション ---
  const saveCategory = async (payload) => {
    await supabase.from('service_categories').insert([{ ...payload, shop_id: shopId, sort_order: categories.length }]);
    fetchMenuDetails();
  };
  const saveService = async (name, slots, category) => {
    await supabase.from('services').insert([{ shop_id: shopId, name, slots, category, sort_order: services.length }]);
    fetchMenuDetails();
  };
  const saveOption = async (service_id, group_name, option_name, additional_slots) => {
    await supabase.from('service_options').insert([{ service_id, group_name, option_name, additional_slots }]);
    fetchMenuDetails();
  };
  const moveItem = async (type, list, id, direction) => {
    const idx = list.findIndex(item => item.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const newList = [...list]; const [moved] = newList.splice(idx, 1); newList.splice(targetIdx, 0, moved);
    await supabase.from(type === 'category' ? 'service_categories' : 'services').upsert(newList.map((item, i) => ({ id: item.id, shop_id: shopId, sort_order: i, name: item.name, ...(type === 'service' ? { slots: item.slots, category: item.category } : {}) })));
    fetchMenuDetails();
  };
  const handleToggleLink = async (catId, targetName, field) => {
    const cat = categories.find(c => c.id === catId);
    let current = cat[field] ? cat[field].split(',').map(s => s.trim()).filter(s => s) : [];
    current = current.includes(targetName) ? current.filter(n => n !== targetName) : [...current, targetName];
    await supabase.from('service_categories').update({ [field]: current.join(',') }).eq('id', catId);
    fetchMenuDetails();
  };

  const handleNext = () => { window.scrollTo(0,0); setStep(s => s + 1); };
  const handleBack = () => { window.scrollTo(0,0); setStep(s => s - 1); };

  // --- 📱 デモ画面 ---
  const MockPreviewModal = () => {
    const [mockSelected, setMockSelected] = useState([]);
    const [mockOpts, setMockOpts] = useState({});
    const previewRefs = useRef({});
    const toggleMock = (service, idx) => {
      const isSel = mockSelected.find(s => s.id === service.id);
      const hasOpts = options.some(o => o.service_id === service.id);
      let nextSelection = isSel ? mockSelected.filter(s => s.id !== service.id) : (allowMultiple ? [...mockSelected, service] : [service]);
      if (!allowMultiple && !isSel) setMockOpts({});
      setMockSelected(nextSelection);
      if (!isSel) {
        const targetId = hasOpts ? service.id : categories[idx + 1]?.id;
        if (targetId) setTimeout(() => previewRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
      }
    };
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#f8fafc', width: '100%', maxWidth: '375px', height: '85vh', borderRadius: '40px', overflow: 'hidden', position: 'relative', border: '8px solid #334155', display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => setShowPreview(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#fff', border: '1px solid #ddd', borderRadius: '50%', padding: '8px', zIndex: 20, cursor: 'pointer' }}><X size={20}/></button>
          <div style={{ flex: 1, overflowY: 'auto', padding: '60px 20px 20px', color: '#333' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '30px', textAlign: 'center' }}>{shopData?.business_name || '美容室SnipSnap'}</h4>
            {categories.map((cat, catIdx) => (
              <div key={cat.id} ref={el => previewRefs.current[cat.id] = el} style={{ marginBottom: '35px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: themeColor, borderBottom: `2px solid ${themeColor}`, marginBottom: '12px', display: 'inline-block' }}>{cat.name}</div>
                {services.filter(s => s.category === cat.name).map(s => {
                  const isSel = mockSelected.find(ms => ms.id === s.id);
                  const grouped = options.filter(o => o.service_id === s.id).reduce((acc, o) => ({ ...acc, [o.group_name]: [...(acc[o.group_name] || []), o] }), {});
                  return (
                    <div key={s.id} ref={el => previewRefs.current[s.id] = el} style={{ marginBottom: '8px', borderRadius: '12px', border: isSel ? `2px solid ${themeColor}` : '1px solid #ddd', background: '#fff', overflow: 'hidden' }}>
                      <button onClick={() => toggleMock(s, catIdx)} style={{ width: '100%', padding: '16px', border: 'none', background: 'none', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <div style={{ width: '20px', height: '20px', border: `2px solid ${themeColor}`, borderRadius: '50%', background: isSel ? themeColor : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{isSel && '✓'}</div>
                        <div style={{flex:1}}><div style={{fontWeight: 'bold', fontSize: '0.9rem'}}>{s.name}</div><div style={{fontSize: '0.7rem', color: '#64748b'}}>{s.slots * slotIntervalMin}分</div></div>
                      </button>
                      {isSel && Object.keys(grouped).length > 0 && (
                        <div style={{ padding: '0 15px 15px', background: '#f8fafc' }}>
                          {Object.entries(grouped).map(([gn, opts]) => (
                            <div key={gn} style={{ marginTop: '10px' }}>
                              <p style={{ fontSize: '0.7rem', color: '#475569' }}>└ {gn || 'オプション'}</p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {opts.map(o => {
                                  const isOptSel = mockOpts[`${s.id}-${gn}`]?.id === o.id;
                                  return <button key={o.id} onClick={() => setMockOpts({...mockOpts, [`${s.id}-${gn}`]: o})} style={{ padding: '10px 5px', borderRadius: '8px', border: isOptSel ? `2px solid ${themeColor}` : '1px solid #cbd5e1', background: isOptSel ? themeColor : '#fff', color: isOptSel ? '#fff' : '#475569', fontSize: '0.8rem', cursor: 'pointer' }}>{o.option_name}</button>
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
            ))}
          </div>
          <div style={{ padding: '20px', background: 'rgba(255,255,255,0.98)', borderTop: '1px solid #e2e8f0', boxShadow: '0 -4px 15px rgba(0,0,0,0.05)' }}>
            <button style={{ width: '100%', padding: '16px', background: mockSelected.length > 0 ? themeColor : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>日時選択へ進む</button>
          </div>
        </div>
      </div>
    );
  };

  const StepWrapper = ({ title, icon: Icon, children, isLast = false }) => (
    <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto', textAlign: 'center', padding: '100px 20px 40px', boxSizing: 'border-box', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
      <Icon size={60} color={themeColor} style={{marginBottom:'24px', alignSelf: 'center'}} />
      <h2 style={{fontSize: '1.6rem', marginBottom: '24px'}}>{title}</h2>
      {children}
      {!isLast && <button style={{width: '100%', padding: '18px', borderRadius: '40px', background: themeColor, color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '32px'}} onClick={handleNext}>次へ進む <ChevronRight size={20} /></button>}
      {!isLast && <button style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', marginTop: '20px' }} onClick={handleNext}>スキップ（※後で設定できます） <SkipForward size={14} /></button>}
      {step >= 2 && <button onClick={() => setShowPreview(true)} style={{ position: 'fixed', bottom: '30px', right: '20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '50%', width: '56px', height: '56px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}><Smartphone size={28} /></button>}
    </div>
  );

  const renderStep = () => {
    switch(step) {
      case 0: return (
        <StepWrapper title="1コマの単位を決めましょう。" icon={Clock}>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            {[10, 15, 20, 30].map(min => <button key={min} onClick={async () => { setSlotIntervalMin(min); await supabase.from('profiles').update({ slot_interval_min: min }).eq('id', shopId); }} style={{ flex: 1, padding: '14px 5px', background: slotIntervalMin === min ? themeColor : '#1e293b', color: '#fff', border: `2px solid ${slotIntervalMin === min ? themeColor : '#334155'}`, borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{min}分</button>)}
          </div>
        </StepWrapper>
      );
      case 1: return (
        <StepWrapper title="複数のカテゴリを選べますか？" icon={ShieldCheck}>
          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '20px', border: `1px solid ${themeColor}`, cursor: 'pointer' }} onClick={async () => { const val = !allowMultiple; setAllowMultiple(val); await supabase.from('profiles').update({ allow_multiple_services: val }).eq('id', shopId); }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '28px', height: '28px', border: `2px solid ${themeColor}`, background: allowMultiple ? themeColor : 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{allowMultiple && <Check size={20}/>}</div>
              <span style={{fontWeight: 'bold'}}>複数のカテゴリ選択を許可する</span>
            </div>
          </div>
        </StepWrapper>
      );
      case 2: return (
        <StepWrapper title="カテゴリを作りましょう。" icon={LayoutGrid}>
          <CategoryForm onSaved={saveCategory} themeColor={themeColor} />
          <div style={{marginTop: '20px', textAlign: 'left', width: '100%'}}>
            {categories.map(c => <div key={c.id} style={{background: '#1e293b', padding: '12px', borderRadius: '10px', marginBottom: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between'}}><span>{c.name}</span><button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('service_categories').delete().eq('id', c.id); fetchMenuDetails(); } }} style={{background:'none', border:'none', color:'#ef4444'}}><Trash2 size={16}/></button></div>)}
          </div>
        </StepWrapper>
      );
      case 3: return (
        <StepWrapper title="メニューを追加しましょう。" icon={Tag}>
          <ServiceForm categories={categories} onSaved={saveService} themeColor={themeColor} slotIntervalMin={slotIntervalMin} />
          {/* ✅ 修正：カテゴリ別に整理されたリスト表示 */}
          <div style={{marginTop: '20px'}}>
            {categories.map(cat => {
              const catServices = services.filter(s => s.category === cat.name);
              if (catServices.length === 0) return null;
              return (
                <div key={cat.id} style={{textAlign: 'left', marginBottom: '20px'}}>
                  <h4 style={{fontSize: '0.8rem', color: themeColor, borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '8px'}}>{cat.name}</h4>
                  {catServices.map(s => (
                    <div key={s.id} style={{background: '#1e293b', padding: '12px', borderRadius: '10px', marginBottom: '6px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div style={{fontSize: '0.85rem'}}><span>{s.name}</span><span style={{color: '#94a3b8', marginLeft: '8px', fontSize: '0.7rem'}}>({s.slots}コマ / {s.slots * slotIntervalMin}分)</span></div>
                      <button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('services').delete().eq('id', s.id); fetchMenuDetails(); } }} style={{background:'none', border:'none', color:'#ef4444'}}><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </StepWrapper>
      );
      case 4: return (
        <StepWrapper title="枝メニューの設定" icon={Plus}>
          <select style={inputBaseStyle} value={activeServiceForOptions?.id || ''} onChange={(e) => setActiveServiceForOptions(services.find(s => s.id === e.target.value))}>
            <option value="">-- 対象メニューを選択 --</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {activeServiceForOptions && <BranchOptionForm activeService={activeServiceForOptions} onSaved={saveOption} themeColor={themeColor} existingGroups={Array.from(new Set(options.map(o => o.group_name).filter(g => g)))} />}
          <div style={{marginTop: '20px', textAlign: 'left'}}>
            {activeServiceForOptions && options.filter(o => o.service_id === activeServiceForOptions.id).map(o => (
              <div key={o.id} style={{fontSize: '0.85rem', padding: '12px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)'}}><span>{o.group_name} ❯ {o.option_name} (+{o.additional_slots}コマ)</span><button onClick={async () => { await supabase.from('service_options').delete().eq('id', o.id); fetchMenuDetails(); }} style={{color: '#ef4444', border: 'none', background: 'none'}}><Trash2 size={16}/></button></div>
            ))}
          </div>
        </StepWrapper>
      );
      case 5: return (
        <StepWrapper title="カテゴリ内ルール" icon={Settings2}>
          {categories.map(c => <div key={c.id} style={{background: '#1e293b', padding: '16px', borderRadius: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155'}}><span style={{fontWeight: 'bold'}}>{c.name}</span><button onClick={async () => { await supabase.from('service_categories').update({ allow_multiple_in_category: !c.allow_multiple_in_category }).eq('id', c.id); fetchMenuDetails(); }} style={{padding: '8px 16px', background: c.allow_multiple_in_category ? themeColor : '#334155', borderRadius: '20px', color: '#fff', fontSize: '0.8rem', border: 'none', cursor: 'pointer'}}>{c.allow_multiple_in_category ? '複数可' : '1つのみ'}</button></div>)}
        </StepWrapper>
      );
      case 6: return (
        <StepWrapper title="連動設定" icon={Link}>
          {categories.map(c => (
            <div key={c.id} style={{background: '#1e293b', padding: '16px', borderRadius: '16px', marginBottom: '12px', textAlign: 'left', border: '1px solid #334155'}}>
              <h3 style={{fontSize: '0.9rem', color: themeColor, marginBottom: '10px'}}>❯ {c.name}</h3>
              <div style={{fontSize: '0.7rem', color: '#ef4444', marginBottom: '5px'}}>🚫 無効化：</div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px'}}>{categories.filter(t => t.id !== c.id).map(t => { const isD = c.disable_categories?.split(',').includes(t.name); return <button key={t.id} onClick={() => handleToggleLink(c.id, t.name, 'disable_categories')} style={{fontSize: '0.65rem', padding: '5px 10px', borderRadius: '15px', border: '1px solid', borderColor: isD ? '#ef4444' : '#334155', background: isD ? '#7f1d1d' : 'none', color: '#fff', cursor: 'pointer'}}>{t.name}</button> })}</div>
              <div style={{fontSize: '0.7rem', color: '#3b82f6', marginBottom: '5px'}}>✅ 必須化：</div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px'}}>{categories.filter(t => t.id !== c.id).map(t => { const isR = c.required_categories?.split(',').includes(t.name); return <button key={t.id} onClick={() => handleToggleLink(c.id, t.name, 'required_categories')} style={{fontSize: '0.65rem', padding: '5px 10px', borderRadius: '15px', border: '1px solid', borderColor: isR ? '#3b82f6' : '#334155', background: isR ? '#1e3a8a' : 'none', color: '#fff', cursor: 'pointer'}}>{t.name}</button> })}</div>
            </div>
          ))}
        </StepWrapper>
      );
      case 7: return (
        <StepWrapper title="並び順調整" icon={Layers}>
          {categories.map((c, idx) => <div key={c.id} style={{background: '#1e293b', padding: '12px 20px', borderRadius: '12px', marginBottom: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><span style={{fontWeight: 'bold'}}>{c.name}</span><div style={{display: 'flex', gap: '8px'}}><button onClick={() => moveItem('category', categories, c.id, 'up')} disabled={idx === 0} style={{padding: '8px', background: '#334155', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer'}}><ArrowUp size={16}/></button><button onClick={() => moveItem('category', categories, c.id, 'down')} disabled={idx === categories.length - 1} style={{padding: '8px', background: '#334155', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer'}}><ArrowDown size={16}/></button></div></div>)}
        </StepWrapper>
      );
      case 8: return (
        <StepWrapper title="設定完了！" icon={Check} isLast={true}>
          {/* ✅ 修正：最後のステップでは次へ進むボタンを非表示 */}
          <div style={{background: '#1e293b', padding: '30px', borderRadius: '24px', border: '2px solid #10b981'}}><p style={{fontSize: '1rem', color: '#10b981', fontWeight: 'bold'}}>すべての準備が整いました。</p><p style={{fontSize: '0.8rem', color: '#94a3b8', marginTop: '12px'}}>最後にスマホボタンから実際の動きをチェックしましょう！</p></div>
          <button style={{ width: '100%', padding: '18px', borderRadius: '40px', background: '#10b981', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', marginTop: '40px' }} onClick={() => navigate(`/admin/${shopId}/dashboard`)}>冒険を始める</button>
        </StepWrapper>
      );
      default: return null;
    }
  };

  return (
    <div style={containerStyle}>
      {showPreview && <MockPreviewModal />}
      <div style={{ width: '100%', height: '6px', background: '#334155', position: 'fixed', top: 0, left: 0, zIndex: 100 }}><div style={{ width: `${((step + 1) / 9) * 100}%`, height: '100%', background: themeColor, transition: '0.4s' }} /></div>
      {step > 0 && step < 8 && (<div style={{ position: 'fixed', top: '24px', left: '24px', zIndex: 110 }}><button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '44px', height: '44px', cursor: 'pointer' }} onClick={handleBack}><ChevronLeft size={24} /></button></div>)}
      {renderStep()}
    </div>
  );
};

export default MenuSettingsGuide;