import { supabase } from '../supabaseClient';
// 🔮 🆕 独立数理室からジョブボーナス算出ロジックを電線結合！
import { calculateJobBonus } from '../gameRules';

/**
 * 👑 ラグナロクオンライン式・戦闘ステータス完全計算エンジン
 * 基本ステータス（STR〜LUK）、装備、レベル、職業補正から
 * 本家準拠の戦闘パラメータ（Atk, Def, Hit, Flee, Aspd, Critical, Matk, Mdef）を算出します。
 */
export const calculateRoStatus = (charData, equips = {}) => {
  const baseLv = charData.level || 1;
  
  // 🔮 🆕 meta.job、直下の job、または custom_name から大文字小文字を無視して執念の抽出！
  let rawJob = charData.meta?.job || charData.job || charData.custom_name || 'ノービス';
  const checkJob = String(rawJob).trim().toLowerCase();

  // 【1】ファイター系（前衛・重装戦士）
  if (['ファイター', 'クラッシャー', 'ジェネラルナイト', 'テンプラー', 'インクイジター', 'ソードマン', 'fighter', 'swordsman'].includes(checkJob) || checkJob.includes('fighter') || checkJob.includes('swordsman')) {
    rawJob = 'ファイター';
  }
  // 【2】メイジ系（魔法・学術）
  else if (['メイジ', 'ハイウィザード', 'エレメンタルマスター', 'エレミット', 'アルカナロード', 'マジシャン', 'mage', 'magician', 'wizard'].includes(checkJob) || checkJob.includes('mage') || checkJob.includes('wizard')) {
    rawJob = 'メイジ';
  }
  // 【3】クレリック系（信仰・拳法）
  else if (['クレリック', 'ビショップ', 'ホーリーサヴァント', 'グラップラー', 'ヴァジュラ', 'アコライト', 'プリースト', 'cleric', 'priest', 'acolyte'].includes(checkJob) || checkJob.includes('cleric') || checkJob.includes('priest')) {
    rawJob = 'クレリック';
  }
  // 【4】スカウト系（隠密・強襲）
  else if (['スカウト', 'アサシンクロス', 'シャドウレイダー', 'チェイサー', 'ファントムシーフ', 'シーフ', 'thief', 'scout'].includes(checkJob) || checkJob.includes('thief') || checkJob.includes('scout')) {
    rawJob = 'スカウト';
  }
  // 【5】ハンター系（遠隔・芸術）
  else if (['ハンター', 'レンジャー', 'シャープシューター', 'パフォーマー', 'マエストロ', 'ミューズ', 'hunter', 'ranger'].includes(checkJob) || checkJob.includes('hunter') || checkJob.includes('ranger')) {
    rawJob = 'ハンター';
  }
  // 【6】トレーダー系（鍛冶・錬金）
  else if (['トレーダー', 'ブラックスミス', 'マイスター', 'ケミスト', 'ホムンクルスクリエイター', '商人', 'trader', 'blacksmith'].includes(checkJob) || checkJob.includes('trader') || checkJob.includes('blacksmith')) {
    rawJob = 'トレーダー';
  }
  // 【7】テイマー系（魔物調教・三土手神新規）
  else if (['テイマー', 'ビーストマスター', 'アニマロード', '魔物使い', 'tamer'].includes(checkJob) || checkJob.includes('tamer')) {
    rawJob = 'テイマー';
  }
  // 【8】ノービス（またはエクスパート、グランドマスターなど万能ルート）
  else if (['ノービス', 'エクスパート', 'グランドマスター', 'novice'].includes(checkJob) || checkJob.includes('novice')) {
    rawJob = 'ノービス';
  } else {
    rawJob = 'ノービス';
  }

  const job = rawJob;

  // 🔮 全9部位の装備から、刺さっているすべてのカードオブジェクトをフラットな配列として1つに集約
  const allAttachedCards = Object.values(equips)
    .filter(eq => eq && Array.isArray(eq.cards))
    .flatMap(eq => eq.cards);

  // 🔮 カードによるステータス上昇値を格納するバッファを初期化
  const cardStats = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0, hp: 0, sp: 0, critical: 0, flee: 0, hit: 0, mdef: 0 };

  // カードの効果をプランAの規格に従ってポチポチ集計
  allAttachedCards.forEach(card => {
    // 効果枠 ① の判定
    if (card.card_effect_type === 'add_stat' && card.card_effect_target) {
      const target = card.card_effect_target.trim().toLowerCase();
      const val = Number(card.card_effect_value) || 0;
      if (target === 'str') cardStats.str += val;
      else if (target === 'agi') cardStats.agi += val;
      else if (target === 'vit') cardStats.vit += val;
      else if (target === 'int') cardStats.int += val;
      else if (target === 'dex') cardStats.dex += val;
      else if (target === 'luk') cardStats.luk += val;
      else if (target === 'hp' || target === 'max_hp') cardStats.hp += val;
      else if (target === 'sp' || target === 'max_sp') cardStats.sp += val;
      else if (target === 'critical' || target === '致命打率') cardStats.critical += val;
      else if (target === 'flee' || target === '回避') cardStats.flee += val;
      else if (target === 'hit' || target === '命中') cardStats.hit += val;
      else if (target === 'mdef') cardStats.mdef += val;
    }
    // 効果枠 ② の判定
    if (card.card_effect_type_2 === 'add_stat' && card.card_effect_target_2) {
      const target = card.card_effect_target_2.trim().toLowerCase();
      const val = Number(card.card_effect_value_2) || 0;
      if (target === 'str') cardStats.str += val;
      else if (target === 'agi') cardStats.agi += val;
      else if (target === 'vit') cardStats.vit += val;
      else if (target === 'int') cardStats.int += val;
      else if (target === 'dex') cardStats.dex += val;
      else if (target === 'luk') cardStats.luk += val;
      else if (target === 'hp' || target === 'max_hp') cardStats.hp += val;
      else if (target === 'sp' || target === 'max_sp') cardStats.sp += val;
      else if (target === 'critical' || target === '致命打率') cardStats.critical += val;
      else if (target === 'flee' || target === '回避') cardStats.flee += val;
      else if (target === 'hit' || target === '命中') cardStats.hit += val;
      else if (target === 'mdef') cardStats.mdef += val;
    }
    // 効果枠 ③ の判定
    if (card.card_effect_type_3 === 'add_stat' && card.card_effect_target_3) {
      const target = card.card_effect_target_3.trim().toLowerCase();
      const val = Number(card.card_effect_value_3) || 0;
      if (target === 'str') cardStats.str += val;
      else if (target === 'agi') cardStats.agi += val;
      else if (target === 'vit') cardStats.vit += val;
      else if (target === 'int') cardStats.int += val;
      else if (target === 'dex') cardStats.dex += val;
      else if (target === 'luk') cardStats.luk += val;
      else if (target === 'hp' || target === 'max_hp') cardStats.hp += val;
      else if (target === 'sp' || target === 'max_sp') cardStats.sp += val;
      else if (target === 'critical' || target === '致命打率') cardStats.critical += val;
      else if (target === 'flee' || target === '回避') cardStats.flee += val;
      else if (target === 'hit' || target === '命中') cardStats.hit += val;
      else if (target === 'mdef') cardStats.mdef += val;
    }
  });

  // 🔮 🆕 ジョブレベルを取得（なければ1）し、独立数理室から配列ベースのジョブボーナスを強制召喚
  const jobLv = charData.level || charData.job_level || 1; 
const jobBonus = calculateJobBonus(job, jobLv);

  // 🔮 🆕 【大革命・引き算UI対応】
  // 「純粋な自動補正分 (+X)」を格納するオブジェクトを生成（ジョブボーナス + 手振りボーナス + カード効果）
  const bonus = {
    str: (charData.bonus?.str || 0) + cardStats.str + (jobBonus.str || 0),
    agi: (charData.bonus?.agi || 0) + cardStats.agi + (jobBonus.agi || 0),
    vit: (charData.bonus?.vit || 0) + cardStats.vit + (jobBonus.vit || 0),
    int: (charData.bonus?.int || 0) + cardStats.int + (jobBonus.int || 0),
    dex: (charData.bonus?.dex || 0) + cardStats.dex + (jobBonus.dex || 0),
    luk: (charData.bonus?.luk || 0) + cardStats.luk + (jobBonus.luk || 0),
  };

  // 🔮 🆕 【フロント引き算UI大文字用】
  // 計算エンジンのベース値（マスターの初期値）に、すべての補正（bonus）をガッチャンコした最終総数！
  const str = (Number(charData.meta?.stat_str) || Number(charData.meta?.str) || Number(charData.str) || 1) + bonus.str;
  const agi = (Number(charData.meta?.stat_agi) || Number(charData.meta?.agi) || Number(charData.agi) || 1) + bonus.agi;
  const vit = (Number(charData.meta?.stat_vit) || Number(charData.meta?.vit) || Number(charData.vit) || 1) + bonus.vit;
  const int = (Number(charData.meta?.stat_int) || Number(charData.meta?.int) || Number(charData.int) || 1) + bonus.int;
  const dex = (Number(charData.meta?.stat_dex) || Number(charData.meta?.dex) || Number(charData.dex) || 1) + bonus.dex;
  const luk = (Number(charData.meta?.stat_luk) || Number(charData.meta?.luk) || Number(charData.luk) || 1) + bonus.luk;

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
  const totalEquipMdef = (equips.body?.mdef || 0) + (equips.head?.mdef || 0) + (equips.face?.mdef || 0) + cardStats.mdef;

  // 🔮 最終Derived計算式に対しても、カードのダイレクトパラメータ修正（Critical, Flee, Hit等）を美しくドッキング
  const atk = str + weaponAtk + Math.pow(Math.floor(str / 10), 2) + accessoryAtk;
  const def = Math.floor(vit * 0.5) + totalEquipDef;
  const hit = baseLv + dex + cardStats.hit;
  const flee = baseLv + agi + cardStats.flee;
  const critical = Math.floor(luk * 0.3) + 1 + cardStats.critical;
  const matk = int + Math.pow(Math.floor(int / 7), 2);
  const mdef = Math.floor(int * 0.5) + totalEquipMdef;

  // 🔮 🆕 旧レガシー職名条件を、三土手オリジナル職名（スカウト・ファイター）へと安全リフォーム！
  let baseAspd = 150;
  if (job === 'スカウト') baseAspd = 160;
  if (job === 'ファイター') baseAspd = 152;
  const aspd = Math.min(190, baseAspd + agi * 0.5);

  // 🔮 🆕 最大HP・最大SPの「VIT・INT掛け算連動ロジック」をここに集約
  // ※フェーズ4後半で職業別の掛け算上昇係数を組み込むためのベース配線を開通
  const derivedMaxHp = 100 + (baseLv * 15) + (vit * 8) + cardStats.hp;
  const derivedMaxSp = 20 + (baseLv * 2) + (int * 4) + cardStats.sp;

  // 🔮 🆕 フロントUIへ完璧なオブジェクト構造で返却！
  const displayStatus = {
  str: { base: (Number(charData.meta?.stat_str) || 0) + (charData.bonus?.str || 0), bonus: (jobBonus.str || 0) + cardStats.str },
  agi: { base: (Number(charData.meta?.stat_agi) || 0) + (charData.bonus?.agi || 0), bonus: (jobBonus.agi || 0) + cardStats.agi },
  vit: { base: (Number(charData.meta?.stat_vit) || 0) + (charData.bonus?.vit || 0), bonus: (jobBonus.vit || 0) + cardStats.vit },
  int: { base: (Number(charData.meta?.stat_int) || 0) + (charData.bonus?.int || 0), bonus: (jobBonus.int || 0) + cardStats.int },
  disabled: { base: (Number(charData.meta?.stat_dex) || 0) + (charData.bonus?.dex || 0), bonus: (jobBonus.dex || 0) + cardStats.dex },
  luk: { base: (Number(charData.meta?.stat_luk) || 0) + (charData.bonus?.luk || 0), bonus: (jobBonus.luk || 0) + cardStats.luk },
};

  // 🔮 🆕 フロントUIへ完璧なオブジェクト構造で返却！
  return { 
    atk, def, hit, flee, critical, matk, mdef, aspd, 
    str, agi, vit, int, dex, luk, 
    guild_name: charData.guild_name || '無所属',
    card_hp: cardStats.hp,
    card_sp: cardStats.sp,
    cardStats, // 👈 👑 三土手神特注：集計済みの純粋なカードバッファをそのままフロントへ直送！
    bonus,
    displayStatus,
    maxHp: derivedMaxHp,
    maxSp: derivedMaxSp
  };
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

      // 🎒 アイテムマスターデータを全取得して、装備のテキストIDとメモリ上で結合します
      const { data: allItems } = await supabase.from('game_master_items').select('*');
      const itemMap = allItems ? Object.fromEntries(allItems.map(i => [i.id, i])) : {};

      // 🎴 【神最適化・一撃修正】.select('*') を確実に滑り込ませてエラーを完全撃破！
      const { data: allUserCards } = await supabase
        .from('game_character_cards')
        .select('*')
        .eq('user_id', userId);

      return data.map(ch => {
        const master = ch.game_master_units;
        
        // 🔮 このキャラクターに刺さっているカードだけをメモリ上で安全にフィルタリング（awaitを不要に！）
        const charCards = (allUserCards || []).filter(c => c.character_id === ch.id);
        
        // 各部位の装備オブジェクトを特定し、その装備に刺さっているカードリストも内部に自動集計してドッキング！
        const equips = {
          right_hand: itemMap[ch.equip_right_hand] ? { ...itemMap[ch.equip_right_hand], cards: charCards.filter(c => c.slot_key === 'right_hand').map(c => itemMap[c.card_master_id]).filter(Boolean) } : null,
          left_hand: itemMap[ch.equip_left_hand] ? { ...itemMap[ch.equip_left_hand], cards: charCards.filter(c => c.slot_key === 'left_hand').map(c => itemMap[c.card_master_id]).filter(Boolean) } : null,
          head: itemMap[ch.equip_head] ? { ...itemMap[ch.equip_head], cards: charCards.filter(c => c.slot_key === 'head').map(c => itemMap[c.card_master_id]).filter(Boolean) } : null,
          face: itemMap[ch.equip_face] ? { ...itemMap[ch.equip_face], cards: charCards.filter(c => c.slot_key === 'face').map(c => itemMap[c.card_master_id]).filter(Boolean) } : null,
          body: itemMap[ch.equip_body] ? { ...itemMap[ch.equip_body], cards: charCards.filter(c => c.slot_key === 'body').map(c => itemMap[c.card_master_id]).filter(Boolean) } : null,
          glove: itemMap[ch.equip_glove] ? { ...itemMap[ch.equip_glove], cards: charCards.filter(c => c.slot_key === 'glove').map(c => itemMap[c.card_master_id]).filter(Boolean) } : null,
          garment: itemMap[ch.equip_garment] ? { ...itemMap[ch.equip_garment], cards: charCards.filter(c => c.slot_key === 'garment').map(c => itemMap[c.card_master_id]).filter(Boolean) } : null,
          shoes: itemMap[ch.equip_shoes] ? { ...itemMap[ch.equip_shoes], cards: charCards.filter(c => c.slot_key === 'shoes').map(c => itemMap[c.card_master_id]).filter(Boolean) } : null,
          accessory: itemMap[ch.equip_accessory] ? { ...itemMap[ch.equip_accessory], cards: charCards.filter(c => c.slot_key === 'accessory').map(c => itemMap[c.card_master_id]).filter(Boolean) } : null,
        };

        // 基準キャラクター状態の組み立て
        const charObject = {
  id: ch.id,
  master_id: ch.master_id,
  custom_name: ch.custom_name || master.name,
  level: ch.level,
  exp: ch.exp,
  
  // 💡 もし新規キャラでステータスポイントが0だったら、初期配布分（例：200ポイント）を自動支給！
  status_points: ch.status_points === 0 && ch.level === 1 ? 6 : ch.status_points,
  
  current_hp: ch.current_hp,
  max_hp: ch.max_hp,
  current_sp: ch.current_sp,
  max_sp: ch.max_sp,
  guild_name: ch.guild_name,
  
  // セーフティを 1 から 0 に引き下げ
  str: (master.stat_str || 0) + ch.bonus_str,
  agi: (master.stat_agi || 0) + ch.bonus_agi,
  vit: (master.stat_vit || 0) + ch.bonus_vit,
  int: (master.stat_int || 0) + ch.bonus_int,
  dex: (master.stat_dex || 0) + ch.bonus_dex,
  luk: (master.stat_luk || 0) + ch.bonus_luk,

  bonus: {
    str: ch.bonus_str,
    agi: ch.bonus_agi,
    vit: ch.bonus_vit,
    int: ch.bonus_int,
    dex: ch.bonus_dex,
    luk: ch.bonus_luk
  },
  job_level: ch.job_level || 1, 
  equips: equips, 
  meta: master
};

        // 🧠 心臓部の計算エンジンを通し、戦闘ステータス（roStatus）を自動ドッキング！
        charObject.roStatus = calculateRoStatus(charObject, equips);
        
        // ⚡【鉄壁のダブル配線】フロントUIが「ro」という変数名で探しても100%ヒットするように直撃ミラー結合！
        charObject.ro = charObject.roStatus; 

        // 🔮 🆕 エンジンが算出したリアルタイム連動の最大HP/SPでキャラクターオブジェクトの器を上書き同期！
        charObject.max_hp = charObject.roStatus.maxHp;
        charObject.max_sp = charObject.roStatus.maxSp;

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
      if (normalizedNewItemId) {
        console.log(`🎒 共有倉庫からアイテム [${normalizedNewItemId}] の在庫を 1 減らします...`);
        
        // ユーザーIDの不一致に備え、item_id の一致を最優先で検索
        const { data: inv } = await supabase
          .from('game_inventory')
          .select('*')
          .eq('item_id', normalizedNewItemId)
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
      updateData[finalColumnName] = normalizedNewItemId;

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
      // 🔮 JavaScript側のコメントとして外側に記述すれば絶対に安全です
      const { data, error } = await supabase
        .from('game_inventory')
        .select(`
          *,
          game_master_items!game_inventory_item_id_fkey (
            name, item_type, item_subtype, weapon_range, slot_count, rarity, description,
            atk, def, mdef, weapon_level, equip_level_req, job_restriction, weight, penalty_str,
            card_effect_type, card_effect_target, card_effect_value,
            card_effect_type_2, card_effect_target_2, card_effect_value_2,
            card_effect_type_3, card_effect_target_3, card_effect_value_3
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
  },

  // ─── 🎴 プランA仕様：ここからモンスターカード用の挿脱物流システムを完全統合！ ───

  /**
   * 🎴 カードを武具のスロット（穴）にパチッと挿し込む永続保存コミット
   */
  async insertCardToSlot(userId, characterId, slotKey, slotIndex, cardMasterId) {
    try {
      console.log("=== 🎴 カードスロット装着テスト開始 ===");
      console.log("【入力データ】:", { userId, characterId, slotKey, slotIndex, cardMasterId });

      if (!cardMasterId) throw new Error("挿入するカードのマスターIDが指定されていません。");

      // 1. 共有倉庫（ギルド在庫）から、そのカードのストックを 1 減らす
      const { data: inv, error: invErr } = await supabase
        .from('game_inventory')
        .select('*')
        .eq('item_id', cardMasterId)
        .maybeSingle();

      if (!inv || inv.count <= 0) {
        throw new Error("指定されたカードの在庫がギルド共有倉庫にありません。");
      }

      // 在庫をデクリメント
      await supabase.from('game_inventory').update({ count: inv.count - 1 }).eq('id', inv.id);
      console.log(`➔ 倉庫のカード在庫を1つ減らしました (残り: ${inv.count - 1}個)`);

      // 2. スロット分離テーブル（game_character_cards）に対してUpsert（直撃挿入）を実行
      const { data, error: cardInsertErr } = await supabase
        .from('game_character_cards')
        .upsert({
          user_id: userId,
          character_id: characterId,
          slot_key: slotKey,
          slot_index: Number(slotIndex),
          card_master_id: cardMasterId
        }, { onConflict: 'character_id,slot_key,slot_index' })
        .select();

      if (cardInsertErr) throw cardInsertErr;

      console.log("🎯 【大成功】武具へのカード装着＆倉庫ストック連動が完了しました！", data);
      console.log("=== 🎴 カードスロット装着テスト終了 ===");
      return { success: true, data };

    } catch (err) {
      console.error('🚨 【カード装着エラー】:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * 🎴 武具のスロットからカードを「抜いて」共有倉庫へ現物を戻すロジック
   */
  async removeCardFromSlot(userId, characterId, slotKey, slotIndex, cardMasterId) {
    try {
      console.log("=== 🎴 カードスロット取り外しテスト開始 ===");
      console.log("【入力データ】:", { userId, characterId, slotKey, slotIndex, cardMasterId });

      // 1. スロットテーブルから該当のカードレコードを完全削除
      const { error: deleteErr } = await supabase
        .from('game_character_cards')
        .delete()
        .eq('character_id', characterId)
        .eq('slot_key', slotKey)
        .eq('slot_index', slotIndex);

      if (deleteErr) throw deleteErr;
      console.log("➔ スロットからカードデータを消去しました。");

      // 2. 共有倉庫へカードの現物ストックを1つ戻す
      const { data: inv, error: invSelectErr } = await supabase
        .from('game_inventory')
        .select('*')
        .eq('item_id', cardMasterId)
        .maybeSingle();

      if (inv) {
        await supabase.from('game_inventory').update({ count: inv.count + 1 }).eq('id', inv.id);
        console.log(`➔ 倉庫のカードストックを1つ戻しました (現在: ${inv.count + 1}個)`);
      } else {
        // 万が一倉庫からレコード自体が消えていた場合は新規復元
        await supabase.from('game_inventory').insert({ user_id: userId, item_id: cardMasterId, count: 1 });
        console.log(`➔ 倉庫にカードスロットを新規復元しました (1個)`);
      }

      console.log("🎯 【大成功】カードの取り外し＆倉庫への返却が完了しました！");
      console.log("=== 🎴 カードスロット取り外しテスト終了 ===");
      return { success: true };

    } catch (err) {
      console.error('🚨 【カード取り外しエラー】:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * 🎴 キャラクターが現在身にまとっている全カード装着データを一括ロードする関数
   */
  async getCharacterEquippedCards(characterId) {
    try {
      const { data, error } = await supabase
        .from('game_character_cards')
        .select('*')
        .eq('character_id', characterId);

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('📋 カード装着データ取得失敗:', err);
      return [];
    }
  }
};