import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { redirectToCheckout } from '../../../stripeService';
import { CreditCard, Check, ArrowLeft, AlertCircle, Sparkles, ShieldCheck, Zap } from 'lucide-react';

const BillingSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingInterval, setBillingInterval] = useState('month'); // 'month' | 'year'

  // 🔑 Stripeで取得した Price ID をここに設定します
  const PRICE_IDS = {
    solopreneur: {
      month: 'price_1U6RBXR8TkJjdX3BjaMVhWDV', // ソロプレナー 月払い (¥3,000)
      year: 'price_1U6RD6R8TkJjdX3BKFkTBCKs',  // ソロプレナー 年払い (¥33,000)
    },
    party: {
      month: 'price_1U6RFRR8TkJjdX3BoetawkXc', // パーティー 月払い (¥7,000)
      year: 'price_1U6RGCR8TkJjdX3BmM6ucINF',  // パーティー 年払い (¥77,000)
    },
    guild: {
      month: 'price_1U6RH4R8TkJjdX3BCoNHdtxu', // ギルド 月払い (¥15,000)
      year: 'price_1U6RHkR8TkJjdX3BRJS1HfG2',  // ギルド 年払い (¥165,000)
    },
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', shopId)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (err) {
        console.error("プロフィール取得エラー:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [shopId]);

  const handleSubscribe = async (priceId) => {
    if (!priceId) return;
    setIsProcessing(true);
    await redirectToCheckout(priceId, shopId);
    setIsProcessing(false);
  };

  if (isLoading) {
    return <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>読み込み中...</div>;
  }

  const isSubscribed = profile?.subscription_status === 'active';

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px', fontFamily: 'sans-serif' }}>
      
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', gap: '15px' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={28} color="#8b5cf6" />
            プラン・お支払い設定
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            現在の契約状況の確認とプランのアップグレード
          </p>
        </div>
      </div>

      {/* 現在のステータス表示 */}
      <div style={{ 
        background: isSubscribed ? '#f0fdf4' : '#f8fafc', 
        border: `1px solid ${isSubscribed ? '#bbf7d0' : '#e2e8f0'}`,
        borderRadius: '16px', padding: '20px', marginBottom: '30px',
        display: 'flex', alignItems: 'center', gap: '15px'
      }}>
        {isSubscribed ? (
          <>
            <Check size={32} color="#16a34a" />
            <div>
              <h3 style={{ margin: 0, color: '#166534', fontSize: '1.1rem' }}>現在有料プランを利用中です</h3>
              <p style={{ margin: '5px 0 0', color: '#15803d', fontSize: '0.9rem' }}>すべての機能をご利用いただけます。</p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle size={32} color="#64748b" />
            <div>
              <h3 style={{ margin: 0, color: '#334155', fontSize: '1.1rem' }}>現在はフリープラン（無料）です</h3>
              <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.9rem' }}>機能制限を解除するには、下のプランからアップグレードしてください。</p>
            </div>
          </>
        )}
      </div>

      {/* 月払い / 年払い 切り替えスイッチ */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '30px', gap: '12px' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: billingInterval === 'month' ? 'bold' : 'normal', color: billingInterval === 'month' ? '#1e293b' : '#64748b' }}>
          月払い
        </span>
        <button
          onClick={() => setBillingInterval(billingInterval === 'month' ? 'year' : 'month')}
          style={{
            width: '56px', height: '30px', borderRadius: '15px',
            background: billingInterval === 'year' ? '#8b5cf6' : '#cbd5e1',
            border: 'none', position: 'relative', cursor: 'pointer',
            transition: 'background 0.3s'
          }}
        >
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '3px',
            left: billingInterval === 'year' ? '29px' : '3px',
            transition: 'left 0.3s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }} />
        </button>
        <span style={{ fontSize: '0.95rem', fontWeight: billingInterval === 'year' ? 'bold' : 'normal', color: billingInterval === 'year' ? '#1e293b' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          年払い
          <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
            約1ヶ月分おトク
          </span>
        </span>
      </div>

      {/* 3つのプランカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* 1. ソロプレナー */}
        <div style={{ 
          background: '#fff', borderRadius: '24px', padding: '30px', 
          border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Zap size={22} color="#0284c7" />
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>ソロプレナー</h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748b' }}>個人経営・フリーランス向け</p>
          
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '20px' }}>
            {billingInterval === 'month' ? '¥3,000' : '¥33,000'}
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'normal' }}>
              /{billingInterval === 'month' ? '月' : '年'}
            </span>
          </div>

          <ul style={{ padding: 0, margin: '0 0 30px', listStyle: 'none', color: '#475569', fontSize: '0.9rem', flexGrow: 1 }}>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#0284c7" /> プレイヤー 1名</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#0284c7" /> アシスト 1名</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#0284c7" /> 予約・レジ・LINE連携</li>
          </ul>

          <button 
            onClick={() => handleSubscribe(PRICE_IDS.solopreneur[billingInterval])}
            disabled={isSubscribed || isProcessing}
            style={{ 
              width: '100%', padding: '14px', borderRadius: '12px',
              cursor: (isSubscribed || isProcessing) ? 'not-allowed' : 'pointer',
              background: isSubscribed ? '#e2e8f0' : '#0284c7',
              color: isSubscribed ? '#94a3b8' : '#fff', border: 'none', fontWeight: 'bold'
            }}
          >
            {isProcessing ? '処理中...' : isSubscribed ? '契約中' : 'ソロプレナーで契約'}
          </button>
        </div>

        {/* 2. パーティー (人気枠) */}
        <div style={{ 
          background: '#fff', borderRadius: '24px', padding: '30px', 
          border: '2px solid #8b5cf6', display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.15)', position: 'relative'
        }}>
          <div style={{ 
            position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
            background: '#8b5cf6', color: '#fff', padding: '4px 16px', borderRadius: '20px',
            fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px'
          }}>RECOMMENDED</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Sparkles size={22} color="#8b5cf6" />
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#8b5cf6' }}>パーティー</h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748b' }}>複数スタッフでの店舗運営向け</p>

          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '20px' }}>
            {billingInterval === 'month' ? '¥7,000' : '¥77,000'}
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'normal' }}>
              /{billingInterval === 'month' ? '月' : '年'}
            </span>
          </div>

          <ul style={{ padding: 0, margin: '0 0 30px', listStyle: 'none', color: '#475569', fontSize: '0.9rem', flexGrow: 1 }}>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#8b5cf6" /> プレイヤー 5名まで</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#8b5cf6" /> アシスト 無制限</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#8b5cf6" /> 施設・入居者管理機能</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#8b5cf6" /> LINE通知・予約フォーム設定</li>
          </ul>

          <button 
            onClick={() => handleSubscribe(PRICE_IDS.party[billingInterval])}
            disabled={isSubscribed || isProcessing}
            style={{ 
              width: '100%', padding: '14px', borderRadius: '12px',
              cursor: (isSubscribed || isProcessing) ? 'not-allowed' : 'pointer',
              background: isSubscribed ? '#e2e8f0' : '#8b5cf6',
              color: isSubscribed ? '#94a3b8' : '#fff', border: 'none', fontWeight: 'bold'
            }}
          >
            {isProcessing ? '処理中...' : isSubscribed ? '契約中' : 'パーティーで契約'}
          </button>
        </div>

        {/* 3. ギルド */}
        <div style={{ 
          background: '#fff', borderRadius: '24px', padding: '30px', 
          border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <ShieldCheck size={22} color="#059669" />
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>ギルド</h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748b' }}>大規模店舗・複数拠点向け</p>

          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '20px' }}>
            {billingInterval === 'month' ? '¥15,000' : '¥165,000'}
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'normal' }}>
              /{billingInterval === 'month' ? '月' : '年'}
            </span>
          </div>

          <ul style={{ padding: 0, margin: '0 0 30px', listStyle: 'none', color: '#475569', fontSize: '0.9rem', flexGrow: 1 }}>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#059669" /> プレイヤー・アシスト 無制限</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#059669" /> 全機能フル解放</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#059669" /> 優先サポート</li>
          </ul>

          <button 
            onClick={() => handleSubscribe(PRICE_IDS.guild[billingInterval])}
            disabled={isSubscribed || isProcessing}
            style={{ 
              width: '100%', padding: '14px', borderRadius: '12px',
              cursor: (isSubscribed || isProcessing) ? 'not-allowed' : 'pointer',
              background: isSubscribed ? '#e2e8f0' : '#059669',
              color: isSubscribed ? '#94a3b8' : '#fff', border: 'none', fontWeight: 'bold'
            }}
          >
            {isProcessing ? '処理中...' : isSubscribed ? '契約中' : 'ギルドで契約'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default BillingSettings;