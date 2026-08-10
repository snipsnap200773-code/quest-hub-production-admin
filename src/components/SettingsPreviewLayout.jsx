import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Smartphone, X, RefreshCw } from 'lucide-react';

const SettingsPreviewLayout = ({ children }) => {
  const { shopId } = useParams();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const iframeRef = useRef(null);

  // 画面サイズ変更の検知
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // プレビューの強制リロード関数
  const reloadPreview = () => {
    if (iframeRef.current) {
      // iframe内のURLを再読み込みして最新データを反映
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // 💡 子コンポーネント（MenuSettings等）に reloadPreview 関数を渡す魔法の処理
  // これにより、MenuSettingsの保存ボタンを押した後に props.reloadPreview() が呼べます
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { reloadPreview });
    }
    return child;
  });

  // 👇 🆕 修正：URLを自動判定し、表示する画面を振り分ける
  const searchParams = window.location.search;
  const isDetailsPreview = searchParams.includes('preview=details');
  const isCalendarPreview = searchParams.includes('preview=calendar');
  const isTasksPreview = searchParams.includes('preview=tasks'); 
  const isShopPreview = searchParams.includes('preview=shop'); // 👈 🆕 これを追加

  // 👇 修正：isShopPreview の場合は店舗詳細ページを表示するように追加
  const iframeSrc = isShopPreview
    ? `/shop/${shopId}?mode=preview` // 👈 🆕 これを追加
    : isTasksPreview
      ? `/admin/${shopId}/today-tasks?mode=preview` 
      : isCalendarPreview 
        ? `/admin/${shopId}/reservations?mode=preview` 
        : isDetailsPreview 
          ? `/shop/${shopId}/confirm?mode=preview` 
          : `/shop/${shopId}/reserve?mode=preview`;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* 🔴 左側：設定画面エリア */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        // モバイルの時は下部に余白を設ける（フローティングボタンと被らないように）
        paddingBottom: isMobile ? '80px' : '0' 
      }}>
        {childrenWithProps}
      </div>

      {/* 🔵 右側：プレビューエリア（PC・タブレット用） */}
      {!isMobile && (
        <div style={{ 
          width: '450px', 
          background: '#e2e8f0', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          borderLeft: '1px solid #cbd5e1',
          position: 'relative'
        }}>
          {/* 更新ボタン */}
          <button 
            onClick={reloadPreview}
            style={{
              position: 'absolute', top: '20px', right: '20px', zIndex: 10,
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1',
              borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
          >
            <RefreshCw size={16} /> プレビューを更新
          </button>

          {/* スマホ風の枠 */}
          <div style={{
            width: '375px', height: '812px', background: '#fff', borderRadius: '40px',
            border: '12px solid #1e293b', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative'
          }}>
            {/* 👇 修正：src を iframeSrc に変更 */}
            <iframe 
              ref={iframeRef}
              src={iframeSrc}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Preview"
            />
          </div>
        </div>
      )}

      {/* 📱 モバイル用：フローティングボタン */}
      {isMobile && !showMobilePreview && (
        <button
          onClick={() => setShowMobilePreview(true)}
          style={{
            // 👇 修正：right: '20px' を left: '20px' に変更（保存ボタンとの被り防止）
            position: 'fixed', bottom: '24px', left: '20px', zIndex: 1000,
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '14px 20px', background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: '30px', fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
          }}
        >
          <Smartphone size={20} /> プレビューを見る
        </button>
      )}

      {/* 📱 モバイル用：プレビューモーダル（全画面） */}
      {isMobile && showMobilePreview && (
        <div style={{
          position: 'fixed', inset: 0, background: '#fff', zIndex: 2000,
          display: 'flex', flexDirection: 'column'
        }}>
          {/* ヘッダー */}
          <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '15px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc'
          }}>
            <button 
              onClick={reloadPreview}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', fontSize: '0.9rem' }}
            >
              <RefreshCw size={16} /> 更新
            </button>
            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1e293b' }}>プレビュー</div>
            <button 
              onClick={() => setShowMobilePreview(false)}
              style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}
            >
              <X size={18} />
            </button>
          </div>
          {/* iframe本体 */}
          <div style={{ flex: 1, position: 'relative' }}>
            {/* 👇 修正：src を iframeSrc に変更 */}
            <iframe 
              ref={iframeRef}
              src={iframeSrc}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Mobile Preview"
            />
          </div>
        </div>
      )}
      
    </div>
  );
};

export default SettingsPreviewLayout;