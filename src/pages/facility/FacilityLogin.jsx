import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Building2, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

// 🚀 正しいEdge FunctionのURL
const EDGE_FUNCTION_URL = "https://rdpupixaqckhkpgjqcnb.supabase.co/functions/v1/resend";

const FacilityLogin = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  
  const [facilityMetadata, setFacilityMetadata] = useState(null);
  const [loginId, setLoginId] = useState(''); 
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const initLoginScreen = async () => {
      // 🚀 1. まずは「すでにログイン済みか」をチェック
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.user) {
        // 🚀 2. ログイン済みなら、プロフィールを取得してリダイレクト
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          console.log("💎 有効なセッションを検出しました。自動ログインします。");
          // セッションストレージにも念のためフラグを立てる（既存のガード用）
          sessionStorage.setItem(`auth_${profile.id}`, 'true');
          
          if (profile.role === 'super_admin') {
            navigate('/super-admin-216-midote-snipsnap-dmaaaahkmm');
          } else {
            navigate(`/admin/${profile.id}/dashboard`);
          }
          return; // リダイレクトするので、これ以降の処理（読み込み中解除など）は不要
        }
      }

      // 💡 以下は「ログインしていない場合」のみ実行される
      if (facilityId) {
        const { data } = await supabase
          .from('facility_users')
          .select('facility_name, login_id')
          .eq('id', facilityId)
          .maybeSingle(); 
        
        if (data) {
          setFacilityMetadata(data);
          setLoginId(data.login_id);
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
      
      // A. Supabase Auth ログイン試行（正規ルート）
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginId,
        password: password,
      });

      if (!authError && authData.user) {
        // ✅ 正常にAuthで入れた場合
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, business_name')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profile) {
          sessionStorage.setItem(`auth_${profile.id}`, 'true');
          
          if (profile.role === 'super_admin') {
            sessionStorage.setItem('auth_super', 'true');
            // ポップアップなしで即移動
            navigate('/super-admin-216-midote-snipsnap-dmaaaahkmm');
          } else {
            setIsProcessing(false);
            // ポップアップなしで即移動
            navigate(`/admin/${profile.id}/dashboard`);
          }
          return;
        }
      }

      // B. 救済 ＆ パスワード同期チェック
      const { data: shopUser } = await supabase
        .from('profiles')
        .select('id, business_name, role, admin_password')
        .eq('email_contact', loginId)
        .eq('admin_password', password)
        .maybeSingle();

      if (shopUser) {
        // DBのパスワードとは合っているが、Authで弾かれた場合（＝パスワードがズレている）
        console.log("🛠️ 認証のズレを検知。お引越し（または同期）を試みます...");
        
        // バトンをセット
        sessionStorage.setItem(`auth_${shopUser.id}`, 'true'); 

        try {
          const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'REPAIR_AUTH', // 🚀 ここを REPAIR_AUTH に変えるとより確実です
              shopId: shopUser.id,
              email: loginId,
              password: password,
              shopName: shopUser.business_name
            })
          });

          if (!response.ok) {
            console.warn("Auth sync skipped or failed, but DB password matched.");
          }
          // alertを削除
        } catch (err) {
          console.error("Sync Error:", err);
        }

        setIsProcessing(false);
        navigate(`/admin/${shopUser.id}/dashboard`);
        return;
      } else {
        alert('ログインIDまたはパスワードが正しくありません。');
        setIsProcessing(false);
      }

    } else {
      // --- 🏢 施設ログイン ---
      const { data: facilityUser, error: facilityError } = await supabase
        .from('facility_users')
        .select('id, facility_name')
        .eq('login_id', loginId)
        .eq('password', password)
        .maybeSingle();

      if (facilityUser && !facilityError) {
        sessionStorage.setItem('facility_user_id', facilityUser.id);
        sessionStorage.setItem(`facility_auth_active`, 'true');
        // alertを削除して即移動
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
        <h1 style={titleStyle}>{facilityMetadata?.facility_name || "QUEST HUB Admin"}</h1>
        <p style={subtitleStyle}>マルチ管理ポータルログイン</p>

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
    </div>
  );
};

// スタイル定義（変更なし）
const bgStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', padding: '20px' };
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

export default FacilityLogin;