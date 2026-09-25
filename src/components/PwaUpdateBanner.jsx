import { useRegisterSW } from 'virtual:pwa-register/react';

// ⚠️ 2026/09/25【BR②】：新しいバージョンが公開されたら、画面の上に「更新する」の帯を出す。
//    従来（autoUpdate）は、開いたままの画面が古いビルドのまま動き続け、
//    ホーム画面から開く PWA では何日も古い版が使われることがあった。
//    入力中の内容が消えないよう、勝手に読み込み直さず、ボタンを押したときだけ切り替える。
//    また、30分ごと・アプリに戻ってきたときに、新しい版が出ていないかを確認する。
export default function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      console.info('[PWA] Service Worker を登録しました（30分ごと・画面に戻ったときに更新を確認します）');
      const check = () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      };
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', check);
    },
    onRegisterError(err) {
      console.error('Service Worker の登録に失敗しました:', err);
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20000,
      background: '#1e293b', color: '#fff', padding: '12px 16px',
      paddingTop: 'calc(12px + env(safe-area-inset-top))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '12px', flexWrap: 'wrap', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      fontSize: '0.9rem', fontWeight: 'bold'
    }}>
      <span>🔄 新しいバージョンがあります。入力中の内容を保存してから更新してください。</span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => updateServiceWorker(true)}
          style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          更新する
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          style={{ background: 'transparent', color: '#cbd5e1', border: '1px solid #475569', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          あとで
        </button>
      </div>
    </div>
  );
}