import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import bcrypt from 'bcryptjs';
import { 
  Settings, Shield, Palette, Layout, Save, 
  ArrowLeft, CheckCircle2, RefreshCcw // 🆕 RefreshCcwを追加
} from 'lucide-react';

const GeneralSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900; 

  const [themeColor, setThemeColor] = useState('#2563eb');
  const [extraSlotsBefore, setExtraSlotsBefore] = useState(0);
  const [extraSlotsAfter, setExtraSlotsAfter] = useState(0);
  const [autoSalesMatching, setAutoSalesMatching] = useState(false); // 🆕 自動売上確定のState
  const [allowBatchMatching, setAllowBatchMatching] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => { if (shopId) fetch(); }, [shopId]);

  const fetch = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data);
      setThemeColor(data.theme_color || '#2563eb');
      setExtraSlotsBefore(data.extra_slots_before || 0);
      setExtraSlotsAfter(data.extra_slots_after || 0);
      setAutoSalesMatching(data.auto_sales_matching || false);
      setAllowBatchMatching(data.allow_batch_matching || false);
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      theme_color: themeColor,
      extra_slots_before: extraSlotsBefore,
      extra_slots_after: extraSlotsAfter,
      auto_sales_matching: autoSalesMatching,
      allow_batch_matching: allowBatchMatching
    }).eq('id', shopId);

    if (!error) showMsg('全般設定を保存しました！');
    else alert('保存に失敗しました。');
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 8) { alert("セキュリティのため、パスワードは8文字以上に設定してください。"); return; }
    if (window.confirm("パスワードを更新します。一度更新されると運営者もあなたのパスワードを知ることはできなくなります。よろしいですか？")) {
      const salt = bcrypt.genSaltSync(10);
      const hashed = bcrypt.hashSync(newPassword, salt);
      const { error } = await supabase.from('profiles').update({ hashed_password: hashed, admin_password: '********' }).eq('id', shopId);
      if (!error) { showMsg('パスワードを安全に更新しました！'); setNewPassword(''); setIsChangingPassword(false); }
    }
  };

  // スタイル定義
  const containerStyle = { fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', position: 'relative' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };
  const btnActiveS = (val, target) => ({ padding: '12px 5px', background: val === target ? (themeColor || '#2563eb') : '#fff', color: val === target ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' });
  
  return (
    <div style={containerStyle}>
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '30px' }}>
        <button 
          onClick={() => navigate(`/admin/${shopId}/dashboard`)}
          style={{ 
            background: '#fff', 
            border: '1px solid #e2e8f0', 
            padding: isPC ? '10px 20px' : '10px 12px', 
            borderRadius: '30px', 
            fontWeight: 'bold', 
            color: '#64748b', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: isPC ? '1rem' : '0.8rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            whiteSpace: 'nowrap'
          }}
        >
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ' : '戻る'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Settings size={28} /> 全般設定・セキュリティ
      </h2>

      {/* 🎨 外観設定 */}
      <section style={{ ...cardStyle, borderLeft: `8px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Palette size={20} /> お店のテーマカラー
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} style={{ width: '60px', height: '60px', border: 'none', background: 'none', cursor: 'pointer' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>
              メインカラー：<span style={{ color: themeColor, fontFamily: 'monospace' }}>{themeColor}</span>
            </div>
            <div style={{ marginTop: '8px', padding: '8px 16px', background: themeColor, color: '#fff', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-block' }}>
              ボタン表示サンプル
            </div>
          </div>
        </div>
      </section>

      {/* 🆕 自動処理・効率化設定 */}
<section style={{ ...cardStyle, borderLeft: `8px solid #3b82f6`, background: '#f8faff' }}>
  <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
    <RefreshCcw size={20} /> 自動処理・効率化設定
  </h3>

  {/* --- ① 一括売上確定モード（手動ボタン用） --- */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
    <div style={{ flex: 1, paddingRight: '15px' }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>
        一括売上確定モード
      </div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
        ONにすると、未処理の予約をボタン一つで一括確定できるようになります。
      </div>
    </div>
    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
      <input 
        type="checkbox" 
        checked={allowBatchMatching} 
        onChange={(e) => setAllowBatchMatching(e.target.checked)} 
        style={{ opacity: 0, width: 0, height: 0 }} 
      />
      <span style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: allowBatchMatching ? themeColor : '#cbd5e1',
        transition: '.3s', borderRadius: '34px'
      }}>
        <span style={{
          position: 'absolute', content: '""', height: '18px', width: '18px',
          left: allowBatchMatching ? '28px' : '4px', bottom: '4px',
          backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
        }}></span>
      </span>
    </label>
  </div>

  {/* --- ② 自動売上確定モード（深夜自動用） --- */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ flex: 1, paddingRight: '15px' }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>
        自動売上確定モード（深夜自動）
      </div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
        ONにすると、深夜に未処理の予約を自動的に集計します。
      </div>
    </div>
    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
      <input 
        type="checkbox" 
        checked={autoSalesMatching} 
        onChange={(e) => setAutoSalesMatching(e.target.checked)} 
        style={{ opacity: 0, width: 0, height: 0 }} 
      />
      <span style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: autoSalesMatching ? themeColor : '#cbd5e1',
        transition: '.3s', borderRadius: '34px'
      }}>
        <span style={{
          position: 'absolute', content: '""', height: '18px', width: '18px',
          left: autoSalesMatching ? '28px' : '4px', bottom: '4px',
          backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
        }}></span>
      </span>
    </label>
  </div>
</section>

      {/* 📌 管理画面の表示拡張（30分固定表示版） */}
      <section style={{ ...cardStyle, background: '#fdfcf5', border: '1px solid #eab308' }}>
        <h3 style={{ marginTop: 0, color: '#a16207', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Layout size={20} /> 管理画面の表示拡張
        </h3>
        {/* 🆕 説明文をより具体的に変更 */}
        <p style={{ fontSize: '0.75rem', color: '#854d0e', marginBottom: '20px', lineHeight: '1.5' }}>
          営業時間の前後に、個人的な予定（プライベート予定）を書き込める予備枠を表示します。<br />
          <b>※予約設定に関わらず、拡張枠は1コマ30分固定でスッキリ表示されます。</b>
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          {/* 🆕 ラベルに (30分単位) を追記 */}
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#854d0e' }}>☀ 開店前の拡張 (30分 × 数):</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <button key={n} type="button" onClick={() => setExtraSlotsBefore(n)} style={{ ...btnActiveS(extraSlotsBefore, n), width: '40px', height: '40px' }}>{n}</button>
            ))}
          </div>
          {/* 🆕 合計何分増えるか目安を表示（親切設計） */}
          {extraSlotsBefore > 0 && <span style={{ fontSize: '0.7rem', color: '#a16207', marginTop: '5px', display: 'block' }}>➔ 開店前を {extraSlotsBefore * 30}分 拡張中</span>}
        </div>

        <div>
          {/* 🆕 ラベルに (30分単位) を追記 */}
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#854d0e' }}>🌙 閉店後の拡張 (30分 × 数):</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <button key={n} type="button" onClick={() => setExtraSlotsAfter(n)} style={{ ...btnActiveS(extraSlotsAfter, n), width: '40px', height: '40px' }}>{n}</button>
            ))}
          </div>
          {/* 🆕 合計何分増えるか目安を表示 */}
          {extraSlotsAfter > 0 && <span style={{ fontSize: '0.7rem', color: '#a16207', marginTop: '5px', display: 'block' }}>➔ 閉店後を {extraSlotsAfter * 30}分 拡張中</span>}
        </div>
      </section>

      {/* 🔐 セキュリティ設定 */}
      <section style={{ ...cardStyle, border: `2px solid #1e293b` }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#1e293b', marginBottom: '20px' }}>
          <Shield size={20} /> セキュリティ設定
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
          パスワードは強力なハッシュ化により保護されます。運営者もあなたのパスワードを知ることはできません。
        </p>
        
        {!isChangingPassword ? (
          <button 
            onClick={() => setIsChangingPassword(true)} 
            style={{ width: '100%', padding: '15px', border: `1px solid #1e293b`, color: '#1e293b', background: '#fff', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
          >
            パスワードを変更する
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', animation: 'fadeIn 0.3s ease' }}>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} placeholder="新しいパスワード（8文字以上）" autoFocus />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleUpdatePassword} style={{ flex: 1, padding: '15px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>安全に保存</button>
              <button onClick={() => setIsChangingPassword(false)} style={{ flex: 1, padding: '15px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>
            </div>
          </div>
        )}
      </section>

      {/* 💾 常に浮いている保存ボタン */}
      <button 
        onClick={handleSave} 
        style={{ 
          position: 'fixed', bottom: '24px', right: '24px', 
          padding: '18px 40px', background: themeColor, color: '#fff', 
          border: 'none', borderRadius: '50px', fontWeight: 'bold', 
          boxShadow: `0 10px 25px ${themeColor}66`, zIndex: 1000, 
          display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
          fontSize: '1.1rem'
        }}
      >
        <Save size={22} /> 全設定を保存する 💾
      </button>
    </div>
  );
};

export default GeneralSettings;