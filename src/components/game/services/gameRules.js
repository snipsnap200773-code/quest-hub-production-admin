import { supabase } from '../supabaseClient';

/**
 * 🔮 三土手創世神Edition：戦闘数理 ＆ 成長曲線マスタリーエンジン
 */

// 📊 1. ROラトリオ完全リスペクト：Lv1〜50 必要・累計経験値テーブル
export const RO_NEXT_EXP_TABLE = [
  0,     0,     3,     7,     12,    19,    30,    44,    61,    81, // Lv1 ~ 10
  104,   142,   186,   238,   300,   374,   486,   622,   785,   977, // Lv11 ~ 20
  1201,  1501,  1834,  2201,  2605,  3047,  3679,  4353,  5073,  5484, // Lv21 ~ 30
  6682,  7991,  9373,  10842, 12421, 14124, 17252, 20554, 24080, 27901, // Lv31 ~ 40
  32067, 40508, 49419, 58925, 69239, 80486, 106695, 134335, 163904, 196150, // Lv41 ~ 49
  231571 // Lv50
];

// 📊 2. 三土手神オリジナル8職・自動成長ジョブボーナス表
// レベルに応じて比例して自動加算される仕組みを美しく関数化して格納
export const JOB_BONUS_MAP = {
  'ノービス': {
    str: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    agi: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    vit: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    int: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    dex: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    luk: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'ファイター': {
    str: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.3)),
    agi: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    vit: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.3)),
    int: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.0)),
    dex: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.15)),
    luk: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'メイジ': {
    int: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.3)),
    agi: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    vit: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    str: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.0)),
    dex: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.2)),
    luk: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'クレリック': {
    str: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.15)),
    agi: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.15)),
    vit: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.2)),
    int: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.2)),
    dex: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    luk: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.2))
  },
  'スカウト': {
    str: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.15)),
    agi: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.3)),
    vit: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    int: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.0)),
    dex: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.15)),
    luk: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.2))
  },
  'ハンター': {
    str: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    agi: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.2)),
    vit: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    int: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    dex: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.3)),
    luk: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'トレーダー': {
    str: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.25)),
    agi: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    vit: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.2)),
    int: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    dex: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.15)),
    luk: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.25))
  },
  'テイマー': {
    str: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1)),
    agi: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.15)),
    vit: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.25)),
    int: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.25)),
    dex: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.2)),
    luk: Array.from({length: 50}, (_, i) => Math.floor((i + 1) * 0.1))
  }
};

/**
 * 🔮 ジョブボーナス自動集計計算ロジック
 */
export const calculateJobBonus = (jobName, currentLevel) => {
  const bonuses = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0, mdef: 0 };
  const jobRules = JOB_BONUS_MAP[jobName];
  
  if (!jobRules) return bonuses;

  // インデックス用に調整（Lv1なら配列の0番目、Lv50なら49番目のデータを取得）
  if (currentLevel === 1) {
    return { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0, mdef: 0 };
  }
  const idx = Math.min(49, Math.max(0, currentLevel - 1));

  Object.keys(jobRules).forEach(stat => {
    bonuses[stat] = jobRules[stat][idx] || 0;
  });

  return bonuses;
};

// ==========================================================
// 👑 三土手創世神拡張：レベル別・累計獲得フリーポイント数理エンジン
// ==========================================================
/**
 * 🔮 レベル別・累計獲得フリーポイント算出ロジック
 * キャラクターの現在の「Baseレベル」を渡すと、レベル1の初期値(6)から
 * 現在のレベルまでに獲得しているべき【総フリーポイント数】をガチッと弾き出します。
 */
export const calculateTotalStatusPoints = (currentLevel) => {
  const targetLv = Math.max(1, Math.min(50, currentLevel));
  
  // レベル1の生まれたては、三土手さん指定の「6ポイント」でフラットスタート！
  let totalPoints = 6; 

  // レベル2から現在のレベルまで、1レベルずつもらえるポイントをシミュレート漸増加算
  for (let lv = 2; lv <= targetLv; lv++) {
    if (lv <= 10)       totalPoints += 3; // Lv2~10 は毎レベル +3
    else if (lv <= 20)  totalPoints += 4; // Lv11~20 は毎レベル +4
    else if (lv <= 30)  totalPoints += 5; // Lv21~30 は毎レベル +5
    else if (lv <= 40)  totalPoints += 6; // Lv31~40 は毎レベル +6
    else                totalPoints += 7; // Lv41~50 は毎レベル +7
  }

  return totalPoints;
};

// ==========================================================
// 👑 三土手創世神拡張：サイズ・種族・属性 3大相性数理マトリクス
// ==========================================================

// 📊 属性相性マルチテーブル（攻撃属性 vs 防御属性）
// 1.0 = 100%等倍, 2.0 = 2倍弱点ダメージ, 0.5 = 耐性半減, 0.0 = 無効化
export const ELEMENT_MATRIX = {
  '無': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '聖': 1.0, '闇': 1.0, '不死': 1.0 },
  '火': { '無': 1.0, '火': 0.5, '水': 0.5, '地': 2.0, '風': 1.0, '聖': 1.0, '闇': 1.0, '不死': 1.5 },
  '水': { '無': 1.0, '火': 2.0, '水': 0.5, '地': 0.5, '風': 1.0, '聖': 1.0, '闇': 1.0, '不死': 1.0 },
  '地': { '無': 1.0, '火': 1.0, '水': 2.0, '地': 0.5, '風': 0.5, '聖': 1.0, '闇': 1.0, '不死': 1.0 },
  '風': { '無': 1.0, '火': 1.0, '水': 0.5, '地': 1.0, '風': 0.5, '聖': 1.0, '闇': 1.0, '不死': 1.0 },
  '聖': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '聖': 0.0, '闇': 2.0, '不死': 2.0 },
  '闇': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '聖': 0.5, '闇': 0.0, '不死': 0.0 },
  '不死': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '聖': 1.5, '闇': 0.0, '不死': 0.0 }
};

// 📊 武器種別 vs モンスターサイズ補正テーブル
// 「短剣は大型にペナルティ(50%)」「斧は大型に100%」などの武器特性を完全シミュレート
export const WEAPON_SIZE_MODIFIERS = {
  '短剣': { '小型': 1.0, '中型': 0.75, '大型': 0.5 },
  '剣':   { '小型': 0.75, '中型': 1.0,  '大型': 1.0 },
  '杖':   { '小型': 1.0, '中型': 1.0,  '大型': 1.0 },
  '鈍器': { '小型': 0.75, '中型': 1.0,  '大型': 1.0 },
  '斧':   { '小型': 0.5, '中型': 0.75, '大型': 1.0 },
  '弓':   { '小型': 1.0, '中型': 1.0,  '大型': 0.75 },
  '槍':   { '小型': 0.75, '中型': 1.0,  '大型': 1.0 }
};

/**
 * 🔮 3大相性・特効マルチ乗算倍率 総合算出カウンター
 * 攻撃側のスペック（スキル属性、武器種、カード特効累積オブジェクト）と
 * 防御側モンスターの生データ（属性、種族、サイズ）をリアルタイムにぶつけて、戦闘最終倍率を弾き出します。
 * 
 * @param {object} attackSpecs - { element, weapon_subtype, is_physical, card_size_eff, card_race_eff, card_elem_eff }
 * @param {object} defenderSpecs - { element, race, size }
 */
export const calculateDamageModifier = (attackSpecs, defenderSpecs) => {
  let modifier = 1.0;

  // ① 📏 【武器種 vs サイズ】の物理ペナルティ計算（物理攻撃時のみ）
  if (attackSpecs.is_physical && attackSpecs.weapon_subtype) {
    const targetSize = defenderSpecs.size || '中型';
    const sizeModifier = WEAPON_SIZE_MODIFIERS[attackSpecs.weapon_subtype]?.[targetSize] || 1.0;
    modifier *= sizeModifier;
  }

  // ② 🔥 【攻撃属性 vs 防御属性】の相性乗算
  const atkElem = attackSpecs.element || '無';
  const defElem = defenderSpecs.element || '無';
  const elementModifier = ELEMENT_MATRIX[atkElem]?.[defElem] || 1.0;
  modifier *= elementModifier;

  // ③ 🃏 【カード累積バッジ：サイズ特効（小型・中型・大型）】の加算バインド
  if (attackSpecs.card_size_eff && attackSpecs.card_size_eff[defenderSpecs.size]) {
    modifier *= (1.0 + (Number(attackSpecs.card_size_eff[defenderSpecs.size]) / 100));
  }

  // ④ 🃏 【カード累積バッジ：種族特効（悪魔・人間など）】の加算バインド
  if (attackSpecs.card_race_eff && attackSpecs.card_race_eff[defenderSpecs.race]) {
    modifier *= (1.0 + (Number(attackSpecs.card_race_eff[defenderSpecs.race]) / 100));
  }

  // ⑤ 🃏 【カード累積バッジ：属性特効（闇・火など）】の加算バインド
  if (attackSpecs.card_elem_eff && attackSpecs.card_elem_eff[defenderSpecs.element]) {
    modifier *= (1.0 + (Number(attackSpecs.card_elem_eff[defenderSpecs.element]) / 100));
  }

  return modifier;
};

// ==========================================================
// 👑 三土手創世神専用：状態異常・付与確率 ＆ パラメータ干渉数理
// ==========================================================

/**
 * 🎲 1. 状態異常の最終付与確率 ガチャカウンター
 */
export const applyStatusConditionDebuffs = (baseRoStatus, activeStatusType) => {
  const ro = { ...baseRoStatus };
  if (!activeStatusType || activeStatusType === 'なし' || activeStatusType === 'none') return ro;

  switch (activeStatusType) {
    case 'スタン':
      ro.def = 0;   // 🛡️ 防御力完全喪失
      ro.flee = 0;  // 💨 回避不可
      ro.is_unable_to_move = true; 
      break;

    case '凍結':
      ro.def = 0;   // 🛡️ 防御力完全喪失
      ro.flee = 0;  // 💨 回避不可
      ro.element = '水'; // 🌍 強制水属性化！
      ro.is_unable_to_move = true;
      break;

    case '毒':
      ro.def = Math.floor(ro.def * 0.75); // 🛡️ DEF25%低下
      ro.is_poisoned = true; 
      break;

    case '暗闇':
      ro.hit = Math.floor(ro.hit * 0.5);   // 🎯 敵の命中率半減
      ro.flee = Math.floor(ro.flee * 0.5); // 💨 敵の回避率半減
      break;

    case '睡眠':
      ro.flee = 0;  // 💨 無防備のため回避不可
      ro.is_unable_to_move = true; // 💤 完全行動不能
      // ※被ダメージ1.5倍などの処理は、戦闘計算のダメージ最終値に掛け算する形でAdventureActive側で直撃させられます！
      break;

    case '沈黙':
      ro.is_silenced = true; // 🤐 魔法・スキル完全詠唱封印
      break;

    case '呪い':
      ro.str = Math.floor(ro.str * 0.5);  // 💀 攻撃力（STR）を強制的に半分へ弱体化！
      ro.luk = 0;                         // 🍀 運がゼロになりクリティカル不発化
      break;

    case '石化':
      ro.def = 0;   // 🗿 時間が経ち完全に固まると防御ゼロ（カカシ化）
      ro.flee = 0;  // 💨 当然回避不可
      ro.is_unable_to_move = true;
      break;

    default:
      break;
  }

  return ro;
};