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
  const idx = Math.min(49, Math.max(0, currentLevel - 1));

  Object.keys(jobRules).forEach(stat => {
    bonuses[stat] = jobRules[stat][idx] || 0;
  });

  return bonuses;
};