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

// 今後作成するパーツたちをインポートするための準備（今はコメントアウト）
// import FacilityUserList_PC from './parts/FacilityUserList_PC';
// import FacilityKeepDate_PC from './parts/FacilityKeepDate_PC';

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

  // 🚀 🆕 追加：アラート用のState
  const [urgentKeeps, setUrgentKeeps] = useState([]);    // 期限間近（3日以内）
  const [unconfirmedKeeps, setUnconfirmedKeeps] = useState([]); // 単発キープ（未確定）

  // 🆕 追加：スマホ判定とメニュー開閉State
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 🆕 追加：画面リサイズを監視してスマホかPCか切り替える
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsMenuOpen(false); // PCサイズになったらメニューを強制的に閉じる
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🚀 🆕 認証チェック：LocalStorage（永続保存）を確認するように強化
  useEffect(() => {
    const checkAuth = async () => {
      // 1. URLの ?logout=true を確認
      const params = new URLSearchParams(window.location.search);
      if (params.get('logout') === 'true') return; // ログアウト直後なら何もしない

      // 2. セッション（sessionStorage）または 永続メモリ（localStorage）からIDを取得
      const loggedInId = sessionStorage.getItem('facility_user_id') || localStorage.getItem('facility_user_id');
      const isActive = sessionStorage.getItem('facility_auth_active') || localStorage.getItem('facility_auth_active');

      if (isActive === 'true' && loggedInId === facilityId) {
        // 🚀 ログイン継続中：sessionStorageに値を同期してデータを読み込む
        sessionStorage.setItem('facility_user_id', loggedInId);
        sessionStorage.setItem('facility_auth_active', 'true');
        fetchFacilityData();
      } else {
        // 🚀 ログイン情報がない場合：ログイン画面へ
        console.log("セッションが見つからないため、ログイン画面へ移動します");
        navigate(`/facility-login/${facilityId}`);
      }
    };

    checkAuth();
  }, [facilityId, navigate]);

  const fetchFacilityData = async () => {
    setLoading(true);
    try {
      // 1. 施設プロフィール ＆ 店舗プロフィールの取得
      const { data: fac } = await supabase.from('facility_users').select('*').eq('id', facilityId).single();
      if (fac) setFacility(fac);

      // 🚀 🆕 提携している店舗の設定（キャパ・休憩時間など）を親でも保持
      // 🚀 🆕 同時に「現在の名簿の下書き数」もカウントして取得
      const [connRes, draftRes] = await Promise.all([
        supabase.from('shop_facility_connections').select('profiles(*)').eq('facility_user_id', facilityId).eq('status', 'active').maybeSingle(),
        supabase.from('visit_list_drafts').select('*', { count: 'exact', head: true }).eq('facility_user_id', facilityId)
      ]);
      
      if (connRes.data) setShopProfile(connRes.data.profiles);
      setDraftCount(draftRes.count || 0);

      // 2. スケジュールチェック（キープ vs 確定予約）
      const { data: mData } = await supabase.from('keep_dates').select('*').eq('facility_user_id', facilityId);
      const { data: visitData } = await supabase.from('visit_requests').select('*').eq('facility_user_id', facilityId).neq('status', 'canceled');

      // 🚀 🆕 キープ日程（mData）をStateに保存（キャパ計算に使うため）
      setUnconfirmedKeeps(mData || []); 

      const todayStr = new Date().toLocaleDateString('sv-SE');
      const urgList = [];
      const unconList = [];

      (mData || []).forEach(k => {
        if (k.date < todayStr) return;

        const isBooked = (visitData || []).some(v => 
          (v.status === 'confirmed' || v.status === 'completed') && 
          (v.scheduled_date === k.date || (Array.isArray(v.visit_date_list) && v.visit_date_list.some(d => d.date === k.date)))
        );

        if (!isBooked) {
          unconList.push(k);
          const diffTime = new Date(k.date).getTime() - new Date(todayStr).getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 3) urgList.push({ ...k, diffDays });
        }
      });

      setUrgentKeeps(urgList);
      // setUnconfirmedKeeps(unconList); // 💡 上の setUnconfirmedKeeps と統合したのでここはお好みで
    } catch (err) {
      console.error("データ取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }; // 👈 ここが fetchFacilityData の終わり

  // ==========================================
  // 🚀 🆕 ここから追加：親側（脳）の計算ロジック
  // ==========================================
  
  // ① 施術可能人数の計算機
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

  // ② 現在の月の合計キャパを自動計算
  useEffect(() => {
    if (!shopProfile || unconfirmedKeeps.length === 0) {
      setTotalCapacity(0);
      return;
    }
    // 表示している月のキープだけを合計する
    const currentMonthPrefix = `${sharedDate.getFullYear()}-${String(sharedDate.getMonth() + 1).padStart(2, '0')}`;
    const monthlyKeeps = unconfirmedKeeps.filter(k => k.date.startsWith(currentMonthPrefix));
    
    const total = monthlyKeeps.reduce((sum, k) => {
      return sum + calculateCapacity(k.date, k.start_time || '09:00', shopProfile);
    }, 0);
    
    setTotalCapacity(total);
  }, [sharedDate, unconfirmedKeeps, shopProfile]);

  // ③ オーバー判定（名簿画面でもこれを使う）
  const isOverCapacity = draftCount > totalCapacity && totalCapacity > 0;

  // ==========================================
  // 🚀 🆕 ここまで追加
  // ==========================================

  // サイドバーのメニュー構成
  const menuGroups = [
    {
      groupName: '基礎管理',
      items: [{ id: 'residents', label: 'あつまれ綺麗にする人', icon: <Users size={20} />, sub: '入居者名簿' }]
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

  // 🚀 🆕 【ここに追加！】 
  // menuGroups から全アイテムを取り出して、ヘッダー表示用の menuItems を作成します
  const menuItems = menuGroups.flatMap(group => group.items);

  if (loading) return <div style={centerStyle}>読み込み中...</div>;

  return (
    <div style={desktopLayoutStyle}>
      {/* 🆕 スマホ用の上部ヘッダー（スマホ時のみ表示） */}
      {isMobile && (
        <div style={mobileHeaderStyle}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuToggleBtnStyle}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <span style={mobileBrandStyle}>SnipSnap Portal</span>
        </div>
      )}
      
      {/* 🆕 スマホメニューが開いている時の背景オーバーレイ */}
      {isMobile && isMenuOpen && (
        <div onClick={() => setIsMenuOpen(false)} style={overlayStyle} />
      )}

      {/* 🆕 左側：サイドバーメニュー（関数呼び出し getSidebarStyle を使用） */}
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
              {/* グループタイトル（薄く表示） */}
              <div style={groupTitleStyle}>{group.groupName}</div>
              
              <div style={groupItemsContainer(group.isFlow)}>
                {group.items.map((item, iIdx) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      // 🚀 🆕 予約確定(booking)へ進もうとした時のチェック
                      if (item.id === 'booking' && isOverCapacity) {
                        alert("施術可能人数を超えているため、予約確定へ進めません。\n名簿の人数を調整するか、訪問日を増やしてください。");
                        return;
                      }
                      setActiveTab(item.id);
                      if (isMobile) setIsMenuOpen(false);
                    }}
                    // 🚀 🆕 スタイルに関数を追加して、ロック状態を表現
                    style={sidebarBtnStyle(activeTab === item.id, item.id === 'booking' && isOverCapacity)}
                  >
                    {/* 🚀 予約フローの時だけ数字バッジを出す、それ以外はアイコン */}
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
                // 1. Supabase Authも（もしあれば）ログアウト
                await supabase.auth.signOut();
                // 2. 全ての保存領域を掃除
                sessionStorage.clear(); 
                localStorage.removeItem('facility_user_id');
                localStorage.removeItem('facility_auth_active');
                // 3. 🚀 🆕 重要：?logout=true を付けてログイン画面に戻る
                navigate('/login?logout=true', { replace: true }); 
              }
            }} 
            style={logoutBtnStyle}
          >
            <LogOut size={18} /> ログアウト
          </button>
        </div>
      </aside>

      {/* 🆕 右側：メインコンテンツエリア（関数呼び出し getMainAreaStyle を使用） */}
      <main style={getMainAreaStyle(isMobile)}>
        
        {/* 🚀 🚨 アラートバナー表示エリア */}
        <div style={{ width: '100%', zIndex: 100 }}>
          <AnimatePresence>
            {/* 🔴 パターン1：期限間近の警告（最優先） */}
            {urgentKeeps.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                style={{ background: '#fef2f2', borderBottom: '1px solid #fecdd3', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🚨</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#be123c' }}>確定期限（3日前）が過ぎています！</div>
                    <p style={{ fontSize: '0.7rem', color: '#e11d48', margin: 0 }}>{urgentKeeps[0].date.replace(/-/g, '/')} の名簿を至急作成して確定してください。</p>
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

            {/* 🟠 パターン2：単発キープの未確定通知（3日前以前） */}
            {urgentKeeps.length === 0 && unconfirmedKeeps.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#c2410c' }}>未確定の「単発キープ」が {unconfirmedKeeps.length} 件あります</div>
                    <p style={{ fontSize: '0.7rem', color: '#ea580c', margin: 0 }}>忘れないうちに「STEP 2: 利用者選択」へ進んでください。</p>
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
              {/* --- タブごとのコンポーネント出し分け --- */}
              {activeTab === 'residents' ? (
  <FacilityUserList_PC facilityId={facilityId} isMobile={isMobile} />
) : activeTab === 'partners' ? (
  <FacilityPartnerShops_PC facilityId={facilityId} isMobile={isMobile} />
) : activeTab === 'keep' ? (
  /* 🚀 sharedDateを渡す */
  <FacilityKeepDate_PC facilityId={facilityId} isMobile={isMobile} setActiveTab={setActiveTab} sharedDate={sharedDate} setSharedDate={setSharedDate} /> 
) : activeTab === 'list-up' ? (
  <FacilityListUp_PC 
    facilityId={facilityId} 
    isMobile={isMobile} 
    setActiveTab={setActiveTab} 
    sharedDate={sharedDate} 
    setSharedDate={setSharedDate}
    // 🚀 setIsOverCapacity の行を消しました
  />
) :
 activeTab === 'booking' ? ( 
  /* 🚀 sharedDateを渡す */
  <FacilityBooking_PC facilityId={facilityId} isMobile={isMobile} setActiveTab={setActiveTab} sharedDate={sharedDate} setSharedDate={setSharedDate} />
) : activeTab === 'status' ? (
<FacilityStatus_PC facilityId={facilityId} isMobile={isMobile} />
) : activeTab === 'history' ? ( 
  /* 🚀 過去の訪問記録を表示 */
<FacilityHistory_PC facilityId={facilityId} isMobile={isMobile} sharedDate={sharedDate} setSharedDate={setSharedDate} />
) : activeTab === 'print_list' ? ( 
  /* 🚀 🆕 掲示用名簿を表示（ここを追加！） */
  <FacilityPrintList_PC facilityId={facilityId} />
) : activeTab === 'invoice' ? ( 
  /* 🚀 利用明細・精算確認を表示 */
  <FacilityInvoice_PC facilityId={facilityId} sharedDate={sharedDate} setSharedDate={setSharedDate} />
) : activeTab === 'find_shops' ? (
  <FacilityFindShops_PC facilityId={facilityId} isMobile={isMobile} />
) : activeTab === 'settings' ? (
  <FacilitySettings_PC facilityId={facilityId} isMobile={isMobile} />
) : (
  <div style={placeholderCardStyle}>
                  <h3>【 {menuItems.find(i => i.id === activeTab)?.label} 】</h3>
                  <p>現在、パーツを個別に作成中です。</p>
                  <p style={{fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px'}}>
                    src/pages/facility/parts/{activeTab}.jsx を作成して紐付けます。
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
};

// ==========================================
// スタイル定義：SnipSnap Professional Brown Theme
// ==========================================

const desktopLayoutStyle = { display: 'flex', minHeight: '100vh', background: '#fcfaf7', fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif' };

// 🆕 修正：サイドバー（スマホ時は isMenuOpen に応じて left を変える）
const getSidebarStyle = (isMobile, isMenuOpen) => ({
  width: '280px', 
  background: '#3d2b1f', 
  color: '#fff', 
  display: 'flex', 
  flexDirection: 'column', 
  position: 'fixed', 
  height: '100vh', 
  zIndex: 300, 
  boxShadow: isMenuOpen ? '10px 0 30px rgba(0,0,0,0.3)' : '4px 0 20px rgba(0,0,0,0.2)',
  transition: '0.3s ease-in-out',
  left: isMobile ? (isMenuOpen ? '0' : '-280px') : '0', // スマホ時はスライド
});

const sidebarHeaderStyle = { padding: '40px 25px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const brandBadgeStyle = { color: '#c5a059', fontSize: '0.7rem', fontWeight: '900', letterSpacing: '2px', marginBottom: '15px' };
const welcomeBoxStyle = { background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', borderLeft: '3px solid #c5a059' };
const welcomeLabel = { margin: 0, fontSize: '0.65rem', color: '#948b83', textTransform: 'uppercase' };
const facilityNameDisplay = { margin: '2px 0 0', fontSize: '1rem', fontWeight: 'bold', color: '#fff' };

// 🚀 🆕 ナビゲーションエリア（全体の余白調整）
const navAreaStyle = { flex: 1, padding: '15px 12px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' };

// 🚀 🆕 グループごとの外枠
const groupWrapperStyle = (isFlow) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
});

// 🚀 🆕 グループの見出しテキスト
const groupTitleStyle = {
  fontSize: '0.6rem',
  color: '#948b83',
  fontWeight: '900',
  letterSpacing: '1px',
  paddingLeft: '15px',
  textTransform: 'uppercase'
};

// 🚀 🆕 アイテムをまとめるコンテナ（予約フローなら背景を少し変える）
const groupItemsContainer = (isFlow) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  background: isFlow ? 'rgba(197, 160, 89, 0.05)' : 'transparent', // 💡 フローを薄い金色の背景で囲う
  padding: isFlow ? '10px 5px' : '0',
  borderRadius: '15px',
  border: isFlow ? '1px dashed rgba(197, 160, 89, 0.2)' : 'none'
});

// 🚀 🆕 ステップ番号（1, 2, 3）のデザイン
const stepNumberStyle = (active) => ({
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  background: active ? '#3d2b1f' : '#c5a059',
  color: active ? '#c5a059' : '#3d2b1f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.7rem',
  fontWeight: '900'
});

// 💡 既存の sidebarBtnStyle に minHeight を足すと押しやすくなります
const sidebarBtnStyle = (active, isLocked) => ({
  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', borderRadius: '10px',
  background: active ? '#c5a059' : 'transparent', 
  color: isLocked ? '#64748b' : (active ? '#3d2b1f' : '#d1c7be'), // ロック時はグレー
  border: 'none', 
  cursor: isLocked ? 'not-allowed' : 'pointer', // ロック時は禁止マーク
  opacity: isLocked ? 0.5 : 1, // ロック時は薄くする
  transition: '0.2s', 
  width: '100%', 
  textAlign: 'left',
  minHeight: '44px' 
});

const btnIconStyle = (active) => ({ color: active ? '#3d2b1f' : '#c5a059', display: 'flex', alignItems: 'center' });
const btnTextWrapper = { display: 'flex', flexDirection: 'column' };
const btnMainLabel = { fontSize: '0.85rem', fontWeight: 'bold', lineHeight: '1.2' };
const btnSubLabel = (active) => ({ fontSize: '0.65rem', opacity: active ? 0.8 : 0.5, marginTop: '2px' });

const sidebarFooterStyle = { padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' };
const logoutBtnStyle = { 
  display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', 
  border: 'none', color: '#948b83', padding: '12px', borderRadius: '10px', cursor: 'pointer', width: '100%', fontSize: '0.8rem' 
};

// 🆕 修正：メインエリア（alignItemsを追加して中央寄せに）
const getMainAreaStyle = (isMobile) => ({
  flex: 1, 
  marginLeft: isMobile ? '0' : '280px', 
  minHeight: '100vh', 
  display: 'flex', 
  flexDirection: 'column',
  paddingTop: isMobile ? '60px' : '0',
  // alignItems: 'center' ← ❌ これを削除または 'flex-start' にします
  alignItems: 'flex-start', 
});

const contentHeaderStyle = { width: '100%', padding: '30px 50px', background: '#fff', borderBottom: '1px solid #eee', boxSizing: 'border-box' };
const headerTitleGroup = { display: 'flex', alignItems: 'center', gap: '15px' };
const headerIcon = { width: '45px', height: '45px', background: '#fcfaf7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d2b1f', border: '1px solid #eee' };
const headerMainTitle = { margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#3d2b1f' };
const headerSubTitle = { margin: '2px 0 0', fontSize: '0.8rem', color: '#999' };

// 🆕 修正：コンテンツのボディ（関数に変更し、maxWidthを設定）
const contentBodyStyle = (isMobile) => ({ 
  padding: isMobile ? '20px 15px' : '40px 50px', 
  width: '100%',
  maxWidth: isMobile ? '100%' : '1200px', // 💡 900pxから1200pxに拡大！
  boxSizing: 'border-box'
});
const placeholderCardStyle = { 
  background: '#fff', padding: '100px 40px', borderRadius: '24px', border: '1px solid #eee', 
  textAlign: 'center', color: '#3d2b1f', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' 
};

// 🆕 追加：スマホ専用の追加スタイル
const mobileHeaderStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '60px', background: '#3d2b1f', display: 'flex', alignItems: 'center', padding: '0 20px', zIndex: 200, borderBottom: '1px solid rgba(255,255,255,0.05)' };
const menuToggleBtnStyle = { background: 'none', border: 'none', color: '#c5a059', cursor: 'pointer', display: 'flex', alignItems: 'center' };
const mobileBrandStyle = { color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', marginLeft: '15px' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 250 };

const centerStyle = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d2b1f', background: '#fcfaf7' };

export default FacilityPortal;