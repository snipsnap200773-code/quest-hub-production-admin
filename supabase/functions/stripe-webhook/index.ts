import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response('Webhook Secret or Signature missing', { status: 400 })
  }

  try {
    const body = await req.text()
    
    // 署名検証
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )

    // Supabase Admin クライアントの初期化 (RLSをバイパスして更新するため Service Role Key を使用)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 決済完了時（初回のCheckout完了）
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const shopId = session.client_reference_id || session.metadata?.shopId
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      if (shopId) {
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shopId)

        if (error) console.error('DB Update Error (checkout.session.completed):', error)
      }
    }

    // 2. ⚠️ サブスクリプション更新時（カード決済失敗で past_due になった時やリカバリー成功時に走ります）
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      const status = subscription.status // 'active', 'past_due', 'canceled', 'unpaid' など

      // 💡 追加: 状態をそのままDBに反映させつつ、もしキャンセルや未払いになればプランもfreeに落とす
      const updateData: any = {
        subscription_status: status,
        updated_at: new Date().toISOString(),
      }
      if (status === 'canceled' || status === 'unpaid') {
        updateData.subscription_plan = 'free'
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('stripe_subscription_id', subscription.id)

      if (error) console.error('DB Update Error (customer.subscription.updated):', error)
    }

    // 3. 🚨 最終ダウングレード処理：解約・削除時（フェーズ2の「すべてのリトライが失敗した場合」にここが走ります）
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_status: 'canceled', // フロントの判定で確実に弾くために canceled にする
          subscription_plan: 'free',       // 👑 確実に無料版（ゲート発動状態）へダウングレード
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)

      if (error) console.error('DB Update Error (customer.subscription.deleted):', error)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})