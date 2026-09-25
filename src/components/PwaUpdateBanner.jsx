import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// ⚠️ 2026/09/25【BR②】：新しいバージョンが公開されたら、画面の上に「更新する」の帯を出す。
//    従来（autoUpdate）は、開いたままの画面が古いビルドのまま動き続け、
//    ホーム画面から開く PWA では何日も古い版が使われることがあった。
//    入力中の内容が消えないよう、勝手に読み込み直さず、ボタンを押したときだけ切り替える。
//    また、30分ごと・アプリに戻ってきたときに、新しい版が出ていないかを確認する。
// 🆕 2026/09/25：お客様の画面では帯を出さず、安全なときに自動で切り替える。
//    ・起動直後（10秒以内）に見つかった新しい版 → まだ入力前なので、すぐ切り替える
//    ・30分以上離れてから戻ってきた直後も、起動直後と同じ扱いにする
//    ・お客様の画面 → 帯は出さず、予約完了画面に来たら切り替える
//    ・店舗の管理画面 → 今までどおり帯を出し、「更新する」で切り替える

// ▼ アプリごとに変えるところ ▼
// お客様の画面（帯を出さない画面）
const isCustomerPath = (p) => /^\/(shop|cancel|reserved-success)(\/|$)/.test(p);
// 入力のない画面（ここに来たら、すぐ切り替えてよい）
const isSafePath = (p) => /^\/reserved-success(\/|$)/.test(p);
// ▲ ここまで ▲

const EARLY_WINDOW_MS = 10 * 1000;    // 起動直後とみなす時間
const LONG_AWAY_MS = 30 * 60 * 1000;  // これ以上離れていたら「起動し直し」とみなす
let startedAt = Date.now();
let hiddenAt = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
  } else if (hiddenAt && Date.now() - hiddenAt > LONG_AWAY_MS) {
    startedAt = Date.now();
  }
});
const isJustStarted = () => Date.now() - startedAt < EARLY_WINDOW_MS;

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

  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    if (!needRefresh) return;

    // 起動直後（または長く離れて戻ってきた直後）なら、入力前なのですぐ切り替える
    if (isJustStarted()) {
      updateServiceWorker(true);
      return;
    }

    // それ以外は、今いる画面を1秒ごとに確かめ、入力のない画面に来たら切り替える
    const watch = () => {
      const p = window.location.pathname;
      setPath(p);
      if (isSafePath(p)) updateServiceWorker(true);
    };
    watch();
    const timer = setInterval(watch, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needRefresh]);

  // お客様の画面・自動で切り替え中は、帯を出さない
  if (!needRefresh || isCustomerPath(path) || isJustStarted()) return null;

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