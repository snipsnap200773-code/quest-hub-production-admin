import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ChevronLeft, ChevronRight, Clock, User, Calendar as CalendarIcon } from 'lucide-react';

function TimeSelectionCalendar() {
  const { shopId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ 🆕 修正1：スクロール先の目印を作成
  const timeSlotsRef = useRef(null);

  const queryParams = new URLSearchParams(location.search);
  const staffIdFromUrl = queryParams.get('staff');
  const { 
    totalSlotsNeeded, 
    staffId: staffIdFromState, 
    people, 
    isSalesExcluded // 🆕 届いたバトン（売上対象外フラグ）を受け取る
  } = location.state || { totalSlotsNeeded: 0, people: [] };
  const effectiveStaffId = staffIdFromUrl || staffIdFromState;

  // --- State管理 ---
  const [shop, setShop] = useState(null);
  const [allStaffs, setAllStaffs] = useState([]);
  const [targetStaff, setTargetStaff] = useState(null);
  const [existingReservations, setExistingReservations] = useState([]);
  const [facilitySchedules, setFacilitySchedules] = useState([]); 
  const [regularKeepRules, setRegularKeepRules] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false); // 🆕 認証同期完了フラグ

  // --- 🚀 🆕 祝日データを保存する箱を追加 ---
  const [holidays, setHolidays] = useState({});

  // ✅ 🆕 修正：店舗の全メニュー情報を保持するStateを追加
  const [allShopServices, setAllShopServices] = useState([]);

  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date()); 
  const [selectedTime, setSelectedTime] = useState(null); 
  const [travelTimeMinutes, setTravelTimeMinutes] = useState(0);
  const visitorAddress = location.state?.visitorAddress; 

  // --- 🆕 修正：データ取得ロジック（リトライ・リロードを排除） ---
  const fetchInitialData = async () => {
    setLoading(true);

    try {
      // --- 🚀 🆕 日本の祝日データを外部APIから取得 ---
      try {
        const hRes = await fetch('https://holidays-jp.github.io/api/v1/date.json');
        const hData = await hRes.json();
        setHolidays(hData); // {"2026-04-29": "昭和の日", ...} というデータが入る
      } catch (err) {
        console.error("祝日データの取得に失敗しました", err);
      }
      // 1. ショップ情報の取得
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', shopId).single();
      if (!profile) { setLoading(false); return; }
      setShop(profile);

      // ✅ 🆕 修正：この店舗の全メニュー情報を取得（他のメニューの制限時間を知るため）
      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('shop_id', shopId);
      setAllShopServices(servicesData || []);

      // 2. スタッフ情報の取得
      const { data: staffsData } = await supabase.from('staffs').select('*').eq('shop_id', shopId);
      setAllStaffs(staffsData || []);

      if (effectiveStaffId) {
        const staff = staffsData?.find(s => s.id === effectiveStaffId);
        if (staff) setTargetStaff(staff);
      }

      // 3. 同期対象ショップの特定
      let targetShopIds = [shopId];
      if (profile.schedule_sync_id) {
        const { data: siblingShops } = await supabase.from('profiles').select('id').eq('schedule_sync_id', profile.schedule_sync_id);
        if (siblingShops) targetShopIds = siblingShops.map(s => s.id);
      }

      // 4. 既存予約の取得（認証が確定しているため、RLSによる空配列問題を回避できます）
      const [resRes, visitRes, keepRes, connRes, exclRes] = await Promise.all([
        supabase.from('reservations').select('start_time, end_time, staff_id, res_type, is_block').in('shop_id', targetShopIds),
        supabase.from('visit_requests').select('scheduled_date').in('shop_id', targetShopIds).neq('status', 'canceled'),
        supabase.from('keep_dates').select('date').in('shop_id', targetShopIds),
        // 定期ルール
        supabase.from('shop_facility_connections').select('regular_rules').in('shop_id', targetShopIds).eq('status', 'active'),
        // ルール除外日
        supabase.from('regular_keep_exclusions').select('excluded_date').in('shop_id', targetShopIds)
      ]);
        
      setExistingReservations(resRes.data || []);
      setRegularKeepRules(connRes.data || []);
      setExclusions(exclRes.data?.map(e => e.excluded_date) || []);

      // 確定・手動キープを一つのリストに（終日ブロック用）
      const fDates = [
        ...(visitRes.data || []).map(v => v.scheduled_date),
        ...(keepRes.data || []).map(k => k.date)
      ].filter(Boolean);
      setFacilitySchedules([...new Set(fDates)]);

      // 5. 業種キーワードによる自動判定（三土手さんのロジックを完全維持）
      const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];
      const businessTypeName = profile.business_type || '';
      const isVisit = VISIT_KEYWORDS.some(keyword => businessTypeName.includes(keyword));

      // ✅ 🆕 修正：店舗設定で「移動時間計算」がONの場合のみ、バッファを計算する
      // ※既存データのために profile.use_travel_time_logic !== false とすることで、デフォルトONの状態を維持します
      if (isVisit && profile.use_travel_time_logic !== false && profile.minutes_per_km) {
        const speed = profile.minutes_per_km; 
        const averageDistance = 7; 
        const calculatedBuffer = averageDistance * speed; 
        setTravelTimeMinutes(calculatedBuffer);
        console.log(`🚗 訪問予約・計算ON: バッファ ${calculatedBuffer}分`);
      } else {
        // 設定がOFF、または来店型の場合はバッファを 0 にする
        setTravelTimeMinutes(0);
        console.log(isVisit ? `🚗 訪問型ですが、移動時間の自動計算は「OFF」に設定されています` : `✂️ 来店予約を検知: 移動バッファ 0分`);
      }
    } catch (error) {
      console.error("データ取得中にエラーが発生しました:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 🆕 修正：認証状態の監視 ---
  useEffect(() => {
    // Supabaseのセッション確定を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // 初期セッション確認またはサインイン時に「Ready」にする
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setIsAuthReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 🆕 修正：認証がReadyになったらデータを取得 ---
  useEffect(() => {
    if (isAuthReady) {
      fetchInitialData();
    }
  }, [isAuthReady, shopId, effectiveStaffId]);

  // --- ⚙️ エンジンロジック（三土手さんのロジックを完全継承） ---
  const checkIsRegularHoliday = (date) => {
    if (!shop?.business_hours?.regular_holidays) return false;
    const regularHolidaysSettings = shop.business_hours.regular_holidays;

    // --- 🚀 🆕 祝日判定（APIデータ連動版） ---
    const dateStr = date.toLocaleDateString('sv-SE'); // "2026-04-29" の形式に変換
    const isPublicHoliday = !!holidays[dateStr];     // 祝日リストにこの日付があれば true
    
    // 設定1：営業日でも祝日は「定休日」にする場合
    if (isPublicHoliday && regularHolidaysSettings.close_on_holiday) return true;
    
    // 設定2：定休日でも祝日は「営業」する場合
    if (isPublicHoliday && regularHolidaysSettings.open_on_holiday) return false;
    // ------------------------------------------

    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[date.getDay()];
    const dom = date.getDate();
    const nthWeek = Math.ceil(dom / 7);
    const tempDate = new Date(date);
    const currentMonth = tempDate.getMonth();
    const checkLast = new Date(date);
    checkLast.setDate(dom + 7);
    const isLastWeek = checkLast.getMonth() !== currentMonth;
    const checkSecondLast = new Date(date);
    checkSecondLast.setDate(dom + 14);
    const isSecondToLastWeek = (checkSecondLast.getMonth() !== currentMonth) && !isLastWeek;
    if (holidays[`${nthWeek}-${dayName}`]) return true;
    if (isLastWeek && holidays[`L1-${dayName}`]) return true;
    if (isSecondToLastWeek && holidays[`L2-${dayName}`]) return true;
    return false;
  };

  /* ==========================================
     🚀 🆕 ここから貼り付け！ (定義部分)
     ========================================== */

  // 1. 長期休暇（夏休み・正月休みなど）の判定
  const checkIsSpecialHoliday = (date) => {
    if (!shop?.special_holidays || !Array.isArray(shop.special_holidays)) return false;
    const targetDateStr = date.toLocaleDateString('sv-SE');
    return shop.special_holidays.some(h => targetDateStr >= h.start && targetDateStr <= h.end);
  };

  // 2. 定期キープ（第n月曜など）の対象日か判定
  const checkIsRegularKeepDay = (date) => {
    if (!regularKeepRules || regularKeepRules.length === 0) return false;
    const dateStr = date.toLocaleDateString('sv-SE');
    // 除外設定がある日はスルー
    if (exclusions.includes(dateStr)) return false;

    const day = date.getDay();
    const dom = date.getDate();
    const m = date.getMonth() + 1;
    const nthWeek = Math.ceil(dom / 7);
    const t7 = new Date(date); t7.setDate(dom + 7);
    const isL1 = t7.getMonth() !== date.getMonth();
    const t14 = new Date(date); t14.setDate(dom + 14);
    const isL2 = t14.getMonth() !== date.getMonth() && !isL1;

    return regularKeepRules.some(conn => 
      conn.regular_rules?.some(r => {
        const monthMatch = (r.monthType === 0) || (r.monthType === 1 && m % 2 !== 0) || (r.monthType === 2 && m % 2 === 0);
        const dayMatch = (r.day === day);
        const weekMatch = (r.week === nthWeek) || (r.week === -1 && isL1) || (r.week === -2 && isL2);
        return monthMatch && dayMatch && weekMatch;
      })
    );
  };

  const isStaffOnHoliday = (date, staff) => {
    if (!staff?.weekly_holidays) return false;
    return staff.weekly_holidays.includes(date.getDay());
  };

  const timeSlots = useMemo(() => {
    if (!shop?.business_hours) return [];
    let minOpen = "23:59", maxClose = "00:00";
    Object.values(shop.business_hours).forEach(h => {
      if (typeof h === 'object' && h.is_closed) return;
      if (typeof h === 'object' && h.open && h.open < minOpen) minOpen = h.open;
      if (typeof h === 'object' && h.close && h.close > maxClose) maxClose = h.close;
    });
    const slots = [];
    const interval = shop.slot_interval_min || 15;
    let current = new Date();
    const [h, m] = minOpen.split(':').map(Number);
    current.setHours(h, m, 0, 0);
    const dayEnd = new Date();
    const [eh, em] = maxClose.split(':').map(Number);
    dayEnd.setHours(eh, em, 0, 0);
    while (current < dayEnd) {
      slots.push(current.toTimeString().slice(0, 5));
      current.setMinutes(current.getMinutes() + interval);
    }
    return slots;
  }, [shop]);

const checkAvailability = (date, timeStr) => {
    if (!shop?.business_hours) return { status: 'none', remaining: 0 };

    // --- 🚀 1. 判定に必要な変数を最初にすべて定義する ---
    const dateStr = date.toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE');
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
    const hours = shop.business_hours[dayOfWeek];
    const openTime = hours?.open || "09:00";
    const closeTime = hours?.close || "18:00";

    /* ==========================================
       🚀 🆕 2. 【終日ブロック判定】定休日・長期休暇・施設訪問日・定期キープ
       ========================================== */
    const isSpecialHoliday = checkIsSpecialHoliday(date); // 長期休暇（夏休み等）
    const isRegularHoliday = checkIsRegularHoliday(date); // 定休日（毎週の休み）
    const isFacilityDay = facilitySchedules.includes(dateStr); // 🏢 施設が手動キープまたは予約済
    const isRegularKeep = checkIsRegularKeepDay(date); // 🏢 定期キープ（第n曜日のルール）

    // どれか一つでも該当すれば、即座に「休」を返して終了
    if (isSpecialHoliday || isRegularHoliday || isFacilityDay || isRegularKeep) {
      return { status: 'closed', label: '休', remaining: 0 };
    }

    // --- 3. 営業時間外チェック ---
    if (timeStr < openTime || timeStr >= closeTime) return { status: 'none', remaining: 0 };

    // --- 4. 休憩時間の判定ヘルパー ---
    const isInsideRest = (checkT) => {
      if (!hours?.rest_start || !hours?.rest_end) return false;
      const s = hours.rest_start.slice(0, 5);
      const e = hours.rest_end.slice(0, 5);
      return checkT >= s && checkT < e;
    };

    // 💡 開始時間が休憩中なら「休」
    if (isInsideRest(timeStr)) return { status: 'rest', label: '休', remaining: 0 };

    // --- 5. 管理者による個別ブロック（is_block: true） ---
    const currentSlotTime = new Date(`${dateStr}T${timeStr}:00`).getTime();
    const isBlockedByAdmin = existingReservations.some(res => {
      if (res.is_block !== true) return false;
      const s = new Date(res.start_time).getTime();
      const e = new Date(res.end_time).getTime();
      return currentSlotTime >= s && currentSlotTime < e;
    });

    if (isBlockedByAdmin) return { status: 'booked', label: '×', remaining: 0 };

    /* ==========================================
       🚀 6. 以降、既存の貫通チェックや空き枠計算
       ========================================== */
    const interval = shop.slot_interval_min || 15;
    const buffer = shop.buffer_preparation_min || 0;

    // 💡 作業時間 ＋ 移動バッファ
    const getCalculatedTotalSlots = () => {
      if (!people || people.length === 0) return totalSlotsNeeded;
      return people.reduce((sum, p) => {
        const serviceSlots = (p.services || []).reduce((s, serv) => s + (serv.slots || 0), 0);
        const optionSlots = Object.values(p.options || {}).flat().reduce((o, opt) => o + (opt?.additional_slots || 0), 0);
        return sum + serviceSlots + optionSlots;
      }, 0);
    };

    const effectiveTotalSlots = getCalculatedTotalSlots();
    const totalMinRequired = (effectiveTotalSlots * interval) + buffer + (travelTimeMinutes || 0);
    const targetDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const potentialEndTime = new Date(targetDateTime.getTime() + totalMinRequired * 60 * 1000);

    // 休憩時間を貫通していないかチェック
    for (let t = targetDateTime.getTime(); t < potentialEndTime.getTime(); t += interval * 60 * 1000) {
      const checkTStr = new Date(t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (isInsideRest(checkTStr)) return { status: 'booked', label: '×', remaining: 0 };
    }

    // 閉店時間を過ぎていないか
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const closeDateTime = new Date(`${dateStr}T${String(closeH).padStart(2,'0')}:${String(closeM).padStart(2,'0')}:00`);
    if (potentialEndTime > closeDateTime) return { status: 'short', label: '△', remaining: 0 };

    // 過去の時間 または 直近制限チェック
    const limitDays = Math.floor((shop.min_lead_time_hours || 0) / 24);
    const limitDate = new Date(now);
    limitDate.setHours(0,0,0,0);
    limitDate.setDate(limitDate.getDate() + limitDays);

    if (dateStr === todayStr && targetDateTime < now) return { status: 'past', label: '－', remaining: 0 };
    if (new Date(dateStr) < limitDate) return { status: 'past', label: '－', remaining: 0 };

    // スタッフ空き枠の集計
    const storeMax = shop?.max_capacity || 1;
    const activeStaffs = allStaffs.filter(s => {
      if (targetStaff && s.id !== targetStaff.id) return false;
      if (isStaffOnHoliday(date, s)) return false;
      return true;
    });

    let minRemaining = storeMax;
    for (let t = targetDateTime.getTime(); t < potentialEndTime.getTime(); t += interval * 60 * 1000) {
      const travelBufferMs = (travelTimeMinutes || 0) * 60 * 1000;
      const prepBufferMs = (shop.buffer_preparation_min || 0) * 60 * 1000;
  
      const globalCount = existingReservations.filter(res => {
        const resStart = new Date(res.start_time).getTime();
        const resEnd = new Date(res.end_time).getTime();
        const blockedUntil = resEnd + prepBufferMs + travelBufferMs;
        return t >= resStart && t < blockedUntil;
      }).length;
        
      if (globalCount >= storeMax) return { status: 'booked', label: '×', remaining: 0 };
      minRemaining = Math.min(minRemaining, storeMax - globalCount);

      const anyStaffAvailable = activeStaffs.some(staff => {
        const staffCurrentLoad = existingReservations.filter(res => {
          if (res.staff_id !== staff.id) return false;
          const resStart = new Date(res.start_time).getTime();
          const resEnd = new Date(res.end_time).getTime();
          const blockedUntil = resEnd + prepBufferMs + travelBufferMs;
          return t >= resStart && t < blockedUntil;
        }).length;
        return staffCurrentLoad < (staff.concurrent_capacity || 1);
      });
      if (!anyStaffAvailable) return { status: 'booked', label: '×', remaining: 0 };
    }

    return { status: 'available', label: '◎', remaining: minRemaining };
  };

// ✅ 🆕 修正：カレンダーの一部を残してゆっくりスクロールする
  const handleDateClick = (date) => {
    const isHoliday = checkIsRegularHoliday(date);
    const isPast = date < new Date(new Date().setHours(0,0,0,0));
    if (isHoliday || isPast) return;

    setSelectedDate(date);
    
    // 💡 日付を変えてから表示が切り替わるのを少し待つ
    setTimeout(() => {
      const element = timeSlotsRef.current;
      if (element) {
        // 🆕 止まる位置の調整（180pxほど上に余白を作ることでカレンダーを見せる）
        const offset = 180; 
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = element.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        // 指定した位置へスムーズにスクロール
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth' // 💡 これでゆっくり動きます
        });
      }
    }, 100);
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= lastDate; d++) days.push(new Date(year, month, d));
    return days;
  }, [viewDate]);

  // --- 🆕 修正：レンダリング条件（認証同期が終わるまで待機） ---
  if (!isAuthReady || loading) {
    return <div style={{textAlign:'center', padding:'100px', color: '#64748b'}}>読み込み中...</div>;
  }

  const themeColor = shop?.theme_color || '#2563eb';

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333', background: '#f8fafc', minHeight: '100vh', paddingBottom: '140px' }}>
      <div style={{ padding: '20px', background: '#fff', borderBottom: '1px solid #e2e8f0', sticky: 'top', zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', color: '#64748b', fontSize: '0.9rem', marginBottom: '10px', cursor: 'pointer' }}>← 戻る</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
              {targetStaff ? `${targetStaff.name} 指名` : '日時選択'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: themeColor }}>
                所要時間: {totalSlotsNeeded * (shop?.slot_interval_min || 15)}分
              </p>
              {/* 🆕 修正：売上対象外（見積りなど）の場合にラベルを表示 */}
              {isSalesExcluded && (
                <span style={{ 
                  fontSize: '0.65rem', 
                  background: '#fef2f2', 
                  color: '#ef4444', 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontWeight: 'bold',
                  border: '1px solid #fee2e2'
                }}>
                  お見積り・現地調査（無料）
                </span>
              )}
            </div>
          </div>
          <Clock color={themeColor} size={24} />
        </div>
      </div>

      <div style={{ padding: '15px' }}>
        <div style={{ background: '#fff', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <button 
              onClick={() => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} 
              style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={20}/>
            </button>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
              {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月
            </h3>
            <button 
              onClick={() => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} 
              style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={20}/>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center' }}>
            {['日','月','火','水','木','金','土'].map((d, i) => (
              <div key={d} style={{ fontSize: '0.7rem', color: i === 0 ? '#ef4444' : i === 6 ? '#2563eb' : '#94a3b8', fontWeight: 'bold', marginBottom: '10px' }}>{d}</div>
            ))}
            {calendarDays.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const isHoliday = checkIsRegularHoliday(date);
              const isPast = date < new Date(new Date().setHours(0,0,0,0));
              return (
<div 
  key={date.toString()} 
  onClick={() => !isHoliday && !isPast && handleDateClick(date)} // 休みならクリックを無効化
  style={{
    padding: '10px 0', 
    borderRadius: '12px', 
    // 🆕 休みや過去日は「禁止マーク」のカーソルにする
    cursor: isHoliday || isPast ? 'not-allowed' : 'pointer',
    // 🆕 休みや過去日は背景を薄いグレーにする
    background: isSelected ? themeColor : (isHoliday || isPast ? '#f1f5f9' : 'transparent'),
    // 🆕 文字色をさらに薄くする
    color: isSelected ? '#fff' : (isHoliday || isPast ? '#94a3b8' : '#1e293b'),
    fontWeight: isSelected ? 'bold' : 'normal',
    position: 'relative',
    // 🆕 休みや過去日はクリックを物理的に通さない
    pointerEvents: isHoliday || isPast ? 'none' : 'auto'
  }}
>
  {date.getDate()}
  {/* 🆕 休みや過去日には「予約可能ドット」を表示しない（ここは既存通りですが再確認！） */}
  {!isHoliday && !isPast && (
    <div style={{ width: '4px', height: '4px', background: isSelected ? '#fff' : themeColor, borderRadius: '50%', margin: '2px auto 0' }} />
  )}
</div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div style={{ padding: '0 15px 20px' }}>
        {/* ✅ 🆕 ここに ref={timeSlotsRef} を追加して目印にします */}
        <h4 ref={timeSlotsRef} style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarIcon size={16} /> {selectedDate.getMonth()+1}月{selectedDate.getDate()}日の空き時間
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {(() => {
            // 💡 今選んでいるメニューの中に「制限時間あり」のものがあるか判定
            const selectedServices = (people || []).flatMap(p => p.services || []);
            const hasRestrictedMenu = selectedServices.some(s => s.restricted_hours && s.restricted_hours.length > 0);

            // ✅ 🆕 修正：前詰め判定（制限メニューがある場合は mode を false 扱いにする）
            let firstValidTime = null;
            // 「店舗設定がON」 かつ 「制限メニューを選んでいない」 時だけ前詰めを適用
            const shouldApplyStrictFill = shop?.is_strict_fill_mode && !hasRestrictedMenu;

            if (shouldApplyStrictFill) {
              firstValidTime = timeSlots.find(time => {
                const res = checkAvailability(selectedDate, time);
                return !['none', 'closed', 'rest', 'past', 'booked', 'gap', 'short'].includes(res.status);
              });
            }

            return timeSlots.map(time => {
              const res = checkAvailability(selectedDate, time);
              
              if (['none', 'closed', 'rest', 'past', 'booked', 'gap', 'short'].includes(res.status)) return null;

              // ✅ 🆕 修正：shouldApplyStrictFill が true の時だけ一番最初以外を隠す
              if (shouldApplyStrictFill && firstValidTime && time !== firstValidTime) {
                return null;
              }

              const isSelected = selectedTime === time;
              const isSolo = (shop?.max_capacity || 1) === 1;

              return (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  style={{
                    padding: '15px', borderRadius: '16px', border: '2px solid',
                    borderColor: isSelected ? themeColor : '#fff',
                    background: isSelected ? `${themeColor}11` : '#fff',
                    textAlign: 'left', cursor: 'pointer', transition: '0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isSelected ? themeColor : '#1e293b' }}>{time}</div>
                  {isSolo ? (
                    <div style={{ fontSize: '0.7rem', color: themeColor, marginTop: '4px' }}>予約可能</div>
                  ) : (
                    <div style={{ fontSize: '0.7rem', color: res.remaining === 1 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                      {res.remaining === 1 ? '残り1枠！' : `残り${res.remaining}枠`}
                    </div>
                  )}
                </button>
              );
            });
          })()}
        </div>
        {timeSlots.every(t => ['none', 'closed', 'rest', 'past', 'booked', 'gap'].includes(checkAvailability(selectedDate, t).status)) && (
          <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '20px', color: '#94a3b8' }}>
            ごめんなさい！<br/>この日は予約がいっぱいです。
          </div>
        )}
      </div>

      {selectedTime && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', padding: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', zIndex: 100, boxShadow: '0 -10px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: '12px', fontSize: '0.95rem' }}>
            選択中：<span style={{ fontWeight: 'bold', color: themeColor }}>{selectedDate.toLocaleDateString('ja-JP')} {selectedTime}〜</span>
          </div>
          <button 
            style={{ width: '100%', maxWidth: '400px', padding: '18px', background: themeColor, color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: `0 8px 20px ${themeColor}44`, cursor: 'pointer' }} 
            onClick={async () => {
              // 🆕 1. 施設予約モード（mode: 'facility'）の場合
              if (location.state?.mode === 'facility') {
                const { facilityUserId, requestId, selectedResidentIds } = location.state;
                const dateStr = selectedDate.toLocaleDateString('sv-SE');

                try {
                  let targetRequestId = requestId;

                  // --- シナリオB：既に枠（リクエスト）がある場合（キープ後の確定） ---
                  if (targetRequestId) {
                    await supabase
                      .from('visit_requests')
                      .update({ 
                        scheduled_date: dateStr,
                        status: 'confirmed',
                        is_list_confirmed: true // 日程確定と同時に名簿も確定扱いにする
                      })
                      .eq('id', targetRequestId);
                  } 
                  // --- シナリオC：枠がない場合（いきなり予約） ---
                  else {
                    const { data: newReq, error: reqErr } = await supabase
  .from('visit_requests')
  .insert([{
    facility_user_id: facilityUserId, // 🆕 新しい施設マスターID
    shop_id: shopId,                // 🆕 tenant_idから名前を変えたもの
    scheduled_date: dateStr,
    status: 'confirmed',
    is_list_confirmed: true
  }])
                      .select().single();
                    
                    if (reqErr) throw reqErr;
                    targetRequestId = newReq.id;

                    // 選んでいた名簿メンバーを紐付ける
                    if (selectedResidentIds?.length > 0) {
                      const inserts = selectedResidentIds.map(rid => ({
                        request_id: targetRequestId,
                        resident_id: rid
                      }));
                      await supabase.from('visit_request_residents').insert(inserts);
                    }
                  }

                  alert(`${dateStr} ${selectedTime}〜 で訪問予約を確定しました！`);
                  navigate(`/facility-portal/${facilityUserId}/residents`);
                } catch (err) {
                  console.error(err);
                  alert('予約の保存中にエラーが発生しました。');
                }
                return;
              }

              // 2. 通常の一般客予約（既存の動き）
              navigate(`/shop/${shopId}/confirm${window.location.search}`, { 
                state: { 
                  ...location.state, 
                  date: selectedDate.toLocaleDateString('sv-SE'), 
                  time: selectedTime, 
                  staffId: targetStaff?.id || staffIdFromUrl || location.state?.staffId 
                } 
              });
            }}
          >
            {/* 🆕 文言もモードによって切り替え */}
            {location.state?.mode === 'facility' ? 'この日時で訪問予約を確定する' : '予約内容の確認へ進む'}
          </button>
        </div>
      )}
    </div>
  );
}

export default TimeSelectionCalendar;