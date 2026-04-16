import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabaseの接続情報が読み込めません。 .envファイルを確認してください。");
}

/**
 * 🆔 URLからshopIdを自動抽出するヘルパー
 * 例: /admin/d1669717.../dashboard -> d1669717...
 */
const getShopIdFromUrl = () => {
  if (typeof window === 'undefined') return 'public';
  const path = window.location.pathname;
  // URLの /admin/:id/ や /shop/:id/ の部分を抽出
  const match = path.match(/\/(admin|shop)\/([^/]+)/);
  return match ? match[2] : 'public';
};

/**
 * 🛡️ 1. メインクライアント（データベース・ストレージ用）
 * 修正内容：RLSの「魔法のポリシー」を通るための 'x-shop-id' ヘッダーを自動付与します。
 * これにより、コード側で where('shop_id', ...) を書き忘れても、DBが自動で自店舗のデータに絞り込みます。
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-shop-id': getShopIdFromUrl()
    }
  },
  // 🚀 🆕 ここから追記：ログイン維持のための強力な設定
  auth: {
    persistSession: true,      // ログイン状態をブラウザ（LocalStorage）に保存する
    autoRefreshToken: true,    // トークンが切れる前に自動で更新する
    detectSessionInUrl: true,  // URL（メール認証等）からのセッション復帰を許可する
    storageKey: 'quest-hub-main-auth', // 保存場所の名前を固定（他のアプリとの衝突を防ぐ）
    storage: window.localStorage // 明示的にLocalStorageを使用
  }
});

/**
 * ✉️ 2. 通知専用クライアント（Edge Functions用）
 * メインクライアントとのセッション衝突を避けるための設定を維持。
 * 通知処理には shop_id 制限をかけないため、こちらは標準設定のままにします。
 */
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sb-notification-auth-token',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});