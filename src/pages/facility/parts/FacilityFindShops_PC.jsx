import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  Search, MapPin, User, ExternalLink, Send, 
  CheckCircle2, Filter, Phone, Store, Globe 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// 🚀 カテゴリの司令塔を読み込み
import { INDUSTRY_PRESETS } from '../../../constants/industryMaster';

const FacilityFindShops_PC = ({ facilityId, isMobile }) => {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [myConnections, setMyConnections] = useState([]);

  // 🚀 訪問サービスのサブカテゴリリストを取得
  const visitingSubCategories = INDUSTRY_PRESETS.visiting.subCategories;

  useEffect(() => { fetchShops(); }, []);

  const fetchShops = async () => {
    setLoading(true);
    
    // 🚀 1. 大カテゴリが「訪問サービス」かつ「施設検索公開ON」の店舗のみ取得
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('business_type', '訪問サービス')
      .eq('is_facility_searchable', true)
      .not('business_name', 'is', null);

    const { data: conns } = await supabase
      .from('shop_facility_connections')
      .select('shop_id, status')
      .eq('facility_user_id', facilityId);

    setShops(profiles || []);
    setMyConnections(conns || []);
    setLoading(false);
  };

  const handleRequest = async (shopId) => {
    const confirmReq = window.confirm("この店舗に提携リクエストを送信しますか？");
    if (!confirmReq) return;
    const { error } = await supabase.from('shop_facility_connections').insert([
      { facility_user_id: facilityId, shop_id: shopId, status: 'pending', created_by_type: 'facility' }
    ]);
    if (!error) { alert("リクエストを送信しました！"); fetchShops(); }
  };

  const filteredShops = shops.filter(shop => {
    const matchesSearch = shop.business_name.includes(searchTerm) || (shop.address || "").includes(searchTerm);
    // 🚀 sub_business_type（小カテゴリ）で絞り込み
    const matchesType = filterType === 'all' || shop.sub_business_type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) return <div style={{textAlign: 'center', padding: '100px', color: '#3d2b1f'}}>業者データを読み込み中...</div>;

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      {/* --- 検索・フィルタエリア --- */}
      <div style={filterBarStyle(isMobile)}>
        <div style={searchBoxStyle}>
          <Search size={20} style={searchIconStyle} />
          <input 
            placeholder="店舗名やエリアで検索" 
            style={searchInputStyle}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={typeFilterStyle}>
          <Filter size={18} color="#c5a059" />
          <select style={selectStyle} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">すべての専門ジャンル</option>
            {visitingSubCategories.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- 業者グリッド --- */}
      <div style={gridStyle(isMobile)}>
        {filteredShops.length > 0 ? filteredShops.map(shop => {
          const conn = myConnections.find(c => c.shop_id === shop.id);
          const isPending = conn?.status === 'pending';
          const isActive = conn?.status === 'active';
          const themeColor = shop.theme_color || '#c5a059';

          return (
            <motion.div key={shop.id} whileHover={{ y: -5 }} style={shopCardStyle(themeColor)}>
              <div style={cardHeaderStyle}>
                <div style={iconBadgeStyle(themeColor)}><Store size={22} color="#fff" /></div>
                <div style={{ flex: 1, marginLeft: '15px' }}>
                   <span style={typeTagStyle(themeColor)}>{shop.sub_business_type || '訪問サービス'}</span>
                   <h3 style={shopNameStyle}>{shop.business_name}</h3>
                </div>
              </div>

              {/* 🚀 省き無しのリッチ情報ボックス */}
              <div style={richInfoBox}>
                {/* 1. 代表者 */}
                <div style={infoRow}>
                  <User size={16} color={themeColor} />
                  <span style={infoLabel}>代表：<strong>{shop.owner_name || '未登録'}</strong></span>
                </div>

                {/* 2. 住所 ＋ Googleマップボタン */}
                <div style={{ ...infoRow, alignItems: 'flex-start' }}>
                  <MapPin size={16} color={themeColor} style={{ marginTop: '3px' }} />
                  <div style={{ flex: 1 }}>
                    <span style={infoLabel}>{shop.address || '住所未登録'}</span>
                    {shop.address && (
                      <div style={{marginTop: '8px'}}>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`} 
                          target="_blank" rel="noreferrer" style={googleMapsBtn}
                        >
                          Googleマップで場所を確認
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. 電話番号（タップ発信） */}
                {shop.phone && (
                  <div style={infoRow}>
                    <Phone size={16} color={themeColor} />
                    <a href={`tel:${shop.phone}`} style={phoneLinkStyle(themeColor)}>
                      {shop.phone} <span style={{fontSize:'10px', fontWeight:'normal', color:'#94a3b8'}}>(タップで電話)</span>
                    </a>
                  </div>
                )}

                {/* 4. 公式サイト */}
                {shop.official_url && (
                  <div style={{ ...infoRow, borderTop: '1px solid #eee', paddingTop: '10px', marginTop: '5px' }}>
                    <Globe size={16} color="#64748b" />
                    <a href={shop.official_url} target="_blank" rel="noreferrer" style={siteLinkStyle}>
                      公式サイトを表示 <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>

              {/* 紹介文 */}
              <div style={descriptionBox}>
                <p style={descriptionText}>{shop.description || 'ショップの紹介文がまだありません。'}</p>
              </div>

              {/* フッター（提携ボタン） */}
              <div style={cardFooterStyle}>
                {isActive ? (
                  <div style={statusBadgeStyle('#10b981')}><CheckCircle2 size={18} /> 提携済み</div>
                ) : isPending ? (
                  <div style={statusBadgeStyle('#f59e0b')}>申請中・返信待ち</div>
                ) : (
                  <button onClick={() => handleRequest(shop.id)} style={requestBtnStyle(themeColor)}>
                    提携リクエストを送る <Send size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        }) : (
          <div style={{gridColumn:'1/-1', textAlign:'center', padding:'80px 20px', background:'#fff', borderRadius:'24px', color:'#94a3b8', border:'2px dashed #eee'}}>
            条件に一致する業者が現在見つかりませんでした。
          </div>
        )}
      </div>
    </div>
  );
};

// --- スタイル定義 ---
const filterBarStyle = (isMobile) => ({ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px', marginBottom: '30px', background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #eee' });
const searchBoxStyle = { flex: 1, position: 'relative' };
const searchIconStyle = { position: 'absolute', left: '15px', top: '15px', color: '#999' };
const searchInputStyle = { width: '100%', padding: '15px 15px 15px 45px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' };
const typeFilterStyle = { display: 'flex', alignItems: 'center', gap: '10px', background: '#fcfaf7', padding: '5px 15px', borderRadius: '12px', border: '1px solid #eee' };
const selectStyle = { border: 'none', background: 'none', fontSize: '0.9rem', fontWeight: 'bold', color: '#3d2b1f', outline: 'none', cursor: 'pointer', padding: '10px 0' };

const gridStyle = (isMobile) => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))', gap: '25px' });

const shopCardStyle = (color) => ({
  background: '#fff', borderRadius: '24px', padding: '30px', border: '1px solid #eee', 
  boxShadow: '0 10px 25px rgba(0,0,0,0.03)', borderTop: `6px solid ${color}`,
  display: 'flex', flexDirection: 'column', height: '100%'
});

const cardHeaderStyle = { display: 'flex', alignItems: 'center', marginBottom: '20px' };
const iconBadgeStyle = (color) => ({ width: '50px', height: '50px', background: color, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });
const typeTagStyle = (color) => ({ fontSize: '0.7rem', color: color, background: `${color}15`, padding: '4px 10px', borderRadius: '6px', fontWeight: '900' });
const shopNameStyle = { margin: '6px 0 0', fontSize: '1.4rem', fontWeight: '900', color: '#3d2b1f' };

const richInfoBox = { background: '#f8fafc', padding: '20px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px', border: '1px solid #eef2ff' };
const infoRow = { display: 'flex', alignItems: 'center', gap: '12px' };
const infoLabel = { fontSize: '0.95rem', color: '#475569' };
const googleMapsBtn = { fontSize: '0.75rem', color: '#fff', background: '#4f46e5', padding: '6px 14px', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-block' };
const phoneLinkStyle = (color) => ({ fontSize: '1.1rem', color: '#1e293b', textDecoration: 'none', fontWeight: '900' });
const siteLinkStyle = { fontSize: '0.9rem', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' };

const descriptionBox = { flex: 1, marginBottom: '25px' };
const descriptionText = { fontSize: '0.95rem', color: '#7f8c8d', lineHeight: '1.6', margin: 0 };

const cardFooterStyle = { marginTop: 'auto' };
const requestBtnStyle = (color) => ({ 
  width: '100%', padding: '18px', borderRadius: '16px', border: 'none', 
  background: '#1e293b', color: '#c5a059', fontWeight: '900', fontSize: '1rem', 
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
});
const statusBadgeStyle = (color) => ({ 
  width: '100%', padding: '16px', borderRadius: '16px', border: `2px solid ${color}`, 
  color: color, fontWeight: '900', textAlign: 'center', background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
});

export default FacilityFindShops_PC;