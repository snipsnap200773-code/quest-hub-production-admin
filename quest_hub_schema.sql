


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_reservation_with_capacity"("p_store_id" "uuid", "p_user_id" "uuid", "p_reservation_time" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_count INTEGER;
  store_capacity INTEGER;
BEGIN
  -- 1. 対象店舗の最大キャパシティを取得
  SELECT max_capacity INTO store_capacity FROM stores WHERE id = p_store_id;

  -- 2. その時間枠の現在の予約数をカウント（排他ロックをかけて同時書き込みを防止）
  SELECT count(*) INTO current_count 
  FROM reservations 
  WHERE store_id = p_store_id 
    AND reservation_time = p_reservation_time;

  -- 3. キャパシティに空きがあれば予約実行
  IF current_count < store_capacity THEN
    INSERT INTO reservations (store_id, user_id, reservation_time)
    VALUES (p_store_id, p_user_id, p_reservation_time);
    RETURN TRUE;
  ELSE
    RETURN FALSE; -- 満杯
  END IF;
END;
$$;


ALTER FUNCTION "public"."create_reservation_with_capacity"("p_store_id" "uuid", "p_user_id" "uuid", "p_reservation_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_reservation_with_capacity"("p_shop_id" "uuid", "p_customer_name" "text", "p_res_type" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_options" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_count INTEGER;
  store_capacity INTEGER;
BEGIN
  SELECT max_capacity INTO store_capacity FROM profiles WHERE id = p_shop_id;
  
  SELECT count(*) INTO current_count 
  FROM reservations 
  WHERE shop_id = p_shop_id 
    AND (
      (start_time <= p_start_time AND end_time > p_start_time) OR
      (start_time < p_end_time AND end_time >= p_end_time)
    );

  IF current_count < store_capacity THEN
    INSERT INTO reservations (shop_id, customer_name, res_type, start_time, end_time, options)
    VALUES (p_shop_id, p_customer_name, p_res_type, p_start_time, p_end_time, p_options);
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;


ALTER FUNCTION "public"."create_reservation_with_capacity"("p_shop_id" "uuid", "p_customer_name" "text", "p_res_type" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_options" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_facility_to_customers"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 施設名(facility_name)が顧客名(name)と一致する行を更新
  UPDATE public.customers
  SET 
    furigana = NEW.furigana,
    phone = NEW.tel,    -- facility_usersのtelをcustomersのphoneへ
    email = NEW.email,
    address = NEW.address
  WHERE name = NEW.facility_name;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_facility_to_customers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_adjustments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "service_id" "uuid",
    "name" "text",
    "price" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_percent" boolean DEFAULT false,
    "is_minus" boolean DEFAULT false,
    "category" "text",
    "shop_id" "uuid",
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."admin_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_users" (
    "id" "uuid" NOT NULL,
    "display_id" "text" NOT NULL,
    "display_name" "text",
    "email" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "zip_code" "text",
    "address" "text",
    "phone" "text"
);


ALTER TABLE "public"."app_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "day_of_week" integer,
    "is_open" boolean DEFAULT true,
    "open_time" time without time zone DEFAULT '09:00:00'::time without time zone,
    "close_time" time without time zone DEFAULT '18:00:00'::time without time zone,
    "regular_holiday" boolean DEFAULT false
);


ALTER TABLE "public"."business_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "name" "text",
    "phone" "text",
    "email" "text",
    "line_user_id" "text",
    "total_visits" integer DEFAULT 1,
    "last_arrival_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "memo" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_spent" integer DEFAULT 0,
    "last_visit_at" timestamp with time zone,
    "first_arrival_date" "date",
    "service_id" "uuid",
    "total_sales" integer DEFAULT 0,
    "last_visit_date" "date",
    "visit_count" integer DEFAULT 0,
    "name_kana" "text",
    "technical_memo" "text",
    "last_visited_at" timestamp with time zone,
    "address" "text",
    "furigana" "text",
    "company_name" "text",
    "symptoms" "text",
    "request_details" "text",
    "parking" "text",
    "zip_code" "text",
    "building_type" "text",
    "care_notes" "text",
    "notes" "text",
    "custom_answers" "jsonb",
    "auth_id" "uuid",
    "admin_name" "text",
    "is_facility" boolean DEFAULT false,
    "cancel_count" integer DEFAULT 0,
    "is_blocked" boolean DEFAULT false
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."customers"."zip_code" IS 'お客様の郵便番号（リピーター対応用）';



CREATE TABLE IF NOT EXISTS "public"."facilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "address" "text",
    "visit_rule" "text",
    "contact_person" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pw" "text",
    "email" "text",
    "tel" "text",
    "regular_rules" "jsonb" DEFAULT '[]'::"jsonb",
    "booking_type" "text" DEFAULT 'fixed'::"text"
);


ALTER TABLE "public"."facilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facility_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "login_id" "text" NOT NULL,
    "password" "text" NOT NULL,
    "facility_name" "text" NOT NULL,
    "email" "text",
    "address" "text",
    "tel" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "accept_salon" boolean DEFAULT true,
    "accept_dentist" boolean DEFAULT true,
    "accept_massage" boolean DEFAULT true,
    "email_notifications_enabled" boolean DEFAULT true,
    "contact_name" "text",
    "official_url" "text",
    "allowed_categories" "text"[] DEFAULT '{}'::"text"[],
    "furigana" "text",
    "is_suspended" boolean DEFAULT false NOT NULL,
    "is_test_mode" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."facility_users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."facility_users"."is_suspended" IS '施設アカウントの一時停止フラグ（trueで停止）';



COMMENT ON COLUMN "public"."facility_users"."is_test_mode" IS 'テストモードフラグ（trueで過去予約を許可）';



CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "shop_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_character_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "character_id" "uuid" NOT NULL,
    "slot_key" "text" NOT NULL,
    "slot_index" integer NOT NULL,
    "card_master_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."game_character_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_characters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "master_id" "text" NOT NULL,
    "custom_name" "text",
    "level" integer DEFAULT 1 NOT NULL,
    "exp" integer DEFAULT 0 NOT NULL,
    "status_points" integer DEFAULT 0 NOT NULL,
    "current_hp" integer DEFAULT 100 NOT NULL,
    "max_hp" integer DEFAULT 100 NOT NULL,
    "current_sp" integer DEFAULT 10 NOT NULL,
    "max_sp" integer DEFAULT 10 NOT NULL,
    "bonus_str" integer DEFAULT 0 NOT NULL,
    "bonus_agi" integer DEFAULT 0 NOT NULL,
    "bonus_vit" integer DEFAULT 0 NOT NULL,
    "bonus_int" integer DEFAULT 0 NOT NULL,
    "bonus_dex" integer DEFAULT 0 NOT NULL,
    "bonus_luk" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "guild_name" character varying(255) DEFAULT NULL::character varying,
    "equip_right_hand" "uuid",
    "equip_left_hand" "uuid",
    "equip_head" "uuid",
    "equip_face" "uuid",
    "equip_body" "uuid",
    "equip_glove" "uuid",
    "equip_garment" "uuid",
    "equip_shoes" "uuid",
    "equip_accessory" "uuid",
    "bag_items" "jsonb" DEFAULT '[]'::"jsonb",
    "party_index" integer,
    "sub_tame_id" "text",
    "meta" "jsonb",
    "skill_01" "text",
    "skill_02" "text",
    "skill_03" "text",
    "job" "text",
    "race" "text"
);


ALTER TABLE "public"."game_characters" OWNER TO "postgres";


COMMENT ON COLUMN "public"."game_characters"."party_index" IS '編成パーティのインデックス枠（0〜4）。NULLは未編成状態。';



CREATE TABLE IF NOT EXISTS "public"."game_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "socket_card_01" "text",
    "socket_card_02" "text",
    "socket_card_03" "text",
    "socket_card_04" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "count" integer DEFAULT 1,
    "is_favorite" boolean DEFAULT false,
    "refine_level" integer DEFAULT 0,
    "equipped_character_id" "uuid",
    "equipped_slot_key" "text"
);


ALTER TABLE "public"."game_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_master_items" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_subtype" "text" DEFAULT '剣'::"text" NOT NULL,
    "weapon_range" "text" DEFAULT 'S'::"text" NOT NULL,
    "slot_count" integer DEFAULT 0 NOT NULL,
    "rarity" "text" DEFAULT 'common'::"text" NOT NULL,
    "sell_price" integer DEFAULT 0 NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "atk" integer DEFAULT 0,
    "def" integer DEFAULT 0,
    "mdef" integer DEFAULT 0,
    "weapon_level" integer DEFAULT 1,
    "equip_level_req" integer DEFAULT 1,
    "job_restriction" character varying(255) DEFAULT '全職業'::character varying,
    "weight" integer DEFAULT 10,
    "penalty_str" integer DEFAULT 0,
    "card_effect_type" "text",
    "card_effect_target" "text",
    "card_effect_value" integer DEFAULT 0,
    "card_effect_type_2" "text",
    "card_effect_target_2" "text",
    "card_effect_value_2" integer DEFAULT 0,
    "card_effect_type_3" "text",
    "card_effect_target_3" "text",
    "card_effect_value_3" integer DEFAULT 0
);


ALTER TABLE "public"."game_master_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_master_quests" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "level" integer DEFAULT 1,
    "floors" integer DEFAULT 1,
    "difficulty" "text" DEFAULT 'E'::"text",
    "description" "text",
    "enemy_master_id" "text",
    "exp_reward" integer DEFAULT 50,
    "zeny_reward" integer DEFAULT 1000,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "enemy_master_id_2" "text",
    "enemy_master_id_3" "text",
    "floor_configs" "jsonb" DEFAULT '[]'::"jsonb",
    "environment_type" "text" DEFAULT 'dungeon'::"text",
    "area_type_name" "text" DEFAULT '階層'::"text",
    "prologue_text" "text"
);


ALTER TABLE "public"."game_master_quests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."game_master_quests"."floor_configs" IS 'B1〜B5の各階層における出現エネミー・戦闘回数・宝箱・泉のコンフィグ配列';



CREATE TABLE IF NOT EXISTS "public"."game_master_skills" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "skill_type" "text" DEFAULT 'magic'::"text" NOT NULL,
    "sp_cost" integer DEFAULT 0 NOT NULL,
    "effect_value" integer DEFAULT 0 NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "job_requirement" "text" DEFAULT '全職業'::"text",
    "level_requirement" integer DEFAULT 1,
    "target_type" "text" DEFAULT '単体エネミー'::"text",
    "use_condition" "text" DEFAULT '戦闘中のみ'::"text",
    "element" "text" DEFAULT '無'::"text",
    "effect_type" "text" DEFAULT 'なし'::"text",
    "effect_chance" integer DEFAULT 0,
    "duration_turns" integer DEFAULT 0,
    "value_type" "text" DEFAULT 'percent'::"text",
    "cast_time" numeric DEFAULT 0,
    "is_absolute_hit" boolean DEFAULT true,
    "skill_range" "text" DEFAULT 'L'::"text",
    "buff_value" numeric DEFAULT 0,
    "buff_value_type" "text" DEFAULT 'percent'::"text",
    "is_range_damage_cut" boolean DEFAULT false,
    "range_damage_cut_pct" numeric DEFAULT 0,
    "target_priority_jobs" "text"[]
);


ALTER TABLE "public"."game_master_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_master_units" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "unit_type" "text" NOT NULL,
    "is_tamable" boolean DEFAULT false NOT NULL,
    "race" "text" DEFAULT '人間'::"text" NOT NULL,
    "job" "text" DEFAULT 'ノービス'::"text" NOT NULL,
    "base_level" integer DEFAULT 1 NOT NULL,
    "reward_exp" integer DEFAULT 10 NOT NULL,
    "reward_gold" integer DEFAULT 10 NOT NULL,
    "base_hp" integer DEFAULT 100 NOT NULL,
    "base_sp" integer DEFAULT 10 NOT NULL,
    "stat_str" integer DEFAULT 1 NOT NULL,
    "stat_agi" integer DEFAULT 1 NOT NULL,
    "stat_vit" integer DEFAULT 1 NOT NULL,
    "stat_int" integer DEFAULT 1 NOT NULL,
    "stat_dex" integer DEFAULT 1 NOT NULL,
    "stat_luk" integer DEFAULT 1 NOT NULL,
    "equip_right_hand" "text",
    "equip_left_hand" "text",
    "equip_head" "text",
    "equip_body" "text",
    "equip_arm" "text",
    "equip_foot" "text",
    "equip_accessory" "text",
    "extra_drop_item" "text",
    "extra_drop_chance" integer DEFAULT 0 NOT NULL,
    "skill_01" "text",
    "skill_02" "text",
    "skill_03" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "element" character varying(50) DEFAULT '無'::character varying,
    "size" character varying(50) DEFAULT '中型'::character varying,
    "atk_matk" integer DEFAULT 0,
    "hit_100" integer DEFAULT 100,
    "flee_95" integer DEFAULT 100,
    "is_boss" boolean DEFAULT false,
    "is_range_atk" boolean DEFAULT false,
    "equip_face" "text",
    "equip_glove" "text",
    "equip_garment" "text",
    "equip_shoes" "text",
    "resist_stun" integer DEFAULT 0 NOT NULL,
    "resist_freeze" integer DEFAULT 0 NOT NULL,
    "resist_poison" integer DEFAULT 0 NOT NULL,
    "resist_blind" integer DEFAULT 0 NOT NULL,
    "resist_sleep" integer DEFAULT 0,
    "resist_silence" integer DEFAULT 0,
    "resist_curse" integer DEFAULT 0,
    "resist_petrify" integer DEFAULT 0,
    "drop_chance_weapon" integer DEFAULT 0,
    "tame_success_chance" integer DEFAULT 0,
    "tame_level_req" integer DEFAULT 1,
    "enemy_aspd" integer,
    "extra_drop_item_2" "text",
    "extra_drop_chance_2" numeric DEFAULT 0,
    "extra_drop_item_3" "text",
    "extra_drop_chance_3" numeric DEFAULT 0,
    "reward_gold_battle" integer DEFAULT 0,
    "reward_exp_battle" integer DEFAULT 0
);


ALTER TABLE "public"."game_master_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_party_status" (
    "user_id" "uuid" NOT NULL,
    "is_exploring" boolean DEFAULT false NOT NULL,
    "current_quest_id" integer,
    "explore_start_at" timestamp with time zone,
    "explore_end_at" timestamp with time zone,
    "zeny" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."game_party_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "holiday_date" "date" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "content" "text" NOT NULL,
    "custom_answers" "jsonb",
    "status" "text" DEFAULT 'unread'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."keep_dates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "facility_user_id" "uuid",
    "shop_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "start_time" time without time zone DEFAULT '09:00:00'::time without time zone
);


ALTER TABLE "public"."keep_dates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" bigint NOT NULL,
    "floor" "text",
    "room" "text",
    "name" "text",
    "kana" "text",
    "notes" "text",
    "isBedCut" boolean DEFAULT false,
    "facility" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_selected" boolean DEFAULT false,
    "menus" "text"[] DEFAULT '{}'::"text"[],
    "facility_user_id" "uuid",
    "furigana" "text",
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."members" OWNER TO "postgres";


ALTER TABLE "public"."members" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."members_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."portal_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "en_name" "text",
    "image_url" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."portal_categories" OWNER TO "postgres";


COMMENT ON COLUMN "public"."portal_categories"."sort_order" IS 'カテゴリの表示順（数字が小さいほど先頭）';



CREATE TABLE IF NOT EXISTS "public"."portal_news" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "category" "text",
    "publish_date" "date" DEFAULT CURRENT_DATE,
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."portal_news" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."private_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "staff_id" "uuid",
    "title" "text" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."private_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "name" "text" NOT NULL,
    "price" integer DEFAULT 0,
    "stock" integer DEFAULT 0,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "business_name" "text",
    "business_type" "text",
    "business_style" "text" DEFAULT 'solo'::"text",
    "industry_id" "text",
    "description" "text",
    "address" "text",
    "phone" "text",
    "theme_color" "text" DEFAULT '#2563eb'::"text",
    "image_url" "text",
    "is_suspended" boolean DEFAULT false,
    "is_verified" boolean DEFAULT false,
    "custom_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "allow_multiple_services" boolean DEFAULT false,
    "max_last_slots" integer DEFAULT 2,
    "slot_interval_min" integer DEFAULT 15,
    "buffer_preparation_min" integer DEFAULT 0,
    "min_lead_time_hours" integer DEFAULT 0,
    "auto_fill_logic" boolean DEFAULT true,
    "extra_slots_before" integer DEFAULT 0,
    "extra_slots_after" integer DEFAULT 0,
    "business_name_kana" "text",
    "owner_name" "text",
    "owner_name_kana" "text",
    "email_contact" "text",
    "intro_text" "text",
    "notes" "text",
    "official_url" "text",
    "line_official_url" "text",
    "notify_line_enabled" boolean DEFAULT true,
    "notify_line_remind_enabled" boolean DEFAULT false,
    "line_channel_access_token" "text",
    "line_admin_user_id" "text",
    "business_hours" "jsonb" DEFAULT '{"fri": {"open": "09:00", "close": "18:00"}, "mon": {"open": "09:00", "close": "18:00"}, "sat": {"open": "09:00", "close": "18:00"}, "sun": {"open": "09:00", "close": "18:00"}, "thu": {"open": "09:00", "close": "18:00"}, "tue": {"open": "09:00", "close": "18:00"}, "wed": {"open": "09:00", "close": "18:00"}, "regular_holidays": {}}'::"jsonb",
    "mail_subject" "text" DEFAULT '【ご予約完了】{shop_name} より'::"text",
    "mail_body" "text" DEFAULT '{name} 様\n\nご予約ありがとうございます。\n以下の内容で承りました。\n\n------------------\n■日時：{date} {time}\n■メニュー：{menu}\n------------------\n\n当日のお越しを心よりお待ちしております。\n\n---\n{shop_name}\n{official_url}'::"text",
    "mail_sub_customer_booking" "text",
    "mail_body_customer_booking" "text",
    "mail_sub_customer_remind" "text",
    "mail_body_customer_remind" "text",
    "notify_mail_remind_enabled" boolean DEFAULT true,
    "mail_sub_customer_cancel" "text",
    "mail_body_customer_cancel" "text",
    "mail_sub_shop_booking" "text",
    "mail_body_shop_booking" "text",
    "mail_sub_shop_cancel" "text",
    "mail_body_shop_cancel" "text",
    "is_management_enabled" boolean DEFAULT false,
    "max_capacity" integer DEFAULT 1,
    "admin_password" "text",
    "liff_id" "text",
    "form_config" "jsonb" DEFAULT '{"notes": {"label": "その他、案内人への伝言", "enabled": true, "required": false}, "address": {"label": "訪問先の住所", "enabled": true, "required": true}, "parking": {"label": "駐車スペースの有無", "enabled": true, "required": false}, "care_notes": {"label": "お身体の状況・介助の必要性", "enabled": false, "required": false}, "building_type": {"label": "建物の種類（戸建・集合住宅）", "enabled": false, "required": false}}'::"jsonb",
    "notify_mail_enabled" boolean DEFAULT true,
    "customer_line_booking_enabled" boolean DEFAULT true,
    "customer_line_remind_enabled" boolean DEFAULT false,
    "base_address" "text",
    "minutes_per_km" integer DEFAULT 3,
    "sub_business_type" "text",
    "display_id" "text",
    "display_name" "text",
    "special_holidays" "jsonb" DEFAULT '[]'::"jsonb",
    "allow_multi_person_reservation" boolean DEFAULT true,
    "service_plan" integer DEFAULT 2,
    "is_strict_fill_mode" boolean DEFAULT false,
    "use_travel_time_logic" boolean DEFAULT true,
    "email_notifications_enabled" boolean DEFAULT true,
    "bank_name" "text",
    "bank_branch" "text",
    "bank_account_type" "text" DEFAULT '普通'::"text",
    "bank_account_number" "text",
    "bank_account_holder" "text",
    "zip_code" "text",
    "is_facility_searchable" boolean DEFAULT false,
    "role" "text" DEFAULT 'shop'::"text",
    "auto_sales_matching" boolean DEFAULT false,
    "allow_batch_matching" boolean DEFAULT false,
    "hourly_capacity_per_staff" numeric DEFAULT 2.0,
    "facility_staff_count" integer DEFAULT 1,
    "facility_visit_start" time without time zone DEFAULT '09:00:00'::time without time zone,
    "facility_visit_end" time without time zone DEFAULT '16:00:00'::time without time zone,
    "facility_visit_slots" "text"[] DEFAULT '{09:00,13:00}'::"text"[],
    "facility_lunch_start" time without time zone DEFAULT '12:00:00'::time without time zone,
    "facility_lunch_end" time without time zone DEFAULT '13:00:00'::time without time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."liff_id" IS '店舗ごとのLINE LIFF ID';



COMMENT ON COLUMN "public"."profiles"."sub_business_type" IS '業種詳細（小カテゴリ）を格納するカラム';



COMMENT ON COLUMN "public"."profiles"."hourly_capacity_per_staff" IS '訪問時の1人1時間あたりの施術可能人数';



COMMENT ON COLUMN "public"."profiles"."facility_staff_count" IS '施設訪問に同行する標準スタッフ人数';



COMMENT ON COLUMN "public"."profiles"."facility_visit_start" IS '施設訪問の受付開始時間（デフォルト）';



COMMENT ON COLUMN "public"."profiles"."facility_visit_end" IS '施設訪問の最終終了時間（この時間までに撤収する前提）';



COMMENT ON COLUMN "public"."profiles"."facility_visit_slots" IS '施設訪問画面で表示する特定の時間枠のリスト';



COMMENT ON COLUMN "public"."profiles"."facility_lunch_start" IS '施設訪問時の休憩開始時間';



COMMENT ON COLUMN "public"."profiles"."facility_lunch_end" IS '施設訪問時の休憩終了時間';



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "subscription" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regular_keep_exclusions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_user_id" "uuid",
    "shop_id" "uuid",
    "excluded_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."regular_keep_exclusions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservation_guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_id" "uuid" NOT NULL,
    "resident_id" "uuid",
    "menu_type" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "actual_fee" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reservation_guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "staff_id" "uuid",
    "customer_name" "text" NOT NULL,
    "customer_email" "text",
    "customer_phone" "text",
    "reservation_date" "date",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "total_price" integer DEFAULT 0,
    "options" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cancel_token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "remind_sent" boolean DEFAULT false,
    "res_type" "text" DEFAULT 'normal'::"text",
    "end_at" timestamp with time zone,
    "last_arrival_at" timestamp with time zone,
    "line_user_id" "text",
    "menu_name" "text",
    "total_slots" integer,
    "start_at" timestamp with time zone,
    "customer_id" "uuid",
    "zip_code" "text",
    "is_block" boolean DEFAULT false,
    "biz_type" "text"
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."reservations"."zip_code" IS '予約時の訪問先郵便番号（距離計算用）';



CREATE TABLE IF NOT EXISTS "public"."residents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid",
    "name" "text" NOT NULL,
    "name_kana" "text",
    "room_number" "text",
    "has_wheelchair" boolean DEFAULT false,
    "needs_bed_cut" boolean DEFAULT false,
    "memo" "text",
    "last_cut_date" "date",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "facility_user_id" "uuid",
    "floor" "text" DEFAULT '1F'::"text"
);


ALTER TABLE "public"."residents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "customer_id" "uuid",
    "sale_date" "date" DEFAULT CURRENT_DATE,
    "total_amount" integer DEFAULT 0,
    "payment_method" "text" DEFAULT '現金'::"text",
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "reservation_id" "uuid",
    "service_amount" integer DEFAULT 0,
    "product_amount" integer DEFAULT 0,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "tax_amount" integer DEFAULT 0,
    "discount_amount" integer DEFAULT 0,
    "visit_note" "text",
    "visit_request_id" "uuid"
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "name" "text" NOT NULL,
    "url_key" "text",
    "custom_shop_name" "text",
    "custom_description" "text",
    "custom_official_url" "text",
    "sort_order" integer DEFAULT 0,
    "allow_multiple_in_category" boolean DEFAULT true,
    "disable_categories" "text",
    "required_categories" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_adjustment_cat" boolean DEFAULT false,
    "is_product_cat" boolean DEFAULT false,
    "is_facility_only" boolean DEFAULT false,
    "biz_type" "text" DEFAULT 'all'::"text"
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid",
    "group_name" "text" DEFAULT '共通'::"text",
    "option_name" "text" NOT NULL,
    "additional_slots" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "additional_price" integer DEFAULT 0,
    "is_multiple" boolean DEFAULT false,
    "is_admin_only" boolean DEFAULT false
);


ALTER TABLE "public"."service_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "name" "text" NOT NULL,
    "slots" integer DEFAULT 0,
    "category" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "service_type" "text" DEFAULT '技術'::"text",
    "price" integer DEFAULT 0,
    "restricted_hours" "jsonb",
    "is_full_day" boolean DEFAULT false,
    "is_admin_only" boolean DEFAULT false,
    "is_sales_excluded" boolean DEFAULT false,
    "is_facility_only" boolean DEFAULT false,
    "show_on_print" boolean DEFAULT false,
    CONSTRAINT "services_slots_check" CHECK (("slots" >= 0))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


COMMENT ON COLUMN "public"."services"."is_full_day" IS 'trueの場合、許可された時間帯の全枠を埋める';



COMMENT ON COLUMN "public"."services"."is_admin_only" IS 'trueの場合、管理者による「ねじ込み予約」時のみ表示する';



CREATE TABLE IF NOT EXISTS "public"."shop_facility_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "facility_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "regular_rules" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by_type" "text" DEFAULT 'shop'::"text",
    "advance_booking_days" integer DEFAULT 0
);


ALTER TABLE "public"."shop_facility_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_ng_dates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "date" "date" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."shop_ng_dates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "name" "text" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text",
    "image_url" "text",
    "memo" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "weekly_holidays" "jsonb" DEFAULT '[]'::"jsonb",
    "concurrent_capacity" integer DEFAULT 1,
    "role_type" "text" DEFAULT 'stylist'::"text",
    "is_default_for_admin" boolean DEFAULT false
);


ALTER TABLE "public"."staffs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "item_type" "text" NOT NULL,
    "item_name" "text" NOT NULL,
    "status" "text" DEFAULT 'unhatched'::"text",
    "quantity" integer DEFAULT 1,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "hatched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visit_list_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_user_id" "uuid",
    "shop_id" "uuid",
    "member_id" bigint,
    "menu_name" "text" DEFAULT 'カット'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "scheduled_month" "text"
);


ALTER TABLE "public"."visit_list_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visit_request_residents" (
    "id" bigint NOT NULL,
    "visit_request_id" "uuid",
    "member_id" bigint,
    "menu_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."visit_request_residents" OWNER TO "postgres";


ALTER TABLE "public"."visit_request_residents" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."visit_request_residents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."visit_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid",
    "shop_id" "uuid",
    "request_date" "date" DEFAULT CURRENT_DATE,
    "scheduled_date" "date",
    "status" "text" DEFAULT 'pending'::"text",
    "is_list_confirmed" boolean DEFAULT false,
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "facility_user_id" "uuid",
    "end_date" "date",
    "visit_date_list" "jsonb",
    "start_time" time without time zone DEFAULT '09:00:00'::time without time zone,
    "parent_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visit_requests" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_adjustments"
    ADD CONSTRAINT "admin_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_display_id_key" UNIQUE ("display_id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_settings"
    ADD CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_users"
    ADD CONSTRAINT "facility_users_login_id_key" UNIQUE ("login_id");



ALTER TABLE ONLY "public"."facility_users"
    ADD CONSTRAINT "facility_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_shop_id_key" UNIQUE ("user_id", "shop_id");



ALTER TABLE ONLY "public"."game_character_cards"
    ADD CONSTRAINT "game_character_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "game_characters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_inventory"
    ADD CONSTRAINT "game_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_master_items"
    ADD CONSTRAINT "game_master_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_master_quests"
    ADD CONSTRAINT "game_master_quests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_master_skills"
    ADD CONSTRAINT "game_master_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_party_status"
    ADD CONSTRAINT "game_party_status_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."keep_dates"
    ADD CONSTRAINT "keep_dates_date_facility_user_id_shop_id_key" UNIQUE ("date", "facility_user_id", "shop_id");



ALTER TABLE ONLY "public"."keep_dates"
    ADD CONSTRAINT "keep_dates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_categories"
    ADD CONSTRAINT "portal_categories_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."portal_categories"
    ADD CONSTRAINT "portal_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_news"
    ADD CONSTRAINT "portal_news_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."private_tasks"
    ADD CONSTRAINT "private_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_display_id_key" UNIQUE ("display_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_contact_unique" UNIQUE ("email_contact");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_shop_id_subscription_key" UNIQUE ("shop_id", "subscription");



ALTER TABLE ONLY "public"."regular_keep_exclusions"
    ADD CONSTRAINT "regular_keep_exclusions_facility_user_id_shop_id_excluded_d_key" UNIQUE ("facility_user_id", "shop_id", "excluded_date");



ALTER TABLE ONLY "public"."regular_keep_exclusions"
    ADD CONSTRAINT "regular_keep_exclusions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservation_guests"
    ADD CONSTRAINT "reservation_guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."residents"
    ADD CONSTRAINT "residents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_reservation_id_key" UNIQUE ("reservation_id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_options"
    ADD CONSTRAINT "service_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_facility_connections"
    ADD CONSTRAINT "shop_facility_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_facility_connections"
    ADD CONSTRAINT "shop_facility_connections_shop_id_facility_user_id_key" UNIQUE ("shop_id", "facility_user_id");



ALTER TABLE ONLY "public"."shop_ng_dates"
    ADD CONSTRAINT "shop_ng_dates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_ng_dates"
    ADD CONSTRAINT "shop_ng_dates_shop_id_date_key" UNIQUE ("shop_id", "date");



ALTER TABLE ONLY "public"."staffs"
    ADD CONSTRAINT "staffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_character_cards"
    ADD CONSTRAINT "unique_character_slot_index" UNIQUE ("character_id", "slot_key", "slot_index");



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "unique_party_index" UNIQUE ("party_index");



ALTER TABLE ONLY "public"."shop_facility_connections"
    ADD CONSTRAINT "unique_shop_facility_pair" UNIQUE ("shop_id", "facility_user_id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "unique_visit_sale" UNIQUE ("visit_request_id");



ALTER TABLE ONLY "public"."user_items"
    ADD CONSTRAINT "user_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visit_list_drafts"
    ADD CONSTRAINT "visit_list_drafts_facility_member_month_unique" UNIQUE ("facility_user_id", "member_id", "scheduled_month");



ALTER TABLE ONLY "public"."visit_list_drafts"
    ADD CONSTRAINT "visit_list_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visit_request_residents"
    ADD CONSTRAINT "visit_request_residents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visit_requests"
    ADD CONSTRAINT "visit_requests_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_game_character_cards_char" ON "public"."game_character_cards" USING "btree" ("character_id");



CREATE INDEX "idx_game_inventory_equipped" ON "public"."game_inventory" USING "btree" ("equipped_character_id");



CREATE UNIQUE INDEX "idx_profiles_display_id" ON "public"."profiles" USING "btree" ("display_id");



CREATE INDEX "idx_reservations_customer_id" ON "public"."reservations" USING "btree" ("customer_id");



CREATE INDEX "push_subscriptions_shop_id_idx" ON "public"."push_subscriptions" USING "btree" ("shop_id");



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."visit_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_sync_facility_to_customers" AFTER UPDATE ON "public"."facility_users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_facility_to_customers"();



CREATE OR REPLACE TRIGGER "update_app_users_updated_at" BEFORE UPDATE ON "public"."app_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_adjustments"
    ADD CONSTRAINT "admin_adjustments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_settings"
    ADD CONSTRAINT "business_settings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "fk_equip_accessory_inv" FOREIGN KEY ("equip_accessory") REFERENCES "public"."game_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "fk_equip_body_inv" FOREIGN KEY ("equip_body") REFERENCES "public"."game_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "fk_equip_face_inv" FOREIGN KEY ("equip_face") REFERENCES "public"."game_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "fk_equip_garment_inv" FOREIGN KEY ("equip_garment") REFERENCES "public"."game_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "fk_equip_glove_inv" FOREIGN KEY ("equip_glove") REFERENCES "public"."game_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "fk_equip_head_inv" FOREIGN KEY ("equip_head") REFERENCES "public"."game_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "fk_equip_left_hand_inv" FOREIGN KEY ("equip_left_hand") REFERENCES "public"."game_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "fk_equip_right_hand_inv" FOREIGN KEY ("equip_right_hand") REFERENCES "public"."game_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "fk_equip_shoes_inv" FOREIGN KEY ("equip_shoes") REFERENCES "public"."game_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_character_cards"
    ADD CONSTRAINT "game_character_cards_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."game_characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "game_characters_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "public"."game_master_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."game_characters"
    ADD CONSTRAINT "game_characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_inventory"
    ADD CONSTRAINT "game_inventory_equipped_character_id_fkey" FOREIGN KEY ("equipped_character_id") REFERENCES "public"."game_characters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_inventory"
    ADD CONSTRAINT "game_inventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."game_master_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_inventory"
    ADD CONSTRAINT "game_inventory_socket_card_01_fkey" FOREIGN KEY ("socket_card_01") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_inventory"
    ADD CONSTRAINT "game_inventory_socket_card_02_fkey" FOREIGN KEY ("socket_card_02") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_inventory"
    ADD CONSTRAINT "game_inventory_socket_card_03_fkey" FOREIGN KEY ("socket_card_03") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_inventory"
    ADD CONSTRAINT "game_inventory_socket_card_04_fkey" FOREIGN KEY ("socket_card_04") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_inventory"
    ADD CONSTRAINT "game_inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_master_quests"
    ADD CONSTRAINT "game_master_quests_enemy_master_id_2_fkey" FOREIGN KEY ("enemy_master_id_2") REFERENCES "public"."game_master_units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_quests"
    ADD CONSTRAINT "game_master_quests_enemy_master_id_3_fkey" FOREIGN KEY ("enemy_master_id_3") REFERENCES "public"."game_master_units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_quests"
    ADD CONSTRAINT "game_master_quests_enemy_master_id_fkey" FOREIGN KEY ("enemy_master_id") REFERENCES "public"."game_master_units"("id");



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_equip_accessory_fkey" FOREIGN KEY ("equip_accessory") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_equip_arm_fkey" FOREIGN KEY ("equip_arm") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_equip_body_fkey" FOREIGN KEY ("equip_body") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_equip_foot_fkey" FOREIGN KEY ("equip_foot") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_equip_head_fkey" FOREIGN KEY ("equip_head") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_equip_left_hand_fkey" FOREIGN KEY ("equip_left_hand") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_equip_right_hand_fkey" FOREIGN KEY ("equip_right_hand") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_extra_drop_item_fkey" FOREIGN KEY ("extra_drop_item") REFERENCES "public"."game_master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_skill_01_fkey" FOREIGN KEY ("skill_01") REFERENCES "public"."game_master_skills"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_skill_02_fkey" FOREIGN KEY ("skill_02") REFERENCES "public"."game_master_skills"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_master_units"
    ADD CONSTRAINT "game_master_units_skill_03_fkey" FOREIGN KEY ("skill_03") REFERENCES "public"."game_master_skills"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_party_status"
    ADD CONSTRAINT "game_party_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."keep_dates"
    ADD CONSTRAINT "keep_dates_facility_user_id_fkey" FOREIGN KEY ("facility_user_id") REFERENCES "public"."facility_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."keep_dates"
    ADD CONSTRAINT "keep_dates_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_facility_user_id_fkey" FOREIGN KEY ("facility_user_id") REFERENCES "public"."facility_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."private_tasks"
    ADD CONSTRAINT "private_tasks_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."private_tasks"
    ADD CONSTRAINT "private_tasks_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staffs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regular_keep_exclusions"
    ADD CONSTRAINT "regular_keep_exclusions_facility_user_id_fkey" FOREIGN KEY ("facility_user_id") REFERENCES "public"."facility_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regular_keep_exclusions"
    ADD CONSTRAINT "regular_keep_exclusions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservation_guests"
    ADD CONSTRAINT "reservation_guests_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staffs"("id");



ALTER TABLE ONLY "public"."residents"
    ADD CONSTRAINT "residents_facility_user_id_fkey" FOREIGN KEY ("facility_user_id") REFERENCES "public"."facility_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_visit_request_id_fkey" FOREIGN KEY ("visit_request_id") REFERENCES "public"."visit_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_facility_connections"
    ADD CONSTRAINT "shop_facility_connections_facility_user_id_fkey" FOREIGN KEY ("facility_user_id") REFERENCES "public"."facility_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_facility_connections"
    ADD CONSTRAINT "shop_facility_connections_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_ng_dates"
    ADD CONSTRAINT "shop_ng_dates_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staffs"
    ADD CONSTRAINT "staffs_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_items"
    ADD CONSTRAINT "user_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_list_drafts"
    ADD CONSTRAINT "visit_list_drafts_facility_user_id_fkey" FOREIGN KEY ("facility_user_id") REFERENCES "public"."facility_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_list_drafts"
    ADD CONSTRAINT "visit_list_drafts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_list_drafts"
    ADD CONSTRAINT "visit_list_drafts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_request_residents"
    ADD CONSTRAINT "visit_request_residents_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_request_residents"
    ADD CONSTRAINT "visit_request_residents_visit_request_id_fkey" FOREIGN KEY ("visit_request_id") REFERENCES "public"."visit_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_requests"
    ADD CONSTRAINT "visit_requests_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_requests"
    ADD CONSTRAINT "visit_requests_facility_user_id_fkey" FOREIGN KEY ("facility_user_id") REFERENCES "public"."facility_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_requests"
    ADD CONSTRAINT "visit_requests_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."visit_requests"("id");



ALTER TABLE ONLY "public"."visit_requests"
    ADD CONSTRAINT "visit_requests_tenant_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all access for now" ON "public"."service_options" USING (true);



CREATE POLICY "Allow all access to customers" ON "public"."customers" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for draft" ON "public"."visit_list_drafts" USING (true);



CREATE POLICY "Allow all for members" ON "public"."members" USING (true);



CREATE POLICY "Allow all for visit_requests" ON "public"."visit_requests" USING (true);



CREATE POLICY "Allow all for visit_residents" ON "public"."visit_request_residents" USING (true);



CREATE POLICY "Allow authenticated insert" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow authenticated update" ON "public"."profiles" FOR UPDATE USING (true);



CREATE POLICY "Allow individual select own customer" ON "public"."customers" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "auth_id"));



CREATE POLICY "Allow public delete" ON "public"."reservations" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow public insert" ON "public"."reservations" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public select" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Allow public select" ON "public"."reservations" FOR SELECT USING (true);



CREATE POLICY "Allow public select staffs" ON "public"."staffs" FOR SELECT USING (true);



CREATE POLICY "Allow public update" ON "public"."reservations" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow shop owners to manage staffs" ON "public"."staffs" USING (true);



CREATE POLICY "Anyone can do anything" ON "public"."keep_dates" USING (true);



CREATE POLICY "Anyone can do anything" ON "public"."shop_ng_dates" USING (true);



CREATE POLICY "Anyone can do anything with keep_dates" ON "public"."keep_dates" USING (true);



CREATE POLICY "Anyone can do anything with keep_exclusions" ON "public"."regular_keep_exclusions" USING (true);



CREATE POLICY "Anyone can do anything with visit_requests" ON "public"."visit_requests" USING (true);



CREATE POLICY "Enable all access for authenticated users" ON "public"."portal_categories" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access for authenticated users" ON "public"."reservation_guests" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access for portal users" ON "public"."reservation_guests" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for category" ON "public"."service_categories" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for options" ON "public"."service_options" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for services" ON "public"."services" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all management for admin users" ON "public"."portal_news" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all management for authenticated users" ON "public"."private_tasks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all management for authenticated users" ON "public"."products" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all management for authenticated users" ON "public"."push_subscriptions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable delete for users based on shop_id" ON "public"."admin_adjustments" FOR DELETE USING (("auth"."uid"() = "shop_id"));



CREATE POLICY "Enable insert access for anyone" ON "public"."inquiries" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for all users" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users" ON "public"."sales" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."admin_adjustments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for owners" ON "public"."sales" FOR INSERT TO "authenticated" WITH CHECK (("shop_id" = "auth"."uid"()));



CREATE POLICY "Enable read access for all users" ON "public"."admin_adjustments" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."portal_categories" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."portal_news" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."private_tasks" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users only" ON "public"."inquiries" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for own shop" ON "public"."sales" FOR SELECT USING (("auth"."uid"() = "shop_id"));



CREATE POLICY "Enable update for all" ON "public"."profiles" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."admin_adjustments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Super Admin can do everything" ON "public"."shop_facility_connections" USING (true);



CREATE POLICY "System can insert rewards" ON "public"."user_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own favorites" ON "public"."favorites" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own favorites" ON "public"."favorites" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."app_users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own items" ON "public"."user_items" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."app_users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own favorites" ON "public"."favorites" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own items" ON "public"."user_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."app_users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their linked customers" ON "public"."customers" FOR SELECT USING ((("auth"."uid"() = "auth_id") OR ("shop_id" = "auth"."uid"())));



ALTER TABLE "public"."admin_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_coexistence" ON "public"."customers" FOR SELECT TO "authenticated" USING ((("shop_id" = "auth"."uid"()) OR ("name" IN ( SELECT "facility_users"."facility_name"
   FROM "public"."facility_users"
  WHERE ("facility_users"."id" = "auth"."uid"())))));



CREATE POLICY "customers_open_access" ON "public"."customers" FOR SELECT USING (true);



CREATE POLICY "customers_select_test" ON "public"."customers" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."facilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."keep_dates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_all_customers" ON "public"."customers" TO "authenticated" USING (("auth"."uid"() = "shop_id"));



CREATE POLICY "owner_all_private_tasks" ON "public"."private_tasks" TO "authenticated" USING (("auth"."uid"() = "shop_id"));



CREATE POLICY "owner_all_reservations" ON "public"."reservations" TO "authenticated" USING (("auth"."uid"() = "shop_id"));



CREATE POLICY "owner_all_sales" ON "public"."sales" TO "authenticated" USING (("auth"."uid"() = "shop_id"));



CREATE POLICY "owner_read_profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."portal_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portal_news" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."private_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regular_keep_exclusions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservation_guests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."residents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_coexistence" ON "public"."sales" FOR SELECT TO "authenticated" USING ((("shop_id" = "auth"."uid"()) OR ("visit_request_id" IN ( SELECT "visit_requests"."id"
   FROM "public"."visit_requests"
  WHERE ("visit_requests"."facility_user_id" = "auth"."uid"()))) OR ("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."name" IN ( SELECT "facility_users"."facility_name"
           FROM "public"."facility_users"
          WHERE ("facility_users"."id" = "auth"."uid"())))))));



CREATE POLICY "sales_open_access" ON "public"."sales" FOR SELECT USING (true);



ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_facility_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_ng_dates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staffs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visit_list_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visit_request_residents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visit_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visit_requests_coexistence" ON "public"."visit_requests" FOR SELECT TO "authenticated" USING ((("shop_id" = "auth"."uid"()) OR ("facility_user_id" = "auth"."uid"())));



CREATE POLICY "visit_requests_select_test" ON "public"."visit_requests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "visits_open_access" ON "public"."visit_requests" FOR SELECT USING (true);



CREATE POLICY "ログイン照合のための閲覧許可" ON "public"."facility_users" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "店舗スタッフは自店舗の予約のみ操作可能" ON "public"."reservations" USING ((("shop_id")::"text" = (("current_setting"('request.headers'::"text"))::json ->> 'x-shop-id'::"text")));



CREATE POLICY "店舗スタッフは自店舗の売上のみ操作可能" ON "public"."sales" USING ((("shop_id")::"text" = (("current_setting"('request.headers'::"text"))::json ->> 'x-shop-id'::"text")));



CREATE POLICY "店舗スタッフは自店舗の顧客のみ操作可能" ON "public"."customers" USING (((("shop_id")::"text" = ("auth"."uid"())::"text") OR (("shop_id")::"text" = (("current_setting"('request.headers'::"text"))::json ->> 'x-shop-id'::"text"))));



CREATE POLICY "施設ユーザーは自分の情報を更新できる" ON "public"."facility_users" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "施設情報は誰でも参照できる" ON "public"."facility_users" FOR SELECT USING (true);



CREATE POLICY "管理者による全操作を許可" ON "public"."facility_users" TO "authenticated" USING (true) WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."create_reservation_with_capacity"("p_store_id" "uuid", "p_user_id" "uuid", "p_reservation_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_reservation_with_capacity"("p_store_id" "uuid", "p_user_id" "uuid", "p_reservation_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_reservation_with_capacity"("p_store_id" "uuid", "p_user_id" "uuid", "p_reservation_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_reservation_with_capacity"("p_shop_id" "uuid", "p_customer_name" "text", "p_res_type" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_options" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_reservation_with_capacity"("p_shop_id" "uuid", "p_customer_name" "text", "p_res_type" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_options" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_reservation_with_capacity"("p_shop_id" "uuid", "p_customer_name" "text", "p_res_type" "text", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_options" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_facility_to_customers"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_facility_to_customers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_facility_to_customers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."admin_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."admin_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."app_users" TO "anon";
GRANT ALL ON TABLE "public"."app_users" TO "authenticated";
GRANT ALL ON TABLE "public"."app_users" TO "service_role";



GRANT ALL ON TABLE "public"."business_settings" TO "anon";
GRANT ALL ON TABLE "public"."business_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."business_settings" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."facilities" TO "anon";
GRANT ALL ON TABLE "public"."facilities" TO "authenticated";
GRANT ALL ON TABLE "public"."facilities" TO "service_role";



GRANT ALL ON TABLE "public"."facility_users" TO "anon";
GRANT ALL ON TABLE "public"."facility_users" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_users" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."game_character_cards" TO "anon";
GRANT ALL ON TABLE "public"."game_character_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."game_character_cards" TO "service_role";



GRANT ALL ON TABLE "public"."game_characters" TO "anon";
GRANT ALL ON TABLE "public"."game_characters" TO "authenticated";
GRANT ALL ON TABLE "public"."game_characters" TO "service_role";



GRANT ALL ON TABLE "public"."game_inventory" TO "anon";
GRANT ALL ON TABLE "public"."game_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."game_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."game_master_items" TO "anon";
GRANT ALL ON TABLE "public"."game_master_items" TO "authenticated";
GRANT ALL ON TABLE "public"."game_master_items" TO "service_role";



GRANT ALL ON TABLE "public"."game_master_quests" TO "anon";
GRANT ALL ON TABLE "public"."game_master_quests" TO "authenticated";
GRANT ALL ON TABLE "public"."game_master_quests" TO "service_role";



GRANT ALL ON TABLE "public"."game_master_skills" TO "anon";
GRANT ALL ON TABLE "public"."game_master_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."game_master_skills" TO "service_role";



GRANT ALL ON TABLE "public"."game_master_units" TO "anon";
GRANT ALL ON TABLE "public"."game_master_units" TO "authenticated";
GRANT ALL ON TABLE "public"."game_master_units" TO "service_role";



GRANT ALL ON TABLE "public"."game_party_status" TO "anon";
GRANT ALL ON TABLE "public"."game_party_status" TO "authenticated";
GRANT ALL ON TABLE "public"."game_party_status" TO "service_role";



GRANT ALL ON TABLE "public"."holidays" TO "anon";
GRANT ALL ON TABLE "public"."holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."holidays" TO "service_role";



GRANT ALL ON TABLE "public"."inquiries" TO "anon";
GRANT ALL ON TABLE "public"."inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."keep_dates" TO "anon";
GRANT ALL ON TABLE "public"."keep_dates" TO "authenticated";
GRANT ALL ON TABLE "public"."keep_dates" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON SEQUENCE "public"."members_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."members_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."members_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."portal_categories" TO "anon";
GRANT ALL ON TABLE "public"."portal_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_categories" TO "service_role";



GRANT ALL ON TABLE "public"."portal_news" TO "anon";
GRANT ALL ON TABLE "public"."portal_news" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_news" TO "service_role";



GRANT ALL ON TABLE "public"."private_tasks" TO "anon";
GRANT ALL ON TABLE "public"."private_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."private_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."regular_keep_exclusions" TO "anon";
GRANT ALL ON TABLE "public"."regular_keep_exclusions" TO "authenticated";
GRANT ALL ON TABLE "public"."regular_keep_exclusions" TO "service_role";



GRANT ALL ON TABLE "public"."reservation_guests" TO "anon";
GRANT ALL ON TABLE "public"."reservation_guests" TO "authenticated";
GRANT ALL ON TABLE "public"."reservation_guests" TO "service_role";



GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON TABLE "public"."residents" TO "anon";
GRANT ALL ON TABLE "public"."residents" TO "authenticated";
GRANT ALL ON TABLE "public"."residents" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."service_options" TO "anon";
GRANT ALL ON TABLE "public"."service_options" TO "authenticated";
GRANT ALL ON TABLE "public"."service_options" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."shop_facility_connections" TO "anon";
GRANT ALL ON TABLE "public"."shop_facility_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_facility_connections" TO "service_role";



GRANT ALL ON TABLE "public"."shop_ng_dates" TO "anon";
GRANT ALL ON TABLE "public"."shop_ng_dates" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_ng_dates" TO "service_role";



GRANT ALL ON TABLE "public"."staffs" TO "anon";
GRANT ALL ON TABLE "public"."staffs" TO "authenticated";
GRANT ALL ON TABLE "public"."staffs" TO "service_role";



GRANT ALL ON TABLE "public"."user_items" TO "anon";
GRANT ALL ON TABLE "public"."user_items" TO "authenticated";
GRANT ALL ON TABLE "public"."user_items" TO "service_role";



GRANT ALL ON TABLE "public"."visit_list_drafts" TO "anon";
GRANT ALL ON TABLE "public"."visit_list_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."visit_list_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."visit_request_residents" TO "anon";
GRANT ALL ON TABLE "public"."visit_request_residents" TO "authenticated";
GRANT ALL ON TABLE "public"."visit_request_residents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."visit_request_residents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."visit_request_residents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."visit_request_residents_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."visit_requests" TO "anon";
GRANT ALL ON TABLE "public"."visit_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."visit_requests" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































