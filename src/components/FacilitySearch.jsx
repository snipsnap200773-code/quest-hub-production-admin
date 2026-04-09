import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Search, Building2, Send, CheckCircle2, 
  MapPin, Filter, ArrowRight, ChevronLeft,
  AlertCircle,
  User, Phone, Mail, Link2, ExternalLink
} from 'lucide-react';
import { INDUSTRY_PRESETS } from '../constants/industryMaster';

// --- 2. ここからコンポーネント（工場）の開始 ---
const FacilitySearch = () => {
  // --- 3. 道具（Hook）の使用は、必ずこの「中」で宣言する ---
  const { shopId } = useParams(); 
  const navigate = useNavigate();
  
  const [facilities, setFacilities] = useState([]);
  const [connections, setConnections] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [myProfile, setMyProfile] = useState(null);

  // --- 4. ここから下（useEffect以降）は以前のコードと同じです ---
  useEffect(() => {
    if (shopId) fetchInitialData();
  }, [shopId]);

  const fetchInitialData = async () => {
    setLoading(true);
    // 1. 店舗情報（自分のサブ業種を含む）を取得
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    setMyProfile(pData);

    // 2. 既に申請・提携済みのリストを取得
    const { data: cData } = await supabase.from('shop_facility_connections').select('*').eq('shop_id', shopId);
    setConnections(cData || []);

    // 3. 施設を取得（自分を制限していない施設のみ）
    // 🚀 🆕 自分のカテゴリが 施設側の allowed_categories（制限リスト）に含まれていないものを抽出
    let query = supabase.from('facility_users').select('*').order('facility_name', { ascending: true });
    
    if (pData?.sub_business_type) {
      // 🚀 🆕 allowed_categories（配列）の中に自分の業種が「含まれていない(not contains)」施設を探す
      query = query.not('allowed_categories', 'cs', `{"${pData.sub_business_type}"}`);
    }

    const { data: fData } = await query;
    setFacilities(fData || []);
    
    setLoading(false);
  };

  // 提携リクエスト送信
  const sendRequest = async (facility) => { // 🆕 引数を施設オブジェクトに変更
    setLoading(true);
    const facilityId = facility.id;

    // 1. DBへ新規申請を登録
    const { error } = await supabase.from('shop_facility_connections').insert([
      { 
        shop_id: shopId, 
        facility_user_id: facilityId, 
        status: 'pending',
        created_by_type: 'shop' 
      }
    ]);

    if (!error) {
      // 2. 🆕 Edge Function を呼び出して施設へメール通知を送る
      try {
        await fetch("https://vcfndmyxypgoreuykwij.supabase.co/functions/v1/resend", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            type: 'partnership_request',
            senderName: myProfile?.business_name || "ある店舗",
            receiverEmail: facility.email, // 施設の登録メールアドレス
            receiverId: facilityId,
            receiverType: 'facility',
            targetUrl: `https://quest-hub-five.vercel.app/facility-login/${facilityId}` // 施設側のログイン/受付設定画面へ
          })
        });
      } catch (mailErr) {
        console.error("通知メール送信失敗:", mailErr);
      }

      alert(`【${facility.facility_name}】様へ提携リクエストを送信しました！`);
      fetchInitialData(); 
    } else {
      alert('申請失敗: ' + error.message);
    }
    setLoading(false);
  };

  // 🔍 industryMasterに基づいたフィルタリングロジック
  const filteredFacilities = facilities.filter(f => {
    // 検索ワードに一致するか
    const matchSearch = f.facility_name.includes(searchTerm);
    
    // 🚀 🆕 施設側の拒否設定（allowed_categories）に自分の業種が含まれて「いない」かチェック
    // ※ DB取得時にフィルタしていますが、念のためUI側でもチェックします。
    const isRestricted = f.allowed_categories?.includes(myProfile?.sub_business_type);

    return matchSearch && !isRestricted;
  });

  if (loading) return <div style={centerStyle}>募集中の施設を探しています...</div>;

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}><ChevronLeft size={20} /> 戻る</button>
        <h1 style={titleStyle}>新規施設を開拓する</h1>
        <p style={subTitleStyle}>
          あなたの業種（<strong>{myProfile?.business_type}</strong>）を募集中、または提携可能な施設です。
        </p>
      </header>

      {/* 検索窓 */}
      <div style={searchBoxStyle}>
        <Search size={18} style={searchIconStyle} />
        <input 
          placeholder="施設名で検索" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchInputStyle}
        />
      </div>

      <div style={listStyle}>
        {filteredFacilities.map(f => {
          const connection = connections.find(c => c.facility_user_id === f.id);
          
          return (
            <div key={f.id} style={facilityCardStyle}>
              {/* 1. ヘッダー：アイコンと施設名 */}
              <div style={cardHeaderStyle}>
                <div style={iconBoxStyle}><Building2 size={20} color="#4f46e5" /></div>
                <div style={infoStyle}>
                  <h3 style={facilityNameStyle}>{f.facility_name}</h3>
                  <div style={statusTagStyle}>現在募集中</div>
                </div>
              </div>

              {/* 2. 🆕 施設詳細情報エリア（タップで即アクション可能） */}
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', border: '1px solid #eef2ff' }}>
                
                {/* 担当者名 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#475569' }}>
                  <User size={14} color="#4f46e5" /> 
                  <span>担当：<strong>{f.contact_name || '未登録'}</strong></span>
                </div>

                {/* 住所 ＆ Googleマップ連携 */}
                {f.address && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', color: '#475569' }}>
                    <MapPin size={14} color="#4f46e5" style={{marginTop: '2px'}} /> 
                    <div style={{flex: 1}}>
                      <div style={{lineHeight: '1.4'}}>{f.address}</div>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 'bold', textDecoration: 'none', marginTop: '4px', display: 'inline-block' }}
                      >
                        Googleマップで場所を確認
                      </a>
                    </div>
                  </div>
                )}

                {/* 電話（即発信リンク） */}
                {f.tel && (
                  <a href={`tel:${f.tel}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 'bold' }}>
                    <Phone size={14} /> {f.tel} <span style={{fontSize:'10px', fontWeight:'normal', opacity: 0.7}}>(タップで発信)</span>
                  </a>
                )}

                {/* 公式サイト */}
                {f.official_url && (
                  <a href={f.official_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#4f46e5', textDecoration: 'none' }}>
                    <Link2 size={14} /> 公式サイトを表示 <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* 3. アクションエリア */}
              <div style={actionAreaStyle}>
                {connection ? (
                  <div style={statusBadgeStyle(connection.status)}>
                    {connection.status === 'active' ? (
                      <><CheckCircle2 size={16} /> 提携中</>
                    ) : (
                      <>
                        <AlertCircle size={16} /> 
                        {connection.created_by_type === 'facility' ? '提携申請が届いています' : '承認待ちです'}
                      </>
                    )}
                  </div>
                ) : (
                  <button onClick={() => sendRequest(f)} style={requestBtnStyle}>
                    この施設に提携リクエストを送る <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredFacilities.length === 0 && (
          <div style={emptyStyle}>
            <AlertCircle size={40} color="#cbd5e1" />
            <p>条件に合う施設が見つかりませんでした。</p>
            <span style={{fontSize: '0.75rem'}}>募集を停止している、または全施設と提携済みです。</span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- スタイル定義（省略なし） ---
const containerStyle = { maxWidth: '600px', margin: '0 auto', padding: '20px', background: '#f8fafc', minHeight: '100vh' };
const headerStyle = { marginBottom: '30px' };
const backBtnStyle = { background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '10px', padding: 0 };
const titleStyle = { fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', margin: '0 0 5px 0' };
const subTitleStyle = { fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: 1.5 };

const searchBoxStyle = { position: 'relative', marginBottom: '25px' };
const searchIconStyle = { position: 'absolute', left: '15px', top: '15px', color: '#94a3b8' };
const searchInputStyle = { width: '100%', padding: '15px 15px 15px 45px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', boxSizing: 'border-box' };

const listStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const facilityCardStyle = { background: '#fff', padding: '20px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' };
const cardHeaderStyle = { display: 'flex', gap: '15px', marginBottom: '20px' };
const iconBoxStyle = { width: '48px', height: '48px', background: '#f5f7ff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const infoStyle = { flex: 1 };
const facilityNameStyle = { margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' };
const statusTagStyle = { fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px', display: 'inline-block' };

const actionAreaStyle = { borderTop: '1px solid #f1f5f9', paddingTop: '15px' };
const requestBtnStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: 'none', background: '#1e293b', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };

const statusBadgeStyle = (status) => ({
  width: '100%', padding: '14px', borderRadius: '14px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  background: status === 'active' ? '#ecfdf5' : '#fff7ed',
  color: status === 'active' ? '#10b981' : '#f97316',
  border: `1px solid ${status === 'active' ? '#10b981' : '#f97316'}`
});

const emptyStyle = { textAlign: 'center', padding: '60px 20px', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' };
const centerStyle = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };

export default FacilitySearch;