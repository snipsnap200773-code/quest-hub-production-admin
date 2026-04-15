import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // 🆕 x-shop-id を追記（これがないとブラウザがエラーを出します）
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shop-id',
}
// LINE通知用の定数
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

// 🆕 1. 訪問型判定キーワード
const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];

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

// 💡 プレースホルダー置換用の共通関数（全項目対応版）
function applyPlaceholders(template: string, data: any) {
  if (!template) return "";
  return template
    .replace(/{name}/g, data.customerName || "")
    .replace(/{furigana}/g, data.furigana || "")
    .replace(/{shop_name}/g, data.shopName || "")
    .replace(/{start_time}/g, data.startTime || "")
    .replace(/{staff_name}/g, data.staffName || "担当者なし")
    .replace(/{services}/g, data.services || "")
    .replace(/{address}/g, data.address || "")
    .replace(/{parking}/g, data.parking || "")
    .replace(/{building_type}/g, data.buildingType || "")
    .replace(/{care_notes}/g, data.careNotes || "")
    .replace(/{company_name}/g, data.companyName || "")
    .replace(/{symptoms}/g, data.symptoms || "")
    .replace(/{request_details}/g, data.requestDetails || "")
    .replace(/{notes}/g, data.notes || "")
    .replace(/{details}/g, data.details || "")
    .replace(/{cancel_url}/g, data.cancelUrl || "")
    .replace(/{official_url}/g, data.officialUrl || "");
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
const payload = await req.json();
    let { 
      type, shopId, customerEmail, customerName, shopName, 
      startTime, services, shopEmail, cancelUrl, lineUserId, 
      notifyLineEnabled, owner_email, dashboard_url, reservations_url, 
      reserve_url, password, ownerName, phone, businessType,
      staffName, furigana, address, parking, buildingType, careNotes, 
      companyName, symptoms, requestDetails, notes, allOptions, custom_answers
    } = payload;

    // 🚀 🆕 【ここを追加！】キャンセル時は reservation の中身を外に展開する
    if (type === 'cancel' && payload.reservation) {
      const res = payload.reservation;
      customerEmail = customerEmail || res.customer_email;
      customerName = customerName || res.customer_name;
      startTime = startTime || res.start_time;
      // メニュー名は services に入っているものを復元
      if (!services) {
        if (res.options?.people) {
          // 複数名データ（people）がある場合
          services = res.options.people.map((p: any) => p.services.map((s: any) => s.name).join(', ')).join(' / ');
        } else if (res.options?.services) {
          // 従来データ（services）がある場合
          services = res.options.services.map((s: any) => s.name).join(', ');
        } else {
          services = "メニューなし";
        }
      }
      // 店舗情報はDBから後で取りますが、最低限必要なものを補填
      shopId = shopId || res.shop_id;
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
    // 🚀 さっき設定した名前に合わせる（SUPABASE_ を取る）
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? ""; 
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    // クライアント作成時も新しい変数名を使う
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
    .gte('start_time', `${dateStr}T00:00:00.000Z`)
    .lte('start_time', `${dateStr}T23:59:59.999Z`)
    .eq('remind_sent', false)
    .eq('res_type', 'normal');

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
      ? res.options.people.map((p: any, i: number) => `${i + 1}人目: ${p.services.map((s: any) => s.name).join(', ')}`).join('\n')
      : (res.options?.services?.map((s: any) => s.name).join(', ') || res.options?.people?.[0]?.services?.map((s: any) => s.name).join(', ') || "メニューなし");

    const placeholderData = { 
      customerName: res.customer_name, 
      furigana: info.furigana || "",
      shopName: shop.business_name, 
      startTime: `${dateStr.replace(/-/g, '/')} ${resTime}〜`, 
      services: menuDisplayText, 
      staffName: res.staffs?.name || "店舗スタッフ", // 🆕 ここを追加！
      address: info.address || shop.address || "",
      parking: info.parking || "",
      cancelUrl: `${PORTAL_URL}/shop/${shop.id}/reserve?cancel=${res.id}`,
      officialUrl: shop.custom_official_url 
    };

    let mailOk = false;
    let lineOk = false;

    // ✅ LINE IDの有無による完全仕分け
if (res.line_user_id) {
  if (shop.customer_line_remind_enabled !== false && shop.line_channel_access_token) {
    // 🆕 担当者名を追加したメッセージに変更
    const msg = `【${shop.business_name}】\n明日 ${resTime} よりご予約をお待ちしております。\n\n👤 お名前：${res.customer_name} 様\n👤 担当：${res.staffs?.name || '店舗スタッフ'}\n📋 内容：\n${menuDisplayText}\n\nお気をつけてお越しください！`;
    lineOk = await safePushToLine(res.line_user_id, msg, shop.line_channel_access_token, "REMIND");
  }
} else {
      // Web予約の場合（メールアドレスがあればメールを送る）
      if (shop.notify_mail_remind_enabled !== false && res.customer_email) {
        const subject = applyPlaceholders(shop.mail_sub_customer_remind || `【リマインド】明日のお越しをお待ちしております（${shop.business_name}）`, placeholderData);
        const html = `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px;">
            <h2 style="color: #2563eb;">明日、ご来店をお待ちしております</h2>
            <p>${res.customer_name} 様</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="margin: 5px 0;">📅 <strong>日時:</strong> ${dateStr.replace(/-/g, '/')} ${resTime}〜</p>
              <p style="margin: 5px 0;">📋 <strong>内容:</strong><br>${menuDisplayText}</p>
              <p style="margin: 5px 0;">📍 <strong>場所:</strong> ${info.address || shop.address || '店舗'}</p>
            </div>
          </div>`;

const mRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
              body: JSON.stringify({ from: `${shop.business_name} <infec@snipsnap.biz>`, to: [res.customer_email], subject, html })
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

// 🆕 ここから追記：パターンF（新規登録用OTP）
if (type === 'signup_otp') {
  const { otpCode } = payload; // Home.jsx側で作った数字を受け取る
  
  const subject = `【SOLO】認証コード：${otpCode}`;
  const html = `
    <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px;">
      <h2 style="color: #07aadb; margin-top: 0;">ご登録ありがとうございます</h2>
      <p>本人確認のため、以下の認証コードを画面に入力してください。</p>
      <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
        <span style="font-size: 2rem; font-weight: 900; letter-spacing: 10px; color: #1e293b;">${otpCode}</span>
      </div>
      <p style="font-size: 0.8rem; color: #64748b;">※このコードの有効期限は10分間です。</p>
    </div>`;

const otpRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ 
      from: 'SOLO 運営事務局 <infec@snipsnap.biz>', 
      to: [customerEmail], 
      subject, 
      html 
    })
  });

  // ResendからのレスポンスをJSONとして解析
  const resData = await otpRes.json();

  // 🆕 status 200番台なら成功として、ブラウザが使いやすいJSONを返す
  return new Response(JSON.stringify({ 
    success: otpRes.ok, 
    data: resData 
  }), { 
    status: 200, 
    headers: corsHeaders 
  });
}

// ==========================================
// 🆕 【ここを新しく追加！】パターンH：提携完了（承認）通知 
// ==========================================
if (type === 'partnership_approved') {
  const { 
    shopName, 
    facilityName, 
    shopEmail, 
    facilityEmail,
    shopId,
    facilityId
  } = payload;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? "";
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. 両方の通知設定（フラグ）をDBから取得
  const { data: sData } = await supabaseAdmin.from('profiles').select('email_notifications_enabled').eq('id', shopId).single();
  const { data: fData } = await supabaseAdmin.from('facility_users').select('email_notifications_enabled').eq('id', facilityId).single();

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
// 🆕 【ここから追加】パターンI：施設訪問予約完了通知（一括予約対応）
// ==========================================
if (type === 'facility_booking') {
  const { 
    shopName, 
    shopEmail, 
    facilityName, 
    facilityEmail,
    scheduledDates, // 配列: ["2026-03-27", "2026-03-28"]
    residentCount,
    residentListText,
    shopId,
    facilityId
  } = payload;

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  // 日付リストを読みやすく整形
  const dateListHtml = scheduledDates.map((d: string) => 
    `<span style="display:inline-block; background:#3d2b1f; color:#fff; padding:4px 10px; border-radius:4px; margin:2px; font-weight:bold;">${d.replace(/-/g, '/')}</span>`
  ).join(' ');

  // 1. 店舗様への通知（新着予約確定）
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
            <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #948b83; font-weight: bold;">利用者様リスト（共通）:</p>
            <pre style="margin: 0; font-family: inherit; font-size: 0.9rem; color: #3d2b1f;">${residentListText}</pre>
          </div>

          <div style="text-align: center;">
  <a href="${ADMIN_URL}/admin/${shopId}/reservations" style="display: inline-block; background: #3d2b1f; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">管理画面で詳細を確認する</a>
</div>
        </div>`
    })
  });

  // 2. 施設様への通知（サンクスメール）
  if (facilityEmail) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${shopName} <infec@snipsnap.biz>`,
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
          </div>`
      })
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
}
// 🆕 【ここまで追加】

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

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? "";
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. 店舗の設定（profile）を取得
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', shopId).single();
  if (!profile) throw new Error('店舗情報が見つかりません');

  // 🚀 🆕 重要：題名や送信者に使う名前を決定（届いた屋号があれば最優先、なければ店舗名）
  const displayShopName = reqShopName || profile.business_name;

  const config = profile.form_config || {};

  // --- 🚀 🆕 スイッチ(inquiry_enabled)の状態をチェックして項目を作る ---
  let fieldsHtml = `<p style="margin: 0 0 10px 0;"><b>■ お名前:</b> ${name} 様</p>`;
  if (config.email?.inquiry_enabled && customerEmail) fieldsHtml += `<p style="margin: 0 0 10px 0;"><b>■ メール:</b> ${customerEmail}</p>`;
  if (config.phone?.inquiry_enabled && customerPhone) fieldsHtml += `<p style="margin: 0 0 10px 0;"><b>■ 電話番号:</b> ${customerPhone}</p>`;

  let lineFieldsText = `👤 客: ${name} 様`;
  if (config.email?.inquiry_enabled && customerEmail) lineFieldsText += `\n✉️ メ: ${customerEmail}`;
  if (config.phone?.inquiry_enabled && customerPhone) lineFieldsText += `\n📞 呼: ${customerPhone}`;

  let customAnswersText = "";
  if (custom_answers && Object.keys(custom_answers).length > 0) {
    customAnswersText = Object.entries(custom_answers)
      .filter(([qid]) => {
        const q = config.custom_questions?.find((item: any) => item.id === qid);
        return q && q.inquiry_enabled === true;
      })
      .map(([qid, answer]) => {
        const q = config.custom_questions?.find((item: any) => item.id === qid);
        return `・${q?.label || '質問'}: ${answer}`;
      }).join('\n');
  }

  // --- ✉️ 店舗様への通知（メール） ---
  // 🚀 🆕 件名に決定した屋号（フットケアラボ等）を入れる
  const shopSubject = `【${displayShopName}】新着お問い合わせ（${name} 様）`;
  const shopHtml = `
    <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #4f46e5;">
      <h2 style="color: #4f46e5; margin-top: 0;">📩 新しいお問い合わせ</h2>
      <p><strong>${displayShopName} 様</strong></p>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
        ${fieldsHtml}
        <p style="margin: 0 0 10px 0;"><b>■ 内容:</b><br>${content.replace(/\n/g, '<br>')}</p>
        ${customAnswersText ? `<p style="margin: 15px 0 0 0; border-top: 1px dashed #cbd5e1; padding-top: 10px;"><b>■ カスタム項目の回答:</b><br>${customAnswersText.replace(/\n/g, '<br>')}</p>` : ''}
      </div>

      <div style="text-align: center;">
  <a href="${ADMIN_URL}/admin/${shopId}/dashboard" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">管理画面を開く</a>
</div>
    </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: `${displayShopName} 通知 <infec@snipsnap.biz>`, // 🚀 送信者名を屋号に
      to: [profile.email_contact || profile.email],
      subject: shopSubject,
      html: shopHtml
    })
  });

  // --- ✉️ お客様への自動返信 ---
  if (customerEmail) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        // 🚀 🆕 送信者名と題名を屋号に書き換え
        from: `${displayShopName} <infec@snipsnap.biz>`,
        to: [customerEmail],
        subject: `【送信完了】${displayShopName} へのお問い合わせ`,
        html: `<div style="font-family: sans-serif; padding: 25px;">
                <p>${name} 様</p>
                <p>お問い合わせを承りました。内容を確認次第、ご連絡いたします。</p>
                <hr />
                <p style="font-size: 0.9rem; color: #666;">${content.replace(/\n/g, '<br>')}</p>
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
    // 🚀 🆕 パターンK：店舗アカウントの全自動発行（ここを新規追加！）
    // (Auth作成 ➔ profiles登録 ➔ ウェルカムメール送信)
    // ==========================================
    if (type === 'CREATE_SHOP_FULL') {
      const targetEmail = payload.email; // 届いたメアド
      console.log(`[CREATE_SHOP_FULL] 開始: ${targetEmail}`);

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
          onConflict: 'email_contact' // 📧 メアドが重なったら「更新」せよという命令
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
      console.log(`[REPAIR_AUTH] 復旧開始: ${email} (ID: ${shopId})`);

      // 💡 管理者権限（合鍵）を使って、IDを指定してAuthユーザーを作成
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        id: shopId,          // 👈 これが最重要！DB側のProfilesと同じIDで作成します
        email: email,
        password: password,
        email_confirm: true  // 確認メールをスキップ
      });

      if (authError) {
        console.error('[REPAIR_AUTH] 作成失敗:', authError.message);
        return new Response(JSON.stringify({ error: authError.message }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log(`[REPAIR_AUTH] 復旧成功: ${email}`);
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, headers: corsHeaders 
      });
    }

    // 🚀 🆕 パターンM：認証パスワードの同期更新
    if (type === 'UPDATE_PASSWORD') {
      const { shopId, password } = payload;
      console.log(`[UPDATE_PASSWORD] 更新開始: ID ${shopId}`);

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

    // ==========================================
    // 🚀 パターンA：店主様への歓迎メール ＆ 三土手さんへの通知送信 (本家ロジック完全維持)
    // ==========================================
    if (type === 'welcome') {
      const welcomeRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'SOLO 運営事務局 <infec@snipsnap.biz>',
          to: [owner_email],
          subject: `【SOLO】ベータ版へのご登録ありがとうございます！`,
          html: `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px;">
              <h1 style="color: #2563eb; font-size: 1.5rem; margin-top: 0;">${shopName} 様</h1>
              <p>この度は <strong>SOLO</strong> にお申し込みいただき、誠にありがとうございます。</p>
              <div style="background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 25px 0;">
                <h2 style="font-size: 1rem; margin-top: 0; color: #1e293b; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;">🔑 管理者用ログイン情報</h2>
                <p style="margin: 15px 0 5px 0;"><strong>● 設定画面</strong><br><a href="${dashboard_url}">${dashboard_url}</a></p>
                <p style="margin: 15px 0 5px 0;"><strong>● 予約台帳</strong><br><a href="${reservations_url}">${reservations_url}</a></p>
                <p style="margin: 15px 0 5px 0;"><strong>● パスワード</strong><br><span style="color: #e11d48; font-weight: bold;">${password}</span></p>
              </div>
              <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 25px 0; border: 1px solid #bbf7d0;">
                <h2 style="font-size: 1rem; margin-top: 0; color: #166534; border-bottom: 2px solid #bbf7d0; padding-bottom: 8px;">📅 お客様用 予約URL</h2>
                <p><a href="${reserve_url}" style="color: #15803d; font-weight: bold;">${reserve_url}</a></p>
              </div>
            </div>`,
        }),
      });

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'SOLO システム通知 <infec@snipsnap.biz>',
          to: ['snipsnap.2007.7.3@gmail.com'],
          subject: `【新規申込】${shopName} 様がベータ版の利用を開始しました`,
          html: `<div style="padding: 20px; border: 2px solid #2563eb; border-radius: 12px;"><h2>🚀 新規登録通知</h2><p>店舗名: ${shopName} 様</p><p>代表者: ${ownerName} 様</p></div>`,
        }),
      });

      const welcomeData = await welcomeRes.json();
      return new Response(JSON.stringify(welcomeData), { status: 200, headers: corsHeaders });
    }

    // ==========================================
    // 🚀 パターンB・D・E：予約完了 ＆ キャンセル通知 (三土手さん指定の5パターン)
    // ==========================================
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', shopId).single();
    
    // 🚀 🆕 【ここを追加！】不足している店舗情報を補完する
    if (profile) {
      shopName = shopName || profile.business_name;
      shopEmail = shopEmail || profile.email_contact || profile.email;
    }

    const currentToken = profile?.line_channel_access_token;
    const currentAdminId = profile?.line_admin_user_id;

const sendMail = async (to: string, isOwner: boolean) => {
      // 🚀 🆕 キャンセル時は payload.reservation からデータを補填する
      const resData = type === 'cancel' ? payload.reservation : {};
      const targetName = customerName || resData.customer_name;
      const targetTime = startTime || resData.start_time;
      const targetServices = services || resData.options?.services?.map((s:any)=>s.name).join(', ') || "メニューなし";

      // ✅ 置換用データセット
      const placeholderData = { 
        customerName: targetName, 
        shopName, 
        startTime: targetTime, 
        services: targetServices, 
        cancelUrl, 
        staffName: staffName || resData.staff_name || "店舗スタッフ",
        furigana: furigana || resData.options?.visit_info?.furigana || "", 
        address: address || resData.options?.visit_info?.address || "",
        parking, 
        buildingType, 
        careNotes,
        companyName, 
        symptoms, 
        requestDetails, 
        notes,
        officialUrl: profile.custom_official_url || "" 
      };      
      const isVisit = VISIT_KEYWORDS.some(keyword => (profile.business_type || '').includes(keyword));
      const defaults = isVisit ? VISIT_DEFAULTS : STORE_DEFAULTS;

      let finalSubject = "";
      let finalHtml = "";

      if (type === 'cancel') {
        // --- 🚀 🆕 キャンセル通知（デザイン版） ---
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

        if (isOwner) {
          // 🏪 店舗様向け通知
          finalSubject = `【予約キャンセル】${targetName} 様 (${dateStr})`;
          finalHtml = `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #ef4444;">
              <h2 style="color: #ef4444; margin-top: 0;">⚠️ 予約キャンセル通知</h2>
              <p><strong>${shopName} 管理者様</strong></p>
              <p>お客様により、以下の予約がキャンセルされました。</p>
              <div style="background: #fff5f5; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #feb2b2;">
                <p style="margin: 0;">👤 <b>お客様:</b> ${targetName} 様</p>
                <p style="margin: 5px 0 0;">📅 <b>予約日時:</b> ${dateStr}</p>
                <p style="margin: 5px 0 0;">📋 <b>メニュー:</b> ${targetServices}</p>
              </div>
              <p style="font-size: 0.9rem; color: #64748b;">※予約枠が開放されました。必要に応じてカレンダーをご確認ください。</p>
            </div>`;
        } else {
          // 👤 お客様向け通知
          finalSubject = `【キャンセル完了】ご予約の取り消しを承りました（${shopName}）`;
          finalHtml = `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 550px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; border-top: 8px solid #94a3b8;">
              <h2 style="color: #475569; margin-top: 0;">キャンセル完了のお知らせ</h2>
              <p>${targetName} 様</p>
              <p>下記のご予約キャンセルを承りました。ご確認をお願いいたします。</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <p style="margin: 0;">📅 <b>日時:</b> ${dateStr}</p>
                <p style="margin: 5px 0 0;">🏨 <b>店舗名:</b> ${shopName}</p>
              </div>
              <p>またのご利用をスタッフ一同、心よりお待ちしております。</p>
              <div style="text-align: center; margin-top: 25px;">
                <a href="${reserve_url || '#'}" style="display: inline-block; background: #475569; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">新しい予約を入れる</a>
              </div>
            </div>`;
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
                 ${allOptions.map((o: any) => `
                   <li style="margin-bottom: 2px;">
                     ${o.option_name} 
                     <span style="color: #d34817; font-weight: bold; font-size: 0.85rem;">
                       (+¥${(o.additional_price || 0).toLocaleString()})
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
            <p style="margin: 20px 0 10px 0;">${shopName} 管理者様</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
              <p style="margin: 5px 0;">👤 <b>お客様:</b> ${customerName} 様 ${furigana ? `(${furigana})` : ''}</p>
              <p style="margin: 5px 0;">📅 <b>日時:</b> ${startTime}</p>
              <p style="margin: 5px 0;">👤 <b>担当:</b> ${staffName || '指名なし'}</p>
              <p style="margin: 5px 0;">📋 <b>メニュー:</b> ${services}</p>
              
              ${optionsListHtml} 

              ${payload.phone ? `
                <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
                  <a href="tel:${payload.phone}" style="display: inline-block; background: #10b981; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.9rem;">📞 お客様へ電話をかける</a>
                </div>
              ` : ''}
            </div>

            <div style="margin-top: 20px; padding: 15px; border-left: 4px solid #cbd5e1; background: #fff;">
              <h3 style="margin: 0 0 10px 0; font-size: 0.9rem; color: #64748b;">📝 お客様の入力内容</h3>
              <div style="font-size: 0.9rem; color: #1e293b;">
                ${address ? `
                  <p style="margin: 4px 0;">📍 <b>住所:</b> ${address}</p>
                  <div style="margin: 8px 0 15px 0;">
                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" style="display: inline-block; background: #3b82f6; color: #fff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.85rem;">🗺 Googleマップで場所を確認</a>
                  </div>
                ` : ''}
                
                ${parking ? `<p style="margin: 4px 0;">🅿️ <b>駐車場:</b> ${parking}</p>` : ''}

                ${custom_answers && Object.keys(custom_answers).length > 0 ? `
                  <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 8px 0; font-size: 0.8rem; color: #64748b; font-weight: bold;">🙋 カスタム質問への回答:</p>
                    ${Object.entries(custom_answers).map(([qid, answer]) => {
                      const question = profile.form_config?.custom_questions?.find((q: any) => q.id === qid);
                      return `<p style="margin: 4px 0; font-size: 0.9rem;">・<b>${question?.label || '質問'}:</b> ${answer}</p>`;
                    }).join('')}
                  </div>
                ` : ''}

                ${notes ? `<p style="margin: 15px 0 4px 0; border-top: 1px dashed #eee; padding-top: 10px;">💬 <b>備考:</b><br>${notes.replace(/\n/g, '<br>')}</p>` : ''}
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
          const body = applyPlaceholders(bodyTemplate, placeholderData).replace(/\n/g, '<br>');
          finalHtml = `
            <div lang="ja" style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px;">
              <h2 style="color: #2563eb; margin-top: 0;">${isVisit ? '訪問' : '予約'}確定のお知らせ</h2>
              <div>${body}</div>
              ${cancelUrl ? `<p style="font-size: 0.85rem; border-top: 1px solid #eee; padding-top: 15px; margin-top:20px;"><a href="${cancelUrl}" style="color: #2563eb;">ご予約の確認・キャンセルはこちら</a></p>` : ''}
            </div>`;
        }
      }

      return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: `${shopName} <infec@snipsnap.biz>`, to: [to], subject: finalSubject, html: finalHtml }),
      });
    };
// 🆕 1. 予約の入り口を判定 (payloadにLINE IDが含まれているか)
// ==========================================
    // 🚀 通知実行エリア（三土手さん指定の条件版）
    // ==========================================
    const isLineBooking = !!lineUserId;
    const isVisit = VISIT_KEYWORDS.some(keyword => (profile?.business_type || '').includes(keyword));

    // --- 1. お客様への通知（経路によってLINEかメールか出し分け） ---
    let customerResData = null;
    let customerLineSent = false;

    if (isLineBooking) {
      // 【LINE予約の場合】LINE通知のみ送る（設定がONの場合）
      if (profile?.customer_line_booking_enabled !== false && currentToken) {
        const customerMsg = type === 'cancel' 
          ? `【キャンセル完了】\n${customerName} 様、キャンセル手続きが完了いたしました。`
          : `${customerName}様\n${isVisit ? 'ご指定の場所へお伺いいたします。' : 'ご予約ありがとうございます。'}\n\n🏨 店名：${shopName}\n👤 担当：${staffName || '店舗スタッフ'}\n📅 日時：${startTime}〜\n\n📋 内容：\n${services}\n${isVisit ? `📍 訪問先：\n${address}` : ''}\n\n■予約確認・キャンセル\n${cancelUrl}`;
        
        customerLineSent = await safePushToLine(lineUserId, customerMsg, currentToken, "CUSTOMER");
      }
    } else if (customerEmail && customerEmail !== 'admin@example.com') {
      // 【ウェブ予約の場合】メール通知のみ送る
      const customerRes = await sendMail(customerEmail, false);
      customerResData = await customerRes.json();
    }

    // --- 2. 店主様（三土手さん）への通知 ---
    let shopResData = null;
    let shopLineSent = false;

    // A. 【メール通知】予約経路に関わらず必ず送る（最重要）
    if (shopEmail && shopEmail !== 'admin@example.com') {
      const shopRes = await sendMail(shopEmail, true);
      shopResData = await shopRes.json();
    }

    // B. 【LINE通知】LineSettingsで「新着通知を受け取る」がチェックされている場合のみ送る
    if (notifyLineEnabled === true && currentToken && currentAdminId) {
      let detailsText = address ? `\n📍 住: ${address}` : "";
      if (notes) detailsText += `\n💬 備: ${notes}`;
      const phoneUrl = payload.phone ? `\n📞 呼: tel:${payload.phone}` : "";
      const mapUrl = address ? `\n🗺 地: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "";

      const shopMsg = type === 'cancel' 
        ? `【予約キャンセル】\n👤 客: ${customerName} 様\n📅 日: ${startTime}〜`
        : `【新着予約】\n👤 客: ${customerName} 様${detailsText}\n📅 日: ${startTime}〜\n📋 メ: ${services}${phoneUrl}${mapUrl}`;
      
      shopLineSent = await safePushToLine(currentAdminId, shopMsg, currentToken, "OWNER");
    }

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
    console.error('[ERROR]', error.message);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: corsHeaders }
    );
  }
}); // 👈 ここで Deno.serve を閉じます