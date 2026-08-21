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
  const [recommendedPlan, setRecommendedPlan] = useState('party'); // 👈 🌟 🆕 おすすめプラン保持用

  // 🔑 Stripeで取得した Price ID をここに設定します
  const PRICE_IDS = {
    solopreneur: {
      month: 'price_1U6RBXR8TkJjdX3BjaMVhWDV',
      year: 'price_1U6RD6R8TkJjdX3BKFkTBCKs',
    },
    party: {
      month: 'price_1U6RFRR8TkJjdX3BoetawkXc',
      year: 'price_1U6RGCR8TkJjdX3BmM6ucINF',
    },
    guild: {
      month: 'price_1U6RH4R8TkJjdX3BCoNHdtxu',
      year: 'price_1U6RHkR8TkJjdX3BRJS1HfG2',
    },
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. プロフィール情報の取得
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', shopId)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // 2. 👈 🌟 🆕 スタッフ情報の取得とおすすめ判定
        const { data: staffsData, error: staffsError } = await supabase
          .from('staffs')
          .select('role_type')
          .eq('shop_id', shopId);

        if (!staffsError && staffsData) {
          const stylistCount = staffsData.filter(s => s.role_type === 'stylist').length;
          const assistantCount = staffsData.filter(s => s.role_type === 'assistant').length;

          // 判定ロジック
          if (stylistCount > 5) {
            setRecommendedPlan('guild');
          } else if (stylistCount > 1 || assistantCount > 1) {
            setRecommendedPlan('party');
          } else {
            setRecommendedPlan('solopreneur');
          }
        }
      } catch (err) {
        console.error("データ取得エラー:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [shopId]);

  // 👇 🌟 🆕 プランごとの上限設定を定義
  const PLAN_LIMITS = {
    solopreneur: { stylist: 1, assistant: 1 },
    party: { stylist: 5, assistant: Infinity },
    guild: { stylist: Infinity, assistant: Infinity },
  };

  // 👇 🌟 🆕 引数に「どのプランに変更しようとしているか(targetPlan)」を追加
  const handleSubscribe = async (priceId, targetPlan) => {
    if (!priceId) return;
    setIsProcessing(true);

    try {
      // 1. ダウングレード時の上限チェック
      const limit = PLAN_LIMITS[targetPlan];
      
      if (limit) {
        // 現在のスタッフ一覧を取得
        const { data: staffs, error } = await supabase
          .from('staffs')
          .select('role_type')
          .eq('shop_id', shopId);

        if (error) throw error;

        const stylistCount = staffs.filter(s => s.role_type === 'stylist').length;
        const assistantCount = staffs.filter(s => s.role_type === 'assistant').length;

        // 上限を超えているか判定
        if (stylistCount > limit.stylist || assistantCount > limit.assistant) {
          const planName = targetPlan === 'solopreneur' ? 'ソロプレナー' : (targetPlan === 'party' ? 'パーティー' : 'ギルド');
          const limitAsstStr = limit.assistant === Infinity ? '無制限' : `${limit.assistant}名`;
          
          alert(
            `【プランを変更できません】\n\n` +
            `現在の登録スタッフ数（技術者 ${stylistCount}名 / アシスト ${assistantCount}名）が、\n` +
            `${planName}プランの上限（技術者 ${limit.stylist}名 / アシスト ${limitAsstStr}）を超えています。\n\n` +
            `スタッフ設定画面からスタッフを削除（または役割変更）してから、再度お試しください。`
          );
          setIsProcessing(false);
          return; // 🛑 処理をストップしてStripeへは行かせない
        }
      }

      // 2. 問題なければStripeチェックアウトへ遷移
      await redirectToCheckout(priceId, shopId);
      
    } catch (err) {
      console.error('プラン変更エラー:', err);
      alert('エラーが発生しました。時間を置いて再度お試しください。');
    }
    
    setIsProcessing(false);
  };

  if (isLoading) {
    return <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>読み込み中...</div>;
  }

  // 👇 🌟 🆕 バッジ描画用関数を追加
  const renderRecommendedBadge = (planName, color) => {
    if (recommendedPlan !== planName) return null;
    return (
      <div style={{ 
        position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
        background: color, color: '#fff', padding: '4px 16px', borderRadius: '20px',
        fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px', zIndex: 1
      }}>RECOMMENDED</div>
    );
  };

  const isSubscribed = profile?.subscription_status === 'active';
  const isTrialing = profile?.subscription_status === 'trialing'; // 👈 🌟 🆕 トライアル中判定
  const currentPlan = isSubscribed ? profile?.subscription_plan : null;

  // 👈 🌟 🆕 日付を「○月○日」にフォーマットする関数
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

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
        background: isSubscribed ? '#f0fdf4' : (isTrialing ? '#eff6ff' : '#f8fafc'), 
        border: `1px solid ${isSubscribed ? '#bbf7d0' : (isTrialing ? '#bfdbfe' : '#e2e8f0')}`,
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
        ) : isTrialing ? (
          <div style={{ width: '100%' }}>
            <h3 style={{ margin: 0, color: '#1e40af', fontSize: '1.1rem' }}>無料トライアル期間中です</h3>
            <p style={{ margin: '6px 0 10px', color: '#1d4ed8', fontSize: '0.9rem' }}>
              トライアル期間：<strong>{formatDate(profile?.trial_started_at)} 〜 {formatDate(profile?.trial_ends_at)}</strong>（すべての機能をお試しいただけます）
            </p>
            
            <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: '#1e3a8a' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                ※ {formatDate(profile?.trial_ends_at)} 以降は自動的に無料版へ切り替わり、以下の機能が利用できなくなります
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.5', color: '#334155' }}>
                <li>Web予約（お客様用オンライン予約受付）</li>
                <li>LINE連携・自動通知（リマインド・サンクス）</li>
                <li>QUEST HUB 総合ポータルサイトへの掲載</li>
                {/* 👇 🌟 🆕 福祉施設連携の制限を追加 */}
                <li>福祉施設とのマッチング・提携機能</li>
              </ul>
            </div>
          </div>
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
          border: recommendedPlan === 'solopreneur' ? '2px solid #0284c7' : '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column',
          boxShadow: recommendedPlan === 'solopreneur' ? '0 10px 25px -5px rgba(2, 132, 199, 0.15)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
          position: 'relative' 
        }}>
          {renderRecommendedBadge('solopreneur', '#0284c7')} {/* 👈 🌟 追加 */}

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

          {/* 👇 🌟 🆕 共通機能一覧に書き換え */}
          <ul style={{ padding: 0, margin: '0 0 30px', listStyle: 'none', color: '#475569', fontSize: '0.9rem', flexGrow: 1 }}>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#0284c7" /> プレイヤー 1名</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#0284c7" /> アシスト 1名</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#0284c7" /> Web予約・ポータル掲載</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#0284c7" /> LINE連携・自動メール</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#0284c7" /> 福祉施設とのマッチング・提携</li>
          </ul>

          <button 
  onClick={() => handleSubscribe(PRICE_IDS.solopreneur[billingInterval], 'solopreneur')}
  disabled={currentPlan === 'solopreneur' || isProcessing}
  style={{ 
    width: '100%', padding: '14px', borderRadius: '12px',
    cursor: (currentPlan === 'solopreneur' || isProcessing) ? 'not-allowed' : 'pointer',
    background: currentPlan === 'solopreneur' ? '#e2e8f0' : '#0284c7',
    color: currentPlan === 'solopreneur' ? '#94a3b8' : '#fff', border: 'none', fontWeight: 'bold'
  }}
>
  {isProcessing ? '処理中...' : currentPlan === 'solopreneur' ? '現在ご契約中' : isSubscribed ? 'プランを変更する' : 'ソロプレナーで契約'}
</button>
        </div>

        {/* 2. パーティー (人気枠) */}
        <div style={{ 
          background: '#fff', borderRadius: '24px', padding: '30px', 
          border: recommendedPlan === 'party' ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column',
          boxShadow: recommendedPlan === 'party' ? '0 10px 25px -5px rgba(139, 92, 246, 0.15)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
          position: 'relative'
        }}>
          {renderRecommendedBadge('party', '#8b5cf6')} {/* 👈 🌟 置き換え */}

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

          {/* 👇 🌟 🆕 共通機能一覧に書き換え */}
          <ul style={{ padding: 0, margin: '0 0 30px', listStyle: 'none', color: '#475569', fontSize: '0.9rem', flexGrow: 1 }}>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#8b5cf6" /> プレイヤー 5名まで</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#8b5cf6" /> アシスト 無制限</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#8b5cf6" /> Web予約・ポータル掲載</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#8b5cf6" /> LINE連携・自動メール</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#8b5cf6" /> 福祉施設とのマッチング・提携</li>
          </ul>

          <button 
  onClick={() => handleSubscribe(PRICE_IDS.party[billingInterval], 'party')}
  disabled={currentPlan === 'party' || isProcessing}
  style={{ 
    width: '100%', padding: '14px', borderRadius: '12px',
    cursor: (currentPlan === 'party' || isProcessing) ? 'not-allowed' : 'pointer',
    background: currentPlan === 'party' ? '#e2e8f0' : '#8b5cf6',
    color: currentPlan === 'party' ? '#94a3b8' : '#fff', border: 'none', fontWeight: 'bold'
  }}
>
  {isProcessing ? '処理中...' : currentPlan === 'party' ? '現在ご契約中' : isSubscribed ? 'プランを変更する' : 'パーティーで契約'}
</button>
        </div>

        {/* 3. ギルド */}
        <div style={{ 
          background: '#fff', borderRadius: '24px', padding: '30px', 
          border: recommendedPlan === 'guild' ? '2px solid #059669' : '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column',
          boxShadow: recommendedPlan === 'guild' ? '0 10px 25px -5px rgba(5, 150, 105, 0.15)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
          position: 'relative'
        }}>
          {renderRecommendedBadge('guild', '#059669')} {/* 👈 🌟 追加 */}

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

          {/* 👇 🌟 🆕 共通機能一覧に書き換え */}
          <ul style={{ padding: 0, margin: '0 0 30px', listStyle: 'none', color: '#475569', fontSize: '0.9rem', flexGrow: 1 }}>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#059669" /> プレイヤー 無制限</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#059669" /> アシスト 無制限</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#059669" /> Web予約・ポータル掲載</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#059669" /> LINE連携・自動メール</li>
            <li style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}><Check size={16} color="#059669" /> 福祉施設とのマッチング・提携</li>
          </ul>

          <button 
  onClick={() => handleSubscribe(PRICE_IDS.guild[billingInterval], 'guild')}
  disabled={currentPlan === 'guild' || isProcessing}
  style={{ 
    width: '100%', padding: '14px', borderRadius: '12px',
    cursor: (currentPlan === 'guild' || isProcessing) ? 'not-allowed' : 'pointer',
    background: currentPlan === 'guild' ? '#e2e8f0' : '#059669',
    color: currentPlan === 'guild' ? '#94a3b8' : '#fff', border: 'none', fontWeight: 'bold'
  }}
>
  {isProcessing ? '処理中...' : currentPlan === 'guild' ? '現在ご契約中' : isSubscribed ? 'プランを変更する' : 'ギルドで契約'}
</button>
        </div>

      </div>
    </div>
  );
};

export default BillingSettings;