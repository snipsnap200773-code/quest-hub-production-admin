import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const SubscriptionContext = createContext();

export const SubscriptionProvider = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState({
    status: 'inactive',
    planId: 'free',
    loading: true,
  });

  // ⚠️ 2026/09/23【BR】：ログイン情報（JWT）が切れると、テーブルを閉じた今は
  //    エラーではなく「空っぽの画面」になり、お店の人が「データが消えた」と
  //    誤解するおそれがある。店舗画面はすべてここを通るので、
  //    入口でサーバーに問い合わせてセッションの生死を判定する。
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (!shopId) {
      setSubscription(prev => ({ ...prev, loading: false }));
      return;
    }

    const init = async () => {
      // 1. セッションの検証。getSession() はブラウザの保存値を返すだけで
      //    期限切れを見抜けないため、サーバーに問い合わせる getUser() を使う。
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setSessionExpired(true);
        setSubscription(prev => ({ ...prev, loading: false }));
        return;
      }

      // 2. 契約情報の取得
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('subscription_status, subscription_plan, is_tester')
          .eq('id', shopId)
          .maybeSingle();

        if (error) throw error;

        // 行が読めない＝権限が無い（別店舗のURLを開いた等）
        if (!data) {
          setSessionExpired(true);
          setSubscription(prev => ({ ...prev, loading: false }));
          return;
        }

        if (data.is_tester) {
          setSubscription({
            status: 'active',
            planId: 'guild', // ギルドプランと同等の全権限を付与
            loading: false,
          });
        } else {
          setSubscription({
            status: data.subscription_status || 'inactive',
            planId: data.subscription_plan || 'free',
            loading: false,
          });
        }
      } catch (error) {
        console.error('契約情報の取得エラー:', error);
        setSubscription(prev => ({ ...prev, loading: false }));
      }
    };

    init();
  }, [shopId]);

  const handleRelogin = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  if (sessionExpired) {
    return (
      <div style={expiredWrapStyle}>
        <div style={expiredCardStyle}>
          <div style={{ fontSize: '2.2rem', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e293b', margin: '0 0 14px' }}>
            ログインの有効期限が切れました
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.9, margin: '0 0 24px' }}>
            データは消えていません。<br />
            もう一度ログインすると、これまでどおりご利用いただけます。
          </p>
          <button onClick={handleRelogin} style={expiredBtnStyle}>
            ログイン画面へ
          </button>
        </div>
      </div>
    );
  }

  return (
    <SubscriptionContext.Provider value={subscription}>
      <Outlet />
    </SubscriptionContext.Provider>
  );
};

const expiredWrapStyle = {
  minHeight: '100vh',
  background: '#f1f5f9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif',
};

const expiredCardStyle = {
  background: '#fff',
  padding: '36px 28px',
  borderRadius: '18px',
  boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
  maxWidth: '400px',
  width: '100%',
  textAlign: 'center',
};

const expiredBtnStyle = {
  background: '#1e293b',
  color: '#fff',
  border: 'none',
  padding: '15px 36px',
  borderRadius: '12px',
  fontWeight: 'bold',
  fontSize: '1rem',
  cursor: 'pointer',
  width: '100%',
};

export const useSubscription = () => useContext(SubscriptionContext);