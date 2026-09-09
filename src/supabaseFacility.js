import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const FACILITY_TOKEN_KEY = 'facility_session_token';

export const getFacilityToken = () => {
  if (typeof window === 'undefined') return '';
  const token = localStorage.getItem(FACILITY_TOKEN_KEY) || '';
  // ⚠️ 2026/09/09：HTTPヘッダーは ISO-8859-1 しか通りません。
  //    非ASCII が混ざった値をそのまま渡すと createClient が例外を投げ、
  //    画面が真っ白になります（不正な値でアプリ全体が死ぬのを防ぐため）。
  return /^[A-Za-z0-9._-]+$/.test(token) ? token : '';
};

const createFacilityClient = (token) => createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-facility-token': token || ''
    }
  },
  auth: {
    // ⚠️ 2026/09/09：施設ユーザーは Auth を持たないため、認証機能を完全に切ります。
    //    storageKey をインスタンスごとに変えることで
    //    「Multiple GoTrueClient instances」の警告も出なくなります。
    storageKey: `quest-hub-facility-noauth-${Math.random().toString(36).slice(2)}`,
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// ⚠️ let で公開しています。ES Modules のライブバインディングにより、
//    refreshFacilityClient() で差し替えると import 側にも反映されます。
let currentToken = getFacilityToken();
export let supabase = createFacilityClient(currentToken);

/**
 * ログイン直後など、トークンが変わったときに呼びます。
 * これを呼ばないと、モジュール読み込み時の古いトークンのまま通信し続けます。
 * トークンが変わっていない場合は作り直しません（インスタンスの無駄な増殖を防ぐため）。
 */
export const refreshFacilityClient = () => {
  const token = getFacilityToken();
  if (token !== currentToken) {
    currentToken = token;
    supabase = createFacilityClient(token);
  }
  return supabase;
};

/** ログアウト時に使います。 */
export const clearFacilitySession = () => {
  localStorage.removeItem(FACILITY_TOKEN_KEY);
  refreshFacilityClient();
};