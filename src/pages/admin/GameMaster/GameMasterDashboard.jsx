import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../supabaseClient';
import { Swords, Shield, Plus, Trash2, Edit2, X, LogOut, BookOpen, Layers } from 'lucide-react';

// 🆕 三土手創世神専用：大分類に連動する固定武具小分類リスト
const SUBTYPE_OPTIONS = {
  weapon: ['短剣', '剣', '杖', '鈍器', '斧', '弓', '槍', 'カタール', '本', '爪（ナックル）'],
  armor: ['兜', 'フェイス', '鎧', '小手', '盾', '肩', '靴', 'アクセサリ'],
  card: ['カード'],
  consumable: ['ポーション', '材料', 'その他'],
  special: ['クエスト重要品']
};

const GameMasterDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('units');
  
  const [units, setUnits] = useState([]);
  const [items, setItems] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');

  // フォーム初期状態（★三土手さん指定の9部位スロット名へ完全刷新！）
  const [unitForm, setUnitForm] = useState({
    name: '', unit_type: 'playable', is_tamable: false, race: '人間', job: 'ノービス', description: '',
    base_level: 1, reward_exp: 10, reward_gold: 10, base_hp: 100, base_sp: 10,
    stat_str: 1, stat_agi: 1, stat_vit: 1, stat_int: 1, stat_dex: 1, stat_luk: 1,
    // 🆕 9部位初期装備
    equip_right_hand: '', equip_left_hand: '', equip_head: '', equip_face: '',
    equip_body: '', equip_glove: '', equip_garment: '', equip_shoes: '', equip_accessory: '',
    extra_drop_item: '', extra_drop_chance: 0, skill_01: '', skill_02: '', skill_03: '',
    element: '無', size: '中型', atk_matk: 0, hit_100: 100, flee_95: 100, is_boss: false, is_range_atk: false
  });

  const [itemForm, setItemForm] = useState({
    name: '', item_type: 'weapon', item_subtype: '短剣', weapon_range: 'S', slot_count: 0, rarity: 'common', sell_price: 100, description: '',
    atk: 0, def: 0, mdef: 0, weapon_level: 1, equip_level_req: 1, job_restriction: '全職業', weight: 10, penalty_str: 0
  });

  const [skillForm, setSkillForm] = useState({
    name: '', skill_type: 'magic', sp_cost: 0, effect_value: 0, description: '', cast_time: 0, is_absolute_hit: true
  });

  const [existingRaces, setExistingRaces] = useState(['人間', '植物', '動物', '昆虫', '悪魔', '不死']);
  const [existingJobs, setExistingJobs] = useState(['全職業', 'ノービス', 'ソードマン', 'マジシャン', 'アコライト', 'シーフ', 'アーチャー', 'マーチャント']);

  // 大分類が変わったら、連動して小分類の初期値を自動で切り替える
  const handleItemTypeChange = (type) => {
    setItemForm({
      ...itemForm,
      item_type: type,
      item_subtype: SUBTYPE_OPTIONS[type][0] // 各リストの先頭を初期セット
    });
  };

  const handleBackToLogin = () => {
    if (window.confirm("ゲームマスターツールを終了してログイン画面に戻りますか？")) navigate('/');
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
      if (i) setItems(i);
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
        atk_matk: Number(unitForm.atk_matk), hit_100: Number(unitForm.hit_100), flee_95: Number(unitForm.flee_95),
        // 空文字を安全にNullエスケープ
        equip_right_hand: unitForm.equip_right_hand || null, equip_left_hand: unitForm.equip_left_hand || null,
        equip_head: unitForm.equip_head || null, equip_face: unitForm.equip_face || null,
        equip_body: unitForm.equip_body || null, equip_glove: unitForm.equip_glove || null,
        equip_garment: unitForm.equip_garment || null, equip_shoes: unitForm.equip_shoes || null,
        equip_accessory: unitForm.equip_accessory || null,
        extra_drop_item: unitForm.extra_drop_item || null,
        skill_01: unitForm.skill_01 || null, skill_02: unitForm.skill_02 || null, skill_03: unitForm.skill_03 || null
      });
      if (error) throw error;
      alert('9部位対応のユニットデータを保存しました！');
      resetUnitForm(); fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    const finalId = isEditing ? editId : `item_${Date.now()}`;
    try {
      const { error } = await supabase.from('game_master_items').upsert({ 
        id: finalId, ...itemForm, 
        slot_count: Number(itemForm.slot_count), sell_price: Number(itemForm.sell_price),
        atk: Number(itemForm.atk), def: Number(itemForm.def), mdef: Number(itemForm.mdef),
        weapon_level: Number(itemForm.weapon_level), equip_level_req: Number(itemForm.equip_level_req),
        weight: Number(itemForm.weight), penalty_str: Number(itemForm.penalty_str)
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
        id: finalId, ...skillForm, sp_cost: Number(skillForm.sp_cost), effect_value: Number(skillForm.effect_value), cast_time: Number(skillForm.cast_time)
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
    } catch (err) { alert('削除失敗: 使用中のデータです。'); }
  };

  const startEditUnit = (unit) => { 
    setIsEditing(true); setEditId(unit.id); 
    setUnitForm({ 
      ...unit, 
      element: unit.element || '無', size: unit.size || '中型',
      atk_matk: unit.atk_matk || 0, hit_100: unit.hit_100 || 100, flee_95: unit.flee_95 || 100,
      equip_right_hand: unit.equip_right_hand || '', equip_left_hand: unit.equip_left_hand || '', 
      equip_head: unit.equip_head || '', equip_face: unit.equip_face || '', 
      equip_body: unit.equip_body || '', equip_glove: unit.equip_glove || '', 
      equip_garment: unit.equip_garment || '', equip_shoes: unit.equip_shoes || '', equip_accessory: unit.equip_accessory || '', 
      extra_drop_item: unit.extra_drop_item || '', skill_01: unit.skill_01 || '', skill_02: unit.skill_02 || '', skill_03: unit.skill_03 || '' 
    }); 
  };
  
  const startEditItem = (item) => { setIsEditing(true); setEditId(item.id); setItemForm({ ...item }); };
  const startEditSkill = (skill) => { setIsEditing(true); setEditId(skill.id); setSkillForm({ ...skill }); };

  const resetUnitForm = () => { 
    setIsEditing(false); setEditId(''); 
    setUnitForm({ 
      name: '', unit_type: 'playable', is_tamable: false, race: '人間', job: 'ノービス', description: '', 
      base_level: 1, reward_exp: 10, reward_gold: 10, base_hp: 100, base_sp: 10, 
      stat_str: 1, stat_agi: 1, stat_vit: 1, stat_int: 1, stat_dex: 1, stat_luk: 1, 
      equip_right_hand: '', equip_left_hand: '', equip_head: '', equip_face: '',
      equip_body: '', equip_glove: '', equip_garment: '', equip_shoes: '', equip_accessory: '', 
      extra_drop_item: '', extra_drop_chance: 0, skill_01: '', skill_02: '', skill_03: '',
      element: '無', size: '中型', atk_matk: 0, hit_100: 100, flee_95: 100, is_boss: false, is_range_atk: false
    }); 
  };
  
  const resetItemForm = () => { setIsEditing(false); setEditId(''); setItemForm({ name: '', item_type: 'weapon', item_subtype: '短剣', weapon_range: 'S', slot_count: 0, rarity: 'common', sell_price: 100, description: '', atk: 0, def: 0, mdef: 0, weapon_level: 1, equip_level_req: 1, job_restriction: '全職業', weight: 10, penalty_str: 0 }); };
  const resetSkillForm = () => { setIsEditing(false); setEditId(''); setSkillForm({ name: '', skill_type: 'magic', sp_cost: 0, effect_value: 0, description: '', cast_time: 0, is_absolute_hit: true }); };

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

      <div className="gm-flex-head">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>🔮 QUEST HUB - RO EDITION GM CONTROL</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>三土手創世神仕様：9大装備スロット固定＆武具小分類インテリジェントプルダウン</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={handleBackToLogin} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><LogOut size={14} /> 終了</button>
        </div>
      </div>

      <div className="gm-grid">
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', height: 'fit-content' }}>
          {!isEditing && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '15px', background: '#0b0f19', padding: '4px', borderRadius: '8px' }}>
              <button type="button" onClick={() => setActiveTab('units')} style={{ flex: 1, padding: '8px 2px', background: activeTab === 'units' ? '#1e293b' : 'none', color: activeTab === 'units' ? '#f59e0b' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>① ユニット創造</button>
              <button type="button" onClick={() => setActiveTab('items')} style={{ flex: 1, padding: '8px 2px', background: activeTab === 'items' ? '#1e293b' : 'none', color: activeTab === 'items' ? '#f59e0b' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>② 武具アイテム創造</button>
              <button type="button" onClick={() => setActiveTab('skills')} style={{ flex: 1, padding: '8px 2px', background: activeTab === 'skills' ? '#1e293b' : 'none', color: activeTab === 'skills' ? '#f59e0b' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>③ スキル特技創造</button>
            </div>
          )}

          {activeTab === 'units' && (
            <form onSubmit={handleUnitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>所属側</label>
                  <select value={unitForm.unit_type} onChange={(e) => setUnitForm({...unitForm, unit_type: e.target.value})} style={inputStyle}>
                    <option value="playable">プレイヤー側（仲間キャラクター）</option>
                    <option value="enemy">エネミー側（敵モンスター）</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>名前</label>
                  <input type="text" required placeholder="例: ディオン" value={unitForm.name} onChange={(e) => setUnitForm({...unitForm, name: e.target.value})} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>種族属性</label>
                  <input type="text" required value={unitForm.race} onChange={(e) => setUnitForm({...unitForm, race: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>職業・クラス</label>
                  <input type="text" required value={unitForm.job} onChange={(e) => setUnitForm({...unitForm, job: e.target.value})} style={inputStyle} />
                </div>
              </div>

              {unitForm.unit_type === 'enemy' && (
                <div style={{ background: '#1e1b4b', padding: '12px', borderRadius: '10px', border: '1px solid #4338ca', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 'bold' }}>😈 本家ROモンスターパラメータ</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={labelStyle}>属性</label>
                      <select value={unitForm.element} onChange={(e) => setUnitForm({...unitForm, element: e.target.value})} style={inputStyle}>
                        <option value="無">無</option><option value="火">火</option><option value="水">水</option><option value="風">風</option><option value="地">地</option><option value="聖">聖</option><option value="闇">闇</option><option value="不死">不死</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>サイズ</label>
                      <select value={unitForm.size} onChange={(e) => setUnitForm({...unitForm, size: e.target.value})} style={inputStyle}>
                        <option value="小型">小型</option><option value="中型">中型</option><option value="大型">大型</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>敵MATK</label>
                      <input type="number" value={unitForm.atk_matk} onChange={(e) => setUnitForm({...unitForm, atk_matk: e.target.value})} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><label style={{...labelStyle, color: '#34d399'}}>🎯 100%HIT必要値</label><input type="number" value={unitForm.hit_100} onChange={(e) => setUnitForm({...unitForm, hit_100: e.target.value})} style={inputStyle} /></div>
                    <div><label style={{...labelStyle, color: '#f43f5e'}}>💨 95%FLEE必要値</label><input type="number" value={unitForm.flee_95} onChange={(e) => setUnitForm({...unitForm, flee_95: e.target.value})} style={inputStyle} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', marginTop: '4px' }}>
                    <label style={{ fontSize: '0.68rem', color: '#f59e0b', cursor: 'pointer' }}><input type="checkbox" checked={unitForm.is_boss} onChange={(e) => setUnitForm({...unitForm, is_boss: e.target.checked})} /> BOSS属性</label>
                    <label style={{ fontSize: '0.68rem', color: '#38bdf8', cursor: 'pointer' }}><input type="checkbox" checked={unitForm.is_range_atk} onChange={(e) => setUnitForm({...unitForm, is_range_atk: e.target.checked})} /> 遠距離攻撃</label>
                  </div>
                </div>
              )}

              {/* 🆕 三土手さん指定：完全新生9部位初期装備枠 */}
              <div>
                <label style={{ ...labelStyle, color: '#a78bfa', marginBottom: '4px' }}>🛡️ 9部位装備品スロット初期設定</label>
                <div className="equip-grid">
                  <div>
                    <label style={labelStyle}>①右手（メイン武器）</label>
                    <select value={unitForm.equip_right_hand} onChange={(e) => setUnitForm({...unitForm, equip_right_hand: e.target.value})} style={inputStyle}>
                      <option value="">素手 / 未装備</option>
                      {items.filter(i => i.item_type === 'weapon').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>②左手（盾 / 副武器）</label>
                    <select value={unitForm.equip_left_hand} onChange={(e) => setUnitForm({...unitForm, equip_left_hand: e.target.value})} style={inputStyle}>
                      <option value="">なし / 未装備</option>
                      {items.filter(i => i.item_subtype === '盾' || i.item_type === 'weapon').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>③兜</label>
                    <select value={unitForm.equip_head} onChange={(e) => setUnitForm({...unitForm, equip_head: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '兜').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>④フェイス</label>
                    <select value={unitForm.equip_face} onChange={(e) => setUnitForm({...unitForm, equip_face: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === 'フェイス').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>⑤鎧</label>
                    <select value={unitForm.equip_body} onChange={(e) => setUnitForm({...unitForm, equip_body: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '鎧').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>⑥小手</label>
                    <select value={unitForm.equip_glove} onChange={(e) => setUnitForm({...unitForm, equip_glove: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '小手').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>⑦肩</label>
                    <select value={unitForm.equip_garment} onChange={(e) => setUnitForm({...unitForm, equip_garment: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '肩').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>⑧靴</label>
                    <select value={unitForm.equip_shoes} onChange={(e) => setUnitForm({...unitForm, equip_shoes: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === '靴').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>⑨装飾（アクセサリー）</label>
                    <select value={unitForm.equip_accessory} onChange={(e) => setUnitForm({...unitForm, equip_accessory: e.target.value})} style={inputStyle}>
                      <option value="">未装備</option>
                      {items.filter(i => i.item_subtype === 'アクセサリ').map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="stat-grid">
                <div style={{ gridColumn: 'span 2' }}><label style={{...labelStyle, color: '#f43f5e'}}>MHP (最大HP)</label><input type="number" value={unitForm.base_hp} onChange={(e) => setUnitForm({...unitForm, base_hp: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: 'span 2' }}><label style={{...labelStyle, color: '#38bdf8'}}>MSP (最大SP)</label><input type="number" value={unitForm.base_sp} onChange={(e) => setUnitForm({...unitForm, base_sp: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>STR</label><input type="number" value={unitForm.stat_str} onChange={(e) => setUnitForm({...unitForm, stat_str: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>AGI</label><input type="number" value={unitForm.stat_agi} onChange={(e) => setUnitForm({...unitForm, stat_agi: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>VIT</label><input type="number" value={unitForm.stat_vit} onChange={(e) => setUnitForm({...unitForm, stat_vit: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>INT</label><input type="number" value={unitForm.stat_int} onChange={(e) => setUnitForm({...unitForm, stat_int: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>DEX</label><input type="number" value={unitForm.stat_dex} onChange={(e) => setUnitForm({...unitForm, stat_dex: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>LUK</label><input type="number" value={unitForm.stat_luk} onChange={(e) => setUnitForm({...unitForm, stat_luk: e.target.value})} style={inputStyle} /></div>
              </div>

              <button type="submit" style={saveBtnStyle}>神の権能：RO式ユニットを創造</button>
            </form>
          )}

          {/* タブ2: アイテム創造フォーム（★三土手さん指定：小分類完全プルダウン化！） */}
          {activeTab === 'items' && (
            <form onSubmit={handleItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>アイテム大分類</label>
                  <select value={itemForm.item_type} onChange={(e) => handleItemTypeChange(e.target.value)} style={inputStyle}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  {/* 🆕 手入力を廃止し、大分類に完全同期するクリーンな選択リスト(Select)へ変貌！ */}
                  <label style={labelStyle}>武具小分類（選択式）</label>
                  <select value={itemForm.item_subtype} onChange={(e) => setItemForm({...itemForm, item_subtype: e.target.value})} style={inputStyle}>
                    {SUBTYPE_OPTIONS[itemForm.item_type].map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{...labelStyle, color: '#a78bfa'}}>スロット数</label>
                  <select value={itemForm.slot_count} onChange={(e) => setItemForm({...itemForm, slot_count: Number(e.target.value)})} style={inputStyle}>
                    <option value="0">0穴</option><option value="1">1穴</option><option value="2">2穴</option><option value="3">3穴</option><option value="4">4穴</option>
                  </select>
                </div>
              </div>

              <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 'bold' }}>⚔️ 武具・カードのRO式スペック詳細設定</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <div><label style={labelStyle}>ATK</label><input type="number" value={itemForm.atk} onChange={(e) => setItemForm({...itemForm, atk: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>DEF</label><input type="number" value={itemForm.def} onChange={(e) => setItemForm({...itemForm, def: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>MDEF</label><input type="number" value={itemForm.mdef} onChange={(e) => setItemForm({...itemForm, mdef: e.target.value})} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <div>
                    <label style={labelStyle}>武器レベル (1〜4)</label>
                    <select value={itemForm.weapon_level} onChange={(e) => setItemForm({...itemForm, weapon_level: Number(e.target.value)})} style={inputStyle}>
                      <option value="1">Lv.1</option><option value="2">Lv.2</option><option value="3">Lv.3</option><option value="4">Lv.4</option>
                    </select>
                  </div>
                  <div><label style={labelStyle}>重量</label><input type="number" value={itemForm.weight} onChange={(e) => setItemForm({...itemForm, weight: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>ペナ解消必要STR</label><input type="number" value={itemForm.penalty_str} onChange={(e) => setItemForm({...itemForm, penalty_str: e.target.value})} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '6px' }}>
                  <div><label style={labelStyle}>装備制限ベースLv</label><input type="number" min="1" value={itemForm.equip_level_req} onChange={(e) => setItemForm({...itemForm, equip_level_req: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>装備可能職業</label><input type="text" value={itemForm.job_restriction} onChange={(e) => setItemForm({...itemForm, job_restriction: e.target.value})} style={inputStyle} /></div>
                </div>
              </div>

              {itemForm.item_type === 'weapon' && (
                <div style={{ background: '#0b0f19', padding: '10px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                  <label style={{ ...labelStyle, color: '#f59e0b' }}>🏹 武器射程レンジ</label>
                  <select value={itemForm.weapon_range} onChange={(e) => setItemForm({...itemForm, weapon_range: e.target.value})} style={inputStyle}>
                    <option value="S">Sレンジ（近接短剣・片手剣）</option>
                    <option value="M">Mレンジ（中距離槍）</option>
                    <option value="L">Lレンジ（遠距離長弓）</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={labelStyle}>レアリティ</label><select value={itemForm.rarity} onChange={(e) => setItemForm({...itemForm, rarity: e.target.value})} style={inputStyle}><option value="common">Common</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select></div>
                <div><label style={labelStyle}>ギルド売却換金価格 (z)</label><input type="number" value={itemForm.sell_price} onChange={(e) => setItemForm({...itemForm, sell_price: e.target.value})} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>アイテム説明文</label><textarea rows="2" value={itemForm.description || ''} onChange={(e) => setItemForm({...itemForm, description: e.target.value})} style={{ ...inputStyle, resize: 'none' }}></textarea></div>
              <button type="submit" style={saveBtnStyle}>新アイテムを世界に創造</button>
            </form>
          )}

          {activeTab === 'skills' && (
            <form onSubmit={handleSkillSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>特技・魔法の名称</label><input type="text" required placeholder="例: バッシュ" value={skillForm.name} onChange={(e) => setSkillForm({...skillForm, name: e.target.value})} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div><label style={labelStyle}>技能分類</label><select value={skillForm.skill_type} onChange={(e) => setSkillForm({...skillForm, skill_type: e.target.value})} style={inputStyle}><option value="magic">魔法</option><option value="art">物理特技</option></select></div>
                <div><label style={{...labelStyle, color: '#38bdf8'}}>消費SP</label><input type="number" value={skillForm.sp_cost} onChange={(e) => setSkillForm({...skillForm, sp_cost: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>基礎倍率/回復量</label><input type="number" value={skillForm.effect_value} onChange={(e) => setSkillForm({...skillForm, effect_value: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '10px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={{...labelStyle, color: '#a78bfa'}}>⏱️ 基礎詠唱時間（秒）</label><input type="number" step="0.1" value={skillForm.cast_time} onChange={(e) => setSkillForm({...skillForm, cast_time: e.target.value})} style={inputStyle} /></div>
                <div>
                  <label style={labelStyle}>命中タイプ</label>
                  <select value={skillForm.is_absolute_hit} onChange={(e) => setSkillForm({...skillForm, is_absolute_hit: e.target.value === 'true'})} style={inputStyle}>
                    <option value="true">必中</option><option value="false">命中率依存</option>
                  </select>
                </div>
              </div>
              <div><label style={labelStyle}>スキル説明文</label><textarea rows="2" value={skillForm.description || ''} onChange={(e) => setSkillForm({...skillForm, description: e.target.value})} style={{ ...inputStyle, resize: 'none' }}></textarea></div>
              <button type="submit" style={saveBtnStyle}>新スキル知識を創造</button>
            </form>
          )}
        </div>

        {/* 右側閲覧領域 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px', maxHeight: '280px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}><Swords size={14}/> 創造ユニットリスト ({units.length}件)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {units.map(u => (
                <div key={u.id} style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.55rem', color: '#4b5563', display: 'block' }}>ID: {u.id} (Lv.{u.base_level})</span>
                    <strong style={{ fontSize: '0.85rem', color: u.unit_type === 'playable' ? '#fff' : '#ef4444' }}>{u.name}</strong>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '6px' }}>{u.race} / {u.job}</span>
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
                    <strong style={{ fontSize: '0.85rem', color: i.rarity === 'legendary' ? '#f59e0b' : '#fff' }}>{i.name} {i.slot_count > 0 ? `[${i.slot_count}]` : ''}</strong>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '6px' }}>{i.item_subtype} (ATK:{i.atk}/DEF:{i.def})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => startEditItem(i)} style={iconBtnStyle}><Edit2 size={12}/></button>
                    <button onClick={() => handleDelete('game_master_items', i.id)} style={{ ...iconBtnStyle, color: '#ef4444' }}><Trash2 size={12}/></button>
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
const inputStyle = { width: '100%', padding: '8px', background: '#0b0f19', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', boxSizing: 'border-box', outline: 'none' };
const saveBtnStyle = { flex: 1, padding: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.8rem' };
const iconBtnStyle = { background: '#111827', border: '1px solid #334155', color: '#94a3b8', padding: '5px', borderRadius: '5px', cursor: 'pointer' };

export default GameMasterDashboard;