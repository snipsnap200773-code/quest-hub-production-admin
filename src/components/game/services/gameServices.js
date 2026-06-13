import { supabase } from '../supabaseClient';

/**
 * 👑 ラグナロクオンライン式・戦闘ステータス完全計算エンジン
 * 基本ステータス（STR〜LUK）、装備、レベル、職業補正から
 * 本家準拠の戦闘パラメータ（Atk, Def, Hit, Flee, Aspd, Critical, Matk, Mdef）を算出します。
 */
export const calculateRoStatus = (charData, equips = {}) => {
  const baseLv = charData.level || 1;
  const job = charData.meta?.job || 'ノービス';

  const str = (charData.meta?.stat_str || 1) + (charData.bonus?.str || 0);
  const agi = (charData.meta?.stat_agi || 1) + (charData.bonus?.agi || 0);
  const vit = (charData.meta?.stat_vit || 1) + (charData.bonus?.vit || 0);
  const int = (charData.meta?.stat_int || 1) + (charData.bonus?.int || 0);
  const dex = (charData.meta?.stat_dex || 1) + (charData.bonus?.dex || 0);
  const luk = (charData.meta?.stat_luk || 1) + (charData.bonus?.luk || 0);

  // 🆕 9部位のスペックを集計
  const weaponAtk = equips.right_hand?.atk || 0;
  const shieldDef = equips.left_hand?.def || 0;
  const headDef = equips.head?.def || 0;
  const faceDef = equips.face?.def || 0;
  const bodyDef = equips.body?.def || 0;
  const gloveDef = equips.glove?.def || 0;
  const garmentDef = equips.garment?.def || 0;
  const shoesDef = equips.shoes?.def || 0;
  const accessoryAtk = equips.accessory?.atk || 0;
  
  const totalEquipDef = shieldDef + headDef + faceDef + bodyDef + gloveDef + garmentDef + shoesDef;
  const totalEquipMdef = (equips.body?.mdef || 0) + (equips.head?.mdef || 0) + (equips.face?.mdef || 0);

  const atk = str + weaponAtk + Math.pow(Math.floor(str / 10), 2) + accessoryAtk;
  const def = Math.floor(vit * 0.5) + totalEquipDef;
  const hit = baseLv + dex;
  const flee = baseLv + agi;
  const critical = Math.floor(luk * 0.3) + 1;
  const matk = int + Math.pow(Math.floor(int / 7), 2);
  const mdef = Math.floor(int * 0.5) + totalEquipMdef;

  let baseAspd = 150;
  if (job === 'シーフ') baseAspd = 160;
  if (job === 'ソードマン') baseAspd = 152;
  const aspd = Math.min(190, baseAspd + agi * 0.5);

  return { atk, def, hit, flee, critical, matk, mdef, aspd, guild_name: charData.guild_name || '無所属' };
};


export const gameServices = {
  /**
   * 1. 👥 プレイヤーが所持している全キャラクター（7部位装備データ紐づけ版）をロード
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
            skill_01, skill_02, skill_03, description
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;

      // 🎒 アイテムマスターデータを全取得して、装備のテキストIDとメモリ上でカチッとガッちゃんこ結合します
      const { data: allItems } = await supabase.from('game_master_items').select('*');
      const itemMap = allItems ? Object.fromEntries(allItems.map(i => [i.id, i])) : {};

      return data.map(ch => {
        const master = ch.game_master_units;
        
        // 各部位の装備オブジェクトを特定
        const equips = {
          right_hand: itemMap[ch.equip_right_hand] || null,
          left_hand: itemMap[ch.equip_left_hand] || null,
          head: itemMap[ch.equip_head] || null,
          face: itemMap[ch.equip_face] || null,
          body: itemMap[ch.equip_body] || null,
          glove: itemMap[ch.equip_glove] || null,
          garment: itemMap[ch.equip_garment] || null,
          shoes: itemMap[ch.equip_shoes] || null,
          accessory: itemMap[ch.equip_accessory] || null,
        };

        // 基準キャラクター状態の組み立て
        const charObject = {
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
          guild_name: ch.guild_name,
          
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
            dex: ch.bonus_dex,
            luk: ch.bonus_luk
          },
          equips: equips, // 7部位の装備生データ
          meta: master
        };

        // 🧠 心臓部の計算エンジンを通し、戦闘ステータス（roStatus）を自動ドッキング！
        charObject.roStatus = calculateRoStatus(charObject, equips);

        return charObject;
      });
    } catch (err) {
      console.error('📋 キャラクター取得失敗:', err);
      return [];
    }
  },

  /**
   * 2. 💾 三土手さんのステ振り極振りをSupabaseに永続保存
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
   * 3. 🛡️ 🆕 装備アイテムのパチッと着脱の永続保存コミット
   */
  async saveEquipmentChange(userId, characterId, slotKey, newItemIdOrNull) {
    try {
      console.log("=== ⚔️ 9部位ストック連動換装テスト開始 ===");
      console.log("【入力データ】:", { userId, characterId, slotKey, newItemIdOrNull });

      // 💡 カラム名の2重重複（equip_equip_xxx）を100%シャットアウトする鉄壁の補正
      const finalColumnName = slotKey.startsWith('equip_') ? slotKey : `equip_${slotKey}`;
      console.log(`【狙い撃ちするDBカラム名】: ${finalColumnName}`);

      // 1. 現在のこのキャラの該当スロットの装備（古い装備）を調べる
      const { data: char, error: charSelectErr } = await supabase
        .from('game_characters')
        .select('*')
        .eq('id', characterId)
        .single();
      
      if (charSelectErr) throw charSelectErr;
      
      // 現在カラムに刺さっている古いアイテムのID（例: 'quad_slot_main' または null）
      const oldItemIdOrNull = char[finalColumnName] || null;
      // フロントから流れてきた値をnull基準に100%正規化（undefinedを徹底排除）
      const normalizedNewItemId = newItemIdOrNull === undefined ? null : newItemIdOrNull;

      console.log(`【クエリ前チェック】: 現在の装備 = [${oldItemIdOrNull}] / 変更後の装備 = [${normalizedNewItemId}]`);

      // 完全に同じ武具への着替え、または未装備(null)から未装備(null)への換装であれば早期終了
      if (oldItemIdOrNull === normalizedNewItemId) {
        console.log("ℹ️ 着けようとしている武具状態が現在と完全に一致するため、処理をスキップします。");
        return { success: true };
      }

      // 2. 新しい装備を「着ける」場合 ➔ 共有倉庫の在庫を1個減らす（💡エラーで止まらないよう安全に配強化）
      if (newItemIdOrNull) {
        console.log(`🎒 共有倉庫からアイテム [${newItemIdOrNull}] の在庫を 1 減らします...`);
        
        // ユーザーIDの不一致に備え、item_id の一致を最優先で検索
        const { data: inv } = await supabase
          .from('game_inventory')
          .select('*')
          .eq('item_id', newItemIdOrNull)
          .maybeSingle();

        if (inv && inv.count > 0) {
          await supabase.from('game_inventory').update({ count: inv.count - 1 }).eq('id', inv.id);
          console.log(`➔ 倉庫の在庫を更新しました (残り: ${inv.count - 1}個)`);
        } else {
          console.log("⚠️ 倉庫に在庫が確認できませんでしたが、開発検証のため装備処理を続行します。");
        }
      }

      // 3. 古い装備を「外す」場合 ➔ 共有倉庫の在庫を1個戻す
      if (oldItemIdOrNull) {
        console.log(`📦 倉庫へ古いアイテム [${oldItemIdOrNull}] の在庫を 1 戻します...`);
        const { data: inv } = await supabase
          .from('game_inventory')
          .select('*')
          .eq('item_id', oldItemIdOrNull)
          .maybeSingle();
        
        if (inv) {
          await supabase.from('game_inventory').update({ count: inv.count + 1 }).eq('id', inv.id);
          console.log(`➔ 倉庫のストックを1つ戻しました (現在: ${inv.count + 1}個)`);
        } else {
          // もし倉庫からレコード自体が消えていたら新しく1個で作り直す
          await supabase.from('game_inventory').insert({ user_id: userId, item_id: oldItemIdOrNull, count: 1 });
          console.log(`➔ 倉庫にアイテムスロットを新規復元しました (1個)`);
        }
      }

      // 4. キャラクターの装備カラムを本番更新
      console.log(`⚡ Supabaseの game_characters に対して直撃更新を実行中...`);
      
      const updateData = {};
      updateData[finalColumnName] = newItemIdOrNull;

      const { data, error: updateErr } = await supabase
        .from('game_characters')
        .update(updateData)
        .eq('id', characterId)
        .select();

      if (updateErr) throw updateErr;

      console.log("🎯 【大成功】装備換装＆倉庫ストックの連動が完了しました！:", data);
      console.log("=== ⚔️ 9部位ストック連動換装テスト終了 ===");
      return { success: true, data };
      
    } catch (err) {
      console.error('🚨 【装備連動換装エラー】:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * 4. 🎒 倉庫インベントリ取得（新設されたROスペック項目も自動ジョイン）
   */
  async getPlayerInventory(userId) {
    try {
      const { data, error } = await supabase
        .from('game_inventory')
        .select(`
          *,
          game_master_items!game_inventory_item_id_fkey (
            name, item_type, item_subtype, weapon_range, slot_count, rarity, description,
            atk, def, mdef, weapon_level, equip_level_req, job_restriction, weight, penalty_str
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
   * 🎒 ⚙️ 物流1: ギルド共有倉庫から、キャラクターの個人バッグへアイテムを「持たせる」
   */
  async transferWarehouseToBag(userId, characterId, itemMasterId, amount = 1) {
    try {
      const { data: inv, error: invErr } = await supabase
        .from('game_inventory')
        .select('*').eq('user_id', userId).eq('item_id', itemMasterId).single();
      if (invErr || inv.count < amount) throw new Error('倉庫の在庫が足りません');

      await supabase.from('game_inventory').update({ count: inv.count - amount }).eq('id', inv.id);

      const { data: char, error: charErr } = await supabase
        .from('game_characters').select('bag_items').eq('id', characterId).single();
      if (charErr) throw charErr;

      let bag = char.bag_items || [];
      const existing = bag.find(i => i.item_id === itemMasterId);
      if (existing) {
        existing.count += amount;
      } else {
        bag.push({ item_id: itemMasterId, count: amount });
      }

      await supabase.from('game_characters').update({ bag_items: bag }).eq('id', characterId);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  },

  /**
   * 📦 ⚙️ 物流2: キャラクターの個人バッグから、ギルド共有倉庫へアイテムを「預ける」
   */
  async transferBagToWarehouse(userId, characterId, itemMasterId, amount = 1) {
    try {
      const { data: char, error: charErr } = await supabase
        .from('game_characters').select('bag_items').eq('id', characterId).single();
      if (charErr) throw charErr;

      let bag = char.bag_items || [];
      const itemIdx = bag.findIndex(i => i.item_id === itemMasterId);
      if (itemIdx === -1 || bag[itemIdx].count < amount) throw new Error('手荷物に指定の道具がありません');

      bag[itemIdx].count -= amount;
      if (bag[itemIdx].count === 0) bag.splice(itemIdx, 1);

      await supabase.from('game_characters').update({ bag_items: bag }).eq('id', characterId);

      const { data: inv, error: invErr } = await supabase
        .from('game_inventory').select('*').eq('user_id', userId).eq('item_id', itemMasterId).maybeSingle();

      if (inv) {
        await supabase.from('game_inventory').update({ count: inv.count + amount }).eq('id', inv.id);
      } else {
        await supabase.from('game_inventory').insert({ user_id: userId, item_id: itemMasterId, count: amount });
      }

      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  },

  /**
   * 🛠️ 👑 GM特権デバッグ: 指定のアイテムを倉庫に強制支給する
   */
  async debugGiveItemToWarehouse(userId, itemMasterId, amount = 10) {
    try {
      const { data, error: selectErr } = await supabase
        .from('game_inventory')
        .select('*')
        .eq('user_id', userId)
        .eq('item_id', itemMasterId)
        .maybeSingle();

      if (selectErr) throw selectErr;

      if (data) {
        // すでに倉庫にそのアイテムがあるなら足し算更新
        const { error: updateErr } = await supabase
          .from('game_inventory')
          .update({ count: data.count + amount })
          .eq('id', data.id);
        if (updateErr) throw updateErr;
      } else {
        // 倉庫にまだ無いなら新規作成
        const { error: insertErr } = await supabase
          .from('game_inventory')
          .insert({ 
            user_id: userId, 
            item_id: itemMasterId, 
            count: amount 
            // 💡 もしテーブルの id が自動生成になっていない環境の場合は、以下を有効にします
            // id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
          });
        if (insertErr) throw insertErr;
      }
      return { success: true };
    } catch (err) {
      console.error('🚨 【GM特権支給エラー詳細】:', err);
      return { success: false, error: err.message || err };
    }
  },

  /**
   * 5. ⌛ 出撃状態管理
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