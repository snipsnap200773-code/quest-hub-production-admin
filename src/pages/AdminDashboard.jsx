import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import { 
  Settings, Menu as MenuIcon, Clock, ClipboardList, 
  ExternalLink, MessageCircle, MapPin, Sparkles, Mail,
  Users,
  Layout,
  Building2 // 🆕 これを追加
} from 'lucide-react';

const AdminDashboard = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  
  // 🆕 必須：これらが定義されていないとエラーになります
  const [shopData, setShopData] = useState(null);    // お店の基本情報
  const [isLoading, setIsLoading] = useState(true);  // ロード中フラグ
  const [isAuthorized, setIsAuthorized] = useState(false); // 認証フラグ
  const [inputPass, setInputPass] = useState('');    // 入力パスワード

  // 🆕 お店の情報と承認待ち件数を取得するメイン処理
  const fetchData = async () => {
    setIsLoading(true);

    // --- 🛡️ 門番：認証チェックエリア ---
    const isShopAuth = sessionStorage.getItem(`auth_${shopId}`) === 'true';
    const isSuperAuth = sessionStorage.getItem('auth_super') === 'true';

    // 「お店のバトン」も「総括のバトン」も持っていない場合
    if (!isShopAuth && !isSuperAuth) {
      navigate('/'); // ログイン画面へ強制送還
      return;        // 🛑 ここで処理を終了（下のデータ取得には進ませない）
    }

    // 認証OKなら、表示を許可してデータを取りに行く
    setIsAuthorized(true);

    // --- 📦 データ取得エリア ---
    try {
      // 1. お店の基本プロファイルを取得
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', shopId)
        .maybeSingle(); // single() よりエラーになりにくい maybeSingle() を推奨
      
      if (profile) setShopData(profile);

      // 2. 施設から届いている「承認待ち」の件数を数える
      const { count } = await supabase
        .from('shop_facility_connections')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('status', 'pending')
        .eq('created_by_type', 'facility');

      setPendingCount(count || 0);

    } catch (err) {
      console.error("データ取得エラー:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [shopId]);

  const themeColor = shopData?.theme_color || '#2563eb';

  // --- スタイル定義 (ログイン画面用) ---
  const smallInput = { padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', outline: 'none' };
  const primaryBtn = { width: '100%', padding: '14px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer' };
  
  // --- ダッシュボード用スタイル (ワイド化修正済み) ---
  const containerStyle = { 
    maxWidth: '1400px', // 🆕 900pxから大幅拡張
    width: '95%',       // 🆕 両サイドの余白を最小限に
    margin: '0 auto', 
    padding: '30px 20px', 
    background: '#f8fafc', 
    minHeight: '100vh', 
    fontFamily: 'sans-serif' 
  };

  const gridStyle = { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', // 🆕 カード幅も少し調整
    gap: '24px' 
  };

  const cardStyle = { 
    background: '#fff', padding: '32px 24px', borderRadius: '24px', border: '1px solid #e2e8f0', 
    display: 'flex', flexDirection: 'column', alignItems: 'center', 
    textAlign: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer',
    textDecoration: 'none', position: 'relative', overflow: 'hidden'
  };
  
  const iconBoxStyle = (color) => ({ 
    width: '64px', height: '64px', borderRadius: '20px', 
    background: `${color}10`, color: color, 
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' 
  });

  // ロード中は何も出さない
  if (isLoading) return null;

  // ロード中、または未認証時は何も出さない（navigate で飛ばされるため）
  if (isLoading || !isAuthorized) return null;

  // ✅ ログイン成功時のみ表示されるダッシュボード本体
  return (
    <div style={containerStyle}>
      {/* ヘッダーエリア */}
      <header style={{ marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: 'bold' }}>
              {shopData?.business_name || '読込中...'}
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', letterSpacing: '1px' }}>
              QUEST HUB COMMAND CENTER
            </p>
          </div>
          {/* 🚀 右側のリンクを削除しました */}
        </div>
      </header>

      {/* カードグリッド */}
      <div style={gridStyle}>
        
        {/* 予約台帳 */}
        <NavCard 
          title="予約台帳" desc="最新予約の確認・手動登録" icon={<ClipboardList size={28} />} color="#10b981"
          to={`/admin/${shopId}/reservations`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 🆕 施設管理カード（条件付き表示） */}
        {(shopData?.business_type?.includes('訪問') || shopData?.sub_business_type === '施設訪問') && (
          <NavCard 
            title="施設管理" 
            desc="訪問先施設の登録・入居者名簿の管理" 
            icon={<Building2 size={28} />} 
            color="#4f46e5"
            to={`/admin/${shopId}/facilities`}
            cardStyle={cardStyle} 
            iconBoxStyle={iconBoxStyle} 
            pendingCount={pendingCount} // ✅ これを追加！
          />
        )}

        {/* スタッフ管理 */}
        <NavCard 
          title="スタッフ管理" desc="担当者の登録" icon={<Users size={28} />} color="#f43f5e"
          to={`/admin/${shopId}/settings/staff`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 店舗情報 */}
        <NavCard 
          title="店舗情報" desc="店名、住所、サブタイトルなどの基本設定" icon={<MapPin size={28} />} color="#3b82f6"
          to={`/admin/${shopId}/settings/basic`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 🆕 予約フォーム設定（ここを追加） */}
        <NavCard 
          title="予約フォーム設定" 
          desc="業種に合わせた入力項目のカスタマイズ" 
          icon={<Layout size={28} />} 
          color="#f97316"
          to={`/admin/${shopId}/settings/form`}
          cardStyle={cardStyle} 
          iconBoxStyle={iconBoxStyle} 
        />

        {/* メニュー管理 */}
        <NavCard 
          title="メニュー管理" desc="サービス・連動設定の構築" icon={<MenuIcon size={28} />} color="#ec4899"
          to={`/admin/${shopId}/settings/menu`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 営業時間 */}
        <NavCard 
          title="営業時間・休日" desc="1コマの単位・同時予約数・定休日・予約制限" icon={<Clock size={28} />} color="#f59e0b"
          to={`/admin/${shopId}/settings/schedule`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* メール設定 */}
        <NavCard 
          title="メール設定" desc="予約完了メールを自分らしくカスタマイズ" icon={<Mail size={28} />} color="#8b5cf6"
          to={`/admin/${shopId}/settings/email`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* LINE連携 */}
        <NavCard 
          title="LINE連携" desc="通知設定・Messaging APIの連携" icon={<MessageCircle size={28} />} color="#00b900"
          to={`/admin/${shopId}/settings/line`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

        {/* 全般設定 */}
        <NavCard 
          title="全般設定" desc="カラー・共有ID・パスワード設定" icon={<Settings size={28} />} color="#6366f1"
          to={`/admin/${shopId}/settings/general`}
          cardStyle={cardStyle} iconBoxStyle={iconBoxStyle} 
        />

      </div>

      <footer style={{ marginTop: '50px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold' }}>QUEST HUB v1.0.6 - READY FOR ADVENTURE</p>
      </footer>
    </div>
  );
};

// --- サブコンポーネント：NavCard ---
const NavCard = ({ to, title, desc, icon, color, cardStyle, iconBoxStyle, pendingCount }) => { // ✅ pendingCount を追加
  return (
    <Link 
      to={to}
      style={{ ...cardStyle, position: 'relative' }} // ✅ 念のため position: 'relative' を保証
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 12px 20px -5px ${color}22`;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = '#e2e8f0';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
      }}
    >
      {/* 🆕 通知バッジ：件数が1以上あるときだけ右上に表示 */}
      {pendingCount > 0 && (
        <div style={{
          position: 'absolute',
          top: '15px',
          right: '15px',
          background: '#ef4444',
          color: '#fff',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
          zIndex: 10,
          border: '2px solid #fff'
        }}>
          {pendingCount}
        </div>
      )}

      <div style={iconBoxStyle(color)}>{icon}</div>
      <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '1.2rem', fontWeight: 'bold' }}>{title}</h3>
      <p style={{ margin: '0', color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>{desc}</p>
      
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: '#cbd5e1' }}>
        <ChevronRight size={20} />
      </div>
    </Link>
  );
};

const ChevronRight = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

export default AdminDashboard;