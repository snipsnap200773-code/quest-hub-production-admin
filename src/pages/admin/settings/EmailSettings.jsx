import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { Mail, ArrowLeft, Save, CheckCircle2, MessageSquare, User, Bell, Trash2, Clock, Globe, Info } from 'lucide-react';

const EmailSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('customer_booking');
  const [loading, setLoading] = useState(true);

  // --- 🆕 画面サイズ管理（しきい値を 900px に設定） ---
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPC = windowWidth > 900; 
  const [message, setMessage] = useState('');
const [shopData, setShopData] = useState(null);
  // 🆕 店主様へのメール通知自体をON/OFFするStateを追加
  const [notifyMailEnabled, setNotifyMailEnabled] = useState(true);

  const [templates, setTemplates] = useState({
    customer_booking: { sub: '', body: '' },
    // 🆕 enabled は Web予約のお客様へのリマインド用
    customer_remind: { sub: '', body: '', enabled: true },
    customer_cancel: { sub: '', body: '' },
    shop_booking: { sub: '', body: '' },
    shop_cancel: { sub: '', body: '' }
  });

  const themeColor = shopData?.theme_color || '#2563eb';

  useEffect(() => { if (shopId) fetchSettings(); }, [shopId]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
if (data) {
      setShopData(data);
      setNotifyMailEnabled(data.notify_mail_enabled ?? true);
      // ↓ 各項目が null の場合に備え || '' を徹底します
      setTemplates({
        customer_booking: { sub: data.mail_sub_customer_booking || '', body: data.mail_body_customer_booking || '' },
        customer_remind: { sub: data.mail_sub_customer_remind || '', body: data.mail_body_customer_remind || '', enabled: data.notify_mail_remind_enabled ?? true },
        customer_cancel: { sub: data.mail_sub_customer_cancel || '', body: data.mail_body_customer_cancel || '' },
        shop_booking: { sub: data.mail_sub_shop_booking || '', body: data.mail_body_shop_booking || '' },
        shop_cancel: { sub: data.mail_sub_shop_cancel || '', body: data.mail_body_shop_cancel || '' }
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      notify_mail_enabled: notifyMailEnabled, // 🆕 追加
      mail_sub_customer_booking: templates.customer_booking.sub,
      mail_body_customer_booking: templates.customer_booking.body,
      mail_sub_customer_remind: templates.customer_remind.sub,
      mail_body_customer_remind: templates.customer_remind.body,
      notify_mail_remind_enabled: templates.customer_remind.enabled,
      mail_sub_customer_cancel: templates.customer_cancel.sub,
      mail_body_customer_cancel: templates.customer_cancel.body,
      mail_sub_shop_booking: templates.shop_booking.sub,
      mail_body_shop_booking: templates.shop_booking.body,
      mail_sub_shop_cancel: templates.shop_cancel.sub,
      mail_body_shop_cancel: templates.shop_cancel.body
    }).eq('id', shopId);

    if (!error) {
      setMessage('全ての設定を保存しました！');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const insertTag = (tag) => {
    const current = templates[activeTab];
    setTemplates({ ...templates, [activeTab]: { ...current, body: current.body + tag } });
  };

const getPreview = (text) => {
    // text が空の場合は空文字を返すようにガードを入れます
    if (!text) return ''; 
    return text.replace(/{name}/g, 'お客様名')
               .replace(/{shop_name}/g, shopData?.business_name || '店名')
               .replace(/{start_time}/g, '予約日時')
               .replace(/{services}/g, 'メールの内容')
               .replace(/{cancel_url}/g, 'キャンセル用URL')
               .replace(/{official_url}/g, '公式HP/SNS')
               .replace(/{staff}/g, '担当者名');
  };

  if (loading) return null;

  // --- 🆕 スタイル：はみ出しを防止する共通設定 ---
  const boxStyle = {
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ 
      maxWidth: '1000px', 
      margin: '0 auto', 
      paddingTop: '20px',
      paddingLeft: isPC ? '20px' : '10px',
      paddingRight: isPC ? '20px' : '10px',
      paddingBottom: '120px', 
      fontFamily: 'sans-serif',
      ...boxStyle 
    }}>
      
      {/* 🔔 通知メッセージ */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', padding: '15px 30px', background: '#059669', color: '#fff', borderRadius: '50px', fontWeight: 'bold', zIndex: 10000, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          {message}
        </div>
      )}

      {/* ナビゲーション（スマホ最適化） */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', gap: '10px', ...boxStyle }}>
        <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: isPC ? '10px 20px' : '10px 12px', borderRadius: '30px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isPC ? '1rem' : '0.8rem' }}>
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ' : '戻る'}
        </button>
        <button onClick={handleSave} style={{ background: themeColor, color: '#fff', border: 'none', padding: isPC ? '12px 30px' : '10px 16px', borderRadius: '30px', fontWeight: 'bold', boxShadow: `0 4px 15px ${themeColor}44`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isPC ? '1rem' : '0.85rem' }}>
          <Save size={18} /> {isPC ? '設定を保存する' : '保存'}
        </button>
      </div>

      <h2 style={{ fontSize: isPC ? '1.5rem' : '1.2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '24px' }}>✉️ 通知メールのカスタマイズ</h2>

      {/* タブメニュー（横スクロール対応） */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '10px', WebkitOverflowScrolling: 'touch' }}>
        {[
          { id: 'customer_booking', label: '予約完了 (客)', icon: <CheckCircle2 size={16}/> },
          { id: 'customer_remind', label: 'リマインド (客)', icon: <Clock size={16}/> },
          { id: 'customer_cancel', label: 'キャンセル (客)', icon: <Trash2 size={16}/> },
          { id: 'shop_booking', label: '新着予約 (店)', icon: <Bell size={16}/> },
          { id: 'shop_cancel', label: 'キャンセル (店)', icon: <Info size={16}/> }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', background: activeTab === tab.id ? '#1e293b' : '#fff', color: activeTab === tab.id ? '#fff' : '#64748b', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', boxShadow: activeTab === tab.id ? '0 4px 10px rgba(0,0,0,0.1)' : 'none', flexShrink: 0 }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* メインレイアウト：スマホなら縦1列、PCなら横2列 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isPC ? '1fr 1fr' : '1fr', 
        gap: isPC ? '30px' : '20px',
        ...boxStyle 
      }}>
        
        {/* 左側：エディタ */}
        <div style={boxStyle}>
          <section style={{ background: '#fff', padding: isPC ? '24px' : '16px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', ...boxStyle }}>
            
{/* 🆕 お客様向けリマインド設定（Web予約者などが対象） */}
            {activeTab === 'customer_remind' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '16px', border: '1px solid #bae6fd', cursor: 'pointer' }}>
                <input type="checkbox" checked={templates.customer_remind.enabled} onChange={e => setTemplates({...templates, customer_remind: {...templates.customer_remind, enabled: e.target.checked}})} style={{ width: '22px', height: '22px' }} />
                <div>
                  <span style={{ fontWeight: 'bold', color: '#0369a1', fontSize: '0.9rem' }}>リマインドメールを自動送信する (Web予約者など)</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#0369a1', opacity: 0.8 }}>予約の24時間前に自動送信します。</span>
                </div>
              </label>
            )}

            {/* 🆕 店主様向け通知設定（Web/LINE共通のメール通知を止めるか選べる） */}
            {activeTab === 'shop_booking' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '15px', background: '#fff7ed', borderRadius: '16px', border: '1px solid #ffedd5', cursor: 'pointer' }}>
                <input type="checkbox" checked={notifyMailEnabled} onChange={e => setNotifyMailEnabled(e.target.checked)} style={{ width: '22px', height: '22px' }} />
                <div>
                  <span style={{ fontWeight: 'bold', color: '#9a3412', fontSize: '0.9rem' }}>新着予約のメール通知を受け取る</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#9a3412', opacity: 0.8 }}>店舗用メールアドレス宛に通知を送信します。</span>
                </div>
              </label>
            )}
            
<div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>件名</label>
              <input value={templates[activeTab]?.sub || ''} onChange={e => setTemplates({...templates, [activeTab]: {...templates[activeTab], sub: e.target.value}})} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }} placeholder="例: ご予約ありがとうございます" />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>本文</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {[
                  { t: '{name}', l: 'お客様名' }, { t: '{staff}', l: '担当者名' }, { t: '{start_time}', l: '予約日時' },
                  { t: '{services}', l: 'メニュー内容' }, { t: '{shop_name}', l: '店名' }, { t: '{cancel_url}', l: 'URL' }
                ].map(tag => (
                  <button key={tag.t} onClick={() => insertTag(tag.t)} style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>[{tag.l}]</button>
                ))}
              </div>
              <textarea value={templates[activeTab].body} onChange={e => setTemplates({...templates, [activeTab]: {...templates[activeTab], body: e.target.value}})} style={{ width: '100%', minHeight: isPC ? '350px' : '250px', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', lineHeight: '1.6', boxSizing: 'border-box' }} placeholder="文章を入力..." />
            </div>
            <p style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>※空欄なら三土手さん設計の標準デザインで送信されます</p>
          </section>
        </div>

        {/* 右側：ライブプレビュー（スマホでは下へ、PCでは横に固定） */}
        <div style={boxStyle}>
          <div style={{ position: isPC ? 'sticky' : 'relative', top: isPC ? '20px' : '0', ...boxStyle }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><MessageSquare size={18} /> プレビュー</h3>
            <div style={{ background: '#fff', borderRadius: '24px', border: isPC ? '8px solid #1e293b' : '4px solid #1e293b', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', ...boxStyle }}>
              <div style={{ padding: '15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>件名:</span>
                <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.9rem' }}>{getPreview(templates[activeTab].sub) || '(件名)'}</div>
              </div>
              <div style={{ padding: '20px', height: isPC ? '480px' : '300px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: '#334155', fontSize: '0.85rem', lineHeight: '1.7' }}>
                {getPreview(templates[activeTab].body) || 'ここに本文のプレビューが表示されます。'}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmailSettings;