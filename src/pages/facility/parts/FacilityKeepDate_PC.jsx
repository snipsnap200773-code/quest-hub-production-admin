import React, { useState, useEffect, useMemo, useRef } from 'react'; // 🚀 useRefを追加
import { supabase } from '../../../supabaseClient';
import { 
  ChevronLeft, ChevronRight, Store, ArrowRight, Info, 
  Clock, Users, CheckCircle2, Trash2, Calendar as CalIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityKeepDate_PC = ({ facilityId, isMobile, setActiveTab, sharedDate: currentDate, setSharedDate: setCurrentDate }) => {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [keepDates, setKeepDates] = useState([]); 
  const [confirmedVisits, setConfirmedVisits] = useState([]);
  const [shopBlocks, setShopBlocks] = useState([]);
  const [regularRules, setRegularRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exclusions, setExclusions] = useState([]); 
  const [timeModal, setTimeModal] = useState({ show: false, dateStr: '', currentTime: '' });

  // 🚀 🆕 自動スクロール用のターゲット（ボタンの位置）
  const nextStepRef = useRef(null);

  const todayStr = new Date().toLocaleDateString('sv-SE');
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const days = [...Array(firstDay).fill(null), ...[...Array(lastDate).keys()].map(i => i + 1)];

  useEffect(() => { fetchInitialData(); }, [facilityId]);
  useEffect(() => { if (selectedShop) fetchData(); }, [currentDate, selectedShop]);

  // 🚀 🆕 選択された日がある場合、スルスルと下へスクロールさせる
  useEffect(() => {
    if (allActiveKeeps.length > 0 && nextStepRef.current) {
      setTimeout(() => {
        nextStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [keepDates, timeModal.show]); // キープ状況やモーダルが閉じたタイミングで発動

  const fetchInitialData = async () => {
    const { data } = await supabase.from('shop_facility_connections').select(`*, profiles (*)`).eq('facility_user_id', facilityId).eq('status', 'active');
    setShops(data || []);
    if (data?.length > 0 && !selectedShop) setSelectedShop(data[0].profiles);
  };

  const fetchData = async () => {
    if (!selectedShop) return;
    setLoading(true);
    const shopId = selectedShop.id;
    const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
    const [visitData, keeps, conns, exclData, blocksRes] = await Promise.all([
      supabase.from('visit_requests').select('scheduled_date, status').eq('shop_id', shopId).eq('facility_user_id', facilityId).neq('status', 'canceled'),
      supabase.from('keep_dates').select('*').eq('shop_id', shopId),
      supabase.from('shop_facility_connections').select('facility_user_id, regular_rules').eq('shop_id', shopId),
      supabase.from('regular_keep_exclusions').select('excluded_date').eq('facility_user_id', facilityId).eq('shop_id', shopId),
      // 🚀 🆕 業者側の「is_block」がついたデータを取得
      supabase.from('reservations').select('start_time').eq('shop_id', shopId).eq('is_block', true)
    ]);
    setKeepDates(keeps.data || []);
    setConfirmedVisits(visitData.data || []);
    setRegularRules(conns.data || []);
    setExclusions(exclData.data?.map(e => e.excluded_date) || []);
    setShopBlocks(blocksRes.data || []); // 🚀 🆕 セット！
    setLoading(false);
  };

  const checkIsRegularKeep = (date) => {
    const day = date.getDay();
    const dom = date.getDate();
    const m = date.getMonth() + 1;
    const nthWeek = Math.ceil(dom / 7);
    const t7 = new Date(date); t7.setDate(dom + 7);
    const isL1 = t7.getMonth() !== date.getMonth();
    const t14 = new Date(date); t14.setDate(dom + 14);
    const isL2 = t14.getMonth() !== date.getMonth() && !isL1;
    let result = null;
    regularRules.forEach(rule => {
      rule.regular_rules?.forEach(r => {
        const monthMatch = (r.monthType === 0) || (r.monthType === 1 && m % 2 !== 0) || (r.monthType === 2 && m % 2 === 0);
        const dayMatch = (r.day === day);
        const weekMatch = (r.week === nthWeek) || (r.week === -1 && isL1) || (r.week === -2 && isL2);
        if (monthMatch && dayMatch && weekMatch) result = { keeperId: rule.facility_user_id, time: r.time };
      });
    });
    return result;
  };

  const getStatus = (dateStr) => {
    const d = new Date(dateStr);
    const regKeep = checkIsRegularKeep(d);
    if (dateStr < todayStr) return 'past';

    // 🚀 🆕 1. 長期休暇（夏休み・正月休みなど）の判定
    const specialHolidays = selectedShop?.special_holidays || [];
    const isSpecialHoliday = specialHolidays.some(h => dateStr >= h.start && dateStr <= h.end);
    if (isSpecialHoliday) return 'ng';

    // 🚀 🆕 2. 個別ブロック（臨時休業など）の判定
    const isShopBlocked = shopBlocks.some(b => b.start_time.startsWith(dateStr));
    if (isShopBlocked) return 'ng';

    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = dayNames[d.getDay()];
    // 第n週の計算（L1, L2対応のためカレンダーロジックと合わせる）
    const dom = d.getDate();
    const nthWeek = Math.ceil(dom / 7);
    const t7 = new Date(d); t7.setDate(dom + 7);
    const isL1 = t7.getMonth() !== d.getMonth();
    const t14 = new Date(d); t14.setDate(dom + 14);
    const isL2 = t14.getMonth() !== d.getMonth() && !isL1;

    // 🚀 🆕 3. 定休日の判定（L1, L2もカバー）
    const holidays = selectedShop?.business_hours?.regular_holidays || {};
    const isRegularHoliday = holidays[`${nthWeek}-${dayKey}`] || 
                             (isL1 && holidays[`L1-${dayKey}`]) || 
                             (isL2 && holidays[`L2-${dayKey}`]);

    if (isRegularHoliday) return 'ng';

    if (confirmedVisits.some(v => v.scheduled_date === dateStr)) return 'booked';
    if (regKeep && !exclusions.includes(dateStr)) return { type: regKeep.keeperId === facilityId ? 'keeping' : 'other-keep', time: regKeep.time };
    const manualKeep = keepDates.find(k => k.date === dateStr && k.facility_user_id === facilityId);
    if (manualKeep) return { type: 'keeping', time: manualKeep.start_time || '09:00' };
    if (keepDates.some(k => k.date === dateStr)) return 'other-keep';
    return 'available';
  };

  const allActiveKeeps = useMemo(() => {
    // 🚀 🆕 現在の月のプレフィックス（例: "2026-03"）を作成
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    // 🚀 🆕 マニュアルキープを表示中の月だけに限定してリストを開始
    const list = [...keepDates
      .filter(k => k.facility_user_id === facilityId && k.date.startsWith(currentMonthPrefix)) 
      .map(k => ({...k, isRegular: false}))
    ];

    days.forEach(day => {
      if (!day) return;
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const regKeep = checkIsRegularKeep(new Date(dStr));
      const isAlreadyBooked = confirmedVisits.some(v => v.scheduled_date === dStr);
      if (regKeep && regKeep.keeperId === facilityId && !exclusions.includes(dStr) && !isAlreadyBooked) {
        if (!list.some(k => k.date === dStr)) list.push({ date: dStr, isRegular: true });
      }
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [keepDates, regularRules, exclusions, year, month, days, facilityId, confirmedVisits]);

  const handleDateClick = async (day) => {
    if (!day || !selectedShop) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const regKeep = checkIsRegularKeep(new Date(dateStr));
    if (regKeep && regKeep.keeperId === facilityId) {
      if (!exclusions.includes(dateStr)) {
        await supabase.from('regular_keep_exclusions').insert([{ facility_user_id: facilityId, shop_id: selectedShop.id, excluded_date: dateStr }]);
      } else {
        await supabase.from('regular_keep_exclusions').delete().match({ facility_user_id: facilityId, shop_id: selectedShop.id, excluded_date: dateStr });
      }
      fetchData(); return;
    }
    const statusData = getStatus(dateStr);
    const status = typeof statusData === 'object' ? statusData.type : statusData;
    if (['past', 'ng', 'booked', 'other-keep'].includes(status)) return;
    if (status === 'keeping') {
      setTimeModal({ show: true, dateStr, currentTime: statusData.time || '09:00' });
    } else {
      await supabase.from('keep_dates').upsert({ date: dateStr, facility_user_id: facilityId, shop_id: selectedShop.id, start_time: '09:00' });
      fetchData();
      setTimeModal({ show: true, dateStr, currentTime: '09:00' });
    }
  };

  const handleTimeChange = async (dateStr, newTime) => {
    await supabase.from('keep_dates').update({ start_time: newTime }).match({ date: dateStr, facility_user_id: facilityId, shop_id: selectedShop.id });
    fetchData();
  };

  const renderShopSelector = () => (
    <div style={isMobile ? mShopSelectorArea : pcSideListStyle}>
      <h3 style={sideTitle}><Store size={16} /> 業者切替</h3>
      <div style={isMobile ? mShopScrollWrapper : shopListWrapper}>
        {shops.map(con => (
          <button 
            key={con.profiles.id} 
            onClick={() => setSelectedShop(con.profiles)} 
            style={isMobile ? mShopChip(selectedShop?.id === con.profiles.id, con.profiles.theme_color) : shopCardBtn(selectedShop?.id === con.profiles.id, con.profiles.theme_color)}
          >
            {isMobile ? (
               <span style={{whiteSpace:'nowrap'}}>{con.profiles.business_name}</span>
            ) : (
              <>
                <div style={shopMiniTag(con.profiles.theme_color)}>{con.profiles.business_type}</div>
                <div style={shopNameLabel}>{con.profiles.business_name}</div>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={containerStyle(isMobile)}>
      {renderShopSelector()}

      <main style={{ flex: 1, width: '100%' }}>
        {!selectedShop ? (
          <div style={noShopStyle}>読み込み中...</div>
        ) : (
          <>
            <div style={calHeaderStyle}>
              <div style={monthNav}>
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={navBtn}><ChevronLeft size={18}/></button>
                <h2 style={monthLabel}>{year}年 {month + 1}月</h2>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={navBtn}><ChevronRight size={18}/></button>
                <button onClick={() => setCurrentDate(new Date())} style={todayBtn}>今日</button>
              </div>
              <div style={statusBanner(selectedShop?.theme_color)}>
                <Info size={14} />
                <span><strong>{selectedShop?.business_name}</strong> さんの空きを表示中</span>
              </div>
            </div>

            <div style={calendarGrid(isMobile)}>
              {['日', '月', '火', '水', '木', '金', '土'].map(w => <div key={w} style={weekHeader}>{w}</div>)}
              {days.map((day, i) => {
                if (!day) return <div key={i} style={emptyDay}></div>;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const statusData = getStatus(dateStr);
                const status = typeof statusData === 'object' ? statusData.type : statusData;
                const config = {
                  keeping: { bg: '#fff9e6', border: '#c5a059', color: '#c5a059', label: '選択中', icon: '★' },
                  booked: { bg: '#f0fdf4', border: '#10b981', color: '#10b981', label: '確定済', icon: '✓' },
                  ng: { bg: '#f8fafc', border: '#f1f5f9', color: '#94a3b8', label: '定休', icon: '✕' },
                  other_keep: { bg: '#f8fafc', border: '#f1f5f9', color: '#94a3b8', label: '他施設', icon: '✕' },
                  past: { bg: '#fff', border: '#fff', color: '#eee', label: '-', icon: '' },
                  available: { bg: '#fff', border: '#f0f0f0', color: '#c5a059', label: '空き', icon: '◎' }
                };
                const s = config[status === 'other-keep' ? 'other_keep' : status] || config.past;

                return (
                  <div key={i} onClick={() => handleDateClick(day)} style={dayBox(s.bg, s.border, status, isMobile)}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                      <span style={dayNum(status)}>{day}</span>
                      {!isMobile && status === 'keeping' && <div style={timeBadgeSmall}>{(statusData.time || '09:00').substring(0, 5)}</div>}
                    </div>
                    <div style={statusIconArea(s.color, isMobile)}>{s.icon}</div>
                    <span style={statusLabel(s.color, isMobile)}>{s.label}</span>
                  </div>
                );
              })}
            </div>

            <div style={legendArea}>
               <div style={legendItem}><span style={dot('#fff9e6','#c5a059')}></span> 選択中</div>
               <div style={legendItem}><span style={dot('#f0fdf4','#10b981')}></span> 確定済</div>
               <div style={legendItem}><span style={dot('#fff','#eee')}></span> 空き</div>
            </div>

            {/* 🚀 🆕 3. 下部に出現するアクションバー + 自動スクロールRef */}
            <div ref={nextStepRef} style={{marginTop:'30px', paddingBottom:'50px'}}>
              <AnimatePresence>
                {allActiveKeeps.length > 0 && (
                  <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} style={bottomNoticeBar}>
                     <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                        <span style={{fontSize:'0.8rem', color:'#c5a059', fontWeight:'900'}}>STEP 1 完了！</span>
                        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                           <div style={keepCountBadge}>{allActiveKeeps.length}</div>
                           <span style={{fontWeight:'bold', fontSize:'1rem'}}>日間の訪問日をキープ中</span>
                        </div>
                     </div>
                     <button onClick={() => setActiveTab('list-up')} style={jumpBtn}>
                       次に利用者を選ぶ <ArrowRight size={18} />
                     </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>

      {/* 時間選択モーダル */}
      <AnimatePresence>
        {timeModal.show && (
          <div style={modalOverlay} onClick={() => setTimeModal({ ...timeModal, show: false })}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} style={modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <h3 style={{ margin: 0 }}>開始時間の選択</h3>
                <div style={{ fontSize: '0.85rem', color: '#888' }}>{timeModal.dateStr.replace(/-/g, '/')}</div>
              </div>
              <div style={timeListScroll}>
                {['09:00','09:30','10:00','10:30','11:00','11:30','13:00','14:00','15:00','16:00'].map(t => (
                  <button key={t} onClick={() => { handleTimeChange(timeModal.dateStr, t); setTimeModal({ ...timeModal, show: false }); }} style={timeCard(timeModal.currentTime.substring(0,5) === t)}><Clock size={16} /> {t}</button>
                ))}
              </div>
              <button onClick={async () => { await supabase.from('keep_dates').delete().match({ date: timeModal.dateStr, facility_user_id: facilityId }); fetchData(); setTimeModal({ ...timeModal, show: false }); }} style={deleteKeepBtn}><Trash2 size={16} /> 解除する</button>
              <button onClick={() => setTimeModal({ ...timeModal, show: false })} style={closeBtn}>閉じる</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- スタイル定義 (三土手さん仕様：スリム＆スマート) ---
const containerStyle = (isMobile) => ({ display: 'flex', gap: '20px', width: '100%', flexDirection: isMobile ? 'column' : 'row', alignItems: 'flex-start' });

// 🚀 🆕 スリム化したサイドバー (260px -> 200px)
const pcSideListStyle = { width: '200px', flexShrink: 0, background: '#fff', padding: '15px', borderRadius: '24px', border: '1px solid #eee' };

// 🚀 🆕 下部に現れる案内バー
const bottomNoticeBar = {
  background: '#3d2b1f', color: '#fff', padding: '20px 25px', borderRadius: '24px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 15px 35px rgba(61,43,31,0.3)',
  border: '1px solid #4a382a'
};
const keepCountBadge = { background: '#c5a059', color: '#3d2b1f', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.8rem' };
const jumpBtn = { background: '#c5a059', color: '#3d2b1f', border: 'none', padding: '12px 24px', borderRadius: '15px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', boxShadow: '0 4px 10px rgba(197,160,89,0.3)' };

const mShopSelectorArea = { width: '100%', marginBottom: '5px' };
const mShopScrollWrapper = { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' };
const mShopChip = (active, color) => ({ padding: '8px 16px', borderRadius: '30px', border: active ? `2px solid ${color}` : '1px solid #e2e8f0', background: active ? `${color}15` : '#fff', color: active ? color : '#64748b', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' });

const sideTitle = { fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', textTransform: 'uppercase' };
const shopListWrapper = { display: 'flex', flexDirection: 'column', gap: '6px' };
const shopCardBtn = (active, color) => ({ padding: '10px 12px', borderRadius: '12px', border: active ? `2px solid ${color}` : '1px solid #f1f5f9', background: active ? `${color}05` : '#fff', textAlign: 'left', cursor: 'pointer', transition: '0.2s' });
const shopMiniTag = (color) => ({ fontSize: '0.55rem', color: color, fontWeight: '900', marginBottom: '1px' });
const shopNameLabel = { fontSize: '0.75rem', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

const calHeaderStyle = { marginBottom: '15px' };
const monthNav = { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px', justifyContent: 'center' };
const monthLabel = { fontSize: '1.3rem', fontWeight: '900', color: '#3d2b1f', margin: 0, minWidth: '130px', textAlign: 'center' };
const navBtn = { background: '#fff', border: '1px solid #eee', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const todayBtn = { padding: '5px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#fff', color: '#3d2b1f', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' };
const statusBanner = (color) => ({ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#fcfaf7', borderRadius: '10px', fontSize: '0.75rem', color: '#3d2b1f', border: '1px solid #f0e6d2' });

const calendarGrid = (isMobile) => ({ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? '4px' : '6px', background: '#fff', padding: isMobile ? '5px' : '12px', borderRadius: '24px', border: '1px solid #eee' });
const weekHeader = { textAlign: 'center', padding: '8px 0', fontSize: '0.65rem', fontWeight: '900', color: '#cbd5e1' };
const dayBox = (bg, border, status, isMobile) => ({ minHeight: isMobile ? '60px' : '85px', padding: isMobile ? '4px' : '8px', borderRadius: '12px', cursor: status === 'available' || status === 'keeping' ? 'pointer' : 'default', background: bg, border: `2px solid ${border}`, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' });
const dayNum = (status) => ({ fontSize: '0.85rem', fontWeight: '900', color: status === 'available' || status === 'keeping' ? '#1e293b' : '#cbd5e1' });
const statusIconArea = (color, isMobile) => ({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '14px' : '20px', fontWeight: '900', color: color });
const statusLabel = (color, isMobile) => ({ textAlign:'center', fontSize: isMobile ? '0.45rem' : '0.55rem', fontWeight: 'bold', color: color });
const timeBadgeSmall = { fontSize: '0.5rem', background: '#3d2b1f', color: '#fff', padding: '1px 3px', borderRadius: '3px' };

const legendArea = { display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '15px' };
const legendItem = { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 'bold' };
const dot = (bg, border) => ({ width: '7px', height: '7px', borderRadius: '2px', background: bg, border: `1px solid ${border}` });
const emptyDay = { minHeight: '60px' };
const noShopStyle = { textAlign: 'center', padding: '100px', color: '#999' };

const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContent = { width: '90%', maxWidth: '340px', background: '#fff', borderRadius: '30px', padding: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' };
const modalHeader = { textAlign: 'center', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const timeListScroll = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '250px', overflowY: 'auto' };
const timeCard = (active) => ({ padding: '10px', borderRadius: '10px', border: active ? '2px solid #c5a059' : '1px solid #eee', background: active ? '#fff9e6' : '#fff', color: active ? '#c5a059' : '#1e293b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' });
const deleteKeepBtn = { width: '100%', marginTop: '15px', padding: '10px', background: '#fff', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' };
const closeBtn = { width: '100%', marginTop: '8px', padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', color: '#64748b' };

export default FacilityKeepDate_PC;