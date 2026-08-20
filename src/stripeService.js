import { supabase } from './supabaseClient'; // ※パスは現状に合わせてください

export async function redirectToCheckout(priceId, shopId) {
  try {
    // Edge Function を呼び出し（shopIdも一緒に送る）
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        priceId: priceId,
        shopId: shopId, // 👈 🆕 これを追加
        successUrl: `${window.location.origin}/admin/${shopId}/settings/billing?billing_status=success`,
        cancelUrl: `${window.location.origin}/admin/${shopId}/settings/billing?billing_status=canceled`,
      }
    });

    if (error) throw error;

    if (data?.url) {
      window.location.href = data.url;
    } else {
      throw new Error('決済ページのURLを取得できませんでした。');
    }
  } catch (err) {
    console.error('Stripe Checkout Error:', err);
    alert(err.message || '決済画面への移動に失敗しました。');
  }
}