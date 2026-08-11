import React, { useEffect, useState } from 'react';
// 👇 修正：ここに「useLocation」を追加します！
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { MapPin, Phone, MessageCircle, ExternalLink, Mail, ChevronLeft, Info, Home as HomeIcon, Sparkles, Heart } from 'lucide-react';

function ShopDetail() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); // 👈 🆕 ここに追加

  // 👇 🆕 ここに追加：プレビューモードの判定
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get('mode') === 'preview';

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 🆕 特別カテゴリ（識別キー付き）を管理するState
  const [specialCategories, setSpecialCategories] = useState([]);

// 🆕 追記：ユーザーの最新プロフィールを保持する箱 [cite: 2025-12-01]
  const [userPortalProfile, setUserPortalProfile] = useState(null);

  // 🆕 追記：お気に入り状態を管理
  const [isFavorite, setIsFavorite] = useState(false);
  
useEffect(() => {
    window.scrollTo(0, 0);

      const checkFavoriteStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 🆕 お気に入りチェックのついでに、ポータルの最新プロフィールも取得 [cite: 2025-12-01]
      const { data: profile } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (profile) setUserPortalProfile(profile); // ✅ ここで住所や電話番号がStateに入る

      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('shop_id', shopId)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (data) setIsFavorite(true);
    };

    const fetchShopDetail = async () => {
      setLoading(true);
      // 1. 店舗プロフィールの取得
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', shopId)
        .single();

      if (!error && data) {
        // ✅ 🆕 差し込み：プラン1（内部管理のみ）の場合は詳細ページを隠す
        if (data.service_plan === 1) {
          setShop(null); // shopを空にすることで、下の「店舗が見つかりませんでした」が表示されます
          setLoading(false);
          return;
        }

        setShop(data);
        
        // 🆕 2. 識別キー（url_key）が設定されているカテゴリを動的に取得
        const { data: cats } = await supabase
          .from('service_categories')
          .select('*')
          .eq('shop_id', shopId)
          .neq('url_key', '')      // 空文字を除外
          .not('url_key', 'is', null) // nullを除外
          .order('sort_order', { ascending: true });

        setSpecialCategories(cats || []);
      }
      setLoading(false);
    };
    fetchShopDetail();
    checkFavoriteStatus();
  }, [shopId]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#999' }}>読み込み中...</div>;
  }

  // ✅ 🆕 修正：テーマカラーの定義をここ（if !shop より上）に移動する
  const themeColor = shop?.theme_color || '#2563eb';

  if (!shop) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#64748b' }}>
          現在、この店舗はWeb公開を停止しているか、<br />
          プランの有効期限が切れています。
        </h2>
        {/* 💡 これで themeColor がエラーにならずに使えます */}
        <Link to="/" style={{ color: themeColor, marginTop: '20px', display: 'inline-block' }}>ポータルTOPへ戻る</Link>
      </div>
    );
  }


  // ✅ 1. ここから「handleEmailReservation」関数を追加
// ✅ 1. handleEmailReservation 関数の修正
   const handleEmailReservation = async () => {
    await supabase.auth.getSession();
    
    setTimeout(() => {
      // 🆕 予約画面へ移動する際、authUserProfile として情報を渡す [cite: 2025-12-01]
      navigate(`/shop/${shopId}/reserve`, { 
        state: { 
          authUserProfile: userPortalProfile // ✅ これが ConfirmReservation に届く！
        } 
      });
    }, 100);
  };

  // 🆕 2. お気に入り登録・解除の切り替え関数
const toggleFavorite = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert("お気に入り登録にはログインが必要です。");

    try {
      if (isFavorite) {
        // 解除
        await supabase.from('favorites').delete().eq('shop_id', shopId).eq('user_id', session.user.id);
        setIsFavorite(false);
      } else {
        // 登録
        const { error } = await supabase.from('favorites').insert({ shop_id: shopId, user_id: session.user.id });
        
        // 🆕 もし「既にあります」というエラー(23505)が出たら、成功扱いにして赤いハートにする
        if (error && error.code === '23505') {
          setIsFavorite(true);
          return;
        }
        if (error) throw error;
        setIsFavorite(true);
      }
    } catch (err) {
      console.error("Favorite Toggle Error:", err);
    }
  };
  
  // ✅ Googleマップ埋め込み用のURL形式
  const googleMapEmbedUrl = shop.address 
    ? `https://maps.google.com/maps?q=${encodeURIComponent(shop.address)}&output=embed`
    : null;

  const actionButtonStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '15px 10px',
    borderRadius: '16px',
    textDecoration: 'none',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    transition: 'transform 0.2s',
    border: 'none',
    cursor: 'pointer',
    flex: 1
  };

  const floatingButtonStyle = {
    position: 'fixed',
    bottom: '30px',
    right: '20px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: '50px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    zIndex: 1000,
    transition: 'transform 0.2s'
  };

  return (
    <div style={{ backgroundColor: '#f4f7f9', minHeight: '100vh', paddingBottom: '100px', fontFamily: '"Hiragino Sans", "Meiryo", sans-serif' }}>
      
      {/* ヘッダー */}
      <div style={{ background: '#fff', padding: '15px 20px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        {/* 👇 修正：プレビューモード時は戻るボタンを隠す */}
        {!isPreviewMode && (
          <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '5px' }}>
            <ChevronLeft size={24} color="#333" />
          </button>
        )}
        <h1 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 auto 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shop.business_name}
        </h1>
      </div>

      {/* メイン画像エリア */}
      <div style={{ width: '100%', height: '300px', background: '#eee', backgroundImage: shop.image_url ? `url(${shop.image_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {!shop.image_url && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc' }}>NO IMAGE</div>}
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        
        {/* 基本情報カード */}
        <div style={{ background: '#fff', borderRadius: '24px', padding: '25px', marginTop: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', position: 'relative' }}>
          {/* ✅ 業種ラベルのカラー連動 */}
<div style={{ background: themeColor, color: '#fff', fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 12px', borderRadius: '20px', display: 'inline-block', marginBottom: '10px' }}>
            {shop.business_type}
          </div>
          
          {/* 🆕 タイトルとハートボタンの横並びエリア */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px', gap: '15px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0, color: '#1a1a1a', flex: 1, lineHeight: '1.2' }}>
              {shop.business_name}
            </h2>
            <button 
              onClick={toggleFavorite} 
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                padding: '4px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'transform 0.1s active'
              }}
            >
              <Heart 
                size={28} 
                fill={isFavorite ? "#ef4444" : "none"} 
                color={isFavorite ? "#ef4444" : "#94a3b8"} 
                style={{ transition: 'all 0.3s ease' }}
              />
            </button>
          </div>

          {/* ✅ サブタイトル（description）の「/」による改行 ＆ カラー連動 */}
          {shop.description && (
            <div style={{ fontSize: '0.9rem', color: themeColor, fontWeight: 'bold', marginBottom: '15px', lineHeight: '1.4' }}>
              {shop.description.split('/').map((line, idx) => (
                <React.Fragment key={idx}>
                  {line}
                  {idx < shop.description.split('/').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* ✅ 店舗紹介の行間調整（1.5）を維持 */}
          <p style={{ fontSize: '0.95rem', color: '#4b5563', lineHeight: '1.5', whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
            {shop.intro_text || '店舗の詳細情報は準備中です。'}
          </p>

          {/* --- 🆕 運営する別ブランドのご紹介セクション --- */}
          {specialCategories.length > 0 && (
            <div style={{ margin: '25px 0', padding: '20px', background: '#f8fafc', borderRadius: '20px', border: `1px dashed ${themeColor}` }}>
              <h3 style={{ fontSize: '0.85rem', color: themeColor, marginBottom: '15px', textAlign: 'center', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Sparkles size={16} /> 運営する別ブランドのご紹介
              </h3>
              <div style={{ display: 'grid', gap: '15px' }}>
                {specialCategories.map(cat => (
                  <div 
                    key={cat.id} 
                    style={{ 
                      background: '#fff', padding: '18px', borderRadius: '15px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1a1a1a', marginBottom: '6px' }}>
                      {cat.custom_shop_name || cat.name}
                    </div>
                    
                    {/* ✅ サブタイトル全表示 ＆ 改行ロジック適用 */}
                    {cat.custom_description && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '15px', lineHeight: '1.5' }}>
                        {cat.custom_description.split('/').map((line, idx) => (
                          <React.Fragment key={idx}>
                            {line}
                            {idx < cat.custom_description.split('/').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    
                    {/* 🆕 ボタンエリア（公式サイト ＆ 予約） */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {cat.custom_official_url && (
                        <a 
                          href={cat.custom_official_url} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ 
                            flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px',
                            background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', 
                            fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                          }}
                        >
                          <ExternalLink size={14} /> 公式サイト
                        </a>
                      )}
<button 
                        // 🆕 navigate の第2引数に state を追加して情報を運ぶ [cite: 2025-12-01]
                        onClick={() => navigate(`/shop/${shopId}/reserve?type=${cat.url_key}`, {
                          state: { authUserProfile: userPortalProfile }
                        })}
                        style={{ 
                          flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                          background: themeColor, color: '#fff', fontSize: '0.75rem', 
                          fontWeight: 'bold', cursor: 'pointer'
                        }}
                      >
                        予約ページへ →
                      </button>
                      </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 📞 住所・連絡先 */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.85rem', color: '#666' }}>
              <MapPin size={18} color={themeColor} style={{ flexShrink: 0 }} />
              <span>{shop.address || '住所未登録'}</span>
            </div>
            
            {shop.phone && (
              <a href={`tel:${shop.phone}`} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.85rem', color: themeColor, textDecoration: 'none', fontWeight: 'bold' }}>
                <Phone size={18} color={themeColor} style={{ flexShrink: 0 }} />
                <span>{shop.phone} (タップで発信)</span>
              </a>
            )}
          </div>

          {/* 🗺️ Googleマップ表示エリア */}
          {googleMapEmbedUrl && (
            <div style={{ marginTop: '20px', borderRadius: '16px', overflow: 'hidden', height: '200px', border: '1px solid #eee' }}>
              <iframe
                title="Shop Map"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={googleMapEmbedUrl}
                allowFullScreen
              ></iframe>
            </div>
          )}
        </div>

        {/* アクションパネル */}
        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '30px 0 15px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={18} color={themeColor} /> お問い合わせ・ご予約
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          
{/* ✅ Link から button に変更し、上で作った handleEmailReservation を呼びます */}
          <button 
            onClick={handleEmailReservation} 
            style={{ 
              ...actionButtonStyle, 
              background: themeColor, 
              color: '#fff',
              border: 'none',     // button特有の枠線を消す
              cursor: 'pointer',   // マウスを乗せた時に指マークにする
              width: '100%'        // レイアウトを崩さないための設定
            }}
          >
            <Mail size={24} color="#fff" />Web予約
          </button>
          
          {(shop.liff_id || shop.line_official_url) ? (
            <a 
              href={shop.liff_id ? `https://liff.line.me/${shop.liff_id}` : shop.line_official_url} 
              target="_blank" 
              rel="noreferrer" 
              style={{ ...actionButtonStyle, background: '#06c755', color: '#fff' }}
            >
              <MessageCircle size={24} color="#fff" />LINE予約
            </a>
          ) : (
            <div style={{ ...actionButtonStyle, background: '#f1f5f9', color: '#ccc', cursor: 'not-allowed' }}>
              <MessageCircle size={24} />LINE未連携
            </div>
          )}

          {shop.official_url ? (
            <a href={shop.official_url} target="_blank" rel="noreferrer" style={{ ...actionButtonStyle, background: '#475569', color: '#fff' }}>
              <ExternalLink size={24} color="#fff" />公式サイト
            </a>
          ) : (
            <div style={{ ...actionButtonStyle, background: '#f1f5f9', color: '#ccc', cursor: 'not-allowed' }}>
              <ExternalLink size={24} />サイトなし
            </div>
          )}
        </div>

        {/* 注意事項 */}
        {shop.notes && (
          <div style={{ marginTop: '30px', background: '#fff1f2', borderRadius: '16px', padding: '20px', border: '1px solid #fecdd3' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#e11d48', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ⚠️ ご予約に関する注意事項
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#9f1239', lineHeight: '1.6', margin: 0 }}>{shop.notes}</p>
          </div>
        )}
      </div>

      {/* 浮遊ボタン */}
      {/* 👇 修正：プレビューモード時は浮遊ボタンを隠す */}
      {!isPreviewMode && (
        <Link to="/" style={floatingButtonStyle}>
          <HomeIcon size={18} />
          ポータルサイトへ
        </Link>
      )}

    </div>
  );
}

export default ShopDetail;