import { supabase } from '../../../supabaseClient';
// 🔮 🆕 独立数理室からジョブボーナス算出ロジックを電線結合！
import { 
  calculateJobBonus, 
  calculateDamageModifier, 
  calculateStatusInflictChance, 
  applyStatusConditionDebuffs,
  calculateMatk // 👈 ここにカンマを入れてこれを追記！
} from './gameRules';

/**
 * 👑 ラグナロクオンライン式・戦闘ステータス完全計算エンジン
 * 基本ステータス（STR〜LUK）、装備、レベル、職業補正から
 * 本家準拠の戦闘パラメータ（Atk, Def, Hit, Flee, Aspd, Critical, Matk, Mdef）を算出します。
 */
export const calculateRoStatus = (charData, equips = {}) => {
  const baseLv = charData.level || 1;
  
  // 🔮 🆕 解決：直下のjobがNULLでも、meta.job や、キャラクター直下のオブジェクト情報を網羅して執念で100%確定抽出！
  let rawJob = 'ノービス';
  if (charData.meta && charData.meta.job) {
    rawJob = charData.meta.job;
  } else if (charData.job) {
    rawJob = charData.job;
  } else if (charData.custom_name) {
    rawJob = charData.custom_name;
  }
  
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

  // 🎯 【三土手神特注】習得済みスキルから常時発動パッシブの効果量をその場で自動集計！
  let passiveDexBonus = 0;
  if (charData.skillsList && Array.isArray(charData.skillsList)) {
    charData.skillsList.forEach(sk => {
      if (sk.skill_type === 'passive') {
        if (sk.effect_type === 'パッシブDEX増幅' || sk.name?.includes('ディバインアイ')) {
          passiveDexBonus += Number(sk.effect_value || 0);
        }
      }
    });
  }

  // 🔮 🆕 【大革命・引き算UI対応】
  // 「純粋な自動補正分 (+X)」を格納するオブジェクトを生成（ジョブボーナス + 手振りボーナス + カード効果 + パッシブスキル）
  const bonus = {
    str: (charData.bonus?.str || 0) + cardStats.str + (jobBonus.str || 0),
    agi: (charData.bonus?.agi || 0) + cardStats.agi + (jobBonus.agi || 0),
    vit: (charData.bonus?.vit || 0) + cardStats.vit + (jobBonus.vit || 0),
    int: (charData.bonus?.int || 0) + cardStats.int + (jobBonus.int || 0),
    // 🎯 DEXの自動補正バッファにパッシブスキルでの上昇分を加算！
    dex: (charData.bonus?.dex || 0) + cardStats.dex + (jobBonus.dex || 0) + passiveDexBonus,
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

  // 👑 🆕 精錬値ボーナス計算室（武器: +1毎にATK+5 / 防具: +1毎にDEF+2）
  const getRefineAtk = (eq) => (Number(eq?.refine_level || 0) * 5);
  const getRefineDef = (eq) => (Number(eq?.refine_level || 0) * 2);

  // 🆕 9部位のスペックを集計（精錬ボーナスを合算！）
  const weaponAtk = (equips.right_hand?.atk || 0) + getRefineAtk(equips.right_hand);
  const shieldDef = (equips.left_hand?.def || 0) + getRefineDef(equips.left_hand);
  const headDef = (equips.head?.def || 0) + getRefineDef(equips.head);
  const faceDef = (equips.face?.def || 0) + getRefineDef(equips.face);
  const bodyDef = (equips.body?.def || 0) + getRefineDef(equips.body);
  const gloveDef = (equips.glove?.def || 0) + getRefineDef(equips.glove);
  const garmentDef = (equips.garment?.def || 0) + getRefineDef(equips.garment);
  const shoesDef = (equips.shoes?.def || 0) + getRefineDef(equips.shoes);
  const accessoryAtk = (equips.accessory?.atk || 0) + getRefineAtk(equips.accessory);
  
  const totalEquipDef = shieldDef + headDef + faceDef + bodyDef + gloveDef + garmentDef + shoesDef;
  const totalEquipMdef = (equips.body?.mdef || 0) + (equips.head?.mdef || 0) + (equips.face?.mdef || 0) + cardStats.mdef;

  // 🔮 最終Derived計算式に対しても、カードのダイレクトパラメータ修正（Critical, Flee, Hit等）を美しくドッキング
  let passiveRangedHitBonus = 0;
  if (charData.skillsList && Array.isArray(charData.skillsList)) {
    charData.skillsList.forEach(sk => {
      if (sk.skill_type === 'passive') {
        if (sk.effect_type === '遠隔命中増幅' || sk.name?.includes('ホークアイ') || sk.name?.includes('遠見の心眼')) {
          passiveRangedHitBonus += Number(sk.effect_value || 0);
        }
      }
    });
  }

  // 🎯 右手装備が「Lレンジ（弓など）」であるか判定
  const isRangedWeapon = equips.right_hand?.range === 'L' || equips.right_hand?.weapon_range === 'L';

  // 🔮 最終Derived計算式に対しても、カードのダイレクトパラメータ修正（Critical, Flee, Hit等）を美しくドッキング
  const atk = str + weaponAtk + Math.pow(Math.floor(str / 10), 2) + accessoryAtk;
  const def = Math.floor(vit * 0.5) + totalEquipDef;
  
  // 🎯 【三土手神特注】Lレンジ武器装備時のみ、ホークアイの数値をHitに直撃ドッキング！
  const hit = baseLv + dex + cardStats.hit + (isRangedWeapon ? passiveRangedHitBonus : 0);
  
  const flee = baseLv + agi + cardStats.flee;
  const critical = Math.floor(luk * 0.3) + 1 + cardStats.critical;
  
  // 🔮 🆕 固定値を粉砕し、intとdex連動型のダイス幅オブジェクト(minMatk, maxMatk)へ換装！
  const matk = calculateMatk(int, dex); 
  
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
  dex: { base: (Number(charData.meta?.stat_dex) || 0) + (charData.bonus?.dex || 0), bonus: (jobBonus.dex || 0) + cardStats.dex }, // 👈 dexへ修正
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

      // 🎒 アイテムマスターデータ ＆ 🔮 スキルマスターデータを同時に全取得します
      const { data: allItems } = await supabase.from('game_master_items').select('*');
      const { data: allSkills } = await supabase.from('game_master_skills').select('*'); // 🔮 🆕 スキルマスターを直撃ロード！

      // 💡 2つの異なるマスターデータを1つの配列に美しく結合（マージ）して、選抜エンジンのソースの器にします
      const combinedMasterList = [
        ...(allItems || []),
        ...(allSkills || [])
      ];

      const itemMap = allItems ? Object.fromEntries(allItems.map(i => [i.id, i])) : {};

      // 🎴 【神最適化・一撃修正】.select('*') を確実に快速配線！
      const { data: rawInventory } = await supabase
        .from('game_inventory')
        .select('*')
        .eq('user_id', userId);

      const invMap = rawInventory ? Object.fromEntries(rawInventory.map(i => [i.id, i])) : {};

      // 🎴 カードデータの全取得
      const { data: allUserCards } = await supabase
        .from('game_character_cards')
        .select('*')
        .eq('user_id', userId);

      return data.map(ch => {
        const master = ch.game_master_units;
        const charCards = (allUserCards || []).filter(c => c.character_id === ch.id);

        // 9部位の装備をインベントリのUUID経由で復元！
        const resolveEquip = (equipInvId, slotKey) => {
          if (!equipInvId) return null;
          const invRecord = invMap[equipInvId];
          if (!invRecord) return null;
          const masterItem = itemMap[invRecord.item_id];
          if (!masterItem) return null;

          return {
            ...masterItem,
            inventory_id: invRecord.id, // インベントリのUUID
            refine_level: Number(invRecord.refine_level || 0), // 共有倉庫側の精錬値を直接取得！
            range: masterItem.weapon_range || 'S',
            cards: charCards.filter(c => c.slot_key === slotKey).map(c => itemMap[c.card_master_id]).filter(Boolean)
          };
        };

        const equips = {
          right_hand: resolveEquip(ch.equip_right_hand, 'right_hand'),
          left_hand: resolveEquip(ch.equip_left_hand, 'left_hand'),
          head: resolveEquip(ch.equip_head, 'head'),
          face: resolveEquip(ch.equip_face, 'face'),
          body: resolveEquip(ch.equip_body, 'body'),
          glove: resolveEquip(ch.equip_glove, 'glove'),
          garment: resolveEquip(ch.equip_garment, 'garment'),
          shoes: resolveEquip(ch.equip_shoes, 'shoes'),
          accessory: resolveEquip(ch.equip_accessory, 'accessory'),
        };

        // 基準キャラクター状態の組み立て
        const charObject = {
          id: ch.id,
          master_id: ch.master_id,
          custom_name: ch.custom_name || master.name,

          // 🚨 ⬇️ 【ココを追加！】DBから取ってきた装備IDを、ちゃんとフロントへ送る箱に乗せる！
          equip_right_hand: ch.equip_right_hand,
          equip_left_hand: ch.equip_left_hand,
          equip_head: ch.equip_head,
          equip_face: ch.equip_face,
          equip_body: ch.equip_body,
          equip_glove: ch.equip_glove,
          equip_garment: ch.equip_garment,
          equip_shoes: ch.equip_shoes,
          equip_accessory: ch.equip_accessory,

          // 🐾 🆕 【三土手神特注：魔物スキル輸送電線】
          // ⬇️ ここに3行追加！戦闘AIの弾切れバグを完全に粉砕します！
          skill_01: ch.skill_01,
          skill_02: ch.skill_02,
          skill_03: ch.skill_03,

          level: ch.level,
          exp: ch.exp,
          
          // 👑 【三土手神特注：フリーポイント増殖バグ完全粉砕！】
          // フロントでの勝手な自動支給を撤廃し、DBに保存された本物の数値を100%信用して直結！
          status_points: ch.status_points,
  
  current_hp: ch.current_hp,
  max_hp: ch.max_hp,
  current_sp: ch.current_sp,
  max_sp: ch.max_sp,
  
  // 👑 【三土手神特注：データ欠損バグ完全粉砕！】
  // DBの直下カラムに存在する「job」「race」をフロントの器へ確実に引き渡す直撃電線を増築！
  job: ch.job,
  race: ch.race,
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

        // 🔮 🆕 【三土手神特注】ベースLv連動型・同名スキル最高ランク選抜マスタリー
        const currentJob = master?.job || 'ノービス';
        const currentLv = ch.level || 1;
        // 💡 ⚙️ スキルデータが完全合流した「combinedMasterList」にバトンタッチ！
        const activeSkillsSource = combinedMasterList || []; 

        // 🐾 🆕 【特注インフラ】このキャラクターがDBに直接持っている「固有スキルID」を抽出
        const inherentSkillIds = [ch.skill_01, ch.skill_02, ch.skill_03].filter(Boolean);

        // ① まず該当の職業とベースLv条件をクリアしているスキルをすべて抽出
        const allEligibleSkills = activeSkillsSource.filter(s => {
          if (s.sp_cost === undefined) return false; // アイテムではなくスキルデータであること
          
          // 🐾 👑 【神特注ゲート】このキャラが固有に持っているスキルなら、職業・レベル制限を完全に無視して「絶対合格（習得）」させる！
          if (inherentSkillIds.includes(s.id)) return true;

          const jobReq = s.job_requirement || '全職業';
          const lvReq = Number(s.level_requirement) || 1;
          return (jobReq === '全職業' || jobReq === currentJob) && currentLv >= lvReq;
        });

        // ② 同名スキルの中で最も必要レベルが高いもの（最高ランク）だけをマップで選抜上書き
        const skillMap = {};
        allEligibleSkills.forEach(sk => {
          const sName = sk.name;
          if (!skillMap[sName] || Number(sk.level_requirement) > Number(skillMap[sName].level_requirement)) {
            skillMap[sName] = sk;
          }
        });

        // ③ 絞り込まれた最高ランクのスキル配列をキャラクターデータに直撃バインド！
        charObject.skillsList = Object.values(skillMap);

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
  async saveEquipmentChange(userId, characterId, slotKey, newInventoryIdOrNull) {
    try {
      console.log("=== ⚔️ アプローチB: 装備UUID換装コミット開始 ===");
      const finalColumnName = slotKey.startsWith('equip_') ? slotKey : `equip_${slotKey}`;
      const normalizedNewId = newInventoryIdOrNull === undefined ? null : newInventoryIdOrNull;

      const updateData = {};
      updateData[finalColumnName] = normalizedNewId;

      const { data, error } = await supabase
        .from('game_characters')
        .update(updateData)
        .eq('id', characterId)
        .select();

      if (error) throw error;

      console.log("🎯 【着脱成功】装備スロットへインベントリUUIDを書き込みました:", normalizedNewId);
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
  }, // 👈 🆕 修正点：次の関数に繋げるためにカンマを打ちました！

  // ─── 🏨 🆕 クエストハブ予約連動：1次職7クラス・コンプリートインジェクションエンジン ───
  /**
   * ユーザーが店舗を予約した瞬間、酒場（待機枠）に1次職キャラクターを自動支給します。
   * 1回目：業種カテゴリに応じた固定クラス
   * 2〜7回目：まだ所持していない残りの1次職からランダム選抜（7回で確実に全職コンプリート）
   * 8回目以降：セーフティガード（将来の限界突破やレア武具支給の拡張枠）
   */
  async grantCharacterFromReservation(userId, shopId) {
    try {
      console.log(`🚀 予約連動ガチャ起動: user_id=${userId}, shop_id=${shopId}`);
      if (!userId || !shopId) throw new Error("ユーザーIDまたは店舗IDが不足しています");

      // 【1】1次職7クラスの「本物のmaster_id」と職業名の定義マップ[cite: 3]
      const ALL_JOB_MAP = [
        { master_id: 'unit_1784020957053',   job_name: 'ノービス' },
        { master_id: 'unit_1784020869929',   job_name: 'ファイター' },
        { master_id: 'unit_1784020928288',   job_name: 'メイジ' },
        { master_id: 'unit_1784020916983',   job_name: 'クレリック' },
        { master_id: 'unit_1784020901141',   job_name: 'スカウト' },
        { master_id: 'unit_1783644775835',   job_name: 'ハンター' },
        { master_id: 'unit_1783729889058',   job_name: 'テイマー' }
      ];

      // 【2】予約された店舗（profiles）の「業種（business_type）」をスキャン
      const { data: shopProfile, error: shopErr } = await supabase
        .from('profiles')
        .select('business_type')
        .eq('id', shopId)
        .single();

      if (shopErr) throw shopErr;
      const bizType = shopProfile?.business_type || 'その他';
      console.log(`🏨 店舗の業種を識別しました: ${bizType}`);

      // 【3】現在ユーザーが所持している全キャラクターを game_characters から取得
      const { data: myChars, error: charErr } = await supabase
        .from('game_characters')
        .select('master_id')
        .eq('user_id', userId);

      if (charErr) throw charErr;
      const myMasterIds = (myChars || []).map(c => c.master_id);
      console.log("🎒 現在所持しているユニットのmaster_id一覧:", myMasterIds);

      // 現在所持している「1次職」の数をカウント
      const possessedJobs = ALL_JOB_MAP.filter(j => myMasterIds.includes(j.master_id));
      const possessedCount = possessedJobs.length;
      console.log(`📊 1次職コンプリート進捗: ${possessedCount} / 7 つ所持`);

      let targetUnit = null;

      // --- 抽選ロジック分岐 ---
      if (possessedCount === 0) {
        // 🌟 1回目（初回）：店舗の業種カテゴリに応じた固定クラスを選定
        // デフォルトのフォールバックは「ノービス」のIDに設定
        let targetMasterId = 'unit_1784020957053'; 

        if (bizType.includes('美容') || bizType.includes('サロン') || bizType.includes('ヘア')) {
          targetMasterId = 'unit_1784020901141'; // 美容室 ➔ スカウト
        } else if (bizType.includes('整体') || bizType.includes('クリニック') || bizType.includes('医療') || bizType.includes('接骨')) {
          targetMasterId = 'unit_1784020916983'; // 医療・治療 ➔ クレリック
        } else if (bizType.includes('飲食') || bizType.includes('フード') || bizType.includes('カフェ')) {
          targetMasterId = 'unit_178372889058';  // グルメ ➔ テイマー
        } else if (bizType.includes('ジム') || bizType.includes('スポーツ') || bizType.includes('フィットネス')) {
          targetMasterId = 'unit_1784020869929'; // 運動・筋トレ ➔ ファイター
        } else if (bizType.includes('スクール') || bizType.includes('占い') || bizType.includes('学び') || bizType.includes('レッスン')) {
          targetMasterId = 'unit_1784020928288'; // 知恵・神秘 ➔ メイジ
        } else if (bizType.includes('イベント') || bizType.includes('アウトドア') || bizType.includes('企画')) {
          targetMasterId = 'unit_1783644775835'; // 活動 ➔ ハンター
        }

        targetUnit = ALL_JOB_MAP.find(j => j.master_id === targetMasterId);

        // 🛡️ 【超強力ガード】もし判定漏れ等で万が一見つからなかった場合はノービスを強制選抜
        if (!targetUnit) {
          console.warn("⚠️ 割り当てIDが見つからなかったため、ノービスを緊急選抜します。");
          targetUnit = ALL_JOB_MAP.find(j => j.job_name === 'ノービス');
        }

        console.log(`➔ 【初回特典】業種連動により固定選抜: ${targetUnit.job_name}`);
      } 
      else if (possessedCount >= 1 && possessedCount < 7) {
        // 🔄 2〜7回目：まだ所持していない「未獲得プール」から厳密にランダム選抜！
        const unpossessedPool = ALL_JOB_MAP.filter(j => !myMasterIds.includes(j.master_id));
        
        // JavaScriptの安全なランダムインデックスで1枠選抜
        const randomIndex = Math.floor(Math.random() * unpossessedPool.length);
        targetUnit = unpossessedPool[randomIndex];
        console.log(`➔ 【リピート特典】未所持プール（残り${unpossessedPool.length}職）からランダム選抜: ${targetUnit.job_name}`);
      } 
      else {
        // 👑 7回以上（全職コンプリート後）：将来の限界突破（+1）やレア武具支給の拡張用のセーフティガード
        console.log("🎉 すでに1次職7クラスを全てコンプリートしています！(次回拡張アップデートをお楽しみに！)");
        return { success: true, message: "completed_all_jobs" };
      }

      if (!targetUnit) throw new Error("支給対象キャラクターの選定に失敗しました");

      // 【4】選ばれた1次職の初期ステータスマスターデータ（game_master_units）を精査するため1発ロード[cite: 3]
      const { data: masterUnit, error: masterErr } = await supabase
        .from('game_master_units')
        .select('*')
        .eq('id', targetUnit.master_id)
        .single();

      if (masterErr || !masterUnit) throw new Error(`マスターユニット [${targetUnit.master_id}] が見つかりません。GameMasterDashboardで先に作成されているか確認してください。`);

      // 【5】game_characters に酒場待機状態（party_index = null）でINSERTを実行！
      const { data: newCharacter, error: insertErr } = await supabase
        .from('game_characters')
        .insert([
          {
            user_id: userId,
            master_id: targetUnit.master_id,
            custom_name: targetUnit.job_name,
            job: targetUnit.job_name,       // 🚀 🆕 SQLで増築したjobカラムへ職業名を直接書き込み！
            race: '人間',                    // 🚀 🆕 SQLで増築したraceカラムへ固定で「人間」を直接書き込み！
            level: 1,
            exp: 0,
            status_points: 6, // 👑 三土手神仕様：初期フリーポイント6を自動チャージ！
            current_hp: masterUnit.base_hp || 100,
            max_hp: masterUnit.base_hp || 100,
            current_sp: masterUnit.base_sp || 10,
            max_sp: masterUnit.base_sp || 10,
            bonus_str: 0,
            bonus_agi: 0,
            bonus_vit: 0,
            bonus_int: 0,
            bonus_dex: 0,
            bonus_luk: 0,
            party_index: null, // 👈 酒場にお留守番（待機状態）
            guild_name: '無所属'
          }
        ])
        .select()
        .single();

      if (insertErr) throw insertErr;

      console.log(`🎯 【インジェクション大成功】酒場に『創世の${targetUnit.job_name}』を自動支給しました！`, newCharacter);
      return { success: true, character: newCharacter };

    } catch (err) {
      console.error("🚨 【予約キャラ支給エラー詳細】:", err);
      return { success: false, error: err.message };
    }
  }
}; // ➔ ここでオブジェクトの終わりを綺麗に閉じます