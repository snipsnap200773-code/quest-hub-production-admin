// 🔐 2026/09/26（1-2 施設連携の封印）：施設連携のスイッチ（profiles.facility_feature_enabled）が
//    ON の店舗だけ、中身（children）を表示する。OFF の店舗には案内を出す。
//    ※ サーバー側（DB のポリシー・resend）でも止めているため、これは見た目のための部品。
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const FacilityFeatureGate = ({ children }) => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'allowed' | 'denied'

  useEffect(() => {
    let ignore = false;
    const check = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('facility_feature_enabled')
        .eq('id', shopId)
        .maybeSingle();
      if (ignore) return;
      setStatus(!error && data?.facility_feature_enabled === true ? 'allowed' : 'denied');
    };
    check();
    return () => { ignore = true; };
  }, [shopId]);

  if (status === 'loading') return null;
  if (status === 'allowed') return children;

  return (
    <div style={{ maxWidth: '480px', margin: '80px auto', padding: '32px 24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
      <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem', color: '#1e293b' }}>施設連携は現在ご利用いただけません</h2>
      <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
        この店舗では、施設連携の機能が有効になっていません。
      </p>
      <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
        ダッシュボードへ戻る
      </button>
    </div>
  );
};

export default FacilityFeatureGate;