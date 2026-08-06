import { supabase } from '../../../supabaseClient';

/**
 * 🔮 三土手創世神Edition：戦闘数理 ＆ 成長曲線マスタリーエンジン
 */

// 📊 1. ROラトリオ完全リスペクト＆三土手神拡張：Lv1〜99 必要・累計経験値テーブル
export const RO_NEXT_EXP_TABLE = [
  0,     0,     3,     7,     12,    19,    30,    44,    61,    81, // Lv1 ~ 10
  104,   142,   186,   238,   300,   374,   486,   622,   785,   977, // Lv11 ~ 20
  1201,  1501,  1834,  2201,  2605,  3047,  3679,  4353,  5073,  5484, // Lv21 ~ 30
  6682,  7991,  9373,  10842, 12421, 14124, 17252, 20554, 24080, 27901, // Lv31 ~ 40
  32067, 40508, 49419, 58925, 69239, 80486, 106695, 134335, 163904, 196150, // Lv41 ~ 50 (50は231571から調整)
  231571, 275000, 325000, 385000, 455000, 540000, 640000, 760000, 900000, 1070000, // Lv51 ~ 60
  1270000, 1500000, 1770000, 2090000, 2460000, 2900000, 3420000, 4030000, 4750000, 5600000, // Lv61 ~ 70
  6600000, 7780000, 9170000, 10800000, 12700000, 14900000, 17500000, 20500000, 24000000, 28000000, // Lv71 ~ 80
  32700000, 38200000, 44600000, 52000000, 60600000, 70600000, 82200000, 95800000, 111000000, 128000000, // Lv81 ~ 90
  147000000, 168000000, 191000000, 216000000, 243000000, 272000000, 303000000, 336000000, 371000000, 0 // Lv91 ~ 99 (99はカンストのため0)
];

// 📊 2. 三土手神オリジナル1次職＆2次職・自動成長ジョブボーナス表
export const JOB_BONUS_MAP = {
  // ─── 【1次職（Lv.99まで対応）】 ───
  'フリーランス': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'ファイター': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)),
    agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)),
    int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.0)),
    dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)),
    luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'メイジ': {
    int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)),
    agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.0)),
    dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)),
    luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'クレリック': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)),
    agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)),
    vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)),
    int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)),
    dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2))
  },
  'スカウト': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)),
    agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)),
    vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.0)),
    dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)),
    luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2))
  },
  'ハンター': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)),
    vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)),
    luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'トレーダー': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)),
    agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)),
    int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)),
    luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25))
  },
  'テイマー': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)),
    agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)),
    vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)),
    int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)),
    dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)),
    luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },

  // ─── 【2次職（上位特化クラス）】 ───
  'クラッシャー': { // 圧倒的物理破壊力
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.45)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), int: Array.from({length: 99}, (_, i) => 0), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05))
  },
  'テンプラー': { // 鉄壁の聖騎士
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.45)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), luk: Array.from({length: 99}, (_, i) => 0)
  },
  'アサシンクロス': { // 超回避と連撃・致命
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.4)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05)), int: Array.from({length: 99}, (_, i) => 0), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2))
  },
  'チェイサー': { // 器用な罠と短剣技術
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), luk: Array.from({length: 99}, (_, i) => 0)
  },
  'ビショップ': { // 最高位の回復・支援
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.4)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05))
  },
  'グラップラー': { // 会心の神聖打撃
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'ハイウィザード': { // 極大魔法火力
    str: Array.from({length: 99}, (_, i) => 0), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.45)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'エレミット': { // バフ・結界の賢者
    str: Array.from({length: 99}, (_, i) => 0), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.35)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'レンジャー': { // 必中の超狙撃手
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.4)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'パフォーマー': { // 戦場を支配する旋律
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'ブラックスミス': { // 鋼鉄の鍛冶神
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.35)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'ケミスト': { // 錬金術と劇薬の支配者
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  'ビーストマスター': { // 魔物軍団の指揮官
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.35)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.35)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05))
  },
  'フロントコマンダー': { // 前衛で共に戦う獣王
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05))
  },
  'エクスパート': { // 全能力を底上げした熟練者
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2))
  },
  'サバイバー': { // 絶対に死なない生存の達人
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2))
  },

  // ─── 【魔物クラス（変更なし・Lv.99対応へ拡張）】 ───
  '魔獣族': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  '植物族': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.35)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  '悪魔族': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  },
  '不死族': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.05)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.3)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2))
  },
  '水棲族': {
    str: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), agi: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.15)), vit: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.2)), int: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.25)), dex: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1)), luk: Array.from({length: 99}, (_, i) => Math.floor((i + 1) * 0.1))
  }
};

/**
 * 🔮 ジョブボーナス自動集計計算ロジック
 */
export const calculateJobBonus = (jobName, currentLevel) => {
  const bonuses = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0, mdef: 0 };
  const jobRules = JOB_BONUS_MAP[jobName];
  if (!jobRules) return bonuses;
  if (currentLevel === 1) return bonuses;
  
  // 👑 上限を49から98（Lv.99用）へアンロック！
  const idx = Math.min(98, Math.max(0, currentLevel - 1));
  Object.keys(jobRules).forEach(stat => {
    bonuses[stat] = jobRules[stat][idx] || 0;
  });
  return bonuses;
};

export const calculateTotalStatusPoints = (currentLevel) => {
  // 👑 上限を50から99へアンロック！
  const targetLv = Math.max(1, Math.min(99, currentLevel));
  let totalPoints = 6; 
  for (let lv = 2; lv <= targetLv; lv++) {
    if (lv <= 10)       totalPoints += 3;
    else if (lv <= 20)  totalPoints += 4;
    else if (lv <= 30)  totalPoints += 5;
    else if (lv <= 40)  totalPoints += 6;
    else if (lv <= 50)  totalPoints += 7;
    // 👑 50以降の圧倒的なポイント獲得カーブを追加！
    else if (lv <= 60)  totalPoints += 8;
    else if (lv <= 70)  totalPoints += 9;
    else if (lv <= 80)  totalPoints += 10;
    else if (lv <= 90)  totalPoints += 11;
    else                totalPoints += 13; // 91〜99はフィーバータイム
  }
  return totalPoints;
};

// ==========================================================
// 👑 三土手創世神拡張：サイズ・種族・属性 3大相性数理マトリクス
// ==========================================================

// 📊 属性相性マルチテーブル（攻撃属性 vs 防御属性）
// 1.0 = 100%等倍, 2.0 = 2倍弱点ダメージ, 0.5 = 耐性半減, 0.0 = 無効化
export const ELEMENT_MATRIX = {
  '無': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '毒': 1.0, '聖': 1.0, '闇': 1.0, '念': 1.0, '不死': 1.0 },
  '火': { '無': 1.0, '火': 0.5, '水': 0.5, '地': 2.0, '風': 1.0, '毒': 1.5, '聖': 1.0, '闇': 1.0, '念': 1.0, '不死': 1.5 },
  '水': { '無': 1.0, '火': 2.0, '水': 0.5, '地': 0.5, '風': 0.5, '毒': 1.0, '聖': 1.0, '闇': 1.0, '念': 1.0, '不死': 1.0 },
  '地': { '無': 1.0, '火': 0.5, '水': 1.0, '地': 0.5, '風': 2.0, '毒': 1.0, '聖': 1.0, '闇': 1.0, '念': 1.0, '不死': 1.0 },
  '風': { '無': 1.0, '火': 1.0, '水': 2.0, '地': 0.5, '風': 0.5, '毒': 1.5, '聖': 1.0, '闇': 1.0, '念': 1.0, '不死': 1.0 },
  '毒': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '毒': 0.0, '聖': 0.5, '闇': 0.5, '念': 1.0, '不死': 0.5 }, // 🧪 毒で攻撃時
  '聖': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '毒': 1.5, '聖': 0.0, '闇': 2.0, '念': 1.0, '不死': 2.0 },
  '闇': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '毒': 1.0, '聖': 0.5, '闇': 0.0, '念': 1.5, '不死': 0.0 },
  '念': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '毒': 1.0, '聖': 1.0, '闇': 1.5, '念': 2.0, '不死': 1.0 }, // 👻 念で攻撃時
  '不死': { '無': 1.0, '火': 1.0, '水': 1.0, '地': 1.0, '風': 1.0, '毒': 0.5, '聖': 1.5, '闇': 0.0, '念': 1.0, '不死': 0.0 }
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
  '槍':   { '小型': 0.75, '中型': 1.0,  '大型': 1.0 },
  'スリング': { '小型': 1.0, '中型': 0.75, '大型': 0.5 },
  '鞭':       { '小型': 0.75, '中型': 1.0,  '大型': 0.75 },
  '楽器':     { '小型': 0.75, '中型': 1.0,  '大型': 0.75 }
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
export const calculateStatusInflictChance = (skillChance, attackerCardEff, defenderCardEff, defenderRo, statusType) => {
  const cardInflictPlus = attackerCardEff?.inflict?.[statusType] || 0;
  let finalChance = skillChance + cardInflictPlus;

  const cardResistMinus = defenderCardEff?.resist?.[statusType] || 0;
  finalChance -= cardResistMinus;

  // 🧪 本家ROリスペクト：VIT（肉体スタミナ）とINT（精神集中）による確率カット
  if (statusType === 'スタン' || statusType === '凍結' || statusType === '毒') {
    finalChance -= (defenderRo.vit || 0); 
  } else if (statusType === '暗闇') {
    finalChance -= (defenderRo.int || 0); 
  }

  return Math.max(0, Math.min(100, finalChance));
};

/**
 * ☠️ 2. 状態異常デバフ・戦闘力ダイレクト干渉エンジン
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

// ==========================================================
// 👑 三土手創世神特注：魔法属性コンバートインフラ
// ==========================================================
/**
 * 🔮 装備しているカードから「魔法属性付与」を検知し、魔法スキルの属性を上書き換装します。
 * @param {object} member - プレイヤー（またはエネミー）の戦闘インスタンスデータ
 * @param {object} playableSkill - 発動しようとしている魔法スキルのマスターデータ
 * @returns {string} 最終的に適用される魔法の属性（'火', '水', '地', '風' など）
 */
export const enchantMagicElement = (member, playableSkill) => {
  let activeMagicElement = playableSkill.element || '無';

  if (member && member.equips && typeof member.equips === 'object') {
    Object.values(member.equips).forEach(slot => {
      if (slot && Array.isArray(slot.cards)) {
        slot.cards.forEach(card => {
          // カードの効果枠①、②、③のいずれかに 'enchant_magic' が設定されているか走査
          if (card.card_effect_type === 'enchant_magic' && card.card_effect_target) {
            activeMagicElement = card.card_effect_target;
          }
          if (card.card_effect_type_2 === 'enchant_magic' && card.card_effect_target_2) {
            activeMagicElement = card.card_effect_target_2;
          }
          if (card.card_effect_type_3 === 'enchant_magic' && card.card_effect_target_3) {
            activeMagicElement = card.card_effect_target_3;
          }
        });
      }
    });
  }

  return activeMagicElement;
};

// ==========================================================
// 👑 三土手創世神特注：魔法攻撃力 (Matk) 算出エンジン
// ==========================================================
/**
 * 🔮 最小魔力・最大魔力 算出ロジック
 * キャラクターの純粋な「INT」と「DEX」を基に、TRPGライクな魔力のダイス幅を弾き出します。
 */
export const calculateMatk = (intVal, dexValue) => {
  const myInt = Number(intVal) || 0;
  const myDex = Number(dexValue) || 0;

  const minMatk = Math.floor(myInt + (myDex * 0.2));
  const maxMatk = Math.floor(myInt * 2.0 + myDex);

  return { minMatk, maxMatk };
};