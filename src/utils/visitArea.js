// src/utils/visitArea.js（admin・biz 同じ内容）
// ⚠️ 2026/09/26【CF】1-15 ②：訪問エリアと移動時間（レベル1・地図 API は使わない）
//   profiles（公開用ビュー public_booking_settings にもある）の2列を使う
//     visit_areas            … 訪問エリア（行ける場所）の一覧 [{ prefix: '東京都町田市' }, ...]
//     default_travel_minutes … 標準の移動時間（分）。今は訪問の予約すべてにこれを使う
//   ・登録も照合も zipcloud の表記（address1 + address2 + address3）を使い、前方一致で判定する
//   ・いくつも当てはまるときは、いちばん細かい（長い）エリアを使う
//   ・エリアが空なら「制限なし」（エリア外の判定をしない）
//   ・use_travel_time_logic が false の店舗は、移動時間 0 分

// 都道府県の部分（カルテの住所などで省かれているときに使う）
const PREF_RE = /^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/;

// 表記ゆれを少しそろえる（全角・半角の数字や記号、空白）
export const normalizeAddress = (s) =>
  String(s || '').normalize('NFKC').replace(/\s+/g, '');

// 店舗の訪問エリア（壊れた行は除く）
export const getVisitAreas = (shop) =>
  Array.isArray(shop?.visit_areas)
    ? shop.visit_areas.filter(a => a && normalizeAddress(a.prefix))
    : [];

// 住所に当てはまるエリアを返す（無ければ null）
export const findVisitArea = (address, visitAreas) => {
  const addr = normalizeAddress(address);
  if (!addr) return null;

  let best = null;
  let bestLen = 0;
  for (const area of visitAreas || []) {
    const prefix = normalizeAddress(area?.prefix);
    if (!prefix) continue;
    const noPref = prefix.replace(PREF_RE, '');
    const hit = addr.startsWith(prefix) ||
      (noPref !== '' && noPref !== prefix && addr.startsWith(noPref));
    if (hit && prefix.length > bestLen) {
      best = area;
      bestLen = prefix.length;
    }
  }
  return best;
};

// エリアの制限があり、住所がどのエリアにも当てはまらないとき true
export const isOutsideVisitAreas = (shop, address) => {
  const areas = getVisitAreas(shop);
  if (areas.length === 0) return false;
  return !findVisitArea(address, areas);
};

// 移動時間（分）
// ⚠️ 2026/09/26：エリアごとの分数はやめ、今は「標準の移動時間」だけを使う。
//    前の訪問先 → 次の訪問先の移動は、次に作る「エリア間の移動時間表」で決める。
export const getTravelMinutes = (shop) => {
  if (!shop || shop.use_travel_time_logic === false) return 0;

  // 列が無い古いデータのときは、今までの計算（7km × 1kmあたりの分数）
  const def = shop.default_travel_minutes ?? 7 * (Number(shop.minutes_per_km) || 3);
  return Math.max(0, Math.round(Number(def) || 0));
};