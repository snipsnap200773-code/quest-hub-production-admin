import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Search, Store, Send, CheckCircle2, 
  MapPin, ArrowRight, ChevronLeft,
  AlertCircle, Phone, Mail,
  User, Link2, ExternalLink
} from 'lucide-react';

const ShopSearch = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  
  const [shops, setShops] = useState([]);
  const [connections, setConnections] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [facility, setFacility] = useState(null); // 🆕 自分の施設情報を入れる箱

  useEffect(() => {
    if (facilityId) fetchInitialData();
  }, [facilityId]);

  const fetchInitialData = async () => {
    setLoading(true);
    
    // 0. 🆕 自分の施設名を取得
    const { data: fData } = await supabase
      .from('facility_users')
      .select('facility_name')
      .eq('id', facilityId)
      .single();
    if (fData) setFacility(fData);

    // 1. 既に申請・提携済みのリストを取得
    const { data: cData } = await supabase
      .from('shop_facility_connections')
      .select('*')
      .eq('facility_user_id', facilityId);
    setConnections(cData || []);

    // 2. 全店舗（profiles）を取得
    const { data: sData } = await supabase
      .from('profiles')
      .select('*')
      .order('business_name', { ascending: true });
    setShops(sData || []);
    
    setLoading(false);
  };

  // 施設から店舗へ提携リクエスト送信
  const sendRequest = async (shop) => { // 🆕 引数を shop オブジェクトに変更
    setLoading(true);
    const shopId = shop.id;
    
    // 過去のデータ（拒否等）があれば掃除
    await supabase.from('shop_facility_connections').delete()
      .eq('shop_id', shopId).eq('facility_user_id', facilityId);

    // 1. DBへ新規申請を登録
    const { error } = await supabase.from('shop_facility_connections').insert([
      { 
        shop_id: shopId, 
        facility_user_id: facilityId, 
        status: 'pending',
        created_by_type: 'facility' 
      }
    ]);

    if (!error) {
      // 2. 🆕 Edge Function を呼び出してメール通知を送る
      try {
        await fetch("https://vcfndmyxypgoreuykwij.supabase.co/functions/v1/resend", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            type: 'partnership_request',
            senderName: facility?.facility_name || "ある施設",
            receiverEmail: shop.email_contact || shop.email, // 店舗の通知先メール
            receiverId: shopId,
            receiverType: 'shop',
            targetUrl: `https://quest-hub-five.vercel.app/admin/${shopId}/facilities` // 承認画面への直リンク
          })
        });
      } catch (mailErr) {
        console.error("通知メール送信失敗:", mailErr);
      }

      alert(`${shop.business_name} 様へ提携リクエストを送信しました！メールでも通知しました。`);
      fetchInitialData(); 
    } else {
      alert('申請失敗: ' + error.message);
    }
    setLoading(false);
  };

  const filteredShops = shops.filter(s => 
    (s.business_name || "").includes(searchTerm) || 
    (s.business_type || "").includes(searchTerm)
  );

  if (loading) return <div style={centerStyle}>提携可能な業者を探しています...</div>;

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}><ChevronLeft size={20} /> 戻る</button>
        <h1 style={titleStyle}>新しい業者を探す</h1>
        <p style={subTitleStyle}>
          施設に訪問可能な美容室・歯科・マッサージ等の業者を検索して提携を依頼できます。
        </p>
      </header>

      {/* 検索窓 */}
      <div style={searchBoxStyle}>
        <Search size={18} style={searchIconStyle} />
        <input 
          placeholder="店名や業種（美容、歯科など）で検索" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchInputStyle}
        />
      </div>

      <div style={listStyle}>
        {filteredShops.map(s => {
          const connection = connections.find(c => c.shop_id === s.id);
          const themeColor = s.theme_color || "#4f46e5";
          
          return (
            <div key={s.id} style={shopCardStyle}>
              {/* 1. ヘッダー：アイコンと店名 */}
              <div style={cardHeaderStyle}>
                <div style={{...iconBoxStyle, background: themeColor + '15'}}>
                  <Store size={20} color={themeColor} />
                </div>
                <div style={infoStyle}>
                  <h3 style={shopNameStyle}>{s.business_name}</h3>
                  <div style={{...typeTagStyle, background: themeColor + '10', color: themeColor}}>
                    {s.business_type || '未設定'}
                  </div>
                </div>
              </div>

              {/* 2. 🆕 店舗詳細エリア：タップで即アクション可能 */}
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', border: '1px solid #eef2ff' }}>
                
                {/* 代表者名 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#475569' }}>
                  <User size={16} color={themeColor} /> 
                  <span>代表：<strong>{s.owner_name || '未登録'}</strong></span>
                </div>

                {/* 住所 ＆ Googleマップ連携 */}
                {s.address && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: '#475569' }}>
                    <MapPin size={16} color={themeColor} style={{ marginTop: '2px' }} /> 
                    <div style={{ flex: 1 }}>
                      <div style={{ lineHeight: '1.4' }}>{s.address}</div>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ fontSize: '0.75rem', color: themeColor, fontWeight: 'bold', textDecoration: 'none', marginTop: '6px', display: 'inline-block', background: '#fff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      >
                        Googleマップで場所を確認
                      </a>
                    </div>
                  </div>
                )}

                {/* 電話番号（即発信） */}
                {s.phone && (
                  <a href={`tel:${s.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: themeColor, textDecoration: 'none', fontWeight: 'bold' }}>
                    <Phone size={16} /> {s.phone} 
                    <span style={{ fontSize: '0.65rem', fontWeight: 'normal', opacity: 0.7 }}>(タップで電話)</span>
                  </a>
                )}

                {/* 💡 メールアドレスは三土手さんの方針通り、あえて表示しません */}

                {/* 公式サイト */}
                {s.official_url && (
                  <a href={s.official_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: themeColor, textDecoration: 'none', borderTop: '1px solid #eef2ff', paddingTop: '10px', marginTop: '4px' }}>
                    <Link2 size={16} /> 公式サイトを表示 <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* 3. アクションエリア */}
              <div style={actionAreaStyle}>
                {connection ? (
                  <div style={statusBadgeStyle(connection.status)}>
                    {connection.status === 'active' ? (
                      <><CheckCircle2 size={18} /> 提携済み</>
                    ) : (
                      <>
                        <Send size={18} /> 
                        {connection.created_by_type === 'shop' ? '提携申請が届いています' : '承認待ちです'}
                      </>
                    )}
                  </div>
                ) : (
                  <button onClick={() => sendRequest(s)} style={{...requestBtnStyle, background: themeColor}}>
                    この店舗に提携リクエストを送る <ArrowRight size={18} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredShops.length === 0 && (
          <div style={emptyStyle}>
            <AlertCircle size={40} color="#cbd5e1" />
            <p>該当する業者が見つかりませんでした。</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- スタイル定義 ---
const containerStyle = { maxWidth: '600px', margin: '0 auto', padding: '20px', background: '#f8fafc', minHeight: '100vh' };
const headerStyle = { marginBottom: '30px' };
const backBtnStyle = { background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '10px', padding: 0 };
const titleStyle = { fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', margin: '0 0 5px 0' };
const subTitleStyle = { fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: 1.5 };
const searchBoxStyle = { position: 'relative', marginBottom: '25px' };
const searchIconStyle = { position: 'absolute', left: '15px', top: '15px', color: '#94a3b8' };
const searchInputStyle = { width: '100%', padding: '15px 15px 15px 45px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' };
const listStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const shopCardStyle = { background: '#fff', padding: '20px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' };
const cardHeaderStyle = { display: 'flex', gap: '15px', marginBottom: '15px' };
const iconBoxStyle = { width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const infoStyle = { flex: 1 };
const shopNameStyle = { margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' };
const typeTagStyle = { fontSize: '0.7rem', color: '#6366f1', fontWeight: 'bold', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px', display: 'inline-block' };
const contactAreaStyle = { background: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '6px' };
const contactItemStyle = { fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' };
const actionAreaStyle = { borderTop: '1px solid #f1f5f9', paddingTop: '15px' };
const requestBtnStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: 'none', background: '#1e293b', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
const statusBadgeStyle = (status) => ({
  width: '100%', padding: '14px', borderRadius: '14px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  background: status === 'active' ? '#ecfdf5' : '#fff7ed',
  color: status === 'active' ? '#10b981' : '#f97316',
  border: `1px solid ${status === 'active' ? '#10b981' : '#f97316'}`
});
const emptyStyle = { textAlign: 'center', padding: '60px 20px', color: '#94a3b8' };
const centerStyle = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };

export default ShopSearch;