import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // 💡 三土手さんのSupabase Edge FunctionのURL
  const EDGE_FUNCTION_URL = "https://vcfndmyxypgoreuykwij.supabase.co/functions/v1/resend";
  
  // 💡 Supabaseの `anon key` または `service_role key`（推奨）
  // 本来は環境変数から取るべきですが、まずは確実に動かすために直書きか環境変数を確認してください
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
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
    console.error("Cron Error:", error.message);
    return response.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}