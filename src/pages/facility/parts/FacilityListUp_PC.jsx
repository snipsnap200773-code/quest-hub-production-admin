import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  Users, UserPlus, UserMinus, Calendar, ArrowRight, 
  CheckCircle2, Search, Info, ListChecks, Scissors,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityListUp_PC = ({ facilityId, isMobile, setActiveTab, sharedDate: viewDate, setSharedDate: setViewDate }) => {
  const [residents, setResidents] = useState([]);
  const [draftList, setDraftList] = useState([]);
  const [completedMemberIds, setCompletedMemberIds] = useState([]);
  const [confirmedDates, setConfirmedDates] = useState([]);
  const [manualKeeps, setManualKeeps] = useState([]);
  const [regularRules, setRegularRules] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [shopId, setShopId] = useState(null);
  const [shopName, setShopName] = useState('');
  const [shopServices, setShopServices] = useState([]); 
  const [facilityName, setFacilityName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState('floor');

  // 🚀 🆕 【ここを修正！】「今日」固定ではなく、Stateで月を管理します
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // 🚀 🆕 viewDate が変わるたびに再取得するように依存配列に追加
  useEffect(() => { 
    const init = async () => {
      setLoading(true);
      const { data: fac } = await supabase.from('facility_users').select('facility_name').eq('id', facilityId).single();
      if (fac) {
        setFacilityName(fac.facility_name);
        await fetchData(fac.facility_name);
      }
      setLoading(false);
    };
    init();
  }, [facilityId, viewDate]); // 💡 viewDate を追加

  const fetchData = async (targetFacilityName) => {
    try {
      const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

      const [resData, draftData, connData, visitedRes, visitDatesRes] = await Promise.all([
        supabase.from('members').select('*').eq('facility', targetFacilityName).order('room'),
        supabase.from('visit_list_drafts').select('*, members(*)').eq('facility_user_id', facilityId),
        supabase.from('shop_facility_connections').select('shop_id, regular_rules, profiles(business_name)').eq('facility_user_id', facilityId).eq('status', 'active').limit(1).maybeSingle(),
        // 今月の完了者取得（既存）
        supabase.from('visit_request_residents').select('member_id, visit_requests!inner(scheduled_date)').eq('status', 'completed').eq('visit_requests.facility_user_id', facilityId).gte('visit_requests.scheduled_date', startOfMonth).lte('visit_requests.scheduled_date', endOfMonth),
        // 🚀 🆕 追加：今月の予約日程とそのステータスを取得
        supabase.from('visit_requests').select('scheduled_date, status').eq('facility_user_id', facilityId).gte('scheduled_date', startOfMonth).lte('scheduled_date', endOfMonth)
      ]);

      setResidents(resData.data || []);
      setDraftList(draftData.data || []);
      setCompletedMemberIds(visitedRes.data?.map(r => r.member_id) || []);
      setConfirmedDates(visitDatesRes.data || []);

      // 🚀 🆕 完了したメンバーのIDだけを配列にまとめる
      const doneIds = visitedRes.data?.map(r => r.member_id) || [];
      setCompletedMemberIds(doneIds);
      
      if (connData.data) {
        const sid = connData.data.shop_id;
        setShopId(sid);
        setShopName(connData.data.profiles?.business_name || '');
        setRegularRules(connData.data.regular_rules || []);

        // --- ✅ 🆕 修正：エラーの出ないメニュー取得ロジック ---
        // 1. まず、その店舗の「施設専用(is_facility_only: true)」カテゴリを特定する
        const { data: catList } = await supabase
          .from('service_categories')
          .select('name')
          .eq('shop_id', sid)
          .eq('is_facility_only', true);

        const targetCatNames = catList?.map(c => c.name) || [];

        if (targetCatNames.length > 0) {
          // 2. 特定したカテゴリに属するメニューだけを拾う
          const { data: services } = await supabase
            .from('services')
            .select('name')
            .eq('shop_id', sid)
            .in('category', targetCatNames) // 💡 配列に含まれるものだけ
            .order('sort_order');
          
          setShopServices(services || []);
        } else {
          setShopServices([{ name: '（施設用メニュー未設定）' }]);
        }
        // --------------------------------------------------
      }

      const { data: keeps } = await supabase.from('keep_dates').select('*').eq('facility_user_id', facilityId);
      const { data: excl } = await supabase.from('regular_keep_exclusions').select('excluded_date').eq('facility_user_id', facilityId);
      setManualKeeps(keeps || []);
      setExclusions(excl?.map(e => e.excluded_date) || []);

    } catch (err) {
      console.error("データ取得失敗:", err);
    }
  };

  // 判定ロジック等
  const checkIsRegularKeep = (date) => {
    const day = date.getDay();
    const dom = date.getDate();
    const m = date.getMonth() + 1;
    const nthWeek = Math.ceil(dom / 7);
    
    // 💡 カレンダー側と合わせた高度な週判定
    const t7 = new Date(date); t7.setDate(dom + 7);
    const isL1 = t7.getMonth() !== date.getMonth(); 
    const t14 = new Date(date); t14.setDate(dom + 14);
    const isL2 = t14.getMonth() !== date.getMonth() && !isL1;

    let matchTime = null;
    regularRules?.forEach(r => {
      const monthMatch = (r.monthType === 0) || (r.monthType === 1 && m % 2 !== 0) || (r.monthType === 2 && m % 2 === 0);
      const dayMatch = (r.day === day);
      
      // 💡 1-4週 だけでなく -1(最終) や -2(最後から2番目) も判定
      const weekMatch = (r.week === nthWeek) || (r.week === -1 && isL1) || (r.week === -2 && isL2);
      
      if (monthMatch && dayMatch && weekMatch) matchTime = r.time;
    });
    return matchTime;
  };

  const allEnsuredDates = useMemo(() => {
    const list = [];
    // 🚀 🆕 現在表示している月の「YYYY-MM」形式を作る
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    // 1. 手動キープ分（表示中の月のみに限定！）
    manualKeeps
      .filter(k => k.date.startsWith(currentMonthPrefix)) // 🚀 🆕 ここで12月分などを弾く
      .forEach(k => {
        list.push({ date: k.date, time: k.start_time || '09:00' });
      });

    const lastDate = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDate; d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toLocaleDateString('sv-SE');
      const regTime = checkIsRegularKeep(date);
      
      // 2. 定期キープ分（自社の定期日であり、除外されておらず、手動と被っていない場合）
      if (regTime && !exclusions.includes(dateStr)) {
        if (!list.some(item => item.date === dateStr)) {
          list.push({ date: dateStr, time: regTime });
        }
      }
    }
    // 日付順に並び替え
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [manualKeeps, regularRules, exclusions, year, month]);

  const addToList = async (resident) => {
    if (!shopId) return alert("提携業者が未設定です");
    if (draftList.some(d => d.member_id === resident.id)) return;
    
    // 初期メニューとして施設専用メニューの1番目を選択（もしあれば）
    const defaultMenu = shopServices[0]?.name === '（施設用メニュー未設定）' ? 'カット' : (shopServices[0]?.name || 'カット');

    const { data } = await supabase.from('visit_list_drafts').insert([{ 
      facility_user_id: facilityId, 
      shop_id: shopId, 
      member_id: resident.id,
      menu_name: defaultMenu 
    }]).select('*, members(*)').single();
    if (data) setDraftList([...draftList, data]);
  };

  const removeFromList = async (id) => {
    await supabase.from('visit_list_drafts').delete().eq('id', id);
    setDraftList(draftList.filter(d => d.id !== id));
  };

  const updateMenu = async (id, menu) => {
    await supabase.from('visit_list_drafts').update({ menu_name: menu }).eq('id', id);
    setDraftList(draftList.map(d => d.id === id ? { ...d, menu_name: menu } : d));
  };

  const unselectedResidents = residents
    .filter(r => 
      // 1. 今のドラフト（選択中）に入っていない
      !draftList.some(d => d.member_id === r.id) && 
      // 🚀 2. 🆕 今月すでに「完了」していない人だけを表示
      !completedMemberIds.includes(r.id) &&
      // 3. 検索ワードに一致する
      (r.name.includes(searchTerm) || (r.room || '').includes(searchTerm))
    )
    .sort((a, b) => {
      if (sortMode === 'floor') {
        // --- 階数順 ---
        const fA = parseInt(String(a.floor).replace(/[^0-9]/g, '')) || 999;
        const fB = parseInt(String(b.floor).replace(/[^0-9]/g, '')) || 999;
        if (fA !== fB) return fA - fB;
        // 階数が同じなら部屋番号順
        return (a.room || "").localeCompare(b.room || "", undefined, { numeric: true });
      } else {
        // --- あいうえお順 ---
        const kanaA = (a.kana || a.name || "").trim();
        const kanaB = (b.kana || b.name || "").trim();
        return kanaA.localeCompare(kanaB, 'ja');
      }
    });

  if (loading) return <div style={centerStyle}>読込中...</div>;

  return (
    <div style={containerStyle(isMobile)}>
      <header style={statusHeader}>
        <div style={keepInfoCard}>
          {/* 🚀 🆕 【ここを差し替え】ラベルと月切り替えボタンのセット */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
             <div style={{ ...smallLabel, marginBottom: 0 }}><Calendar size={14} /> 訪問予定の確認・選択月</div>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '4px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
               <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={navMiniBtn}><ChevronLeft size={16}/></button>
               <span style={{ fontWeight: '900', fontSize: '1rem', color: '#3d2b1f', minWidth: '80px', textAlign: 'center' }}>
                 {year} / {month + 1}
               </span>
               <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={navMiniBtn}><ChevronRight size={16}/></button>
             </div>
          </div>

          <div style={badgeArea}>
  {allEnsuredDates.map(item => {
              // 🚀 🆕 この日の予約ステータスをチェック
              const dateStatus = confirmedDates.find(d => d.scheduled_date === item.date)?.status;
              const isCompleted = dateStatus === 'completed'; // 完了済み
              const isConfirmed = dateStatus === 'pending';   // 予約確定（施術前）
              const isNew = !dateStatus;                     // まだ予約になっていない新規

              return (
                <span 
                  key={item.date} 
                  style={{
                    ...keepBadge,
                    // 🎨 ステータスに合わせて色を変える
                    background: isCompleted ? '#f1f5f9' : (isConfirmed ? '#10b981' : '#3d2b1f'),
                    color: isCompleted ? '#94a3b8' : '#fff',
                    border: isCompleted ? '1px solid #e2e8f0' : 'none',
                    opacity: isCompleted ? 0.8 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isCompleted && <CheckCircle2 size={12} />}
                  {item.date.replace(/-/g, '/')}
                  <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>({item.time?.substring(0, 5)})</span>
                  {isCompleted && <span style={{ fontSize: '0.6rem', fontWeight: 'normal' }}>[完了]</span>}
                </span>
              );
            })}
            {allEnsuredDates.length === 0 && <span style={noDataText}>訪問日が確保されていません</span>}
          </div>
        </div>
        <div style={shopInfoCard}>
          <div style={smallLabel}><Scissors size={14} /> 今回の担当ショップ</div>
          <div style={shopNameDisplay}>{shopName || '未設定'}</div>
        </div>
      </header>

      <div style={mainGrid(isMobile)}>
        <section style={columnBox}>
          <div style={sectionHeader}>
            <div style={headerTextGroup}>
               <h3 style={sectionTitle}><Users size={20} /> 入居者名簿</h3>
               <span style={countBadgeGray}>{unselectedResidents.length}名</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
              <button 
                onClick={() => setSortMode('floor')}
                style={sortTabStyle(sortMode === 'floor')}
              >
                階数
              </button>
              <button 
                onClick={() => setSortMode('name')}
                style={sortTabStyle(sortMode === 'name')}
              >
                名前
              </button>
            </div>

            <div style={searchBox}>
              <Search size={16} color="#999" />
              <input type="text" placeholder="名前/部屋番号..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={searchInput}/>
            </div>
          </div>
          
          <div style={scrollArea}>
            {(() => {
              let lastLabel = ""; // 直前のカテゴリを記憶する変数
              
              return unselectedResidents.map((res) => {
                // 🚀 🆕 現在のカテゴリ見出しを決定
                let currentLabel = "";
                if (sortMode === 'floor') {
                  currentLabel = res.floor ? (String(res.floor).includes('F') ? res.floor : `${res.floor}F`) : "階数未設定";
                } else {
                  // 頭文字を抽出（かながあれば優先）
                  currentLabel = (res.kana || res.name || "？").charAt(0);
                }

                // 🚀 🆕 直前の人とカテゴリが変わったか判定
                const isNewGroup = currentLabel !== lastLabel;
                lastLabel = currentLabel;

                return (
                  <React.Fragment key={res.id}>
                    {/* カテゴリが変わった時だけ見出しを表示 */}
                    {isNewGroup && (
                      <div style={groupHeaderStyle}>
                        {currentLabel}
                      </div>
                    )}
                    
                    <motion.div 
                      onClick={() => addToList(res)} 
                      style={residentCard} 
                      whileHover={{ x: 5, backgroundColor: '#fcfaf7' }} 
                      whileTap={{ scale: 0.98 }}
                    >
                      <div style={resInfo}>
                        <div style={roomTagBox}>
                          <span style={fLabel}>{res.floor}</span>
                          <span style={rLabel}>{res.room}</span>
                        </div>
                        <span style={nameText}>{res.name} 様</span>
                      </div>
                      <UserPlus size={20} color="#c5a059" />
                    </motion.div>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </section>

        <section style={columnBox}>
          <div style={{...sectionHeader, borderBottom: '2px solid #c5a059', paddingBottom: '10px'}}>
            <div style={headerTextGroup}>
              <h3 style={{...sectionTitle, color: '#c5a059'}}><ListChecks size={20} /> 施術希望者</h3>
              <span style={countBadgeGold}>{draftList.length}名</span>
            </div>
          </div>

          <div style={{...scrollArea, background: '#fff9e6', borderColor: '#f0e6d2'}}>
            <AnimatePresence>
              {draftList.map(item => (
                <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 50 }} style={selectedCard}>
                  <div style={{flex: 1}}>
                    <div style={resInfo}>
                      <span style={roomBadgeSimple}>{item.members?.floor} {item.members?.room}</span>
                      <span style={nameTextMain}>{item.members?.name} 様</span>
                    </div>
                    <div style={menuRow}>
                      <select value={item.menu_name} onChange={(e) => updateMenu(item.id, e.target.value)} style={menuSelect}>
                        {shopServices.map(s => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button onClick={() => removeFromList(item.id)} style={removeBtn}><UserMinus size={20} /></button>
                </motion.div>
              ))}
            </AnimatePresence>
            {draftList.length === 0 && (
              <div style={emptyState}>左の名簿から<br/>今回の希望者をタップしてください</div>
            )}
          </div>
        </section>
      </div>

      <footer style={footerStyle}>
        <div style={saveNotice}>✨ リストは自動保存されています</div>
        <button 
  onClick={() => setActiveTab('booking')} // 🆕 アラートから変更
  style={nextStepBtn(draftList.length > 0)}
  disabled={draftList.length === 0}
>
  これで決まり！予約確定へ進む <ArrowRight size={22} />
</button>
      </footer>
    </div>
  );
};

// スタイルは前回と同じ
const containerStyle = (isMobile) => ({ width: '100%', maxWidth: '1100px', margin: '0 auto' });
const centerStyle = { textAlign: 'center', padding: '100px', color: '#3d2b1f', fontWeight: 'bold' };
const statusHeader = { display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' };
const keepInfoCard = { background: '#fff', padding: '15px 25px', borderRadius: '15px', border: '1px solid #eee', flex: 2, minWidth: '300px' };
const shopInfoCard = { background: '#fff', padding: '15px 25px', borderRadius: '15px', border: '1px solid #eee', flex: 1, minWidth: '200px' };
const smallLabel = { fontSize: '0.7rem', color: '#999', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' };
const badgeArea = { display: 'flex', gap: '8px', flexWrap: 'wrap' };
const keepBadge = { background: '#3d2b1f', color: '#fff', padding: '4px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' };
const shopNameDisplay = { fontSize: '1.1rem', fontWeight: '900', color: '#3d2b1f' };
const noDataText = { fontSize: '0.85rem', color: '#ccc' };
const mainGrid = (isMobile) => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.1fr', gap: '25px', marginBottom: '40px' });
const columnBox = { background: '#fff', borderRadius: '24px', border: '1px solid #eee', padding: '20px', display: 'flex', flexDirection: 'column', height: '650px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const sectionHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const headerTextGroup = { display: 'flex', alignItems: 'center', gap: '10px' };
const sectionTitle = { margin: 0, fontSize: '1.1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px', color: '#3d2b1f' };
const countBadgeGray = { background: '#f1f5f9', color: '#64748b', padding: '2px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' };
const countBadgeGold = { background: '#c5a059', color: '#fff', padding: '2px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' };
const searchBox = { display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' };
const searchInput = { border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '120px' };
const scrollArea = { flex: 1, overflowY: 'auto', padding: '10px', borderRadius: '18px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' };
const residentCard = { background: '#fff', padding: '12px 15px', borderRadius: '12px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: '0.2s' };
const selectedCard = { background: '#fff', padding: '15px', borderRadius: '15px', border: '2px solid #c5a059', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 15px rgba(197, 160, 89, 0.1)' };
const resInfo = { display: 'flex', alignItems: 'center', gap: '12px' };
const roomTagBox = { display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f1f5f9', padding: '4px 8px', borderRadius: '8px', minWidth: '40px' };
const fLabel = { fontSize: '0.6rem', fontWeight: '900', color: '#94a3b8' };
const rLabel = { fontSize: '0.85rem', fontWeight: '900', color: '#3d2b1f' };
const nameText = { fontWeight: 'bold', fontSize: '0.95rem', color: '#334155' };
const nameTextMain = { fontWeight: '900', fontSize: '1.1rem', color: '#3d2b1f' };
const roomBadgeSimple = { background: '#3d2b1f', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' };
const menuRow = { marginTop: '10px' };
const menuSelect = { padding: '8px 12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '900', cursor: 'pointer', outline: 'none', background: '#fff', width: '100%', color: '#3d2b1f' };
const removeBtn = { background: '#fff', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '10px', padding: '10px', cursor: 'pointer', transition: '0.2s' };
const emptyState = { textAlign: 'center', color: '#cbd5e1', paddingTop: '100px', fontSize: '0.9rem', fontWeight: 'bold' };
const footerStyle = { textAlign: 'center', paddingBottom: '100px', marginTop: '30px' };
const saveNotice = { fontSize: '0.8rem', color: '#c5a059', fontWeight: 'bold', marginBottom: '15px' };
const nextStepBtn = (active) => ({ 
  background: active ? '#3d2b1f' : '#ccc', color: '#fff', border: 'none', padding: '20px 50px', borderRadius: '20px', 
  fontSize: '1.2rem', fontWeight: '900', cursor: active ? 'pointer' : 'default', 
  display: 'flex', alignItems: 'center', gap: '15px', margin: '0 auto',
  boxShadow: active ? '0 10px 20px rgba(61, 43, 31, 0.2)' : 'none' 
});
const sortTabStyle = (active) => ({
  padding: '6px 12px',
  borderRadius: '8px',
  fontSize: '0.7rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  border: 'none',
  background: active ? '#fff' : 'transparent',
  color: active ? '#3d2b1f' : '#64748b',
  boxShadow: active ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
  transition: '0.2s'
});
// 🆕 月切り替え用の丸いボタン
const navMiniBtn = {
  background: '#fff', 
  border: '1px solid #ddd', 
  borderRadius: '50%',
  width: '28px', 
  height: '28px', 
  cursor: 'pointer', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  color: '#3d2b1f',
  transition: '0.2s',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
};

const groupHeaderStyle = {
  padding: '12px 10px 4px',
  fontSize: '1rem',
  fontWeight: '900',
  color: '#c2020f',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  // 横線を入れて「区切り」を強調
  borderBottom: '1px solid #f0e6d2',
  marginBottom: '5px',
  background: 'linear-gradient(to right, #fff, #fcfaf7)',
  position: 'sticky', // スクロール時に見出しを固定したい場合
  top: 0,
  zIndex: 2
};
export default FacilityListUp_PC;