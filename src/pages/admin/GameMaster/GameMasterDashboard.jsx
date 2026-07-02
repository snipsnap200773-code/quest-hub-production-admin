import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../supabaseClient';
import { Swords, Shield, Plus, Trash2, Edit2, X, LogOut, BookOpen, Layers, MapPinned } from 'lucide-react';
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
  // 🔮 🆕 創世のクエスト一覧データを格納・管理するStateを新設
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');

  // フォーム初期状態
  const [unitForm, setUnitForm] = useState({
    name: '', unit_type: 'playable', is_tamable: false, race: '人間', job: 'ノービス', description: '',
    base_level: 1, reward_exp: 10, reward_gold: 10, base_hp: 100, base_sp: 10,
    stat_str: 0, stat_agi: 0, stat_vit: 0, stat_int: 0, stat_dex: 0, stat_luk: 0,
    equip_right_hand: '', equip_left_hand: '', equip_head: '', equip_face: '',
    equip_body: '', equip_glove: '', equip_garment: '', equip_shoes: '', equip_accessory: '',
    extra_drop_item: '', extra_drop_chance: 0, skill_01: '', skill_02: '', skill_03: '',
    element: '無', size: '中型', atk_matk: 0, hit_100: 100, flee_95: 100, is_boss: false, is_range_atk: false,
    // 👑 三土手神特注：4大状態異常耐性の初期State配線を開通！
    resist_stun: 0, resist_freeze: 0, resist_poison: 0, resist_blind: 0
  });

  const [itemForm, setItemForm] = useState({
    name: '', item_type: 'weapon', item_subtype: '短剣', weapon_range: 'S', slot_count: 0, rarity: 'common', sell_price: 100, description: '',
    atk: 0, def: 0, mdef: 0, weapon_level: 1, equip_level_req: 1, job_restriction: '全職業', weight: 10, penalty_str: 0
  });

  // 🔮 1枚のカードに3つの独立した効果（神のマルチスペック）を付与するState
  const [cardEffectType1, setCardEffectType1] = useState('add_stat');
  const [cardEffectTarget1, setCardEffectTarget1] = useState('hp');
  const [cardEffectValue1, setCardEffectValue1] = useState(0);

  const [cardEffectType2, setCardEffectType2] = useState('none');
  const [cardEffectTarget2, setCardEffectTarget2] = useState('');
  const [cardEffectValue2, setCardEffectValue2] = useState(0);

  const [cardEffectType3, setCardEffectType3] = useState('none');
  const [cardEffectTarget3, setCardEffectTarget3] = useState('');
  const [cardEffectValue3, setCardEffectValue3] = useState(0);

  const [skillForm, setSkillForm] = useState({
    name: '', skill_type: 'magic', sp_cost: 0, effect_value: 0, description: '', cast_time: 0, is_absolute_hit: true,
    job_requirement: '全職業', level_requirement: 1,
    target_type: '単体エネミー', use_condition: '戦闘中のみ', element: '無',
    effect_type: 'なし', effect_chance: 0, duration_turns: 0,
    value_type: 'percent'
  });

  // 🔮 🆕 【三土手創世神特注：多層ダンジョン階層コンフィグState】
  const [activeFloorTab, setActiveFloorTab] = useState(1); // 現在編集中の階層（1〜5）
  const [floorConfigs, setFloorConfigs] = useState([
    // 🛠️ 最小出現数（min_spawn: 1）と 最大出現数（max_spawn: 2）の初期値をバインディング！
    { floor: 1, enemy_ids: ['', '', ''], battle_count: 3, chest_count: 1, has_fountain: false, min_spawn: 1, max_spawn: 2 }
  ]);

  const [questForm, setQuestForm] = useState({
    name: '',
    level: 1,
    floors: 1, // 総階層数
    difficulty: 'E',
    description: '',
    exp_reward: 50,
    zeny_reward: 1000
  });

  // 階層を動的に追加・変更するヘルパー関数
  const handleFloorConfigChange = (floorNum, field, value) => {
    setFloorConfigs(prev => prev.map(f => f.floor === floorNum ? { ...f, [field]: value } : f));
  };

  const handleFloorEnemyChange = (floorNum, index, enemyId) => {
    setFloorConfigs(prev => prev.map(f => {
      if (f.floor === floorNum) {
        const nextEnemies = [...f.enemy_ids];
        nextEnemies[index] = enemyId;
        return { ...f, enemy_ids: nextEnemies };
      }
      return f;
    }));
  };

  const [existingRaces, setExistingRaces] = useState(['人間', '植物', '動物', '昆虫', '悪魔', '不死']);
  
  // 🔮 🆕 クエストハブ完全オリジナル：本家マネを完全脱却した、1次職＋新職テイマーの神配列にリフォーム！
  const [existingJobs, setExistingJobs] = useState([
    '全職業', 'ノービス', 'ファイター', 'メイジ', 'クレリック', 'スカウト', 'ハンター', 'トレーダー', 'テイマー'
  ]);

  // 🔍 🆕 三土手神専用：インテリジェント多次元検索・フィルタ・ソート制御用State群
  const [unitSearch, setUnitSearch] = useState('');
  const [unitFilterType, setUnitFilterType] = useState('all'); // all, playable, enemy
  const [unitFilterJob, setUnitFilterJob] = useState('all');
  const [unitFilterRace, setUnitFilterRace] = useState('all');
  const [unitFilterElement, setUnitFilterElement] = useState('all');
  const [unitFilterSize, setUnitFilterSize] = useState('all');
  const [unitSortOrder, setUnitSortOrder] = useState('level_desc'); // level_desc, level_asc, name_asc

  const [itemSearch, setItemSearch] = useState('');
  const [itemFilterType, setItemFilterType] = useState('all');
  const [itemFilterRarity, setItemFilterRarity] = useState('all');

  const [skillSearch, setSkillSearch] = useState('');
  const [skillFilterJob, setSkillFilterJob] = useState('all');
  const [skillFilterType, setSkillFilterType] = useState('all'); // all, magic, art
  const [skillFilterEffect, setSkillFilterEffect] = useState('all');
  const [skillFilterElement, setSkillFilterElement] = useState('all');
  const [skillSortOrder, setSkillSortOrder] = useState('name_asc'); // name_asc, sp_desc, lv_asc

  const handleItemTypeChange = (type) => {
    setItemForm({
      ...itemForm,
      item_type: type,
      item_subtype: SUBTYPE_OPTIONS[type][0]
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
      // 🔮 🆕 データベースから既存のクエストリストを全件ロード！
      const { data: q } = await supabase.from('game_master_quests').select('*').order('level', { ascending: true });
      
      if (u) {
        setUnits(u);
        const races = Array.from(new Set(u.map(item => item.race).filter(Boolean)));
        const jobs = Array.from(new Set(u.map(item => item.job).filter(Boolean)));
        if (races.length > 0) setExistingRaces(races);
        if (jobs.length > 0) setExistingJobs(jobs);
      }
      if (i) setItems(i);
      if (s) setSkills(s);
      
      // 💡 【修正点】取得したクエストデータを画面の管理Stateへガキィンと直撃バインド！
      if (q) setQuests(q);

    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // 🛠️ 🆕 ここに綺麗にスッと差し込みます！
  const handleDelete = async (table, id) => {
    if (!window.confirm(`本当に削除しますか？`)) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      fetchData(); // 削除が成功したらリストを最新に更新
    } catch (err) { 
      alert('削除失敗: 使用中のデータです。'); 
    }
  }; // 🟢 ここでしっかり閉じカッコが完結します

  // ─── ここから下は三土手さんが見せてくれた元のコードへ綺麗に繋がります ───
  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    const finalId = isEditing ? editId : `unit_${Date.now()}`;
    try {
      // 👑 三土手神仕様：プレイヤー用の仲間ユニットなら、生まれた瞬間にフリーポイント 6 を宿すように拡張！
      const { error } = await supabase.from('game_master_units').upsert({
        id: finalId, ...unitForm,
        is_tamable: unitForm.unit_type === 'enemy' ? unitForm.is_tamable : false,
        base_level: Number(unitForm.base_level), reward_exp: Number(unitForm.reward_exp), reward_gold: Number(unitForm.reward_gold),
        base_hp: Number(unitForm.base_hp), base_sp: Number(unitForm.base_sp),
        stat_str: Number(unitForm.stat_str), stat_agi: Number(unitForm.stat_agi), stat_vit: Number(unitForm.stat_vit),
        stat_int: Number(unitForm.stat_int), stat_dex: Number(unitForm.stat_dex), stat_luk: Number(unitForm.stat_luk),
        // 👑 三土手神特注：入力された耐性%を確実にパースしてSupabaseへ完全コミット！
        resist_stun: Number(unitForm.resist_stun || 0),
        resist_freeze: Number(unitForm.resist_freeze || 0),
        resist_poison: Number(unitForm.resist_poison || 0),
        resist_blind: Number(unitForm.resist_blind || 0),

        // 🆕 新しく追加した4大状態異常耐性もここで確実にパースしてSupabaseへコミット！
        resist_sleep: Number(unitForm.resist_sleep || 0),
        resist_silence: Number(unitForm.resist_silence || 0),
        resist_curse: Number(unitForm.resist_curse || 0),
        resist_petrify: Number(unitForm.resist_petrify || 0),

        // 💡 【追記：ドロップ確率 ＆ テイマー調教仲間化パラメータの同期コミット】
        drop_chance_weapon: Number(unitForm.drop_chance_weapon || 0),
        tame_success_chance: Number(unitForm.tame_success_chance || 0),
        tame_level_req: Number(unitForm.tame_level_req || 1),

        // 🔮 【三土手神リフォーム】手入力があれば数値化、空文字なら未指定(null)として安全にDBへ送信！
        enemy_aspd: unitForm.enemy_aspd ? Number(unitForm.enemy_aspd) : null,
        
        extra_drop_chance: Number(unitForm.extra_drop_chance),
        atk_matk: Number(unitForm.atk_matk), hit_100: Number(unitForm.hit_100), flee_95: Number(unitForm.flee_95),
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
      const isCard = itemForm.item_type === 'card';

      const { error } = await supabase.from('game_master_items').upsert({ 
        id: finalId, ...itemForm, 
        slot_count: Number(itemForm.slot_count), sell_price: Number(itemForm.sell_price),
        atk: isCard ? 0 : Number(itemForm.atk), 
        def: isCard ? 0 : Number(itemForm.def), 
        mdef: isCard ? 0 : Number(itemForm.mdef),
        weapon_level: Number(itemForm.weapon_level), equip_level_req: Number(itemForm.equip_level_req),
        weight: Number(itemForm.weight), penalty_str: Number(itemForm.penalty_str),
        
        // 🔮 👑 創世神リフォーム：カード限定の縛りを完全撤廃！武器・防具でも特殊効果がそのまま宿る神配線
        card_effect_type: cardEffectType1 !== 'none' ? cardEffectType1 : null,
        card_effect_target: cardEffectType1 !== 'none' ? cardEffectTarget1 : null,
        card_effect_value: cardEffectType1 !== 'none' ? Number(cardEffectValue1) : 0,

        card_effect_type_2: cardEffectType2 !== 'none' ? cardEffectType2 : null,
        card_effect_target_2: cardEffectType2 !== 'none' ? cardEffectTarget2 : null,
        card_effect_value_2: cardEffectType2 !== 'none' ? Number(cardEffectValue2) : 0,

        card_effect_type_3: cardEffectType3 !== 'none' ? cardEffectType3 : null,
        card_effect_target_3: cardEffectType3 !== 'none' ? cardEffectTarget3 : null,
        card_effect_value_3: cardEffectType3 !== 'none' ? Number(cardEffectValue3) : 0
      });
      if (error) throw error;
      alert('アイテムデータを創造しました！(武器・防具への特殊効果付与対応版)');
      
      // 効果State群の初期化リセット
      setCardEffectType1('add_stat'); setCardEffectTarget1('hp'); setCardEffectValue1(0);
      setCardEffectType2('none'); setCardEffectTarget2(''); setCardEffectValue2(0);
      setCardEffectType3('none'); setCardEffectTarget3(''); setCardEffectValue3(0);

      resetItemForm(); fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleSkillSubmit = async (e) => {
    e.preventDefault();
    const finalId = isEditing ? editId : `skill_${Date.now()}`;
    try {
      const { error } = await supabase.from('game_master_skills').upsert({ 
        id: finalId, ...skillForm, 
        sp_cost: Number(skillForm.sp_cost), 
        effect_value: Number(skillForm.effect_value), 
        cast_time: Number(skillForm.cast_time),
        job_requirement: skillForm.job_requirement || '全職業',
        level_requirement: Number(skillForm.level_requirement || 1),
        // 🔮 🆕 拡張パラメータ群を確実にパースしてSupabaseへ完全コミット！
        target_type: skillForm.target_type || '単体エネミー',
        use_condition: skillForm.use_condition || '戦闘中のみ',
        element: skillForm.element || '無',
        effect_type: skillForm.effect_type || 'なし',
        effect_chance: Number(skillForm.effect_chance || 0),
        duration_turns: Number(skillForm.duration_turns || 0),
        // 🔮 🆕 選択された計算ルールを確実にSupabaseへガキィンとコミット！
        value_type: skillForm.value_type || 'percent'
      });
      if (error) throw error;
      alert('スキル技能を創造しました！');
      resetSkillForm(); fetchData();
    } catch (err) { alert(err.message); }
  };

  // 🔮 🆕 階層コンフィグ対応型クエスト創世処理
  const handleQuestSubmit = async (e) => {
    e.preventDefault();
    const finalId = isEditing ? editId : `quest_${Date.now()}`;
    try {
      // 最低限、B1の最初のモンスターが選ばれているかチェック
      if (!floorConfigs[0]?.enemy_ids[0]) {
        alert("🚨 B1の出現モンスター枠①は必須設定です！");
        return;
      }

      const { error } = await supabase.from('game_master_quests').upsert({
        id: finalId,
        name: questForm.name,
        level: Number(questForm.level),
        floors: Number(questForm.floors),
        difficulty: questForm.difficulty,
        description: questForm.description,
        exp_reward: Number(questForm.exp_reward),
        zeny_reward: Number(questForm.zeny_reward),
        // 🔮 JSONオブジェクトとして階層設定を配列のまま丸ごとデータベースへ直撃格納！
        floor_configs: floorConfigs 
      });
      if (error) throw error;
      alert(isEditing ? '多層ダンジョンを修正アップデートしました！' : 'B1〜B5階層対応の新ダンジョンを創世しました！');
      resetQuestForm(); fetchData();
    } catch (err) { alert(err.message); }
  };

  const resetQuestForm = () => {
    setIsEditing(false); 
    setEditId('');
    setActiveFloorTab(1);
    setQuestForm({ name: '', level: 1, floors: 1, difficulty: 'E', description: '', exp_reward: 50, zeny_reward: 1000 });
    // 🛠️ リセット時も初期値を1〜2体に
    setFloorConfigs([{ floor: 1, enemy_ids: ['', '', ''], battle_count: 3, chest_count: 1, has_fountain: false, min_spawn: 1, max_spawn: 2 }]);
  };

  const startEditQuest = (q) => {
    setIsEditing(true);
    setEditId(q.id);
    setQuestForm({
      name: q.name || '', level: q.level || 1, floors: q.floors || 1, difficulty: q.difficulty || 'E', description: q.description || '', exp_reward: q.exp_reward || 50, zeny_reward: q.zeny_reward || 1000
    });
    if (q.floor_configs && Array.isArray(q.floor_configs)) {
      setFloorConfigs(q.floor_configs);
    } else {
      setFloorConfigs([{ floor: 1, enemy_ids: [q.enemy_master_id || '', q.enemy_master_id_2 || '', q.enemy_master_id_3 || ''], battle_count: 3, chest_count: 1, has_fountain: false }]);
    }
    setActiveFloorTab(1);
  }; // ✨ ⚙️ 巻き込んで消えていたこのカッコを1行書き足して復活させる！

  const startEditUnit = (unit) => { // 🟢 これで構文が繋がり、画面が正常に復活します！
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
  
  const startEditItem = (item) => { 
    setIsEditing(true); setEditId(item.id); setItemForm({ ...item }); 
    if(item.item_type === 'card') {
      setCardEffectType1(item.card_effect_type || 'add_stat'); setCardEffectTarget1(item.card_effect_target || 'hp'); setCardEffectValue1(item.card_effect_value || 0);
      setCardEffectType2(item.card_effect_type_2 || 'none'); setCardEffectTarget2(item.card_effect_target_2 || ''); setCardEffectValue2(item.card_effect_value_2 || 0);
      setCardEffectType3(item.card_effect_type_3 || 'none'); setCardEffectTarget3(item.card_effect_target_3 || ''); setCardEffectValue3(item.card_effect_value_3 || 0);
    }
  };
  const startEditSkill = (skill) => { setIsEditing(true); setEditId(skill.id); setSkillForm({ ...skill }); };

  const resetUnitForm = () => { 
    setIsEditing(false); setEditId(''); 
    setUnitForm({ 
      name: '', unit_type: 'playable', is_tamable: false, race: '人間', job: 'ノービス', description: '', 
      base_level: 1, reward_exp: 10, reward_gold: 10, base_hp: 100, base_sp: 10, 
      stat_str: 0, stat_agi: 0, stat_vit: 0, stat_int: 0, stat_dex: 0, stat_luk: 0, 
      equip_right_hand: '', equip_left_hand: '', equip_head: '', equip_face: '',
      equip_body: '', equip_glove: '', equip_garment: '', equip_shoes: '', equip_accessory: '', 
      extra_drop_item: '', extra_drop_chance: 0, skill_01: '', skill_02: '', skill_03: '',
      element: '無', size: '中型', atk_matk: 0, hit_100: 100, flee_95: 100, is_boss: false, is_range_atk: false,
      // 💡 リセット時もお掃除
      resist_stun: 0, resist_freeze: 0, resist_poison: 0, resist_blind: 0,

      // 🆕 新しい4つの耐性も、保存完了時やリセット時にきれいに 0 へ初期化クリーンアップ！
      resist_sleep: 0,
      resist_silence: 0,
      resist_curse: 0,
      resist_petrify: 0,

      // 💡 【追記】ドロップ確率や調教用パラメータも保存後にきれいにリセット
      drop_chance_weapon: 0,
      tame_success_chance: 0,
      tame_level_req: 1,

      // 💨 保存後にAspdの入力欄もきれいに空文字へリセットクリーンアップ！
      enemy_aspd: ""
    });  
  };
  
  const resetItemForm = () => { setIsEditing(false); setEditId(''); setItemForm({ name: '', item_type: 'weapon', item_subtype: '短剣', weapon_range: 'S', slot_count: 0, rarity: 'common', sell_price: 100, description: '', atk: 0, def: 0, mdef: 0, weapon_level: 1, equip_level_req: 1, job_restriction: '全職業', weight: 10, penalty_str: 0 }); };
  
  // 🔮 🆕 新設：リセット時（保存完了後など）に職業を全職業、必要Lvを1に綺麗に初期化クリーンする仕様
  const resetSkillForm = () => { 
    setIsEditing(false); 
    setEditId(''); 
    setSkillForm({ 
      name: '', skill_type: 'magic', sp_cost: 0, effect_value: 0, description: '', cast_time: 0, is_absolute_hit: true,
      job_requirement: '全職業', level_requirement: 1,
      target_type: '単体エネミー', use_condition: '戦闘中のみ', element: '無',
      effect_type: 'なし', effect_chance: 0, duration_turns: 0,
      value_type: 'percent' // 🔮 🆕 リセット時もお掃除
    }); 
  };

  // 🔮 ログリストにカードの効果を文字列表現にコンバートして一発で浮き出させる神ヘルパー関数
  const renderCardEffectsLabel = (item) => {
    if (item.item_type !== 'card') return `(ATK:${item.atk}/DEF:${item.def})`;
    
    const parse = (type, target, value) => {
      if (!type || type === 'none') return null;
      const targetLabel = target.toUpperCase();
      if (type === 'add_stat') return `${targetLabel}+${value}`;
      if (type === 'pct_hp_sp') return `${targetLabel.replace('_PCT','')}+${value}%`;
      if (type === 'damage_size') return `${target}特効+${value}%`;
      if (type === 'damage_race') return `${target}種族+${value}%`;
      if (type === 'damage_element') return `${target}属性+${value}%`;
      if (type === 'resist_status') return `${target}耐性+${value}%`;
      if (type === 'inflict_status') return `${target}付与+${value}%`;
      if (type === 'hp_drain') return `HP吸収+${value}%`;
      return `${target}:${value}`;
    };

    const eff1 = parse(item.card_effect_type, item.card_effect_target, item.card_effect_value);
    const eff2 = parse(item.card_effect_type_2, item.card_effect_target_2, item.card_effect_value_2);
    const eff3 = parse(item.card_effect_type_3, item.card_effect_target_3, item.card_effect_value_3);

    const activeEffects = [eff1, eff2, eff3].filter(Boolean);
    return activeEffects.length > 0 ? `🔮[${activeEffects.join(' | ')}]` : '(効果未設定)';
  };

  // 共通の対象セレクトオプションの描画コンポーネント（DRY原則で綺麗に共通化）
  const RenderTargetOptions = ({ type }) => (
    <>
      <option value="">-- 対象を選択 --</option>
      {type === 'add_stat' && (
        <>
          <option value="hp">最大HP</option><option value="sp">最大SP</option>
          <option value="str">STR（腕力）</option><option value="agi">AGI（敏捷）</option>
          <option value="vit">VIT（体力）</option><option value="int">INT（知力）</option>
          <option value="dex">DEX（技量）</option><option value="luk">LUK（幸運）</option>
          <option value="critical">クリティカル率</option><option value="flee">Flee（回避）</option>
          <option value="mdef">MDEF（魔法防御）</option><option value="hit">Hit（命中）</option>
        </>
      )}
      {type === 'pct_hp_sp' && (
        <>
          <option value="hp_pct">最大HP +○○%</option>
          <option value="sp_pct">最大SP +○○%</option>
        </>
      )}
      {type === 'damage_size' && (<><option value="小型">小型</option><option value="中型">中型</option><option value="大型">大型</option></>)}
      {type === 'damage_race' && (<><option value="無形">無形</option><option value="不死">不死</option><option value="動物">動物</option><option value="植物">植物</option><option value="昆虫">昆虫</option><option value="魚貝">魚貝</option><option value="悪魔">悪魔</option><option value="人間">人間</option><option value="天使">天使</option><option value="竜族">竜族</option></>)}
      {type === 'damage_element' && (<><option value="無">無</option><option value="水">水</option><option value="地">地</option><option value="火">火</option><option value="風">風</option><option value="毒">毒</option><option value="聖">聖</option><option value="闇">闇</option><option value="念">念</option><option value="不死">不死</option></>)}
      {(type === 'resist_status' || type === 'inflict_status') && (<><option value="スタン">スタン</option><option value="凍結">凍結</option><option value="毒">毒</option><option value="暗闇">暗闇</option><option value="睡眠">睡眠</option><option value="沈滅">沈黙</option><option value="呪い">呪い</option><option value="石化">石化</option></>)}
      {type === 'hp_drain' && (
        <>
          <option value="">-- 吸収量（割合）を選択 --</option>
          <option value="drain_5">物理攻撃時：与ダメージの 5% を吸収</option>
          <option value="drain_10">物理攻撃時：与ダメージの 10% を吸収</option>
          <option value="drain_15">物理攻撃時：与ダメージの 15% を吸収</option>
          <option value="drain_20">物理攻撃時：与ダメージの 20% を吸収</option>
          <option value="drain_30">物理攻撃時：与ダメージの 30% を吸収</option>
        </>
      )}
    </>
  );

  // 🔍 🆕 各種リストのリアルタイム検索・フィルタ・ソート連結エンジン
  const filteredUnits = units.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(unitSearch.toLowerCase());
    const matchType = unitFilterType === 'all' || u.unit_type === unitFilterType;
    const matchJob = unitFilterJob === 'all' || u.job === unitFilterJob;
    const matchRace = unitFilterRace === 'all' || u.race === unitFilterRace;
    const matchElem = unitFilterElement === 'all' || u.element === unitFilterElement;
    const matchSize = unitFilterSize === 'all' || u.size === unitFilterSize;
    return matchSearch && matchType && matchJob && matchRace && matchElem && matchSize;
  }).sort((a, b) => {
    if (unitSortOrder === 'level_desc') return b.base_level - a.base_level;
    if (unitSortOrder === 'level_asc') return a.base_level - b.base_level;
    return a.name.localeCompare(b.name, 'ja');
  });

  const filteredItems = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(itemSearch.toLowerCase());
    const matchType = itemFilterType === 'all' || i.item_type === itemFilterType;
    const matchRarity = itemFilterRarity === 'all' || i.rarity === itemFilterRarity;
    return matchSearch && matchType && matchRarity;
  });

  const filteredSkills = skills.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(skillSearch.toLowerCase());
    const matchJob = skillFilterJob === 'all' || s.job_requirement === skillFilterJob;
    const matchType = skillFilterType === 'all' || s.skill_type === skillFilterType;
    const matchEff = skillFilterEffect === 'all' || s.effect_type === skillFilterEffect;
    const matchElem = skillFilterElement === 'all' || s.element === skillFilterElement;
    return matchSearch && matchJob && matchType && matchEff && matchElem;
  }).sort((a, b) => {
    if (skillSortOrder === 'sp_desc') return (b.sp_cost || 0) - (a.sp_cost || 0);
    if (skillSortOrder === 'lv_asc') return (a.level_requirement || 1) - (b.level_requirement || 1);
    return a.name.localeCompare(b.name, 'ja');
  });

  // 🔮 🆕 クエストのリスト表示用リアルタイム検索・フィルタリングエンジン
  const [questSearch, setQuestSearch] = useState('');
  const [questFilterDifficulty, setQuestFilterDifficulty] = useState('all');
  const filteredQuests = quests.filter(q => {
    const matchSearch = q.name.toLowerCase().includes(questSearch.toLowerCase());
    const matchDiff = questFilterDifficulty === 'all' || q.difficulty === questFilterDifficulty;
    return matchSearch && matchDiff;
  });

  return (
    <div style={{ backgroundColor: '#0b0f19', minHeight: '100vh', color: '#f1f5f9', padding: '3vw', boxSizing: 'border-box' }}>
      <style>{`
        .gm-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 20px; max-width: 1600px; margin: 0 auto; }
        .gm-flex-head { display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto 25px; border-bottom: 2px solid #1e293b; padding-bottom: 15px; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #0b0f19; padding: 10px; border-radius: 8px; border: 1px solid #1e293b; }
        .equip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; background: #0b0f19; padding: 10px; border-radius: 8px; border: 1px solid #1e293b; }
        
        /* 🔮 🆕 高級検索用インテリジェントCSSスタイル群 */
        .filter-box { display: flex; flex-wrap: wrap; gap: 5px; background: #0b0f19; padding: 6px; border-radius: 8px; border: 1px solid #1e293b; margin-bottom: 6px; }
        .filter-select { background: #111827; border: 1px solid #334155; color: #fff; padding: 3px 6px; font-size: 0.65rem; border-radius: 4px; outline: none; cursor: pointer; }
        .search-input { flex: 1; min-width: 140px; background: #111827; border: 1px solid #334155; color: #fff; padding: 3px 6px; font-size: 0.68rem; border-radius: 4px; outline: none; }
        .scroll-list { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; padding-right: 2px; }
        
        @media (max-width: 1200px) { .gm-grid { grid-template-columns: 1fr; } .gm-flex-head { flex-direction: column; align-items: flex-start; gap: 15px; } .equip-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="gm-flex-head">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>🔮 QUEST HUB - RO EDITION GM CONTROL</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>三土手創世神仕様：トリプル特殊効果内蔵カード創造＆ログ一発エンライトメント</p>
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
              {/* 🔮 🆕 クエスト創造タブを綺麗に4番目へ拡張！ */}
              <button type="button" onClick={() => setActiveTab('quests')} style={{ flex: 1, padding: '8px 2px', background: activeTab === 'quests' ? '#1e293b' : 'none', color: activeTab === 'quests' ? '#f59e0b' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>④ クエスト創造</button>
            </div>
          )}

          {activeTab === 'units' && (
            <form onSubmit={handleUnitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>所属側</label>
                  <select value={unitForm.unit_type} onChange={(e) => {
                    const nextType = e.target.value;
                    setUnitForm({ ...unitForm, unit_type: nextType, race: nextType === 'enemy' ? '無形' : '人間' });
                  }} style={inputStyle}>
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
                  {unitForm.unit_type === 'enemy' ? (
                    <select value={unitForm.race} onChange={(e) => setUnitForm({...unitForm, race: e.target.value})} style={inputStyle}>
                      <option value="無形">無形</option><option value="不死">不死</option><option value="動物">動物</option><option value="植物">植物</option><option value="昆虫">昆虫</option><option value="魚貝">魚貝</option><option value="悪魔">悪魔</option><option value="人間">人間</option><option value="天使">天使</option><option value="竜族">竜族</option>
                    </select>
                  ) : (
                    <input type="text" required placeholder="例: 人間" value={unitForm.race} onChange={(e) => setUnitForm({...unitForm, race: e.target.value})} style={inputStyle} />
                  )}
                </div>
                <div>
                  {/* 🔮 🆕 ユニット（初期キャラ素体）創造の職業枠を手入力から「オリジナル8職セレクトボックス」へ完全一本化！ */}
                  <label style={labelStyle}>👤 初期職業・クラス制限</label>
                  <select value={unitForm.job} onChange={(e) => setUnitForm({...unitForm, job: e.target.value})} style={inputStyle}>
                    <option value="ノービス">ノービス</option>
                    <option value="ファイター">ファイター（戦士）</option>
                    <option value="メイジ">メイジ（魔術士）</option>
                    <option value="クレリック">クレリック（聖職者）</option>
                    <option value="スカウト">スカウト（隠密）</option>
                    <option value="ハンター">ハンター（狩人）</option>
                    <option value="トレーダー">トレーダー（商人）</option>
                    <option value="テイマー">テイマー（魔物使い）</option>
                  </select>
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

              {/* 🔮 🆕 【三土手創世神特注：モンスター専用 スキル・ドロップ・調教仲間化 統合コントロールセンター】 */}
              {unitForm.unit_type === 'enemy' && (
                <div style={{ background: '#0f172a', border: '1px dashed #6366f1', padding: '14px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>⚙️ 敵モンスター専用：スキル・ドロップ・調教仲間化設定</span>

                  {/* ─── 枠①：モンスターAI使用スキル習得（最大3枠） ─── */}
                  <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>🔮 行動AI：使用習得スキル・大魔法（最大3枠）</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                      <div>
                        <label style={labelStyle}>スキル枠①</label>
                        <select value={unitForm.skill_01 || ''} onChange={(e) => setUnitForm({...unitForm, skill_01: e.target.value})} style={inputStyle}>
                          <option value="">使用なし</option>
                          {skills.map(s => <option key={'es1-'+s.id} value={s.id}>{s.name} ({s.skill_type === 'magic' ? '魔法' : '物理'})</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>スキル枠②</label>
                        <select value={unitForm.skill_02 || ''} onChange={(e) => setUnitForm({...unitForm, skill_02: e.target.value})} style={inputStyle}>
                          <option value="">使用なし</option>
                          {skills.map(s => <option key={'es2-'+s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>スキル枠③</label>
                        <select value={unitForm.skill_03 || ''} onChange={(e) => setUnitForm({...unitForm, skill_03: e.target.value})} style={inputStyle}>
                          <option value="">使用なし</option>
                          {skills.map(s => <option key={'es3-'+s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ─── 枠②：装備＆所持品完全連動・ドロップ確率セッティング ─── */}
                  <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>📦 戦利品ドロップ：装備武具 ＆ 固有レアアイテムドロップ確率 (%)</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      
                      {/* 装備連動枠 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#0b0f19', padding: '6px', borderRadius: '6px' }}>
                        <div>
                          <span style={{ fontSize: '0.6rem', color: '#94a3b8', display: 'block' }}>🛡️ 右手武器ドロップ（上の選択に全自動連動）</span>
                          <strong style={{ fontSize: '0.72rem', color: unitForm.equip_right_hand ? '#ffd700' : '#475569' }}>
                            {items.find(i => i.id === unitForm.equip_right_hand)?.name || '未装備（ドロップなし）'}
                          </strong>
                        </div>
                        <div>
                          <label style={labelStyle}>武器ドロップ確率 (%)</label>
                          <input type="number" min="0" max="100" placeholder="0〜100%" value={unitForm.drop_chance_weapon || 0} onChange={(e) => setUnitForm({...unitForm, drop_chance_weapon: Number(e.target.value)})} style={inputStyle} disabled={!unitForm.equip_right_hand} />
                        </div>
                      </div>

                      {/* 固有レア・カードドロップ枠 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', background: '#0b0f19', padding: '6px', borderRadius: '6px' }}>
                        <div>
                          <label style={labelStyle}>🃏 固有レアドロップ枠（カードや素材を選択）</label>
                          <select value={unitForm.extra_drop_item || ''} onChange={(e) => setUnitForm({...unitForm, extra_drop_item: e.target.value})} style={inputStyle}>
                            <option value="">ドロップなし</option>
                            {items.map(i => <option key={'ed-'+i.id} value={i.id}>[{i.item_subtype}] {i.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>レアドロップ確率 (%)</label>
                          <input type="number" min="0" max="100" placeholder="例: 0.01% 〜 10%" value={unitForm.extra_drop_chance || 0} onChange={(e) => setUnitForm({...unitForm, extra_drop_chance: Number(e.target.value)})} style={inputStyle} disabled={!unitForm.extra_drop_item} />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ─── 枠③：テイマー専用・魔物調教仲間化ガンビット ─── */}
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>🐾 テイマー専用：魔物調教・仲間化確率 ＆ 条件設定</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: '6px', alignItems: 'center' }}>
                      <div>
                        <label style={labelStyle}>仲間化の可否</label>
                        <label style={{ fontSize: '0.68rem', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                          <input type="checkbox" checked={unitForm.is_tamable} onChange={(e) => setUnitForm({...unitForm, is_tamable: e.target.checked})} /> 調教可能にする
                        </label>
                      </div>
                      <div>
                        <label style={labelStyle}>基礎調教成功確率 (%)</label>
                        <input type="number" min="0" max="100" placeholder="例: 20%" value={unitForm.tame_success_chance || 0} onChange={(e) => setUnitForm({...unitForm, tame_success_chance: Number(e.target.value)})} style={inputStyle} disabled={!unitForm.is_tamable} />
                      </div>
                      <div>
                        <label style={labelStyle}>👤 テイマー必須習得レベル</label>
                        <input type="number" min="1" max="50" placeholder="例: Lv.15以上" value={unitForm.tame_level_req || 1} onChange={(e) => setUnitForm({...unitForm, tame_level_req: Number(e.target.value)})} style={inputStyle} disabled={!unitForm.is_tamable} />
                      </div>
                    </div>
                  </div>

                </div>
              )}

              <div className="stat-grid">
                <div style={{ gridColumn: 'span 2' }}><label style={{...labelStyle, color: '#f43f5e'}}>MHP (最大HP)</label><input type="number" value={unitForm.base_hp} onChange={(e) => setUnitForm({...unitForm, base_hp: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: 'span 2' }}><label style={{...labelStyle, color: '#38bdf8'}}>MSP (最大SP)</label><input type="number" value={unitForm.base_sp} onChange={(e) => setUnitForm({...unitForm, base_sp: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>STR</label><input type="number" value={unitForm.stat_str} onChange={(e) => setUnitForm({...unitForm, stat_str: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>AGI</label><input type="number" value={unitForm.stat_agi} onChange={(e) => setUnitForm({...unitForm, stat_agi: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>VIT</label><input type="number" value={unitForm.stat_vit} onChange={(e) => setUnitForm({...unitForm, stat_vit: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>INT</label><input type="number" value={unitForm.stat_int} onChange={(e) => setUnitForm({...unitForm, stat_int: e.target.value})} style={inputStyle} /></div>
                
                {/* 🛠️ 🆕 ここにベースレベル入力欄を増築し、DEXとLUKの幅を調整してピッタリはめ込みます */}
                <div style={{ gridColumn: 'span 2' }}><label style={{...labelStyle, color: '#fbbf24'}}>📈 ベースLv</label><input type="number" min="1" value={unitForm.base_level} onChange={(e) => setUnitForm({...unitForm, base_level: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>DEX</label><input type="number" value={unitForm.stat_dex} onChange={(e) => setUnitForm({...unitForm, stat_dex: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>LUK</label><input type="number" value={unitForm.stat_luk} onChange={(e) => setUnitForm({...unitForm, stat_luk: e.target.value})} style={inputStyle} /></div>
              </div>

              {/* 🔮 🆕 【三土手創世神専用：敵Aspd個別上書き入力欄の設置】 */}
              {unitForm.unit_type === 'enemy' && (
                <div style={{ marginTop: '6px', marginBottom: '8px', background: '#0b0f19', padding: '10px', borderRadius: '8px', border: '1px dashed #334155' }}>
                  <label style={{ ...labelStyle, color: '#ffd700', display: 'flex', alignItems: 'center', gap: '4px' }}>💨 敵専用：攻撃速度 (Aspd) 個別上書き設定</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="193" 
                    placeholder="未入力時は本家基本値【150.0】が適用されます (最速193)" 
                    value={unitForm.enemy_aspd || ''} 
                    onChange={(e) => setUnitForm({...unitForm, enemy_aspd: e.target.value})} 
                    style={inputStyle} 
                  />
                </div>
              )}

              {/* 🔮 🆕 【三土手創世神専用：モンスター戦闘力予測シミュレーターボード】 */}
              {(() => {
                const sStr = Number(unitForm.stat_str || 0);
                const sAgi = Number(unitForm.stat_agi || 0);
                const sVit = Number(unitForm.stat_vit || 0);
                const sInt = Number(unitForm.stat_int || 0);
                const sDex = Number(unitForm.stat_dex || 0);
                const sLuk = Number(unitForm.stat_luk || 0);
                const sLv  = Number(unitForm.base_level || 1);

                // 世界の数理法則と100%シンクロさせた自動Derived計算
                const pAtk = Math.floor(sStr + (sDex * 0.5) + (sLv * 0.2)); 
                const pMinMatk = Math.floor(sInt + (sDex * 0.2));
                const pMaxMatk = Math.floor(sInt * 2.0 + sDex);
                const pDef = Math.floor(sVit * 0.5 + (sLv * 0.1));
                const pMdef = Math.floor(sInt * 0.5 + (sVit * 0.2));
                const pHit = Math.floor(sLv + sDex + sLuk * 0.2 + 20);
                const pFlee = Math.floor(sLv + sAgi + sLuk * 0.2 + 10);

                // 💡 【上書き対応数理】もし入力欄に数値があればそれを採用、なければ基本の150.0を自動マウント！
                const displayAspd = unitForm.enemy_aspd ? Number(unitForm.enemy_aspd).toFixed(1) : "150.0";

                return (
                  <div style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '12px', borderRadius: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#ffd700', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>📊 創世ユニット戦闘力予測プレビュー (ステ振り連動)</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px', fontSize: '0.72rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '2px' }}><span style={{ color: '#94a3b8' }}>攻撃力 (Atk)</span><strong style={{ color: '#fff', fontFamily: 'monospace' }}>{pAtk}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '2px' }}><span style={{ color: '#38bdf8' }}>魔力 (Matk)</span><strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{pMinMatk} 〜 {pMaxMatk}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '2px' }}><span style={{ color: '#34d399' }}>防御力 (Def)</span><strong style={{ color: '#34d399', fontFamily: 'monospace' }}>+{pDef}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '2px' }}><span style={{ color: '#f472b6' }}>魔法防御 (Mdef)</span><strong style={{ color: '#f472b6', fontFamily: 'monospace' }}>+{pMdef}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '2px' }}><span style={{ color: '#fbbf24' }}>命中 (Hit)</span><strong style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{pHit}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '2px' }}><span style={{ color: '#eee' }}>回避 (Flee)</span><strong style={{ color: '#eee', fontFamily: 'monospace' }}>{pFlee}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '2px', gridColumn: 'span 2' }}><span style={{ color: '#ffd700' }}>💨 確定行動速度 (Aspd)</span><strong style={{ color: '#ffd700', fontFamily: 'monospace' }}>{displayAspd}</strong></div>
                    </div>
                  </div>
                );
              })()}

              {/* 👑 三土手神専用：4大状態異常・固有防御耐性％セッティングパネルの増築！ */}
              <div style={{ background: '#0f172a', border: '1px dashed #a78bfa', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 'bold' }}>✨ 全8大状態異常・固有防御耐性セッティング (%)</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  <div><label style={labelStyle}>スタン耐性</label><input type="number" min="0" max="100" placeholder="%" value={unitForm.resist_stun || 0} onChange={(e) => setUnitForm({...unitForm, resist_stun: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>凍結耐性</label><input type="number" min="0" max="100" placeholder="%" value={unitForm.resist_freeze || 0} onChange={(e) => setUnitForm({...unitForm, resist_freeze: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>毒耐性</label><input type="number" min="0" max="100" placeholder="%" value={unitForm.resist_poison || 0} onChange={(e) => setUnitForm({...unitForm, resist_poison: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>暗闇耐性</label><input type="number" min="0" max="100" placeholder="%" value={unitForm.resist_blind || 0} onChange={(e) => setUnitForm({...unitForm, resist_blind: e.target.value})} style={inputStyle} /></div>
                  
                  {/* 🆕 ここから下の段に新状態異常4つを完全同期マウント！ */}
                  <div><label style={labelStyle}>睡眠耐性</label><input type="number" min="0" max="100" placeholder="%" value={unitForm.resist_sleep || 0} onChange={(e) => setUnitForm({...unitForm, resist_sleep: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>沈黙耐性</label><input type="number" min="0" max="100" placeholder="%" value={unitForm.resist_silence || 0} onChange={(e) => setUnitForm({...unitForm, resist_silence: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>呪い耐性</label><input type="number" min="0" max="100" placeholder="%" value={unitForm.resist_curse || 0} onChange={(e) => setUnitForm({...unitForm, resist_curse: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>石化耐性</label><input type="number" min="0" max="100" placeholder="%" value={unitForm.resist_petrify || 0} onChange={(e) => setUnitForm({...unitForm, resist_petrify: e.target.value})} style={inputStyle} /></div>
                </div>
              </div>

              <button type="submit" style={saveBtnStyle}>神の権能：RO式ユニットを創造</button>
            </form>
          )}

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

              {/* 🔮 【神改修】アイテム大分類がカードの場合、最大3連の特殊マルチスロット設定UIを展開 */}
              {['card', 'weapon', 'armor'].includes(itemForm.item_type) && (
                <div style={{ background: '#0f172a', border: '1px dashed #f59e0b', padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'bold' }}>🔮 武具・カード共通：トリプル特殊効果バインド設定</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b' }}>※アイテム自体に最大3つまで独立したロマン効果（固有付与や固有耐性）を直接宿せます。</span>

                  {/* ─── 効果スロット1 ─── */}
                  <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '0.65rem', color: '#ffd700', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>【効果枠 ①】</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                      <div>
                        <select value={cardEffectType1} onChange={(e) => setCardEffectType1(e.target.value)} style={inputStyle}>
                          <option value="add_stat">ステータス固定加算（+○○）</option>
                          <option value="pct_hp_sp">HP・SP割合上昇（+○○%）</option>
                          <option value="damage_size">モンスターサイズ特効（+○○%）</option>
                          <option value="damage_race">モンスター種族特効（+○○%）</option>
                          <option value="damage_element">モンスター属性特効（+○○%）</option>
                          <option value="resist_status">状態異常耐性（+○○%）</option>
                          <option value="inflict_status">状態異常付与確率（+○○%）</option>
                          <option value="hp_drain">HP吸収（確率○○%）</option>
                        </select>
                      </div>
                      <div>
                        <select value={cardEffectTarget1} onChange={(e) => setCardEffectTarget1(e.target.value)} style={inputStyle}>
                          <option value="">-- 対象を選択 --</option>
                          <RenderTargetOptions type={cardEffectType1} />
                        </select>
                      </div>
                      <div>
                        <input type="number" value={cardEffectValue1} onChange={(e) => setCardEffectValue1(e.target.value)} placeholder="数値" style={inputStyle} />
                      </div>
                    </div>
                  </div>

                  {/* ─── 効果スロット2 ─── */}
                  <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '0.65rem', color: '#ba9a6f', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>【効果枠 ②】</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                      <div>
                        <select value={cardEffectType2} onChange={(e) => setCardEffectType2(e.target.value)} style={inputStyle}>
                          <option value="none">なし (不活性)</option>
                          <option value="add_stat">ステータス固定加算（+○○）</option>
                          <option value="pct_hp_sp">HP・SP割合上昇（+○○%）</option>
                          <option value="damage_size">モンスターサイズ特効（+○○%）</option>
                          <option value="damage_race">モンスター種族特効（+○○%）</option>
                          <option value="damage_element">モンスター属性特効（+○○%）</option>
                          <option value="resist_status">状態異常耐性（+○○%）</option>
                          <option value="inflict_status">状態異常付与確率（+○○%）</option>
                          <option value="hp_drain">HP吸収（確率○○%）</option>
                        </select>
                      </div>
                      <div>
                        <select value={cardEffectTarget2} onChange={(e) => setCardEffectTarget2(e.target.value)} style={inputStyle} disabled={cardEffectType2 === 'none'}>
                          <option value="">-- 対象を選択 --</option>
                          <RenderTargetOptions type={cardEffectType2} />
                        </select>
                      </div>
                      <div>
                        <input type="number" value={cardEffectValue2} onChange={(e) => setCardEffectValue2(e.target.value)} placeholder="数値" style={inputStyle} disabled={cardEffectType2 === 'none'} />
                      </div>
                    </div>
                  </div>

                  {/* ─── 効果スロット3 ─── */}
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#ba9a6f', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>【効果枠 ③】</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                      <div>
                        <select value={cardEffectType3} onChange={(e) => setCardEffectType3(e.target.value)} style={inputStyle}>
                          <option value="none">なし (不活性)</option>
                          <option value="add_stat">ステータs固定加算（+○○）</option>
                          <option value="pct_hp_sp">HP・SP割合上昇（+○○%）</option>
                          <option value="damage_size">モンスターサイズ特効（+○○%）</option>
                          <option value="damage_race">モンスター種族特効（+○○%）</option>
                          <option value="damage_element">モンスター属性特効（+○○%）</option>
                          <option value="resist_status">状態異常耐性（+○○%）</option>
                          <option value="inflict_status">状態異常付与確率（+○○%）</option>
                          <option value="hp_drain">HP吸収（確率○○%）</option>
                        </select>
                      </div>
                      <div>
                        <select value={cardEffectTarget3} onChange={(e) => setCardEffectTarget3(e.target.value)} style={inputStyle} disabled={cardEffectType3 === 'none'}>
                          <option value="">-- 対象を選択 --</option>
                          <RenderTargetOptions type={cardEffectType3} />
                        </select>
                      </div>
                      <div>
                        <input type="number" value={cardEffectValue3} onChange={(e) => setCardEffectValue3(e.target.value)} placeholder="数値" style={inputStyle} disabled={cardEffectType3 === 'none'} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 🛡️ ⚔️ 【完全復活】武器または防具の時は、RO式スペック詳細設定（ATK/DEF/レベル制限等）を下に並列して同時表示！ */}
              {['weapon', 'armor'].includes(itemForm.item_type) && (
                <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 'bold' }}>⚔️ 武具アイテム固有・基本RO式ステータス設定</span>
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
                    <div>
                      <label style={labelStyle}>👤 装備可能な職業制限</label>
                      <select value={itemForm.job_restriction} onChange={(e) => setItemForm({...itemForm, job_restriction: e.target.value})} style={inputStyle}>
                        <option value="全職業">全職業共通</option>
                        <option value="ノービス">ノービス専用</option>
                        <option value="ファイター">ファイター専用</option>
                        <option value="メイジ">メイジ専用</option>
                        <option value="クレリック">クレリック専用</option>
                        <option value="スカウト">スカウト専用</option>
                        <option value="ハンター">ハンター専用</option>
                        <option value="トレーダー">トレーダー専用</option>
                        <option value="テイマー">テイマー専用</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {itemForm.item_type === 'weapon' && (
                <div style={{ background: '#0b0f19', padding: '10px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                  <label style={{ ...labelStyle, color: '#f59e0b' }}>🏹 武器射程レンジ</label>
                  <select value={itemForm.weapon_range} onChange={(e) => setItemForm({...itemForm, weapon_range: e.target.value})} style={inputStyle}>
                    <option value="S">Sレンジ（近距離攻撃：前衛からのみ通常攻撃可能）</option>
                    <option value="L">Lレンジ（遠距離攻撃：前衛・後衛どこからでも通常攻撃可能）</option>
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
              
              {/* 🔮 🆕 スキル解放条件セクション：職業と必要Lvの縛りUIを直撃追加！ */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', background: '#0f172a', border: '1px dashed #38bdf8', padding: '10px', borderRadius: '8px' }}>
                <div>
                  <label style={labelStyle}>🔑 習得可能な職業制限</label>
                  <select value={skillForm.job_requirement || '全職業'} onChange={(e) => setSkillForm({...skillForm, job_requirement: e.target.value})} style={inputStyle}>
                    {/* 💡 プルダウンの中身も三土手世界のオリジナル職名へ完全移行！ */}
                    <option value="全職業">全職業共通</option>
                    <option value="ノービス">ノービス</option>
                    <option value="ファイター">ファイター（戦士）</option>
                    <option value="メイジ">メイジ（魔術士）</option>
                    <option value="クレリック">クレリック（聖職者）</option>
                    <option value="スカウト">スカウト（隠密）</option>
                    <option value="ハンター">ハンター（狩人）</option>
                    <option value="トレーダー">トレーダー（商人）</option>
                    <option value="テイマー">テイマー（魔物使い）</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>📈 必要ベースLv</label>
                  <input type="number" min="1" value={skillForm.level_requirement || 1} onChange={(e) => setSkillForm({...skillForm, level_requirement: Number(e.target.value)})} style={inputStyle} />
                </div>
              </div>

              {/* 🔮 🛠️ 創造神リフォーム：数値の単位（％か固定値か）を綺麗に独立選択させる全4列のワイドグリッド！ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1.2fr', gap: '10px' }}>
                <div><label style={labelStyle}>技能分類</label><select value={skillForm.skill_type} onChange={(e) => setSkillForm({...skillForm, skill_type: e.target.value})} style={inputStyle}><option value="magic">魔法</option><option value="art">物理特技</option></select></div>
                <div><label style={{...labelStyle, color: '#38bdf8'}}>消費SP</label><input type="number" value={skillForm.sp_cost} onChange={(e) => setSkillForm({...skillForm, sp_cost: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>基礎効果数値（威力 / 回復量）</label><input type="number" value={skillForm.effect_value} onChange={(e) => setSkillForm({...skillForm, effect_value: e.target.value})} style={inputStyle} /></div>
                <div>
                  <label style={{...labelStyle, color: '#ffd700'}}>📐 計算単位（仕様）</label>
                  <select value={skillForm.value_type || 'percent'} onChange={(e) => setSkillForm({...skillForm, value_type: e.target.value})} style={{ ...inputStyle, border: '1px solid #ffd70044', color: '#ffd700' }}>
                    <option value="percent">％表記 (倍率計算)</option>
                    <option value="fixed">固定値 (そのままの数)</option>
                  </select>
                </div>
              </div>

              {/* 🎯 🆕 ターゲット ＆ 発動環境 ＆ 属性セクション */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: '#0f172a', border: '1px dashed #475569', padding: '10px', borderRadius: '8px' }}>
                <div>
                  <label style={labelStyle}>🎯 効果の対象（ターゲット）</label>
                  <select value={skillForm.target_type || '単体エネミー'} onChange={(e) => setSkillForm({...skillForm, target_type: e.target.value})} style={inputStyle}>
                    <option value="単体エネミー">単体エネミー（単体攻撃）</option>
                    <option value="範囲エネミー">範囲エネミー（敵全体攻撃）</option>
                    <option value="味方単体">味方単体（回復・バフ）</option>
                    {/* 🔮 🆕 クエストハブEdition：パーティー全員を一斉救済・強化する「味方全体」枠を完全解放！ */}
                    <option value="味方全体">味方全体（全体回復・全体バフ）</option>
                    <option value="自分自身">自分自身（自己強化）</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>🗺️ 使用可能シチュエーション</label>
                  <select value={skillForm.use_condition || '戦闘中のみ'} onChange={(e) => setSkillForm({...skillForm, use_condition: e.target.value})} style={inputStyle}>
                    <option value="戦闘中のみ">戦闘中のみ可能</option>
                    <option value="フィールドのみ">非戦闘時（フィールド等）のみ</option>
                    <option value="常時可能">常時どこでも使用可能</option>
                    <option value="魔物調教">テイマー専用：敵のHP20%以下で可能</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>🔥 技・魔法の固有属性</label>
                  <select value={skillForm.element || '無'} onChange={(e) => setSkillForm({...skillForm, element: e.target.value})} style={inputStyle}>
                    <option value="無">無属性</option>
<option value="火">火属性（地属性に強い・2.0倍）</option>
<option value="水">水属性（火属性に強い・2.0倍）</option>
<option value="風">风属性（水属性に強い・2.0倍）</option> {/* 💡 風は水に強い！ */}
<option value="地">地属性（風属性に強い・2.0倍）</option> {/* 💡 地は風に強い！ */}
<option value="聖">聖属性（不死・闇に特効・2.0倍）</option>
                    <option value="闇">闇属性</option>
                    <option value="不死">不死属性</option>
                  </select>
                </div>
              </div>

              {/* 🧪 🆕 追加効果（状態異常・バフ） ＆ 確率 ＆ 持続時間セクション */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: '#1e1b4b', border: '1px solid #4338ca', padding: '10px', borderRadius: '8px' }}>
                <div>
                  <label style={{...labelStyle, color: '#a78bfa'}}>✨ 追加付与効果（バフ・デバフ・異常）</label>
                  <select value={skillForm.effect_type || 'なし'} onChange={(e) => setSkillForm({...skillForm, effect_type: e.target.value})} style={inputStyle}>
                    <option value="なし">追加効果なし（純粋ダメージ）</option>
                    <option value="状態異常回復">状態異常回復（キュア・万能薬）</option>
                    <option value="スタン">スタン付与（行動不能）</option>
                    <option value="凍結">凍結付与（水属性化＋行動不能）</option>
                    <option value="毒">毒付与（ターン毎にスリップダメージ）</option>
                    <option value="暗闇">暗闇付与（敵の命中率Hitを大幅低下）</option>
                    
                    {/* 🆕 新状態異常の4大セレクトオプションをここに完全開通！ */}
                    <option value="睡眠">睡眠付与（完全行動不能＋被ダメ増）</option>
                    <option value="沈黙">沈黙付与（敵の魔法・スキルを完全封印）</option>
                    <option value="呪い">呪い付与（敵のSTR半減＋CRIゼロ化）</option>
                    <option value="石化">石化付与（完全行動不能＋防御ゼロ化）</option>

                    <option value="攻撃バフ">物理ATK増幅（味方・自分）</option>
                    <option value="防御バフ">物理DEF増幅（味方・自分）</option>
                    <option value="速度バフ">行動速度Aspd増幅</option>
                  </select>
                </div>
                <div>
                  <label style={{...labelStyle, color: '#a78bfa'}}>🎲 追加効果の発動確率 (%)</label>
                  <input type="number" min="0" max="100" placeholder="例: 30" value={skillForm.effect_chance || 0} onChange={(e) => setSkillForm({...skillForm, effect_chance: Number(e.target.value)})} style={inputStyle} />
                </div>
                <div>
                  <label style={{...labelStyle, color: '#a78bfa'}}>⏱️ 効果の持続ターン数</label>
                  <input type="number" min="0" placeholder="例: 3" value={skillForm.duration_turns || 0} onChange={(e) => setSkillForm({...skillForm, duration_turns: Number(e.target.value)})} style={inputStyle} />
                </div>
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

          {/* 🔮 🆕 クエストファクトリー：B1〜B5個別コンフィグ連動型マルチ階層フォーム */}
          {activeTab === 'quests' && (
            <form onSubmit={handleQuestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>クエストの世界名称</label>
                <input type="text" required placeholder="例: 🦇 幻影の古城ダンジョン" value={questForm.name} onChange={(e) => setQuestForm({...questForm, name: e.target.value})} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div><label style={labelStyle}>📈 推奨レベル</label><input type="number" min="1" value={questForm.level} onChange={(e) => setQuestForm({...questForm, level: e.target.value})} style={inputStyle} /></div>
                <div>
                  <label style={labelStyle}>⏳ 総階層数 (最大5)</label>
                  <input type="number" min="1" max="5" value={questForm.floors} onChange={(e) => {
                    const fCount = Math.min(5, Math.max(1, Number(e.target.value)));
                    setQuestForm({...questForm, floors: fCount});
                    // 総階層数に合わせてfloorConfigsの配列長を自動拡張
                    setFloorConfigs(prev => {
                      const next = [...prev];
                      while(next.length < fCount) {
                        // 🛠️ B2以降が自動増殖する時も、安全に出現数の初期枠（1〜2体）を持たせる
                        next.push({ floor: next.length + 1, enemy_ids: ['', '', ''], battle_count: 3, chest_count: 1, has_fountain: false, min_spawn: 1, max_spawn: 2 });
                      }
                      return next.slice(0, fCount);
                    });
                  }} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>💎 危険度・難易度</label>
                  <select value={questForm.difficulty} onChange={(e) => setQuestForm({...questForm, difficulty: e.target.value})} style={inputStyle}>
                    <option value="E">Rank E</option><option value="D">Rank D</option><option value="C">Rank C</option><option value="B">Rank B</option><option value="A">Rank A</option><option value="S">Rank S</option>
                  </select>
                </div>
              </div>

              {/* 🧭 🆕 階層切り替えサブインフラタブ */}
              <div style={{ display: 'flex', gap: '4px', background: '#0b0f19', padding: '3px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                {Array.from({ length: questForm.floors }).map((_, i) => {
                  const fNum = i + 1;
                  return (
                    <button key={'f-tab-'+fNum} type="button" onClick={() => setActiveFloorTab(fNum)} style={{ flex: 1, padding: '5px', background: activeFloorTab === fNum ? '#4338ca' : 'none', color: activeFloorTab === fNum ? '#ffd700' : '#64748b', border: 'none', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}>
                      {fNum === questForm.floors ? `B${fNum} (最深部)` : `B${fNum}階`}
                    </button>
                  );
                })}
              </div>

              {/* 🎰 現在選択されている階層の個別パラメータ編集ボード */}
              {floorConfigs.map(fConfig => {
                if (fConfig.floor !== activeFloorTab) return null;
                return (
                  <div key={'f-panel-'+fConfig.floor} style={{ background: '#1e1b4b', padding: '12px', border: '1px solid #4338ca', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ ...labelStyle, color: '#ffd700', fontSize: '0.72rem' }}>⚙️ 【B{fConfig.floor}階】 のイベント＆出現モンスター設計</span>
                    
                    {/* 🛠️ 1列増やして「1fr 1fr 1fr 1fr 1fr」の5列ワイドグリッドに変更し、出現数ノブをインジェクション！ */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1fr 1fr', gap: '6px' }}>
                      <div>
                        <label style={labelStyle}>⚔️ 必要戦闘回数</label>
                        <input type="number" min="0" value={fConfig.battle_count} onChange={(e) => handleFloorConfigChange(fConfig.floor, 'battle_count', Number(e.target.value))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>🎁 配置宝箱の数</label>
                        <input type="number" min="0" value={fConfig.chest_count} onChange={(e) => handleFloorConfigChange(fConfig.floor, 'chest_count', Number(e.target.value))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>⛲ 回復の泉</label>
                        <select value={fConfig.has_fountain ? 'true' : 'false'} onChange={(e) => handleFloorConfigChange(fConfig.floor, 'has_fountain', e.target.value === 'true')} style={inputStyle}>
                          <option value="false">なし</option>
                          <option value="true">設置</option>
                        </select>
                      </div>
                      {/* 🆕 最小出現数入力欄 */}
                      <div>
                        <label style={{ ...labelStyle, color: '#f43f5e' }}>👹 最小出現</label>
                        <input type="number" min="1" max="3" value={fConfig.min_spawn || 1} onChange={(e) => handleFloorConfigChange(fConfig.floor, 'min_spawn', Math.min(3, Math.max(1, Number(e.target.value))))} style={inputStyle} />
                      </div>
                      {/* 🆕 最大出現数入力欄 */}
                      <div>
                        <label style={{ ...labelStyle, color: '#f43f5e' }}>👹 最大出現</label>
                        <input type="number" min="1" max="3" value={fConfig.max_spawn || 2} onChange={(e) => handleFloorConfigChange(fConfig.floor, 'max_spawn', Math.min(3, Math.max(1, Number(e.target.value))))} style={inputStyle} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', background: '#0b0f19', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.62rem', color: '#a78bfa', fontWeight: 'bold' }}>👾 この階層でポップする敵の抽選プール（最大3種類）</span>
                      {[0, 1, 2].map(idx => (
                        <div key={'f-enemy-'+idx}>
                          <label style={labelStyle}>モンスター出現枠 {idx + 1} {idx === 0 && ' (※必須)'}</label>
                          <select required={idx === 0} value={fConfig.enemy_ids[idx] || ''} onChange={(e) => handleFloorEnemyChange(fConfig.floor, idx, e.target.value)} style={inputStyle}>
                            <option value="">{idx === 0 ? '-- モンスターを選択 --' : '-- 配置なし --'}</option>
                            {units.filter(u => u.unit_type === 'enemy' || u.unit_type === 'monster').map(u => (
                              <option key={`f-opt-${fConfig.floor}-${idx}-${u.id}`} value={u.id}>{u.name} (Lv.{u.base_level})</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={{ ...labelStyle, color: '#34d399' }}>🎁 獲得 Base EXP</label><input type="number" value={questForm.exp_reward} onChange={(e) => setQuestForm({...questForm, exp_reward: e.target.value})} style={inputStyle} /></div>
                <div><label style={{ ...labelStyle, color: '#ffd700' }}>💰 獲得 Zeny報酬</label><input type="number" value={questForm.zeny_reward} onChange={(e) => setQuestForm({...questForm, zeny_reward: e.target.value})} style={inputStyle} /></div>
              </div>

              <div>
                <label style={labelStyle}>クエストの詳細・ストーリー設定</label>
                <textarea rows="3" placeholder="ダンジョンの最奥に潜む魔獣バフォメットJrを討伐するクエスト。..." value={questForm.description || ''} onChange={(e) => setQuestForm({...questForm, description: e.target.value})} style={{ ...inputStyle, resize: 'none' }}></textarea>
              </div>

              <button type="submit" style={{ ...saveBtnStyle, background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}>
                <MapPinned size={14} /> 新たなエリア世界を創世
              </button>
            </form>
          )}
        </div>

        {/* 右側閲覧領域：左側のタブ選択（activeTab）と完全連動して、不要なリストを全自動で閉じる神配線 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* 👥 1. 創造ユニットブラウザ（①ユニット創造タブの時だけ点灯） */}
          {activeTab === 'units' && (
            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px' }}>
              <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '0.85rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}><Swords size={14}/> 👥 創造ユニットブラウザ ({filteredUnits.length} / {units.length}件)</h3>
                <select value={unitSortOrder} onChange={(e) => setUnitSortOrder(e.target.value)} className="filter-select" style={{ borderColor: '#f59e0b44', color: '#f59e0b' }}>
                  <option value="level_desc">📊 レベル高い順</option>
                  <option value="level_asc">📊 レベル低い順</option>
                  <option value="name_asc">🔤 名前順 (50音順)</option>
                </select>
              </div>
              
              <div className="filter-box">
                <input type="text" placeholder="🔍 ユニット名でリアルタイム検索..." value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} className="search-input" />
                <select value={unitFilterType} onChange={(e) => setUnitFilterType(e.target.value)} className="filter-select">
                  <option value="all">🌐 全所属</option>
                  <option value="playable">仲間キャラ</option>
                  <option value="enemy">敵モンスター</option>
                </select>
                <select value={unitFilterJob} onChange={(e) => setUnitFilterJob(e.target.value)} className="filter-select">
                  <option value="all">👤 全職業</option>
                  {existingJobs.filter(x => x !== '全職業').map(j => <option key={j} value={j}>{j}</option>)}
                </select>
                {unitFilterType === 'enemy' && (
                  <>
                    <select value={unitFilterRace} onChange={(e) => setUnitFilterRace(e.target.value)} className="filter-select">
                      <option value="all">🧬 全種族</option>
                      <option value="無形">無形</option><option value="不死">不死</option><option value="動物">動物</option><option value="植物">植物</option><option value="昆虫">昆虫</option><option value="悪魔">悪魔</option><option value="人間">人間</option>
                    </select>
                    <select value={unitFilterElement} onChange={(e) => setUnitFilterElement(e.target.value)} className="filter-select">
                      <option value="all">🔥 全属性</option>
                      <option value="無">無</option><option value="火">火</option><option value="水">水</option><option value="風">風</option><option value="地">地</option>
                    </select>
                    <select value={unitFilterSize} onChange={(e) => setUnitFilterSize(e.target.value)} className="filter-select">
                      <option value="all">📏 全サイズ</option>
                      <option value="小型">小型</option><option value="中型">中型</option><option value="大型">大型</option>
                    </select>
                  </>
                )}
              </div>

              {/* 💡 縦に広く見渡せるよう高さを520pxへ拡張 */}
              <div className="scroll-list" style={{ maxHeight: '520px' }}>
                {filteredUnits.map(u => (
                  <div key={u.id} style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '6px 10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.55rem', color: '#4b5563', display: 'block' }}>ID: {u.id} <span style={{ color: '#ffd700' }}>[Lv.{u.base_level}]</span></span>
                      <strong style={{ fontSize: '0.82rem', color: u.unit_type === 'playable' ? '#fff' : '#ef4444' }}>{u.name}</strong>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '6px' }}>{u.unit_type === 'playable' ? `職業: ${u.job}` : `☠️ ${u.size} | ${u.race} | ${u.element}属性`}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => startEditUnit(u)} style={iconBtnStyle}><Edit2 size={11}/></button>
                      <button onClick={() => handleDelete('game_master_units', u.id)} style={{ ...iconBtnStyle, color: '#ef4444' }}><Trash2 size={11}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🛡️ 2. 登録武具・アイテムブラウザ（②武具アイテム創造タブの時だけ点灯） */}
          {activeTab === 'items' && (
            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={14}/> 🛡️ 登録武具・アイテムリスト ({filteredItems.length} / {items.length}件)</h3>
              <div className="filter-box">
                <input type="text" placeholder="🔍 アイテム名で高速検索..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="search-input" />
                <select value={itemFilterType} onChange={(e) => setItemFilterType(e.target.value)} className="filter-select">
                  <option value="all">📦 全大分類</option>
                  <option value="weapon">武器</option><option value="armor">防具</option><option value="card">カード</option><option value="consumable">消耗品</option>
                </select>
                <select value={itemFilterRarity} onChange={(e) => setItemFilterRarity(e.target.value)} className="filter-select">
                  <option value="all">💎 全レアリティ</option>
                  <option value="common">Common</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option>
                </select>
              </div>

              <div className="scroll-list" style={{ maxHeight: '520px' }}>
                {filteredItems.map(i => (
                  <div key={i.id} style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '6px 10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: i.rarity === 'legendary' ? '#f59e0b' : i.rarity === 'epic' ? '#a78bfa' : '#fff' }}>{i.name} {i.slot_count > 0 ? `[${i.slot_count}]` : ''}</strong>
                      <span style={{ fontSize: '0.65rem', color: i.item_type === 'card' ? '#ffd700' : '#64748b', marginLeft: '6px', display: 'block', marginTop: '1px' }}>
                        {i.item_type === 'card' ? '🃏 ' : ''}{i.item_subtype} {renderCardEffectsLabel(i)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => startEditItem(i)} style={iconBtnStyle}><Edit2 size={11}/></button>
                      <button onClick={() => handleDelete('game_master_items', i.id)} style={{ ...iconBtnStyle, color: '#ef4444' }}><Trash2 size={11}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🔮 3. 登録スキル・特技ブラウザ（③スキル特技創造タブの時だけ点灯） */}
          {activeTab === 'skills' && (
            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '0.85rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={14}/> 🔮 登録スキル・特技リスト ({filteredSkills.length} / {skills.length}件)</h3>
                <select value={skillSortOrder} onChange={(e) => setSkillSortOrder(e.target.value)} className="filter-select" style={{ borderColor: '#a78bfa44', color: '#a78bfa' }}>
                  <option value="name_asc">🔤 名前順 (50音)</option>
                  <option value="sp_desc">💙 消費SP高い順</option>
                  <option value="lv_asc">📈 必要Lv低い順</option>
                </select>
              </div>

              <div className="filter-box" style={{ borderColor: '#a78bfa33' }}>
                <input type="text" placeholder="🔍 スキル・魔法名で検索..." value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} className="search-input" />
                <select value={skillFilterJob} onChange={(e) => setSkillFilterJob(e.target.value)} className="filter-select">
                  <option value="all">👑 全職業制限</option>
                  {existingJobs.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
                <select value={skillFilterType} onChange={(e) => setSkillFilterType(e.target.value)} className="filter-select">
                  <option value="all">⚔️ 全技能分類</option>
                  <option value="magic">魔法別</option>
                  <option value="art">物理攻撃別</option>
                </select>
                <select value={skillFilterEffect} onChange={(e) => setSkillFilterEffect(e.target.value)} className="filter-select">
                  <option value="all">✨ 全追加効果</option>
                  <option value="なし">追加効果なし</option>
                  <option value="スタン">スタン</option><option value="凍結">凍結</option><option value="毒">毒</option>
                  <option value="攻撃バフ">攻撃バフ</option><option value="防御バフ">防御バフ</option>
                </select>
                <select value={skillFilterElement} onChange={(e) => setSkillFilterElement(e.target.value)} className="filter-select">
                  <option value="all">🔥 全属性</option>
                  <option value="無">無属性</option><option value="火">火属性</option><option value="水">水属性</option><option value="風">風属性</option><option value="地">地属性</option><option value="聖">聖属性</option>
                </select>
              </div>

              <div className="scroll-list" style={{ maxHeight: '520px' }}>
                {filteredSkills.map(s => (
                  <div key={s.id} style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '6px 10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.55rem', color: '#64748b', display: 'block' }}>
                        🔑 {s.job_requirement} (必要Lv.{s.level_requirement}) | 🎯 {s.target_type}
                      </span>
                      <strong style={{ fontSize: '0.82rem', color: '#ffd700' }}>{s.name}</strong>
                      <span style={{ fontSize: '0.65rem', color: s.skill_type === 'magic' ? '#38bdf8' : '#f43f5e', marginLeft: '8px' }}>
                        [{s.skill_type === 'magic' ? '魔法' : '物理特技'}] 消費SP:{s.sp_cost} | 効力:{s.effect_value}{s.value_type === 'percent' ? '%' : '固定'}
                      </span>
                      {s.effect_type !== 'なし' && (
                        <span style={{ fontSize: '0.6rem', color: '#a78bfa', display: 'block', marginTop: '1px' }}>
                          ✨ 追加: {s.effect_type} ({s.effect_chance}% / {s.duration_turns}T) | 属性: {s.element}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => startEditSkill(s)} style={iconBtnStyle}><Edit2 size={11}/></button>
                      <button onClick={() => handleDelete('game_master_skills', s.id)} style={{ ...iconBtnStyle, color: '#ef4444' }}><Trash2 size={11}/></button>
                    </div>
                  </div>
                ))}
                {filteredSkills.length === 0 && (
                  <div style={{ fontSize: '0.65rem', color: '#475569', textAlign: 'center', padding: '10px', fontStyle: 'italic' }}>該当するスキル・特技が見つかりません。</div>
                )}
              </div>
            </div>
          )}

          {/* 🔮 🆕 ④ クエスト創造時・および常時：全登録クエストブラウザ（編集・物理削除機能完備）の直撃実装！ */}
          {activeTab === 'quests' && (
            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPinned size={14}/> 🗺️ 登録クエスト・ダンジョンブラウザ ({filteredQuests.length} / {quests.length}件)</h3>
              
              <div className="filter-box" style={{ borderColor: '#a855f733' }}>
                <input type="text" placeholder="🔍 クエスト・エリア名で高速検索..." value={questSearch} onChange={(e) => setQuestSearch(e.target.value)} className="search-input" />
                <select value={questFilterDifficulty} onChange={(e) => setQuestFilterDifficulty(e.target.value)} className="filter-select">
                  <option value="all">💎 全難易度</option>
                  <option value="E">Rank E</option><option value="D">Rank D</option><option value="C">Rank C</option><option value="B">Rank B</option><option value="A">Rank A</option><option value="S">Rank S</option>
                </select>
              </div>

              <div className="scroll-list">
                {filteredQuests.map(q => {
                  const enemyIds = q.enemy_master_id ? String(q.enemy_master_id).split(',') : [];
                  const enemyNames = enemyIds.map(id => {
                    const found = units.find(u => u.id === id);
                    return found ? found.name : id;
                  }).join(' + ');

                  return (
                    <div key={q.id} style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, paddingRight: '8px' }}>
                        <span style={{ fontSize: '0.55rem', color: '#64748b', display: 'block' }}>推奨Lv.{q.level} | ⏳ 全{q.floors}階層</span>
                        <strong style={{ fontSize: '0.85rem', color: '#a855f7' }}>{q.name} <span style={{ fontSize: '0.65rem', background: '#3b0764', color: '#d8b4fe', padding: '1px 5px', borderRadius: '3px', marginLeft: '4px' }}>Rank {q.difficulty}</span></strong>
                        <span style={{ fontSize: '0.68rem', color: '#ffb834', display: 'block', marginTop: '2px', fontWeight: 'bold' }}>👾 出現群: {enemyNames || '未配置'}</span>
                        <span style={{ fontSize: '0.62rem', color: '#34d399', display: 'block' }}>🎁 報酬: {q.exp_reward} EXP / {q.zeny_reward} Zeny</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => startEditQuest(q)} style={iconBtnStyle}><Edit2 size={11}/></button>
                        <button onClick={() => handleDelete('game_master_quests', q.id)} style={{ ...iconBtnStyle, color: '#ef4444' }}><Trash2 size={11}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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