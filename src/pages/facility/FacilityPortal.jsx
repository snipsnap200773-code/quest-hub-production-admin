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
    const { data } = await supabase.from('facility_users').select('*').eq('id', facilityId).single();
    if (data) setFacility(data);
    setLoading(false);
  };

  // サイドバーのメニュー構成
  // 🚀 🆕 役割ごとにグループ化
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
                      setActiveTab(item.id);
                      if (isMobile) setIsMenuOpen(false);
                    }}
                    style={sidebarBtnStyle(activeTab === item.id)}
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
  /* 🚀 sharedDateを渡す */
  <FacilityListUp_PC facilityId={facilityId} isMobile={isMobile} setActiveTab={setActiveTab} sharedDate={sharedDate} setSharedDate={setSharedDate} />
) : activeTab === 'booking' ? ( 
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
const sidebarBtnStyle = (active) => ({
  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', borderRadius: '10px',
  background: active ? '#c5a059' : 'transparent', color: active ? '#3d2b1f' : '#d1c7be',
  border: 'none', cursor: 'pointer', transition: '0.2s', width: '100%', textAlign: 'left',
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