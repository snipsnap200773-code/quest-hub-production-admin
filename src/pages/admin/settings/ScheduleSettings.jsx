import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  Clock, Calendar, Save, Zap, ArrowLeft, Sparkles, Plus, Trash2 // ✅ Plus と Trash2 を追加
} from 'lucide-react';

// 🆕 共通ヘルプパーツを読み込み
import HelpTooltip from '../../../components/ui/HelpTooltip';

const ScheduleSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();

  // 🆕 画面サイズ管理を追加（ボタンをレスポンシブにするため）
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900; 

  // --- 1. State 管理 (本家ロジック完全継承) ---
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);
  const [businessHours, setBusinessHours] = useState({});
  const [regularHolidays, setRegularHolidays] = useState({});
  
  const [bufferPreparationMin, setBufferPreparationMin] = useState(0);
  const [minLeadTimeHours, setMinLeadTimeHours] = useState(0);
  const [autoFillLogic, setAutoFillLogic] = useState(true);
  const [maxCapacity, setMaxCapacity] = useState(1);
  const [allowMultiPerson, setAllowMultiPerson] = useState(true);

  // ✅ 🆕 差し込み：前詰め予約モードのStateを追加
  const [isStrictFillMode, setIsStrictFillMode] = useState(false);

  // ✅ 🆕 差し込み：移動時間計算の有効・無効Stateを追加
  const [useTravelTimeLogic, setUseTravelTimeLogic] = useState(true);

  // ✅ 🆕 修正1：長期休暇用のStateを追加
  const [specialHolidays, setSpecialHolidays] = useState([]);
  const [newSpecialHoliday, setNewSpecialHoliday] = useState({ name: '', start: '', end: '' });

  const dayMap = { mon: '月曜日', tue: '火曜日', wed: '水曜日', thu: '木曜日', fri: '金曜日', sat: '土曜日', sun: '日曜日' };
  const weekLabels = [
    { key: '1', label: '第1' }, { key: '2', label: '第2' }, { key: '3', label: '第3' },
    { key: '4', label: '第4' }, { key: 'L2', label: '最後から2' }, { key: 'L1', label: '最後' }
  ];

  useEffect(() => {
    if (shopId) fetchScheduleData();
  }, [shopId]);

const fetchScheduleData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data);
      
      // ✅ 修正：データが空でも 09:00〜18:00 を初期値として強制セット [cite: 2026-03-06]
      const baseHours = data.business_hours || {};
      const initializedHours = {};
      const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      
      days.forEach(day => {
        initializedHours[day] = {
          open: baseHours[day]?.open || '09:00',
          close: baseHours[day]?.close || '18:00',
          rest_start: baseHours[day]?.rest_start || '',
          rest_end: baseHours[day]?.rest_end || ''
        };
      });

      setBusinessHours(initializedHours);
      setRegularHolidays(baseHours.regular_holidays || {});
      setBufferPreparationMin(data.buffer_preparation_min || 0);
      setMinLeadTimeHours(data.min_lead_time_hours || 0);
      setAutoFillLogic(data.auto_fill_logic ?? true);
      setIsStrictFillMode(data.is_strict_fill_mode ?? false);
      setUseTravelTimeLogic(data.use_travel_time_logic ?? true);
      setMaxCapacity(data.max_capacity || 1);
      setAllowMultiPerson(data.allow_multi_person_reservation ?? true);
      setSpecialHolidays(data.special_holidays || []);
    }
  };

  // ✅ 🆕 修正ポイント：人数設定変更時に自動詰めを連動させる関数
  const handleCapacityChange = (val) => {
    const num = parseInt(val);
    setMaxCapacity(num);
    // 1名（マンツーマン）以外が選択されたら、自動詰めを強制的にOFFにする
    if (num > 1) {
      setAutoFillLogic(false);
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  const toggleHoliday = (weekKey, dayKey) => {
    const key = `${weekKey}-${dayKey}`;
    setRegularHolidays(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  // ✅ 🆕 長期休暇をリストに追加する関数
  const addSpecialHoliday = () => {
    if (!newSpecialHoliday.name || !newSpecialHoliday.start || !newSpecialHoliday.end) {
      alert("休暇名と開始日・終了日を入力してください。");
      return;
    }
    setSpecialHolidays([...specialHolidays, { ...newSpecialHoliday, id: crypto.randomUUID() }]);
    setNewSpecialHoliday({ name: '', start: '', end: '' }); // 入力欄リセット
    showMsg('リストに追加しました！「保存」ボタンで確定してください。');
  };

  // ✅ 🆕 長期休暇をリストから削除する関数
  const removeSpecialHoliday = (id) => {
    setSpecialHolidays(specialHolidays.filter(h => h.id !== id));
  };

  // --- 💾 保存ロジック (統合版・完全維持) ---
  const handleSave = async () => {
    // 💡 修正：business_hours と special_holidays を別々に保存
    const updatedBusinessHours = { ...businessHours, regular_holidays: regularHolidays };

    const { error } = await supabase.from('profiles').update({ 
      business_hours: updatedBusinessHours,
      special_holidays: specialHolidays, // ✅ 正式に新設したカラムへ保存！
      buffer_preparation_min: bufferPreparationMin,
      min_lead_time_hours: minLeadTimeHours,
      auto_fill_logic: autoFillLogic,
      is_strict_fill_mode: isStrictFillMode,
      use_travel_time_logic: useTravelTimeLogic,
      max_capacity: maxCapacity,
      allow_multi_person_reservation: allowMultiPerson
    }).eq('id', shopId);

    if (!error) showMsg('全スケジュール設定を保存しました！');
    else alert('保存に失敗しました。');
  };

  const themeColor = shopData?.theme_color || '#2563eb';
  
  // --- スタイル定義 ---
  const containerStyle = { width: '100%', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', boxSizing: 'border-box', fontFamily: 'sans-serif', position: 'relative' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', background: '#fff', width: '90px', boxSizing: 'border-box' };
  const selectStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', background: '#fff' };

  return (
    <div style={containerStyle}>
      {/* 🔔 通知メッセージ */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

{/* 🚀 ナビゲーションヘッダー（統一デザイン＆レスポンシブ版） */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', gap: '10px' }}>
        <button 
          onClick={() => navigate(`/admin/${shopId}/dashboard`)}
          style={{ 
            background: '#fff', 
            border: '1px solid #e2e8f0', 
            padding: isPC ? '10px 20px' : '10px 12px', 
            borderRadius: '30px', 
            fontWeight: 'bold', 
            color: '#64748b', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: isPC ? '1rem' : '0.8rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            whiteSpace: 'nowrap'
          }}
        >
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ' : '戻る'}
        </button>

        {/* ✅ 追加：全曜日にコピーするボタン */}
        <button 
  onClick={() => {
    if(window.confirm('月曜日の設定を全曜日にコピーしますか？')){
      const mon = businessHours['mon'];
      const newH = {};
      ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => newH[d] = {...mon});
      setBusinessHours(newH);
      showMsg('全曜日にコピーしました！');
    }
  }}
  style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '10px 15px', borderRadius: '30px', fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
>
  <Sparkles size={16} /> 
  <span>全曜日にコピー</span>
  <HelpTooltip 
  themeColor={themeColor} 
  showDown={true}  // 👈 ここに showDown を追加
  text="「月曜日」に設定した内容を全曜日に一括反映させます。" 
/>
</button>
        <button 
          // 🚀 🆕 案内人機能を一旦停止（リンク解除 ＆ 無効化）
          disabled={true} 
          style={{ 
            background: '#cbd5e1', // 鮮やかな色からグレーに変更
            border: 'none', 
            padding: isPC ? '10px 20px' : '10px 15px', 
            borderRadius: '30px', 
            fontSize: isPC ? '0.9rem' : '0.8rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'not-allowed', // 禁止マークを表示
            boxShadow: 'none', // 影を消す
            whiteSpace: 'nowrap'
          }}
        >
          <Sparkles size={16} /> {isPC ? '案内人（準備中）' : '準備中'}
        </button>
      </div>
      
      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        営業時間・予約制限の設定
      </h2>

      {/* ⏰ 曜日別営業時間・休憩 */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#1e293b', marginBottom: '20px' }}>
          <Clock size={22} color={themeColor} /> 曜日別営業時間・休憩
        </h3>
        {Object.keys(dayMap).map(day => (
          <div key={day} style={{ borderBottom: '1px solid #f1f5f9', padding: '15px 0' }}>
            <b style={{ fontSize: '0.95rem', color: '#1e293b', display: 'block', marginBottom: '12px' }}>{dayMap[day]}</b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', width: '35px', color: '#64748b', fontWeight: 'bold' }}>営業</span>
{/* ?? を使い、データが全く無い初期状態でも '09:00' などの標準時が表示されるようにします [cite: 2026-03-06] */}
                <input type="time" value={businessHours[day]?.open ?? '09:00'} onChange={(e) => setBusinessHours({...businessHours, [day]: {...businessHours[day], open: e.target.value}})} style={inputStyle} />
                <span style={{ color: '#cbd5e1' }}>〜</span>
                <input type="time" value={businessHours[day]?.close ?? '18:00'} onChange={(e) => setBusinessHours({...businessHours, [day]: {...businessHours[day], close: e.target.value}})} style={inputStyle} />
                              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', width: '35px', color: '#64748b', fontWeight: 'bold' }}>休憩</span>
                <input type="time" value={businessHours[day]?.rest_start || ''} onChange={(e) => setBusinessHours({...businessHours, [day]: { ...businessHours[day], rest_start: e.target.value }})} style={inputStyle} />
                <span style={{ color: '#cbd5e1' }}>〜</span>
                <input type="time" value={businessHours[day]?.rest_end || ''} onChange={(e) => setBusinessHours({...businessHours, [day]: { ...businessHours[day], rest_end: e.target.value }})} style={inputStyle} />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ⚙️ 予約受付ルールの詳細 */}
      <section style={{ ...cardStyle, border: `2px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Zap size={22} /> 予約受付ルールの詳細
        </h3>
        
        {/* --- 🆕 同時予約の受け入れ上限 --- */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', marginBottom: '10px', fontSize: '0.85rem', color: '#334155' }}>
  同時予約の受け入れ上限（キャパシティ）
  <HelpTooltip themeColor={themeColor} showDown={true} text="同じ時間帯に、最大で何組（何名）まで予約を受け付けるかを設定します。一人で運営している場合は「1名」を選択してください。" />
</label>
          <select 
            value={maxCapacity} 
            onChange={(e) => handleCapacityChange(e.target.value)} // ✅ 🆕 専用ハンドラーに変更
            style={selectStyle}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
              <option key={num} value={num}>
                {num}名（{num === 1 ? 'マンツーマン' : '同時受付可能'}）
              </option>
            ))}
          </select>
          <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px', lineHeight: '1.4' }}>
            ※同じ時間枠に最大何名まで予約を許可するか設定します。
          </p>
        </div>

        {/* ✅ 🆕 差し込み：複数名予約のON/OFFスイッチ */}
        <div style={{ marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
  <b style={{ fontSize: '0.9rem', color: '#334155' }}>複数名（最大3名）の同時予約</b>
  <HelpTooltip themeColor={themeColor} text="お客様が予約フォームで「追加でもう一人予約する」ボタンを使えるようにします。ご家族や友人同士の予約を許可する場合にONにします。" />
</div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>予約フォームの「追加でもう一人」ボタンの表示設定</span>
            </div>
            <div 
              onClick={() => setAllowMultiPerson(!allowMultiPerson)} 
              style={{ 
                width: '52px', height: '28px', 
                background: allowMultiPerson ? themeColor : '#cbd5e1', 
                borderRadius: '20px', position: 'relative', transition: '0.3s' 
              }}
            >
              <div style={{ 
                position: 'absolute', top: '2px', 
                left: allowMultiPerson ? '26px' : '2px', 
                width: '24px', height: '24px', background: '#fff', 
                borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
              }} />
            </div>
          </label>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', marginBottom: '10px', fontSize: '0.85rem', color: '#334155' }}>
  インターバル（準備時間）
  <HelpTooltip themeColor={themeColor} text="予約と予約の間に必要な、片付けや準備の時間です。この時間は予約フォーム上で「空き時間」として表示されなくなります。" />
</label>
          <select value={bufferPreparationMin} onChange={(e) => setBufferPreparationMin(parseInt(e.target.value))} style={selectStyle}>
            <option value={0}>なし</option>
            {[10, 15, 20, 30].map(m => <option key={m} value={m}>{m}分</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', marginBottom: '10px', fontSize: '0.85rem', color: '#334155' }}>
  直近の予約制限（何時間前まで受付可能か）
  <HelpTooltip themeColor={themeColor} text="「今から1時間後の予約」といった直前すぎる予約を防ぎます。例えば「24時間」に設定すると、当日の予約受付をストップできます。" />
</label>
          <select value={minLeadTimeHours} onChange={(e) => setMinLeadTimeHours(parseInt(e.target.value))} style={selectStyle}>
            <option value={0}>当日OK</option>
            <option value={24}>当日NG</option>
            <option value={48}>翌日までNG</option>
            <option value={72}>翌々日までNG</option>
          </select>
        </div>

        {/* ✅ 🆕 修正ポイント：maxCapacity が 1 以外の時はチェックボックスを無効化 */}
        <label 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            cursor: maxCapacity === 1 ? 'pointer' : 'not-allowed', 
            padding: '10px', 
            background: '#f8fafc', 
            borderRadius: '12px',
            opacity: maxCapacity === 1 ? 1 : 0.6
          }}
        >
          <input 
            type="checkbox" 
            checked={autoFillLogic} 
            disabled={maxCapacity !== 1} // ✅ 人数が1名以外の時は操作不可
            onChange={(e) => setAutoFillLogic(e.target.checked)} 
            style={{ width: '20px', height: '20px' }} 
          />
          <div style={{ display: 'flex', alignItems: 'center' }}>
  <b style={{ fontSize: '0.9rem', color: '#334155' }}>自動詰め機能を有効にする</b>
  <HelpTooltip themeColor={themeColor} text="予約枠の前後に不自然な空き時間ができないよう、効率よく予約を埋めるロジックを適用します。死に時間を無くし、稼働率を最大化したい場合に有効です。" />
</div>
        </label>

        <label 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            cursor: 'pointer', 
            padding: '10px', 
            background: '#f8fafc', 
            borderRadius: '12px',
            marginTop: '10px'
          }}
        >
          <input 
            type="checkbox" 
            checked={isStrictFillMode} 
            onChange={(e) => setIsStrictFillMode(e.target.checked)} 
            style={{ width: '20px', height: '20px' }} 
          />
          <div style={{ display: 'flex', alignItems: 'center' }}>
  <b style={{ fontSize: '0.9rem', color: '#1e293b' }}>
    <span style={{ color: '#ef4444' }}>⚡️</span> 前詰め予約を強制する
  </b>
  <HelpTooltip themeColor={themeColor} text="予約時間の飛び石（歯抜け）を防ぎます。お客様は、既にある予約の「直前」か「直後」の時間しか選べなくなるため、効率よく予約を埋められます。" />
</div>
        </label>
        <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '6px', marginLeft: '32px', lineHeight: '1.4' }}>
          ※常に「最も早い空き時間」からしか予約を取れないように制限します。<br />
          1日の予約を隙間なく埋めたい場合に有効です。
        </p>

        {/* ✅ 🆕 差し込み：移動時間の自動計算ON/OFFスイッチ */}
        <label 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            cursor: 'pointer', 
            padding: '10px', 
            background: '#f8fafc', 
            borderRadius: '12px',
            marginTop: '10px'
          }}
        >
          <input 
            type="checkbox" 
            checked={useTravelTimeLogic} 
            onChange={(e) => setUseTravelTimeLogic(e.target.checked)} 
            style={{ width: '20px', height: '20px' }} 
          />
          <div style={{ display: 'flex', alignItems: 'center' }}>
  <b style={{ fontSize: '0.9rem', color: '#1e293b' }}>
    🚗 訪問時の移動時間を自動計算する
  </b>
  <HelpTooltip themeColor={themeColor} text="お客様の住所から移動時間を計算し、その分を予約枠から自動で差し引きます。基本設定の「移動スピード目安」に基づいて計算されます。" />
</div>
        </label>
        <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px', marginLeft: '32px' }}>
          ※ONの場合、業種が「訪問・出張」であれば自動的に移動バッファを確保します。
        </p>
        
        {/* ✅ 🆕 補足メッセージの追加 */}
        {maxCapacity > 1 && (
          <p style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '8px', marginLeft: '10px', fontWeight: 'bold' }}>
            ※同時予約を有効にしているため、自動詰め機能はオフに固定されています。
          </p>
        )}
      </section>
      

      {/* ✅ 🆕 ここから「長期休暇セクション」を挿入 */}
      <section style={{ ...cardStyle, border: `2px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
  <Sparkles size={22} /> 
  <span>長期休暇（夏休み・正月休みなど）</span>
  <HelpTooltip themeColor={themeColor} showDown={true} text="夏休みや年末年始など、特定の期間をまるごと「予約不可」としてブロックします。設定した期間は予約フォームのカレンダーで選択できなくなります。" />
</h3>
        
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>休暇名（例：夏休み）</label>
          <input 
            type="text" 
            placeholder="休暇の名前を入力" 
            value={newSpecialHoliday.name} 
            onChange={(e) => setNewSpecialHoliday({...newSpecialHoliday, name: e.target.value})} 
            style={{ ...inputStyle, width: '100%', marginBottom: '15px' }} 
          />
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', color: '#64748b' }}>開始日</label>
              <input type="date" value={newSpecialHoliday.start} onChange={(e) => setNewSpecialHoliday({...newSpecialHoliday, start: e.target.value})} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <span style={{ marginTop: '20px' }}>〜</span>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', color: '#64748b' }}>終了日</label>
              <input type="date" value={newSpecialHoliday.end} onChange={(e) => setNewSpecialHoliday({...newSpecialHoliday, end: e.target.value})} style={{ ...inputStyle, width: '100%' }} />
            </div>
          </div>
          
          <button 
            onClick={addSpecialHoliday}
            style={{ width: '100%', marginTop: '20px', padding: '16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Plus size={18} /> この期間を一括で休みにする
          </button>
        </div>

        {/* 登録済みの休暇リスト */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {specialHolidays.map((h) => (
            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <div>
                <b style={{ fontSize: '0.9rem', color: '#1e293b' }}>{h.name}</b>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{h.start.replace(/-/g, '/')} 〜 {h.end.replace(/-/g, '/')}</div>
              </div>
              <button onClick={() => removeSpecialHoliday(h.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {specialHolidays.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', padding: '10px' }}>登録されている長期休暇はありません</p>
          )}
        </div>
      </section>
      {/* ✅ 🆕 ここまで挿入 */}

      {/* 📅 定休日の設定 */}
      <section style={{ ...cardStyle, border: '1px solid #fee2e2' }}>
        <h3 style={{ marginTop: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginBottom: '20px' }}>
          <Calendar size={22} /> 定休日の詳細設定
        </h3>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '15px' }}>※表を左右にスワイプして全曜日を確認できます</p>
        
        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '12px 8px', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'left' }}>週</th>
                {Object.keys(dayMap).map(d => <th key={d} style={{ padding: '12px 8px', fontSize: '0.85rem', color: '#1e293b' }}>{dayMap[d].charAt(0)}</th>)}
              </tr>
            </thead>
            <tbody>
              {weekLabels.map(week => (
                <tr key={week.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 0', fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', whiteSpace: 'nowrap' }}>{week.label}</td>
{Object.keys(dayMap).map(day => {
                    // regularHolidays が null の場合に備えて確実に boolean を取得します [cite: 2026-03-01]
                    const isActive = !!(regularHolidays && regularHolidays[`${week.key}-${day}`]);
                    return (
                                            <td key={day} style={{ padding: '6px', textAlign: 'center' }}>
                        <button 
                          onClick={() => toggleHoliday(week.key, day)} 
                          style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #eee', background: isActive ? '#ef4444' : '#fff', color: isActive ? '#fff' : '#cbd5e1', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s', boxShadow: isActive ? '0 4px 10px rgba(239,68,68,0.3)' : 'none' }}
                        >
                          {isActive ? '休' : '◯'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '10px', padding: '16px', background: '#fef2f2', borderRadius: '16px', border: '1px dashed #fca5a5' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#991b1b', flex: 1 }}>定休日が祝日の場合は営業する</span>
            <div 
              onClick={() => setRegularHolidays(prev => ({...prev, open_on_holiday: !prev.open_on_holiday}))} 
              style={{ width: '50px', height: '28px', background: regularHolidays.open_on_holiday ? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}
            >
              <div style={{ position: 'absolute', top: '2px', left: regularHolidays.open_on_holiday ? '24px' : '2px', width: '24px', height: '24px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </label>
        </div>

        {/* 🆕 追記：営業日でも祝日は定休日にする設定 */}
        <div style={{ marginTop: '10px', padding: '16px', background: '#fef2f2', borderRadius: '16px', border: '1px dashed #fca5a5' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#991b1b', flex: 1 }}>営業日でも祝日は定休日にする</span>
            <div 
              onClick={() => setRegularHolidays(prev => ({...prev, close_on_holiday: !prev.close_on_holiday}))} 
              style={{ width: '50px', height: '28px', background: regularHolidays.close_on_holiday ? '#ef4444' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}
            >
              <div style={{ position: 'absolute', top: '2px', left: regularHolidays.close_on_holiday ? '24px' : '2px', width: '24px', height: '24px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </label>
        </div>
      </section>

      {/* 💾 保存ボタン */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '24px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', zIndex: 1000 }}>
        <button 
          onClick={handleSave} 
          style={{ width: '100%', maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '18px', background: themeColor, color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: `0 10px 25px ${themeColor}66`, cursor: 'pointer' }}
        >
          <Save size={22} /> スケジュールを保存する 💾
        </button>
      </div>
    </div>
  );
};

export default ScheduleSettings;