import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { 
  Users, CalendarPlus, CheckSquare, Clock, History, Printer, 
  FileText, Settings, HelpCircle, LogOut, Building2, Search,
  ChevronRight, Menu, X, Store, 
  ListChecks
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FacilitySettings_PC from './parts/FacilitySettings_PC';
import FacilityFindShops_PC from './parts/FacilityFindShops_PC';
import FacilityPartnerShops_PC from './parts/FacilityPartnerShops_PC';
import FacilityUserList_PC from './parts/FacilityUserList_PC';
import FacilityKeepDate_PC from './parts/FacilityKeepDate_PC';
import FacilityListUp_PC from './parts/FacilityListUp_PC.jsx';
import FacilityBooking_PC from './parts/FacilityBooking_PC';
import FacilityStatus_PC from './parts/FacilityStatus_PC';
import FacilityHistory_PC from './parts/FacilityHistory_PC';
import FacilityInvoice_PC from './parts/FacilityInvoice_PC';
import FacilityPrintList_PC from './parts/FacilityPrintList_PC';

const FacilityPortal = () => {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('residents');
  const [sharedDate, setSharedDate] = useState(new Date());
  const [shopProfile, setShopProfile] = useState(null);
  const [draftCount, setDraftCount] = useState(0); 
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const [urgentKeeps, setUrgentKeeps] = useState([]); 
  const [unconfirmedKeeps, setUnconfirmedKeeps] = useState([]);
  // 🚀 🆕 修正：月単位ではなく、7日前を切った未確定枠をピュアに格納する部屋
  const [warningKeeps, setWarningKeeps] = useState([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // =========================================================
  // 🚀 共通ロジックをコンポーネント直下に移動（これでどこからでも呼べる）
  // =========================================================
  
  // ① 定期キープの判定ロジック
  const checkIsRegularKeep = (date, rules) => {
    if (!rules || rules.length === 0) return false;
    const day = date.getDay();
    const dom = date.getDate();
    const m = date.getMonth() + 1;
    const nthWeek = Math.ceil(dom / 7);
    const t7 = new Date(date); t7.setDate(dom + 7);
    const isL1 = t7.getMonth() !== date.getMonth(); 
    const t14 = new Date(date); t14.setDate(dom + 14);
    const isL2 = t14.getMonth() !== date.getMonth() && !isL1;

    let matched = false;
    rules.forEach(r => {
      const monthMatch = (r.monthType === 0) || (r.monthType === 1 && m % 2 !== 0) || (r.monthType === 2 && m % 2 === 0);
      const dayMatch = (r.day === day);
      const weekMatch = (r.week === nthWeek) || (r.week === -1 && isL1) || (r.week === -2 && isL2);
      if (monthMatch && dayMatch && weekMatch) matched = true;
    });
    return matched;
  };

  // ② 施術可能人数の計算機
  const calculateCapacity = (dateStr, startTimeStr, profile) => {
    if (!profile || !startTimeStr) return 0;
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const startMin = toMin(startTimeStr);
    const endMin = toMin(profile.facility_visit_end || '17:00');
    const lunchStartMin = toMin(profile.facility_lunch_start || '12:00');
    const lunchEndMin = toMin(profile.facility_lunch_end || '13:00');
    
    let activeMinutes = endMin - startMin;
    const overlapStart = Math.max(startMin, lunchStartMin);
    const overlapEnd = Math.min(endMin, lunchEndMin);
    const overlapMinutes = Math.max(0, overlapEnd - overlapStart);
    activeMinutes -= overlapMinutes;
    
    const capPerStaff = profile.hourly_capacity_per_staff || 2.0;
    const staffCount = profile.facility_staff_count || 1;
    return Math.floor((activeMinutes / 60) * staffCount * capPerStaff);
  };

  // =========================================================

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('logout') === 'true') return;

      const loggedInId = sessionStorage.getItem('facility_user_id') || localStorage.getItem('facility_user_id');
      const isActive = sessionStorage.getItem('facility_auth_active') || localStorage.getItem('facility_auth_active');

      if (isActive === 'true' && loggedInId === facilityId) {
        sessionStorage.setItem('facility_user_id', loggedInId);
        sessionStorage.setItem('facility_auth_active', 'true');
        fetchFacilityData();
      } else {
        navigate(`/facility-login/${facilityId}`);
      }
    };
    checkAuth();
  }, [facilityId, navigate]);

  const fetchFacilityData = async () => {
    setLoading(true);
    try {
      const { data: fac } = await supabase.from('facility_users').select('*').eq('id', facilityId).single();
      if (fac) setFacility(fac);

      const [connRes, draftRes, pendingReqRes] = await Promise.all([
        supabase.from('shop_facility_connections').select('regular_rules, profiles(*)').eq('facility_user_id', facilityId).eq('status', 'active').maybeSingle(),
        supabase.from('visit_list_drafts').select('*', { count: 'exact', head: true }).eq('facility_user_id', facilityId),
        // 🚀 🆕 訪問業者（shop）からこの施設宛に届いている「承認待ち」の件数をDBから直接カウント！
        supabase.from('shop_facility_connections').select('*', { count: 'exact', head: true }).eq('facility_user_id', facilityId).eq('status', 'pending').eq('created_by_type', 'shop')
      ]);
      
      if (connRes.data) setShopProfile(connRes.data.profiles);
      setDraftCount(draftRes.count || 0);
      setPendingRequestCount(pendingReqRes.count || 0); // 🚀 🆕 カウント結果をステートに保存！

      const { data: mData } = await supabase.from('keep_dates').select('*').eq('facility_user_id', facilityId);
      // 💡 確実に確定データをすくうため、隠れ本物カラム【facility_user_id】で検索
      const { data: visitData } = await supabase.from('visit_requests').select('*').eq('facility_user_id', facilityId).neq('status', 'canceled');

      const todayStr = new Date().toLocaleDateString('sv-SE');
      const baseToday = new Date(`${todayStr}T00:00:00`); 
      const urgList = [];
      const warnList = []; // 🚀 🆕 オレンジバナー用の下書き配列
      const unconList = [];
      const rules = connRes.data?.regular_rules || [];

      const processedDates = new Set();

      // 🚀 A: まずは手動キープをスキャン
      (mData || []).forEach(k => {
        if (k.date < todayStr) return;
        processedDates.add(k.date);

        const isBooked = (visitData || []).some(v => 
          (v.status === 'confirmed' || v.status === 'completed') && 
          v.scheduled_date === k.date
        );

        if (!isBooked) {
          const isRegularDay = checkIsRegularKeep(new Date(`${k.date}T00:00:00`), rules);
          unconList.push({ ...k, isRegular: isRegularDay });
          
          const dObj = new Date(`${k.date}T00:00:00`);
          const diffTime = dObj.getTime() - baseToday.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          
          // 🛑 3日前を切っていたら緊急赤アラートへ
          if (diffDays >= 0 && diffDays <= 3) {
            urgList.push({ ...k, diffDays, isRegular: isRegularDay });
          }
          // ⚠️ 7日前を切っていたらオレンジアラートへ（月をまたいでいても検知します！）
          if (diffDays >= 0 && diffDays <= 7) {
            warnList.push({ ...k, diffDays, isRegular: isRegularDay });
          }
        }
      });

      // 🚀 B: 次に手動データがない「純粋な定期キープの日」も未来30日分自動スキャン
      const scanDate = new Date(`${todayStr}T00:00:00`); 
      for (let i = 0; i < 30; i++) {
        const dStr = scanDate.toLocaleDateString('sv-SE');
        
        if (!processedDates.has(dStr)) {
          const isRegularDay = checkIsRegularKeep(scanDate, rules);
          
          if (isRegularDay) {
            const isBooked = (visitData || []).some(v => 
              (v.status === 'confirmed' || v.status === 'completed') && 
              v.scheduled_date === dStr
            );

            if (!isBooked) {
              const fakeKeep = { id: `reg-${dStr}`, date: dStr, start_time: '09:00', isRegular: true };
              unconList.push(fakeKeep);

              const diffTime = scanDate.getTime() - baseToday.getTime();
              const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
              
              // 🛑 3日前を切っていたら緊急赤アラートへ
              if (diffDays >= 0 && diffDays <= 3) {
                urgList.push({ ...fakeKeep, diffDays });
              }
              // ⚠️ 7日前を切っていたらオレンジアラートへ
              if (diffDays >= 0 && diffDays <= 7) {
                warnList.push({ ...fakeKeep, diffDays });
              }
            }
          }
        }
        scanDate.setDate(scanDate.getDate() + 1);
      }

      // 🚀 最後に各Stateへ一括セット（前回のややこしい月の引き算は完全消去！）
      setUrgentKeeps(urgList);
      setUnconfirmedKeeps(unconList); 
      setWarningKeeps(warnList); // 🚀 🆕 オレンジリストをガチッと反映！

    } catch (err) {
      console.error("データ取得エラー:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!shopProfile) {
      setTotalCapacity(0);
      return;
    }
    const currentMonthPrefix = `${sharedDate.getFullYear()}-${String(sharedDate.getMonth() + 1).padStart(2, '0')}`;
    const rules = shopProfile.regular_rules || [];
    
    const manualTotal = unconfirmedKeeps
      .filter(k => k.date.startsWith(currentMonthPrefix))
      .reduce((sum, k) => sum + calculateCapacity(k.date, k.start_time || '09:00', shopProfile), 0);

    let regularTotal = 0;
    const lastDate = new Date(sharedDate.getFullYear(), sharedDate.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= lastDate; d++) {
      const date = new Date(sharedDate.getFullYear(), sharedDate.getMonth(), d);
      const dateStr = date.toLocaleDateString('sv-SE');
      const regTime = checkIsRegularKeep(date, rules); 
      
      if (regTime) {
         regularTotal += calculateCapacity(dateStr, regTime === true ? '09:00' : regTime, shopProfile);
      }
    }
    setTotalCapacity(manualTotal + regularTotal);
  }, [sharedDate, unconfirmedKeeps, shopProfile]);

  const isOverCapacity = draftCount > totalCapacity && totalCapacity > 0;

  const menuGroups = [
    {
      groupName: '基礎管理',
      items: [{ id: 'residents', label: '名簿', icon: <Users size={20} />, sub: '入居者名簿' }]
    },
    {
      groupName: '予約の3ステップ',
      isFlow: true,
      items: [
        { id: 'keep', label: 'キープ！この日とった！', icon: <CalendarPlus size={20} />, sub: 'STEP 1: 日程確保' },
        { id: 'list-up', label: 'リストアップしよう！', icon: <ListChecks size={20} />, sub: 'STEP 2: 利用者選択' },
        { id: 'booking', label: 'これで決まり！予約確定！', icon: <CheckSquare size={20} />, sub: 'STEP 3: 予約実行' },
      ]
    },
    {
      groupName: '運用・記録',
      items: [
        { id: 'status', label: '予約状況・進捗管理', icon: <Clock size={20} />, sub: '現在のステータス' },
        { id: 'history', label: '過去の訪問記録', icon: <History size={20} />, sub: '履歴の確認' },
      ]
    },
    {
      groupName: '帳票・精算',
      items: [
        { id: 'print_list', label: '掲示用名簿', icon: <Printer size={20} />, sub: '印刷用データ' },
        { id: 'invoice', label: '利用明細・精算確認', icon: <FileText size={20} />, sub: '利用明細' },
      ]
    },
    {
      groupName: '業者管理',
      items: [
        { id: 'partners', label: '提携業者', icon: <Store size={20} />, sub: '契約中のサービス' },
        { id: 'find_shops', label: '新しい業者を探す', icon: <Search size={20} />, sub: '提携先の開拓' },
      ]
    },
    {
      groupName: 'システム',
      items: [
        { id: 'settings', label: '受付・通知設定', icon: <Settings size={20} />, sub: 'システム設定' },
        { id: 'manual', label: '使い方ガイド', icon: <HelpCircle size={20} />, sub: 'マニュアル' },
      ]
    }
  ];

  const menuItems = menuGroups.flatMap(group => group.items);

  if (loading) return <div style={centerStyle}>読み込み中...</div>;

  return (
    <div style={desktopLayoutStyle}>
      {isMobile && (
        <div style={mobileHeaderStyle}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuToggleBtnStyle}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <span style={mobileBrandStyle}>SnipSnap Portal</span>
        </div>
      )}
      
      {isMobile && isMenuOpen && (
        <div onClick={() => setIsMenuOpen(false)} style={overlayStyle} />
      )}

      <aside style={getSidebarStyle(isMobile, isMenuOpen)}>
        <div style={sidebarHeaderStyle}>
          <div style={brandBadgeStyle}>SnipSnap FOR FACILITY</div>
          <div style={welcomeBoxStyle}>
            <p style={welcomeLabel}>Welcome,</p>
            <h2 style={facilityNameDisplay}>{facility?.facility_name} 様</h2>
          </div>
        </div>

        <nav style={navAreaStyle}>
          {menuGroups.map((group, gIdx) => (
            <div key={gIdx} style={groupWrapperStyle(group.isFlow)}>
              <div style={groupTitleStyle}>{group.groupName}</div>
              <div style={groupItemsContainer(group.isFlow)}>
                {group.items.map((item, iIdx) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'booking' && isOverCapacity) {
                        alert("施術可能人数を超えているため、予約確定へ進めません。\n名簿の人数を調整するか、訪問日を増やしてください。");
                        return;
                      }
                      setActiveTab(item.id);
                      if (isMobile) setIsMenuOpen(false);
                    }}
                    style={sidebarBtnStyle(activeTab === item.id, item.id === 'booking' && isOverCapacity)}
                  >
                    {group.isFlow ? (
                      <span style={stepNumberStyle(activeTab === item.id)}>{iIdx + 1}</span>
                    ) : (
                      <span style={btnIconStyle(activeTab === item.id)}>{item.icon}</span>
                    )}

                    <div style={btnTextWrapper}>
                      <span style={btnMainLabel}>{item.label}</span>
                      <span style={btnSubLabel(activeTab === item.id)}>{item.sub}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div style={sidebarFooterStyle}>
          <button 
            onClick={async () => { 
              if (window.confirm("ログアウトしますか？")) {
                await supabase.auth.signOut();
                sessionStorage.clear(); 
                localStorage.removeItem('facility_user_id');
                localStorage.removeItem('facility_auth_active');
                navigate('/login?logout=true', { replace: true }); 
              }
            }} 
            style={logoutBtnStyle}
          >
            <LogOut size={18} /> ログアウト
          </button>
        </div>
      </aside>

      <main style={getMainAreaStyle(isMobile)}>
        <div style={{ width: '100%', zIndex: 100 }}>
          <AnimatePresence>
            {/* 🚀 ❶ 提携リクエスト（紫バナー） */}
            {pendingRequestCount > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                style={{ background: '#f5f3ff', borderBottom: '1px solid #ddd6fe', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.3rem' }}>🎉</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#4f46e5' }}>訪問理美容の業者から、新しい「提携リクエスト」が届いています！</div>
                    <p style={{ fontSize: '0.7rem', color: '#6d28d9', margin: 0 }}>提携を承認すると訪問予約が可能になります。</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('settings')} // 🚀 ポチッと押したら「受付・通知設定」タブへひとっ飛び！
                  style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(79,70,229,0.25)', transition: '0.2s' }}
                >
                  確認・承認する ➔
                </button>
              </motion.div>
            )}

            {/* 🚀 ❷ 3日前を過ぎた緊急アラート（赤バナー） */}
            {/* 💡 修正：名簿作成中(list-up)や確定確認中(booking)のタブの時は、バナーを非表示にします！ */}
            {urgentKeeps.length > 0 && activeTab !== 'booking' && activeTab !== 'list-up' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                style={{ background: '#fef2f2', borderBottom: '1px solid #fecdd3', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🚨</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#be123c' }}>確定期限（3日前）が過ぎています！</div>
                    <p style={{ fontSize: '0.7rem', color: '#e11d48', margin: 0 }}>{urgentKeeps[0].date.replace(/-/g, '/')} の希望者を選んで予約確定してください。</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('list-up')}
                  style={{ background: '#e11d48', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  名簿を作成する
                </button>
              </motion.div>
            )}

            {/* 🚀 ❸ 通常の未確定アラート（オレンジバナー） */}
            {/* 🚀 🆕 【最終解決】7日前カウントダウン方式のオレンジバナー */}
            {urgentKeeps.length === 0 && warningKeeps.length > 0 && activeTab !== 'booking' && activeTab !== 'list-up' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa', padding: '10px 20px', display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#c2410c' }}>
                      期日が近づいている「訪問キープ枠」が {warningKeeps.length} 件あります！
                    </div>
                    <p style={{ fontSize: '0.7rem', color: '#ea580c', margin: 0 }}>
                      直近の訪問予定日（<strong>{warningKeeps[0].date.replace(/-/g, '/')}</strong> 等）の名簿を作成し、予約を確定させてください。
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('list-up')}
                  style={{ background: '#f97316', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  確認する
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <header style={contentHeaderStyle}>
          <div style={headerTitleGroup}>
             <span style={headerIcon}>{menuItems.find(i => i.id === activeTab)?.icon}</span>
             <div>
               <h1 style={headerMainTitle}>{menuItems.find(i => i.id === activeTab)?.label}</h1>
               <p style={headerSubTitle}>{facility?.facility_name} 様専用ページ</p>
             </div>
          </div>
        </header>

        <section style={contentBodyStyle(isMobile)}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'residents' ? (
                <FacilityUserList_PC facilityId={facilityId} isMobile={isMobile} />
              ) : activeTab === 'partners' ? (
                <FacilityPartnerShops_PC facilityId={facilityId} isMobile={isMobile} />
              ) : activeTab === 'keep' ? (
                <FacilityKeepDate_PC facilityId={facilityId} isMobile={isMobile} setActiveTab={setActiveTab} sharedDate={sharedDate} setSharedDate={setSharedDate} /> 
              ) : activeTab === 'list-up' ? (
                <FacilityListUp_PC 
                  facilityId={facilityId} 
                  isMobile={isMobile} 
                  setActiveTab={setActiveTab} 
                  sharedDate={sharedDate} 
                  setSharedDate={setSharedDate}
                />
              ) : activeTab === 'booking' ? ( 
                <FacilityBooking_PC facilityId={facilityId} isMobile={isMobile} setActiveTab={setActiveTab} sharedDate={sharedDate} setSharedDate={setSharedDate} />
              ) : activeTab === 'status' ? (
                <FacilityStatus_PC facilityId={facilityId} isMobile={isMobile} />
              ) : activeTab === 'history' ? ( 
                <FacilityHistory_PC facilityId={facilityId} isMobile={isMobile} sharedDate={sharedDate} setSharedDate={setSharedDate} />
              ) : activeTab === 'print_list' ? ( 
                <FacilityPrintList_PC facilityId={facilityId} />
              ) : activeTab === 'invoice' ? ( 
                <FacilityInvoice_PC facilityId={facilityId} sharedDate={sharedDate} setSharedDate={setSharedDate} />
              ) : activeTab === 'find_shops' ? (
                <FacilityFindShops_PC facilityId={facilityId} isMobile={isMobile} />
              ) : activeTab === 'settings' ? (
                <FacilitySettings_PC facilityId={facilityId} isMobile={isMobile} />
              ) : (
                <div style={placeholderCardStyle}>
                  <h3>【 {menuItems.find(i => i.id === activeTab)?.label} 】</h3>
                  <p>現在、パーツを個別に作成中です。</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
};

// スタイル定義は三土手さんの元のコードと同じため省略
const desktopLayoutStyle = { display: 'flex', minHeight: '100vh', background: '#fcfaf7', fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif' };
const getSidebarStyle = (isMobile, isMenuOpen) => ({ width: '280px', background: '#3d2b1f', color: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 300, boxShadow: isMenuOpen ? '10px 0 30px rgba(0,0,0,0.3)' : '4px 0 20px rgba(0,0,0,0.2)', transition: '0.3s ease-in-out', left: isMobile ? (isMenuOpen ? '0' : '-280px') : '0' });
const sidebarHeaderStyle = { padding: '40px 25px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const brandBadgeStyle = { color: '#c5a059', fontSize: '0.7rem', fontWeight: '900', letterSpacing: '2px', marginBottom: '15px' };
const welcomeBoxStyle = { background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', borderLeft: '3px solid #c5a059' };
const welcomeLabel = { margin: 0, fontSize: '0.65rem', color: '#948b83', textTransform: 'uppercase' };
const facilityNameDisplay = { margin: '2px 0 0', fontSize: '1rem', fontWeight: 'bold', color: '#fff' };
const navAreaStyle = { flex: 1, padding: '15px 12px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' };
const groupWrapperStyle = (isFlow) => ({ display: 'flex', flexDirection: 'column', gap: '8px' });
const groupTitleStyle = { fontSize: '0.6rem', color: '#948b83', fontWeight: '900', letterSpacing: '1px', paddingLeft: '15px', textTransform: 'uppercase' };
const groupItemsContainer = (isFlow) => ({ display: 'flex', flexDirection: 'column', gap: '4px', background: isFlow ? 'rgba(197, 160, 89, 0.05)' : 'transparent', padding: isFlow ? '10px 5px' : '0', borderRadius: '15px', border: isFlow ? '1px dashed rgba(197, 160, 89, 0.2)' : 'none' });
const stepNumberStyle = (active) => ({ width: '20px', height: '20px', borderRadius: '50%', background: active ? '#3d2b1f' : '#c5a059', color: active ? '#c5a059' : '#3d2b1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '900' });
const sidebarBtnStyle = (active, isLocked) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', borderRadius: '10px', background: active ? '#c5a059' : 'transparent', color: isLocked ? '#64748b' : (active ? '#3d2b1f' : '#d1c7be'), border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1, transition: '0.2s', width: '100%', textAlign: 'left', minHeight: '44px' });
const btnIconStyle = (active) => ({ color: active ? '#3d2b1f' : '#c5a059', display: 'flex', alignItems: 'center' });
const btnTextWrapper = { display: 'flex', flexDirection: 'column' };
const btnMainLabel = { fontSize: '0.85rem', fontWeight: 'bold', lineHeight: '1.2' };
const btnSubLabel = (active) => ({ fontSize: '0.65rem', opacity: active ? 0.8 : 0.5, marginTop: '2px' });
const sidebarFooterStyle = { padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' };
const logoutBtnStyle = { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#948b83', padding: '12px', borderRadius: '10px', cursor: 'pointer', width: '100%', fontSize: '0.8rem' };
const getMainAreaStyle = (isMobile) => ({ flex: 1, marginLeft: isMobile ? '0' : '280px', minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingTop: isMobile ? '60px' : '0', alignItems: 'flex-start' });
const contentHeaderStyle = { width: '100%', padding: '30px 50px', background: '#fff', borderBottom: '1px solid #eee', boxSizing: 'border-box' };
const headerTitleGroup = { display: 'flex', alignItems: 'center', gap: '15px' };
const headerIcon = { width: '45px', height: '45px', background: '#fcfaf7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d2b1f', border: '1px solid #eee' };
const headerMainTitle = { margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#3d2b1f' };
const headerSubTitle = { margin: '2px 0 0', fontSize: '0.8rem', color: '#999' };
const contentBodyStyle = (isMobile) => ({ padding: isMobile ? '20px 15px' : '40px 50px', width: '100%', maxWidth: isMobile ? '100%' : '1200px', boxSizing: 'border-box' });
const placeholderCardStyle = { background: '#fff', padding: '100px 40px', borderRadius: '24px', border: '1px solid #eee', textAlign: 'center', color: '#3d2b1f', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };
const mobileHeaderStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '60px', background: '#3d2b1f', display: 'flex', alignItems: 'center', padding: '0 20px', zIndex: 200, borderBottom: '1px solid rgba(255,255,255,0.05)' };
const menuToggleBtnStyle = { background: 'none', border: 'none', color: '#c5a059', cursor: 'pointer', display: 'flex', alignItems: 'center' };
const mobileBrandStyle = { color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', marginLeft: '15px' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 250 };
const centerStyle = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d2b1f', background: '#fcfaf7' };

export default FacilityPortal;