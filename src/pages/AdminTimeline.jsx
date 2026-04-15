import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ChevronLeft, ChevronRight, Users, Calendar as CalendarIcon, 
  X, Clipboard, User, FileText, History, CheckCircle, Trash2 
} from 'lucide-react';

// 🆕 予約者名から固有のパステルカラーを生成するロジック
const getCustomerColor = (name) => {
  if (!name || name === '定休日' || name === '臨時休業') return { bg: '#f1f5f9', border: '#cbd5e1', line: '#94a3b8', text: '#64748b' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return {
    bg: `hsl(${h}, 85%, 94%)`,
    border: `hsl(${h}, 60%, 80%)`,
    line: `hsl(${h}, 60%, 60%)`,
    text: `hsl(${h}, 70%, 25%)`
// --- [30行目付近] ---
  };
};

// 🚀 🆕 追加：予約メニューから合計金額を計算するロジック（AdminReservationsから移植）
const parseReservationDetails = (res) => {
  if (!res) return { menuName: '', totalPrice: 0 };
  const opt = typeof res.options === 'string' ? JSON.parse(res.options) : (res.options || {});
  let items = [];
  let subItems = [];

  if (opt.people && Array.isArray(opt.people)) {
    items = opt.people.flatMap(p => p.services || []);
    subItems = opt.people.flatMap(p => Object.values(p.options || {}));
  } else {
    items = opt.services || [];
    subItems = Object.values(opt.options || {});
  }

  let basePrice = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const optPrice = subItems.reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);

  return { 
    totalPrice: basePrice + optPrice 
  };
};

// 🆕 追加：定休日かどうかを判定するヘルパー関数（エラー解決用）
const isShopHoliday = (shop, date) => {
  if (!shop?.business_hours?.regular_holidays) return false;
  const holidays = shop.business_hours.regular_holidays || {};
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayName = dayNames[date.getDay()];
  const dom = date.getDate();
  const nthWeek = Math.ceil(dom / 7);
  const tempDate = new Date(date);
  const currentMonth = tempDate.getMonth();
  const checkLast = new Date(date); checkLast.setDate(dom + 7);
  const isLastWeek = checkLast.getMonth() !== currentMonth;
  const checkSecondLast = new Date(date); checkSecondLast.setDate(dom + 14);
  const isSecondToLastWeek = (checkSecondLast.getMonth() !== currentMonth) && !isLastWeek;
  
  const isRegular = !!(holidays[`${nthWeek}-${dayName}`] || (isLastWeek && holidays[`L1-${dayName}`]) || (isSecondToLastWeek && holidays[`L2-${dayName}`]));
  if (isRegular) return true;

  if (shop.special_holidays && Array.isArray(shop.special_holidays)) {
    const dStr = date.toLocaleDateString('sv-SE');
    const isSpecial = shop.special_holidays.some(h => dStr >= h.start && dStr <= h.end);
    if (isSpecial) return true;
  }
  return false;
};

function AdminTimeline() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  // --- 状態管理 ---
  const [shop, setShop] = useState(null);
  const [staffs, setStaffs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [categoryMap, setCategoryMap] = useState({});
  
// モーダル・操作用
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [targetTime, setTargetTime] = useState('');
  const [targetStaffId, setTargetStaffId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRes, setSelectedRes] = useState(null);

  // 🆕 重複予約リスト用
  const [showSlotListModal, setShowSlotListModal] = useState(false);
  const [selectedSlotReservations, setSelectedSlotReservations] = useState([]);

  // ✅ 🆕 追加：プライベート予定用のState
  const [privateTasks, setPrivateTasks] = useState([]);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [privateTaskFields, setPrivateTaskFields] = useState({ title: '', note: '' });

  // 👤 顧客詳細用（ここがコメントアウトされていました）
const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [customerHistory, setCustomerHistory] = useState([]);
// ✅ 🆕 修正：カレンダー版と同じフル項目セットに拡張
  const [editFields, setEditFields] = useState({ 
    name: '', 
    admin_name: '', 
    furigana: '', phone: '', email: '', 
    address: '', parking: '', symptoms: '', request_details: '', 
    memo: '', line_user_id: null 
  });

  // ✅ 🆕 追加：カレンダー版からコピーしたヘルパー関数
  const shouldShowInAdmin = (key) => {
    // 1. 基本の4項目は常に表示
    const basicFields = ['name', 'furigana', 'email', 'phone'];
    if (basicFields.includes(key)) return true;
    // 2. それ以外は「必須」設定の場合のみ表示
    const cfg = shop?.form_config?.[key];
    return cfg?.required === true;
  };

  const getFieldLabel = (key) => shop?.form_config?.[key]?.label || key;
    
  // 🆕 名寄せ（マージ）確認用
  const [mergeCandidate, setMergeCandidate] = useState(null); 
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  // ドラッグスクロール用
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
// --- [100行目付近] ---
  const [hasMoved, setHasMoved] = useState(false);

  // ✅ 🆕 追加：この変数が抜けていたためエラーが出ていました
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 1024; 

  useEffect(() => { fetchData(); }, [shopId, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    // 1. 店舗プロフィール取得
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (profile) setShop(profile);

    // 🚀 🆕 追加：カテゴリと専用屋号のリストを取得してマップを作る
    const { data: catData } = await supabase
      .from('service_categories')
      .select('name, url_key, custom_shop_name')
      .eq('shop_id', shopId);
    
    const shopNameMap = {};
    catData?.forEach(c => {
      if (c.url_key) shopNameMap[c.url_key] = c.custom_shop_name || c.name;
    });
    setCategoryMap(shopNameMap);

    // 2. スタッフ一覧取得
    const { data: staffsData } = await supabase
      .from('staffs')
      .select('*')
      .eq('shop_id', shopId)
      .order('sort_order', { ascending: true });
    setStaffs(staffsData || []);

// 3. 予約データ取得（担当者名結合）
    const { data: resData } = await supabase
      .from('reservations')
      .select('*, staffs(name), customers(*)')
      .eq('shop_id', shopId)
      .gte('start_time', `${selectedDate}T00:00:00`)
      .lte('start_time', `${selectedDate}T23:59:59`);

    // ✅ 🆕 追加：4. プライベート予定の取得
    const { data: privData } = await supabase
      .from('private_tasks')
      .select('*')
      .eq('shop_id', shopId)
      .gte('start_time', `${selectedDate}T00:00:00`)
      .lte('start_time', `${selectedDate}T23:59:59`);

    setReservations(resData || []);
    setPrivateTasks(privData || []); // ✅ セット
    setLoading(false);
  };

// 🆕 1. スカウター発動：予約をタップした瞬間に重複を検知
const openDetail = async (res) => {
  setSelectedRes(res);
  setTargetStaffId(res.staff_id);

  // ✅ 🆕 修正：最初にあらかじめ cust を定義しておく
  let cust = null;

  if (res.res_type === 'private_task') {
    finalizeOpenDetail(res, null);
    return;
  }

  if (res.customer_id) {
    const { data: matched } = await supabase.from('customers').select('*').eq('id', res.customer_id).maybeSingle();
    cust = matched;
  }
  
  // 以降、電話番号等での検索ロジックへ続く...

  // もしIDでヒットしなかった場合のみ、既存のスカウター（電話・メール検索）を回す
  if (!cust) {
    const orConditions = [];
    if (res.customer_phone && res.customer_phone !== '---') orConditions.push(`phone.eq.${res.customer_phone}`);
    if (res.customer_email) orConditions.push(`email.eq.${res.customer_email}`);

    if (orConditions.length > 0) {
      const { data: matched } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .or(orConditions.join(','))
        .maybeSingle();
      cust = matched;
    }
  }

  // 判定：連絡先は一致するが、紐付いているIDが違う（名寄せが必要）
  if (cust && cust.id !== res.customer_id) {
    // ...以下、マージ確認ロジックへ
      setMergeCandidate(cust); 
      setShowMergeConfirm(true); 
      return; 
    }

    // 重複がない、または既に統合済みならそのまま表示へ
    finalizeOpenDetail(res, cust);
  };

  // 🆕 2. 統合実行：三土手さんが選んだ名前でマスタを確定
  const handleMergeAction = async (masterId, finalName) => {
    try {
      // 予約データの紐付け更新
      await supabase.from('reservations').update({ 
        customer_id: masterId,
        customer_name: finalName 
      }).eq('id', selectedRes.id);

      // マスタ側の名前も確定
      await supabase.from('customers').update({ 
        name: finalName,
        updated_at: new Date().toISOString()
      }).eq('id', masterId);

      setShowMergeConfirm(false);
      fetchData(); // 画面リロード
      finalizeOpenDetail(selectedRes, { ...mergeCandidate, name: finalName }); 
    } catch (err) {
      alert("統合に失敗しました");
    }
  };

const finalizeOpenDetail = async (res, cust) => {
    // 💡 1. プライベート予定（休憩など）の場合は専用の処理
    if (res.res_type === 'private_task') {
      setSelectedCustomer(null);
      setEditFields({ 
        name: res.title, admin_name: '', phone: '', email: '', 
        memo: res.note || '', line_user_id: null, custom_answers: {} 
      });
      setCustomerHistory([]); setShowDetailModal(true); return;
    }

    // 💡 2. 予約データ(res)の options カラムから詳細情報を引っ張り出す
    const visitInfo = res.options?.visit_info || {};

    // 🆕 3. 修正の核心：全ての項目 ＆ カスタム質問を State (editFields) にまとめる
    // 名簿データ(cust)を優先しつつ、予約時データ(visitInfo/res)で補完します
    const allFields = {
      name: cust ? (cust.admin_name || cust.name || res.customer_name) : res.customer_name,
      admin_name: cust?.admin_name || '',
      furigana: cust?.furigana || visitInfo.furigana || '',
      phone: cust?.phone || res.customer_phone || '',
      email: cust?.email || res.customer_email || '',
      zip_code: cust?.zip_code || visitInfo.zip_code || '', // 👈 郵便番号を追加
      address: cust?.address || visitInfo.address || '', 
      parking: cust?.parking || visitInfo.parking || '', 
      building_type: cust?.building_type || visitInfo.building_type || '', // 👈 建物種別を追加
      care_notes: cust?.care_notes || visitInfo.care_notes || '',           // 👈 介助状況を追加
      company_name: cust?.company_name || visitInfo.company_name || '',     // 👈 会社名を追加
      symptoms: cust?.symptoms || visitInfo.symptoms || '', 
      request_details: cust?.request_details || visitInfo.request_details || '', 
      memo: cust?.memo || '',
      line_user_id: cust?.line_user_id || res.line_user_id || null,
      // 💡 最重要：カスタム質問の回答をセット
      custom_answers: visitInfo.custom_answers || cust?.custom_answers || {}
    };

    // 💡 4. 作成した allFields を State に反映
    if (cust) {
      setSelectedCustomer(cust);
      setEditFields(allFields);
    } else {
      setSelectedCustomer(null);
      setEditFields(allFields);
    }

    const { data: history } = await supabase
      .from('reservations')
      .select('*')
      .eq('shop_id', shopId)
      .eq('res_type', 'normal')
      .or(`customer_name.eq."${res.customer_name}"${cust?.id ? `,customer_id.eq.${cust.id}` : ''}`)
      .order('start_time', { ascending: false });

    setCustomerHistory(history || []);
    setShowDetailModal(true);
    };

  // --- 顧客情報の更新 ---
const handleUpdateCustomer = async () => {
    try {
      const normalizedName = editFields.name.replace(/　/g, ' ').trim();
      if (!normalizedName) {
        alert("名前を入力してください。");
        return;
      }

      // ✅ 🆕 追加：ブロック枠(blocked) または プライベート予定(private_task) の場合
      if (selectedRes?.res_type === 'private_task' || selectedRes?.res_type === 'blocked') {
      const isPrivate = selectedRes.res_type === 'private_task';
      const targetTable = isPrivate ? 'private_tasks' : 'reservations';
      
      const updateData = isPrivate 
        ? { title: normalizedName, note: editFields.memo } 
        : { customer_name: normalizedName };

      await supabase.from(targetTable).update(updateData).eq('id', selectedRes.id);
      showMsg('内容を更新しました！');
      setShowDetailModal(false); fetchData(); return;
    }

    let targetCustomerId = selectedCustomer?.id;

    // 🔍 ステップ2：顧客情報の準備
    const customerPayload = {
      shop_id: shopId,
      name: normalizedName,
      admin_name: editFields.admin_name || normalizedName,
      phone: editFields.phone || null,
      email: editFields.email || null,
      memo: editFields.memo || null, // 👈 メモはここに集約！
      line_user_id: editFields.line_user_id || null,
      updated_at: new Date().toISOString()
    };

    if (targetCustomerId) customerPayload.id = targetCustomerId;

    // 🔍 ステップ3：顧客マスタ（customers）を更新
    const { data: savedCust, error: custError } = await supabase
      .from('customers')
      .upsert(customerPayload, { onConflict: 'id' })
      .select()
      .single();
    
    if (custError) throw custError;
    targetCustomerId = savedCust.id;

    // 🔍 ステップ4：予約データ（reservations）を更新してガッチリ紐付け
    const { error: resError } = await supabase
      .from('reservations')
      .update({ 
        customer_name: normalizedName,
        customer_phone: editFields.phone,
        customer_id: targetCustomerId, // 👈 IDを紐付ける
        staff_id: selectedRes.staff_id,
        memo: null // 👈 予約側のメモは一本化のため空にする
      })
      .eq('id', selectedRes.id);

    if (resError) throw resError;

// --- [196行目付近] ---
    alert('情報を名簿に保存し、予約と紐付けました！✨');
    setShowDetailModal(false);
    fetchData();
  } catch (err) {
    alert('更新に失敗しました: ' + err.message);
  }
};

// ✅ 🆕 追加：プライベート予定(private_tasksテーブル)をスタッフ毎に保存する関数
const handleSavePrivateTask = async () => {
  if (!privateTaskFields.title) {
    alert("予定の内容を入力してください。");
    return;
  }

  try {
    const start = new Date(`${selectedDate}T${targetTime}:00`);
    const intervalMin = shop?.slot_interval_min || 15;
    const end = new Date(start.getTime() + intervalMin * 60000);

    const { error } = await supabase.from('private_tasks').insert([{
      shop_id: shopId,
      staff_id: targetStaffId, // 💡 タイムラインで選択した「スタッフID」を正確に紐付け
      title: privateTaskFields.title,
      note: privateTaskFields.note,
      start_time: start.toISOString(),
      end_time: end.toISOString()
    }]);

    if (error) throw error;

    // 保存が成功したらモーダルを閉じて入力をリセット
    setShowPrivateModal(false);
    setPrivateTaskFields({ title: '', note: '' });
    fetchData(); // 画面を再読み込み
  } catch (err) {
    console.error("保存エラー:", err.message);
    alert("プライベート予定の保存に失敗しました。");
  }
};

// 🚀 🆕 ここにキャンセル関数を差し込みます
  const cancelRes = async (id) => {
    if (!window.confirm("この予約を「キャンセル扱い」にして記録に残しますか？\n（予約枠は空きます）")) return;

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'canceled' })
        .eq('id', id);

      if (error) throw error;

      // 🚀 🆕 追加：顧客マスタのキャンセル回数を +1 する
      if (selectedRes?.customer_id) {
        const { data: cust } = await supabase.from('customers').select('cancel_count').eq('id', selectedRes.customer_id).single();
        await supabase.from('customers').update({ cancel_count: (cust?.cancel_count || 0) + 1 }).eq('id', selectedRes.customer_id);
      }
      
      setShowDetailModal(false);
      fetchData(); // 🔄 画面を最新にする
      alert("キャンセルとして記録しました"); 
    } catch (err) {
      alert("エラー: " + err.message);
    }
  };
  
  // --- 予約の削除 ---
  const deleteRes = async (id) => {
    const isPrivate = selectedRes?.res_type === 'private_task';
    const msg = isPrivate ? 'このプライベート予定を削除しますか？' : 'この予約データを消去して予約を「可能」に戻しますか？';
    
    if (window.confirm(msg)) {
      // ✅ 🆕 修正：ここも reservations 固定ではなく targetTable を使う
      const targetTable = isPrivate ? 'private_tasks' : 'reservations';
      const { error } = await supabase.from(targetTable).delete().eq('id', id);
      
      if (error) {
        alert('削除失敗: ' + error.message);
      } else {
        setShowDetailModal(false); 
        fetchData();
      }
    }
  };

  // --- 臨時休業（ブロック）の設定 ---
  const handleBlockTime = async () => {
    const reason = window.prompt("予定名（例：打ち合わせ、忘年会）を入力してください", "管理者ブロック");
    if (reason === null) return; 

    const start = new Date(`${selectedDate}T${targetTime}:00`);
    const intervalMin = shop?.slot_interval_min || 15;
    const end = new Date(start.getTime() + intervalMin * 60000);
    
    const insertData = {
      shop_id: shopId, 
      customer_name: reason, 
      res_type: 'blocked',
      is_block: true, // 🚀 🆕 「これは売上ではない」という目印を追加！
      staff_id: targetStaffId, 
      start_time: start.toISOString(), 
      end_time: end.toISOString(),
      total_slots: 1, 
      customer_email: null, 
      customer_phone: '---', 
      options: { type: 'admin_block' }
    };
    
    await supabase.from('reservations').insert([insertData]);
    setShowMenuModal(false); fetchData();
  };

  const handleBlockFullDay = async () => {
    const staffName = staffs.find(s => s.id === targetStaffId)?.name || 'フリー枠';
    if (!window.confirm(`${staffName} の ${selectedDate.replace(/-/g, '/')} を終日「予約不可」にしますか？`)) return;
    
    const intervalMin = shop?.slot_interval_min || 15;
    // 09:00 - 21:00 をブロック（適宜店舗時間に合わせる）
    const start = new Date(`${selectedDate}T09:00:00`);
    const end = new Date(`${selectedDate}T21:00:00`);
    const slotsCount = Math.ceil((end - start) / (intervalMin * 60000));

    const insertData = {
      shop_id: shopId, 
      customer_name: '臨時休業', 
      res_type: 'blocked',
      is_block: true, // 🚀 🆕 「これは売上ではない」という目印を追加！
      staff_id: targetStaffId, 
      start_time: start.toISOString(), 
      end_time: end.toISOString(),
      total_slots: slotsCount, 
      customer_email: null, 
      customer_phone: '---',
      options: { isFullDay: true }
    };
    await supabase.from('reservations').insert([insertData]);
    setShowMenuModal(false); fetchData();
  };

  // --- ドラッグ＆クリック制御 ---
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; 
    setIsDragging(true); setHasMoved(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) setHasMoved(true);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };
const handleCellClick = (slotMatches, time, staffId) => {
  if (hasMoved) return;
  setTargetTime(time);
  const actualStaffId = staffId === 'free' ? null : staffId;
  setTargetStaffId(actualStaffId); 

  // 💡 1. DBに記録があるもの（予約、プライベート予定、ブロック）を探す
  // 判定条件に 'blocked' を追加します
  const dbRecords = slotMatches.filter(r => r.id && (r.res_type === 'normal' || r.res_type === 'private_task' || r.res_type === 'blocked'));
  const activeTask = dbRecords[0];

  // 💡 2. すでに予定（ブロック含む）がある場合は詳細を開く
  if (activeTask) {
    if (dbRecords.length > 1) {
      setSelectedSlotReservations(dbRecords); setShowSlotListModal(true);
    } else {
      openDetail(activeTask);
    }
    return;
  }

  // 💡 3. 本当に何もない空き枠、またはシステム上の定休日
  const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(selectedDate).getDay()];
  const hours = shop?.business_hours?.[dayName];
  const isStandardTime = hours && !hours.is_closed && time >= hours.open && time < hours.close;
  
  // ✅ 🆕 修正：統合した休日判定関数を使うように変更
  const isHoliday = isShopHoliday(shop, new Date(selectedDate));
  const isBlocked = dbRecords.some(r => r.res_type === 'blocked');

  if (isStandardTime && !isHoliday && !isBlocked) {
    setShowMenuModal(true); 
  } else {
    setPrivateTaskFields({ title: '', note: '' });
    setShowPrivateModal(true); // 営業時間外・定休日はプライベート予定
  }
};
// --- 修正後：動的に時間軸を計算するコード ---
const timeSlots = useMemo(() => {
  if (!shop?.business_hours) return [];
  
  let minTotalMinutes = 24 * 60;
  let maxTotalMinutes = 0;
  let hasOpenDay = false;

  // 全曜日の設定から最小・最大時間を特定
  Object.values(shop.business_hours).forEach(h => {
    if (typeof h === 'object' && !h.is_closed && h.open && h.close) {
      hasOpenDay = true;
      const [openH, openM] = h.open.split(':').map(Number);
      const [closeH, closeM] = h.close.split(':').map(Number);
      if (openH * 60 + openM < minTotalMinutes) minTotalMinutes = openH * 60 + openM;
      if (closeH * 60 + closeM > maxTotalMinutes) maxTotalMinutes = closeH * 60 + closeM;
    }
  });

  if (!hasOpenDay) { minTotalMinutes = 9 * 60; maxTotalMinutes = 18 * 60; }

  const interval = shop.slot_interval_min || 15;
  const extraBefore = shop.extra_slots_before || 0; // 💡 表示拡張
  const extraAfter = shop.extra_slots_after || 0;   // 💡 表示拡張

  const finalStart = minTotalMinutes - (extraBefore * interval);
  const finalEnd = maxTotalMinutes + (extraAfter * interval);

  const slots = [];
  for (let m = finalStart; m <= finalEnd; m += interval) {
    const h = Math.floor(m / 60); const mm = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return slots;
}, [shop]);

  // ✅ 🆕 【Step B：自動スクロール実行ロジック】ここから差し込み
  useEffect(() => {
    if (!loading && timeSlots.length > 0 && scrollRef.current) {
      const now = new Date();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // 今の時間帯がタイムラインのどこにあるか探す
      const targetIdx = timeSlots.findIndex(slot => slot >= currentTimeStr);
      
      if (targetIdx !== -1) {
        const columnWidth = 120; // <td> で設定している minWidth
        // 今の時間が左端に来るようにスクロール（1列分だけ余裕を持たせる）
        const scrollOffset = Math.max(0, (targetIdx - 1) * columnWidth);
        
        scrollRef.current.scrollLeft = scrollOffset;
      }
    }
  }, [loading, timeSlots]);
  // ✅ 🆕 差し込みここまで
  
  const themeColor = shop?.theme_color || '#4b2c85';

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>読み込み中...</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      
      {/* ヘッダー */}
      <div style={{ padding: '8px 15px', borderBottom: '2px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', zIndex: 1000 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h1 style={{ fontSize: '1rem', fontWeight: '900', margin: 0, color: themeColor }}>Timeline</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
  <button onClick={() => navigate(`/admin/${shopId}/reservations`)} style={switchBtnStyle(false)}>カレンダー</button>
  <button style={switchBtnStyle(true)}>タイムライン</button>
</div>

{/* ✅ 🆕 追加：現場での実行用「今日のタスク」ボタン */}
<button 
  onClick={() => navigate(`/admin/${shopId}/today-tasks`)}
  style={{
    padding: '6px 15px',
    background: '#1e293b', // カレンダー/タイムラインと差別化
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginLeft: '10px'
  }}
>
  ⚡ 本日のタスク (実行)
</button>

{/* 📊 顧客・売上管理ボタン（既存） */}
<button 
  onClick={() => shop?.is_management_enabled && navigate(`/admin/${shopId}/management`)}
  style={{
    padding: '6px 15px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: shop?.is_management_enabled ? '#fff' : '#f1f5f9',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    cursor: shop?.is_management_enabled ? 'pointer' : 'not-allowed',
    color: shop?.is_management_enabled ? '#008000' : '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    transition: 'all 0.2s',
    marginLeft: '10px' // ボタン間の隙間
  }}
>
  {shop?.is_management_enabled ? '📊 顧客・売上管理' : '🔒 売上管理'}
</button>
        </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '5px' }}>
            <CalendarIcon size={22} color={themeColor} />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
          </div>
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toLocaleDateString('sv-SE')); }} style={navBtnStyle}><ChevronLeft size={18} /></button>
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toLocaleDateString('sv-SE')); }} style={navBtnStyle}><ChevronRight size={18} /></button>
          <button onClick={() => setSelectedDate(new Date().toLocaleDateString('sv-SE'))} style={{ ...navBtnStyle, background: themeColor, color: '#fff', fontSize: '0.8rem', padding: '6px 15px' }}>今日</button>
        </div>
      </div>

      {/* タイムライン本体 */}
      <div ref={scrollRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)} style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#fff', cursor: isDragging ? 'grabbing' : 'default', userSelect: 'none' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
            <tr>
              <th style={{ position: 'sticky', left: 0, zIndex: 110, background: '#e2e8f0', padding: '10px', borderRight: '3px solid #94a3b8', borderBottom: '3px solid #94a3b8', width: '140px', color: '#475569', fontSize: '0.75rem' }}>スタッフ</th>
              {timeSlots.map(time => (
                <th key={time} style={{ padding: '8px 4px', minWidth: '70px', borderRight: '1px solid #cbd5e1', borderBottom: '3px solid #94a3b8', color: '#1e293b', fontSize: '0.75rem', background: '#e2e8f0', textAlign: 'center' }}>{time}</th>
              ))}
            </tr>
          </thead>
<tbody>
  {[...staffs, { id: 'free', name: '担当なし' }].map((staff, idx) => (
    <tr key={staff.id} style={{ height: '80px', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
      <td style={{ 
        position: 'sticky', left: 0, zIndex: 90, background: idx % 2 === 0 ? '#fff' : '#f8fafc', 
        padding: '8px', borderRight: '3px solid #94a3b8', borderBottom: '1px solid #cbd5e1', fontWeight: 'bold' 
      }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} color={staff.id === 'free' ? '#94a3b8' : themeColor} /><span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{staff.name}</span></div></td>{/* 👈 閉じタグの直後に中括弧を繋げる */}
{timeSlots.map(time => {
        const currentSlotStart = new Date(`${selectedDate}T${time}:00`).getTime();
        const staffIdVal = staff.id === 'free' ? null : staff.id;
        
        // 1. この枠に重なっている全予約を取得
        // 1. お客様の予約・ブロック
        const resMatches = reservations.filter(r => (r.staff_id === staffIdVal) && currentSlotStart >= new Date(r.start_time).getTime() && currentSlotStart < new Date(r.end_time).getTime());
        
        // 2. 🆕 プライベート予定
        const privMatches = privateTasks.filter(p => (p.staff_id === staffIdVal) && currentSlotStart >= new Date(p.start_time).getTime() && currentSlotStart < new Date(p.end_time).getTime())
          .map(p => ({ ...p, res_type: 'private_task', customer_name: p.title }));

        const matches = [...resMatches, ...privMatches];
        const hasRes = matches.length > 0;

        // ✅ 🆕 修正：toLocaleTimeString をやめて、数値(getTime)で厳密に判定
        const startingHere = matches.filter(r => 
          new Date(r.start_time).getTime() === currentSlotStart
        );
        const isStart = startingHere.length > 0;

        const isMultiple = matches.length > 1;
        const firstRes = matches[0];
        const intervalMin = shop?.slot_interval_min || 15;
        const isEnd = hasRes && matches.some(r => new Date(r.end_time).getTime() === (currentSlotStart + intervalMin * 60000));
        const colors = getCustomerColor(firstRes?.customer_name);

        return (
          <td key={time} onClick={() => handleCellClick(matches, time, staffIdVal)} style={{ minWidth: '120px', borderRight: '1.5px solid #cbd5e1', borderBottom: '1.5px solid #cbd5e1', position: 'relative', background: '#fff', padding: 0, cursor: 'pointer' }}>
            {hasRes && (
              <div style={{ position: 'absolute', inset: '6px 0', background: isMultiple ? '#e0e7ff' : colors.bg, borderTop: `1.5px solid ${isMultiple ? themeColor : colors.border}`, borderBottom: `1.5px solid ${isMultiple ? themeColor : colors.border}`, borderLeft: isStart ? `1.5px solid ${isMultiple ? themeColor : colors.border}` : 'none', borderRight: isEnd ? `1.5px solid ${isMultiple ? themeColor : colors.border}` : 'none', borderRadius: `${isStart ? '8px' : '0'} ${isEnd ? '8px' : '0'} ${isEnd ? '8px' : '0'} ${isStart ? '8px' : '0'}`, display: 'flex', alignItems: 'center', justifyContent: isStart ? 'flex-start' : 'center', padding: isStart ? '0 10px' : '0', zIndex: 5, overflow: 'hidden' }}>
                
                {isStart ? (
                  /* 🚀 🆕 修正：屋号バッジ ＋ 名前 のセット表示に強化 */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', width: '100%' }}>
                    
                    {/* 🆕 屋号バッジ（識別キーに対応する名前がある場合のみ表示） */}
                    {categoryMap[firstRes?.biz_type] && (
                      <span style={{ 
                        fontSize: '0.55rem', 
                        padding: '1px 4px', 
                        borderRadius: '3px',
                        // カレンダー側と色を合わせています（footは青、それ以外は朱色）
                        background: firstRes.biz_type === 'foot' ? '#4285f4' : '#d34817', 
                        color: '#fff', 
                        fontWeight: '900', 
                        whiteSpace: 'nowrap',
                        transform: 'scale(0.9)', // 少し小さくしてスッキリさせる
                        flexShrink: 0 // バッジが潰れないように固定
                      }}>
                        {categoryMap[firstRes.biz_type].slice(0, 4)}
                      </span>
                    )}

                    {/* 👤 予約者名の表示 */}
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: isMultiple ? themeColor : colors.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {(() => {
                        // この枠で開始する人が1人だけなら名前を優先
                        if (startingHere.length === 1) {
                          const res = startingHere[0];
                          const masterName = res.customers?.admin_name || res.customers?.name || res.customer_name;
                          const name = masterName?.split(/[\s　]+/)[0] || "名前なし";
                          
                          // 🚀 🆕 警告アイコン（🚫と‼️）を組み合せる
                          const blockedIcon = res.customers?.is_blocked ? '🚫' : '';
                          const cancelIcon = res.customers?.cancel_count >= 3 ? '‼️' : '';
                          const icons = `${blockedIcon}${cancelIcon}`;

                          return isMultiple 
                            ? `${name} (${matches.length}名)${icons}` 
                            : `${name} 様${icons}`;
                        }
                        // 同時に2人以上が開始する場合は人数を表示
                        return `👥 ${matches.length}名`;
                      })()}
                    </span>
                  </div>

                ) : (
                  /* 続きの枠は中央ライン（既存どおり） */
                  <div style={{ width: '100%', height: '3px', background: isMultiple ? themeColor : colors.line, opacity: 0.4 }} />
                )}
              </div>
            )}
          </td>
        );
      })}
          </tr>
  ))}
</tbody>
</table>
      </div>

      {/* 🆕 ここから追記：3択の名寄せ（マージ）確認モーダル */}
      {showMergeConfirm && (
        <div 
          style={{ ...overlayStyle, zIndex: 5000 }} 
          onClick={() => setShowMergeConfirm(false)}
        >
          <div 
            style={{ 
              ...modalContentStyle, maxWidth: '400px', textAlign: 'center', 
              padding: '35px', borderRadius: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' 
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>👤</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '900', marginBottom: '10px', color: '#1e293b' }}>
              同一人物の可能性があります
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6', marginBottom: '30px' }}>
              連絡先が一致するお客様が既に登録されています。<br/>
              <strong>「{mergeCandidate?.name}」</strong> 様として管理しますか？
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 選択肢A：店側の名前を守る */}
              <button 
                onClick={() => handleMergeAction(mergeCandidate.id, mergeCandidate.name)}
                style={{ 
                  padding: '18px', background: themeColor, color: '#fff', border: 'none', 
                  borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' 
                }}
              >
                👤 既存の「{mergeCandidate?.name}」様に統合
              </button>

              {/* 選択肢B：今回の名前を採用する */}
              <button 
                onClick={() => handleMergeAction(mergeCandidate.id, selectedRes.customer_name)}
                style={{ 
                  padding: '16px', background: '#fff', color: themeColor, 
                  border: `2px solid ${themeColor}`, borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer' 
                }}
              >
                🐹 今回の「{selectedRes?.customer_name}」様へ名前を更新
              </button>

              {/* 選択肢C：別人として扱う */}
              <button 
                onClick={() => {
                  setShowMergeConfirm(false);
                  finalizeOpenDetail(selectedRes, null); 
                }}
                style={{ padding: '12px', background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                🙅 同姓同名の別人として別名簿で管理
              </button>

              <button 
                onClick={() => setShowMergeConfirm(false)}
                style={{ marginTop: '10px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🆕 追記ここまで */}

      {/* 📅 モーダル1：管理メニュー (AdminReservations完全移植) */}
      {showMenuModal && (
        <div style={overlayStyle} onClick={() => setShowMenuModal(false)}>
          <div style={{ ...modalContentStyle, maxWidth: '340px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
            <p style={{ fontWeight: '900', color: themeColor, fontSize: '2.2rem', margin: '0 0 30px 0' }}>{targetTime}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
<button 
  onClick={() => navigate(`/shop/${shopId}/reserve`, { 
    state: { 
      adminDate: selectedDate, 
      adminTime: targetTime, 
      adminStaffId: targetStaffId, // ✅ どのスタッフの枠か
      fromView: 'timeline',        // ✅ 「タイムラインから来た」という目印
      isAdminMode: true 
    } 
  })} 
  style={{ padding: '22px', background: themeColor, color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer' }}
>
  予約を入れる
</button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={handleBlockTime} style={{ padding: '15px', background: '#fff', color: themeColor, border: `2px solid ${themeColor}22`, borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>「✕」または予定</button>
                <button onClick={handleBlockFullDay} style={{ padding: '15px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>今日を休みにする</button>
              </div>
              <button onClick={() => setShowMenuModal(false)} style={{ padding: '15px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

{/* 👤 モーダル2：予約詳細・名簿 (AdminReservationsから全機能を完全移植) */}
      {showDetailModal && (
        <div style={overlayStyle} onClick={() => { if(selectedRes?.isRegularHoliday) return; setShowDetailModal(false); }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '650px', position: 'relative' }}>
            
{selectedRes?.res_type === 'normal' && (
              <button 
                onClick={() => {
                  // 💡 1人営業ならその人のIDを、そうでなければクリックした枠の担当IDを渡す
                  const finalStaffId = staffs.length === 1 ? staffs[0].id : targetStaffId;
                  
                  navigate(`/shop/${shopId}/reserve`, { 
                    state: { 
                      adminDate: selectedDate, 
                      adminTime: targetTime, 
                      adminStaffId: finalStaffId, // ✅ ここを修正
                      fromView: 'timeline', 
                      isAdminMode: true 
                    } 
                  });
                }}
                style={{ width: '100%', padding: '16px', background: themeColor, color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: `0 4px 12px ${themeColor}44` }}
              >
                ➕ この時間にさらに予約を入れる（ねじ込み）
              </button>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedRes?.res_type === 'private_task' ? '🕒 プライベート予定' : '📅 予約詳細・名簿更新'}</h2>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {/* ============================================================
               🆕 ここから「出し分け命令（三項演算子）」の開始： { 条件 ? (
               ============================================================ */}
            {(selectedRes?.res_type === 'blocked' || selectedRes?.res_type === 'private_task') ? (
              
              /* 🚫 パターンA：管理用（ブロック枠・プライベート予定） */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                <div style={{ background: '#f8fafc', padding: '30px', borderRadius: '25px', border: `2px solid ${themeColor}22`, textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>
                    {selectedRes.res_type === 'private_task' ? '☕️' : '🚫'}
                  </div>
                  
                  <label style={labelStyle}>予定名・ブロック理由</label>
                  <input 
                    type="text" 
                    value={editFields.name} 
                    onChange={(e) => setEditFields({...editFields, name: e.target.value})} 
                    style={{ ...inputStyle, fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', borderRadius: '15px' }} 
                  />

                  {/* プライベート予定の時だけメモ欄を出す */}
                  {selectedRes.res_type === 'private_task' && (
                    <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                      <label style={labelStyle}>メモ・詳細</label>
                      <textarea 
                        value={editFields.memo} 
                        onChange={(e) => setEditFields({...editFields, memo: e.target.value})} 
                        style={{ ...inputStyle, height: '80px', fontSize: '0.9rem' }}
                      />
                    </div>
                  )}
                  
                  <button onClick={handleUpdateCustomer} style={{ width: '100%', padding: '18px', background: themeColor, color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', fontSize: '1.1rem', boxShadow: `0 8px 20px ${themeColor}44` }}>
                    情報を保存
                  </button>

                  <button onClick={() => deleteRes(selectedRes.id)} style={{ width: '100%', padding: '15px', background: '#fff', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {selectedRes.res_type === 'private_task' ? '🗑 予定を削除する' : '🔓 ブロック解除（予約可能に戻す）'}
                  </button>
                </div>
              </div>

            ) : (

              /* 👤 パターンB：接客用（通常のお客様予約） */
              <div style={{ display: 'grid', gridTemplateColumns: isPC ? '1fr 1fr' : '1fr', gap: '25px' }}>
                
                {/* 📝 左側：入力フォーム */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    
                    {/* 予約メニュー内訳 */}
                    <div style={{ background: `${themeColor}15`, padding: '16px', borderRadius: '15px', marginBottom: '15px', border: `1px solid ${themeColor}` }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '900', color: themeColor, display: 'block', marginBottom: '10px' }}>📋 予約メニュー内訳</label>
                      <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{selectedRes?.menu_name || 'メニュー未設定'}</div>
                    </div>

                    {staffs.length > 1 && (
                      <>
                        <label style={labelStyle}>担当スタッフの変更</label>
                        <select 
                          value={selectedRes?.staff_id || ''} 
                          onChange={(e) => setSelectedRes({...selectedRes, staff_id: e.target.value || null})} 
                          style={inputStyle}
                        >
                          <option value="">フリー（担当なし）</option>
                          {staffs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        // 三土手さん理想の順番
                        const fieldOrder = [
                          'name', 'furigana', 'email', 'phone', 
                          'zip_code', 'address', 'parking', 
                          'building_type', 'care_notes', 'company_name', 
                          'symptoms', 'request_details'
                        ];

                        return fieldOrder.map((key) => {
                          if (!shouldShowInAdmin(key)) return null;

                          return (
                            <div key={key}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <label style={{ ...labelStyle, marginBottom: 0 }}>{getFieldLabel(key)}</label>
                                
                                {key === 'phone' && editFields.phone && (
                                  <a href={`tel:${editFields.phone}`} style={badgeStyle('#10b981')}>電話 📞</a>
                                )}
                                {key === 'address' && editFields.address && (
  <a 
    /* 🚀 修正ポイント：公式のURL形式に直し、${ } で囲みました */
    href={`https://www.google.co.jp/maps/search/${encodeURIComponent(editFields.address)}`} 
    target="_blank" 
    rel="noopener noreferrer" 
    style={badgeStyle('#3b82f6')}
  >
    マップ 📍
  </a>
)}
                              </div>
                              
                              {key === 'parking' ? (
                                <select value={editFields[key] || ''} onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} style={inputStyle}>
                                  <option value="">未選択</option>
                                  <option value="あり">あり</option>
                                  <option value="なし">なし</option>
                                </select>
                              ) : (
                                <input type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={editFields[key] || ''} onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} style={inputStyle} placeholder="未登録" />
                              )}
                            </div>
                          );
                        });
                      })()}

                      {/* 🆕 カスタム質問の回答表示 */}
                      {shop?.form_config?.custom_questions?.map((q) => {
                        const answer = editFields.custom_answers?.[q.id];
                        if (q.required || answer) {
                          return (
                            <div key={q.id} style={{ background: '#fff', padding: '12px', borderRadius: '12px', border: q.required ? `2px solid ${themeColor}33` : '1px solid #e2e8f0', marginTop: '5px' }}>
                              <label style={{ ...labelStyle, color: q.required ? themeColor : '#64748b', marginBottom: '8px' }}>
                                🙋 {q.label} {q.required && <span style={{ color: '#ef4444' }}>(必須)</span>}
                              </label>
                              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {answer || <span style={{ color: '#cbd5e1', fontWeight: 'normal' }}>未回答</span>}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}

                      <div>
                        <label style={labelStyle}>顧客メモ（マスタ共通・内部用）</label>
                        <textarea value={editFields.memo} onChange={(e) => setEditFields({...editFields, memo: e.target.value})} style={{ ...inputStyle, height: '100px' }} placeholder="管理者用の控えメモです" />
                      </div>
                    </div>
                    
                    <button onClick={handleUpdateCustomer} style={{ width: '100%', padding: '12px', background: themeColor, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>情報を保存</button>

{/* 🚀 🆕 ここを2段構えに修正（キャンセルボタンを追加） */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
  <button 
  // 🚀 すでにキャンセル済みならボタンを無効化
  onClick={() => selectedRes?.status !== 'canceled' && cancelRes(selectedRes.id)} 
  disabled={selectedRes?.status === 'canceled'}
  style={{ 
    padding: '12px', 
    // 🚀 キャンセル済みなら灰色背景、そうでなければ白背景
    background: selectedRes?.status === 'canceled' ? '#f1f5f9' : '#fff', 
    // 🚀 キャンセル済みなら灰色文字、そうでなければオレンジ文字
    color: selectedRes?.status === 'canceled' ? '#94a3b8' : '#f59e0b', 
    border: `1px solid ${selectedRes?.status === 'canceled' ? '#e2e8f0' : '#f59e0b'}`, 
    borderRadius: '10px', 
    fontWeight: 'bold', 
    cursor: selectedRes?.status === 'canceled' ? 'default' : 'pointer', 
    fontSize: '0.8rem' 
  }}
>
  {selectedRes?.status === 'canceled' ? 'キャンセル済み' : 'キャンセル処理'}
</button>
  <button 
    onClick={() => deleteRes(selectedRes.id)} 
    style={{ padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}
  >
    消去 & 掃除
  </button>
</div>
                  </div>
                </div>

                {/* 🕒 右側：来店履歴 */}
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b' }}>🕒 来店履歴 ＆ 予定</h4>
                  <div style={{ height: isPC ? '420px' : '250px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '15px', background: '#f8fafc', padding: '5px' }}>
                    {customerHistory.map((h) => {
                      const hDate = new Date(h.start_time);
                      const isToday = hDate.toLocaleDateString('sv-SE') === new Date().toLocaleDateString('sv-SE');
                      const hBrandLabel = categoryMap[h.biz_type];
                      // 🚀 1. キャンセル判定
                      const isCanceled = h.status === 'canceled';

                      return (
                        <div key={h.id} style={{ 
                          padding: '15px', 
                          borderBottom: '1px solid #eee', 
                          background: isCanceled ? '#fcfcfc' : '#fff', 
                          borderRadius: isToday ? '12px' : '0', 
                          border: isToday ? `2px solid ${themeColor}` : 'none',
                          opacity: isCanceled ? 0.7 : 1 
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {/* 🚀 2. 日付に斜線を適用 */}
                              <span style={{ 
                                fontWeight: 'bold',
                                color: isCanceled ? '#94a3b8' : '#1e293b',
                                textDecoration: isCanceled ? 'line-through' : 'none' 
                              }}>
                                {hDate.toLocaleDateString('ja-JP')}
                              </span>
                              
                              {hBrandLabel && (
                                <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: h.biz_type === 'foot' ? '#4285f4' : '#d34817', color: '#fff', fontWeight: '900', whiteSpace: 'nowrap' }}>
                                  {hBrandLabel.slice(0, 5)}
                                </span>
                              )}

                              {/* 🚀 3. キャンセルバッジ */}
                              {isCanceled && (
                                <span style={{ fontSize: '0.6rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #fecaca' }}>
                                  キャンセル済
                                </span>
                              )}
                            </div>

                            {(() => {
                              const displayPrice = h.total_price > 0 ? h.total_price : parseReservationDetails(h).totalPrice;
                              return (
                                <span style={{ 
                                  color: isCanceled ? '#cbd5e1' : '#e11d48', 
                                  fontWeight: 'bold',
                                  textDecoration: isCanceled ? 'line-through' : 'none' 
                                }}>
                                  ¥{displayPrice.toLocaleString()}
                                  {h.total_price === 0 && <small style={{fontSize:'0.6rem', marginLeft:'2px'}}>(予)</small>}
                                </span>
                              );
                            })()}
                          </div>
                          
                          {/* 🚀 4. メニュー名にも斜線を適用 */}
                          <div style={{ 
                            color: isCanceled ? '#cbd5e1' : '#475569', 
                            fontSize: '0.8rem',
                            textDecoration: isCanceled ? 'line-through' : 'none'
                          }}>
                            {h.menu_name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {/* ✅ 🆕 ここが出し分けの閉じ： )} */}

          </div>
        </div>
      )}
      
                  {/* 👥 3. 予約者選択リストModal (AdminReservationsから完全移植) */}
      {showSlotListModal && (
        <div onClick={() => setShowSlotListModal(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '450px', textAlign: 'center', background: '#f8fafc', padding: '25px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
              <p style={{ fontWeight: '900', color: themeColor, fontSize: '1.8rem', margin: 0 }}>{targetTime} の予約</p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>詳細を見たい方を選択してください</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto', padding: '5px' }}>
              {/* ねじ込みボタン */}
              <div 
                onClick={() => {
                  setShowSlotListModal(false);
                  navigate(`/shop/${shopId}/reserve`, { 
                    state: { adminDate: selectedDate, adminTime: targetTime, isAdminMode: true, adminStaffId: targetStaffId, fromView: 'timeline' } 
                  });
                }}
                style={{ background: themeColor, padding: '18px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontWeight: 'bold', boxShadow: `0 4px 12px ${themeColor}44`, marginBottom: '10px' }}
              >
                ➕ 新しい予約をねじ込む
              </div>

              {selectedSlotReservations.map((res, idx) => (
                <div key={res.id || idx} onClick={() => { setShowSlotListModal(false); openDetail(res); }} style={{ background: '#fff', padding: '18px', borderRadius: '18px', border: `1px solid #e2e8f0`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1e293b', marginBottom: '4px' }}>
                      {res.res_type === 'blocked' ? `🚫 ${res.customer_name}` : `👤 ${res.customer_name} 様`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      <div style={{ color: themeColor, fontWeight: 'bold' }}>📋 {res.menu_name || 'メニュー未設定'}</div>
                      <div style={{ marginTop: '2px' }}>👤 担当: {res.staffs?.name || '店舗スタッフ'}</div>
                    </div>
                  </div>
                  <div style={{ color: themeColor, fontSize: '1.2rem' }}>〉</div>
                </div>
              ))}
            </div>
// --- [580行目付近] ---
            <button onClick={() => setShowSlotListModal(false)} style={{ marginTop: '25px', padding: '12px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* ✅ 🆕 追加：プライベート予定入力用モーダル */}
      {showPrivateModal && (
        <div style={overlayStyle} onClick={() => setShowPrivateModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ ...modalContentStyle, maxWidth: '400px', textAlign: 'center', position: 'relative', padding: '35px' }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🕒</div>
            <h3 style={{ margin: '0 0 5px 0', color: themeColor, fontWeight: '900' }}>プライベート予定</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '5px' }}>
              {selectedDate.replace(/-/g, '/')} {targetTime}
            </p>
            {/* 💡 どのスタッフの枠に入れているかを表示 */}
            <p style={{ fontSize: '0.75rem', color: themeColor, fontWeight: 'bold', marginBottom: '25px' }}>
              👤 担当：{staffs.find(s => s.id === targetStaffId)?.name || '担当なし'}
            </p>
            
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={labelStyle}>予定の内容（必須）</label>
              <input 
                type="text" 
                placeholder="例：休憩、買い出し、ミーティングなど" 
                value={privateTaskFields.title}
                onChange={(e) => setPrivateTaskFields({ ...privateTaskFields, title: e.target.value })}
                style={inputStyle}
              />
              
              <label style={labelStyle}>メモ (任意)</label>
              <textarea 
                placeholder="詳細があれば入力してください"
                value={privateTaskFields.note}
                onChange={(e) => setPrivateTaskFields({ ...privateTaskFields, note: e.target.value })}
                style={{ ...inputStyle, height: '100px', lineHeight: '1.5' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={handleSavePrivateTask}
                style={{ width: '100%', padding: '18px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              >
                予定を保存する
              </button>
              <button 
                onClick={() => setShowPrivateModal(false)} 
                style={{ padding: '12px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// スタイル (省略なし)
const switchBtnStyle = (active) => ({ padding: '5px 15px', borderRadius: '6px', border: 'none', background: active ? '#fff' : 'transparent', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', boxShadow: active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', color: active ? '#1e293b' : '#64748b' });

// 🆕 ここに差し込み：電話やマップの小さなボタン用スタイル
const badgeStyle = (color) => ({
  textDecoration: 'none',
  background: color,
  color: '#fff',
  padding: '2px 10px',
  borderRadius: '6px',
  fontSize: '0.65rem',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  boxShadow: `0 2px 4px ${color}33`, // ボタンの色に合わせた薄い影
  transition: 'transform 0.1s active',
  cursor: 'pointer'
});

const navBtnStyle = { background: '#f1f5f9', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' };
const modalContentStyle = { background: '#fff', width: '95%', borderRadius: '25px', padding: '30px', maxHeight: '85vh', overflowY: 'auto' };
const labelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', fontSize: '1rem', boxSizing: 'border-box' };

export default AdminTimeline;