import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  Users, UserPlus, UserMinus, Calendar, ArrowRight, 
  CheckCircle2, Search, Info, ListChecks, Scissors,
  ChevronLeft, ChevronRight,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityListUp_PC = ({ 
  facilityId, isMobile, setActiveTab, sharedDate: viewDate, setSharedDate: setViewDate, 
  setIsOverCapacity // 🚀 🆕 親から受け取る関数を追加
}) => {
  const [residents, setResidents] = useState([]);
  const [draftList, setDraftList] = useState([]);
  const [draftSortMode, setDraftSortMode] = useState('floor'); // 🚀 追加：右側の並べ替えモード

  // 🚀 追加：施術希望者（右側）のソート済みリストを計算
  const sortedDraftList = useMemo(() => {
  return [...draftList].sort((a, b) => {
    const m1 = a.members || {};
    const m2 = b.members || {};
    
    if (draftSortMode === 'floor') {
      // 階数順（数字を抽出して比較）
      const f1 = parseInt(String(m1.floor).replace(/[^0-9]/g, '')) || 999;
      const f2 = parseInt(String(m2.floor).replace(/[^0-9]/g, '')) || 999;
      if (f1 !== f2) return f1 - f2;
      // 階数が同じなら部屋番号順
      return (m1.room || "").localeCompare(m2.room || "", undefined, { numeric: true });
    } else {
      // 名前順（ふりがな優先）
      const k1 = (m1.kana || m1.name || "").trim();
      const k2 = (m2.kana || m2.name || "").trim();
      return k1.localeCompare(k2, 'ja');
    }
  });
}, [draftList, draftSortMode]);
  const [completedMemberIds, setCompletedMemberIds] = useState([]);
  const [confirmedDates, setConfirmedDates] = useState([]);
  const [lastVisitMap, setLastVisitMap] = useState({});
  const [manualKeeps, setManualKeeps] = useState([]);
  const [regularRules, setRegularRules] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopProfile, setShopProfile] = useState(null);
  
  const [shopId, setShopId] = useState(null);
  const [shopName, setShopName] = useState('');
  const [shopServices, setShopServices] = useState([]); 
  const [facilityName, setFacilityName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState('floor');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const calculateCapacity = (dateStr, startTimeStr, shopProfile) => {
    if (!shopProfile || !startTimeStr) return 0;
    const toMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const d = new Date(dateStr);
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const bHours = shopProfile.business_hours || {};
    const startMin = toMin(startTimeStr);
    const endMin = toMin(shopProfile.facility_visit_end || '17:00');
    const lunchStartMin = toMin(shopProfile.facility_lunch_start || '12:00');
    const lunchEndMin = toMin(shopProfile.facility_lunch_end || '13:00');
    let activeMinutes = endMin - startMin;
    const overlapStart = Math.max(startMin, lunchStartMin);
    const overlapEnd = Math.min(endMin, lunchEndMin);
    const overlapMinutes = Math.max(0, overlapEnd - overlapStart);
    activeMinutes -= overlapMinutes;
    if (activeMinutes <= 0) return 0;
    const capacityPerStaff = shopProfile.hourly_capacity_per_staff || 2.0;
    const staffCount = shopProfile.facility_staff_count || 1;
    return Math.floor((activeMinutes / 60) * staffCount * capacityPerStaff);
  };

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
  }, [facilityId, viewDate]);

  // 🚀 🆕 ここから追加：検索ワードが変わるたびに、キーボードの選択位置をリセットする
  useEffect(() => {
    if (searchTerm) {
      setSelectedIndex(0);  // 検索されたら、一番上の人を自動でフォーカス（黄色にする）
    } else {
      setSelectedIndex(-1); // 検索が空になったらフォーカスを外す
    }
  }, [searchTerm]);

  // 以降、既存の fetchData 関数へ続く
  const fetchData = async (targetFacilityName) => {
    try {
      const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

      const [resData, draftData, connData, visitedRes, visitDatesRes, allHistoryRes] = await Promise.all([
        supabase.from('members').select('*').eq('facility', targetFacilityName).order('room'),
        supabase.from('visit_list_drafts').select('*, members(*)').eq('facility_user_id', facilityId),
        // 🚀 🆕 profiles(*) に変更して、すべての設定値を取得します
        supabase.from('shop_facility_connections').select('shop_id, regular_rules, profiles(*)').eq('facility_user_id', facilityId).eq('status', 'active').limit(1).maybeSingle(),
        supabase.from('visit_request_residents').select('member_id, visit_requests!inner(scheduled_date)').eq('status', 'completed').eq('visit_requests.facility_user_id', facilityId).gte('visit_requests.scheduled_date', startOfMonth).lte('visit_requests.scheduled_date', endOfMonth),
        supabase.from('visit_requests').select('scheduled_date, status').eq('facility_user_id', facilityId).gte('scheduled_date', startOfMonth).lte('scheduled_date', endOfMonth),
        // 🚀 🆕 追加：全期間の完了履歴をすべて取得（ここから最新日を算出します）
        supabase.from('visit_request_residents').select('member_id, visit_requests!inner(scheduled_date)').eq('status', 'completed').eq('visit_requests.facility_user_id', facilityId)
      ]);

      // 🚀 🆕 各メンバーの「一番新しい訪問日」を割り出すロジック
      const vMap = {};
      allHistoryRes.data?.forEach(v => {
        const mid = v.member_id;
        const date = v.visit_requests.scheduled_date;
        // まだ登録がない、または記録されている日付より新しい日付なら上書き
        if (!vMap[mid] || date > vMap[mid]) {
          vMap[mid] = date;
        }
      });
      setLastVisitMap(vMap);

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
        // 🚀 🆕 取得した店舗設定（キャパや休憩時間など）をStateに保存
        setShopProfile(connData.data.profiles);

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
    if (!shopProfile) return []; // 店舗データがまだ無い時は空で返す

    const list = [];
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    // 1. 手動キープ分
    manualKeeps
      .filter(k => k.date.startsWith(currentMonthPrefix))
      .forEach(k => {
        // 🚀 shopProfile を使って計算
        const cap = calculateCapacity(k.date, k.start_time || '09:00', shopProfile); 
        list.push({ date: k.date, time: k.start_time || '09:00', capacity: cap });
      });

    // 2. 定期キープ分
    const lastDate = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDate; d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toLocaleDateString('sv-SE');
      const regTime = checkIsRegularKeep(date);
      if (regTime && !exclusions.includes(dateStr)) {
        if (!list.some(item => item.date === dateStr)) {
          // 🚀 shopProfile を使って計算
          const cap = calculateCapacity(dateStr, regTime, shopProfile);
          list.push({ date: dateStr, time: regTime, capacity: cap });
        }
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [manualKeeps, regularRules, exclusions, year, month, shopProfile]); // 🚀 依存配列に shopProfile を追加

  // 🚀 🆕 直後に追加：合計キャパと判定
  const totalMonthlyCapacity = useMemo(() => {
    return allEnsuredDates.reduce((sum, date) => sum + (date.capacity || 0), 0);
  }, [allEnsuredDates]);

  const isOverCapacity = draftList.length > totalMonthlyCapacity;

  // 🚀 🆕 ここに追加：判定結果が変わるたびに親へ報告する
  useEffect(() => {
    if (setIsOverCapacity) {
      setIsOverCapacity(isOverCapacity); // 計算結果(true/false)を親に送る
    }
    // クリーンアップ：この画面を離れる時は一旦ロックを解除しておく（親切設計）
    return () => {
      if (setIsOverCapacity) setIsOverCapacity(false);
    };
  }, [isOverCapacity, setIsOverCapacity]);

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

  // 🚀 🆕 ここから追加：キーボードの「↑」「↓」「Enter」入力を判定する関数
  const handleKeyDown = (e) => {
    // 候補が一人もいない時は何もしない
    if (unselectedResidents.length === 0) return;

    if (e.key === 'ArrowDown') {
      // ↓キー：一つ下の番号へ（最大値を超えないように制限）
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, unselectedResidents.length - 1));
    } else if (e.key === 'ArrowUp') {
      // ↑キー：一つ上の番号へ（0より小さくならないように制限）
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      // Enterキー：現在フォーカスされている人をリストに追加
      e.preventDefault();
      if (selectedIndex >= 0 && unselectedResidents[selectedIndex]) {
        addToList(unselectedResidents[selectedIndex]);
      }
    }
  };

  // 💡 以降、既存のフィルタリング処理へ続く
  const unselectedResidents = residents
    .filter(r => 
      !draftList.some(d => d.member_id === r.id) && 
      !completedMemberIds.includes(r.id) &&
      // 🚀 🆕 修正：name, room に加えて kana（ふりがな）も検索対象に含める！
      (
        r.name.includes(searchTerm) || 
        (r.room || '').includes(searchTerm) || 
        (r.kana || '').includes(searchTerm) // 👈 ここを追加
      )
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
              <input 
  type="text" 
  placeholder="名前/部屋番号/ふりがな..." 
  value={searchTerm} 
  onChange={(e) => setSearchTerm(e.target.value)} 
  onKeyDown={handleKeyDown} 
  style={searchInput}
/>
            </div>
          </div>
          
          <div style={scrollArea}>
            {(() => {
              let lastLabel = ""; // 直前のカテゴリを記憶する変数
              
              return unselectedResidents.map((res, index) => { 
  // 🚀 🆕 現在のカテゴリ見出しを決定
  let currentLabel = "";
  if (sortMode === 'floor') {
    currentLabel = res.floor ? (String(res.floor).includes('F') ? res.floor : `${res.floor}F`) : "階数未設定";
  } else {
    currentLabel = (res.kana || res.name || "？").charAt(0);
  }

  const isNewGroup = currentLabel !== lastLabel;
  lastLabel = currentLabel;

  return (
    <React.Fragment key={res.id}>
      {isNewGroup && (
        <div style={groupHeaderStyle}>
          {currentLabel}
        </div>
      )}
      
      <motion.div 
        onClick={() => addToList(res)} 
        style={{
          ...residentCard,
          // 💡 index (0, 1, 2...) と selectedIndex (選ばれた番号) が一致したら色を変える
          backgroundColor: index === selectedIndex ? '#fff9e6' : '#fff', 
          border: index === selectedIndex ? '2px solid #c5a059' : '1px solid #f1f5f9',
          transform: index === selectedIndex ? 'translateX(5px)' : 'none'
        }}
        whileHover={{ x: 5, backgroundColor: '#fcfaf7' }} 
        whileTap={{ scale: 0.98 }}
      >
                      <div style={resInfo}>
                        <div style={roomTagBox}>
                          <span style={rLabel}>{res.room}</span>
                        </div>
                        
                        {/* 🚀 🆕 修正：名前と前回日付を縦に並べるコンテナへ */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={nameText}>{res.name} 様</span>
                          
                          {/* 💡 前回の訪問日があれば表示 */}
                          {lastVisitMap[res.id] && (
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 'bold' }}>
                              前回：{lastVisitMap[res.id].replace(/-/g, '/')}
                            </span>
                          )}
                        </div>
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
  <div style={{...sectionHeader, borderBottom: isOverCapacity ? '2px solid #ef4444' : '2px solid #c5a059', paddingBottom: '10px'}}>
    <div style={headerTextGroup}>
      <h3 style={{...sectionTitle, color: isOverCapacity ? '#ef4444' : '#c5a059'}}><ListChecks size={20} /> 施術希望者</h3>
      <span style={isOverCapacity ? countBadgeRed : countBadgeGold}>
        {draftList.length} / {totalMonthlyCapacity}名
      </span>
    </div>

    {/* 🚀 追加：右側専用の並べ替えボタン */}
    <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
      <button onClick={() => setDraftSortMode('floor')} style={sortTabStyle(draftSortMode === 'floor')}>階数</button>
      <button onClick={() => setDraftSortMode('name')} style={sortTabStyle(draftSortMode === 'name')}>名前</button>
    </div>
  </div>

  {/* 警告バナー（既存通り） */}
  <AnimatePresence>
    {isOverCapacity && (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ background: '#fff1f2', border: '2px solid #fecdd3', borderRadius: '15px', padding: '15px', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <AlertCircle size={20} color="#e11d48" style={{ marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#be123c', marginBottom: '4px' }}>施術可能人数を超えています</div>
            <div style={{ fontSize: '0.75rem', color: '#e11d48', lineHeight: '1.5' }}>枠を調整するか、人数を減らしてください。</div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* 🚀 修正：sortedDraftList を使い、見出しを表示するループ */}
  <div style={{...scrollArea, background: isOverCapacity ? '#fff5f5' : '#fff9e6', borderColor: isOverCapacity ? '#fca5a5' : '#f0e6d2'}}>
    <AnimatePresence mode="popLayout">
      {(() => {
        let lastLabel = ""; 
        return sortedDraftList.map((item) => { 
          const res = item.members || {};
          let currentLabel = "";
          
          if (draftSortMode === 'floor') {
            currentLabel = res.floor ? (String(res.floor).includes('F') ? res.floor : `${res.floor}F`) : "未設定";
          } else {
            currentLabel = (res.kana || res.name || "？").charAt(0);
          }

          const isNewGroup = currentLabel !== lastLabel;
          lastLabel = currentLabel;

          return (
  <motion.div 
    key={item.id} 
    layout 
    initial={{ opacity: 0, y: 10 }} 
    animate={{ opacity: 1, y: 0 }} 
    exit={{ opacity: 0, scale: 0.95 }}
    style={{ marginBottom: '10px' }} // カード間の余白をここで制御
  >
    {/* グループ見出し */}
    {isNewGroup && (
      <div style={groupHeaderStyle}>
        {currentLabel}
      </div>
    )}
    
    {/* 施術希望者カード本体 */}
    <div style={selectedCard}>
      <div style={{flex: 1}}>
        <div style={resInfo}>
          <span style={roomBadgeSimple}>{item.members?.room || "---"}</span>
          <span style={nameTextMain}>{res.name} 様</span>
        </div>
        <div style={menuRow}>
          <select value={item.menu_name} onChange={(e) => updateMenu(item.id, e.target.value)} style={menuSelect}>
            {shopServices.map(s => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <button onClick={() => removeFromList(item.id)} style={removeBtn}>
        <UserMinus size={20} />
      </button>
    </div>
  </motion.div>
);
        });
      })()}
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
          // 🚀 🆕 条件：リストが空ではなく、かつキャパオーバーでない時だけ動く
          onClick={() => !isOverCapacity && setActiveTab('booking')} 
          style={nextStepBtn(draftList.length > 0 && !isOverCapacity)}
          // 🚀 🆕 リストが空、またはキャパオーバーならボタンを無効化
          disabled={draftList.length === 0 || isOverCapacity}
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
  // 🚀 🆕 active が false（＝キャパオーバー）ならグレーにする
  background: active ? '#3d2b1f' : '#ccc', 
  color: '#fff', 
  border: 'none', 
  padding: '20px 50px', 
  borderRadius: '20px', 
  fontSize: '1.2rem', 
  fontWeight: '900', 
  // 🚀 🆕 禁止マークを出すように変更
  cursor: active ? 'pointer' : 'not-allowed', 
  display: 'flex', 
  alignItems: 'center', 
  gap: '15px', 
  margin: '0 auto',
  boxShadow: active ? '0 10px 20px rgba(61, 43, 31, 0.2)' : 'none',
  transition: '0.3s'
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
const countBadgeRed = { background: '#ef4444', color: '#fff', padding: '2px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' };
const warningBannerStyle = { background: '#fef2f2', color: '#b91c1c', padding: '10px 15px', fontSize: '0.75rem', fontWeight: 'bold', borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px' };
export default FacilityListUp_PC;