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

    // 3. 施設を取得
    // ⚠️ 2026/09/24【BW】：本体（facility_users）を直接読むのをやめ、公開用ビューに切り替えました。
    //    9/8 に本体を閉じてから、店舗からは施設が1件も読めず、この画面は常に空でした。
    //    （本体は select('*') だったため、開いていた頃は施設の平文パスワードまで店舗に渡っていました）
    //    業種の絞り込みは下の filteredFacilities で行います。
    //    従来の DB 側の条件は「受け付ける業種に含まれていない施設」を出す逆の判定でした。
    const { data: fData, error: fError } = await supabase
      .from('facility_users_public')
      .select('id, facility_name, address, tel, contact_name, official_url, allowed_categories, is_suspended')
      .order('facility_name', { ascending: true });
    if (fError) console.error('施設一覧の取得に失敗:', fError.message);
    // 停止中の施設は出さない
    setFacilities((fData || []).filter(f => !f.is_suspended));
    
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
      // 2. Edge Function を呼び出して施設へメール通知を送る
      // ⚠️ 2026/09/24【BW】：通知の呼び出しを作り直しました。
      //    従来は存在しない type（partnership_request）で呼んでいたため常に 400 で、
      //    施設に通知が届いていませんでした。宛先（施設のメール）もブラウザの値を送っていました。
      //    今は shopId / facilityId だけを送り、resend が DB から宛先と名前を引きます。
      //    ログイン中の店舗の JWT が付くので、resend 側で「店舗本人か」を確認できます。
      try {
        const { error: mailErr } = await supabase.functions.invoke('resend', {
          body: {
            type: 'partnership_requested',
            shopId: shopId,
            facilityId: facilityId
          }
        });
        if (mailErr) console.error("通知メール送信失敗:", mailErr);
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

  // ⚠️ 2026/09/24【BW】：自分の業種（sub_business_type）を配列にそろえる
  //    （配列・カンマ区切りの文字列のどちらでも扱えるようにする）
  const mySubTypes = (() => {
    const v = myProfile?.sub_business_type;
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v) return v.split(/,|、/).map(s => s.trim()).filter(Boolean);
    return [];
  })();

  // 🔍 絞り込み
  const filteredFacilities = facilities.filter(f => {
    // 検索ワードに一致するか
    const matchSearch = (f.facility_name || '').includes(searchTerm);

    // ⚠️ 2026/09/24【BW】：allowed_categories は施設が「受け付ける業種」のリスト。
    //    自分の業種が含まれていれば表示する。未設定（null）は全業種OK（施設の設定画面と同じ扱い）。
    //    従来は判定が逆で、受け付けてくれる施設ほど一覧から消えていました。
    const allowed = f.allowed_categories;
    const isAllowed = !Array.isArray(allowed) || mySubTypes.some(t => allowed.includes(t));

    return matchSearch && isAllowed;
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