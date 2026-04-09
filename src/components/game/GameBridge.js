import { supabase } from '../../supabaseClient';

/**
 * 🎮 司令塔：ゲームイベントを実行する連絡係 [cite: 2026-03-01]
 * * @param {string} type - イベントの種類（例: 'RESERVATION_SUCCESS'）
 * @param {object} payload - ユーザーIDや店舗名などの情報
 */
export const triggerGameEvent = async (type, payload) => {
  console.log(`🎮 GameBridge: ${type} を受信`, payload);

  if (type === 'RESERVATION_SUCCESS') {
    const { userId, shopName } = payload;
    if (!userId) return;

    // 🥚 予約成功の報酬として「卵」をデータベースに追加 [cite: 2025-12-01, 2026-03-01]
    const { error } = await supabase.from('user_items').insert([
      {
        user_id: userId,
        item_type: 'egg',
        item_name: `${shopName || '秘密'}の卵`,
        status: 'unhatched',
        quantity: 1,
        metadata: { 
          source: 'reservation_reward', 
          rarity: 'common',
          awarded_at: new Date().toISOString()
        }
      }
    ]);

    if (error) {
      console.error("❌ 報酬の卵付与に失敗:", error);
    } else {
      console.log("✅ 報酬の卵がマイページに届きました！");
    }
  }

  // 🃏 将来的にここに「カードゲット」や「経験値加算」などの条件を追加していけます
  // if (type === 'VISIT_COMPLETE') { ... }
};