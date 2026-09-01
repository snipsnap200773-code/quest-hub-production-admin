import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import bcrypt from 'bcryptjs';
import { 
  Settings, Shield, Palette, Layout, Save, 
  ArrowLeft, CheckCircle2, RefreshCcw,
  Bell, Globe, Mail // 👈 Mail を追加
} from 'lucide-react';

// 🆕 追加：VAPID公開鍵を変換するヘルパー関数
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const GeneralSettings = ({ reloadPreview, setShowMobilePreview }) => { // 👈 setShowMobilePreview を追加
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900; 

  const [themeColor, setThemeColor] = useState('#2563eb');
  const [extraSlotsBefore, setExtraSlotsBefore] = useState(0);
  const [extraSlotsAfter, setExtraSlotsAfter] = useState(0);
  const [autoSalesMatching, setAutoSalesMatching] = useState(false); 
  const [allowBatchMatching, setAllowBatchMatching] = useState(false);
  const [isTimelineDefault, setIsTimelineDefault] = useState(false); // 🚀 🆕 追加：タイムライン初期表示用State

  // 🚀 🆕 引っ越し：メール通知設定のState
  const [notifyMailEnabled, setNotifyMailEnabled] = useState(true);
  const [notifyMailRemindEnabled, setNotifyMailRemindEnabled] = useState(true);

// 🆕 プッシュ通知の状態
const [isPushEnabled, setIsPushEnabled] = useState(false);
const [initialDataStr, setInitialDataStr] = useState(null);

  // 🆕 追加：通知のON/OFFを切り替える魔法の関数
  const handlePushToggle = async (enabled) => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (!enabled) {
        // --- 🔴 解除処理 ---
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // 【🆕 確実な削除】
          // JSONBの中の endpoint を指定して、この端末の住所だけを狙い撃ちで消す
          const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .match({ shop_id: shopId })
            .filter('subscription->>endpoint', 'eq', subscription.endpoint);
          
          if (error) throw error;
          await subscription.unsubscribe();
        }
        setIsPushEnabled(false);
        showMsg('この端末の通知を解除しました');
      } 
      else {
        // --- 🔵 登録処理 ---
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return alert('通知を許可してください！');

        // 🆕 VAPIDキーが空でないかチェック（localhostで忘れがち！）
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidKey) throw new Error("VAPIDキーが設定されていません。.envを確認して再起動してください。");

        const subscribeOptions = {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        };
        const subscription = await registration.pushManager.subscribe(subscribeOptions);
        const subJson = subscription.toJSON();

        // 【🆕 確実な保存（スナイパー方式）】
        // 1. まず、この端末の住所がすでにDBにないか探す
        const { data: existing } = await supabase
          .from('push_subscriptions')
          .select('id')
          .filter('subscription->>endpoint', 'eq', subJson.endpoint)
          .maybeSingle();

        if (existing) {
          // 2. すでにあるなら、最新の情報に更新
          await supabase.from('push_subscriptions')
            .update({ subscription: subJson })
            .eq('id', existing.id);
        } else {
          // 3. なければ新規追加
          await supabase.from('push_subscriptions')
            .insert({ shop_id: shopId, subscription: subJson });
        }

        setIsPushEnabled(true);
        showMsg('この端末の通知を有効にしました！');
      }
    } catch (err) {
      console.error('Push Toggle Error:', err);
      // エラーを詳しく表示するように変更
      alert(`設定に失敗しました: ${err.message || 'ブラウザの通知設定を確認してください'}`);
      setIsPushEnabled(!enabled); 
    }
  };

  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => { if (shopId) fetch(); }, [shopId]);

  const fetch = async () => {
    // 1. 店舗の基本設定をDBから取得（従来通り）
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data);
      setThemeColor(data.theme_color || '#2563eb');
      setExtraSlotsBefore(data.extra_slots_before || 0);
      setExtraSlotsAfter(data.extra_slots_after || 0);
      setAutoSalesMatching(data.auto_sales_matching || false);
      setAllowBatchMatching(data.allow_batch_matching || false);
      setIsTimelineDefault(data.is_timeline_default || false); // 🚀 🆕 ここで読み込み
      // 🚀 🆕 取得処理に追加
      setNotifyMailEnabled(data.notify_mail_enabled ?? true);
      setNotifyMailRemindEnabled(data.notify_mail_remind_enabled ?? true);

      // 🚀 🆕 追加：取得した直後の状態を「初期データ」として文字列で記憶
      setInitialDataStr(JSON.stringify({
        themeColor: data.theme_color || '#2563eb',
        extraSlotsBefore: data.extra_slots_before || 0,
        extraSlotsAfter: data.extra_slots_after || 0,
        autoSalesMatching: data.auto_sales_matching || false,
        allowBatchMatching: data.allow_batch_matching || false,
        isTimelineDefault: data.is_timeline_default || false, // 🚀 🆕 初期データにも追加
        notifyMailEnabled: data.notify_mail_enabled ?? true,
        notifyMailRemindEnabled: data.notify_mail_remind_enabled ?? true
      }));
    }

    // 2. 🆕 端末固有の通知状態を確認
    // DBではなく、今使っているブラウザに「住所（Subscription）」があるかを聞く
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        // この端末がすでに購読済みなら、スイッチをONにする
        setIsPushEnabled(!!subscription);
        
        console.log("この端末の通知状態:", !!subscription ? "ON" : "OFF");
      } catch (err) {
        console.error("通知状態の取得に失敗:", err);
      }
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  // 🚀 🆕 追加：現在の入力状態を文字列化して、初期データと比較
  const currentDataStr = JSON.stringify({
    themeColor, extraSlotsBefore, extraSlotsAfter, autoSalesMatching, allowBatchMatching, isTimelineDefault, notifyMailEnabled, notifyMailRemindEnabled // 🚀 🆕 isTimelineDefaultを追加
  });
  const hasChanges = initialDataStr !== null && initialDataStr !== currentDataStr;

  // 👇 🌟 🆕 無料版の判定を追加
  const isFreePlan = shopData && !shopData.is_tester && shopData.subscription_status !== 'active' && shopData.subscription_status !== 'trialing';

  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      theme_color: themeColor,
      extra_slots_before: extraSlotsBefore,
      extra_slots_after: extraSlotsAfter,
      auto_sales_matching: autoSalesMatching,
      allow_batch_matching: allowBatchMatching,
      is_timeline_default: isTimelineDefault,              // 🚀 🆕 保存処理に追加
      notify_mail_enabled: notifyMailEnabled,              
      notify_mail_remind_enabled: notifyMailRemindEnabled  
    }).eq('id', shopId);

    if (!error) {
      showMsg('全般設定を保存しました！');
      // 🚀 🆕 追加：保存が完了したら、今の状態を新しい「初期データ」として記憶し直す（ボタンをグレーに戻すため）
      setInitialDataStr(currentDataStr);
    } else {
      alert('保存に失敗しました。');
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 8) { alert("セキュリティのため、パスワードは8文字以上に設定してください。"); return; }
    if (window.confirm("パスワードを更新します。新しいパスワードも安全な形式で保存され、運営者を含め誰にも見られることはありません。よろしいですか？")) {
      const salt = bcrypt.genSaltSync(10);
      const hashed = bcrypt.hashSync(newPassword, salt);
      const { error } = await supabase.from('profiles').update({ hashed_password: hashed, admin_password: '********' }).eq('id', shopId);
      if (!error) { showMsg('パスワードを安全に更新しました！'); setNewPassword(''); setIsChangingPassword(false); }
    }
  };

  // スタイル定義
  const containerStyle = { fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', position: 'relative' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };
  const btnActiveS = (val, target) => ({ padding: '12px 5px', background: val === target ? (themeColor || '#2563eb') : '#fff', color: val === target ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' });
  
return (
    <div style={containerStyle}>
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {message}
        </div>
      )}

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Settings size={28} /> 全般設定・セキュリティ
      </h2>

      {/* 🎨 外観設定 */}      <section style={{ ...cardStyle, borderLeft: `8px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Palette size={20} /> お店のテーマカラー
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} style={{ width: '60px', height: '60px', border: 'none', background: 'none', cursor: 'pointer' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>
              メインカラー：<span style={{ color: themeColor, fontFamily: 'monospace' }}>{themeColor}</span>
            </div>
            <div style={{ marginTop: '8px', padding: '8px 16px', background: themeColor, color: '#fff', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-block' }}>
              ボタン表示サンプル
            </div>
          </div>
        </div>
      </section>

      {/* 🕒 🆕 追加：ログイン初期画面設定 */}
      <section style={{ ...cardStyle, borderLeft: `8px solid #4f46e5` }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Layout size={20} /> ログイン時の初期画面
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, paddingRight: '15px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>
              ログイン直後に「タイムライン画面」を開く
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
              ONにすると、ログイン後の最初の画面がカレンダーからタイムラインに変更されます。（複数スタッフで運用する店舗におすすめ）
            </div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={isTimelineDefault} 
              onChange={(e) => setIsTimelineDefault(e.target.checked)} 
              style={{ opacity: 0, width: 0, height: 0 }} 
            />
            <span style={{ 
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: isTimelineDefault ? themeColor : '#cbd5e1', 
              transition: '.3s', borderRadius: '34px' 
            }}>
              <span style={{ 
                position: 'absolute', content: '""', height: '18px', width: '18px', 
                left: isTimelineDefault ? '28px' : '4px', bottom: '4px', 
                backgroundColor: 'white', transition: '.3s', borderRadius: '50%' 
              }}></span>
            </span>
          </label>
        </div>
      </section>

      {/* 📱 🆕 プッシュ通知設定カード */}
      <section style={{ 
        ...cardStyle, 
        borderLeft: `8px solid #94a3b8`, // グレーに変更
        background: '#f8fafc',
        opacity: 0.6,                   // 少し透かせて「無効感」を出す
        pointerEvents: 'none'           // ⚡️ カード全体をクリック不可にする
      }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <Bell size={20} /> アプリ内プッシュ通知
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, paddingRight: '15px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>
              新着予約の通知を受け取る（調整中）
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
              近日公開予定の機能です。現在は通知はメール・LINEのみとなります。
            </div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'default' }}>
            <input 
              type="checkbox" 
              checked={false} // 強制OFF
              disabled        // ⚡️ スイッチ自体を無効化
              readOnly
              style={{ opacity: 0, width: 0, height: 0 }} 
            />
            <span style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: '#cbd5e1', // 常にオフのグレー
              borderRadius: '34px'
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '18px', width: '18px',
                left: '4px', bottom: '4px',
                backgroundColor: 'white', borderRadius: '50%'
              }}></span>
            </span>
          </label>
        </div>
      </section>

      {/* ✉️ 🆕 引っ越し：メール通知設定 */}
      {/* ✉️ 🆕 引っ越し：メール通知設定 */}
      <section style={{ 
        ...cardStyle, 
        borderLeft: `8px solid #0369a1`,
        background: isFreePlan ? '#f8fafc' : '#fff', // 👈 🌟 変更
        opacity: isFreePlan ? 0.6 : 1,               // 👈 🌟 変更
        pointerEvents: isFreePlan ? 'none' : 'auto'  // 👈 🌟 変更（操作不可に）
      }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Mail size={20} /> システムからの自動メール通知
          {isFreePlan && <span style={{ fontSize: '0.7rem', background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '4px', marginLeft: 'auto' }}>有料プラン専用</span>}
        </h3>

        {/* 1. 店舗向け（新着予約） */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1, paddingRight: '15px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>新着予約のメール通知を受け取る（店舗向け）</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>店舗用メールアドレス宛に、予約が入った際にお知らせを送信します。</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'default' }}>
            <input type="checkbox" checked={isFreePlan ? false : notifyMailEnabled} readOnly style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: (isFreePlan ? false : notifyMailEnabled) ? themeColor : '#cbd5e1', transition: '.3s', borderRadius: '34px' }}>
              <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: (isFreePlan ? false : notifyMailEnabled) ? '28px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' }}></span>
            </span>
          </label>
        </div>

        {/* 2. お客様向け（リマインド） */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, paddingRight: '15px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>リマインドメールを自動送信する（お客様向け）</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>ご予約の24時間前に、Web予約をされたお客様へ自動で確認メールを送信します。</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'default' }}>
            <input type="checkbox" checked={isFreePlan ? false : notifyMailRemindEnabled} readOnly style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: (isFreePlan ? false : notifyMailRemindEnabled) ? themeColor : '#cbd5e1', transition: '.3s', borderRadius: '34px' }}>
              <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: (isFreePlan ? false : notifyMailRemindEnabled) ? '28px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%' }}></span>
            </span>
          </label>
        </div>
      </section>

      {/* 🔐 セキュリティ設定 */}
      <section style={{ ...cardStyle, border: `2px solid #1e293b` }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#1e293b', marginBottom: '20px' }}>
          <Shield size={20} /> セキュリティ設定
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
          パスワードは安全な形式で保存されており、運営者を含め誰も内容を見ることはできません。
        </p>
        
        {!isChangingPassword ? (
          <button 
            onClick={() => setIsChangingPassword(true)} 
            style={{ width: '100%', padding: '15px', border: `1px solid #1e293b`, color: '#1e293b', background: '#fff', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
          >
            パスワードを変更する
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', animation: 'fadeIn 0.3s ease' }}>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} placeholder="新しいパスワード（8文字以上）" autoFocus />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleUpdatePassword} style={{ flex: 1, padding: '15px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>パスワードを更新する</button>
              <button onClick={() => setIsChangingPassword(false)} style={{ flex: 1, padding: '15px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>
            </div>
          </div>
        )}
      </section>

      {/* 🛑 PC/モバイル対応・変更検知機能付き固定フッター */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: isPC ? '15px 20px' : '10px 15px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', zIndex: 1000 }}>
        
        {/* 🚀 🆕 点滅アニメーションの定義 */}
        <style>{`
          @keyframes pulse-btn {
            0% { transform: scale(1); box-shadow: 0 4px 15px ${themeColor}66; }
            50% { transform: scale(1.02); box-shadow: 0 4px 25px ${themeColor}99; }
            100% { transform: scale(1); box-shadow: 0 4px 15px ${themeColor}66; }
          }
        `}</style>

        {isPC ? (
          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ flex: '0 0 auto', padding: '15px 25px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={18} /> 戻る
            </button>
            <button 
              onClick={handleSave} 
              disabled={!hasChanges} // 👈 変更がない時は押せない
              style={{ 
                flex: 1, padding: '15px', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s',
                // 👈 変更があればテーマカラー＋点滅、なければグレー
                background: hasChanges ? themeColor : '#cbd5e1', 
                color: '#fff', 
                cursor: hasChanges ? 'pointer' : 'not-allowed', 
                animation: hasChanges ? 'pulse-btn 2s infinite' : 'none' 
              }}
            >
              <Save size={20} /> 保存する
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ flex: 1, padding: '10px 0', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>戻る</span>
            </button>
            <button 
              onClick={handleSave} 
              disabled={!hasChanges} // 👈 変更がない時は押せない
              style={{ 
                flex: 2.2, padding: '10px 0', border: 'none', borderRadius: '12px', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: '0.3s',
                // 👈 変更があればテーマカラー＋点滅、なければグレー
                background: hasChanges ? themeColor : '#cbd5e1', 
                color: '#fff', 
                cursor: hasChanges ? 'pointer' : 'not-allowed', 
                animation: hasChanges ? 'pulse-btn 2s infinite' : 'none' 
              }}
            >
              <Save size={20} />
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>保存する</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default GeneralSettings;