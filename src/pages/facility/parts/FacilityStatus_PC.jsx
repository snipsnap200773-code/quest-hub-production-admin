import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, Scissors, Calendar, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityStatus_PC = ({ facilityId, isMobile }) => { // 🚀 isMobile を受け取る
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { fetchVisits(); }, [facilityId]);

  const fetchVisits = async () => {
    setLoading(true);
    const { data: visitsData, error: vError } = await supabase
      .from('visit_requests')
      .select(`id, scheduled_date, start_time, status, parent_id, profiles (business_name, theme_color)`)
      .eq('facility_user_id', facilityId)
      .neq('status', 'canceled')
      .order('scheduled_date', { ascending: false });

    if (vError) { setLoading(false); return; }

    const allRelevantIds = visitsData.map(v => v.parent_id || v.id);
    const { data: allResidents, error: rError } = await supabase
      .from('visit_request_residents')
      .select('*, members(name, room, floor)') 
      .in('visit_request_id', allRelevantIds);

    if (!rError) {
      const combinedData = visitsData.map(visit => {
        const targetId = visit.parent_id || visit.id;
        const residents = allResidents.filter(r => r.visit_request_id === targetId);
        return { ...visit, residents };
      });
      setVisits(combinedData);
      const todayStr = new Date().toLocaleDateString('sv-SE');
      const todayVisit = combinedData.find(v => v.scheduled_date === todayStr);
      setExpandedId(todayVisit ? todayVisit.id : null);
    }
    setLoading(false);
  };

  const isSameDay = (dateStr1, dateStr2) => {
    if (!dateStr1 || !dateStr2) return false;
    return dateStr1.split('T')[0] === dateStr2.split('T')[0];
  };

  if (loading) return <div style={{textAlign:'center', padding:'100px'}}>読み込み中...</div>;

  return (
    <div style={containerStyle(isMobile)}>
      <header style={headerStyle}>
        <h2 style={titleStyle}><Activity size={24} /> 進捗状況</h2>
        <p style={descStyle}>現在の訪問内容と全体の進捗を共有しています。</p>
      </header>
      
      {visits.length === 0 ? (
        <div style={emptyCard}>現在、確定した予約はありません。</div>
      ) : (
        <div style={listContainer}>
          {visits.map((visit) => {
            const residents = visit.residents || [];
            const doneThisDay = residents.filter(r => r.status === 'completed' && isSameDay(r.completed_at, visit.scheduled_date));
            const globalDoneCount = residents.filter(r => r.status === 'completed').length;
            const totalCount = residents.length;
            const progress = totalCount > 0 ? (globalDoneCount / totalCount) * 100 : 0;

            const displayResidents = residents.filter(r => {
              const isDoneToday = r.status === 'completed' && isSameDay(r.completed_at, visit.scheduled_date);
              const isPending = r.status === 'pending';
              return isDoneToday || isPending;
            });

            return (
              <div key={visit.id} style={visitCard(visit.id === expandedId)}>
                <div style={cardHeader(isMobile)} onClick={() => setExpandedId(visit.id === expandedId ? null : visit.id)}>
                  <div style={dateBox(isMobile)}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <Calendar size={isMobile ? 16 : 18} />
                      <strong style={{fontSize: isMobile ? '0.95rem' : '1.1rem'}}>{visit.scheduled_date.replace(/-/g, '/')}</strong>
                    </div>
                    
                    <span style={shopBadge(visit.profiles?.theme_color, isMobile)}>
                      <Scissors size={10} style={{marginRight:'4px'}} />
                      {visit.profiles?.business_name}
                    </span>

                    {/* 🚀 🆕 スマホ版では「継続分」を隠す */}
                    {visit.parent_id && !isMobile && <span style={childBadge}>●</span>}
                  </div>

                  <div style={progressArea(isMobile)}>
                    {/* 🚀 🆕 スマホ版：テキストを記号化してスリムに */}
                    <div style={countBadge(progress === 100, isMobile)}>
                      {isMobile ? (
                        <>本日:{doneThisDay.length} / 全体:{globalDoneCount}</>
                      ) : (
                        <>本日: {doneThisDay.length}名 / 全体: {globalDoneCount}名 完了</>
                      )}
                    </div>
                    {visit.id === expandedId ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                <div style={progressBarBg}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} style={progressBar(visit.profiles?.theme_color || '#c5a059')} />
                </div>

                <AnimatePresence>
                  {visit.id === expandedId && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={residentGrid(isMobile)}>
                        {displayResidents.length > 0 ? displayResidents.map((res) => (
                          <div key={res.id} style={resRow(res.status)}>
                            <div style={resMain}>
                              <div style={statusIcon(res.status)}>
                                {res.status === 'completed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                              </div>
                              <div>
                                <div style={resName}>{res.members?.name} 様</div>
                                <div style={resInfo}>{res.members?.room} | {res.menu_name}</div>
                              </div>
                            </div>
                            <div style={statusLabel(res.status)}>
                               {res.status === 'completed' ? '完了' : '待機中'}
                            </div>
                          </div>
                        )) : (
                          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                            実施記録はありません
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- スタイル定義 ---
const containerStyle = (isMobile) => ({ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '10px' : '20px' });
const headerStyle = { marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' };
const titleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: '900', color: '#3d2b1f', margin: 0 };
const descStyle = { fontSize: '0.75rem', color: '#64748b', marginTop: '5px' };
const listContainer = { display: 'flex', flexDirection: 'column', gap: '12px' };

const visitCard = (active) => ({ background: '#fff', borderRadius: '18px', border: active ? '2px solid #3d2b1f' : '1px solid #eee', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' });

// 🚀 🆕 修正：スマホの時は隙間を詰める
const cardHeader = (isMobile) => ({ 
  padding: isMobile ? '12px 15px' : '20px', 
  display: 'flex', 
  flexDirection: isMobile ? 'column' : 'row',
  justifyContent: 'space-between', 
  alignItems: isMobile ? 'flex-start' : 'center', 
  gap: isMobile ? '10px' : '0',
  cursor: 'pointer' 
});

const dateBox = (isMobile) => ({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' });

const progressArea = (isMobile) => ({ 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'space-between',
  width: isMobile ? '100%' : 'auto',
  gap: '12px' 
});

// 🚀 🆕 修正：スマホの時は少し小さく
const countBadge = (isDone, isMobile) => ({ 
  background: isDone ? '#10b981' : '#3d2b1f', 
  color: '#fff', 
  padding: isMobile ? '4px 10px' : '6px 15px', 
  borderRadius: '12px', 
  fontSize: isMobile ? '0.7rem' : '0.8rem', 
  fontWeight: '900',
  flex: isMobile ? 1 : 'none',
  textAlign: 'center'
});

const progressBarBg = { height: '4px', background: '#f1f5f9', width: '100%' };
const progressBar = (color) => ({ height: '100%', background: color });

const residentGrid = (isMobile) => ({ 
  padding: isMobile ? '12px' : '20px', 
  display: 'grid', 
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', 
  gap: '8px', 
  background: '#fcfaf7' 
});

const resRow = (status) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', borderRadius: '10px', background: '#fff', border: `1px solid ${status === 'completed' ? '#10b981' : '#e2e8f0'}` });
const resMain = { display: 'flex', alignItems: 'center', gap: '10px' };
const statusIcon = (status) => ({ color: status === 'completed' ? '#10b981' : '#cbd5e1' });
const resName = { fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' };
const resInfo = { fontSize: '0.7rem', color: '#94a3b8' };
const statusLabel = (status) => ({ fontSize: '0.65rem', fontWeight: '900', color: status === 'completed' ? '#059669' : '#94a3b8' });
const emptyCard = { textAlign: 'center', padding: '50px', background: '#fff', borderRadius: '20px', color: '#94a3b8', border: '1px dashed #e2e8f0' };
const childBadge = { fontSize: '0.6rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px', marginLeft: '5px', fontWeight: 'bold' };

const shopBadge = (color, isMobile) => ({
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: isMobile ? '0.65rem' : '0.7rem',
  fontWeight: 'bold',
  background: color ? `${color}15` : '#f1f5f9',
  color: color || '#64748b',
  padding: '3px 8px',
  borderRadius: '6px',
  border: `1px solid ${color || '#e2e8f0'}44`,
});

export default FacilityStatus_PC;