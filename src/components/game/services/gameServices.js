import { supabase } from '../supabaseClient';

export const gameServices = {
  /**
   * 1. プレイヤーが所持している全キャラクター（実データ）をロード
   */
  async getPlayerCharacters(userId) {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .select(`
          *,
          game_master_units (
            name, unit_type, race, job,
            base_hp, base_sp,
            stat_str, stat_agi, stat_vit, stat_int, stat_dex, stat_luk,
            equip_right_hand, equip_left_hand, equip_head, equip_body, equip_arm, equip_foot, equip_accessory,
            skill_01, skill_02, skill_03, description
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;

      return data.map(ch => {
        const master = ch.game_master_units;
        return {
          id: ch.id,
          master_id: ch.master_id,
          custom_name: ch.custom_name || master.name,
          level: ch.level,
          exp: ch.exp,
          status_points: ch.status_points,
          current_hp: ch.current_hp,
          max_hp: ch.max_hp,
          current_sp: ch.current_sp,
          max_sp: ch.max_sp,
          
          str: master.stat_str + ch.bonus_str,
          agi: master.stat_agi + ch.bonus_agi,
          vit: master.stat_vit + ch.bonus_vit,
          int: master.stat_int + ch.bonus_int,
          dex: master.stat_dex + ch.bonus_dex,
          luk: master.stat_luk + ch.bonus_luk,

          bonus: {
            str: ch.bonus_str,
            agi: ch.bonus_agi,
            vit: ch.bonus_vit,
            int: ch.bonus_int,
            box_dex: ch.bonus_dex, 
            dex: ch.bonus_dex,
            luk: ch.bonus_luk
          },
          meta: master
        };
      });
    } catch (err) {
      console.error('📋 キャラクター取得失敗:', err);
      return [];
    }
  },

  /**
   * 2. 三土手さんのステ振り極振りをSupabaseに永続保存
   */
  async saveStatusAllocation(characterId, allocatedBonuses, remainingPoints) {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .update({
          bonus_str: allocatedBonuses.str,
          bonus_agi: allocatedBonuses.agi,
          bonus_vit: allocatedBonuses.vit,
          bonus_int: allocatedBonuses.int,
          bonus_dex: allocatedBonuses.dex,
          bonus_luk: allocatedBonuses.luk,
          status_points: remainingPoints
        })
        .eq('id', characterId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('💾 ステ振り保存失敗:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * 3. 倉庫インベントリ取得
   */
  async getPlayerInventory(userId) {
    try {
      const { data, error } = await supabase
        .from('game_inventory')
        .select(`
          *,
          game_master_items!game_inventory_item_id_fkey (
            name, item_type, item_subtype, weapon_range, slot_count, rarity, description
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('📦 インベントリ取得失敗:', err);
      return [];
    }
  },

  /**
   * 4. 出撃状態管理
   */
  async getPartyStatus(userId) {
    try {
      const { data, error } = await supabase
        .from('game_party_status')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('⌛ 出撃状態取得失敗:', err);
      return null;
    }
  },

  async updatePartyStatus(userId, isExploring, questId = null, durationMinutes = 0) {
    try {
      const startTime = isExploring ? new Date().toISOString() : null;
      const endTime = isExploring ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString() : null;

      const { data, error } = await supabase
        .from('game_party_status')
        .upsert({
          user_id: userId,
          is_exploring: isExploring,
          current_quest_id: questId,
          explore_start_at: startTime,
          explore_end_at: endTime
        });

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.error('⌛ 出撃状態更新失敗:', err);
      return { success: false, error: err.message };
    }
  }
};