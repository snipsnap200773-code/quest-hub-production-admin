import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { ArrowLeft, Share2, Copy, Check, QrCode, Globe, Calendar, MessageCircle, ExternalLink, X, Settings } from 'lucide-react';

const ShareLinks = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [shopData, setShopData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [qrUrl, setQrUrl] = useState(null); // QRコード表示用
  
  // 画面サイズ管理
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900;

  useEffect(() => {
    fetchData();
  }, [shopId]);

  const fetchData = async () => {
    // 店舗基本情報の取得
    const { data: profile } = await supabase.from('profiles').select('business_name, theme_color').eq('id', shopId).single();
    if (profile) setShopData(profile);

    // カテゴリ（屋号別URL）の取得
    const { data: cats } = await supabase
      .from('service_categories')
      .select('name, url_key, custom_shop_name')
      .eq('shop_id', shopId)
      .neq('url_key', '')
      .not('url_key', 'is', null);
    if (cats) setCategories(cats);
  };

  const themeColor = shopData?.theme_color || '#2563eb';
  
  // 🚀 修正：お客様用(portal)と管理者用(admin)のURLを明確に分離
  const portalBaseUrl = 'https://questhub-portal.vercel.app';
  const adminBaseUrl = window.location.origin;

  // コピー機能
  const handleCopy = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // スタイル定義
  const containerStyle = { fontFamily: 'sans-serif', width: '100%', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '50px', boxSizing: 'border-box' };
  const cardStyle = { marginBottom: '25px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box', overflow: 'hidden' };
  const linkBoxStyle = { background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box' };
  const urlTextStyle = { fontSize: '0.85rem', color: '#334155', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', overflowX: 'auto', whiteSpace: 'nowrap', fontFamily: 'monospace', width: '100%', boxSizing: 'border-box' };

  // URL項目を描画する共通コンポーネント
  const LinkItem = ({ id, label, url, icon, highlight = false }) => (
    <div style={{ ...linkBoxStyle, border: highlight ? `2px solid ${themeColor}44` : '1px solid #cbd5e1', background: highlight ? `${themeColor}08` : '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: highlight ? themeColor : '#1e293b' }}>
        {icon} {label}
      </div>
      <div style={urlTextStyle}>{url}</div>
      {/* 🚀 修正：スマホの極小画面でもボタンがはみ出さないように flexWrap を追加 */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => handleCopy(url, id)} 
          style={{ flex: '1 1 150px', padding: '10px', background: copiedId === id ? '#10b981' : '#fff', color: copiedId === id ? '#fff' : '#475569', border: `1px solid ${copiedId === id ? '#10b981' : '#cbd5e1'}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s', boxSizing: 'border-box' }}
        >
          {copiedId === id ? <Check size={16} /> : <Copy size={16} />} 
          {copiedId === id ? 'コピーしました！' : 'URLをコピー'}
        </button>
        <button 
          onClick={() => setQrUrl(url)} 
          style={{ flex: '1 1 100px', padding: '10px 15px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}
        >
          <QrCode size={16} /> QR表示
        </button>
      </div>
    </div>
  );

  return (
    <div style={containerStyle}>
      {/* 🚀 ナビゲーションヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button 
          onClick={() => navigate(`/admin/${shopId}/dashboard`)}
          style={{ background: '#fff', border: '1px solid #e2e8f0', padding: isPC ? '10px 20px' : '10px 12px', borderRadius: '30px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: isPC ? '1rem' : '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ' : '戻る'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Share2 size={28} color={themeColor} /> リンク・シェア用URL
      </h2>

      {/* 1. お客様向けURL */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={20} color={themeColor} /> お客様ご案内用 URL
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>SNSのプロフィールや、LINEの自動返信、チラシなどに貼り付けてご活用ください。</p>

        <LinkItem 
          id="portal" label="🏠 店舗詳細ページ（ポータルTOP）" 
          url={`${portalBaseUrl}/shop/${shopId}/detail`} icon={<Globe size={18} />} highlight={true} 
        />
        <LinkItem 
          id="reserve" label="📅 総合予約フォーム" 
          url={`${portalBaseUrl}/shop/${shopId}/reserve`} icon={<Calendar size={18} />} 
        />
        <LinkItem 
          id="inquiry" label="✉️ お問い合わせフォーム" 
          url={`${adminBaseUrl}/shop/${shopId}/inquiry`} icon={<MessageCircle size={18} />} 
        />
      </section>

      {/* 2. ブランド・屋号別 URL (設定がある場合のみ表示) */}
      {categories.length > 0 && (
        <section style={{ ...cardStyle, borderLeft: `4px solid ${themeColor}` }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ExternalLink size={20} color={themeColor} /> 特定ブランド・屋号専用 URL
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>指定したブランドのメニューだけが表示される専用の予約・問い合わせ画面です。</p>

          {/* 2. ブランド・屋号別 URL */}
        {categories.map(cat => (
          <div key={cat.url_key} style={{ marginBottom: '20px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', color: themeColor, marginBottom: '10px' }}>
              ✨ {cat.custom_shop_name || cat.name} 専用
            </div>
            <LinkItem 
              id={`res-${cat.url_key}`} label="専用予約フォーム" 
              url={`${portalBaseUrl}/shop/${shopId}/reserve?type=${cat.url_key}`} icon={<Calendar size={16} />} 
            />
            <LinkItem 
              id={`inq-${cat.url_key}`} label="専用お問い合わせフォーム" 
              url={`${adminBaseUrl}/shop/${shopId}/inquiry?type=${cat.url_key}`} icon={<MessageCircle size={16} />} 
            />
          </div>
        ))}
        </section>
      )}

      {/* 3. 管理者用 URL */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={20} color="#64748b" /> 管理者・スタッフ用 URL
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>ご自身のスマホやPC、タブレットのブラウザで「ブックマーク（お気に入り登録）」しておくと便利です。</p>

        <LinkItem id="dash" label="📊 ダッシュボード（管理トップ）" url={`${adminBaseUrl}/admin/${shopId}/dashboard`} icon={<Settings size={18} />} />
        <LinkItem id="admin-res" label="📅 予約管理カレンダー" url={`${adminBaseUrl}/admin/${shopId}/reservations`} icon={<Calendar size={18} />} />
      </section>

      {/* 📱 QRコード表示モーダル */}
      {qrUrl && (
        <div onClick={() => setQrUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: '30px', borderRadius: '24px', textAlign: 'center', maxWidth: '350px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button onClick={() => setQrUrl(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={24} /></button>
            </div>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: '#1e293b' }}>QRコード</h3>
            <div style={{ background: '#fff', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '16px', display: 'inline-block', marginBottom: '20px' }}>
              {/* 無料のQRコード生成APIを利用 */}
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`} alt="QR Code" style={{ width: '200px', height: '200px' }} />
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all', marginBottom: '20px' }}>{qrUrl}</p>
            <button onClick={() => setQrUrl(null)} style={{ width: '100%', padding: '14px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareLinks;