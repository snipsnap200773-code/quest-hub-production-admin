// deploy-test 2026-09-12
// deno-lint-ignore-file no-import-prefix no-unversioned-import
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
// 🆕 プッシュ通知ライブラリを導入
import webpush from "npm:web-push@3.6.7";
// 🔐 パスワード照合用（フロント側 GeneralSettings.jsx と同じライブラリ・同じバージョン）
import bcrypt from "npm:bcryptjs@3.0.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // 🆕 x-shop-id を追記（これがないとブラウザがエラーを出します）
  // ⚠️ 2026/09/09：x-facility-token を追加しました（Step 11-3d）。
  //    施設ポータルは施設用クライアント（supabaseFacility.js）を使うようになり、
  //    全リクエストにこのヘッダーが付きます。許可リストに無いと
  //    preflight で弾かれ、施設からの通知メールが一切送れません。
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shop-id, x-facility-token',
}
// LINE通知用の定数
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

// 🆕 1. 訪問型判定キーワード
const _VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];

// 🆕 2. 訪問型専用のデフォルト文章
const VISIT_DEFAULTS = {
  booking_sub: "【予約確定】訪問確定のお知らせ",
  booking_body: "{name} 様\n\nこの度はご予約いただき、ありがとうございます。下記の内容でご予約を確定いたしました。\n\n📅 日時: {start_time}\n📍 訪問先: {address}\n📋 メニュー: {services}\n👤 担当: {staff_name}\n\nご不明点や変更等ございましたら、お気軽にご連絡ください。当日お会いできることを楽しみにしております。",
  remind_sub: "【リマインド】明日、ご指定の場所へお伺いいたします",
  remind_body: "{name} 様\n\n明日のご予約確認です。お約束の時間にお伺いいたします。\n\n📅 日時: {start_time}\n📍 訪問先: {address}\n📋 メニュー: {services}\n\n当日、道中の状況により多少前後する場合はお電話いたします。",
};

// 🆕 3. 来店型（従来通り）のデフォルト文章
const STORE_DEFAULTS = {
  booking_sub: "【予約確定】ご来店をお待ちしております",
  booking_body: "{name} 様\n\nこの度はご予約いただき、ありがとうございます。下記の内容でご予約を確定いたしました。\n\n📅 日時: {start_time}\n🏨 場所: {shop_name}\n📋 メニュー: {services}\n👤 担当: {staff_name}\n\nご不明点や変更等ございましたら、お気軽にご連絡ください。ご来店を心よりお待ちしております。",
  remind_sub: "【リマインド】明日、ご来店を心よりお待ちしております",
  remind_body: "{name} 様\n\n明日のご予約確認です。お気をつけてお越しくださいませ。\n\n📅 日時: {start_time}\n🏨 場所: {shop_name}\n📋 メニュー: {services}",
};

// index.ts の最初の方に追加
const PORTAL_URL = "https://questhub-portal.vercel.app";
const ADMIN_URL  = "https://quest-hub-admin.vercel.app";

// ⚠️ 2026/09/23【BH】：HTML に埋め込む値のエスケープ。
//    お客様の入力値（名前・備考など）にタグを書かれても、ただの文字として表示されるようにする。
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ⚠️ 2026/09/24【BH】：差出人名（from の表示名）から、メールのヘッダーを壊す文字
//    （改行・" < > \）を取り除き、40文字までにする。空になったら fallback を使う。
function safeSenderName(value: unknown, fallback = 'QUEST HUB'): string {
  return String(value ?? '')
    .replace(/[\r\n"<>\\]/g, '')
    .trim()
    .slice(0, 40) || fallback;
}

// ⚠️ 2026/09/24【BH】：件名から改行を取り除く（件名はテキストなのでエスケープはしない）
function safeSubject(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ');
}

// 💡 プレースホルダー置換用の共通関数（全項目対応版）
// ⚠️ 2026/09/23：escape = true のときは、差し込む値を HTML エスケープする（メール本文用）。
//    件名はテキストなので escape = false のまま使う（&amp; などが件名に出ないようにするため）。
function applyPlaceholders(template: string, data: Record<string, unknown> = {}, escape = false) {
  if (!template) return "";
  const d = data as Record<string, string | undefined>;
  const v = (value: string | undefined, fallback = "") => {
    const s = value || fallback;
    return escape ? escapeHtml(s) : s;
  };
  return template
    .replace(/{name}/g, v(d.customerName))
    .replace(/{furigana}/g, v(d.furigana))
    .replace(/{shop_name}/g, v(d.shopName))
    .replace(/{start_time}/g, v(d.startTime))
    .replace(/{staff_name}/g, v(d.staffName, "担当者なし"))
    .replace(/{services}/g, v(d.services))
    .replace(/{address}/g, v(d.address))
    .replace(/{parking}/g, v(d.parking))
    .replace(/{building_type}/g, v(d.buildingType))
    .replace(/{care_notes}/g, v(d.careNotes))
    .replace(/{company_name}/g, v(d.companyName))
    .replace(/{symptoms}/g, v(d.symptoms))
    .replace(/{request_details}/g, v(d.requestDetails))
    .replace(/{notes}/g, v(d.notes))
    .replace(/{details}/g, v(d.details))
    .replace(/{cancel_url}/g, v(d.cancelUrl))
    .replace(/{official_url}/g, v(d.officialUrl));
}
// 💡 LINE送信用の共通関数（三土手さん本家ロジック）
async function safePushToLine(to: string, text: string, token: string, targetName: string) {
  if (!to || !token) return null;
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
    return res.ok;
  } catch (err) {
    console.error(`[${targetName}] LINE Push Error:`, err);
    return false;
  }
}

// 🆕 プッシュ通知を送信する共通関数
async function sendPushNotification(supabase: unknown, shopId: string, title: string, body: string, url: string) {
  const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || "";
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || "";

  // 鍵の設定
  webpush.setVapidDetails('mailto:snipsnap.2007.7.3@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const client = supabase as { 
    from: (table: string) => { 
      select: (col: string) => { 
        eq: (col: string, val: string) => Promise<{ data: Array<{ subscription: string | Record<string, unknown> }> | null }> 
      }; 
      delete: () => { 
        eq: (col: string, val: unknown) => Promise<unknown> 
      } 
    } 
  };

  // 1. そのお店の「通知用住所（Subscription）」をすべて取得
  const { data: subs } = await client.from('push_subscriptions').select('subscription').eq('shop_id', shopId);
  if (!subs || subs.length === 0) return;

  // 2. 登録されている全端末（PC・スマホ等）に通知を飛ばす
  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url }));
    } catch (err) {
      console.error('[PUSH_ERROR]', err);
      const pushError = err as { statusCode?: number };
      // 無効になった古い住所（404/410エラー等）を自動削除する
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        await client.from('push_subscriptions').delete().eq('subscription', row.subscription);
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    
    // 🚀 🆕 ここから差し込み！！！ ───────────────────────────────
    const { type } = payload; // まず合言葉（type）だけをピンポイントでチェック

    // 🏆 システム内で使用するすべての正規の合言葉（ホワイトリスト）
    //
    // ⚠️ 2026/09/04 一時停止 → 2026/09/05 解除：
    //    下記4つは呼び出し元の認証チェック（JWT検証）を実装したうえで復活させました。
    //    権限判定は各 type の処理ブロック冒頭で個別に行っています。
    const allowedTypes = [
      'remind_all', 'auto_sales_batch', 'partnership_approved', 
      'partnership_requested',
      'facility_booking', 'facility_booking_update', 'facility_nudge', 'inquiry', 
      'booking', 'cancel', 'test',
      'CREATE_SHOP_FULL', 'REPAIR_AUTH', 'UPDATE_PASSWORD', 'DELETE_SHOP_FULL'
    ];

    // 🔐 特権 type（アカウント操作系）。ここに入るものは必ず権限チェックを通す
    const PRIVILEGED_TYPES = ['CREATE_SHOP_FULL', 'REPAIR_AUTH', 'UPDATE_PASSWORD', 'DELETE_SHOP_FULL'];

    // 🚨 侵入検知：もし合言葉が空っぽだったり、リストにない不審な通信（幽霊リクエスト）が来たら、ここで即座に射殺！
    if (!type || !allowedTypes.includes(type)) {
      console.log(`[GUARD] 不審なリクエスト（type: ${type}）を水際でブロックしました。メール誤爆を防ぎます。`);
      return new Response(JSON.stringify({ success: false, message: "Invalid request type" }), { status: 400, headers: corsHeaders });
    }
    // ───────────────────────────────────────────────────────────

    // 🔐 権限チェックに supabaseAdmin が必要なため、クライアント生成をここへ前倒し
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? ""; 
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 🔐 Authorization ヘッダの JWT から「誰が呼んだか」を確定させる。
    //    anon キーや service_role キーが渡された場合はユーザーが特定できないため null を返す。
    //    ⚠️ 重要：auth.users には一般ユーザー（ポータル会員）も含まれるため、
    //       「ログイン済み」だけでは通さず、必ず profiles.role まで見て判定すること。
    const resolveCaller = async () => {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) return null;

      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (userErr || !userData?.user) return null;

      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', userData.user.id)
        .maybeSingle();

      // profiles に行が無い＝一般ユーザー。role は null のままにする
      return { userId: userData.user.id, role: prof?.role ?? null };
    };

    const deny = (msg: string, status = 403) => {
      console.log(`[GUARD] ${type} を拒否しました: ${msg}`);
      return new Response(JSON.stringify({ success: false, message: msg }), { status, headers: corsHeaders });
    };

    // ⚠️ 2026/09/24【BP】：定期処理（リマインド一斉送信・深夜の自動売上確定）は、
    //    合言葉（x-cron-secret ヘッダー）が一致する呼び出しだけを通す。
    //    従来は誰でも好きなときに実行できた。
    //    呼び出し元：
    //      remind_all       … Vercel Cron（admin の vercel.json）→ api/cron/remind.ts
    //      auto_sales_batch … pg_cron（jobid 8）。合言葉は Vault の cron_secret から読む
    //    合言葉は Edge Function の CRON_SECRET・Vercel の CRON_SECRET・Vault の cron_secret の3か所で同じ値。
    const CRON_TYPES = ['remind_all', 'auto_sales_batch'];
    if (CRON_TYPES.includes(type)) {
      const expectedSecret = Deno.env.get('CRON_SECRET') ?? '';
      const givenSecret = req.headers.get('x-cron-secret') ?? '';
      if (!expectedSecret || givenSecret !== expectedSecret) {
        return deny('定期処理の合言葉が一致しません', 401);
      }
    }

    // ⚠️ 2026/09/24【BV】：施設まわりの通知は、呼び出した人が本当にその施設・店舗かを確かめる。
    //    従来は施設ID・店舗ID（どちらも URL に出ている）を知っていれば誰でも呼べ、
    //    その施設と店舗に任意の名簿の文章を書いたメールを送れた。
    //    ・施設からの呼び出し … x-facility-token を facility_sessions と照合
    //    ・店舗からの呼び出し … JWT（resolveCaller）で uid = shopId を確認
    //    ・どちらも、その施設と店舗の提携の状態を確認
    //    段階1：BV_ENFORCE = false（ログを出すだけで通す）。本番で確認後に true にする。
    const FACILITY_NOTIFY_TYPES = [
      'facility_booking', 'facility_booking_update', 'facility_nudge',
      'partnership_requested', 'partnership_approved'
    ];
    const BV_ENFORCE = false;

    if (FACILITY_NOTIFY_TYPES.includes(type)) {
      const reqShopId = String(payload.shopId ?? '');
      const reqFacilityId = String(payload.facilityId ?? '');

      // 施設トークン → 施設ID（有効期限内のものだけ）
      const facToken = req.headers.get('x-facility-token') ?? '';
      let tokenFacilityId: string | null = null;
      if (facToken) {
        const { data: sess } = await supabaseAdmin
          .from('facility_sessions')
          .select('facility_user_id')
          .eq('token', facToken)
          .gt('expires_at', new Date().toISOString())
          .limit(1)
          .maybeSingle();
        tokenFacilityId = sess?.facility_user_id ?? null;
      }

      // 施設トークンが通らなかったときだけ、店舗の JWT を見る
      let shopCaller: { userId: string; role: string | null } | null = null;
      if (!tokenFacilityId) shopCaller = await resolveCaller();

      const isFacilityCaller = !!tokenFacilityId && tokenFacilityId === reqFacilityId;
      const isShopCaller = !!shopCaller && shopCaller.role === 'shop' && shopCaller.userId === reqShopId;

      // 提携の状態
      let conn: { status: string | null; created_by_type: string | null } | null = null;
      if (reqShopId && reqFacilityId) {
        const { data } = await supabaseAdmin
          .from('shop_facility_connections')
          .select('status, created_by_type')
          .eq('shop_id', reqShopId)
          .eq('facility_user_id', reqFacilityId)
          .limit(1)
          .maybeSingle();
        conn = data;
      }

      let bvReason = '';
      if (!reqShopId || !reqFacilityId) {
        bvReason = 'shopId / facilityId がありません';
      } else if (type === 'facility_booking' || type === 'facility_booking_update') {
        if (!isFacilityCaller) bvReason = '施設本人からの呼び出しではありません';
        else if (conn?.status !== 'active') bvReason = '提携が有効ではありません';
      } else if (type === 'partnership_requested') {
        if (!isFacilityCaller) bvReason = '施設本人からの呼び出しではありません';
        else if (!(conn?.status === 'pending' && conn?.created_by_type === 'facility')) bvReason = '施設からの申請が見つかりません';
      } else if (type === 'partnership_approved') {
        if (!isFacilityCaller && !isShopCaller) bvReason = '当事者からの呼び出しではありません';
        else if (conn?.status !== 'active') bvReason = '提携が承認されていません';
      } else if (type === 'facility_nudge') {
        if (!isShopCaller) bvReason = '店舗本人からの呼び出しではありません';
        else if (conn?.status !== 'active') bvReason = '提携が有効ではありません';
      }

      // ログにはトークンの値を出さない（有無だけ）
      const bvInfo = `shop=${reqShopId} facility=${reqFacilityId} facToken=${facToken ? 'あり' : 'なし'} tokenOk=${!!tokenFacilityId} shopCaller=${shopCaller?.userId ?? 'なし'} conn=${conn?.status ?? 'なし'}`;
      if (bvReason) {
        if (BV_ENFORCE) return deny(bvReason, 401);
        console.log(`[FAC_GUARD] would reject ${type}: ${bvReason} (${bvInfo})`);
      } else {
        console.log(`[FAC_GUARD] ok ${type} by ${isFacilityCaller ? 'facility' : 'shop'} (${bvInfo})`);
      }
    }

    let caller: { userId: string; role: string | null } | null = null;
    if (PRIVILEGED_TYPES.includes(type)) {
      caller = await resolveCaller();
      // REPAIR_AUTH は「Auth アカウントが無い」状態を直す機能なので、
      // ログインできない＝JWTを持てないケースがある。ここだけは例外的に通し、
      // 処理ブロック内でサーバー側の資格情報照合を行う。
      if (type !== 'REPAIR_AUTH' && !caller) {
        return deny('ログインが必要な操作です', 401);
      }
    }

    // ─── ここから下は、検問を突破した「本物の通信」だけが通れる安全地帯 ───
    let {
              shopId, customerEmail, customerName, shopName, 
              startTime, services, shopEmail, cancelUrl, lineUserId, 
              reserve_url,
              staffName, furigana, address, parking, buildingType, careNotes,
              companyName, symptoms, requestDetails, notes, allOptions, custom_answers,
              serviceMode // 👈 🌟 🆕 追加：来店か訪問かのモードを受け取る
            } = payload;

    // ⚠️ 2026/09/23【BH】：キャンセル通知の内容を、ブラウザからの値ではなく
    //    DB から引くように変更しました。従来は payload.reservation を丸ごと信じており、
    //    ・任意の宛先へ運営ドメインからメールを送れる
    //    ・status を書き換えれば会計済みブロックを素通りできる
    //    ・任意の LINE ID へその店舗のトークンでメッセージを送れる
    //    状態でした。受け取るのは予約を特定する鍵（cancelToken / reservationId）だけです。
    let cancelRow: Record<string, unknown> | null = null;

    if (type === 'cancel') {
      const cancelToken = payload.cancelToken ?? payload.cancel_token ?? null;
      const reservationId = payload.reservationId ?? payload.reservation_id ?? null;

      if (!cancelToken && !reservationId) {
        return deny('cancelToken または reservationId が必要です', 400);
      }

      const q = supabaseAdmin
        .from('reservations')
        .select('id, shop_id, customer_name, customer_email, line_user_id, start_time, status, menu_name, options');

      const { data: row } = cancelToken
        ? await q.eq('cancel_token', String(cancelToken)).maybeSingle()
        : await q.eq('id', String(reservationId)).maybeSingle();

      if (!row) return deny('予約が見つかりません', 404);

      // 🚨 会計済みブロック。DB の値で判定する
      if (row.status === 'completed') {
        console.log(`[GUARD] 会計処理済み(completed)の予約に対するキャンセル通知をブロックしました。予約ID: ${row.id}`);
        return new Response(JSON.stringify({
          success: false,
          message: "この予約はすでに施術・会計処理が完了しているため、キャンセルできません。"
        }), { status: 400, headers: corsHeaders });
      }

      cancelRow = row;

      // 宛先・表示内容はすべて DB の行から取る（payload の値は使わない）
      shopId        = row.shop_id;
      customerEmail = row.customer_email;
      customerName  = row.customer_name;
      startTime     = row.start_time;
      lineUserId    = row.line_user_id;
      reserve_url   = `${PORTAL_URL}/shop/${row.shop_id}/reserve`;

      const opt = row.options as { people?: Array<{ services?: Array<{ name: string }> }>; services?: Array<{ name: string }> } | null;
      if (opt?.people) {
        services = opt.people.map((p) => (p.services || []).map((s) => s.name).join(', ')).join(' / ');
      } else if (opt?.services) {
        services = opt.services.map((s) => s.name).join(', ');
      } else {
        services = row.menu_name || "メニューなし";
      }
    }

    // ⚠️ 2026/09/23【BH】：予約完了通知（booking）も、ブラウザからの値ではなく
    //    DB から引くように変更しました。従来は宛先（メール・LINE ID）や
    //    入力内容をすべてブラウザが指定でき、予約を作らなくても
    //    任意の宛先へ運営ドメインから「予約確定」を装ったメールを送れる状態でした。
    //    受け取るのは予約を特定する鍵（cancelToken）だけです。
    //    ・作成から10分を過ぎた予約には送らない（同じ予約で何度も送らせないため）
    //    ・キャンセル済みの予約には送らない
    let customerPhone = '';            // 店舗宛ての電話ボタン・LINE 用
    let customerNameForCustomer = '';  // お客様宛ての名前（店舗の呼び名 admin_name を出さない）

    if (type === 'booking') {
      const bookingToken = payload.cancelToken ?? null;
      if (!bookingToken) return deny('cancelToken が必要です', 400);

      const { data: row } = await supabaseAdmin
        .from('reservations')
        .select('id, shop_id, staff_id, customer_id, customer_name, customer_email, customer_phone, line_user_id, start_time, status, menu_name, options, created_at')
        .eq('cancel_token', String(bookingToken))
        .maybeSingle();

      if (!row) return deny('予約が見つかりません', 404);
      if (row.status === 'canceled') return deny('キャンセル済みの予約です', 400);

      const createdMs = new Date(row.created_at).getTime();
      if (!Number.isFinite(createdMs) || Date.now() - createdMs > 10 * 60 * 1000) {
        return deny('通知の受付期間を過ぎています', 400);
      }

      type BookingOptions = {
        applied_shop_name?: string;
        people?: Array<{ options?: Record<string, unknown> }>;
        visit_info?: { address?: string; parking?: string; custom_answers?: Record<string, unknown> };
        form_input?: {
          furigana?: string; building_type?: string; care_notes?: string; company_name?: string;
          symptoms?: string; request_details?: string; notes?: string; service_mode?: string;
        };
      };
      const opt = (row.options ?? {}) as BookingOptions;
      const vi = opt.visit_info ?? {};
      const fi = opt.form_input ?? {};

      // 宛先・表示内容はすべて DB の行から取る（payload の値は使わない）
      shopId         = row.shop_id;
      customerName   = row.customer_name || '';          // 店舗宛て（呼び名があれば呼び名）
      customerEmail  = row.customer_email || '';
      customerPhone  = (row.customer_phone && row.customer_phone !== '---') ? row.customer_phone : '';
      lineUserId     = row.line_user_id || null;
      services       = row.menu_name || 'メニューなし';
      shopName       = opt.applied_shop_name || '';      // 空なら後段で profiles.business_name を使う
      startTime      = new Date(row.start_time).toLocaleString('ja-JP', {
                         timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit',
                         day: '2-digit', hour: '2-digit', minute: '2-digit'
                       });
      cancelUrl      = `${PORTAL_URL}/cancel?token=${encodeURIComponent(String(bookingToken))}`;
      allOptions     = (opt.people ?? [])
                         .flatMap((p) => Object.values(p.options ?? {}).flat())
                         .filter(Boolean);
      address        = vi.address || '';
      parking        = vi.parking || '';
      custom_answers = vi.custom_answers || {};
      furigana       = fi.furigana || '';
      buildingType   = fi.building_type || '';
      careNotes      = fi.care_notes || '';
      companyName    = fi.company_name || '';
      symptoms       = fi.symptoms || '';
      requestDetails = fi.request_details || '';
      notes          = fi.notes || '';
      serviceMode    = fi.service_mode || 'salon';

      // 担当者名は staffs から引く
      staffName = '';
      if (row.staff_id) {
        const { data: st } = await supabaseAdmin
          .from('staffs').select('name').eq('id', row.staff_id).maybeSingle();
        staffName = st?.name || '';
      }

      // お客様宛ての名前は customers.name から引く
      if (row.customer_id) {
        const { data: cu } = await supabaseAdmin
          .from('customers').select('name').eq('id', row.customer_id).maybeSingle();
        customerNameForCustomer = cu?.name || '';
      }
      if (!customerNameForCustomer) customerNameForCustomer = row.customer_name || '';
    }

    // ⚠️ SUPABASE_URL / SERVICE_ROLE_KEY / RESEND_API_KEY / supabaseAdmin は
    //    権限チェックのため冒頭で宣言済みです（ここでの再宣言は削除しました）

    // ==========================================
    // 🆕 パターンC：一斉リマインド送信 (本家ロジック完全維持 + カスタム対応)
    // ==========================================
// ✅【修正後：正しいコード】
if (type === 'remind_all') {
  const nowJST = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const currentHour = nowJST.getUTCHours();
  
  if (currentHour >= 20 || currentHour < 9) {
    return new Response(JSON.stringify({ 
      message: `現在は日本時間 ${currentHour}時 のため送信を控えます。9時以降に実行してください。` 
    }), { headers: corsHeaders });
  }

  const tomorrowJST = new Date(nowJST);
  tomorrowJST.setDate(tomorrowJST.getDate() + 1);
  const dateStr = tomorrowJST.toISOString().split('T')[0];

  const { data: resList, error: resError } = await supabaseAdmin
    .from('reservations')
    .select('*, profiles(*), staffs(name)')
    // ⚠️ 2026/09/24【BP】：日本時間の「明日 0:00〜23:59」で比べる（従来は UTC で、明日 9:00〜明後日 8:59 になっていた）
    .gte('start_time', `${dateStr}T00:00:00+09:00`)
    .lte('start_time', `${dateStr}T23:59:59.999+09:00`)
    .eq('remind_sent', false)
    .eq('res_type', 'normal')
    .neq('status', 'canceled')  // 👈 追加：キャンセル済みを除外
    .neq('status', 'completed'); // 👈 追加：完了済みを除外

  if (resError) throw resError;
  console.log(`[REMIND_DEBUG] 検索日: ${dateStr}, 取得: ${resList?.length || 0}件`);

  if (!resList || resList.length === 0) {
    return new Response(JSON.stringify({ message: 'リマインド対象なし' }), { headers: corsHeaders });
  }
  
  const report = [];

  // ✅ ループは「1回だけ」回します
  for (const res of resList) {
    const shop = res.profiles;
    const info = res.options?.visit_info || {};
    const resTime = new Date(res.start_time).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

    // メニュー名の組み立て
    const isMulti = res.options?.people && res.options.people.length > 1;
    const menuDisplayText = isMulti
    ? res.options.people.map((p: { services: Array<{ name: string }> }, i: number) => `${i + 1}人目: ${p.services.map((s: { name: string }) => s.name).join(', ')}`).join('\n')
    : (res.options?.services?.map((s: { name: string }) => s.name).join(', ') || res.options?.people?.[0]?.services?.map((s: { name: string }) => s.name).join(', ') || "メニューなし");

    const placeholderData = { 
      customerName: res.customer_name, 
      furigana: info.furigana || "",
      shopName: shop.business_name, 
      startTime: `${dateStr.replace(/-/g, '/')} ${resTime}〜`, 
      services: menuDisplayText, 
      staffName: res.staffs?.name || "店舗スタッフ", 
      address: info.address || shop.address || "",
      parking: info.parking || "",
      cancelUrl: `${PORTAL_URL}/shop/${shop.id}/reserve?cancel=${res.id}`,
      officialUrl: shop.custom_official_url 
    };

    let mailOk = false;
    let lineOk: unknown = false;

    // 👇 🌟 🆕 追加：この予約が「訪問」かどうかを判定して文面を切り替える
    const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];
    const isVisit = VISIT_KEYWORDS.some(k => (res.biz_type || shop.business_type || '').includes(k));
    const actionText = isVisit ? "ご指定の場所へお伺いいたします" : "ご来店をお待ちしております";
    const placeLabel = isVisit ? "📍 訪問先" : "🏨 場所";
    const placeValue = isVisit ? (info.address || shop.address || "ご指定の場所") : shop.business_name;

    // ✅ LINE IDの有無による完全仕分け
if (res.line_user_id) {
  if (shop.customer_line_remind_enabled !== false && shop.line_channel_access_token) {
    // 👇 🌟 修正：actionTextを使って文面を動的に変える
    const msg = `【${shop.business_name}】\n明日 ${resTime} に${actionText}。\n\n👤 お名前：${res.customer_name} 様\n👤 担当：${res.staffs?.name || '店舗スタッフ'}\n📋 内容：\n${menuDisplayText}\n\nよろしくお願いいたします。`;
    lineOk = await safePushToLine(res.line_user_id, msg, shop.line_channel_access_token, "REMIND");
  }
} else {
      // Web予約の場合（メールアドレスがあればメールを送る）
      if (shop.notify_mail_remind_enabled !== false && res.customer_email) {
        // 👇 🌟 修正：actionTextとplaceLabelを使って文面を動的に変える
        const subject = safeSubject(applyPlaceholders(shop.mail_sub_customer_remind || `【リマインド】明日、${actionText}（${shop.business_name}）`, placeholderData));
        const html = `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px;">
            <h2 style="color: #2563eb;">明日、${actionText}</h2>
            <p>${escapeHtml(res.customer_name)} 様</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="margin: 5px 0;">📅 <strong>日時:</strong> ${dateStr.replace(/-/g, '/')} ${resTime}〜</p>
              <p style="margin: 5px 0;">📋 <strong>内容:</strong><br>${escapeHtml(menuDisplayText).replace(/\n/g, '<br>')}</p>
              <p style="margin: 5px 0;">${placeLabel}<strong>:</strong> ${escapeHtml(placeValue)}</p>
            </div>
          </div>`;

const mRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
              body: JSON.stringify({ from: `${safeSenderName(shop.business_name)} <infec@snipsnap.biz>`, to: [res.customer_email], subject, html })
            });
            mailOk = mRes.ok;
          }
        }

// 送信処理（LINEまたはメール）が終わった後に1回だけDBを更新
        await supabaseAdmin.from('reservations').update({ remind_sent: true }).eq('id', res.id);
        report.push({ id: res.id, email: mailOk, line: lineOk });
      } // ここでループ終了
 
  return new Response(JSON.stringify({ report }), { status: 200, headers: corsHeaders });
}

// ==========================================
// 🆕 パターンN：自動売上確定（深夜一括処理用）
// ==========================================
if (type === 'auto_sales_batch') {
  const nowJST = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const todayStr = nowJST.toISOString().split('T')[0]; // 今日の日付 "2026-04-17"

  console.log(`[AUTO_SALES] 開始: ${todayStr} 以前の未処理をスキャンします`);

  const { data: shops } = await supabaseAdmin
    .from('profiles')
    .select('id, business_name')
    .eq('auto_sales_matching', true);

  if (!shops || shops.length === 0) {
    return new Response(JSON.stringify({ message: '対象店舗なし' }), { headers: corsHeaders });
  }

  const results = [];

  for (const shop of shops) {
    // ✅ 修正：今日より前（lt = less than）の未完了予約をすべて取得
    const { data: tasks, error: taskError } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('shop_id', shop.id)
      // ⚠️ 2026/09/24【BP】：日本時間の「今日 0:00」より前（＝昨日まで）で比べる（従来は UTC で、今日の 8:59 までが対象になっていた）
      .lt('start_time', `${todayStr}T00:00:00+09:00`) // 今日より前のデータ
      .neq('status', 'completed')
      .neq('status', 'canceled')
      .or('is_block.is.null,is_block.eq.false')
      .eq('res_type', 'normal');

    if (taskError || !tasks || tasks.length === 0) continue;

    let processedCount = 0;

    for (const task of tasks) {
      const opt = typeof task.options === 'string' ? JSON.parse(task.options) : (task.options || {});
      const items = opt.services || (opt.people ? opt.people.flatMap((p: { services?: Array<{ price?: number | string }> }) => p.services || []) : []);
      const subItems = Object.values(opt.options || {}) as Array<{ additional_price?: number | string }>;

      const basePrice = items.reduce((sum: number, i: { price?: number | string }) => sum + (Number(i.price) || 0), 0);
      const optPrice = subItems.reduce((sum: number, o: { additional_price?: number | string }) => sum + (Number(o.additional_price) || 0), 0);
      const finalPrice = basePrice + optPrice;

      // A. 売上テーブル(sales)へ追加
      await supabaseAdmin.from('sales').upsert({
        shop_id: shop.id,
        reservation_id: task.id,
        customer_id: task.customer_id,
        total_amount: finalPrice,
        // ⚠️ 2026/09/24【BP】：売上日は日本時間の日付にする（従来は UTC の日付で、0:00〜8:59 の予約が前日扱いになっていた）
        sale_date: new Date(new Date(task.start_time).getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0], // 予約日の日付で計上
        details: { ...opt, note: 'Edge Functionによる深夜自動確定' }
      }, { onConflict: 'reservation_id' });

      // B. 予約ステータスを完了に更新
      await supabaseAdmin.from('reservations').update({
        status: 'completed',
        total_price: finalPrice
      }).eq('id', task.id);

      processedCount++;
    }
    results.push({ shopName: shop.business_name, processed: processedCount });
  }

  return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: corsHeaders });
}

// ⚠️ 2026/09/23【BH】【BM】：type 'signup_otp' を廃止しました。
//    認証コードをブラウザが作り、ブラウザで照合していたため本人確認になっておらず、
//    宛先とコードをブラウザが指定できたため、運営ドメインから任意の宛先へ
//    「認証コード」を装ったメールを送れる状態でした。
//    新規登録の本人確認は Supabase Auth のメール確認（Confirm email）で行います。

// ==========================================
// 🆕 【ここを新しく追加！】パターンH：提携完了（承認）通知 
// ==========================================
if (type === 'partnership_approved') {
  // ⚠️ 2026/09/12：宛先と名前をブラウザからの値ではなくDBから引くように変更しました。
  //    従来は payload の shopEmail / facilityEmail をそのまま宛先にしていたため、
  //    anon キーを持つ誰もが、運営ドメインから任意の宛先へメールを送れる状態でした。
  const { shopId, facilityId } = payload;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? "";
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. 通知設定・宛先・名前をすべてDBから取得する
  const { data: sData } = await supabaseAdmin
    .from('profiles')
    .select('email_notifications_enabled, email_contact, business_name')
    .eq('id', shopId).single();
  const { data: fData } = await supabaseAdmin
    .from('facility_users')
    .select('email_notifications_enabled, email, facility_name')
    .eq('id', facilityId).single();

  const shopEmail = sData?.email_contact ?? '';
  const shopName = sData?.business_name ?? '店舗';
  const facilityEmail = fData?.email ?? '';
  const facilityName = fData?.facility_name ?? '施設';

  // メール送信用の共通テンプレート関数
  const sendEmail = async (to: string, roleName: string, partnerName: string, targetUrl: string) => {
    return await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'QUEST HUB 通知センター <infec@snipsnap.biz>',
        to: [to],
        subject: `【提携成立】${partnerName} 様との提携が完了しました！`,
        html: `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #4f46e5; padding: 25px; border-radius: 12px; border-top: 8px solid #4f46e5;">
            <h2 style="color: #4f46e5; margin-top: 0; text-align: center;">🎉 提携おめでとうございます！</h2>
            <p><strong>${roleName} 様</strong></p>
            <p><strong>${partnerName} 様</strong> との提携が正式に完了しました。</p>
            <div style="background: #f5f3ff; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
              <p style="margin-bottom: 15px; font-size: 0.9rem; color: #4338ca;">これから名簿の共有や、システムを通じた訪問予約が可能になります。</p>
              <a href="${targetUrl}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">管理画面を確認する</a>
            </div>
            <p style="font-size: 0.8rem; color: #94a3b8; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
              QUEST HUB は円滑な施設訪問と質の高いサービス提供を応援します。
            </p>
          </div>`
      })
    });
  };

  // 2. 施設側へ送信（設定がONの場合のみ）
  if (fData?.email_notifications_enabled !== false && facilityEmail) {
    await sendEmail(facilityEmail, facilityName, shopName, `${ADMIN_URL}/facility-login/${facilityId}`);
  }

  // 3. 店舗側へ送信（設定がONの場合のみ）
  if (sData?.email_notifications_enabled !== false && shopEmail) {
    await sendEmail(shopEmail, shopName, facilityName, `${ADMIN_URL}/admin/${shopId}/facilities`);
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
}

// ==========================================
// 🆕 2026/09/12 追加：提携リクエスト通知（施設 → 店舗）
//    FacilityFindShops_PC が type: 'partnership_requested' で呼んでいたが、
//    許可リストにも分岐にも無く、店舗に申請が通知されていなかった。
// ==========================================
if (type === 'partnership_requested') {
  const { shopId, facilityId } = payload;

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  // 宛先・名前はすべてDBから引く（ブラウザからの値は使わない）
  const { data: sData } = await supabaseAdmin
    .from('profiles')
    .select('email_notifications_enabled, email_contact, business_name')
    .eq('id', shopId).single();
  const { data: fData } = await supabaseAdmin
    .from('facility_users')
    .select('facility_name, furigana')
    .eq('id', facilityId).single();

  const shopEmail = sData?.email_contact ?? '';
  const shopName = sData?.business_name ?? '店舗';
  const facilityName = fData?.facility_name ?? '施設';
  const facilityFurigana = fData?.furigana ?? '';

  if (sData?.email_notifications_enabled !== false && shopEmail) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'QUEST HUB 通知センター <infec@snipsnap.biz>',
        to: [shopEmail],
        subject: `【提携リクエスト】${facilityName} 様から申請が届いています`,
        html: `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #f59e0b;">
            <h2 style="color: #b45309; margin-top: 0;">🤝 新しい提携リクエスト</h2>
            <p><strong>${shopName} 様</strong></p>
            <p>施設より提携のリクエストが届いています。内容をご確認のうえ、承認または見送りのご対応をお願いいたします。</p>

            <div style="background: #fffbeb; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #fde68a;">
              <p style="margin: 0;"><b>■ 申請元の施設:</b> ${facilityName} 様${facilityFurigana ? `（${facilityFurigana}）` : ''}</p>
            </div>

            <p style="font-size: 0.9rem;">管理画面の「施設連携」から承認できます。承認すると、施設の入居者名簿の共有と訪問予約が可能になります。</p>

            <div style="text-align: center; margin-top: 20px;">
              <a href="${ADMIN_URL}/admin/${shopId}/facilities" style="display: inline-block; background: #b45309; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">管理画面で確認する</a>
            </div>

            <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 25px; border-top: 1px solid #eee; padding-top: 15px;">
              ※本メールは送信専用のシステムより自動送信されています。
            </p>
          </div>`
      })
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
}

// ==========================================
// 🆕 【ここから追加】パターンI：施設訪問予約完了通知（一括予約対応）
// ==========================================
if (type === 'facility_booking') {
  // ⚠️ 2026/09/12：宛先と名前を、ブラウザからの値ではなくDBから引くように変更しました。
  //    従来は payload の shopEmail / facilityEmail をそのまま宛先にしていたため、
  //    anon キーを持つ誰もが、運営ドメインから任意の宛先へメールを送れる状態でした。
  const { 
    scheduledDates, // 配列: ["2026-03-27", "2026-03-28"]
    residentListText,
    shopId,
    facilityId
  } = payload;
  // ⚠️ 2026/09/24【BH】：人数は数値にしてから使う（HTML への差し込み対策）
  const residentCount = Number(payload.residentCount) || 0;

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  const { data: sData } = await supabaseAdmin
    .from('profiles')
    .select('email_contact, business_name')
    .eq('id', shopId).single();
  const { data: fData } = await supabaseAdmin
    .from('facility_users')
    .select('email, facility_name')
    .eq('id', facilityId).single();

  const shopEmail = sData?.email_contact ?? '';
  const shopName = sData?.business_name ?? '店舗';
  const facilityEmail = fData?.email ?? '';
  const facilityName = fData?.facility_name ?? '施設';

  // 日付リストを読みやすく整形
  const dateListHtml = scheduledDates.map((d: string) => {
    // 🚀 秒数（:00）を削除し、ハイフンをスラッシュに変換
    const cleanedDate = escapeHtml(String(d).replace(/-/g, '/'));
    return `<span style="display:inline-block; background:#3d2b1f; color:#fff; padding:4px 10px; border-radius:4px; margin:2px; font-weight:bold;">${cleanedDate}</span>`;
  }).join(' ');

  // 1. 店舗様への通知（新着予約確定）
  if (shopEmail) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'QUEST HUB 通知センター <infec@snipsnap.biz>',
      to: [shopEmail],
      subject: `【新着】${facilityName} 様より訪問予約（${residentCount}名）が入りました`,
      html: `
        <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #c5a059;">
          <h2 style="color: #3d2b1f; margin-top: 0;">📅 新しい訪問予約（確定）</h2>
          <p><strong>${shopName} 様</strong></p>
          <p>提携施設より訪問予約が確定しましたのでお知らせいたします。</p>
          
          <div style="background: #fcfaf7; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #f0e6d2;">
            <p style="margin: 0 0 10px 0;"><b>■ 施設名:</b> ${facilityName} 様</p>
            <p style="margin: 0 0 10px 0;"><b>■ 訪問予定日 (${scheduledDates.length}日間):</b><br>${dateListHtml}</p>
            <p style="margin: 0;"><b>■ 施術希望人数:</b> ${residentCount} 名</p>
          </div>

          <div style="margin-bottom: 20px; padding: 15px; background: #fff; border: 1px solid #eee; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #948b83; font-weight: bold;">利用者様リスト:</p>
            <pre style="margin: 0; font-family: inherit; font-size: 0.9rem; color: #3d2b1f;">${escapeHtml(residentListText)}</pre>
          </div>

          <div style="text-align: center;">
            <a href="${ADMIN_URL}/admin/${shopId}/reservations" style="display: inline-block; background: #3d2b1f; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">管理画面で詳細を確認する</a>
          </div>
        </div>`
    })
  });
  }

  // 2. 施設様への通知（サンクスメール）
  if (facilityEmail) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${safeSenderName(shopName)} <infec@snipsnap.biz>`,
        to: [facilityEmail],
        subject: `【QUEST HUB】訪問予約（${scheduledDates.length}日間）を承りました`,
        html: `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px;">
            <h2 style="color: #c5a059; margin-top: 0;">✅ 訪問予約を承りました</h2>
            <p><strong>${facilityName} 様</strong></p>
            <p>いつも大変お世話になっております。${shopName} です。</p>
            <p>以下の内容で訪問予約を承りました。当日お伺いできるのを楽しみにしております。</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;"><b>■ 訪問先:</b> ${shopName}</p>
              <p style="margin: 0 0 10px 0;"><b>■ 訪問予定日:</b><br>${dateListHtml}</p>
              <p style="margin: 0;"><b>■ 希望人数:</b> ${residentCount} 名</p>
            </div>

            <p style="font-size: 0.9rem;">予約の内容はポータルの「予約状況・進捗管理」からいつでもご確認いただけます。</p>
            <div style="text-align: center; margin-top: 20px;">
              <a href="${ADMIN_URL}/facility-login/${facilityId}" style="display: inline-block; background: #c5a059; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">ポータルへログイン</a>
            </div>

            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 5px 0;">⚠️ ※本メールは送信専用のシステムより自動送信されています。このメールに直接返信することはできません。</p>
              <p style="margin: 0;">✉️ <b>${shopName} 様への直接のご連絡・ご相談：</b><br>
                急なご連絡や調整等は、以下の店舗直通アドレスへ直接メールをお送りください。<br>
                👉 <a href="mailto:${shopEmail}" style="color: #c5a059; font-weight: bold; text-decoration: underline;">${shopEmail}</a>
              </p>
            </div>
          </div>`
      })
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
}

// 🚀 🆕 ここに差し込みます！！ ==========================================
if (type === 'facility_booking_update') {
  // ⚠️ 2026/09/12：宛先と名前を、ブラウザからの値ではなくDBから引くように変更しました。
  //    理由は facility_booking と同じです。
  const { 
    scheduledDates, residentListText, shopId, facilityId
  } = payload;
  // ⚠️ 2026/09/24【BH】：人数は数値にしてから使う（HTML への差し込み対策）
  const residentCount = Number(payload.residentCount) || 0;
  const addedCount = Number(payload.addedCount) || 0;

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  const { data: sData } = await supabaseAdmin
    .from('profiles')
    .select('email_contact, business_name')
    .eq('id', shopId).single();
  const { data: fData } = await supabaseAdmin
    .from('facility_users')
    .select('email, facility_name')
    .eq('id', facilityId).single();

  const shopEmail = sData?.email_contact ?? '';
  const shopName = sData?.business_name ?? '店舗';
  const facilityEmail = fData?.email ?? '';
  const facilityName = fData?.facility_name ?? '施設';

  // 日付リストを整形（既存のロジックと同じ）
  const dateListHtml = scheduledDates.map((d: string) => {
    const cleanedDate = escapeHtml(String(d).replace(/-/g, '/'));
    return `<span style="display:inline-block; background:#0ea5e9; color:#fff; padding:4px 10px; border-radius:4px; margin:2px; font-weight:bold;">${cleanedDate}</span>`;
  }).join(' ');

  // 1. 店舗様への通知（名簿の追加・修正）
  if (shopEmail) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'QUEST HUB 通知センター <infec@snipsnap.biz>',
      to: [shopEmail],
      subject: `【名簿の追加・修正】${facilityName} 様（合計${residentCount}名）`,
      html: `
        <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #0ea5e9;">
          <h2 style="color: #0ea5e9; margin-top: 0;">📝 名簿の追加・修正通知</h2>
          <p><strong>${shopName} 様</strong></p>
          <p>提携施設より訪問予約の名簿に<strong>追加または時間の修正</strong>がありました。</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #bae6fd;">
            <p style="margin: 0 0 10px 0;"><b>■ 施設名:</b> ${facilityName} 様</p>
            <p style="margin: 0 0 10px 0;"><b>■ 訪問予定日:</b><br>${dateListHtml}</p>
            <p style="margin: 0;"><b>■ 合計人数:</b> ${residentCount} 名（今回追加：${addedCount}名）</p>
          </div>

          <div style="margin-bottom: 20px; padding: 15px; background: #fff; border: 1px solid #eee; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #64748b; font-weight: bold;">更新後の最新名簿（内訳）:</p>
            <pre style="margin: 0; font-family: inherit; font-size: 0.9rem; color: #1e293b;">${escapeHtml(residentListText)}</pre>
          </div>

          <div style="text-align: center;">
            <a href="${ADMIN_URL}/admin/${shopId}/reservations" style="display: inline-block; background: #0ea5e9; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">管理画面で詳細を確認する</a>
          </div>
          <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 20px; text-align: center;">※本日のタスク（名簿）を最新の状態に更新してください。</p>
        </div>`
    })
  });
  }

  // 2. 施設様への通知（修正受付メール）
  if (facilityEmail) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${safeSenderName(shopName)} <infec@snipsnap.biz>`,
        to: [facilityEmail],
        subject: `【QUEST HUB】予約内容の追加・修正を承りました`,
        html: `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px;">
            <h2 style="color: #0ea5e9; margin-top: 0;">✅ 修正を承りました</h2>
            <p><strong>${facilityName} 様</strong></p>
            <p>いつもお世話になっております。${shopName} です。</p>
            <p>予約内容の追加・時間の変更を承りました。最新の状況をお知らせいたします。</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;"><b>■ 訪問先:</b> ${shopName}</p>
              <p style="margin: 0 0 10px 0;"><b>■ 訪問予定日:</b><br>${dateListHtml}</p>
              <p style="margin: 0;"><b>■ 合計人数:</b> ${residentCount} 名</p>
            </div>

            <p style="font-size: 0.9rem;">更新後の内容は「予約状況・進捗管理」からご確認いただけます。</p>
            <div style="text-align: center; margin-top: 20px;">
              <a href="${ADMIN_URL}/facility-login/${facilityId}" style="display: inline-block; background: #0ea5e9; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">ポータルへログイン</a>
            </div>

            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 5px 0;">⚠️ ※本メールは送信専用のシステムより自動送信されています。このメールに直接返信することはできません。</p>
              <p style="margin: 0;">✉️ <b>${shopName} 様への直接のご連絡：</b><br>
                👉 <a href="mailto:${shopEmail}" style="color: #0ea5e9; font-weight: bold; text-decoration: underline;">${shopEmail}</a>
              </p>
            </div>
          </div>`
      })
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
}
// 🏢 ここまで追加 ======================================================

// ==========================================
// 🚀 🆕 パターンP：施設への「つつく」通知（店舗名・店主名の完全反映版）
// ==========================================
if (type === 'facility_nudge') {
  // ペイロードから shopName と ownerName を直接受け取ります
  // ⚠️ 2026/09/24【BH】：店舗名・店主名はブラウザの値を受け取らず、DB の値だけを使う
  const { shopId, facilityId, keepDate } = payload;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? "";
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 念のためDBからも取得を試みます
  // ⚠️ 2026/09/05 修正：profiles に 'email' カラムは存在しないため削除しました。
  //    存在しない列を指定していたため、このクエリは常に失敗し shop が null になっていました。
  const [shopRes, facRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('business_name, owner_name, email_contact').eq('id', shopId).single(),
    supabaseAdmin.from('facility_users').select('facility_name, email').eq('id', facilityId).single()
  ]);

  const shop = shopRes.data;
  const facility = facRes.data;

  if (!facility?.email) throw new Error('施設側のメールアドレスが登録されていません');

  const displayDate = String(keepDate ?? '').replace(/-/g, '/');
  
  // ⚠️ 2026/09/24【BH】：名前は DB の値だけを使う（従来はブラウザの値を優先していた）
  const finalShopName = shop?.business_name || "店舗管理者";
  const finalOwnerName = shop?.owner_name || "担当者";

  // HTML に入れる値（エスケープ済み）
  const hDate = escapeHtml(displayDate);
  const hShop = escapeHtml(finalShopName);
  const hOwner = escapeHtml(finalOwnerName);
  const hFacility = escapeHtml(facility.facility_name);
  // ⚠️ 2026/09/24【BH】：店舗の連絡先は DB の値だけ（ブラウザの shopEmail は使わない）
  const shopContact = shop?.email_contact || '';
  const hShopContact = escapeHtml(shopContact);

  const subject = safeSubject(`【重要】${displayDate} 訪問予約の名簿作成と確定のお願い`);
  const html = `
    <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #be123c;">
      <h2 style="color: #be123c; margin-top: 0;">⚠️ 確定期限が近づいています</h2>
      <p><strong>${hFacility} 様</strong></p>
      <p>いつも大変お世話になっております。<strong>${hShop}</strong> の ${hOwner} です。</p>
      
      <p>確保いただいております以下の日程につきまして、まだ名簿の作成と予約確定が完了しておりません。</p>
      
      <div style="background: #fff5f5; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #feb2b2; text-align: center;">
        <p style="margin: 0; font-size: 0.9rem; color: #be123c;">訪問予定日</p>
        <p style="margin: 5px 0; font-size: 1.5rem; font-weight: 900; color: #3d2b1f;">${hDate}</p>
      </div>

      <p>スタッフ手配の兼ね合いもございますので、お忙しいところ恐縮ですが、至急ポータル画面よりお手続きをお願いいたします。</p>
      
      <div style="text-align: center; margin-top: 25px;">
        <a href="${ADMIN_URL}/facility-login/${facilityId}" style="display: inline-block; background: #3d2b1f; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">管理画面へログインして確定する</a>
      </div>

      <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 0.8rem; color: #64748b; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">⚠️ ※本メールは送信専用アドレスより自動送信されています。このままご返信いただいても店舗には届きません。</p>
        <p style="margin: 0;">✉️ <b>本件に関するお問い合わせ（${hShop}）：</b><br>
          👉 <a href="mailto:${hShopContact}" style="color: #3d2b1f; font-weight: bold; text-decoration: underline;">${hShopContact}</a>
        </p>
      </div>
    </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      // 🚀 🆕 送信者名(from)を店舗名（SnipSnapなど）に変更しました
      from: `${safeSenderName(finalShopName)} <infec@snipsnap.biz>`,
      to: [facility.email],
      reply_to: shop?.email_contact,
      subject,
      html
    })
  });

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
}

// ==========================================
// 🚀 🆕 【バトン対応版】パターンJ：お問い合わせ通知
// ==========================================
if (type === 'inquiry') {
  const { 
    shopId, 
    name, 
    shopName: reqShopName, // 🚀 🆕 追加：フロントから届いた屋号
    email: customerEmail, 
    phone: customerPhone, 
    content, 
    custom_answers 
  } = payload;

  // ⚠️ 2026/09/24【BH】：お問い合わせ通知の安全対策
  //    ・差出人名と件名を safeSenderName / safeSubject で整える（ヘッダーの改ざん防止）
  //    ・HTML に入れる値はすべてエスケープする
  //    ・お客様への自動返信には「お問い合わせ内容」を載せない。
  //      宛先（email）をブラウザが決められるため、内容を載せると
  //      他人のアドレスへ店舗名で任意の文章を送れてしまう（フィッシングの踏み台）。
  //    ・SUPABASE_URL などは冒頭で宣言済みのため、ここでの再宣言は削除した。
  if (!shopId) return deny('shopId が指定されていません', 400);
  if (!name || !content) return deny('お名前と内容は必須です', 400);

  // 1. 店舗の設定（profile）を取得
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', shopId).maybeSingle();
  if (!profile) return deny('店舗情報が見つかりません', 404);

  // 🚀 🆕 重要：題名や送信者に使う名前を決定（届いた屋号があれば最優先、なければ店舗名）
  //    ※ 屋号をブラウザが決められる問題は【BU】で別途対応する
  const displayShopName = safeSenderName(reqShopName || profile.business_name, profile.business_name || 'QUEST HUB');

  // HTML に入れる値（エスケープ済み）
  const hShop = escapeHtml(displayShopName);
  const hName = escapeHtml(name);
  const hEmail = escapeHtml(customerEmail);
  const hPhone = escapeHtml(customerPhone);
  const hContent = escapeHtml(content).replace(/\n/g, '<br>');

  const config = profile.form_config || {};

  // --- 🚀 🆕 スイッチ(inquiry_enabled)の状態をチェックして項目を作る ---
  let fieldsHtml = `<p style="margin: 0 0 10px 0;"><b>■ お名前:</b> ${hName} 様</p>`;
  if (config.email?.inquiry_enabled && customerEmail) fieldsHtml += `<p style="margin: 0 0 10px 0;"><b>■ メール:</b> ${hEmail}</p>`;
  if (config.phone?.inquiry_enabled && customerPhone) fieldsHtml += `<p style="margin: 0 0 10px 0;"><b>■ 電話番号:</b> ${hPhone}</p>`;

  // LINE はテキストなのでエスケープしない
  let lineFieldsText = `👤 客: ${name} 様`;
  if (config.email?.inquiry_enabled && customerEmail) lineFieldsText += `\n✉️ メ: ${customerEmail}`;
  if (config.phone?.inquiry_enabled && customerPhone) lineFieldsText += `\n📞 呼: ${customerPhone}`;

  let customAnswersText = "";
  if (custom_answers && Object.keys(custom_answers).length > 0) {
    customAnswersText = Object.entries(custom_answers)
      .filter(([qid]) => {
        const q = config.custom_questions?.find((item: { id: string; inquiry_enabled?: boolean }) => item.id === qid);
        return q && q.inquiry_enabled === true;
      })
      .map(([qid, answer]) => {
        const q = config.custom_questions?.find((item: { id: string; label?: string }) => item.id === qid);
        return `${q?.label || '質問'}: ${answer}`;
      }).join('\n');
  }
  const hCustomAnswers = escapeHtml(customAnswersText).replace(/\n/g, '<br>');

  // --- ✉️ 店舗様への通知（メール） ---
  // 🚀 🆕 件名に決定した屋号（フットケアラボ等）を入れる
  const shopSubject = safeSubject(`【${displayShopName}】新着お問い合わせ（${name} 様）`);
  const shopHtml = `
    <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #4f46e5;">
      <h2 style="color: #4f46e5; margin-top: 0;">📩 新しいお問い合わせ</h2>
      <p><strong>${hShop} 様</strong></p>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
        ${fieldsHtml}
        <p style="margin: 0 0 10px 0;"><b>■ 内容:</b><br>${hContent}</p>
        ${customAnswersText ? `<p style="margin: 15px 0 0 0; border-top: 1px dashed #cbd5e1; padding-top: 10px;"><b>■ カスタム項目の回答:</b><br>${hCustomAnswers}</p>` : ''}
      </div>

      <div style="text-align: center;">
  <a href="${ADMIN_URL}/admin/${shopId}/dashboard" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">管理画面を開く</a>
</div>
    </div>`;

  if (profile.email_contact) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${displayShopName} 通知 <infec@snipsnap.biz>`, // 🚀 送信者名を屋号に（safeSenderName で整形済み）
        to: [profile.email_contact],
        subject: shopSubject,
        html: shopHtml
      })
    });
  }

  // --- ✉️ お客様への自動返信 ---
  //    ⚠️ 宛先をブラウザが決められるため、内容は載せない。名前も30文字までにする。
  if (customerEmail) {
    const hNameShort = escapeHtml(String(name).slice(0, 30));
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        // 🚀 🆕 送信者名と題名を屋号に書き換え
        from: `${displayShopName} <infec@snipsnap.biz>`,
        to: [customerEmail],
        subject: safeSubject(`【送信完了】${displayShopName} へのお問い合わせ`),
        html: `<div style="font-family: sans-serif; padding: 25px;">
                <p>${hNameShort} 様</p>
                <p>${hShop} へのお問い合わせを承りました。内容を確認次第、ご連絡いたします。</p>
                <p style="font-size: 0.85rem; color: #666;">※本メールは送信専用です。このメールに返信することはできません。</p>
              </div>`
      })
    });
  }

  // --- 💬 店舗様へのLINE通知 ---
  if (profile.line_admin_user_id && profile.line_channel_access_token) {
    const lineMsg = `【${displayShopName}】\n${lineFieldsText}\n\n内容：\n${content}\n${customAnswersText ? `\nその他：\n${customAnswersText}` : ''}\n\n${ADMIN_URL}/admin/${shopId}/dashboard`;
    await safePushToLine(profile.line_admin_user_id, lineMsg, profile.line_channel_access_token, "INQUIRY_OWNER");
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
}

// ==========================================
// 🆕 2026/09/15 追加：LINE連携のテスト送信
//    LineSettings.jsx が type: 'test' で呼んでいたが、許可リストにも
//    分岐にも無く、常に 400（Invalid request type）を返していた。
//    ★宛先・トークン・本文はすべてDBから引く（payload の値は使わない）。
// ==========================================
if (type === 'test') {
  const { shopId } = payload;
  if (!shopId) return deny('shopId が指定されていません', 400);

  const { data: sData } = await supabaseAdmin
    .from('profiles')
    .select('business_name, line_admin_user_id, line_channel_access_token')
    .eq('id', shopId).maybeSingle();

  if (!sData) return deny('店舗情報が見つかりません', 404);

  const lineToken = sData.line_channel_access_token ?? '';
  const adminId = sData.line_admin_user_id ?? '';

  if (!lineToken || !adminId) {
    return new Response(JSON.stringify({
      success: false,
      message: 'アクセストークンまたは Admin User ID が保存されていません。先に「連携設定を保存する」を押してください。'
    }), { status: 400, headers: corsHeaders });
  }

  const text = `✅ QUEST HUB：LINE連携テスト成功！\n店舗名: ${sData.business_name ?? ''}\n送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

  const ok = await safePushToLine(adminId, text, lineToken, "TEST");

  return new Response(JSON.stringify({
    success: ok === true,
    message: ok === true ? '送信しました' : 'LINE への送信に失敗しました。トークンが正しいか確認してください。'
  }), { status: ok === true ? 200 : 400, headers: corsHeaders });
}

// ==========================================
    // 🚀 🆕 パターンK：店舗アカウントの全自動発行（ここを新規追加！）
    // (Auth作成 ➔ profiles登録 ➔ ウェルカムメール送信)
    // ==========================================
    if (type === 'CREATE_SHOP_FULL') {
      // 🔐 super_admin のみ許可
      if (caller?.role !== 'super_admin') return deny('店舗発行は管理者のみが実行できます');

      const targetEmail = payload.email; // 届いたメアド
      if (!targetEmail || !String(targetEmail).includes('@')) return deny('メールアドレスが不正です', 400);
      console.log(`[CREATE_SHOP_FULL] 開始: ${targetEmail} (by ${caller.userId})`);

      // 1. Supabase Authアカウントの作成（管理者権限）
      const passwordToUse = payload.password || Math.random().toString(36).slice(-10);
      
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        password: passwordToUse,
        email_confirm: true
      });

      if (authError) throw new Error(`Auth作成失敗: ${authError.message}`);
      const userId = authData.user.id;

      // --- 📝 B. profiles テーブルの「お引っ越し」 または 「新規登録」 ---
      const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .upsert([{
          id: userId, // 🚀 ここが新しい Auth UID になる！
          business_name: payload.shopName,
          business_name_kana: payload.shopNameKana,
          owner_name: payload.ownerName,
          owner_name_kana: payload.ownerNameKana,
          email_contact: targetEmail,
          phone: payload.phone,
          business_type: payload.businessType,
          sub_business_type: payload.subBusinessType,
          admin_password: passwordToUse, // 忘れないように保存
          service_plan: 2,
          is_management_enabled: true,
          role: 'shop'
        }], { 
        onConflict: 'id' // ✅ 主キーである id を基準にします（これが一番確実です）
        });

      if (dbError) {
        // DB登録に失敗したらAuthユーザーを消してリセット
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`DB登録失敗: ${dbError.message}`);
      }

      // 3. ウェルカムメールの送信（Resend使用）
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'QUEST HUB 運営事務局 <infec@snipsnap.biz>',
          to: [targetEmail],
          subject: `【QUEST HUB】アカウント発行が完了しました（${payload.shopName}）`,
          html: `
            <div style="font-family: sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px;">
              <h2 style="color: #4f46e5; margin-top: 0;">QUEST HUB Biz へようこそ！</h2>
              <p>${payload.ownerName} 様</p>
              <p>店舗管理システム「QUEST HUB Biz」のアカウント発行が完了しました。</p>
              <div style="background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 25px 0;">
                <p style="margin: 0;"><strong>● ログインURL:</strong><br><a href="${payload.originUrl}">${payload.originUrl}</a></p>
                <p style="margin: 15px 0 0 0;"><strong>● メールアドレス:</strong><br>${targetEmail}</p>
                <p style="margin: 5px 0 0 0;"><strong>● 初期パスワード:</strong><br><span style="color: #e11d48; font-weight: bold; font-size: 1.1rem;">${passwordToUse}</span></p>
              </div>
              <p style="font-size: 0.9rem;">ログイン後、「全般設定」よりパスワードの変更をお願いいたします。</p>
            </div>`,
        }),
      });

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    // ==========================================
    // 🚀 🆕 パターンL：既存店舗の認証復旧（強制同期）
    // (Authにいない店舗を、既存のプロフィールIDのまま作成する)
    // ==========================================
    if (type === 'REPAIR_AUTH') {
      const { shopId, email, password } = payload;
      console.log(`[REPAIR_AUTH] 復旧開始: ${email} (ID: ${shopId ?? '未指定'})`);

      // 🔐 権限チェック
      //    ルート1：super_admin が管理画面から実行 → 無条件で許可
      //    ルート2：店舗本人がログイン画面から実行 → サーバー側で資格情報を照合
      const isSuper = caller?.role === 'super_admin';

      // ⚠️ 2026/09/07：shopId 未指定の呼び出しに対応しました。
      //    ログイン画面（FacilityLogin）は profiles を直接読まなくなったため、
      //    店舗IDを知りません。email_contact からサーバー側で店舗を特定します。
      //    ※ SuperAdmin からの呼び出しは従来どおり shopId を送ってきます。
      if (!shopId && !email) return deny('shopId または email が必要です', 400);

      const lookup = supabaseAdmin
        .from('profiles')
        .select('id, email_contact, admin_password, hashed_password, role');

      const { data: target } = shopId
        ? await lookup.eq('id', shopId).maybeSingle()
        : await lookup.eq('email_contact', String(email).trim()).maybeSingle();

      // 🔐 存在しない場合も、パスワード不一致と同じ文言を返す。
      //    メールアドレスの存在有無を推測されないようにするため。
      if (!target) {
        if (isSuper) return deny('対象の店舗が見つかりません', 404);
        return deny('メールアドレスまたはパスワードが一致しません');
      }
      // 🚨 救済ルートで管理者アカウントを作らせない（権限昇格の防止）
      if (target.role === 'super_admin' && !isSuper) return deny('この操作は許可されていません');

      // ⚠️ 2026/09/07：パスワード照合を bcrypt 対応にしました（ハイブリッド方式）。
      //    ・hashed_password があれば bcrypt で比較する
      //    ・無ければ従来どおり admin_password の平文比較を行い、
      //      成功したその場でハッシュ化して移行する（B-5 の自動移行を兼ねる）
      //    移行が完了すると admin_password は '********' になるため、
      //    平文比較のルートは自然に使われなくなります。
      let isPlainMatch = false;

      if (!isSuper) {
        // サーバー側で「メール＋パスワード」がDBの内容と一致するか照合する。
        // クライアントの申告を信用しない。
        if (String(target.email_contact ?? '').trim() !== String(email ?? '').trim()) {
          return deny('メールアドレスまたはパスワードが一致しません');
        }

        const inputPassword = String(password ?? '');

        if (target.hashed_password) {
          // 移行済み：bcrypt で照合する
          if (!bcrypt.compareSync(inputPassword, target.hashed_password)) {
            return deny('メールアドレスまたはパスワードが一致しません');
          }
        } else if (target.admin_password && target.admin_password !== '********') {
          // 未移行：平文で照合する（この経路は移行完了後に消える）
          if (String(target.admin_password) !== inputPassword) {
            return deny('メールアドレスまたはパスワードが一致しません');
          }
          isPlainMatch = true;
        } else {
          return deny('復旧に必要な情報が不足しています');
        }
      }

      // 💡 Auth の作成に使うパスワードを決める。
      //    ハッシュからは元のパスワードを復元できないため、
      //    ・平文が残っていればそれを使う
      //    ・移行済みの場合は、照合を通った payload のパスワードを採用する
      //      （bcrypt.compareSync が通っている＝正しいパスワードだと確認済み）
      const passwordForAuth = (target.admin_password && target.admin_password !== '********')
        ? target.admin_password
        : String(password ?? '');

      if (!passwordForAuth) return deny('復旧に必要な情報が不足しています');

      // 💡 管理者権限（合鍵）を使って、IDを指定してAuthユーザーを作成
      const { data: _authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        id: target.id,               // 👈 これが最重要！DB側のProfilesと同じIDで作成します
        email: target.email_contact, // 👈 DB側の値を採用
        password: passwordForAuth,
        email_confirm: true          // 確認メールをスキップ
      });

      if (authError) {
        console.error('[REPAIR_AUTH] 作成失敗:', authError.message);
        return new Response(JSON.stringify({ error: authError.message }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // 🔐 平文で照合が通った場合、この機会にハッシュへ移行する（B-5 の自動移行）
      //    admin_password を '********' で潰すことで、平文の残存をなくす。
      if (isPlainMatch) {
        try {
          const salt = bcrypt.genSaltSync(10);
          const hashed = bcrypt.hashSync(String(password ?? ''), salt);
          await supabaseAdmin
            .from('profiles')
            .update({ hashed_password: hashed, admin_password: '********' })
            .eq('id', target.id);
          console.log(`[REPAIR_AUTH] パスワードをハッシュへ移行しました: ${email}`);
        } catch (migErr) {
          // 移行に失敗しても復旧自体は成功しているため、処理は続行する
          console.error('[REPAIR_AUTH] ハッシュ移行に失敗:', migErr);
        }
      }

      console.log(`[REPAIR_AUTH] 復旧成功: ${email}`);
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, headers: corsHeaders 
      });
    }

    // 🚀 🆕 パターンM：認証パスワードの同期更新
    if (type === 'UPDATE_PASSWORD') {
      const { shopId, password } = payload;

      // 🔐 本人（JWTのユーザーIDと一致）または super_admin のみ許可
      if (!shopId) return deny('shopId が指定されていません', 400);
      const isSelf = caller?.userId === shopId;
      const isSuper = caller?.role === 'super_admin';
      if (!isSelf && !isSuper) return deny('他店舗のパスワードは変更できません');

      // 🔐 空パスワードや短すぎるパスワードでの上書き事故を防ぐ
      if (typeof password !== 'string' || password.length < 8) {
        return deny('パスワードは8文字以上で指定してください', 400);
      }

      console.log(`[UPDATE_PASSWORD] 更新開始: ID ${shopId} (by ${caller?.userId})`);

      // 管理者権限で、特定のIDのユーザー情報を更新する
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        shopId, 
        { password: password }
      );

      if (updateError) {
        console.error('[UPDATE_PASSWORD] 更新失敗:', updateError.message);
        return new Response(JSON.stringify({ error: updateError.message }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log(`[UPDATE_PASSWORD] 更新成功: ID ${shopId}`);
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, headers: corsHeaders 
      });
    }

    // 🆕 ここから追加！
    // ==========================================
    // 🆕 パターンO：店舗の完全消去（Authアカウント ＋ DBプロファイル）
    // ==========================================
    if (type === 'DELETE_SHOP_FULL') {
      const { shopId } = payload;

      // 🔐 super_admin のみ許可
      if (caller?.role !== 'super_admin') return deny('店舗削除は管理者のみが実行できます');
      if (!shopId) return deny('shopId が指定されていません', 400);
      // 🚨 自分自身と、他の管理者アカウントは消せないようにする（事故防止）
      if (shopId === caller.userId) return deny('自分自身のアカウントは削除できません');

      const { data: delTarget } = await supabaseAdmin
        .from('profiles').select('id, role').eq('id', shopId).maybeSingle();
      if (delTarget?.role === 'super_admin') return deny('管理者アカウントは削除できません');

      console.log(`[DELETE_SHOP_FULL] 開始: ID ${shopId} (by ${caller.userId})`);

      // 1. まずはログインアカウント（Auth）を削除
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(shopId);
      if (authError) {
        console.warn("Authアカウント削除失敗（既にない可能性あり）:", authError.message);
      }

      // 2. profilesテーブルから削除
      const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', shopId);

      if (dbError) {
        return new Response(JSON.stringify({ error: `DB削除失敗: ${dbError.message}` }), { status: 400, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }
    // 🆕 ここまで追加！

    // ⚠️ 2026/09/23【BH】：type 'welcome' を廃止しました。
    //    呼び出し元（旧 TrialRegistration）が無くなったうえ、
    //    宛先・パスワード・URL をすべてブラウザが指定でき、
    //    権限チェックも無かったため（誰でも運営ドメインから
    //    「ログイン情報」を装ったメールを送れる状態でした）。
    //    アカウント発行時のメールは CREATE_SHOP_FULL が送ります。

    // ==========================================
    // 🚀 パターンB・D・E：予約完了 ＆ キャンセル通知 (三土手さん指定の5パターン)
    // ==========================================
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', shopId).single();
    
    // ⚠️ 2026/09/23【BH】：キャンセル通知の店舗名も、予約の行（applied_shop_name）から取る。
    //    従来はブラウザからの値を使っており、差出人名と本文の店舗名を書き換えられた。
    //    （booking は上の DB 読み取りで設定済み）
    if (type === 'cancel') {
      const cOpt = (cancelRow?.options ?? {}) as { applied_shop_name?: string };
      shopName = cOpt.applied_shop_name || '';
    }

    // 🚀 🆕 【ここを追加！】不足している店舗情報を補完する
    if (profile) {
      // ⚠️ 2026/09/23：マルチブランドの屋号は予約の行（applied_shop_name）から取るようにしたため、
      //    ブラウザからの値は使わない。空のときだけ本体の店名を使う。
      shopName = shopName || profile.business_name;

      // ⚠️ 2026/09/23【BH】：店舗の宛先は DB の値だけにしました。
      //    従来は DB に登録が無いとブラウザからの shopEmail を宛先にしており、
      //    任意の宛先へ予約・キャンセル通知を送れる状態でした。
      //    ※ profiles に 'email' カラムは存在しないため参照をやめました（09/06）。
      shopEmail = profile.email_contact || '';
    }

    const currentToken = profile?.line_channel_access_token;
    const currentAdminId = profile?.line_admin_user_id;

const sendMail = async (to: string, isOwner: boolean) => {
      // ⚠️ 2026/09/23【BH】：キャンセル時のデータは DB から引いた cancelRow を使う
      const resData = (cancelRow ?? {}) as Record<string, unknown>;
      // ⚠️ 2026/09/23【BH】：お客様宛ては customers.name（booking で設定）を使い、
      //    店舗の呼び名（admin_name）がお客様に届かないようにする。店舗宛ては予約の名前のまま。
      const targetName = (!isOwner && customerNameForCustomer)
        ? customerNameForCustomer
        : (customerName || (resData.customer_name as string));
      const targetTime = startTime || (resData.start_time as string);
      const targetServices = services;

      // ✅ 置換用データセット
      const placeholderData = { 
        customerName: targetName, 
        shopName, 
        startTime: targetTime, 
        services: targetServices, 
        cancelUrl, 
        staffName: staffName || "店舗スタッフ",
        furigana: furigana || "", 
        address: address || "",
        parking, 
        buildingType, 
        careNotes,
        companyName, 
        symptoms, 
        requestDetails, 
        notes,
        officialUrl: profile.custom_official_url || "" 
      };      
      
      // 👇 🌟 修正：店舗の業種全体ではなく「今回の予約のモード」で判定する！
      const isVisit = serviceMode === 'visit';
      const defaults = isVisit ? VISIT_DEFAULTS : STORE_DEFAULTS;

      let finalSubject = "";
      let finalHtml = "";

      if (type === 'cancel') {
      // --- キャンセル通知（デザイン版） ---
      const d = new Date(targetTime);
      // 🚀 🆕 サーバーの時間ではなく、強制的に「日本時間」として整形する
      const dateStr = d.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(/\//g, '年').replace(' ', '日 ');

      // ⚠️ 2026/09/23【BH】：HTML に入れる値はエスケープしたものを使う（件名はそのまま）
      const hName = escapeHtml(targetName);
      const hServices = escapeHtml(targetServices);
      const hShop = escapeHtml(shopName);

        if (isOwner) {
          // 🏪 店舗様向け通知
          finalSubject = `【予約キャンセル】${targetName} 様 (${dateStr})`;
          finalHtml = `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #ef4444;">
              <h2 style="color: #ef4444; margin-top: 0;">⚠️ 予約キャンセル通知</h2>
              <p><strong>${hShop} 管理者様</strong></p>
              <p>お客様により、以下の予約がキャンセルされました。</p>
              <div style="background: #fff5f5; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #feb2b2;">
                <p style="margin: 0;">👤 <b>お客様:</b> ${hName} 様</p>
                <p style="margin: 5px 0 0;">📅 <b>予約日時:</b> ${dateStr}</p>
                <p style="margin: 5px 0 0;">📋 <b>メニュー:</b> ${hServices}</p>
              </div>
              <p style="font-size: 0.9rem; color: #64748b;">※予約枠が開放されました。必要に応じてカレンダーをご確認ください。</p>
            </div>`;
        } else {
          // 👤 お客様向け通知
          finalSubject = `【キャンセル完了】ご予約の取り消しを承りました（${shopName}）`;
          finalHtml = `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #94a3b8;">
              <h2 style="color: #475569; margin-top: 0;">キャンセル完了のお知らせ</h2>
              <p>${hName} 様</p>
              <p>下記のご予約キャンセルを承りました。ご確認をお願いいたします。</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <p style="margin: 0;">📅 <b>日時:</b> ${dateStr}</p>
                <p style="margin: 5px 0 0;">🏨 <b>店舗名:</b> ${hShop}</p>
              </div>
              <p>またのご利用をスタッフ一同、心よりお待ちしております。</p>
              <div style="text-align: center; margin-top: 25px;">
                <a href="${reserve_url || '#'}" style="display: inline-block; background: #475569; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">新しい予約を入れる</a>
              </div>
            </div>`;

          // 🚀 🆕 【ここから追加】お客様へのLINEキャンセル通知処理
          // フロントから渡された reservation データと、店舗設定(profile)を使用
          const targetLineId = lineUserId;

        if (
          targetLineId && 
          profile?.customer_line_booking_enabled && 
          profile?.line_channel_access_token
        ) {
          try {
            const lineMessage = `【キャンセル完了のお知らせ】\n\n${targetName} 様\nご予約の取り消しを承りました。\n\n📅 日時: ${dateStr}\n🏨 店舗名: ${shopName}\n\nまたのご利用をスタッフ一同、心よりお待ちしております。`;

            // 🚀 外部関数に頼らず、直接 LINE API へリクエストを送る
            await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${profile.line_channel_access_token}`
              },
              body: JSON.stringify({ // ⚠️ここのbodyはLINEの仕様なのでこのままでOK！
                to: targetLineId,
                messages: [{ type: 'text', text: lineMessage }]
              })
            });
            console.log("✅ LINEキャンセル通知送信成功:", targetLineId);
          } catch (lineErr) {
            console.error("LINEキャンセル通知失敗:", lineErr);
          }
        }
          // 🚀 🆕 【ここまで追加】
        }
      }
      else {
        // --- 予約確定通知（サンクスメール） ---
        if (isOwner) {
          // 店舗宛
          finalSubject = applyPlaceholders(profile.mail_sub_shop_booking || `【新着予約】${customerName} 様`, placeholderData);
        
        // 🆕 1. 枝メニュー（追加オプション）を箇条書きにするHTMLロジックを追加
        // allOptions が配列で届いていることを想定しています
        const optionsListHtml = allOptions && allOptions.length > 0 
          ? `<div style="margin-top: 10px; padding: 12px; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1;">
               <p style="margin: 0 0 8px 0; font-size: 0.8rem; color: #64748b; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">枝メニュー（追加オプション）:</p>
               <ul style="margin: 0; padding-left: 18px; font-size: 0.9rem; color: #1e293b; line-height: 1.5;">
                 ${allOptions.map((o: { option_name: string; additional_price?: number }) => `
                   <li style="margin-bottom: 2px;">
                     ${escapeHtml(o.option_name)} 
                     <span style="color: #d34817; font-weight: bold; font-size: 0.85rem;">
                       (+¥${Number(o.additional_price || 0).toLocaleString()})
                     </span>
                   </li>
                 `).join('')}
               </ul>
             </div>` 
          : '';

        // 🆕 2. 豪華版の店舗控えHTML
        finalHtml = `
          <div lang="ja" style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h2 style="color: #2563eb; margin-top: 0; font-size: 1.3rem; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">新着予約のお知らせ（店舗控え）</h2>
            <p style="margin: 20px 0 10px 0;">${escapeHtml(shopName)} 管理者様</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
              <p style="margin: 5px 0;">👤 <b>お客様:</b> ${escapeHtml(customerName)} 様 ${furigana ? `(${escapeHtml(furigana)})` : ''}</p>
              <p style="margin: 5px 0;">📅 <b>日時:</b> ${escapeHtml(startTime)}</p>
              <p style="margin: 5px 0;">👤 <b>担当:</b> ${escapeHtml(staffName || '指名なし')}</p>
              <p style="margin: 5px 0;">📋 <b>メニュー:</b> ${escapeHtml(services)}</p>
              
              ${optionsListHtml} 

              <div style="margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                ${customerPhone ? `
                  <a href="tel:${customerPhone}" style="display: inline-block; background: #10b981; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.85rem;">📞 電話をかける</a>
                ` : ''}
                
                ${(customerEmail && customerEmail !== 'admin@example.com') ? `
                  <a href="mailto:${escapeHtml(customerEmail)}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.85rem;">✉️ お客様へメール返信</a>
                ` : ''}
              </div>
            </div>

            <div style="margin-top: 20px; padding: 15px; border-left: 4px solid #cbd5e1; background: #fff;">
              <h3 style="margin: 0 0 10px 0; font-size: 0.9rem; color: #64748b;">📝 お客様の入力内容</h3>
              <div style="font-size: 0.9rem; color: #1e293b;">
                ${(isVisit && address) ? `
                  <p style="margin: 4px 0;">📍 <b>住所:</b> ${escapeHtml(address)}</p>
                  <div style="margin: 8px 0 15px 0;">
                    <a href="https://www.google.co.jp/maps/search/${encodeURIComponent(address)}" target="_blank" style="display: inline-block; background: #3b82f6; color: #fff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.85rem;">🗺 Googleマップで場所を確認</a>
                  </div>
                ` : ''}
                
                ${parking ? `<p style="margin: 4px 0;">🅿️ <b>駐車場:</b> ${escapeHtml(parking)}</p>` : ''}

                ${custom_answers && Object.keys(custom_answers).length > 0 ? `
                  <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 8px 0; font-size: 0.8rem; color: #64748b; font-weight: bold;">🙋 カスタム質問への回答:</p>
                    ${Object.entries(custom_answers).map(([qid, answer]) => {
                      const question = profile.form_config?.custom_questions?.find((q: { id: string; label?: string }) => q.id === qid);
                      return `<p style="margin: 4px 0; font-size: 0.9rem;">・<b>${escapeHtml(question?.label || '質問')}:</b> ${escapeHtml(answer)}</p>`;
                    }).join('')}
                  </div>
                ` : ''}

                ${notes ? `<p style="margin: 15px 0 4px 0; border-top: 1px dashed #eee; padding-top: 10px;">💬 <b>備考:</b><br>${escapeHtml(notes).replace(/\n/g, '<br>')}</p>` : ''}
              </div>
            </div>

            <div style="margin-top: 25px; text-align: center;">
  <a href="${ADMIN_URL}/admin/${shopId}/reservations" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.9rem;">予約台帳で確認する</a>
</div>
          </div>`;
        } else {
          // お客様宛（サンクスメール）
          const subTemplate = profile.mail_sub_customer_booking || defaults.booking_sub;
          const bodyTemplate = profile.mail_body_customer_booking || defaults.booking_body;
          finalSubject = applyPlaceholders(subTemplate, placeholderData);
          // ⚠️ 2026/09/23【BH】：本文は HTML なので、差し込む値をエスケープする（第3引数 true）。
          //    件名はテキストなのでエスケープしない。
          const body = applyPlaceholders(bodyTemplate, placeholderData, true).replace(/\n/g, '<br>');
          
          /* 🚀 🆕 来店型(isVisitがfalse)の場合のみ、店舗へのアクセスマップを表示 */
          const shopMapHtml = (!isVisit && profile.address) ? `
            <div style="margin-top: 25px; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 0.9rem; font-weight: bold; color: #475569;">📍 店舗の場所はこちら</p>
              <p style="margin: 0 0 15px 0; font-size: 0.85rem;">${profile.address}</p>
              <a href="https://www.google.com.au/maps/search/${encodeURIComponent(profile.address)}" 
                 target="_blank" 
                 style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.9rem;">
                Googleマップでルート案内
              </a>
            </div>
          ` : '';

          finalHtml = `
              <div lang="ja" style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px;">
                <h2 style="color: #2563eb; margin-top: 0;">${isVisit ? '訪問' : '予約'}確定のお知らせ</h2>
                <div>${body}</div>
                
                ${shopMapHtml} 

                ${cancelUrl ? `<p style="font-size: 0.85rem; border-top: 1px solid #eee; padding-top: 15px; margin-top:20px;"><a href="${cancelUrl}" style="color: #2563eb;">ご予約の確認・キャンセルはこちら</a></p>` : ''}
                
                <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #64748b; line-height: 1.6;">
                  <p style="margin: 0 0 8px 0;">⚠️ <b>ご注意：</b>本メールは自動送信専用のシステムより送信されています。このメールに直接返信することはできません。</p>
                  
                  <div style="background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 10px;">
                    <p style="margin: 0 0 8px 0; font-weight: bold; color: #334155;">📞 ご予約の確認・キャンセル</p>
                    <p style="margin: 0 0 12px 0;">ご予約の確認や取り消しは、上記の「ご予約の確認・キャンセルはこちら」のリンクから画面上でも24時間いつでもお手続きいただけます。</p>
                    
                    <p style="margin: 0; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
                      画面での操作が難しい場合や、急なご連絡、その他ご不明な点がございましたら、恐れ入りますが<b>店舗へ直接お電話またはメール</b>にてご連絡をお願いいたします。<br><br>
                      ${profile?.phone ? `👉 <b>お電話：</b> <a href="tel:${profile.phone}" style="color: #2563eb; font-weight: bold; text-decoration: underline;">${profile.phone}</a>（タップで発信）<br>` : ''}
                      👉 <b>メール：</b> <a href="mailto:${shopEmail}" style="color: #2563eb; font-weight: bold; text-decoration: underline;">${shopEmail}</a>
                    </p>
                  </div>
                </div>
              </div>`;
          }
        }

        // ⚠️ 2026/09/23【BH】：差出人名から、メールのヘッダーを壊す文字（改行・" < > \）を取り除き、
        //    長さも40文字までにする。件名からも改行を取り除く。
        const senderName = String(shopName || profile?.business_name || '')
          .replace(/[\r\n"<>\\]/g, '')
          .trim()
          .slice(0, 40) || '予約通知';
        const safeSubject = String(finalSubject || '').replace(/[\r\n]+/g, ' ');

        return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: `${senderName} <infec@snipsnap.biz>`, to: [to], subject: safeSubject, html: finalHtml }),
      });
    };
// 🆕 1. 予約の入り口を判定 (payloadにLINE IDが含まれているか)
// ==========================================
    // 🚀 通知実行エリア（三土手さん指定の条件版）
    // ==========================================
    const isLineBooking = !!lineUserId;
    // 👇 🌟 修正：ここも「今回の予約モード」で判定
    const isVisit = serviceMode === 'visit';

    // --- 1. お客様への通知（経路によってLINEかメールか出し分け） ---
    let customerResData = null;
    let customerLineSent = false;

    if (isLineBooking) {
      // 【LINE予約の場合】LINE通知のみ送る（設定がONの場合）
      if (profile?.customer_line_booking_enabled !== false && currentToken) {
        
        // 🚀 🆕 追加1：来店型かつ店舗住所がある場合、マップURLの文章を作る
        const shopMapUrlText = (!isVisit && profile.address) 
          ? `\n\n📍 店舗の場所\nhttps://www.google.co.jp/maps/search/${encodeURIComponent(profile.address)}`
          : '';

        // 🚀 🆕 追加2：訪問型の場合の「訪問先住所」の文章を作る
        const visitAddressText = (isVisit && address) 
          ? `\n\n📍 訪問先\n${address}` 
          : '';

        // ⚠️ 2026/09/23【BH】：お客様宛ては customers.name を使う（店舗の呼び名を出さない）
        const nameForCustomer = customerNameForCustomer || customerName;
        const customerMsg = type === 'cancel' 
          ? `【キャンセル完了】\n${nameForCustomer} 様、キャンセル手続きが完了いたしました。`
          : `${nameForCustomer}様\n${isVisit ? 'ご指定の場所へお伺いいたします。' : 'ご予約ありがとうございます。'}\n\n🏨 店名：${shopName}\n👤 担当：${staffName || '店舗スタッフ'}\n📅 日時：${startTime}〜\n\n📋 内容：\n${services}${visitAddressText}${shopMapUrlText}\n\n■予約確認・キャンセル\n${cancelUrl}`;
        
        customerLineSent = Boolean(await safePushToLine(lineUserId, customerMsg, currentToken, "CUSTOMER"));
      }
    } else if (customerEmail && customerEmail !== 'admin@example.com') {
      // 【ウェブ予約の場合】メール通知のみ送る
      const customerRes = await sendMail(customerEmail, false);
      customerResData = await customerRes.json();
    }

    // --- 2. 店主様（三土手さん）への通知 ---
    let shopResData = null;
    let shopLineSent: unknown = false;

    // A. 【メール通知】予約経路に関わらず必ず送る（最重要）
    // 👇 🌟 修正：店舗設定(notify_mail_enabled)がOFFでないことを確認してから送る！
    if (profile?.notify_mail_enabled !== false && shopEmail && shopEmail !== 'admin@example.com') {
      const shopRes = await sendMail(shopEmail, true);
      shopResData = await shopRes.json();
    }

    // B. 【LINE通知】LineSettingsで「新着通知を受け取る」がチェックされている場合のみ送る
    // ⚠️ 2026/09/23【BT】：判定を DB の設定（profiles.notify_line_enabled）に変更しました。
    //    従来はブラウザからの notifyLineEnabled を見ていたが、どの画面も送っておらず、
    //    設定に関係なく一度も送られていなかった。明示的に ON（true）の店舗だけに送る。
    if (profile?.notify_line_enabled === true && currentToken && currentAdminId) {
      let detailsText = address ? `\n📍 住: ${address}` : "";
      if (notes) detailsText += `\n💬 備: ${notes}`;
      const phoneUrl = customerPhone ? `\n📞 呼: tel:${customerPhone}` : "";
      const mapUrl = address ? `\n🗺 地: https://www.google.co.jp/maps/search/${encodeURIComponent(address)}` : "";

      const shopMsg = type === 'cancel' 
        ? `【予約キャンセル】\n👤 客: ${customerName} 様\n📅 日: ${startTime}〜`
        : `【新着予約】\n👤 客: ${customerName} 様${detailsText}\n📅 日: ${startTime}〜\n📋 メ: ${services}${phoneUrl}${mapUrl}`;
      
      shopLineSent = await safePushToLine(currentAdminId, shopMsg, currentToken, "OWNER");
    }

    // 🆕 プッシュ通知の実行（予約 or キャンセル）
    const pushTitle = type === 'cancel' ? `⚠️ 予約キャンセル通知` : `📅 新着予約のお知らせ`;
    const pushBody = type === 'cancel' 
      ? `${customerName} 様が ${startTime}〜 の予約をキャンセルしました` 
      : `${customerName} 様 (${startTime}〜) \n内容: ${services}`;
    const pushUrl = `${ADMIN_URL}/admin/${shopId}/reservations`; // 通知タップで予約一覧へ

    await sendPushNotification(supabaseAdmin, shopId, pushTitle, pushBody, pushUrl);

    // 処理結果のレスポンス
    return new Response(JSON.stringify({ 
      success: true, 
      customerLine: customerLineSent, 
      shopLine: shopLineSent,
      shopEmailSent: !!shopResData,
      customerEmailSent: !!customerResData 
    }), { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    // エラーハンドリング
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ERROR]', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: corsHeaders }
    );
  }
}); // 👈 ここで Deno.serve を閉じます