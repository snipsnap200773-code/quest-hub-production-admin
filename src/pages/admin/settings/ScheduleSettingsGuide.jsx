import React, { useEffect, useState, useRef, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  ChevronRight, ChevronLeft, Clock, Calendar, 
  Zap, Save, SkipForward, Coffee, ShieldCheck, 
  Check, X, CheckCircle2, Users // 👈 Usersアイコンを追加
} from 'lucide-react';

// --- 📋 スタイル定数 ---
const inputBaseStyle = { width: '100%', padding: '16px', borderRadius: '14px', background: '#1e293b', border: '2px solid #334155', color: '#fff', fontSize: '1rem', marginBottom: '12px', boxSizing: 'border-box', outline: 'none' };

const DaySettingRow = ({ day, label, hours, onUpdate, themeColor }) => {
  const [open, setOpen] = useState(hours?.open || '09:00');
  const [close, setClose] = useState(hours?.close || '18:00');
  const [restS, setRestS] = useState(hours?.rest_start || '');
  const [restE, setRestE] = useState(hours?.rest_end || '');

  const handleBlur = () => {
    onUpdate(day, { open, close, rest_start: restS, rest_end: restE });
  };

  const tInput = { ...inputBaseStyle, width: '110px', padding: '10px', marginBottom: 0 };

  return (
    <div style={{ background: '#1e293b', padding: '16px', borderRadius: '16px', marginBottom: '12px', border: '1px solid #334155', textAlign: 'left' }}>
      <b style={{ color: themeColor, display: 'block', marginBottom: '12px' }}>{label}</b>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', width: '35px', color: '#94a3b8' }}>営業</span>
          <input type="time" value={open} onChange={e => setOpen(e.target.value)} onBlur={handleBlur} style={tInput} />
          <span style={{ color: '#334155' }}>〜</span>
          <input type="time" value={close} onChange={e => setClose(e.target.value)} onBlur={handleBlur} style={tInput} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', width: '35px', color: '#94a3b8' }}>休憩</span>
          <input type="time" value={restS} onChange={e => setRestS(e.target.value)} onBlur={handleBlur} style={tInput} />
          <span style={{ color: '#334155' }}>〜</span>
          <input type="time" value={restE} onChange={e => setRestE(e.target.value)} onBlur={handleBlur} style={tInput} />
        </div>
      </div>
    </div>
  );
};

const ScheduleSettingsGuide = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const themeColorDefault = '#2563eb';
  const containerStyle = { minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif', width: '100%', display: 'flex', flexDirection: 'column' };
  
  const [step, setStep] = useState(0);
  const [shopData, setShopData] = useState(null);
  const [businessHours, setBusinessHours] = useState({});
  const [regularHolidays, setRegularHolidays] = useState({});
  const [bufferMin, setBufferMin] = useState(0);
  const [leadTime, setLeadTime] = useState(0);
  const [autoFill, setAutoFill] = useState(true);
  const [maxCapacity, setMaxCapacity] = useState(1); // 👈 追加

  const themeColor = shopData?.theme_color || themeColorDefault;
  const dayMap = { mon: '月曜日', tue: '火曜日', wed: '水曜日', thu: '木曜日', fri: '金曜日', sat: '土曜日', sun: '日曜日' };
  const weekLabels = [{key:'1',l:'第1'},{key:'2',l:'第2'},{key:'3',l:'第3'},{key:'4',l:'第4'},{key:'L2',l:'最後から2'},{key:'L1',l:'最後'}];

  useEffect(() => { if (shopId) fetchInitialData(); }, [shopId]);

  const fetchInitialData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data);
      setBusinessHours(data.business_hours || {});
      setRegularHolidays(data.business_hours?.regular_holidays || {});
      setBufferMin(data.buffer_preparation_min || 0);
      setLeadTime(data.min_lead_time_hours || 0);
      setAutoFill(data.auto_fill_logic ?? true);
      setMaxCapacity(data.max_capacity || 1); // 👈 追加
    }
  };

  const saveAll = async (updates = {}) => {
    const payload = {
      business_hours: { ...businessHours, regular_holidays: regularHolidays },
      buffer_preparation_min: bufferMin,
      min_lead_time_hours: leadTime,
      auto_fill_logic: autoFill,
      max_capacity: maxCapacity, // 👈 追加
      ...updates
    };
    await supabase.from('profiles').update(payload).eq('id', shopId);
  };

  // 🆕 キャパシティ変更時の連動ロジック
  const handleCapacityChange = async (val) => {
    const num = parseInt(val);
    setMaxCapacity(num);
    if (num > 1) {
      setAutoFill(false);
      await saveAll({ max_capacity: num, auto_fill_logic: false });
    } else {
      await saveAll({ max_capacity: num });
    }
  };

  const handleNext = () => { window.scrollTo(0,0); setStep(s => s + 1); };
  const handleBack = () => { window.scrollTo(0,0); setStep(s => s - 1); };

  const StepWrapper = ({ title, icon: Icon, children, isLast = false }) => (
    <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto', textAlign: 'center', padding: '100px 20px 40px', boxSizing: 'border-box', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
      <Icon size={60} color={themeColor} style={{ marginBottom: '24px', alignSelf: 'center' }} />
      <h2 style={{ fontSize: '1.6rem', marginBottom: '24px' }}>{title}</h2>
      {children}
      {!isLast && <button style={{ width: '100%', padding: '18px', borderRadius: '40px', background: themeColor, color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', marginTop: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={handleNext}>次へ進む <ChevronRight size={20} /></button>}
      {!isLast && <button style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', marginTop: '20px' }} onClick={handleNext}>スキップ（※後で設定できます） <SkipForward size={14} /></button>}
    </div>
  );

  const renderStep = () => {
    switch(step) {
      case 0: return (
        <StepWrapper title="基本の営業時間を決めましょう。" icon={Clock}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
            <input type="time" value={businessHours.mon?.open || '09:00'} onChange={e => {
              const newHours = {}; Object.keys(dayMap).forEach(d => newHours[d] = { ...businessHours[d], open: e.target.value });
              setBusinessHours(newHours);
            }} style={{ ...inputBaseStyle, width: '130px' }} />
            <span style={{ fontSize: '1.5rem', color: '#334155' }}>〜</span>
            <input type="time" value={businessHours.mon?.close || '18:00'} onChange={e => {
              const newHours = {}; Object.keys(dayMap).forEach(d => newHours[d] = { ...businessHours[d], close: e.target.value });
              setBusinessHours(newHours);
            }} style={{ ...inputBaseStyle, width: '130px' }} />
          </div>
          <button onClick={() => saveAll()} style={{ background: 'none', border: `1px solid ${themeColor}`, color: themeColor, padding: '10px 20px', borderRadius: '30px', marginTop: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>この時間を全曜日に反映</button>
        </StepWrapper>
      );
      case 1: return (
        <StepWrapper title="曜日ごとの微調整と休憩" icon={Coffee}>
          {Object.keys(dayMap).map(day => (
            <DaySettingRow key={day} day={day} label={dayMap[day]} hours={businessHours[day]} themeColor={themeColor} onUpdate={(d, val) => {
              const updated = { ...businessHours, [d]: val };
              setBusinessHours(updated);
              saveAll({ business_hours: { ...updated, regular_holidays: regularHolidays } });
            }} />
          ))}
        </StepWrapper>
      );
      case 2: return (
        <StepWrapper title="定休日を設定しましょう。" icon={Calendar}>
          <div style={{ overflowX: 'auto', width: '100%', background: '#1e293b', borderRadius: '20px', padding: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '350px' }}>
              <thead><tr><th style={{ padding: '10px', fontSize: '0.7rem', color: '#94a3b8' }}>週</th>{Object.keys(dayMap).map(d => <th key={d} style={{ padding: '10px', fontSize: '0.8rem' }}>{dayMap[d].charAt(0)}</th>)}</tr></thead>
              <tbody>{weekLabels.map(week => (
                <tr key={week.key} style={{ borderBottom: '1px solid #0f172a' }}><td style={{ padding: '10px 0', fontSize: '0.65rem', color: '#94a3b8' }}>{week.l}</td>{Object.keys(dayMap).map(day => {
                  const isActive = regularHolidays[`${week.key}-${day}`];
                  return (<td key={day} style={{ padding: '4px' }}><button onClick={async () => {
                    const newHols = { ...regularHolidays, [`${week.key}-${day}`]: !isActive };
                    setRegularHolidays(newHols);
                    await saveAll({ business_hours: { ...businessHours, regular_holidays: newHols } });
                  }} style={{ width: '34px', height: '34px', borderRadius: '10px', border: 'none', background: isActive ? '#ef4444' : '#0f172a', color: '#fff', fontWeight: 'bold', fontSize: '0.7rem', cursor: 'pointer' }}>{isActive ? '休' : '◯'}</button></td>);
                })}</tr>))}
              </tbody>
            </table>
          </div>
        </StepWrapper>
      );
      case 3: return (
        <StepWrapper title="準備時間（インターバル）" icon={Clock}>
          <p style={{ color: '#94a3b8', marginBottom: '32px' }}>予約の合間に「片付け」などの時間を何分設けますか？</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[0, 10, 15, 20, 30].map(m => (
              <button key={m} onClick={() => { setBufferMin(m); saveAll({ buffer_preparation_min: m }); }} style={{ flex: 1, padding: '16px 5px', borderRadius: '12px', background: bufferMin === m ? themeColor : '#1e293b', border: `2px solid ${bufferMin === m ? themeColor : '#334155'}`, color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>{m === 0 ? 'なし' : `${m}分`}</button>
            ))}
          </div>
        </StepWrapper>
      );
      case 4: return (
        <StepWrapper title="何時間前まで予約可能？" icon={ShieldCheck}>
          <p style={{ color: '#94a3b8', marginBottom: '32px' }}>「今すぐ来たい」という直前予約を制限できます。</p>
          <select value={leadTime} onChange={e => { const val = parseInt(e.target.value); setLeadTime(val); saveAll({ min_lead_time_hours: val }); }} style={inputBaseStyle}>
            <option value={0}>当日OK（制限なし）</option>
            <option value={2}>2時間前まで</option>
            <option value={3}>3時間前まで</option>
            <option value={24}>前日まで</option>
            <option value={48}>2日前まで</option>
          </select>
        </StepWrapper>
      );
      // 🆕 🆕 追加ステップ：同時予約（キャパシティ）
      case 5: return (
        <StepWrapper title="同時に何名まで予約を受ける？" icon={Users}>
          <p style={{ color: '#94a3b8', marginBottom: '32px' }}>同じ時間枠に受け入れ可能な最大人数を設定します。</p>
          <select 
            value={maxCapacity} 
            onChange={e => handleCapacityChange(e.target.value)} 
            style={inputBaseStyle}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
              <option key={num} value={num}>
                {num}名（{num === 1 ? 'マンツーマン' : '同時受付可能'}）
              </option>
            ))}
          </select>
        </StepWrapper>
      );
      case 6: return (
        <StepWrapper title="自動詰め機能" icon={Zap}>
          <div 
            style={{ 
              background: '#1e293b', 
              padding: '30px', 
              borderRadius: '24px', 
              border: `2px solid ${themeColor}`, 
              cursor: maxCapacity === 1 ? 'pointer' : 'not-allowed', // 👈 1名以外の時は禁止
              opacity: maxCapacity === 1 ? 1 : 0.6 
            }} 
            onClick={() => { 
              if (maxCapacity > 1) return; // 👈 ガード
              const val = !autoFill; 
              setAutoFill(val); 
              saveAll({ auto_fill_logic: val }); 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: autoFill ? themeColor : 'none', border: `2px solid ${themeColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{autoFill && <Check size={24} />}</div>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>自動詰めを有効にする</span>
            </div>
          </div>
          
          {/* 🆕 🆕 メッセージの追加 */}
          {maxCapacity > 1 && (
            <p style={{ fontSize: '0.85rem', color: '#ef4444', marginTop: '20px', lineHeight: '1.5', fontWeight: 'bold' }}>
              ※同時予約を有効にしているため、自動詰め機能はオフに固定されています。
            </p>
          )}
        </StepWrapper>
      );
      case 7: return ( // 👈 ステップ番号を1つずらしました
        <StepWrapper title="設定が完了しました！" icon={CheckCircle2} isLast={true}>
          <div style={{ background: '#1e293b', padding: '40px 20px', borderRadius: '32px', border: `2px solid #10b981`, textAlign: 'center' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981' }}>準備万端です！</p>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '16px' }}>営業スケジュールと予約のルールが正しく設定されました。</p>
          </div>
          <button style={{ width: '100%', padding: '20px', borderRadius: '40px', background: '#10b981', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer', marginTop: '40px' }} onClick={() => navigate(`/admin/${shopId}/dashboard`)}>冒険を始める（完了）</button>
        </StepWrapper>
      );
      default: return null;
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ width: '100%', height: '6px', background: '#334155', position: 'fixed', top: 0, left: 0, zIndex: 100 }}>
        {/* DENOMINATOR（分母）を 8 に変更 */}
        <div style={{ width: `${((step + 1) / 8) * 100}%`, height: '100%', background: themeColor, transition: '0.4s' }} />
      </div>
      {step > 0 && step < 7 && (
        <div style={{ position: 'fixed', top: '24px', left: '24px', zIndex: 110 }}>
          <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '44px', height: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleBack}><ChevronLeft size={24} /></button>
        </div>
      )}
      {renderStep()}
    </div>
  );
};

export default ScheduleSettingsGuide;