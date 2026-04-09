// src/constants/industryMaster.js

export const INDUSTRY_PRESETS = {
  visiting: {
    label: "訪問サービス",
    // 🆕 三土手さん案：施設・在宅ニーズを網羅した実戦的なリスト
    subCategories: [
      "理美容", 
      "診療・歯科", 
      "整体・接骨院・鍼灸", 
      "エステ・ネイル・ハンド/フットケア", 
      "マッサージ・リハビリ", 
      "家事代行", 
      "その他"
    ],
    fields: ['name', 'furigana', 'phone', 'address', 'parking', 'building_type', 'care_notes']
  },
  beauty: {
    label: "美容室・理容室",
    subCategories: [], // 今後、必要に応じて「メンズ特化」などで分けることも可能
    fields: ['name', 'furigana', 'phone', 'email', 'request_details']
  },
  nail: {
    label: "ネイル・アイラッシュ",
    subCategories: [],
    fields: ['name', 'furigana', 'phone', 'email', 'request_details']
  },
  esthetic: {
    label: "エステ・リラク",
    subCategories: [],
    fields: ['name', 'furigana', 'phone', 'email', 'symptoms', 'request_details']
  },
  clinic: {
    label: "整体・接骨院・鍼灸",
    subCategories: [],
    fields: ['name', 'furigana', 'phone', 'email', 'symptoms', 'request_details']
  },
  school: {
    label: "教室・スクール・習い事",
    subCategories: [],
    fields: ['name', 'furigana', 'email', 'phone', 'symptoms']
  },
  event: {
    label: "イベント・セミナー",
    subCategories: [],
    fields: ['name', 'email', 'company_name', 'request_details']
  },
  hospitality: {
    label: "飲食店・カフェ",
    subCategories: [],
    fields: ['name', 'phone', 'email', 'request_details']
  },
  test_new: {
    label: "🚀 未知の新業種",
    subCategories: ["新ジャンルA", "新ジャンルB"], // テスト用
    fields: ['name', 'phone', 'notes']
  }
};

// 大カテゴリのラベル配列（Home画面のカテゴリ検索等に使用）
export const INDUSTRY_LABELS = Object.values(INDUSTRY_PRESETS).map(item => item.label);

/**
 * 🆕 大カテゴリ名を受け取り、対応する小カテゴリの配列を返す関数
 * BasicSettings.jsx で二段目のプルダウンを作る時に呼び出します
 */
// 🆕 関数の頭に必ず export がついている必要があります
export const getSubCategories = (mainLabel) => {
  const preset = Object.values(INDUSTRY_PRESETS).find(p => p.label === mainLabel);
  return preset ? preset.subCategories : [];
};