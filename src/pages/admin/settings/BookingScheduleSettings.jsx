import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  Clock, Calendar, Save, Zap, ArrowLeft, Sparkles, Plus, Trash2, Layout, Settings2, CheckCircle2, Globe // 👈 Globe を追加
} from 'lucide-react';
import HelpTooltip from '../../../components/ui/HelpTooltip';

// 🚀 SettingsPreviewLayout から reloadPreview と setShowMobilePreview を受け取る
const BookingScheduleSettings = ({ reloadPreview, setShowMobilePreview }) => { // 👈 setShowMobilePreview を追加
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900; 

  // --- State管理 ---
  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);
  const [businessHours, setBusinessHours] = useState({});
  const [regularHolidays, setRegularHolidays] = useState({});
  const [bufferPreparationMin, setBufferPreparationMin] = useState(0);
  const [minLeadTimeHours, setMinLeadTimeHours] = useState(0);
  const [autoFillLogic, setAutoFillLogic] = useState(true);
  const [maxCapacity, setMaxCapacity] = useState(1);
  const [isStrictFillMode, setIsStrictFillMode] = useState(false);
  const [useTravelTimeLogic, setUseTravelTimeLogic] = useState(true);
  const [specialHolidays, setSpecialHolidays] = useState([]);
  
  // 🚀 🆕 追加：アシスタント不在時の制限フラグ
  const [restrictStylistWithoutAssistant, setRestrictStylistWithoutAssistant] = useState(false);
  const [newSpecialHoliday, setNewSpecialHoliday] = useState({ name: '', start: '', end: '' });

  // 🚚 MenuSettingsからのお引っ越し
  const [slotIntervalMin, setSlotIntervalMin] = useState(30);

  // 🚚 GeneralSettingsからのお引っ越し
  const [extraSlotsBefore, setExtraSlotsBefore] = useState(0);
  const [extraSlotsAfter, setExtraSlotsAfter] = useState(0);

  // 🚀 🆕 変更検知用のStateとロジックを追加
  const [initialDataStr, setInitialDataStr] = useState(null);
  const [isDataReady, setIsDataReady] = useState(false);

  // 📝 現在の全入力状態を文字列（JSON）化してまとめる
  const currentDataStr = JSON.stringify({
    businessHours, regularHolidays, bufferPreparationMin, minLeadTimeHours, autoFillLogic, maxCapacity, isStrictFillMode, useTravelTimeLogic, specialHolidays, slotIntervalMin, extraSlotsBefore, extraSlotsAfter, restrictStylistWithoutAssistant // 🚀 🆕 追加
  });

  // 💡 初期データと現在のデータに差分があるかを判定
  const hasChanges = initialDataStr !== null && initialDataStr !== currentDataStr;

  // 💡 データ読み込み直後のみ、初期データとして記憶する
  useEffect(() => {
    if (isDataReady) {
      setInitialDataStr(currentDataStr);
      setIsDataReady(false);
    }
  }, [isDataReady, currentDataStr]);

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
      setSpecialHolidays(data.special_holidays || []);
      // 🚀 🆕 追加：データベースから設定を読み込む
      setRestrictStylistWithoutAssistant(data.restrict_stylist_without_assistant ?? false);
      
      // 引っ越しデータ
      setSlotIntervalMin(data.slot_interval_min || 30);
      setExtraSlotsBefore(data.extra_slots_before || 0);
      setExtraSlotsAfter(data.extra_slots_after || 0);
      
      setIsDataReady(true); // 🚀 🆕 追加：データの読み込み完了を合図する
    }
  };

  // 👇 🆕 追加：店舗の業種が「訪問サービス系」かどうかを判定する
  // 🔧 修正：business_type が配列でも文字列でも安全に判定できるようにする
  const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];
  const shopIndustries = Array.isArray(shopData?.business_type)
    ? shopData.business_type
    : (shopData?.business_type || '').split(/,|、/).map(s => s.trim()).filter(Boolean);
  const isVisit = shopIndustries.some(type => VISIT_KEYWORDS.some(keyword => type.includes(keyword)));

  const handleCapacityChange = (val) => {
    const num = parseInt(val) || 1;
    setMaxCapacity(num);
    if (num > 1) setAutoFillLogic(false);
  };

  const showMsg = (txt) => { 
    setMessage(txt); 
    setTimeout(() => setMessage(''), 3000); 
    // 🚀 保存後にプレビューカレンダーをリロード
    if (typeof reloadPreview === 'function') {
      setTimeout(() => reloadPreview(), 300);
    }
  };

  const toggleHoliday = (weekKey, dayKey) => {
    const key = `${weekKey}-${dayKey}`;
    setRegularHolidays(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const addSpecialHoliday = () => {
    if (!newSpecialHoliday.name || !newSpecialHoliday.start || !newSpecialHoliday.end) {
      alert("休暇名と開始日・終了日を入力してください。");
      return;
    }
    setSpecialHolidays([...specialHolidays, { ...newSpecialHoliday, id: crypto.randomUUID() }]);
    setNewSpecialHoliday({ name: '', start: '', end: '' }); 
    showMsg('リストに追加しました！「保存」ボタンで確定してください。');
  };

  const removeSpecialHoliday = (id) => {
    setSpecialHolidays(specialHolidays.filter(h => h.id !== id));
  };

  const handleSave = async () => {
    const updatedBusinessHours = { ...businessHours, regular_holidays: regularHolidays };

    const { error } = await supabase.from('profiles').update({ 
      business_hours: updatedBusinessHours,
      special_holidays: specialHolidays,
      buffer_preparation_min: bufferPreparationMin,
      min_lead_time_hours: minLeadTimeHours,
      auto_fill_logic: autoFillLogic,
      is_strict_fill_mode: isStrictFillMode,
      use_travel_time_logic: useTravelTimeLogic,
      max_capacity: maxCapacity,
      restrict_stylist_without_assistant: restrictStylistWithoutAssistant, // 🚀 🆕 追加：データベースに保存する
      // 引っ越しデータも一緒に保存
      slot_interval_min: slotIntervalMin,
      extra_slots_before: extraSlotsBefore,
      extra_slots_after: extraSlotsAfter
    }).eq('id', shopId);

    if (!error) {
      showMsg('全スケジュール設定を保存しました！');
      setInitialDataStr(currentDataStr); // 🚀 🆕 追加：保存完了後に変更検知をリセット
    } else {
      alert('保存に失敗しました。');
    }
  };

  const themeColor = shopData?.theme_color || '#2563eb';
  
  const containerStyle = { width: '100%', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', boxSizing: 'border-box', fontFamily: 'sans-serif', position: 'relative' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', background: '#fff', width: '90px', boxSizing: 'border-box' };
  const selectStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', background: '#fff' };
  const btnActiveS = (val, target) => ({ padding: '12px 5px', background: val === target ? themeColor : '#fff', color: val === target ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', flex: 1, textAlign: 'center' });

  return (
    <div style={containerStyle}>
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {message}
        </div>
      )}

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Calendar size={28} /> カレンダー・スケジュール設定
      </h2>

      {/* 🚚 引っ越し①：予約エンジンの基本設定（コマ数） */}
      <section style={{ ...cardStyle, border: `2px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Settings2 size={22} /> 予約枠の基本（コマ数）
        </h3>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', marginBottom: '10px', fontSize: '0.85rem', color: '#334155' }}>
            1コマの単位（推奨：30分）
            <HelpTooltip themeColor={themeColor} text="予約カレンダーの最小単位です。ここで設定した分刻みで予約枠が生成されます。" />
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[10, 15, 20, 30].map(min => (
              <button key={min} onClick={() => setSlotIntervalMin(min)} style={btnActiveS(slotIntervalMin, min)}>{min}分</button>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '10px', fontWeight: 'bold' }}>
            ※ここを変更すると、すべてのメニューの所要時間計算が変わります。ご注意ください。
          </p>
        </div>
      </section>

      {/* ⏰ 曜日別営業時間・休憩 */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#1e293b' }}>
            <Clock size={22} color={themeColor} /> 曜日別営業時間・休憩
          </h3>
          <button onClick={() => {
            if(window.confirm('月曜日の設定を全曜日にコピーしますか？')){
              const mon = businessHours['mon'];
              const newH = {};
              ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => newH[d] = {...mon});
              setBusinessHours(newH);
              showMsg('全曜日にコピーしました！');
            }
          }} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '8px 15px', borderRadius: '30px', fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} /> <span>全曜日にコピー</span>
            <HelpTooltip themeColor={themeColor} showDown={true} text="「月曜日」に設定した内容を全曜日に一括反映させます。" />
          </button>
        </div>
        {Object.keys(dayMap).map(day => (
          <div key={day} style={{ borderBottom: '1px solid #f1f5f9', padding: '15px 0' }}>
            <b style={{ fontSize: '0.95rem', color: '#1e293b', display: 'block', marginBottom: '12px' }}>{dayMap[day]}</b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', width: '35px', color: '#64748b', fontWeight: 'bold' }}>営業</span>
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

      {/* 🚚 引っ越し②：管理画面の表示拡張（プライベート枠） */}
      <section style={{ ...cardStyle, background: '#fdfcf5', border: '1px solid #eab308' }}>
        <h3 style={{ marginTop: 0, color: '#a16207', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <Layout size={22} /> 管理画面の表示拡張（プライベート枠）
        </h3>
        <p style={{ fontSize: '0.75rem', color: '#854d0e', marginBottom: '20px', lineHeight: '1.5' }}>
          営業時間の前後に、個人的な予定（プライベート予定）を書き込める予備枠を表示します。<br />
          <b>※予約設定に関わらず、拡張枠は1コマ30分固定でスッキリ表示されます。</b>
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#854d0e' }}>開店前の拡張枠（30分単位でいくつ追加するか）:</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <button key={n} type="button" onClick={() => setExtraSlotsBefore(n)} style={{ ...btnActiveS(extraSlotsBefore, n), width: '40px', height: '40px', flex: 'none' }}>{n}</button>
            ))}
          </div>
          {extraSlotsBefore > 0 && <span style={{ fontSize: '0.7rem', color: '#a16207', marginTop: '5px', display: 'block' }}>➔ 開店前を {extraSlotsBefore * 30}分 拡張中</span>}
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#854d0e' }}>閉店後の拡張枠（30分単位でいくつ追加するか）:</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <button key={n} type="button" onClick={() => setExtraSlotsAfter(n)} style={{ ...btnActiveS(extraSlotsAfter, n), width: '40px', height: '40px', flex: 'none' }}>{n}</button>
            ))}
          </div>
          {extraSlotsAfter > 0 && <span style={{ fontSize: '0.7rem', color: '#a16207', marginTop: '5px', display: 'block' }}>➔ 閉店後を {extraSlotsAfter * 30}分 拡張中</span>}
        </div>
      </section>

      {/* ⚙️ 予約受付ルールの詳細 */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Zap size={22} color={themeColor} /> 予約受付ルールの詳細
        </h3>
        
        {/* 🚀 🆕 修正：固定キャパシティを廃止し、アシスタント不在時の挙動スイッチに変更 */}
        <div style={{ marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: `1px solid ${themeColor}33` }}>
          <label style={{ fontWeight: '900', display: 'flex', alignItems: 'center', marginBottom: '10px', fontSize: '0.9rem', color: themeColor }}>
            アシスタント不在時の予約ルール
            <HelpTooltip themeColor={themeColor} showDown={true} text="担当スタッフが複数人いる場合に、アシスタントがいない時間帯の予約の入り方を決定します。" />
          </label>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '15px', lineHeight: '1.5' }}>
            ※店舗全体の受け入れ上限は、「出勤している担当スタッフ＋アシスタントのサポート力」で毎時間自動計算されます。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* モード①：歩合制（早い者勝ち） */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '12px', background: !restrictStylistWithoutAssistant ? '#fff' : 'transparent', border: !restrictStylistWithoutAssistant ? `2px solid ${themeColor}` : '1px solid #cbd5e1', borderRadius: '10px', transition: '0.2s' }}>
              <input 
                type="radio" 
                name="restrict_mode" 
                checked={!restrictStylistWithoutAssistant} 
                onChange={() => setRestrictStylistWithoutAssistant(false)} 
                style={{ marginTop: '2px', accentColor: themeColor }} 
              />
              <div>
                <b style={{ fontSize: '0.85rem', color: !restrictStylistWithoutAssistant ? themeColor : '#334155' }}>早い者勝ちモード（歩合制など）</b>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                  アシスタントがいなくても、担当スタッフの「個人上限」を維持します。先に予約を取った担当スタッフが優先され、店舗上限に達した時点で他スタッフの予約はブロックされます。
                </p>
              </div>
            </label>

            {/* モード②：平等（上限1名に制限） */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '12px', background: restrictStylistWithoutAssistant ? '#fff' : 'transparent', border: restrictStylistWithoutAssistant ? `2px solid ${themeColor}` : '1px solid #cbd5e1', borderRadius: '10px', transition: '0.2s' }}>
              <input 
                type="radio" 
                name="restrict_mode" 
                checked={restrictStylistWithoutAssistant} 
                onChange={() => setRestrictStylistWithoutAssistant(true)} 
                style={{ marginTop: '2px', accentColor: themeColor }} 
              />
              <div>
                <b style={{ fontSize: '0.85rem', color: restrictStylistWithoutAssistant ? themeColor : '#334155' }}>平等モード（枠を均等に割り振り）</b>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                  アシスタントがいない時間は、すべての担当スタッフの個人上限を強制的に「1名（マンツーマン）」に制限します。スタッフ全員に均等に予約が入りやすくなります。
                </p>
              </div>
            </label>
          </div>
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

        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: maxCapacity === 1 ? 'pointer' : 'not-allowed', padding: '10px', background: '#f8fafc', borderRadius: '12px', opacity: maxCapacity === 1 ? 1 : 0.6 }}>
          <input type="checkbox" checked={autoFillLogic} disabled={maxCapacity !== 1} onChange={(e) => setAutoFillLogic(e.target.checked)} style={{ width: '20px', height: '20px' }} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <b style={{ fontSize: '0.9rem', color: '#334155' }}>予約を自動で効率よく詰める（ゆるい自動調整）</b>
            <HelpTooltip themeColor={themeColor} text="予約枠の前後に不自然な空き時間ができないよう、効率よく予約を埋めるロジックを適用します。次の「前詰め予約を強制する」よりも緩やかな自動調整です。" />
          </div>
        </label>
        {maxCapacity > 1 && <p style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '4px', marginLeft: '10px', fontWeight: 'bold' }}>※同時予約有効時はオフ固定</p>}

        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px', background: '#f8fafc', borderRadius: '12px', marginTop: '10px' }}>
          <input type="checkbox" checked={isStrictFillMode} onChange={(e) => setIsStrictFillMode(e.target.checked)} style={{ width: '20px', height: '20px' }} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <b style={{ fontSize: '0.9rem', color: '#1e293b' }}><span style={{ color: '#ef4444' }}>⚡️</span> 前詰め予約を強制する（厳しい自動調整）</b>
            <HelpTooltip themeColor={themeColor} text="お客様は、既にある予約の「直前」か「直後」の時間しか選べなくなるため、効率よく予約を埋められます。上の「自動で効率よく詰める」よりも強い制限がかかります。" />
          </div>
        </label>

        {/* 👇 修正：訪問系の場合のみ表示 */}
        {isVisit && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px', background: '#f8fafc', borderRadius: '12px', marginTop: '10px' }}>
            <input type="checkbox" checked={useTravelTimeLogic} onChange={(e) => setUseTravelTimeLogic(e.target.checked)} style={{ width: '20px', height: '20px' }} />
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <b style={{ fontSize: '0.9rem', color: '#1e293b' }}>🚗 訪問時の移動時間を自動計算する</b>
              <HelpTooltip themeColor={themeColor} text="お客様の住所から移動時間を計算し、その分を予約枠から自動で差し引きます。" />
            </div>
          </label>
        )}
      </section>

      {/* 長期休暇セクション */}
      <section style={{ ...cardStyle, borderTop: `6px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Sparkles size={22} /> <span>長期休暇（夏休み・正月休みなど）</span>
        </h3>
        
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>休暇名（例：夏休み）</label>
          <input type="text" placeholder="休暇の名前を入力" value={newSpecialHoliday.name} onChange={(e) => setNewSpecialHoliday({...newSpecialHoliday, name: e.target.value})} style={{ ...inputStyle, width: '100%', marginBottom: '15px' }} />
          
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
          <button onClick={addSpecialHoliday} style={{ width: '100%', marginTop: '20px', padding: '16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Plus size={18} /> この期間を一括で休みにする
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {specialHolidays.map((h) => (
            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <div>
                <b style={{ fontSize: '0.9rem', color: '#1e293b' }}>{h.name}</b>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{h.start.replace(/-/g, '/')} 〜 {h.end.replace(/-/g, '/')}</div>
              </div>
              <button onClick={() => removeSpecialHoliday(h.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
      </section>

      {/* 定休日の詳細設定 */}
      <section style={{ ...cardStyle, borderTop: '6px solid #fee2e2' }}>
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
                    const isActive = !!(regularHolidays && regularHolidays[`${week.key}-${day}`]);
                    return (
                      <td key={day} style={{ padding: '6px', textAlign: 'center' }}>
                        <button onClick={() => toggleHoliday(week.key, day)} style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #eee', background: isActive ? '#ef4444' : '#fff', color: isActive ? '#fff' : '#cbd5e1', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s', boxShadow: isActive ? '0 4px 10px rgba(239,68,68,0.3)' : 'none' }}>
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
            <div onClick={() => setRegularHolidays(prev => ({...prev, open_on_holiday: !prev.open_on_holiday}))} style={{ width: '50px', height: '28px', background: regularHolidays.open_on_holiday ? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
              <div style={{ position: 'absolute', top: '2px', left: regularHolidays.open_on_holiday ? '24px' : '2px', width: '24px', height: '24px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </label>
        </div>

        <div style={{ marginTop: '10px', padding: '16px', background: '#fef2f2', borderRadius: '16px', border: '1px dashed #fca5a5' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#991b1b', flex: 1 }}>営業日でも祝日は定休日にする</span>
            <div onClick={() => setRegularHolidays(prev => ({...prev, close_on_holiday: !prev.close_on_holiday}))} style={{ width: '50px', height: '28px', background: regularHolidays.close_on_holiday ? '#ef4444' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
              <div style={{ position: 'absolute', top: '2px', left: regularHolidays.close_on_holiday ? '24px' : '2px', width: '24px', height: '24px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </label>
        </div>
      </section>

      {/* 🛑 PC/モバイル対応・変更検知アニメーション付き固定フッター */}
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
                flex: 1.8, padding: '10px 0', border: 'none', borderRadius: '12px', 
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
            <button 
              onClick={() => {
                navigate(`?preview=calendar`, { replace: true });
                if (setShowMobilePreview) setShowMobilePreview(true);
              }} 
              style={{ flex: 1, padding: '10px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(37,99,235,0.4)' }}
            >
              <Globe size={20} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>プレビュー</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingScheduleSettings;