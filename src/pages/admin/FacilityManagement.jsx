import { INDUSTRY_PRESETS } from '../../constants/industryMaster';
// 🚀 修正：末尾に , useRef を追加して、使えるように読み込ませます
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient'; 
import { 
  Building2, Plus, MapPin, Calendar, Users, 
  ChevronRight, X, Save, User, ArrowLeft, Phone, Mail, Trash2, Edit3, Clock, Copy, Link2,
  Search, AlertCircle,
  ArrowRight, CheckCircle2, Send, Filter, Store,
  ReceiptText, ChevronLeft, 
  Printer, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 定数定義（既存システムから継承）
const DAYS = [
  { label: "月", value: 1 }, { label: "火", value: 2 }, { label: "水", value: 3 },
  { label: "木", value: 4 }, { label: "金", value: 5 }, { label: "土", value: 6 }, { label: "日", value: 0 }
];
const WEEKS = [
  { label: "第1週", value: 1 }, { label: "第2週", value: 2 }, { label: "第3週", value: 3 },
  { label: "第4週", value: 4 }, { label: "最終週", value: -1 }, { label: "最後から2番目", value: -2 }
];
const MONTH_TYPES = [
  { label: "毎月", value: 0 }, { label: "奇数月", value: 1 }, { label: "偶数月", value: 2 }
];

// 🚀 🆕 選択肢として表示したい時間のリスト
const FACILITY_TIME_OPTIONS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
];

const FacilityManagement = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopSettings, setShopSettings] = useState({ 
    email_notifications_enabled: true,
    is_facility_searchable: false,
    sub_business_type: '理美容',
    hourly_capacity_per_staff: 2.0,
    facility_staff_count: 1,
    facility_visit_start: '09:00',
    facility_visit_end: '16:00',
    facility_visit_slots: ['09:00', '13:00'], // 🚀 🆕 初期値（配列）を追加
    bank_name: '',
    bank_branch: '',
    bank_account_type: '普通',
    bank_account_number: '',
    bank_account_holder: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const visitingSubCategories = INDUSTRY_PRESETS.visiting.subCategories;

  // 🚀 🆕 1. ワークシート印刷用の関数をここに追加！！
  const handlePrintWorkSheet = async () => {
    if (!worksheetTarget) return;
    setLoading(true);
    try {
      const monthStr = String(worksheetMonth).padStart(2, '0');
      const firstDay = `${worksheetYear}-${monthStr}-01`;
      const lastDay = `${worksheetYear}-${monthStr}-${new Date(worksheetYear, worksheetMonth, 0).getDate()}`;

      const { data: allVisits } = await supabase
        .from('visit_requests')
        .select('id, parent_id, scheduled_date')
        .eq('facility_user_id', worksheetTarget.facility_user_id)
        .eq('shop_id', shopId)
        .neq('status', 'canceled')
        .gte('scheduled_date', firstDay)
        .lte('scheduled_date', lastDay)
        .order('scheduled_date', { ascending: true });

      if (!allVisits || allVisits.length === 0) {
        alert(`${worksheetMonth}月の予約が見つかりませんでした。`);
        setLoading(false); return;
      }

      const visitDates = allVisits.map(v => {
        const d = new Date(v.scheduled_date);
        const day = d.getDate();
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
        return `${day}日(${dayOfWeek})`;
      });

      const [histRes, memRes] = await Promise.all([
        supabase.from('visit_request_residents').select('member_id, completed_at, visit_requests!inner(shop_id)').eq('status', 'completed').eq('visit_requests.shop_id', shopId).order('completed_at', { ascending: false }),
        supabase.from('members').select('*').eq('facility_user_id', worksheetTarget.facility_user_id).order('floor', { ascending: true }).order('room', { ascending: true })
      ]);

      const visitMap = {};
      histRes.data?.forEach(h => { 
        if (!visitMap[h.member_id]) visitMap[h.member_id] = h.completed_at.split('T')[0].slice(5).replace('-', '/'); 
      });

      const masterId = allVisits[0].parent_id || allVisits[0].id;
      const { data: appData } = await supabase.from('visit_request_residents').select('*, members(*)').eq('visit_request_id', masterId);

      const printWin = window.open('', '_blank');
      if (printWin) {
        const html = renderWorkSheet(worksheetTarget.name, worksheetYear, worksheetMonth, visitDates, appData || [], memRes.data || [], visitMap, shopSettings);
        printWin.document.write(html);
        printWin.document.close();
      }
      setShowWorksheetModal(false); 
    } catch (err) {
      console.error(err);
      alert("印刷データの準備に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 一本化された綺麗なState定義エリア
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  const [worksheetTarget, setWorksheetTarget] = useState(null);
  const [worksheetYear, setWorksheetYear] = useState(new Date().getFullYear());
  const [worksheetMonth, setWorksheetMonth] = useState(new Date().getMonth() + 1);
  const [invoiceTarget, setInvoiceTarget] = useState(null); 

  const [showManualKeepModal, setShowManualKeepModal] = useState(false);
  const [keepDate, setKeepDate] = useState('');
  const [keepTime, setKeepTime] = useState('09:00');
  const [keepTargetFacilityId, setKeepTargetFacilityId] = useState('');
  const [keepViewMonth, setKeepViewMonth] = useState(new Date());

  const [resList, setResList] = useState([]);
  const [privList, setPrivList] = useState([]);
  const [visitList, setVisitList] = useState([]);
  const [keepList, setKeepList] = useState([]);
  const [exclList, setExclList] = useState([]);
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear());
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1);
  const [salesRecords, setSalesRecords] = useState([]); 
  const [allCustomers, setAllCustomers] = useState([]); 

  // 🚀 🆕 【Refマーカーを移動】コンポーネント直下に置くことでエラーを100%解決します！
  const keepTimeRef = useRef(null);

  // フォームState（既存システムをベースに tenant_id を追加）
  const [formData, setFormData] = useState({ 
    name: '',          // 💡 facility_name から name に統一（handleSaveの仕様に合わせる）
    furigana: '',      // 👈 追加
    email: '',         // 👈 追加（不足分）
    tel: '',           // 👈 追加（不足分）
    address: '',       // 👈 追加（不足分）
    pw: '',            // 👈 追加（不足分）
    login_id: '',      // 👈 追加（不足分）
    regular_rules: [], 
    advance_booking_days: 0,
    tenant_id: shopId 
  });

  const [selDay, setSelDay] = useState(1);
  const [selWeek, setSelWeek] = useState(1);
  const [selMonthType, setSelMonthType] = useState(0);
  const [selTime, setSelTime] = useState('09:00');

  // 🚀 修正：ねじ込みキープ画面で月を「◀」「▶」で切り替えた時も、連動して判定データが最新にリロードされるようにします
  useEffect(() => {
    fetchFacilities();
  }, [shopId, keepViewMonth]);

  const fetchFacilities = async () => {
    setLoading(true);

    // ✅ 修正：振込先情報も一緒に取得するように変更
    const { data: profile } = await supabase
      .from('profiles')
      .select('*') // ⭕️ これで全カラムを安全に取得します
      .eq('id', shopId)
      .single();
    
    if (profile) {
      setShopSettings(profile);
    }
    
    // 🆕 提携ステータスが 'active'（承認済み）のものだけを取得するように修正
    const { data, error } = await supabase
      .from('shop_facility_connections')
      .select(`
        *,
        facility_users (*)
      `)
      .eq('shop_id', shopId)
      .in('status', ['active', 'pending']) // 🆕 active か pending なら取得する
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      const formatted = data.map(item => ({
        ...item.facility_users,
        id: item.facility_users.id,
        status: item.status,
        created_by_type: item.created_by_type,
        regular_rules: item.regular_rules || [],
        advance_booking_days: item.advance_booking_days || 0,
        connection_id: item.id
      }));
      setFacilities(formatted);

      // 🚀 🆕 【超強化】カレンダーの○△✕自動判定に必要なすべてのテーブルを広域で一斉ロード！
      const currentKMonth = new Date(keepViewMonth);
      const kPast = new Date(currentKMonth.getFullYear(), currentKMonth.getMonth() - 1, 1);
      const kFuture = new Date(currentKMonth.getFullYear(), currentKMonth.getMonth() + 2, 0);
      const kStartStr = kPast.toLocaleDateString('sv-SE');
      const kEndStr = kFuture.toLocaleDateString('sv-SE');
      const kStartStrT = kStartStr + "T00:00:00Z";
      const kEndStrT = kEndStr + "T23:59:59Z";

      const [sRes, cRes, resData, privData, visitData, mData, exclData] = await Promise.all([
        supabase.from('sales').select('*').eq('shop_id', shopId),
        supabase.from('customers').select('id, name').eq('shop_id', shopId),
        supabase.from('reservations').select('*').eq('shop_id', shopId).gte('start_time', kStartStrT).lte('start_time', kEndStrT),
        supabase.from('private_tasks').select('*').eq('shop_id', shopId).gte('start_time', kStartStrT).lte('start_time', kEndStrT),
        supabase.from('visit_requests').select('*, facility_users(facility_name)').eq('shop_id', shopId).neq('status', 'canceled').gte('scheduled_date', kStartStr).lte('scheduled_date', kEndStr),
        supabase.from('keep_dates').select('*, facility_users(*)').eq('shop_id', shopId).gte('date', kStartStr).lte('date', kEndStr),
        supabase.from('regular_keep_exclusions').select('excluded_date').eq('shop_id', shopId)
      ]);

      setSalesRecords(sRes.data || []);
      setAllCustomers(cRes.data || []);

      // ○△✕判定用のデータをStateへガッチリ蓄積
      setResList(resData.data || []);
      setPrivList(privData.data || []);
      setVisitList(visitData.data || []);
      setKeepList(mData.data || []);
      setExclList(exclData.data?.map(e => e.excluded_date) || []);

    } else if (error) {
      console.error("取得エラー:", error);
    }
    setLoading(false);
  };

  const addRule = () => {
    // 時間も含めて重複チェック
    const exists = formData.regular_rules?.some(r => 
      r.day === selDay && r.week === selWeek && r.monthType === selMonthType && r.time === selTime
    );
    if (exists) return;
    
    const newRule = { 
      day: selDay, 
      week: selWeek, 
      monthType: selMonthType, 
      time: selTime // 🆕 選択された時間を保存
    };
    setFormData({ ...formData, regular_rules: [...(formData.regular_rules || []), newRule] });
  };

  const removeRule = (idx) => {
    const newRules = formData.regular_rules.filter((_, i) => i !== idx);
    setFormData({ ...formData, regular_rules: newRules });
  };

  // 3. handleSave を「新規なら insert、編集なら update」に整理
const handleSave = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  try {
    if (editingId) {
      // --- ❶ 編集（既存データの更新） ---
      
      // ① 施設マスター（共通アカウント）情報を更新
      const { error: userError } = await supabase
        .from('facility_users')
        .update({
          facility_name: formData.name,
          furigana: formData.furigana,
          login_id: formData.login_id || formData.name, // ログインID（無ければ名前を代用）
          password: formData.pw,
          email: formData.email,
          address: formData.address,
          tel: formData.tel
        })
        .eq('id', editingId);

      if (userError) throw userError;

      // ② 店舗との提携ルール（定期キープなど）を更新
      const { error: connError } = await supabase
        .from('shop_facility_connections')
        .update({ 
          regular_rules: formData.regular_rules,
          advance_booking_days: formData.advance_booking_days // 🚀 🆕 ここを追加！
        })
        .eq('facility_user_id', editingId)
        .eq('shop_id', shopId);

      if (connError) throw connError;

    } else {
      // --- ❷ 新規登録（アカウント作成 ＋ 提携） ---
      
      // ① まず施設アカウントを新規作成（facility_usersテーブル）
      const { data: newUser, error: userError } = await supabase
        .from('facility_users')
        .insert([{
          facility_name: formData.name,
          furigana: formData.furigana,
          login_id: formData.login_id || formData.email, 
          password: formData.pw,
          email: formData.email,
          address: formData.address,
          tel: formData.tel
        }])
        .select()
        .single();

      if (userError) throw userError;

      // ② 次に、作成されたアカウントと「SnipSnap（店舗）」を提携させる
      const { error: connError } = await supabase
        .from('shop_facility_connections')
        .insert([{
          shop_id: shopId,
          facility_user_id: newUser.id,
          regular_rules: formData.regular_rules,
          advance_booking_days: formData.advance_booking_days // 🚀 🆕 ここを追加！
        }]);

      if (connError) throw connError;
    }

    setIsModalOpen(false);
    fetchFacilities(); // 最新の提携リストを再取得
    resetForm();
    alert('施設情報の保存と提携が完了しました！');

  } catch (error) {
    console.error("保存エラー:", error);
    alert('保存に失敗しました: ' + error.message);
  } finally {
    setLoading(false);
  }
};

  // 🆕 1. 施設からの提携申請を「承認」する
  const handleApprove = async (connectionId) => {
    const { error } = await supabase.from('shop_facility_connections').update({ status: 'active' }).eq('id', connectionId);

    if (!error) {
      try {
        const f = facilities.find(item => item.connection_id === connectionId);
        // 1. 店舗の情報を最新の状態で取得（🚀 安全なアスタリスクに変更して400エラーを粉砕します！）
        const { data: myShop } = await supabase.from('profiles').select('*').eq('id', shopId).single();

        if (f && myShop) {
          // 🚀 修正：method と body を正しい同階層のオプションとして引き渡します
          const { data: funcData, error: funcError } = await supabase.functions.invoke('resend', {
            method: 'POST', // 💡 前回の同階層に配置する修正もここにドッキング！
            body: {
              type: 'partnership_approved',
              shopName: myShop.business_name,
              facilityName: f.facility_name,
              shopEmail: myShop.email_contact || myShop.email,
              facilityEmail: f.email,
              shopId: myShop.id,
              facilityId: f.id
            }
          });
          if (funcError) console.error("通知関数の呼び出しに失敗:", funcError);
        }
      } catch (mailErr) {
        console.error("メール送信処理中にエラー:", mailErr);
      }

      alert('提携を承認しました！お互いに祝福メールを送信しました🎉');
      fetchFacilities();
    } else {
      alert('承認エラー: ' + error.message);
    }
  };

  // 🆕 2. 施設からの提携申請を「拒否（削除）」する
  const handleReject = async (connectionId) => {
    if (!window.confirm('この申請を拒否して削除しますか？')) return;
    
    const { error } = await supabase
      .from('shop_facility_connections')
      .delete()
      .eq('id', connectionId);

    if (!error) {
      alert('リクエストを削除しました。');
      fetchFacilities();
    }
  };

  // 🆕 【ここを追加！】店舗の通知設定（メールON/OFF）を更新する関数
  const updateShopSetting = async (value) => {
    setIsUpdating(true);
    const { error } = await supabase
      .from('profiles')
      .update({ email_notifications_enabled: value })
      .eq('id', shopId);

    if (!error) {
      setShopSettings({ ...shopSettings, email_notifications_enabled: value });
    } else {
      alert('設定の更新に失敗しました');
    }
    setIsUpdating(false);
  };

  const toggleTimeSlot = (time) => {
    const currentSlots = shopSettings.facility_visit_slots || [];
    if (currentSlots.includes(time)) {
      // 既に選択されていたら削除
      setShopSettings({ ...shopSettings, facility_visit_slots: currentSlots.filter(t => t !== time) });
    } else {
      // 未選択なら追加してソート（時間の早い順に並べる）
      setShopSettings({ ...shopSettings, facility_visit_slots: [...currentSlots, time].sort() });
    }
  };

  // 🆕 ここから差し込む！！ ==========================================
  // 振込先情報を一括で更新（保存）する関数
  const saveShopGlobalSettings = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_facility_searchable: shopSettings.is_facility_searchable,
          sub_business_type: shopSettings.sub_business_type,
          hourly_capacity_per_staff: shopSettings.hourly_capacity_per_staff,
          facility_staff_count: shopSettings.facility_staff_count,
          facility_visit_start: shopSettings.facility_visit_start,
          facility_visit_end: shopSettings.facility_visit_end,
          facility_visit_slots: shopSettings.facility_visit_slots, // 🚀 🆕 ここを追加！
          facility_lunch_start: shopSettings.facility_lunch_start,
          facility_lunch_end: shopSettings.facility_lunch_end,
          bank_name: shopSettings.bank_name,
          bank_branch: shopSettings.bank_branch,
          bank_account_type: shopSettings.bank_account_type,
          bank_account_number: shopSettings.bank_account_number,
          bank_account_holder: shopSettings.bank_account_holder
        })
        .eq('id', shopId);

      if (error) throw error;
      alert('ショップ設定を更新しました！✨');
    } catch (err) {
      alert('失敗: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };
  // 🏢 ここまで ======================================================

  // ★★★★★★★ ここから「ねじ込みキープ保存関数」を追記 ★★★★★★★
  const handleSaveManualKeep = async () => {
    if (!keepDate) { alert("日付を選択してください。"); return; }
    if (!keepTime) { alert("時間を選択してください。"); return; }
    if (!keepTargetFacilityId) { alert("対象の施設を選択してください。"); return; }

    setLoading(true);
    try {
      // keep_dates テーブルに店舗主導のキープ枠を挿入
      const { error } = await supabase
        .from('keep_dates')
        .insert([{
          shop_id: shopId,
          facility_user_id: keepTargetFacilityId,
          date: keepDate,
          start_time: keepTime,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      alert("施設用のねじ込みキープ枠を正常に確保しました！✨");
      setShowManualKeepModal(false);
      // 入力のリセット
      setKeepDate('');
      setKeepTime('09:00');
      setKeepTargetFacilityId('');
    } catch (err) {
      console.error("Manual Keep Error:", err);
      alert("キープ枠の確保に失敗しました: " + err.message);
    } finally {
      setLoading(false);
      fetchFacilities(); 
    }
  };

  // 🚀 🆕 究極版：予定名(3文字)+開始時間、複数件カウントに対応した○△✕判定ロジック
  const getKeepSlotStatus = (dateStr) => {
    const d = new Date(dateStr);
    const todayStr = new Date().toLocaleDateString('sv-SE');
    
    // ⏳ 過去と今日（22日）は無条件で選択不可（ past ）
    if (dateStr <= todayStr) return { status: 'past', label: '✕', name: '', time: '' };

    // ─── ✕ (NG) の判定 ───
    
    // ✕定休日チェック
    if (shopSettings?.business_hours?.regular_holidays) {
      const holidays = shopSettings.business_hours.regular_holidays;
      const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()];
      const nthWeek = Math.ceil(d.getDate() / 7);
      const checkLast = new Date(d); checkLast.setDate(d.getDate() + 7);
      const isLastWeek = checkLast.getMonth() !== d.getMonth();
      const checkSecondLast = new Date(d); checkSecondLast.setDate(d.getDate() + 14);
      const isSecondToLastWeek = (checkSecondLast.getMonth() !== d.getMonth()) && !isLastWeek;

      if (holidays[`${nthWeek}-${dayName}`] || (isLastWeek && holidays[`L1-${dayName}`]) || (isSecondToLastWeek && holidays[`L2-${dayName}`])) {
        return { status: 'ng', label: '✕', name: '定休日', time: '' };
      }
    }

    // ✕長期休み ＆ 臨時休業チェック
    if (shopSettings?.special_holidays && Array.isArray(shopSettings.special_holidays)) {
      const matchedHoliday = shopSettings.special_holidays.find(h => {
        if (h.start && h.end) return dateStr >= h.start && dateStr <= h.end;
        return (h.date || h.start) === dateStr;
      });
      if (matchedHoliday) {
        return { status: 'ng', label: '✕', name: (matchedHoliday.name || '休業').slice(0, 3), time: '' };
      }
    }
    
    // ✕予約票上の「臨時休業」または「終日ブロック」をチェック
    const tempClosure = resList.find(r => r.start_time.startsWith(dateStr) && r.status !== 'canceled' && (r.customer_name === '臨時休業' || r.customer_name === '終日ブロック'));
    if (tempClosure) {
      return { status: 'ng', label: '✕', name: '臨時休', time: '' };
    }

    // ✕予約確定（施設訪問：visit_requests）のチェック
    const matchedVisit = visitList.find(v => v.scheduled_date === dateStr);
    if (matchedVisit) {
      const vTime = (matchedVisit.start_time || '09:00').substring(0, 5);
      const vName = matchedVisit.facility_users?.facility_name || matchedVisit.customer_name || '施設';
      return { status: 'ng', label: '✕', name: vName.slice(0, 3), time: vTime };
    }

    // ✕単発キープ・変更定期キープ（keep_dates）のチェック
    const matchedManualKeep = keepList.find(k => k.date === dateStr);
    if (matchedManualKeep) {
      const kTime = (matchedManualKeep.start_time || '09:00').substring(0, 5);
      const kName = matchedManualKeep.facility_users?.facility_name || '施設';
      return { status: 'ng', label: '✕', name: kName.slice(0, 3), time: kTime };
    }

    // ✕純粋な自動定期キープ（第n曜日ルール）のチェック
    if (!exclList.includes(dateStr) && facilities.length > 0) {
      const day = d.getDay();
      const dom = d.getDate();
      const m = d.getMonth() + 1;
      const nthWeek = Math.ceil(dom / 7);
      const tempNext = new Date(d); tempNext.setDate(dom + 7);
      const isLastWeek = tempNext.getMonth() !== d.getMonth();
      const tempNext2 = new Date(d); tempNext2.setDate(dom + 14);
      const isSecondToLastWeek = (tempNext2.getMonth() !== d.getMonth()) && !isLastWeek;

      let regKeepData = null;
      facilities.forEach(conn => {
        conn.regular_rules?.forEach(rule => {
          const monthMatch = (rule.monthType === 0) || (rule.monthType === 1 && m % 2 !== 0) || (rule.monthType === 2 && m % 2 === 0);
          const dayMatch = (rule.day === day);
          const weekMatch = (rule.week === nthWeek) || (rule.week === -1 && isLastWeek) || (rule.week === -2 && isSecondToLastWeek);

          if (monthMatch && dayMatch && weekMatch) {
            regKeepData = { name: conn.facility_name || '施設', time: (rule.time || '09:00').substring(0, 5) };
          }
        });
      });
      if (regKeepData) {
        return { status: 'ng', label: '✕', name: regKeepData.name.slice(0, 3), time: regKeepData.time };
      }
    }

    // ─── △ (部分埋まり) の判定 ───
    // その日に入っている個人予約 ＆ プライベート予定をすべて配列にマージして件数を数える
    const dayPersonalRes = resList.filter(r => r.start_time.startsWith(dateStr) && r.res_type === 'normal' && r.status !== 'canceled');
    const dayPrivateTasks = privList.filter(p => p.start_time.startsWith(dateStr));
    
    // 全てのアクティブな個人系予定を合体
    const allDeltaEvents = [
      ...dayPersonalRes.map(r => ({
        name: (r.customer_name || '客').trim(),
        time: new Date(r.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
      })),
      ...dayPrivateTasks.map(p => ({
        name: (p.title || '予定').trim(),
        time: new Date(p.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
      }))
    ];

    if (allDeltaEvents.length > 0) {
      // 開始時間が一番早いものを基準にするためにソート
      allDeltaEvents.sort((a, b) => a.time.localeCompare(b.time));
      const firstEvent = allDeltaEvents[0];
      
      return { 
        status: 'partial', 
        label: '△', 
        name: firstEvent.name.slice(0, 3), 
        time: firstEvent.time,
        count: allDeltaEvents.length // 何件重なっているかを画面に渡す
      };
    }

    // ─── ○ (完全空き) の判定 ───
    return { status: 'available', label: '○', name: '', time: '' };
  };
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

  const handleDelete = async (f) => {
    const confirmName = window.prompt(`施設「${f.facility_name}」との提携を解消しますか？\n実行する場合は、確認のため施設名を正確に入力してください：`);
    
    if (confirmName === f.facility_name) {
      const { error } = await supabase
        .from('shop_facility_connections')
        .delete()
        .eq('facility_user_id', f.id)
        .eq('shop_id', shopId);

      if (!error) {
        alert('提携を解消しました。');
        fetchFacilities();
      }
    } else if (confirmName !== null) {
      alert('施設名が一致しません。処理を中断しました。');
    }
  };

  // 🚀 🆕 【追加】請求書・領収書の印刷実行ロジック
  const handlePrintInvoice = async (mode, data) => {
    const printWin = window.open('', '_blank', 'width=900,height=1000');

    // 🚀 🆕 【超重要】データベースの名簿から、この施設の最新のふりがなマップを自動取得
    const { data: memberKanas } = await supabase
      .from('members')
      .select('name, kana')
      .eq('facility_user_id', invoiceTarget.facility_user_id);

    const kanaLookup = {};
    memberKanas?.forEach(m => {
      if (m.name) kanaLookup[m.name.trim()] = m.kana || "";
    });
    
    const members = data.flatMap(s => {
      if (s.details?.members_list) {
        return s.details.members_list.map(m => {
          const trimmedName = (m.name || "").trim();
          return { 
            ...m, 
            date: s.sale_date,
            // 🚀 🆕 過去のデータにふりがなが無ければ、今名簿にある最新のふりがなを全自動でドッキング！
            kana: m.kana || kanaLookup[trimmedName] || ""
          };
        });
      }
      return [{
        date: s.sale_date,
        name: invoiceTarget.name,
        floor: '-',
        menu: '施設訪問 施術一式',
        price: s.total_amount
      }];
    });

    // 🚀 🆕 理想の3段階ソートを実行！
    members.sort((a, b) => {
      // ① まずは日付で比較（古い順）
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      if (dateCompare !== 0) return dateCompare;

      // ② 日付が同じなら、フロア・階数で比較（低い階から順：1F ➔ 2F ➔ 3F）
      const fA = parseInt(String(a.floor).replace(/[^0-9]/g, '')) || 999;
      const fB = parseInt(String(b.floor).replace(/[^0-9]/g, '')) || 999;
      if (fA !== fB) return fA - fB;

      // ③ 日付も階数も同じなら、最後にふりがな（あいうえお順）で並び替え
      const kanaA = (a.kana || a.name || "").trim();
      const kanaB = (b.kana || b.name || "").trim();
      return kanaA.localeCompare(kanaB, 'ja');
    });

    const total = data.reduce((sum, s) => sum + Number(s.total_amount), 0);
    
    let content = `
      <html>
        <head>
          <title>請求書発行</title>
          <style>
            /* 🚀 左右と上の余白を AdminManagement と同じ 10mm に短縮 */
            @page { 
              size: A4; 
              margin: ${mode === 'full' ? '10mm 10mm' : '0'}; 
            }
            body { font-family: "MS Mincho", "Hiragino Mincho ProN", serif; margin: 0; padding: 0; background: white; color: black; }
            
            /* 🚀 コンテナのパディングを削除して左右いっぱいに広げる */
            .page { width: 100%; box-sizing: border-box; padding: 0; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; border-top: 2px solid #000; table-layout: fixed; }
            
            /* 🚀 行の高さを少し詰め、20行入るように調整 */
            th, td { padding: 8px 4px; border-bottom: 1px solid #ccc; font-size: 10pt; text-align: left; word-wrap: break-word; }
            th { border-bottom: 1px solid #000; background: #fff; text-align: center; font-weight: bold; }
            tbody tr:nth-child(even) { background-color: #f8fafc; }
            
            .summary-total-box { text-align: center; margin: 25px 0; }
            .summary-total { font-size: 19pt; font-weight: 900; border-bottom: 3px double #000; padding: 5px 20px; display: inline-block; }
            
            .bank-info { border: 1px solid #000; padding: 12px; font-size: 10.5pt; margin-top: 15px; line-height: 1.5; }
            
            .ticket-page { width: 210mm; height: 297mm; display: flex; flex-wrap: wrap; align-content: flex-start; page-break-after: always; }
            .ticket { width: 105mm; height: 74.25mm; padding: 10mm; box-sizing: border-box; border: 0.1mm dashed #ccc; position: relative; display: flex; flex-direction: column; }
          </style>
        </head>
        <body>
    `;

    if (mode === 'full') {
      content += `
        <div class="page">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
            <div style="font-size: 20pt; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 5px; width: 350px;">
              ${invoiceMonth}月度 請求明細書
            </div>
            <div style="text-align: right; line-height: 1.3; font-size: 10pt; width: 300px;">
              <p style="font-weight: bold; font-size: 12pt; margin: 0 0 5px 0;">${shopSettings.business_name || ''}</p>
              <p style="margin: 0;">〒${shopSettings.zip_code || ''}</p>
              <p style="margin: 0;">${shopSettings.address || ''}</p>
              <p style="margin: 0;">TEL: ${shopSettings.phone || ''}</p>
            </div>
          </div>
          
          <div style="text-align: left; margin-bottom: 25px;">
             <div style="font-size: 21pt; font-weight: bold; border-bottom: 3px solid #000; display: inline-block; padding-bottom: 3px; min-width: 400px;">
               ${invoiceTarget.name} 御中
             </div>
             <p style="margin: 10px 0 0 0; font-size: 11pt;">下記の通り、御請求申し上げます。</p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 6%;">No</th>
                <th style="width: 12%;">日付</th>
                <th style="width: 9%;">階数</th>
                <th style="width: 22%;">名前</th>
                <th style="width: 38%;">メニュー</th>
                <th style="width: 13%; text-align:right;">金額</th>
              </tr>
            </thead>
            <tbody>
              ${members.map((m, i) => `
                <tr>
                  <td style="text-align:center;">${i+1}</td>
                  <td style="text-align:center;">${m.date?.slice(5).replace('-', '/')}</td>
                  <td style="text-align:center;">${m.floor?.toString().replace('F', '') || '-'}F</td>
                  <td><strong>${m.name} 様</strong></td>
                  <td style="font-size: 9pt;">${m.menu}</td>
                  <td style="text-align:right; font-weight: bold;">¥${Number(m.price || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary-total-box">
            <div class="summary-total">ご請求金額： ¥ ${total.toLocaleString()} - (税込)</div>
          </div>

          <div class="bank-info">
            <span style="font-weight:bold; text-decoration:underline;">【お振込先】</span><br/>
            ${shopSettings.bank_name || ''} ${shopSettings.bank_branch || ''} / ${shopSettings.bank_account_type || '普通'} ${shopSettings.bank_account_number || ''} / ${shopSettings.bank_account_holder || ''}
          </div>
        </div>
      `;
    } else {
      // 8分割領収書（省略せず一貫性を保持）
      const pages = Math.ceil(members.length / 8);
      for (let p = 0; p < pages; p++) {
        content += `<div class="ticket-page">`;
        members.slice(p * 8, (p + 1) * 8).forEach((m, i) => {
          content += `
            <div class="ticket">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 5px;">
                <div style="font-size: 11pt;">領収書</div>
                <div style="font-size: 10pt; font-weight: bold;">No. ${(p*8)+i+1}</div>
              </div>
              <div style="text-align: center; margin: 12px 0;">
                <span style="font-size: 16pt; font-weight: bold; border-bottom: 1px solid #000; padding: 0 15px;">${m.name} 様</span>
              </div>
              
              <div style="background: #eee !important; text-align: center; font-size: 19pt; font-weight: bold; padding: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                ¥${Number(m.price || 0).toLocaleString()}
              </div>

              <div style="border-bottom: 1px solid #000; margin: 10px 0; font-size: 10pt;">但 ${m.menu} 代として</div>
              
              <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end;">
                <span style="font-size: 12pt; font-weight: bold;">${m.date?.replace(/-/g, '/')}</span>
                <div style="text-align: right; font-size: 9pt;">
                  <strong>${shopSettings.business_name}</strong>
                </div>
              </div>
            </div>`;
        });
        content += `</div>`;
      }
    }

    content += `
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `;
    printWin.document.write(content);
    printWin.document.close();
  };

  // 🆕 3. 表示用にリストを「承認待ち」と「提携済み」に分ける
  const pendingFacilities = facilities.filter(f => f.status === 'pending' && f.created_by_type === 'facility');

  // 💡 🚀 🆕 店舗（自分）からアタックを仕掛けたもの（相手がOKを出すのを待つ側）
  const outgoingFacilities = facilities.filter(f => f.status === 'pending' && f.created_by_type === 'shop');

  const activeFacilities = facilities.filter(f => f.status === 'active');

  const openEdit = (f) => {
    setEditingId(f.id);
    // 🚀 🆕 修正：既存の全プロフィール情報をセット（furigana含む）
    setFormData({ 
      name: f.facility_name || '', 
      furigana: f.furigana || '',      // 👈 追加
      email: f.email || '', 
      tel: f.tel || '', 
      address: f.address || '', 
      pw: f.password || '', 
      login_id: f.login_id || '',
      regular_rules: f.regular_rules || [], 
      advance_booking_days: f.advance_booking_days || 0,
      tenant_id: shopId 
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    // 🚀 🆕 修正：全項目を空でリセット（furigana含む）
    setFormData({ 
      name: '', furigana: '', email: '', tel: '', address: '', pw: '', login_id: '', 
      regular_rules: [], advance_booking_days: 0, tenant_id: shopId // 🚀 🆕 ここに0を追加！
    });
    setSelMonthType(0);
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to={`/admin/${shopId}/dashboard`} style={backBtnStyle}><ArrowLeft size={20} /></Link>
          <div>
            <h1 style={titleStyle}>施設管理</h1>
            <p style={subtitleStyle}>提携施設の管理・定期ルール設定</p>
          </div>
        </div>
        {/* 🆕 自力で作るのではなく、プラットフォームから探しに行くボタンに変更 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => {
              setKeepViewMonth(new Date());
              setKeepDate('');
              setKeepTime('09:00');
              if (activeFacilities.length > 0) setKeepTargetFacilityId(activeFacilities[0].id);
              setShowManualKeepModal(true);
            }} 
            style={{...addBtnStyle, background: '#059669', gap: '8px'}}
          >
            📌 店舗側からキープを入れる
          </button>
          <button 
            onClick={() => navigate(`/admin/${shopId}/facility-search`)} 
            style={{...addBtnStyle, background: '#4f46e5', gap: '8px'}}
          >
            <Search size={18} /> 新しい提携先を探す
          </button>
        </div>
      </header>

      {/* 🆕 店舗側の通知設定パネルを追加 */}
      {/* 🆕 振込先設定パネルを追加 */}
      {!loading && (
        <div style={{ ...cardStyle, marginBottom: '30px', padding: '25px', background: '#fff', border: '2px solid #e0e7ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' }}>
            <div style={iconBoxStyle('#4f46e5')}><Store size={20} /></div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>基本設定（検索公開・振込先）</h3>
          </div>

          {/* 🚀 🆕 修正：縦に一本化されたスッキリレイアウト */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* 1. 公開設定・ジャンル */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
               <div style={settingRow}>
                 <div>
                   <div style={{fontWeight:'bold', fontSize:'0.9rem'}}>施設検索への公開</div>
                   <div style={{fontSize:'0.7rem', color:'#64748b'}}>施設側で検索・リクエストが可能になります</div>
                 </div>
                 <button 
                   onClick={() => setShopSettings({...shopSettings, is_facility_searchable: !shopSettings.is_facility_searchable})}
                   style={toggleBtnStyle(shopSettings.is_facility_searchable)}
                 >
                   {shopSettings.is_facility_searchable ? '公開中' : '非公開'}
                 </button>
               </div>

               <label style={labelStyle}>施設向け専門ジャンル
                  <select 
                    value={shopSettings.sub_business_type} 
                    onChange={(e) => setShopSettings({...shopSettings, sub_business_type: e.target.value})}
                    style={inputStyle}
                  >
                    {visitingSubCategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
               </label>
            </div>

            {/* 2. 施術キャパシティ ＆ 時間枠設定（全6項目で修正） */}
            <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '20px', border: '1px solid #bbf7d0' }}>
                 <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <Users size={16} /> 施術キャパシティ ＆ 時間枠の設定
                 </div>
                 
                 {/* 🚀 🆕 3列×2段の計6項目が並ぶように調整しました */}
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                   <label style={labelStyle}>1人1時間の施術人数
                     <input type="number" step="0.1" value={shopSettings.hourly_capacity_per_staff || ''} onChange={(e) => setShopSettings({...shopSettings, hourly_capacity_per_staff: parseFloat(e.target.value)})} style={inputStyle} />
                   </label>
                   <label style={labelStyle}>訪問スタッフ数(標準)
                     <input type="number" value={shopSettings.facility_staff_count || ''} onChange={(e) => setShopSettings({...shopSettings, facility_staff_count: parseInt(e.target.value)})} style={inputStyle} />
                   </label>

                   {/* ⭕️ 復活：開始時間 */}
                   <label style={labelStyle}>施設訪問 開始時間
                     <input type="time" value={shopSettings.facility_visit_start || '09:00'} onChange={(e) => setShopSettings({...shopSettings, facility_visit_start: e.target.value})} style={inputStyle} />
                   </label>

                   <label style={labelStyle}>施設訪問 終了時間
                     <input type="time" value={shopSettings.facility_visit_end || '17:00'} onChange={(e) => setShopSettings({...shopSettings, facility_visit_end: e.target.value})} style={inputStyle} />
                   </label>

                   {/* ☕️ 休憩時間 */}
                   <label style={labelStyle}>休憩 開始
                     <input type="time" value={shopSettings.facility_lunch_start || '12:00'} onChange={(e) => setShopSettings({...shopSettings, facility_lunch_start: e.target.value})} style={inputStyle} />
                   </label>
                   <label style={labelStyle}>休憩 終了
                     <input type="time" value={shopSettings.facility_lunch_end || '13:00'} onChange={(e) => setShopSettings({...shopSettings, facility_lunch_end: e.target.value})} style={inputStyle} />
                   </label>
                 </div>

                 {/* ポチポチ選べるタイルセクション */}
                 <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px dashed #bbf7d0' }}>
                   <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#166534', marginBottom: '10px' }}>🕒 施設側に表示する時間枠（タップして選択）</div>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                     {FACILITY_TIME_OPTIONS.map(time => {
                       const isActive = shopSettings.facility_visit_slots?.includes(time);
                       return (
                         <button key={time} type="button" onClick={() => toggleTimeSlot(time)} style={{ padding: '8px 12px', borderRadius: '10px', border: isActive ? 'none' : '1px solid #cbd5e1', background: isActive ? '#4f46e5' : '#fff', color: isActive ? '#fff' : '#64748b', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: '0.2s' }}>
                           {time}
                         </button>
                       );
                     })}
                   </div>
                   <p style={{ fontSize: '0.65rem', color: '#166534', marginTop: '12px', lineHeight: '1.4' }}>
                     ※選んだ時間だけが施設側の予約画面にボタンとして表示されます。<br/>
                     ※「最大〇名」の計算には、上記の「終了時間」と「休憩時間」が使用されます。
                   </p>
                 </div>
            </div>

            {/* 3. 振込先情報（キャパ設定のすぐ下に配置） */}
            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
               <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <ReceiptText size={16} /> お振込先情報（請求書に記載されます）
               </div>
               
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                 <label style={labelStyle}>銀行名
                   <input type="text" value={shopSettings.bank_name || ''} onChange={(e) => setShopSettings({...shopSettings, bank_name: e.target.value})} style={inputStyle} />
                 </label>
                 <label style={labelStyle}>支店名
                   <input type="text" value={shopSettings.bank_branch || ''} onChange={(e) => setShopSettings({...shopSettings, bank_branch: e.target.value})} style={inputStyle} />
                 </label>
                 <label style={labelStyle}>口座番号
                   <input type="text" value={shopSettings.bank_account_number || ''} onChange={(e) => setShopSettings({...shopSettings, bank_account_number: e.target.value})} style={inputStyle} />
                 </label>
                 <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>名義(カナ)
                   <input type="text" value={shopSettings.bank_account_holder || ''} onChange={(e) => setShopSettings({...shopSettings, bank_account_holder: e.target.value})} style={inputStyle} />
                 </label>
               </div>
            </div>

          </div>
          
          <button 
            onClick={saveShopGlobalSettings}
            disabled={isUpdating}
            style={{ ...addBtnStyle, width: '100%', marginTop: '20px', background: '#1e293b', justifyContent: 'center' }}
          >
            {isUpdating ? '保存中...' : '基本設定をすべて保存する'}
          </button>
        </div>
      )}

      {loading ? <p style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>読込中...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          {/* --- A: 届いている提携申請（pending）セクション --- */}
          {pendingFacilities.length > 0 && (
            <section>
              <h3 style={sectionTitleStyle}>
                <AlertCircle size={18} color="#f97316" /> 届いている提携申請（承認が必要です）
              </h3>
              <div style={gridStyle}>
                {pendingFacilities.map((f) => (
                  <motion.div 
                    key={f.id} 
                    animate={{ boxShadow: ["0px 0px 0px rgba(249,115,22,0)", "0px 0px 15px rgba(249,115,22,0.4)", "0px 0px 0px rgba(249,115,22,0)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ ...cardStyle, border: '2px solid #fdba74', background: '#fffaf5' }}
                  >
                    <div style={cardHeaderStyle}>
                      <div style={{ flex: 1 }}>
                        <h2 style={facilityNameStyle}>{f.facility_name}</h2>
                        <div style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: 'bold', marginTop: '4px' }}>施設側からアタックが届いています</div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleApprove(f.connection_id)} style={{ ...addBtnStyle, background: '#10b981', padding: '8px 16px', fontSize: '0.85rem' }}>承認する</button>
                        {/* 🆕 ゴミ箱から「拒否」ボタンに変更 */}
                        <button onClick={() => handleReject(f.connection_id)} style={{ ...iconBtnStyle, color: '#ef4444', fontSize: '0.8rem', padding: '8px 12px', fontWeight: 'bold' }}>拒否</button>
                      </div>
                    </div>

                    <div style={{ ...infoGridStyle, marginTop: '15px' }}>
                    {f.email && (
                      <a href={`mailto:${f.email}`} style={{ ...infoItemStyle, color: '#4f46e5', textDecoration: 'none' }}>
                        <Mail size={14} /> {f.email}
                      </a>
                    )}
                    {f.tel && (
                      <a href={`tel:${f.tel}`} style={{ ...infoItemStyle, color: '#4f46e5', textDecoration: 'none', fontWeight: 'bold' }}>
                        <Phone size={14} /> {f.tel}
                      </a>
                    )}
                    <div style={infoItemStyle}><User size={14} /> 担当：{f.contact_name || "未登録"}</div>
                    
                    {f.address && (
                      <div style={{ ...infoItemStyle, gridColumn: '1 / -1' }}>
                        <MapPin size={14} /> 
                        <span style={{flex: 1}}>{f.address}</span>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 'bold', textDecoration: 'none' }}
                        >
                          マップを表示
                        </a>
                      </div>
                    )}

                    {f.official_url && (
                      <div style={{ ...infoItemStyle, gridColumn: '1 / -1' }}>
                        <Link2 size={14} /> 
                        <a href={f.official_url} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', textDecoration: 'none' }}>公式サイトを開く</a>
                      </div>
                    )}
                  </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* --- 🚀 🆕 【新設】店舗（自分）から送信した提携申請（相手の承認待ち）セクション --- */}
          {outgoingFacilities.length > 0 && (
            <section style={{ marginBottom: '30px' }}>
              <h3 style={{ ...sectionTitleStyle, color: '#475569' }}>
                <Clock size={18} color="#475569" /> 送信済みの提携申請（施設側の承認待ち）
              </h3>
              <div style={gridStyle}>
                {outgoingFacilities.map((f) => (
                  <div key={f.id} style={{ ...cardStyle, border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                    <div style={cardHeaderStyle}>
                      <div style={{ flex: 1 }}>
                        <h2 style={facilityNameStyle}>{f.facility_name}</h2>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>
                          ⏳ 施設へ提携リクエストを送信しました。相手の承認を待っています...
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button 
                          onClick={() => handleReject(f.connection_id)} 
                          style={{ ...iconBtnStyle, color: '#64748b', fontSize: '0.8rem', padding: '8px 16px', background: '#fff', fontWeight: 'bold' }}
                        >
                          申請を取り消す
                        </button>
                      </div>
                    </div>

                    {/* 💡 ここにある3箇所の infoItem をすべて infoItemStyle に修正しました */}
                    <div style={{ ...infoGridStyle, marginTop: '15px', opacity: 0.8 }}>
                      {f.email && <div style={infoItemStyle}><Mail size={14} /> {f.email}</div>}
                      {f.tel && <div style={infoItemStyle}><Phone size={14} /> {f.tel}</div>}
                      <div style={infoItemStyle}><User size={14} /> 担当：{f.contact_name || "未登録"}</div>
                      {f.address && (
                        <div style={{ ...infoItemStyle, gridColumn: '1 / -1' }}>
                          <MapPin size={14} /> <span>{f.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* --- B: 提携済み施設名簿（active）セクション --- */}
          <section>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b', marginBottom: '15px' }}>提携済み施設一覧</h3>
            <div style={gridStyle}>
              {activeFacilities.map((f) => (
                <motion.div key={f.id} whileHover={{ scale: 1.01 }} style={cardStyle}>
                  <div style={cardHeaderStyle}>
                    <div style={{ flex: 1 }}>
                      <h2 style={facilityNameStyle}>{f.facility_name}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => openEdit(f)} style={iconBtnStyle}><Edit3 size={18} /></button>
                      <button onClick={() => handleDelete(f)} style={{...iconBtnStyle, color: '#ef4444'}}><Trash2 size={18} /></button>
                    </div>
                  </div>

                  <div style={ruleSectionStyle}>
                    <div style={sectionLabelStyle}><Clock size={14} /> 定期キープ：</div>
                    <div style={ruleBadgeContainer}>
  {f.regular_rules?.map((r, i) => (
    <span key={i} style={ruleBadgeStyle}>
      {r.monthType === 1 ? '奇数月 ' : r.monthType === 2 ? '偶数月 ' : ''}
      {WEEKS.find(w => w.value === r.week)?.label}{DAYS.find(d=>d.value===r.day)?.label}曜
      {/* 🚀 🆕 開始時間を追加（HH:mm 形式にカット） */}
      <span style={{ marginLeft: '5px', fontSize: '0.65rem', opacity: 0.8 }}>
        ({(r.time || '09:00').substring(0, 5)})
      </span>
    </span>
  ))}
  {(!f.regular_rules || f.regular_rules.length === 0) && <span style={{fontSize:'12px', color:'#cbd5e1'}}>設定なし</span>}
</div>
                  </div>
                  
                  {/* 🆕 修正：image_4107ca.png と同じリッチレイアウトの詳細エリア */}
                  <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', border: '1px solid #eef2ff' }}>
                    
                    {/* 担当者名 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#475569' }}>
                      <User size={16} color="#4f46e5" /> 
                      <span>担当：<strong>{f.contact_name || '未登録'}</strong></span>
                    </div>

                    {/* 住所 ＆ Googleマップ連携 */}
                    {f.address && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: '#475569' }}>
                        <MapPin size={16} color="#4f46e5" style={{ marginTop: '2px' }} /> 
                        <div style={{ flex: 1 }}>
                          <div style={{ lineHeight: '1.4' }}>{f.address}</div>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}`} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 'bold', textDecoration: 'none', marginTop: '6px', display: 'inline-block', background: '#fff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          >
                            マップで場所を表示
                          </a>
                        </div>
                      </div>
                    )}

                    {/* 電話番号（即発信） */}
                    {f.tel && (
                      <a href={`tel:${f.tel}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 'bold' }}>
                        <Phone size={16} /> {f.tel} 
                        <span style={{ fontSize: '0.65rem', fontWeight: 'normal', opacity: 0.7 }}>(タップで電話)</span>
                      </a>
                    )}

                    {/* メール（提携後は連絡用として表示） */}
                    {f.email && (
                      <a href={`mailto:${f.email}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#4f46e5', textDecoration: 'none' }}>
                        <Mail size={16} /> {f.email}
                      </a>
                    )}

                    {/* 公式サイト */}
                    {f.official_url && (
                      <a href={f.official_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#4f46e5', textDecoration: 'none', borderTop: '1px solid #eef2ff', paddingTop: '10px', marginTop: '4px' }}>
                        <Link2 size={16} /> 施設公式サイトを開く
                      </a>
                    )}
                  </div>

                  {/* 🚀 🆕 2. ここに印刷ボタンを設置！！ */}
                  <button 
  onClick={() => {
    setWorksheetTarget({ name: f.facility_name, facility_user_id: f.id });
    setShowWorksheetModal(true);
  }}
  style={{ ...linkBtnStyle, background: '#1e293b', marginBottom: '10px', border: 'none', cursor: 'pointer' }}
>
  <Printer size={18} /> 現場用ワークシートを印刷 <ChevronRight size={18} />
</button>

                  <button 
                    onClick={() => {
                      const cust = allCustomers.find(c => c.name === f.facility_name);
      setInvoiceTarget({ 
        id: cust?.id, // 顧客名簿のID
        name: f.facility_name,
        facility_user_id: f.id // 共通アカウント側のID
      });
      setShowInvoiceModal(true);
    }} 
    style={{ ...linkBtnStyle, background: '#4f46e5', cursor: 'pointer', border: 'none' }}
  >
    <ReceiptText size={18} /> 請求書・領収書の発行 <ChevronRight size={18} />
  </button>
                </motion.div>
              ))}
            </div>
            {activeFacilities.length === 0 && (
              <div style={{ ...emptyCardStyle, padding: '60px' }}>提携済みの施設はありません</div>
            )}
          </section>

        </div>
      )}

      {/* 登録・編集モーダル */}
      <AnimatePresence>
        {isModalOpen && (
          <div style={modalOverlayStyle} onClick={() => setIsModalOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              style={modalContentStyle} 
              onClick={(e) => e.stopPropagation()}
            >
              <div style={modalHeaderStyle}>
                <h3 style={{margin:0, color:'#1e3a8a'}}>{editingId ? "定期訪問日の編集" : "新規施設登録"}</h3>
                <button onClick={() => setIsModalOpen(false)} style={{border:'none', background:'none'}}><X /></button>
              </div>

              <form onSubmit={handleSave} style={formContainerStyle}>
                <div style={scrollAreaStyle}>
                  <div style={formGridStyle}>
                    {/* 🚀 🆕 追加：施設プロフィールの入力セクション */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                      <label style={labelStyle}>施設名
  <input 
    type="text" 
    value={formData.name} 
    onChange={e => setFormData({...formData, name: e.target.value})} 
    style={{ ...inputStyle, background: editingId ? '#f1f5f9' : '#fff', cursor: editingId ? 'not-allowed' : 'text' }} 
    readOnly={!!editingId}
    required 
  />
</label>

                      <label style={labelStyle}>施設名のふりがな
  <input 
    type="text" 
    placeholder="例：まりあのおか" 
    value={formData.furigana} 
    onChange={e => setFormData({...formData, furigana: e.target.value})} 
    style={{ ...inputStyle, background: editingId ? '#f1f5f9' : '#fff', cursor: editingId ? 'not-allowed' : 'text' }} 
    readOnly={!!editingId}
  />
</label>

                      <label style={labelStyle}>住所
  <input 
    type="text" 
    value={formData.address} 
    onChange={e => setFormData({...formData, address: e.target.value})} 
    style={{ ...inputStyle, background: editingId ? '#f1f5f9' : '#fff', cursor: editingId ? 'not-allowed' : 'text' }} 
    readOnly={!!editingId}
  />
</label>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <label style={labelStyle}>電話番号
  <input 
    type="tel" 
    value={formData.tel} 
    onChange={e => setFormData({...formData, tel: e.target.value})} 
    style={{ ...inputStyle, background: editingId ? '#f1f5f9' : '#fff', cursor: editingId ? 'not-allowed' : 'text' }} 
    readOnly={!!editingId}
  />
</label>
                        <label style={labelStyle}>メールアドレス
  <input 
    type="email" 
    value={formData.email} 
    onChange={e => setFormData({...formData, email: e.target.value})} 
    style={{ ...inputStyle, background: editingId ? '#f1f5f9' : '#fff', cursor: editingId ? 'not-allowed' : 'text' }} 
    readOnly={!!editingId}
  />
</label>
                      </div>
                    </div>

                    {/* 🚀 🆕 ここから追加：予約受付の制限設定 */}
                    <div style={{ background: '#fff5f5', padding: '15px', borderRadius: '15px', border: '1px solid #fee2e2', marginBottom: '10px' }}>
                      <label style={{ ...labelStyle, color: '#ef4444' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <AlertCircle size={16} /> 施設側の予約締め切り
                        </div>
                        <select 
                          value={formData.advance_booking_days}
                          onChange={(e) => setFormData({ ...formData, advance_booking_days: parseInt(e.target.value) })}
                          style={{ ...inputStyle, background: '#fff', marginTop: '8px' }}
                        >
                          <option value={0}>当日まで受付OK</option>
                          <option value={1}>1日前（前日）で受付終了</option>
                          <option value={2}>2日前で受付終了</option>
                          <option value={3}>3日前で受付終了</option>
                          <option value={7}>1週間前で受付終了</option>
                          <option value={10}>10日前で受付終了</option>
                          <option value={14}>2週間前で受付終了</option>
                        </select>
                      </label>
                      <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '8px', lineHeight: '1.4' }}>
                        ※施設側のポータル画面で、今日から指定日数より前の日程は「✕」になり選択できなくなります。
                      </div>
                    </div>
                    {/* 🚀 🆕 追加ここまで */}

                    {/* 定期ルール設定（既存ロジックを維持） */}
                    <div style={ruleConfigBoxStyle}>
                      <div style={{fontWeight:'bold', fontSize:'13px', color:'#1e3a8a', marginBottom:'12px'}}>📅 定期キープの設定</div>
                      
                      <div style={tinyLabelStyle}>月の条件</div>
                      <div style={tileGridStyle}>
                        {MONTH_TYPES.map(m => (
                          <button key={m.value} type="button" onClick={() => setSelMonthType(m.value)} 
                            style={{...tileBtnStyle, backgroundColor: selMonthType === m.value ? '#4f46e5' : '#fff', color: selMonthType === m.value ? '#fff' : '#444'}}>
                            {m.label}
                          </button>
                        ))}
                      </div>

                      <div style={{...tinyLabelStyle, marginTop:'10px'}}>曜日</div>
                      <div style={tileGridStyle}>
                        {DAYS.map(d => (
                          <button key={d.value} type="button" onClick={() => setSelDay(d.value)} 
                            style={{...tileBtnStyle, backgroundColor: selDay === d.value ? '#4f46e5' : '#fff', color: selDay === d.value ? '#fff' : '#444'}}>
                            {d.label}
                          </button>
                        ))}
                      </div>

                      <div style={{...tinyLabelStyle, marginTop:'10px'}}>週</div>
                      <div style={tileGridStyle}>
                        {WEEKS.map(w => (
                          <button key={w.value} type="button" onClick={() => setSelWeek(w.value)} 
                            style={{...tileBtnStyle, backgroundColor: selWeek === w.value ? '#4f46e5' : '#fff', color: selWeek === w.value ? '#fff' : '#444'}}>
                            {w.label}
                          </button>
                        ))}
                      </div>
                      <div style={{...tinyLabelStyle, marginTop:'10px'}}>開始時間</div>
  <input 
    type="time" 
    value={selTime} 
    onChange={(e) => setSelTime(e.target.value)}
    style={{
      width: '100%', padding: '12px', borderRadius: '10px', 
      border: '1px solid #e2e8f0', marginTop: '5px', fontSize: '1rem', fontWeight: 'bold'
    }}
  />
  <button type="button" onClick={addRule} style={ruleAddBtnStyle}>ルールを追加 ➔</button>
                      
                      <div style={ruleListAreaStyle}>
  {formData.regular_rules?.map((r, i) => (
    <div key={i} style={ruleBadgeItemStyle}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {r.monthType === 1 ? '奇数 ' : r.monthType === 2 ? '偶数 ' : ''}
        {WEEKS.find(w=>w.value===r.week)?.label}{DAYS.find(d=>d.value===r.day)?.label}曜
        {/* 🚀 🆕 設定された開始時間を追加 */}
        <span style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: 'bold', marginLeft: '2px' }}>
          ({(r.time || '09:00').substring(0, 5)})
        </span>
      </span>
      <button type="button" onClick={() => removeRule(i)} style={{border:'none', background:'none', color:'#ef4444', cursor:'pointer', padding: '0 4px'}}>✕</button>
    </div>
  ))}
</div>
                    </div>
                  </div>
                </div>

                <div style={modalFooterStyle}>
                  <button type="button" onClick={() => setIsModalOpen(false)} style={cancelBtnStyle}>キャンセル</button>
                  <button type="submit" style={saveBtnStyle}>{loading ? '保存中...' : '設定を保存'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 🆕 ここから追加：請求書発行モーダル本体（移植版） */}
      {showInvoiceModal && invoiceTarget && (
        <div style={modalOverlayStyle} onClick={() => setShowInvoiceModal(false)}>
          <div style={{ ...modalContentStyle, maxWidth: '600px', background: '#f8fafc' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '2px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>📄 請求書類 作成・発行</h3>
              <button onClick={() => setShowInvoiceModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={24}/></button>
            </div>
            <div style={{ padding: '25px' }}>
              {/* 年月選択エリア */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                  <button type="button" style={circleBtn} onClick={() => setInvoiceYear(y => y - 1)}>◀</button>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{invoiceYear}年</span>
                  <button type="button" style={circleBtn} onClick={() => setInvoiceYear(y => y + 1)}>▶</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <button key={m} type="button" onClick={() => setInvoiceMonth(m)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', backgroundColor: invoiceMonth === m ? '#1e293b' : 'white', color: invoiceMonth === m ? 'white' : '#334155' }}>{m}月</button>
                  ))}
                </div>
              </div>

{(() => {
                // 🚀 🆕 最強の名寄せロジック：
                // この施設名（例：マリアの丘）と一致するすべての顧客IDをリストアップ
                const targetCustomerIds = allCustomers
                  .filter(c => c.name === invoiceTarget.name)
                  .map(c => c.id);

                const filteredSales = salesRecords.filter(s => {
                  if (!s.sale_date) return false;
                  const d = new Date(s.sale_date);
                  
                  // ① 年月のチェック
                  const isMatchMonth = d.getFullYear() === invoiceYear && (d.getMonth() + 1) === invoiceMonth;
                  if (!isMatchMonth) return false;

                  // ② 🚀 🆕 売上の customer_id が、リストアップしたIDのどれかに一致すれば採用
                  return targetCustomerIds.includes(s.customer_id);
                });

                const total = filteredSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
                
                return (
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <p style={{ color: '#64748b', fontWeight: 'bold', marginBottom: '10px' }}>{invoiceTarget.name} 様 / {invoiceYear}年{invoiceMonth}月分</p>
                    <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#1e293b' }}>合計：¥ {total.toLocaleString()}</div>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '25px' }}>
                      <button type="button" onClick={() => handlePrintInvoice('full', filteredSales)} style={{ ...saveBtnStyle, width: 'auto', padding: '12px 20px' }}>📄 明細請求書</button>
                      <button type="button" onClick={() => handlePrintInvoice('tickets', filteredSales)} style={{ ...saveBtnStyle, width: 'auto', background: '#ed32ea', padding: '12px 20px' }}>✂️ 8分割領収書</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 🆕 ここから：現場用ワークシート発行モーダルを差し込む！！ */}
      {showWorksheetModal && worksheetTarget && (
        <div style={modalOverlayStyle} onClick={() => setShowWorksheetModal(false)}>
          <div style={{ ...modalContentStyle, maxWidth: '600px', background: '#f8fafc' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '2px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>🖨 現場用ワークシート作成</h3>
              <button onClick={() => setShowWorksheetModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={24}/></button>
            </div>
            <div style={{ padding: '25px' }}>
              {/* 年月選択エリア */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                  <button type="button" style={circleBtn} onClick={() => setWorksheetYear(y => y - 1)}>◀</button>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{worksheetYear}年</span>
                  <button type="button" style={circleBtn} onClick={() => setWorksheetYear(y => y + 1)}>▶</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <button key={m} type="button" onClick={() => setWorksheetMonth(m)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', backgroundColor: worksheetMonth === m ? '#1e293b' : 'white', color: worksheetMonth === m ? 'white' : '#334155' }}>{m}月</button>
                  ))}
                </div>
              </div>

              <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <p style={{ color: '#64748b', fontWeight: 'bold', marginBottom: '15px' }}>{worksheetTarget.name} 様 / {worksheetYear}年{worksheetMonth}月用</p>
                <button 
                  type="button" 
                  onClick={handlePrintWorkSheet} 
                  style={{ ...saveBtnStyle, width: '100%', padding: '16px' }}
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'この内容で印刷プレビューを表示'}
                </button>
                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '12px' }}>
                  ※予約確定済みのメンバーと、当日追加用の予備名簿がセットで作成されます。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 🏢 ここまで差し込み ========================================== */}

      {/* 🚀 🆕 店舗側からの「ねじ込みキープ」モーダル本体 */}
      {showManualKeepModal && (
        <div style={modalOverlayStyle} onClick={() => setShowManualKeepModal(false)}>
          <div 
            style={{ 
              ...modalContentStyle, 
              // 🚀 スマホなら幅・高さを画面いっぱいに強制固定！PCならいつものパステルサイズ
              maxWidth: window.innerWidth > 1024 ? '520px' : '100vw', 
              width: window.innerWidth > 1024 ? '95%' : '100vw',
              maxHeight: window.innerWidth > 1024 ? '85vh' : '100dvh',
              height: window.innerWidth > 1024 ? 'auto' : '100dvh',
              borderRadius: window.innerWidth > 1024 ? '28px' : '0px',
              padding: window.innerWidth > 1024 ? '30px' : '15px 10px', // 🚀 左右のパディングを詰め、横幅をフルに活用
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div style={{ padding: '5px 0 15px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: '#059669', fontSize: '1.2rem', fontWeight: '900' }}>📌 施設枠のねじ込みキープ</h3>
              <button onClick={() => setShowManualKeepModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24}/></button>
            </div>

            {/* スクロールコンテンツエリア */}
            <div style={{ ...scrollAreaStyle, flex: 1, overflowY: 'auto', paddingRight: '4px', marginTop: '10px' }}>
              
              {/* 📅 月曜始まりミニカレンダー */}
              <div style={{ textAlign: 'center', marginBottom: '20px', background: '#f8fafc', padding: '15px 10px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <button type="button" style={circleBtn} onClick={() => setKeepViewMonth(new Date(keepViewMonth.setMonth(keepViewMonth.getMonth() - 1)))}>◀</button>
                  <span style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.1rem' }}>{keepViewMonth.getFullYear()}年 {keepViewMonth.getMonth() + 1}月</span>
                  <button type="button" style={circleBtn} onClick={() => setKeepViewMonth(new Date(keepViewMonth.setMonth(keepViewMonth.getMonth() + 1)))}>▶</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', fontSize: '0.9rem', textAlign: 'center' }}>
                  {['月','火','水','木','金','土','日'].map(w => <div key={w} style={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>{w}</div>)}
                  {(() => {
                    const year = keepViewMonth.getFullYear();
                    const month = keepViewMonth.getMonth();
                    const rawFirstDay = new Date(year, month, 1).getDay();
                    const firstDayCount = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // 月曜始まりに調整
                    const lastDate = new Date(year, month + 1, 0).getDate();
                    const daysArray = [...Array(firstDayCount).fill(null), ...[...Array(lastDate).keys()].map(i => i + 1)];
                    
                    return daysArray.map((day, i) => {
                      if (!day) return <div key={`empty-keep-${i}`} />;
                      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      
                      // 🚀 究客版のオブジェクト判定ロジックを実行
                      const resObj = getKeepSlotStatus(dStr); 
                      
                      const isSelected = keepDate === dStr;
                      const isPastOrToday = resObj.status === 'past';
                      const isNg = resObj.status === 'ng';
                      
                      // 今日・過去、またはすでに施設や定休日で埋まっている(ng)日はタップさせない
                      const isSelectable = !isPastOrToday && !isNg; 

                      // 🎨 マークと配色の決定
                      let statusColor = '#cbd5e1'; 
                      if (resObj.label === '○') statusColor = '#09a32d'; 
                      if (resObj.label === '△') statusColor = '#092bb4'; 
                      if (resObj.label === '✕' && !isPastOrToday) statusColor = '#931616'; 

                      return (
                        <div 
                          key={i} 
                          /* 🚀 修正：日付をタップした時の自動スクロールを完璧に動作させる */
                          onClick={() => {
                            if (!isSelectable) return;
                            setKeepDate(dStr);
                            setTimeout(() => {
                              if (keepTimeRef.current) {
                                keepTimeRef.current.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'nearest'
                                });
                              }
                            }, 120);
                          }}
                          style={{ 
                            padding: '6px 0', 
                            cursor: isSelectable ? 'pointer' : (isPastOrToday ? 'not-allowed' : 'default'), 
                            borderRadius: '12px', 
                            background: isSelected ? '#059669' : 'none', 
                            color: isSelected ? '#fff' : (isPastOrToday ? '#cbd5e1' : '#1e293b'), 
                            fontWeight: isSelected || isSelectable ? 'bold' : 'normal',
                            opacity: isPastOrToday ? 0.4 : 1,
                            minHeight: '74px', // 🚀 高さを広げて大きい文字を安全に収める
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            boxSizing: 'border-box'
                          }}
                        >
                          {/* ① 日付の数字 */}
                          <div style={{ fontSize: '1.05rem', lineHeight: '1' }}>{day}</div>
                          
                          {/* ② 記号（○ △ ✕） */}
                          <div style={{ 
                            fontSize: '0.95rem', 
                            fontWeight: '900', 
                            marginTop: '1px',
                            lineHeight: '1',
                            color: isSelected ? '#fff' : statusColor 
                          }}>
                            {resObj.label}
                          </div>

                          {/* ③ 名前3文字 ＋ 開始時間のテキスト表示 */}
                          {(resObj.status === 'ng' || resObj.status === 'partial') && resObj.name && (
                            <div style={{ 
                              fontSize: '0.8rem', 
                              lineHeight: '1.2', 
                              marginTop: '3px',
                              transform: 'scale(0.9)', 
                              color: isSelected ? '#fff' : (resObj.status === 'ng' ? '#931616' : '#092bb4'),
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}>
                              {resObj.status === 'partial' && resObj.count > 1 ? (
                                <>
                                  <div>{resObj.name.slice(0, 3)}</div>
                                  <div style={{ fontWeight: 'bold', color: '#d97706' }}>他{resObj.count - 1}件</div>
                                </>
                              ) : (
                                <div>{resObj.name.slice(0, 3)}<br/>{resObj.time}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {keepDate && (
                /* 🚀 修正：ここにスクロール先のRefマーカーを設置 */
                <div 
                  ref={keepTimeRef} 
                  style={{ display: 'flex', flexDirection: 'column', gap: '15px', animation: 'fadeIn 0.2s', paddingTop: '5px', paddingBottom: '30px' }}
                >
                  {/* 🕛 時間枠選択 */}
                  <label style={labelStyle}>🕛 開始時間を選択
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
                      {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'].map(t => (
                        <button 
                          key={t} 
                          type="button"
                          onClick={() => setKeepTime(t)} 
                          style={{ 
                            padding: '12px 10px', borderRadius: '12px', 
                            border: keepTime === t ? '2px solid #059669' : '1px solid #cbd5e1', 
                            background: keepTime === t ? '#059669' : '#fff', 
                            color: keepTime === t ? '#fff' : '#1e293b', 
                            fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </label>

                  {/* 🏢 対象施設選択 */}
                  <label style={{ ...labelStyle, marginTop: '5px' }}>🏢 キープを入れる訪問施設を選択
                    <select 
                      value={keepTargetFacilityId} 
                      onChange={(e) => setKeepTargetFacilityId(e.target.value)} 
                      style={{ ...inputStyle, marginTop: '8px', background: '#fff' }}
                    >
                      {activeFacilities.map(f => (
                        <option key={f.id} value={f.id}>{f.facility_name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div style={{ ...modalFooterStyle, paddingWeight: '5px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', background: '#fff', flexShrink: 0 }}>
              <button type="button" onClick={() => setShowManualKeepModal(false)} style={cancelBtnStyle}>キャンセル</button>
              <button 
                type="button" 
                onClick={handleSaveManualKeep} 
                disabled={!keepDate || !keepTargetFacilityId}
                style={{ ...saveBtnStyle, background: '#059669', opacity: (!keepDate || !keepTargetFacilityId) ? 0.5 : 1 }}
              >
                キープ枠を確定する
              </button>
            </div>
          </div>
        </div>
      )}

    </div> // 👈 コンポーネント全体の最後の閉じタグ
  );
};

// 🚀 🆕 スマホ・PCを自動判定するフラグをスタイル側にも用意
const isMobileUI = window.innerWidth <= 1024;

// スタイル定義（スマホ・PC両対応の超リッチレスポンシブ版）
const containerStyle = { 
  maxWidth: '1000px', 
  margin: '0 auto', 
  padding: isMobileUI ? '15px 12px' : '30px 20px', // スマホ時は余白をタイトに
  minHeight: '100vh', 
  background: '#f8fafc' 
};

const headerStyle = { 
  display: 'flex', 
  flexDirection: isMobileUI ? 'column' : 'row', // 🚀 スマホ時は縦並び、PCは横並び
  alignItems: isMobileUI ? 'stretch' : 'center', 
  justifyContent: 'space-between', 
  gap: '15px', 
  marginBottom: '25px' 
};

const titleStyle = { 
  margin: 0, 
  fontSize: isMobileUI ? '1.3rem' : '1.5rem', // 🚀 スマホ時は文字を少し小さくして改行を防ぐ
  fontWeight: '900', 
  color: '#1e293b',
  letterSpacing: '-0.02em'
};

const subtitleStyle = { 
  margin: '4px 0 0', 
  fontSize: '0.8rem', 
  color: '#64748b' 
};

const backBtnStyle = { 
  padding: '10px', 
  borderRadius: '12px', 
  background: '#fff', 
  border: '1px solid #e2e8f0', 
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  boxSizing: 'border-box'
};

const addBtnStyle = { 
  background: '#4f46e5', 
  color: '#fff', 
  border: 'none', 
  padding: isMobileUI ? '12px 8px' : '12px 20px', 
  borderRadius: '14px', 
  fontWeight: '900', 
  cursor: 'pointer', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  gap: '6px',
  fontSize: isMobileUI ? '0.78rem' : '0.9rem', // 🚀 ボタン文字を1画面にスッキリ収める
  flex: isMobileUI ? 1 : 'none', // 🚀 スマホ時は2つのボタンが50%ずつ均等に並ぶ
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  whiteSpace: 'nowrap'
};
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100%, 1fr))', gap: '20px' };
const cardStyle = { background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const cardHeaderStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' };
const facilityNameStyle = { margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' };
const idBadgeStyle = { background: '#f1f5f9', color: '#64748b', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' };
const pwBadgeStyle = { background: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' };
const iconBtnStyle = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#64748b' };
const ruleSectionStyle = { background: '#f8fafc', padding: '12px', borderRadius: '16px', marginBottom: '15px' };
const sectionLabelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' };
const ruleBadgeContainer = { display: 'flex', flexWrap: 'wrap', gap: '6px' };
const ruleBadgeStyle = { background: '#4f46e515', color: '#4f46e5', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' };
const infoGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' };
const infoItemStyle = { fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' };
const linkBtnStyle = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#1e293b', color: '#fff', padding: '12px', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' };

const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const modalContentStyle = { background: '#fff', width: '100%', maxWidth: '450px', maxHeight: '90vh', borderRadius: '28px', padding: '30px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const scrollAreaStyle = { flex: 1, overflowY: 'auto', paddingRight: '10px' };
const formGridStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const labelStyle = { fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'flex', flexDirection: 'column', gap: '5px' };
const inputStyle = { 
  width: '100%',            // 🚀 幅を親に合わせる
  boxSizing: 'border-box',  // 🚀 パディングを内側に含める（これで解決！）
  padding: '12px', 
  borderRadius: '12px', 
  border: '1px solid #cbd5e1', 
  outline: 'none' 
};
const ruleConfigBoxStyle = { background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' };
const tinyLabelStyle = { fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' };
const tileGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '5px' };
const tileBtnStyle = { padding: '8px 2px', fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' };
const ruleAddBtnStyle = { width: '100%', marginTop: '15px', padding: '12px', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const ruleListAreaStyle = { marginTop: '15px', display: 'flex', flexWrap: 'wrap', gap: '8px' };
const ruleBadgeItemStyle = { background: '#fff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' };
const modalFooterStyle = { display: 'flex', gap: '10px', marginTop: '25px' };
const cancelBtnStyle = { flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 'bold', color: '#64748b', cursor: 'pointer' };
const saveBtnStyle = { flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: '#1e293b', color: '#fff', fontWeight: 'bold', cursor: 'pointer' };
const formContainerStyle = { display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const inviteBoxStyle = { marginTop: '15px', padding: '12px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '15px' };
const inviteLabelStyle = { fontSize: '0.7rem', fontWeight: 'bold', color: '#0369a1', marginBottom: '5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' };
const inviteInputGroupStyle = { display: 'flex', gap: '8px' };
const inviteInputStyle = { flex: 1, fontSize: '0.7rem', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', color: '#64748b', outline: 'none' };
const copyBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', background: '#0369a1', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' };
// 🆕 追加：リストが空の時のスタイル
const emptyCardStyle = { 
  gridColumn: '1/-1', 
  textAlign: 'center', 
  padding: '60px', 
  background: '#fff', 
  borderRadius: '24px', 
  color: '#cbd5e1', 
  fontSize: '0.9rem', 
  border: '2px dashed #f1f5f9' 
};

// 🆕 追加：セクションの見出しスタイル
const sectionTitleStyle = { 
  fontSize: '0.9rem', 
  fontWeight: 'bold', 
  color: '#64748b', 
  marginBottom: '15px', 
  display: 'flex', 
  alignItems: 'center', 
  gap: '8px' 
};

const iconBoxStyle = (color) => ({ 
  width: '64px', height: '64px', borderRadius: '20px', 
  background: `${color}10`, color: color, 
  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' 
});

const switchStyle = { 
  position: 'relative', 
  display: 'inline-block', 
  width: '46px', 
  height: '24px' 
};

// 🆕 追加：スイッチの中のつまみのスタイル
const sliderStyle = { 
  position: 'absolute', 
  cursor: 'pointer', 
  top: 0, 
  left: 0, 
  right: 0, 
  bottom: 0, 
  transition: '.3s', 
  borderRadius: '24px' 
};
// 💡 🚀 🆕 「公開中」の行がスマホで崩れないように調整
const settingRow = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  background: '#f8fafc', 
  padding: '15px', 
  borderRadius: '15px', 
  border: '1px solid #eef2ff',
  gap: '10px' // スマホで文字とボタンがぶつからない安全な隙間
};
const toggleBtnStyle = (active) => ({ padding: '8px 20px', borderRadius: '20px', border: 'none', fontWeight: '900', cursor: 'pointer', background: active ? '#10b981' : '#cbd5e1', color: '#fff', fontSize: '0.8rem', transition: '0.3s' });
const circleBtn = { 
  width: '44px', 
  height: '44px', 
  borderRadius: '50%', 
  border: '1px solid #cbd5e1', 
  background: '#fff', 
  cursor: 'pointer', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center',
  fontSize: '16px',
  transition: 'all 0.2s'
};

// 🚀 修正版：フリガナ（kana）を最優先して「あいうえお順」に並び替える
const renderWorkSheet = (facilityName, year, month, visitDates, appointments, allMembers, visitMap, shop) => {
  
  const sortByKana = (a, b) => {
    const objA = a.members || a;
    const objB = b.members || b;
    const valA = (objA.kana || objA.name || "").trim();
    const valB = (objB.kana || objB.name || "").trim();
    return valA.localeCompare(valB, 'ja');
  };

  const groupedAppointments = appointments.reduce((acc, a) => {
    const f = a.members?.floor ? a.members.floor.toString().replace(/F|ｆ/g, '') : '不明';
    if (!acc[f]) acc[f] = [];
    acc[f].push(a);
    return acc;
  }, {});
  Object.keys(groupedAppointments).forEach(f => groupedAppointments[f].sort(sortByKana));

  const appointedMemberIds = appointments.map(a => a.members?.id).filter(id => !!id);
  const spareMembers = allMembers.filter(m => !appointedMemberIds.includes(m.id));
  const groupedSpareMembers = spareMembers.reduce((acc, m) => {
    const f = m.floor ? m.floor.toString().replace(/F|ｆ/g, '') : '不明';
    if (!acc[f]) acc[f] = [];
    acc[f].push(m);
    return acc;
  }, {});
  Object.keys(groupedSpareMembers).forEach(f => groupedSpareMembers[f].sort(sortByKana));

  return `
    <html>
      <head>
        <title>施術指示書_${facilityName}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          body { font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif; font-size: 10pt; color: #000; line-height: 1.2; margin: 0; }
          
          .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; }
          .title { font-size: 17pt; font-weight: 600; margin: 0; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; table-layout: fixed; }
          
          /* 🚀 見出し行（一番上）：高さとサイズを固定 */
          th { 
            border: 1px solid #000; 
            background: #f0f0f0; 
            font-size: 8.5pt !important; 
            height: 20px !important; 
            padding: 2px; 
            text-align: center; 
            font-weight: 600;
            vertical-align: middle;
          }
          
          /* 🚀 データ行（中身）：高さを 55px に広げてゆとりを確保 */
          td { 
            border: 1px solid #000; 
            padding: 4px 8px; 
            height: 45px !important;    /* 👈 ここを広げたので、デカい文字も収まります */
            word-wrap: break-word; 
            vertical-align: middle;      /* 👈 上下中央に配置 */
          }
          
          /* --- 🏁 チェックボックス列（連動解除済） --- */
          .col-chk { width: 50px; }
          th.col-chk { font-size: 8pt !important; }
          td.col-chk { 
            font-size: 30pt !important;  /* 👈 ▢のサイズ */
            text-align: center; 
            font-weight: 100; 
            padding: 0 !important;
            line-height: 1;
            /* 💡 ここで微調整（少しだけ上に持ち上げてセンターに見せる） */
            display: table-cell;
            vertical-align: middle;
            transform: translateY(-4.5px); 
          }

          /* --- 👤 お名前列（連動解除済） --- */
          .col-name { width: 180px; }    /* 👈 名前が入り切るように幅を少し広げました */
          th.col-name { font-size: 8.5pt !important; }
          td.col-name { 
            font-size: 14pt !important;  /* 👈 お客様の名前のサイズ */
            font-weight: 500;
            line-height: 1.1;
          }

          /* --- その他 --- */
          .col-room { width: 60px; text-align: center; }
          .col-menu { width: auto; font-weight: 500; font-size: 10.5pt; }
          .col-last { width: 65px; text-align: center; font-size: 9.5pt; color: #333; }
          
          .section-title { background: #000; color: #fff; padding: 4px 12px; font-weight: 600; margin-bottom: 10px; border-radius: 4px; font-size: 11pt; }
          .page-break { page-break-before: always; }
          .floor-label { font-weight: 600; margin-bottom: 5px; font-size: 11pt; border-left: 6px solid #000; padding-left: 10px; color: #000; }
          .visit-dates { font-size: 10.5pt; margin-top: 5px; font-weight: 600; }
          .footer-note { font-size: 8pt; color: #666; text-align: right; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <p style="margin:0; font-size:9pt; font-weight:600;">${shop.business_name}</p>
            <h1 class="title">${month}月度 施設訪問 施術指示書</h1>
            <div class="visit-dates">
              訪問予定日：${visitDates.join(' ・ ')}
            </div>
          </div>
          <div style="text-align:right; font-size:8pt;">
            <p style="margin:0;">訪問先：<b>${facilityName} 様</b></p>
            <p style="margin:0;">印刷日：${new Date().toLocaleDateString('ja-JP')}</p>
          </div>
        </div>

        <div class="section-title">1. 予約リスト（${appointments.length}名）</div>
        ${Object.keys(groupedAppointments).sort().map(floor => `
          <div class="floor-label">${floor}F</div>
          <table>
            <thead>
              <tr><th class="col-chk">予約</th><th class="col-room">部屋</th><th class="col-name">お名前</th><th class="col-menu">メニュー・現場メモ</th><th class="col-last">前回</th></tr>
            </thead>
            <tbody>
              ${groupedAppointments[floor].map(a => `
                <tr>
                  <td class="col-chk">□</td>
                  <td class="col-room">${a.members?.room || '-'}</td>
                  <td class="col-name">${a.members?.name} 様</td>
                  <td class="col-menu">${a.menu_name}</td>
                  <td class="col-last">${visitMap[a.members?.id] || 'ー'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `).join('')}

        <div class="footer-note">1/2ページ</div>

        <div class="page-break section-title">2. 予備名簿（当日追加用）</div>
        ${Object.keys(groupedSpareMembers).sort().map(floor => `
          <div class="floor-label">${floor}F</div>
          <table>
            <thead>
              <tr><th class="col-chk">追加</th><th class="col-room">部屋</th><th class="col-name">お名前</th><th class="col-menu">当日メニュー・メモ</th><th class="col-last">前回</th></tr>
            </thead>
            <tbody>
              ${groupedSpareMembers[floor].map(m => `
                <tr>
                  <td class="col-chk">□</td>
                  <td class="col-room">${m.room || '-'}</td>
                  <td class="col-name">${m.name} 様</td>
                  <td class="col-menu"></td>
                  <td class="col-last">${visitMap[m.id] || 'ー'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `).join('')}
        
        <div class="footer-note">2/2ページ | SnipSnap 施設訪問管理システム</div>
        <script>window.onload = function() { window.print(); window.close(); };</script>
      </body>
    </html>
  `;
};

export default FacilityManagement;