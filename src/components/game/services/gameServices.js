import { supabase } from '../../../../supabaseClient'; // 既存のクライアントを再利用

export const gameServices = {
  /**
   * 1. ユーザーのキャラクター一覧を取得する
   * @param {string} userId - ユーザーのUUID
   */
  async getCharacters(userId) {
    const { data, error } = await supabase
      .from('game_characters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('キャラ取得エラー:', error);
      throw error;
    }
    return data;
  },

  /**
   * 2. パーティの現在の出撃・探索状態を取得する（リロード対策）
   * @param {string} userId - ユーザーのUUID
   */
  async getPartyStatus(userId) {
    const { data, error } = await supabase
      .from('game_party_status')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(); // データがなくてもエラーにしない
      
    if (error) {
      console.error('出撃状態取得エラー:', error);
      throw error;
    }
    return data;
  },

  /**
   * 3. 探索を開始する（出撃状態をSupabaseに永続化）
   * @param {string} userId - ユーザーのUUID
   * @param {number} questId - クエストのID
   * @param {number} durationSeconds - 探索にかかる秒数
   */
  async startExploration(userId, questId, durationSeconds) {
    const startAt = new Date().toISOString();
    const endAt = new Date(Date.now() + durationSeconds * 1000).toISOString();

    const { data, error } = await supabase
      .from('game_party_status')
      .upsert({
        user_id: userId,
        is_exploring: true,
        current_quest_id: questId,
        explore_start_at: startAt,
        explore_end_at: endAt
      })
      .select()
      .single();

    if (error) {
      console.error('探索開始エラー:', error);
      throw error;
    }
    return data;
  },

  /**
   * 4. 探索を終了・完了する（出撃状態のリセット）
   * @param {string} userId - ユーザーのUUID
   */
  async finishExploration(userId) {
    const { error } = await supabase
      .from('game_party_status')
      .update({
        is_exploring: false,
        current_quest_id: null,
        explore_start_at: null,
        explore_end_at: null
      })
      .eq('user_id', userId);

    if (error) {
      console.error('探索終了エラー:', error);
      throw error;
    }
    return true;
  },

  /**
   * 5. ドロップアイテムをインベントリ（倉庫）に加算する（売却ロジック用）
   * @param {string} userId - ユーザーのUUID
   * @param {string} itemId - マスターアイテムのID（'long_sword'など）
   * @param {number} quantity - 個数
   */
  async addInventoryItem(userId, itemId, quantity = 1) {
    // すでに同じアイテムを持っているか確認
    const { data: existing } = await supabase
      .from('game_inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .maybeSingle();

    if (existing) {
      // すでに持っていれば数量を加算（upsert）
      const { error } = await supabase
        .from('game_inventory')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      // 新規獲得なら行を追加
      const { error } = await supabase
        .from('game_inventory')
        .insert({ user_id: userId, item_id: itemId, quantity: quantity });
      if (error) throw error;
    }
    return true;
  }
};