import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, Scissors, Calendar, Activity,
  Users, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 🚀 ひらがなの頭文字（あ・か・さ...）を判定する関数
const getKanaGroup = (kana) => {
  if (!kana) return "その他";
  const firstChar = kana.charAt(0);
  if (firstChar.match(/[あ-お]/)) return "あ行";
  if (firstChar.match(/[か-こ]/)) return "か行";
  if (firstChar.match(/[さ-そ]/)) return "さ行";
  if (firstChar.match(/[た-と]/)) return "た行";
  if (firstChar.match(/[な-の]/)) return "な行";
  if (firstChar.match(/[は-ほ]/)) return "は行";
  if (firstChar.match(/[ま-も]/)) return "ま行";
  if (firstChar.match(/[や-よ]/)) return "や行";
  if (firstChar.match(/[ら-ろ]/)) return "ら行";
  if (firstChar.match(/[わ-を]/)) return "わ行";
  return "その他";
};

const FacilityStatus_PC = ({ facilityId, isMobile }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [isMonthPanelOpen, setIsMonthPanelOpen] = useState(false);
  const [sortMode, setSortMode] = useState('floor'); // 🚀 共通のソートモード ('floor' or 'name')

  // 🚀 汎用ソートロジック
  const sortResidents = (list, mode) => {
    return [...list].sort((a, b) => {
      if (mode === 'floor') {
        const fA = parseInt(String(a.members?.floor).replace(/[^0-9]/g, '')) || 999;
        const fB = parseInt(String(b.members?.floor).replace(/[^0-9]/g, '')) || 999;
        if (fA !== fB) return fA - fB;
        return (a.members?.room || "").localeCompare(b.members?.room || "", undefined, { numeric: true });
      } else {
        const kanaA = (a.members?.kana || a.members?.name || "").trim();
        const kanaB = (b.members?.kana || b.members?.name || "").trim();
        return kanaA.localeCompare(kanaB, 'ja');
      }
    });
  };

  // 🚀 今月の全予約者を保持
  const allMonthResidents = useMemo(() => {
    const map = new Map();
    visits.forEach(v => {
      v.residents?.forEach(r => {
        if (!map.has(r.member_id)) map.set(r.member_id, r);
      });
    });
    return sortResidents(Array.from(map.values()), sortMode);
  }, [visits, sortMode]);

  const totalRemaining = allMonthResidents.filter(r => r.status === 'pending').length;

  useEffect(() => { fetchVisits(); }, [facilityId]);

  const fetchVisits = async () => {
    setLoading(true);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('sv-SE');

    const { data: visitsData } = await supabase
      .from('visit_requests')
      .select(`id, scheduled_date, start_time, status, parent_id, profiles (business_name, theme_color)`)
      .eq('facility_user_id', facilityId)
      .neq('status', 'canceled')
      .gte('scheduled_date', startOfMonth) 
      .order('scheduled_date', { ascending: false });

    if (!visitsData) { setLoading(false); return; }

    const allRelevantIds = visitsData.map(v => v.parent_id || v.id);
    const { data: allResidents } = await supabase
      .from('visit_request_residents')
      .select('*, members(name, kana, room, floor)') 
      .in('visit_request_id', allRelevantIds);

    if (allResidents) {
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

  if (loading) return <div style={centerStyle}>読み込み中...</div>;

  return (
    <div style={containerStyle(isMobile)}>
      <header style={headerStyle}>
        <h2 style={titleStyle}><Activity size={24} /> 進捗状況</h2>
        <p style={descStyle}>現在の訪問内容と全体の進捗を共有しています。</p>
      </header>

      {/* 🚀 今月の施術予定メンバー */}
      {allMonthResidents.length > 0 && (
        <div style={monthPanel(isMonthPanelOpen)}>
          <div style={monthHeader} onClick={() => setIsMonthPanelOpen(!isMonthPanelOpen)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={18} color="#4f46e5" />
              <h3 style={monthTitle}>今月の施術予定メンバー ({allMonthResidents.length}名)</h3>
            </div>
            {isMonthPanelOpen ? <ChevronUp size={20} color="#4f46e5" /> : <ChevronDown size={20} color="#4f46e5" />}
          </div>

          <AnimatePresence>
            {isMonthPanelOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', background: '#fcfaf7' }}>
                {/* 🚀 🆕 ソートボタンを中に移動 */}
                <div style={innerSortArea}>
                  <div style={tabContainer}>
                    <button onClick={() => setSortMode('floor')} style={tabStyle(sortMode === 'floor')}>階数順</button>
                    <button onClick={() => setSortMode('name')} style={tabStyle(sortMode === 'name')}>名前順</button>
                  </div>
                </div>
                <div style={monthListArea}>
                  {(() => {
                    let lastLabel = "";
                    return allMonthResidents.map(r => {
                      let currentLabel = sortMode === 'floor' 
                        ? (r.members?.floor ? (String(r.members.floor).includes('F') ? r.members.floor : `${r.members.floor}F`) : "未設定")
                        : getKanaGroup(r.members?.kana || r.members?.name);
                      const isNewGroup = currentLabel !== lastLabel;
                      lastLabel = currentLabel;
                      return (
                        <React.Fragment key={r.id}>
                          {isNewGroup && <div style={groupHeader}>{currentLabel}</div>}
                          <div style={residentRow}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={floorBadge}>
  {r.members?.floor ? `${r.members.floor.toString().replace('F', '')}F` : '-'}
</span>
                              <span style={nameText}>{r.members?.name} 様</span>
                            </div>
                            <span style={roomText}>{r.members?.room}号室</span>
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      
      {/* 🚀 日別進捗リスト */}
      <div style={listContainer}>
        {/* 🚀 🆕 日別リスト用のソート切り替え（ヘッダー的に配置） */}
        <div style={listHeaderArea}>
          <div style={tabContainer}>
            <button onClick={() => setSortMode('floor')} style={tabStyle(sortMode === 'floor')}>階数順</button>
            <button onClick={() => setSortMode('name')} style={tabStyle(sortMode === 'name')}>名前順</button>
          </div>
          <span style={sortNotice}>※日別の名簿もこの順で並びます</span>
        </div>

        {visits.map((visit) => {
          const todayStr = new Date().toLocaleDateString('sv-SE');
          const residents = visit.residents || [];
          const filtered = residents.filter(r => {
            const isDoneOnThisDay = r.status === 'completed' && isSameDay(r.completed_at, visit.scheduled_date);
            if (visit.scheduled_date >= todayStr) return isDoneOnThisDay || r.status === 'pending';
            return isDoneOnThisDay;
          });

          // 🚀 🆕 日別カードの中身も sortMode に合わせて並び替え
          const displayResidents = sortResidents(filtered, sortMode);

          const doneThisDay = displayResidents.filter(r => r.status === 'completed');
          const totalCount = displayResidents.length;
          const progress = totalCount > 0 ? (doneThisDay.length / totalCount) * 100 : 0;
          if (visit.scheduled_date < todayStr && displayResidents.length === 0) return null;

          return (
            <div key={visit.id} style={visitCard(visit.id === expandedId)}>
              <div style={cardHeader(isMobile)} onClick={() => setExpandedId(visit.id === expandedId ? null : visit.id)}>
                <div style={dateBox(isMobile)}>
                  <Calendar size={18} />
                  <strong style={dateText(isMobile)}>{visit.scheduled_date.replace(/-/g, '/')}</strong>
                  <span style={shopBadge(visit.profiles?.theme_color)}>{visit.profiles?.business_name}</span>
                </div>
                <div style={progressArea(isMobile)}>
                  <div style={countBadge(progress === 100)}>
  本日： {doneThisDay.length}名 / あと {totalRemaining}名
</div>
                  {visit.id === expandedId ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
              <div style={progressBarBg}><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} style={progressBar(visit.profiles?.theme_color)} /></div>
              <AnimatePresence>
                {visit.id === expandedId && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div style={residentGrid(isMobile)}>
                      {displayResidents.map((res) => (
                        <div key={res.id} style={resRow(res.status)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {res.status === 'completed' ? <CheckCircle2 size={18} color="#10b981" /> : <Clock size={18} color="#cbd5e1" />}
                            <div>
                              <div style={resName}>{res.members?.name} 様</div>
                              <div style={resSub}>
  {res.members?.floor?.toString().replace('F', '')}F {res.members?.room} | {res.menu_name}
</div>
                            </div>
                          </div>
                          <span style={statusText(res.status)}>{res.status === 'completed' ? '完了' : '待機中'}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- スタイル定義 ---
const containerStyle = (isMobile) => ({ 
  maxWidth: '1000px', 
  margin: '0 auto', 
  // まとめて書かずに、上下左右をバラして書く
  paddingTop: isMobile ? '10px' : '20px',
  paddingLeft: isMobile ? '10px' : '20px',
  paddingRight: isMobile ? '10px' : '20px',
  paddingBottom: '100px' // ここで下の余白（100px）を確定させる
});
const headerStyle = { marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' };
const titleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: '900', color: '#3d2b1f', margin: 0 };
const descStyle = { fontSize: '0.75rem', color: '#64748b', marginTop: '5px' };
const centerStyle = { textAlign: 'center', padding: '100px', fontWeight: 'bold', color: '#64748b' };

const monthPanel = (isOpen) => ({ background: '#fff', borderRadius: '20px', border: isOpen ? '2px solid #4f46e5' : '1px solid #e0e7ff', overflow: 'hidden', marginBottom: '25px' });
const monthHeader = { padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' };
const monthTitle = { fontSize: '0.9rem', fontWeight: '900', color: '#4f46e5', margin: 0 };

// 🚀 ソートエリア
const innerSortArea = { padding: '10px 20px', background: '#f8faff', borderBottom: '1px solid #eef2ff' };
const listHeaderArea = { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', padding: '0 5px' };
const sortNotice = { fontSize: '0.65rem', color: '#94a3b8', fontWeight: 'bold' };

const tabContainer = { display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', width: 'fit-content' };
const tabStyle = (active) => ({ padding: '4px 15px', borderRadius: '8px', border: 'none', background: active ? '#fff' : 'transparent', color: active ? '#3d2b1f' : '#64748b', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: active ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' });

const monthListArea = { padding: '10px 20px 25px', display: 'flex', flexDirection: 'column', gap: '2px' };
const groupHeader = { padding: '15px 10px 5px', fontSize: '0.9rem', fontWeight: '900', color: '#4f46e5', borderBottom: '1px solid #e0e7ff', marginBottom: '8px' };
const residentRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: '#fff', borderRadius: '10px', border: '1px solid #eef2ff' };
const floorBadge = { background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900', minWidth: '35px', textAlign: 'center' };
const nameText = { fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' };
const roomText = { fontSize: '0.8rem', color: '#94a3b8' };

const listContainer = { display: 'flex', flexDirection: 'column', gap: '15px' };
const visitCard = (active) => ({ background: '#fff', borderRadius: '20px', border: active ? '2px solid #3d2b1f' : '1px solid #eee', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.03)' });
const cardHeader = (isMobile) => ({ padding: isMobile ? '15px' : '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '10px', cursor: 'pointer' });
const dateBox = (isMobile) => ({ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' });
const dateText = (isMobile) => ({ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '900', color: '#1e293b' });
const shopBadge = (color) => ({ background: color ? `${color}15` : '#f1f5f9', color: color || '#64748b', padding: '3px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold', border: `1px solid ${color}33` });
const progressArea = (isMobile) => ({ display: 'flex', alignItems: 'center', gap: '15px', width: isMobile ? '100%' : 'auto', justifyContent: 'space-between' });
const countBadge = (isDone) => ({ background: isDone ? '#10b981' : '#3d2b1f', color: '#fff', padding: '5px 15px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '900' });
const progressBarBg = { height: '5px', background: '#f1f5f9' };
const progressBar = (color) => ({ height: '100%', background: color || '#c5a059' });
const residentGrid = (isMobile) => ({ padding: isMobile ? '10px' : '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', background: '#fcfaf7' });
const resRow = (status) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#fff', borderRadius: '12px', border: `1px solid ${status === 'completed' ? '#10b981' : '#eef2ff'}` });
const resName = { fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' };
const resSub = { fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' };
const statusText = (status) => ({ fontSize: '0.7rem', fontWeight: '900', color: status === 'completed' ? '#059669' : '#94a3b8' });

export default FacilityStatus_PC;