import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  Store, User, MapPin, Phone, Mail, 
  Globe, ExternalLink, CalendarCheck, Trash2, CheckCircle2 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const FacilityPartnerShops_PC = ({ facilityId, isMobile }) => {
  const navigate = useNavigate();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPartners();
  }, [facilityId]);

  const fetchPartners = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shop_facility_connections')
      .select(`*, profiles (*)`)
      .eq('facility_user_id', facilityId)
      .eq('status', 'active');
    
    setPartners(data || []);
    setLoading(false);
  };

  const handleDisconnect = async (conn) => {
    const shopName = conn.profiles?.business_name;
    const inputName = window.prompt(`「${shopName}」との提携を解消しますか？\n実行する場合は店舗名を正確に入力してください：`);
    if (inputName === shopName) {
      await supabase.from('shop_facility_connections').delete().eq('id', conn.id);
      fetchPartners();
    }
  };

  if (loading) return <div style={{textAlign: 'center', padding: '50px', color: '#3d2b1f'}}>読み込み中...</div>;

  return (
    <div style={{ width: '100%' }}>
      {partners.length === 0 ? (
        <div style={emptyCardStyle}>
          <Store size={48} color="#ccc" />
          <p>提携中の業者はまだありません。</p>
        </div>
      ) : (
        /* 🆕 グリッドを検索画面と統一 */
        <div style={gridStyle(isMobile)}>
          {partners.map(conn => {
            const shop = conn.profiles;
            const themeColor = shop.theme_color || '#c5a059';
            return (
              <motion.div key={conn.id} whileHover={{ y: -5 }} style={partnerCardStyle(themeColor)}>
                <div style={cardHeader}>
                  <div style={iconBadge(themeColor)}><Store size={20} color="#fff" /></div>
                  <div style={{ flex: 1, marginLeft: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={typeTag(themeColor)}>{shop.business_type}</span>
                      <button onClick={() => handleDisconnect(conn)} style={disconnectBtn}>提携解消</button>
                    </div>
                    <h3 style={shopName}>{shop.business_name}</h3>
                  </div>
                </div>

                {/* 🆕 リッチ情報ボックス（マップ・電話・メール） */}
                <div style={richInfoBox}>
                  <div style={infoRow}>
                    <User size={16} color={themeColor} />
                    <span style={infoLabel}>代表：<strong>{shop.owner_name || '未登録'}</strong></span>
                  </div>

                  <div style={{ ...infoRow, alignItems: 'flex-start' }}>
                    <MapPin size={16} color={themeColor} style={{ marginTop: '3px' }} />
                    <div style={{ flex: 1 }}>
                      <span style={infoLabel}>{shop.address || '住所未登録'}</span>
                      {shop.address && (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`} 
                          target="_blank" rel="noreferrer" style={googleMapsBtn}
                        >
                          Googleマップで場所を確認
                        </a>
                      )}
                    </div>
                  </div>

                  {shop.phone && (
                    <a href={`tel:${shop.phone}`} style={phoneLinkStyle}>
                      <Phone size={16} />
                      <span>{shop.phone} <span style={{fontSize:'10px', fontWeight:'normal', opacity: 0.7}}>(タップで発信)</span></span>
                    </a>
                  )}

                  {shop.email_contact && (
                    <a href={`mailto:${shop.email_contact}`} style={emailLinkStyle}>
                      <Mail size={16} />
                      <span>{shop.email_contact} <span style={{fontSize:'10px', fontWeight:'normal', opacity: 0.7}}>(メールを送る)</span></span>
                    </a>
                  )}
                </div>

                <div style={actionRow}>
                  {shop.official_url && (
                    <a href={shop.official_url} target="_blank" rel="noreferrer" style={outlineBtn}>
                      <Globe size={16} /> サイト
                    </a>
                  )}
                  <button 
                    onClick={() => navigate(`/shop/${shop.id}/reserve/time`, { 
                      state: { mode: 'facility', facilityUserId: facilityId } 
                    })}
                    style={mainBtn(themeColor)}
                  >
                    <CalendarCheck size={18} /> 予約・依頼
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- スタイル定義（FindShopsと共通化） ---
const gridStyle = (isMobile) => ({ 
  display: 'grid', 
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(400px, 1fr))', 
  gap: '30px' 
});

const partnerCardStyle = (color) => ({ 
  background: '#fff', borderRadius: '24px', padding: '30px', border: '1px solid #eee', 
  borderTop: `6px solid ${color}`, boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
  display: 'flex', flexDirection: 'column'
});

const cardHeader = { display: 'flex', alignItems: 'center', marginBottom: '20px' };
const iconBadge = (color) => ({ width: '45px', height: '45px', background: color, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const typeTag = (color) => ({ fontSize: '0.7rem', color: color, background: `${color}15`, padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' });
const shopName = { margin: '4px 0 0', fontSize: '1.4rem', fontWeight: '900', color: '#3d2b1f' };

const richInfoBox = { background: '#f8fafc', padding: '20px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', border: '1px solid #eef2ff' };
const infoRow = { display: 'flex', alignItems: 'center', gap: '12px' };
const infoLabel = { fontSize: '0.9rem', color: '#475569' };
const googleMapsBtn = { fontSize: '0.75rem', color: '#fff', background: '#4f46e5', padding: '4px 12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-block', marginTop: '6px' };
const phoneLinkStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 'bold' };
const emailLinkStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#4f46e5', textDecoration: 'none', borderTop: '1px solid #eef2ff', paddingTop: '10px' };

const actionRow = { display: 'flex', gap: '12px', marginTop: 'auto' };
const outlineBtn = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: '1px solid #ddd', color: '#666', background: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.85rem' };
const mainBtn = (color) => ({ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', borderRadius: '12px', border: 'none', background: '#3d2b1f', color: '#c5a059', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' });

const disconnectBtn = { background: '#fee2e2', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' };
const emptyCardStyle = { textAlign: 'center', padding: '100px', background: '#fff', borderRadius: '24px', color: '#999' };

export default FacilityPartnerShops_PC;