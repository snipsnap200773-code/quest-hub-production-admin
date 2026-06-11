import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Building2, Lock, User, ArrowRight, ShieldCheck, Gamepad2, Settings, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EDGE_FUNCTION_URL = "https://rdpupixaqckhkpgjqcnb.supabase.co/functions/v1/resend";

const FacilityLogin = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  
  const [facilityMetadata, setFacilityMetadata] = useState(null);
  const [loginId, setLoginId] = useState(''); 
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [showGmModal, setShowGmModal] = useState(false);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    const initLoginScreen = async () => {
      const params = new URLSearchParams(window.location.search);
      const isLogoutMode = params.get('logout') === 'true';

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.user && !isLogoutMode) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          console.log("💎 自動ログインを実行します");
          sessionStorage.setItem(`auth_${profile.id}`, 'true');
          
          if (profile.role === 'super_admin') {
            setProfileData(profile);
            setShowGmModal(true);
            setLoading(false);
          } else {
            navigate(`/admin/${profile.id}/reservations`);
          }
          return;
        }
      }

      if (facilityId) {
        const { data } = await supabase
          .from('facility_users')
          .select('facility_name, login_id')
          .eq('id', facilityId)
          .maybeSingle(); 
        
        if (data) {
          setFacilityMetadata(data);
        }
      }
      setLoading(false);
    };

    initLoginScreen();
  }, [facilityId, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    const isEmail = loginId.includes('@');

    if (isEmail) {
      console.log("=== 店舗/総括 認証プロセス開始 ===");
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginId,
        password: password,
      });

      if (!authError && authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, business_name')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profile) {
          sessionStorage.setItem(`auth_${profile.id}`, 'true');
          
          if (profile.role === 'super_admin') {
            sessionStorage.setItem('auth_super', 'true');
            setIsProcessing(false);
            setProfileData(profile);
            setShowGmModal(true);
          } else {
            setIsProcessing(false);
            navigate(`/admin/${profile.id}/reservations`);
          }
          return;
        }
      }

      const { data: shopUser } = await supabase
        .from('profiles')
        .select('id, business_name, role, admin_password')
        .eq('email_contact', loginId)
        .eq('admin_password', password)
        .maybeSingle();

      if (shopUser) {
        console.log("🛠️ 認証のズレを検知。お引越し（または同期）を試みます...");
        sessionStorage.setItem(`auth_${shopUser.id}`, 'true'); 

        try {
          const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'REPAIR_AUTH',
              shopId: shopUser.id,
              email: loginId,
              password: password,
              shopName: shopUser.business_name
            })
          });

          if (!response.ok) {
            console.warn("Auth sync skipped or failed, but DB password matched.");
          }
        } catch (err) {
          console.error("Sync Error:", err);
        }

        setIsProcessing(false);
        navigate(`/admin/${shopUser.id}/reservations`); 
        return;
      } else {
        alert('ログインIDまたはパスワードが正しくありません。');
        setIsProcessing(false);
      }

    } else {
      const { data: facilityUser, error: facilityError } = await supabase
        .from('facility_users')
        .select('id, facility_name')
        .eq('login_id', loginId)
        .eq('password', password)
        .maybeSingle();

      if (facilityUser && !facilityError) {
        localStorage.setItem('facility_user_id', facilityUser.id);
        localStorage.setItem('facility_auth_active', 'true');
        
        sessionStorage.setItem('facility_user_id', facilityUser.id);
        sessionStorage.setItem(`facility_auth_active`, 'true');
        
        navigate(`/facility-portal/${facilityUser.id}/residents`);
      } else {
        alert('施設ログインIDまたはパスワードが正しくありません。');
        setIsProcessing(false);
      }
    }
  };

  if (loading) return null;

  return (
    <div style={bgStyle}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
        <div style={iconBoxStyle}><Building2 size={32} /></div>
        <h1 style={titleStyle}>
          {facilityMetadata?.facility_name ? `${facilityMetadata.facility_name}` : "QUEST HUB Admin"}
        </h1>
        <p style={subtitleStyle}>
          {facilityMetadata?.facility_name ? "施設専用ログインポータル" : "マルチ管理総合ログイン画面"}
        </p>

        <form onSubmit={handleLogin} style={formStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>メールアドレス または 施設ID</label>
            <div style={inputWrapperStyle}>
              <User size={18} style={inputIconStyle} />
              <input type="text" required value={loginId} onChange={(e) => setLoginId(e.target.value)} style={inputStyle} placeholder="example@mail.com / facility_id" />
            </div>
          </div>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>パスワード</label>
            <div style={inputWrapperStyle}>
              <Lock size={18} style={inputIconStyle} />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="パスワードを入力" />
            </div>
          </div>
          <button type="submit" disabled={isProcessing} style={loginBtnStyle}>
            {isProcessing ? '認証中...' : <>ログインして管理画面を開く <ArrowRight size={18} /></>}
          </button>
        </form>
        <div style={footerStyle}><ShieldCheck size={14} /> 権限自動判別システム稼働中</div>
      </motion.div>

      {/* 最高統括（三土手さん）専用の行き先選択ポップアップ */}
      <AnimatePresence>
        {showGmModal && (
          <div 
            style={modalOverlayStyle}
            onClick={() => {
              // 🛠️ 修正: 背景タップ時は勝手に飛ばず、安全にポップアップを閉じてログイン画面に留まる
              setShowGmModal(false);
            }}
          >
            <motion.div 
              onClick={(e) => e.stopPropagation()} /* モーダル本体のタップでの誤爆閉じをガード */
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              style={modalCardStyle}
            >
              <div style={gmIconBoxStyle}><ShieldCheck size={36} /></div>
              <h2 style={gmTitleStyle}>最高統括・特権メニュー</h2>
              <p style={gmSubtitleStyle}>ログインに成功しました。移動する領域を選択してください。</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                {/* 選択肢1: 通常の運営管理画面 */}
                <button 
                  onClick={() => navigate('/super-admin-216-midote-snipsnap-dmaaaahkmm')}
                  style={choiceBtnAdminStyle}
                >
                  <Settings size={20} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>プラットフォーム運営管理画面</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>予約や施設データの総括管理</div>
                  </div>
                </button>

                {/* 選択肢2: GMダッシュボード */}
                <button 
                  onClick={() => navigate('/game-master-secret-dashboard')}
                  style={choiceBtnGmStyle}
                >
                  <Gamepad2 size={20} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>GAME MASTER TOOL</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>キャラクター・魔物・武具の創生と編集</div>
                  </div>
                </button>

                {/* 🛠️ 🆕 追加: ログイン画面へ安全に引き返す「戻る」ボタン */}
                <button
                  type="button"
                  onClick={() => setShowGmModal(false)}
                  style={modalCloseBtnStyle}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <ArrowLeft size={16} /> ログイン画面に戻る
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// スタイル定義
const bgStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', padding: '20px', position: 'relative' };
const cardStyle = { background: '#fff', width: '100%', maxWidth: '400px', padding: '40px 30px', borderRadius: '28px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center' };
const iconBoxStyle = { width: '64px', height: '64px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' };
const titleStyle = { fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', margin: '0 0 5px 0' };
const subtitleStyle = { fontSize: '0.85rem', color: '#64748b', marginBottom: '30px' };
const formStyle = { textAlign: 'left' };
const inputGroupStyle = { marginBottom: '25px' };
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', marginBottom: '8px' };
const inputWrapperStyle = { position: 'relative', display: 'flex', alignItems: 'center' };
const inputIconStyle = { position: 'absolute', left: '12px', color: '#94a3b8' };
const inputStyle = { width: '100%', padding: '14px 14px 14px 40px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' };
const loginBtnStyle = { width: '100%', padding: '16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const footerStyle = { marginTop: '30px', fontSize: '0.7rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' };

const modalOverlayStyle = { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', cursor: 'pointer' };
const modalCardStyle = { background: '#fff', width: '100%', maxWidth: '420px', padding: '35px 30px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' };
const gmIconBoxStyle = { width: '72px', height: '72px', background: '#fef3c7', color: '#d97706', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' };
const gmTitleStyle = { fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', margin: '0 0 8px 0', letterSpacing: '1px' };
const gmSubtitleStyle = { fontSize: '0.85rem', color: '#64748b', marginBottom: '25px', lineHeight: '1.5' };

const choiceBtnAdminStyle = { width: '100%', padding: '16px 20px', background: '#f8fafc', color: '#334155', border: '2px solid #e2e8f0', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'all 0.2s', outline: 'none' };
const choiceBtnGmStyle = { width: '100%', padding: '16px 20px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#f59e0b', border: '2px solid #1e293b', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.15)' };

// 🆕 新設した「ログインに戻る」用カスタムスタイル
const modalCloseBtnStyle = { width: '100%', padding: '12px', background: 'transparent', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold', transition: 'all 0.2s', marginTop: '5px' };

export default FacilityLogin;