import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../supabaseClient';
import { Swords, Shield, Plus, Trash2, Edit2, X, LogOut, BookOpen, Layers } from 'lucide-react';

const GameMasterDashboard = () => {
  const navigate = useNavigate();
  // 'units' | 'items' | 'skills'
  const [activeTab, setActiveTab] = useState('units');
  
  const [units, setUnits] = useState([]);
  const [items, setItems] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');

  // フォーム初期状態（★RO仕様: 6大ステータス ＆ SP ＆ スロット数）
  const [unitForm, setUnitForm] = useState({
    name: '', unit_type: 'playable', is_tamable: false, race: '人間', job: 'ノービス', description: '',
    base_level: 1, reward_exp: 10, reward_gold: 10, base_hp: 100, base_sp: 10,
    stat_str: 1, stat_agi: 1, stat_vit: 1, stat_int: 1, stat_dex: 1, stat_luk: 1,
    equip_right_hand: '', equip_left_hand: '', equip_head: '', equip_body: '', equip_arm: '', equip_foot: '', equip_accessory: '',
    extra_drop_item: '', extra_drop_chance: 0, skill_01: '', skill_02: '', skill_03: ''
  });

  const [itemForm, setItemForm] = useState({
    name: '', item_type: 'weapon', item_subtype: '剣', weapon_range: 'S', slot_count: 0, rarity: 'common', sell_price: 100, description: ''
  });

  const [skillForm, setSkillForm] = useState({
    name: '', skill_type: 'magic', sp_cost: 0, effect_value: 0, description: ''
  });

  // ROの世界観に合わせた初期サジェスト
  const [existingRaces, setExistingRaces] = useState(['人間', '植物', '動物', '昆虫', '悪魔', '不死']);
  const [existingJobs, setExistingJobs] = useState(['ノービス', 'ソードマン', 'マジシャン', 'アコライト', 'シーフ', 'アーチャー', 'マーチャント']);
  const [existingSubtypes, setExistingSubtypes] = useState(['剣', '短剣', '槍', '杖', '弓', '盾', '頭', '胴', '腕', '足', '装飾', 'カード']);

  const handleBackToLogin = () => {
    if (window.confirm("ゲームマスターツールを終了してログイン画面に戻りますか？")) {
      navigate('/');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.from('game_master_units').select('*').order('created_at', { ascending: false });
      const { data: i } = await supabase.from('game_master_items').select('*').order('created_at', { ascending: false });
      const { data: s } = await supabase.from('game_master_skills').select('*').order('created_at', { ascending: false });
      
      if (u) {
        setUnits(u);
        const races = Array.from(new Set(u.map(item => item.race).filter(Boolean)));
        const jobs = Array.from(new Set(u.map(item => item.job).filter(Boolean)));
        if (races.length > 0) setExistingRaces(races);
        if (jobs.length > 0) setExistingJobs(jobs);
      }
      if (i) {
        setItems(i);
        const subtypes = Array.from(new Set(i.map(item => item.item_subtype).filter(Boolean)));
        if (subtypes.length > 0) setExistingSubtypes(subtypes);
      }
      if (s) setSkills(s);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    const finalId = isEditing ? editId : `unit_${Date.now()}`;
    try {
      const { error } = await supabase.from('game_master_units').upsert({
        id: finalId, ...unitForm,
        is_tamable: unitForm.unit_type === 'enemy' ? unitForm.is_tamable : false,
        base_level: Number(unitForm.base_level), reward_exp: Number(unitForm.reward_exp), reward_gold: Number(unitForm.reward_gold),
        base_hp: Number(unitForm.base_hp), base_sp: Number(unitForm.base_sp),
        stat_str: Number(unitForm.stat_str), stat_agi: Number(unitForm.stat_agi), stat_vit: Number(unitForm.stat_vit),
        stat_int: Number(unitForm.stat_int), stat_dex: Number(unitForm.stat_dex), stat_luk: Number(unitForm.stat_luk),
        extra_drop_chance: Number(unitForm.extra_drop_chance),
        equip_right_hand: unitForm.equip_right_hand || null,
        equip_left_hand: unitForm.equip_left_hand || null,
        equip_head: unitForm.equip_head || null,
        equip_body: unitForm.equip_body || null,
        equip_arm: unitForm.equip_arm || null,
        equip_foot: unitForm.equip_foot || null,
        equip_accessory: unitForm.equip_accessory || null,
        extra_drop_item: unitForm.extra_drop_item || null,
        skill_01: unitForm.skill_01 || null, skill_02: unitForm.skill_02 || null, skill_03: unitForm.skill_03 || null
      });
      if (error) throw error;
      alert('RO式ユニットデータを保存しました！');
      resetUnitForm(); fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    const finalId = isEditing ? editId : `item_${Date.now()}`;
    try {
      const { error } = await supabase.from('game_master_items').upsert({ 
        id: finalId, 
        ...itemForm, 
        slot_count: Number(itemForm.slot_count),
        sell_price: Number(itemForm.sell_price) 
      });
      if (error) throw error;
      alert('アイテムデータを創造しました！');
      resetItemForm(); fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleSkillSubmit = async (e) => {
    e.preventDefault();
    const finalId = isEditing ? editId : `skill_${Date.now()}`;
    try {
      const { error } = await supabase.from('game_master_skills').upsert({ 
        id: finalId, 
        ...skillForm, 
        sp_cost: Number(skillForm.sp_cost), 
        effect_value: Number(skillForm.effect_value) 
      });
      if (error) throw error;
      alert('スキル技能を創造しました！');
      resetSkillForm(); fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (table, id) => {
    if (!window.confirm(`本当に削除しますか？`)) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) { alert('削除失敗: 他のデータと紐づいています。'); }
  };

  const startEditUnit = (unit) => { 
    setIsEditing(true); 
    setEditId(unit.id); 
    setUnitForm({ 
      ...unit, 
      equip_right_hand: unit.equip_right_hand || '', 
      equip_left_hand: unit.equip_left_hand || '', 
      equip_head: unit.equip_head || '', 
      equip_body: unit.equip_body || '', 
      equip_arm: unit.equip_arm || '', 
      equip_foot: unit.equip_foot || '', 
      equip_accessory: unit.equip_accessory || '', 
      extra_drop_item: unit.extra_drop_item || '', 
      skill_01: unit.skill_01 || '', 
      skill_02: unit.skill_02 || '', 
      skill_03: unit.skill_03 || '' 
    }); 
  };
  
  const startEditItem = (item) => { setIsEditing(true); setEditId(item.id); setItemForm({ ...item }); };
  const startEditSkill = (skill) => { setIsEditing(true); setEditId(skill.id); setSkillForm({ ...skill }); };

  const resetUnitForm = () => { 
    setIsEditing(false); 
    setEditId(''); 
    setUnitForm({ 
      name: '', unit_type: 'playable', is_tamable: false, race: '人間', job: 'ノービス', description: '', 
      base_level: 1, reward_exp: 10, reward_gold: 10, base_hp: 100, base_sp: 10, 
      stat_str: 1, stat_agi: 1, stat_vit: 1, stat_int: 1, stat_dex: 1, stat_luk: 1, 
      equip_right_hand: '', equip_left_hand: '', equip_head: '', equip_body: '', equip_arm: '', equip_foot: '', equip_accessory: '', 
      extra_drop_item: '', extra_drop_chance: 0, skill_01: '', skill_02: '', skill_03: '' 
    }); 
  };
  
  const resetItemForm = () => { setIsEditing(false); setEditId(''); setItemForm({ name: '', item_type: 'weapon', item_subtype: '剣', weapon_range: 'S', slot_count: 0, rarity: 'common', sell_price: 100, description: '' }); };
  const resetSkillForm = () => { setIsEditing(false); setEditId(''); setSkillForm({ name: '', skill_type: 'magic', sp_cost: 0, effect_value: 0, description: '' }); };

  return (
    <div style={{ backgroundColor: '#0b0f19', minHeight: '100vh', color: '#f1f5f9', padding: '3vw', boxSizing: 'border-box' }}>
      <style>{`
        .gm-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 25px; max-width: 1400px; margin: 0 auto; }
        .gm-flex-head { display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto 25px; border-bottom: 2px solid #1e293b; padding-bottom: 15px; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #0b0f19; padding: 10px; border-radius: 8px; border: 1px solid #1e293b; }
        .equip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; background: #0b0f19; padding: 10px; border-radius: 8px; border: 1px solid #1e293b; }
        .suggest-tag { background: #1e293b; color: #ccc; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; cursor: pointer; border: 1px solid #334155; }
        .suggest-tag:hover { border-color: #f59e0b; color: #f59e0b; }
        @media (max-width: 1024px) { .gm-grid { grid-template-columns: 1fr; } .gm-flex-head { flex-direction: column; align-items: flex-start; gap: 15px; } .equip-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* タイトルトップ */}
      <div className="gm-flex-head">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>🔮 QUEST HUB - RO EDITION GM CONTROL</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>創世神専用：純度100%ラグナロク式6大基本ステータス ✕ 穴あきスロット創造システム</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: '#1e293b', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', color: '#a78bfa', whiteSpace: 'nowrap' }}>特権: 世界創生神</div>
          <button onClick={handleBackToLogin} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}><LogOut size={14} /> 終了</button>
        </div>
      </div>

      <div className="gm-grid">
        {/* 左側フォーム領域 */}
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', height: 'fit-content' }}>
          
          {!isEditing && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '15px', background: '#0b0f19', padding: '4px', borderRadius: '8px' }}>
              <button type="button" onClick={() => setActiveTab('units')} style={{ flex: 1, padding: '8px 2px', background: activeTab === 'units' ? '#1e293b' : 'none', color: activeTab === 'units' ? '#f59e0b' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>① ユニット創造</button>
              <button type="button" onClick={() => setActiveTab('items')} style={{ flex: 1, padding: '8px 2px', background: activeTab === 'items' ? '#1e293b' : 'none', color: activeTab === 'items' ? '#f59e0b' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>② 武具アイテム創造</button>
              <button type="button" onClick={() => setActiveTab('skills')} style={{ flex: 1, padding: '8px 2px', background: activeTab === 'skills' ? '#1e293b' : 'none', color: activeTab === 'skills' ? '#f59e0b' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>③ スキル特技創造</button>
            </div>
          )}

          {/* タブ1: ユニットフォーム */}
          {activeTab === 'units' && (
            <form onSubmit={handleUnitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>所属側（大分類）</label>
                  <select value={unitForm.unit_type} onChange={(e) => setUnitForm({...unitForm, unit_type: e.target.value})} style={inputStyle}>
                    <option value="playable">プレイヤー側（仲間キャラクター）</option>
                    <option value="enemy">エネミー側（敵モンスター・テイム可含む）</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>名前</label>
                  <input type="text" required placeholder="例: オークジェネラル" value={unitForm.name} onChange={(e) => setUnitForm({...unitForm, name: e.target.value})} style={inputStyle} />
                </div>
              </div>

              {/* 種族・職業サジェスト */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>種族属性 (RO属性)</label>
                  <input type="text" required value={unitForm.race} onChange={(e) => setUnitForm({...unitForm, race: e.target.value})} style={inputStyle} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {existingRaces.map(r => <span key={r} onClick={() => setUnitForm({...unitForm, race: r})} className="suggest-tag">{r}</span>)}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>職業・クラス (ROジョブ)</label>
                  <input type="text" required value={unitForm.job} onChange={(e) => setUnitForm({...unitForm, job: e.target.value})} style={inputStyle} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {existingJobs.map(j => <span key={j} onClick={() => setUnitForm({...unitForm, job: j})} className="suggest-tag">{j}</span>)}
                  </div>
                </div>
              </div>

              {/* 基本性能・報酬 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: '#0b0f19', padding: '10px', borderRadius: '8px' }}>
                <div><label style={labelStyle}>初期ベースレベル</label><input type="number" min="1" value={unitForm.base_level} onChange={(e) => setUnitForm({...unitForm, base_level: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>討伐獲得EXP</label><input type="number" value={unitForm.reward_exp} onChange={(e) => setUnitForm({...unitForm, reward_exp: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>討伐獲得ゴールド</label><input type="number" value={unitForm.reward_gold} onChange={(e) => setUnitForm({...unitForm, reward_gold: e.target.value})} style={inputStyle} /></div>
              </div>

              {unitForm.unit_type === 'enemy' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#052e16', padding: '8px', borderRadius: '8px', border: '1px solid #10b981' }}>
                  <input type="checkbox" id="tamable" checked={unitForm.is_tamable} onChange={(e) => setUnitForm({...unitForm, is_tamable: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                  <label htmlFor="tamable" style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 'bold' }}>★ 探索中にテイム（手なずけて仲間に加える）を可能にする</label>
                </div>
              )}

              {/* 7部位装備設定 */}
              <div>
                <label style={{ ...labelStyle, color: '#a78bfa', marginBottom: '4px' }}>🛡️ 7部位装備品スロット設定</label>
                <div className="equip-grid">
                  <div>
                    <label style={labelStyle}>①右手（メイン武器）</label>
                    <select value={unitForm.equip_right_hand} onChange={(e) => setUnitForm({...unitForm, equip_right_hand: e.target.value})} style={inputStyle}>
                      <option value="">素手 / 未装備</option>
                      {items.filter(i => i.item_type === 'weapon').map(i => <option key={i.id} value={i.id}>{i.name} [{i.weapon_range}]</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>②左手（盾・副武器）</label>
                    <select value={unitForm.equip_left_hand} onChange={(e) => setUnitForm({...unitForm, equip_left_hand: e.target.value})} style={inputStyle}>
                      <option value="">なし / 未装備</option>
                      {items.filter(i => i.item_subtype === '盾' || i.item_type === 'weapon').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>③頭部防具</label>
                    <select value={unitForm.equip_head} onChange={(e) => setUnitForm({...unitForm, equip_head: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '頭' || i.item_subtype === '兜').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>④胴部甲冑</label>
                    <select value={unitForm.equip_body} onChange={(e) => setUnitForm({...unitForm, equip_body: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '胴' || i.item_subtype === '鎧').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>⑤腕部篭手</label>
                    <select value={unitForm.equip_arm} onChange={(e) => setUnitForm({...unitForm, equip_arm: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '腕' || i.item_subtype === '肩').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>⑥足部具足</label>
                    <select value={unitForm.equip_foot} onChange={(e) => setUnitForm({...unitForm, equip_foot: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '足' || i.item_subtype === '靴').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>⑦装飾（アクセサリー）</label>
                    <select value={unitForm.equip_accessory} onChange={(e) => setUnitForm({...unitForm, equip_accessory: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '装飾' || i.item_type === 'special').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* 追加ドロップ */}
              <div style={{ background: '#0b0f19', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', gap: '8px' }}>
                <div style={{ flex: 2 }}><label style={labelStyle}>追加戦利品（レアカードや消耗品ドロップ用）</label>
                  <select value={unitForm.extra_drop_item} onChange={(e) => setUnitForm({...unitForm, extra_drop_item: e.target.value})} style={inputStyle}>
                    <option value="">なし</option>{items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_subtype})</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}><label style={labelStyle}>確率 (%)</label><input type="number" step="0.01" min="0" max="100" value={unitForm.extra_drop_chance} onChange={(e) => setUnitForm({...unitForm, extra_drop_chance: e.target.value})} style={inputStyle} /></div>
              </div>

              {/* 👑 純度100% ラグナロクオンライン式6大基本能力値パネル */}
              <div>
                <label style={{ ...labelStyle, color: '#f59e0b', marginBottom: '4px' }}>📊 ラグナロクオンライン式 6大基本ステータス設定</label>
                <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  <div style={{ gridColumn: 'span 2' }}><label style={{...labelStyle, color: '#f43f5e'}}>MHP (最大HP)</label><input type="number" value={unitForm.base_hp} onChange={(e) => setUnitForm({...unitForm, base_hp: e.target.value})} style={inputStyle} /></div>
                  <div style={{ gridColumn: 'span 2' }}><label style={{...labelStyle, color: '#38bdf8'}}>MSP (最大SP)</label><input type="number" value={unitForm.base_sp} onChange={(e) => setUnitForm({...unitForm, base_sp: e.target.value})} style={inputStyle} /></div>
                  
                  <div><label style={labelStyle}>STR (攻撃/重量)</label><input type="number" min="1" max="99" value={unitForm.stat_str} onChange={(e) => setUnitForm({...unitForm, stat_str: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>AGI (回避/速度)</label><input type="number" min="1" max="99" value={unitForm.stat_agi} onChange={(e) => setUnitForm({...unitForm, stat_agi: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>VIT (体力/耐久)</label><input type="number" min="1" max="99" value={unitForm.stat_vit} onChange={(e) => setUnitForm({...unitForm, stat_vit: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>INT (魔法/魔防)</label><input type="number" min="1" max="99" value={unitForm.stat_int} onChange={(e) => setUnitForm({...unitForm, stat_int: e.target.value})} style={inputStyle} /></div>
                  
                  <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>DEX (命中/詠唱短縮)</label><input type="number" min="1" max="99" value={unitForm.stat_dex} onChange={(e) => setUnitForm({...unitForm, stat_dex: e.target.value})} style={inputStyle} /></div>
                  <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>LUK (幸運/クリティカル)</label><input type="number" min="1" max="99" value={unitForm.stat_luk} onChange={(e) => setUnitForm({...unitForm, stat_luk: e.target.value})} style={inputStyle} /></div>
                </div>
              </div>

              {/* 特技選択 */}
              <div style={{ background: '#0b0f19', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'block', marginBottom: '4px' }}>🔮 習得スキル技能（最大3スロット）</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  {[1, 2, 3].map(n => (
                    <select key={n} value={unitForm[`skill_0${n}`]} onChange={(e) => setUnitForm({...unitForm, [`skill_0${n}`]: e.target.value})} style={inputStyle}>
                      <option value="">なし</option>{skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ))}
                </div>
              </div>

              <div><label style={labelStyle}>図鑑解説・モンスター紹介文</label><textarea rows="2" placeholder="RO風のフレイバーテキストを自由に記述..." value={unitForm.description || ''} onChange={(e) => setUnitForm({...unitForm, description: e.target.value})} style={{ ...inputStyle, resize: 'none' }}></textarea></div>
              <button type="submit" style={saveBtnStyle}>神の権能：RO式ユニットを創造（ID自動）</button>
            </form>
          )}

          {/* タブ2: アイテム創造フォーム */}
          {activeTab === 'items' && (
            <form onSubmit={handleItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>アイテム大分類</label>
                  <select value={itemForm.item_type} onChange={(e) => setItemForm({...itemForm, item_type: e.target.value})} style={inputStyle}>
                    <option value="weapon">武器 (Weapon)</option>
                    <option value="armor">防具 (Armor)</option>
                    <option value="card">モンスターカード (Card)</option>
                    <option value="consumable">消耗アイテム</option>
                    <option value="special">特別重要アイテム</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>アイテム名</label>
                  <input type="text" required placeholder="例: マインゴーシュ" value={itemForm.name} onChange={(e) => setItemForm({...itemForm, name: e.target.value})} style={inputStyle} />
                </div>
              </div>

              {/* 小分類・スロット穴数（★新設） */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>武具小分類（サジェスト選択可）</label>
                  <input type="text" required placeholder="例: 短剣 / 兜 / 鎧 / カード" value={itemForm.item_subtype} onChange={(e) => setItemForm({...itemForm, item_subtype: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{...labelStyle, color: '#a78bfa'}}>スロット数 (穴数)</label>
                  <select value={itemForm.slot_count} onChange={(e) => setItemForm({...itemForm, slot_count: e.target.value})} style={inputStyle}>
                    <option value="0">0穴</option>
                    <option value="1">1穴</option>
                    <option value="2">2穴</option>
                    <option value="3">3穴</option>
                    <option value="4">4穴</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {existingSubtypes.map(s => <span key={s} onClick={() => setItemForm({...itemForm, item_subtype: s})} className="suggest-tag">{s}</span>)}
                </div>
              </div>

              {/* 武器のみ攻撃範囲レンジを指定 */}
              {itemForm.item_type === 'weapon' && (
                <div style={{ background: '#0b0f19', padding: '10px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                  <label style={{ ...labelStyle, color: '#f59e0b' }}>🏹 武器射程・攻撃範囲（前衛・後衛バトルシステム用）</label>
                  <select value={itemForm.weapon_range} onChange={(e) => setItemForm({...itemForm, weapon_range: e.target.value})} style={inputStyle}>
                    <option value="S">Sレンジ（近接短剣・片手剣：前衛から敵の前衛のみ）</option>
                    <option value="M">Mレンジ（中距離槍・片手鞭：前衛/後衛から敵の前衛まで）</option>
                    <option value="L">Lレンジ（遠距離長弓・楽器：後衛から敵の後衛を貫通射撃）</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={labelStyle}>レアリティ</label><select value={itemForm.rarity} onChange={(e) => setItemForm({...itemForm, rarity: e.target.value})} style={inputStyle}><option value="common">Common</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select></div>
                <div><label style={labelStyle}>売却価格 (Zeny/G)</label><input type="number" value={itemForm.sell_price} onChange={(e) => setItemForm({...itemForm, sell_price: e.target.value})} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>アイテム効果説明文テキスト</label><textarea rows="2" placeholder="例：武器に挿すと動物系モンスターへの物理ダメージ+20%" value={itemForm.description || ''} onChange={(e) => setItemForm({...itemForm, description: e.target.value})} style={{ ...inputStyle, resize: 'none' }}></textarea></div>
              <button type="submit" style={saveBtnStyle}>新アイテムを世界に創造（ID自動）</button>
            </form>
          )}

          {/* タブ3: スキル創造フォーム */}
          {activeTab === 'skills' && (
            <form onSubmit={handleSkillSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>特技・魔法の名称</label><input type="text" required placeholder="例: バッシュ / ナパームビート" value={skillForm.name} onChange={(e) => setSkillForm({...skillForm, name: e.target.value})} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div><label style={labelStyle}>技能分類</label><select value={skillForm.skill_type} onChange={(e) => setSkillForm({...skillForm, skill_type: e.target.value})} style={inputStyle}><option value="magic">魔法 (Int魔法攻撃依存)</option><option value="art">物理特技 (Str物理攻撃依存)</option></select></div>
                <div><label style={{...labelStyle, color: '#38bdf8'}}>消費SP</label><input type="number" value={skillForm.sp_cost} onChange={(e) => setSkillForm({...skillForm, sp_cost: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>基礎攻撃倍率/回復量</label><input type="number" value={skillForm.effect_value} onChange={(e) => setSkillForm({...skillForm, effect_value: e.target.value})} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>スキル詳細説明文</label><textarea rows="2" placeholder="消費SPや追加効果の仕様など..." value={skillForm.description || ''} onChange={(e) => setSkillForm({...skillForm, description: e.target.value})} style={{ ...inputStyle, resize: 'none' }}></textarea></div>
              <button type="submit" style={saveBtnStyle}>新スキル知識を創造（ID自動）</button>
            </form>
          )}
        </div>

        {/* 右側：データリスト閲覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px', maxHeight: '280px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}><Swords size={14}/> 創造ユニットリスト ({units.length}件)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {units.map(u => (
                <div key={u.id} style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.55rem', color: '#4b5563', display: 'block' }}>ID: {u.id} (ベースLv.{u.base_level})</span>
                    <strong style={{ fontSize: '0.85rem', color: u.unit_type === 'playable' ? '#fff' : '#ef4444' }}>{u.name}</strong>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '6px' }}>{u.race}属性 / {u.job}</span>
                    <span style={{ fontSize: '0.6rem', color: '#f59e0b', display: 'block', marginTop: '2px' }}>
                      S:{u.stat_str} A:{u.stat_agi} V:{u.stat_vit} I:{u.stat_int} D:{u.stat_dex} L:{u.stat_luk}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => startEditUnit(u)} style={iconBtnStyle}><Edit2 size={12}/></button>
                    <button onClick={() => handleDelete('game_master_units', u.id)} style={{ ...iconBtnStyle, color: '#ef4444' }}><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px', maxHeight: '240px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={14}/> 登録武具・アイテムリスト ({items.length}件)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {items.map(i => (
                <div key={i.id} style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: i.rarity === 'legendary' ? '#f59e0b' : '#fff' }}>
                      {i.name} {i.slot_count > 0 ? `[${i.slot_count}]` : ''}
                    </strong>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '6px' }}>
                      {i.item_subtype} {i.item_type === 'weapon' ? `[レンジ:${i.weapon_range}]` : ''} ({i.sell_price}z)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => startEditItem(i)} style={iconBtnStyle}><Edit2 size={12}/></button>
                    <button onClick={() => handleDelete('game_master_items', i.id)} style={{ ...iconBtnStyle, color: '#ef4444' }}><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px', maxHeight: '240px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={14}/> 登録特技・魔法スキルリスト ({skills.length}件)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {skills.map(s => (
                <div key={s.id} style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>{s.name}</strong><span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '6px' }}>{s.skill_type === 'magic' ? `魔法(SP:${s.sp_cost})` : `特技(SP:${s.sp_cost})`}</span></div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setSkillForm({...s}); setIsEditing(true); setEditId(s.id); setActiveTab('skills'); }} style={iconBtnStyle}><Edit2 size={12}/></button>
                    <button onClick={() => handleDelete('game_master_skills', s.id)} style={{ ...iconBtnStyle, color: '#ef4444' }}><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const labelStyle = { display: 'block', fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', marginBottom: '2px' };
const inputStyle = { width: '100%', padding: '8px', background: '#0b0f19', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' };
const saveBtnStyle = { flex: 1, padding: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.8rem' };
const iconBtnStyle = { background: '#111827', border: '1px solid #334155', color: '#94a3b8', padding: '5px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center' };

export default GameMasterDashboard;