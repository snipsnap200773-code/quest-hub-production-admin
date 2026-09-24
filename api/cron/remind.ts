import type { VercelRequest, VercelResponse } from '@vercel/node';

// ⚠️ 2026/09/24【BP】：Vercel Cron（vercel.json の crons・毎朝 9:00 JST）から呼ばれる。
//    ・Vercel は環境変数 CRON_SECRET があると、Cron の呼び出しに
//      Authorization: Bearer <CRON_SECRET> を自動で付ける。これが一致しない呼び出しは 401 で止める
//      （従来は誰でもこの URL を開いてリマインドを実行できた）。
//    ・resend には x-cron-secret ヘッダーで同じ合言葉を送る。
//    ・合言葉は Supabase Vault の cron_secret・Edge Function の CRON_SECRET と同じ値。
//    ・従来の Authorization（SUPABASE_SERVICE_ROLE_KEY）は Vercel に登録が無く、
//      空のまま送られていたため削除した（resend は --no-verify-jwt なので不要）。
export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const EDGE_FUNCTION_URL = "https://vcfndmyxypgoreuykwij.supabase.co/functions/v1/resend";
  const CRON_SECRET = process.env.CRON_SECRET || "";

  if (!CRON_SECRET || request.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return response.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET
      },
      // 💡 これを送ることで、index.ts内の `if (type === 'remind_all')` が発動します
      body: JSON.stringify({ type: 'remind_all' })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Supabase Error: ${JSON.stringify(data)}`);
    }

    return response.status(200).json({ 
      success: true, 
      message: "リマインド実行信号を送信しました",
      supabaseResponse: data 
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Cron Error:", message);
    return response.status(500).json({ 
      success: false, 
      error: message 
    });
  }
}