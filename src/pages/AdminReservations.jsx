import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Clipboard, Activity, BarChart3, Calendar, Building2, Trash2, Clock } from 'lucide-react';

// 🆕 予約者名から固有のパステルカラーを生成するロジック
const getCustomerColor = (name, type) => { // 💡 typeを引数に追加
  if (type === 'private_task') {
    // 💡 プライベート予定は落ち着いたグレー系の色にする
    return { bg: '#f8fafc', border: '#e2e8f0', line: '#94a3b8', text: '#475569' };
  }
  if (!name || name === '定休日' || name === '臨時休業' || name === 'ｲﾝﾀｰﾊﾞﾙ') 
    return { bg: '#f1f5f9', border: '#cbd5e1', line: '#94a3b8', text: '#64748b' };
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
  };
};

const parseReservationDetails = (res) => {
  if (!res) return { menuName: '', totalPrice: 0, items: [], subItems: [] };
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

  const baseNames = items.map(s => s.name).join(', ');
  const optionNames = subItems.map(o => o.option_name).join(', ');
  const fullMenuName = res.menu_name || (optionNames ? `${baseNames}（${optionNames}）` : (baseNames || 'メニューなし'));

  // 合計金額の計算
  let basePrice = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const optPrice = subItems.reduce((sum, o) => sum + (Number(o.additional_price) || 0), 0);

  return { 
    menuName: fullMenuName, 
    totalPrice: basePrice + optPrice, 
    items, 
    subItems 
  };
};

function AdminReservations() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // --- 状態管理 ---
  const [shop, setShop] = useState(null);
  const [staffs, setStaffs] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [visitRequests, setVisitRequests] = useState([]);
  const [manualKeeps, setManualKeeps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exclusions, setExclusions] = useState([]);
  const [facilityConnections, setFacilityConnections] = useState([]);
  const [message, setMessage] = useState('');
  const [categoryMap, setCategoryMap] = useState({});

  const [startDate, setStartDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam) {
      const d = new Date(dateParam);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  }); 

  const [selectedDate, setSelectedDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    return dateParam || new Date().toLocaleDateString('sv-SE');
  }); 
  
  // --- デザイン（スタイル）の定義をここに追加 ---
const resItemRowStyle = { 
  fontSize: '0.9rem', 
  color: '#1e293b', 
  background: '#fff', 
  padding: '8px 12px', 
  borderRadius: '8px', 
  border: '1px solid rgba(0,0,0,0.05)', 
  display: 'flex',
  alignItems: 'flex-start',
  lineHeight: '1.4',
  marginBottom: '5px'
};

const resIndexStyle = (color) => ({ 
  fontWeight: '900', 
  color: color, 
  marginRight: '10px', 
  whiteSpace: 'nowrap' 
});
// ------------------------------------------

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [targetTime, setTargetTime] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
const [selectedRes, setSelectedRes] = useState(null);
const [showSlotListModal, setShowSlotListModal] = useState(false);

// 🆕 プライベート予定用のState
const [privateTasks, setPrivateTasks] = useState([]);
const [showPrivateModal, setShowPrivateModal] = useState(false);
const [privateTaskFields, setPrivateTaskFields] = useState({ title: '', note: '' });
  // --- ✨ 修正後：現在時刻保持用のStateを追加 ---
  const [selectedSlotReservations, setSelectedSlotReservations] = useState([]);
  const [customerHistory, setCustomerHistory] = useState([]);
  // 🚀 🆕 追加：現在時刻を管理するState
  const [now, setNow] = useState(new Date());
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMonth, setViewMonth] = useState(new Date(startDate)); 

  const [customers, setCustomers] = useState([]); 
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // 他のStateと一緒に定義してください
const [mergeCandidate, setMergeCandidate] = useState(null); // 重複が見つかった「大造」さん候補
const [showMergeConfirm, setShowMergeConfirm] = useState(false); // 3択モーダルの表示フラグ
  const [customerFullHistory, setCustomerFullHistory] = useState([]);

/* 🆕 ここから追記：施設訪問名簿用のポップアップ管理 */
const [showVisitDetailModal, setShowVisitDetailModal] = useState(false);
const [visitResidents, setVisitResidents] = useState([]);

// 🏢 施設訪問詳細（入居者リスト）を開く関数
const openVisitDetail = async (visitId, facilityName, visitData) => {
  if (!visitId) return;
  setLoading(true);
  
  // 🆕 1. 親がいれば親のID、いなければ自分のIDを「名簿取得用」にする
  // これにより、3/19を開いても3/18に紐付いた10名のリストが取得できます
  const targetId = visitData.parent_id || visitId;

  const { data, error } = await supabase
    .from('visit_request_residents')
    .select(`
      status,
      menu_name,
      members (name, room, floor)
    `)
    .eq('visit_request_id', targetId);

  if (!error) {
    setVisitResidents(data || []);
    // 💡 visitDataを丸ごとセット（parent_idなどの情報も保持するため）
    setSelectedRes({ 
      ...visitData, 
      id: visitId, 
      customer_name: facilityName, 
      res_type: 'facility_visit' 
    });
    setShowVisitDetailModal(true);
  }
  setLoading(false);
};

// 🆕 施設予約のキャンセル実行
const handleCancelKeep = async (facilityId, dateStr, facilityName) => {
  if (!window.confirm(`${dateStr.replace(/-/g, '/')} の ${facilityName} 様の予定をキャンセルし、枠を空けますか？`)) return;

  try {
    // 1. 定期キープの場合は除外リストに登録
    await supabase.from('regular_keep_exclusions').upsert([{ 
      facility_user_id: facilityId, 
      shop_id: shopId, 
      excluded_date: dateStr 
    }]);

    // 2. 手動キープ（★）の場合は keep_dates から削除
    await supabase.from('keep_dates').delete().match({ 
      facility_user_id: facilityId, 
      shop_id: shopId, 
      date: dateStr 
    });

    showMsg("予定をキャンセルして枠を空けました。");
    fetchData(); // 🔄 カレンダーを更新
  } catch (err) {
    alert("エラー: " + err.message);
  }
};

// 🚀 🆕 確定済みの施設訪問（visit_request）を削除する関数
const handleDeleteVisit = async (visitId, dateStr, facilityName) => {
  if (!window.confirm(`${dateStr.replace(/-/g, '/')} の ${facilityName} 様の予約をキャンセルし、枠を空けますか？\n（名簿の紐付けも解除されます）`)) return;

  try {
    // visit_request を削除
    const { error } = await supabase.from('visit_requests').delete().eq('id', visitId);
    if (error) throw error;

    showMsg("施設訪問の予約をキャンセルしました。");
    fetchData(); // カレンダー更新
  } catch (err) {
    alert("エラー: " + err.message);
  }
};

const [editFields, setEditFields] = useState({ 
    name: '',       // ✅ 表のお名前用
    admin_name: '', // ✅ 裏のメモ名用
    furigana: '', phone: '', email: '', 
    address: '', parking: '', symptoms: '', request_details: '', 
    memo: '', line_user_id: null 
  });
    // キーボード選択用のIndex管理
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const scrollContainerRef = useRef(null);

  // --- ✨ 修正後：1分ごとに時間を更新するタイマーをセット ---
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // 1分ごとに更新
    return () => clearInterval(timer);
  }, []);

const isPC = windowWidth > 1024;

  // 🆕 項目が有効（WebまたはLINEのいずれか）か判定し、ラベルを取得するヘルパー
  const shouldShowInAdmin = (key) => {
    // 1. 基本の4項目は常に表示
    const basicFields = ['name', 'furigana', 'email', 'phone'];
    if (basicFields.includes(key)) return true;

    // 2. それ以外（住所、駐車場、症状など）は、FormCustomizerで「必須」になっている場合のみ表示
    const cfg = shop?.form_config?.[key];
    return cfg?.required === true;
  };

  // ラベル名を取得するヘルパー（既存のものを流用・整理）
  const getFieldLabel = (key) => {
    return shop?.form_config?.[key]?.label || key;
  };

// 🆕 location.search を追加することで、予約完了後にURLが変わった瞬間に再取得が走るようにします
  useEffect(() => { fetchData(); }, [shopId, startDate, location.search]);

  // ✅ ツイン・カレンダー対応版 fetchData
  const fetchData = async () => {
    setLoading(true);
    // 1. 自分の店舗プロフィールを取得
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (!profile) { setLoading(false); return; }
    setShop(profile);

    // 🆕 カテゴリと専用屋号のリストを取得
  const { data: catData } = await supabase
    .from('service_categories')
    .select('name, url_key, custom_shop_name')
    .eq('shop_id', shopId);
  
  const shopNameMap = {};
  catData?.forEach(c => {
    // 💡 識別キー(url_key)をキーにして、専用屋号を格納
    if (c.url_key) {
      shopNameMap[c.url_key] = c.custom_shop_name || c.name;
    }
  });
  setCategoryMap(shopNameMap); // 💡 あとで使えるようにStateに入れておきます

    // ✅ スタッフ一覧を取得（何人いるか判定するため）
    const { data: staffsData } = await supabase
      .from('staffs')
      .select('*')
      .eq('shop_id', shopId)
      .order('sort_order', { ascending: true });
    setStaffs(staffsData || []);

    // 2. スケジュール共有設定（schedule_sync_id）を確認
    let targetShopIds = [shopId];
    if (profile.schedule_sync_id) {
      const { data: siblingShops } = await supabase
        .from('profiles')
        .select('id')
        .eq('schedule_sync_id', profile.schedule_sync_id);
      if (siblingShops) {
        targetShopIds = siblingShops.map(s => s.id);
      }
    }

// 3. 全関連店舗の予約データを合算して取得（顧客マスタの最新名も取得）
// 1. 予約データの取得
const { data: resData } = await supabase
  .from('reservations')
  .select('*, profiles(business_name), staffs(name), customers(*)')
  .in('shop_id', targetShopIds);

// 2. 🆕 プライベート予定の取得
    const { data: privData } = await supabase
      .from('private_tasks')
      .select('*')
      .eq('shop_id', shopId);

    // 🆕 【ここを追加！】提携施設と定期ルールを取得
    const { data: connData } = await supabase
      .from('shop_facility_connections')
      .select('*, facility_users(facility_name)')
      .eq('shop_id', shopId)
      .eq('status', 'active');
    setFacilityConnections(connData || []);

    // 3. 🆕 施設訪問依頼の取得
    const { data: visitData } = await supabase
      .from('visit_requests')
      .select('*, facility_users(facility_name), visit_request_residents(count)')
      .eq('shop_id', shopId)
      // ✅ .neq('status', 'completed') を削除することで、完了分もカレンダーに表示されます
      .neq('status', 'canceled');

    // 🆕 【重要：ここがエラーの場所でした】
    // 変数名を mData に統一して定義し、正しく State にセットします
    const { data: mData } = await supabase
      .from('keep_dates')
      .select('*, facility_users(facility_name)')
      .eq('shop_id', shopId);

    // 🆕 定期訪問の除外リストも取得
    const { data: exclData } = await supabase
      .from('regular_keep_exclusions')
      .select('excluded_date')
      .eq('shop_id', shopId);

    setReservations(resData || []);
    setPrivateTasks(privData || []);
    setVisitRequests(visitData || []);
    setManualKeeps(mData || []); // 💡 manualKeepData ではなく mData を使う
    setExclusions(exclData?.map(e => e.excluded_date) || []);
    setLoading(false);
  };

  useEffect(() => {
    const searchCustomers = async () => {
      if (!searchTerm) { setCustomers([]); setSelectedIndex(-1); return; }
// 🆕 name（本人名）か admin_name（管理名）のどちらかにヒットすればOK
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .or(`name.ilike.%${searchTerm}%,admin_name.ilike.%${searchTerm}%`)
        .limit(5);
              setCustomers(data || []);
      setSelectedIndex(-1); // 検索ワードが変わったら選択位置をリセット
    };
    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, shopId]);

  const openCustomerDetail = async (customer) => {
    setSelectedCustomer(customer);
setEditFields({ 
      // 管理名があればそれを、なければ本人名をセット
      name: customer.name || '', 
      // マスタ側に電話番号があればそれを、なければ今回の予約時のものを優先
      phone: customer.phone || selectedRes?.customer_phone || '', 
      // 🆕 ここが重要！マスタにメールがなくても、予約時のメールがあればそれを表示に活かす
      email: customer.email || selectedRes?.customer_email || '', 
      memo: customer.memo || '',
      line_user_id: customer.line_user_id || selectedRes?.line_user_id || null 
    });
        setSearchTerm('');
    setSelectedIndex(-1);
    const { data } = await supabase.from('reservations').select('*').eq('shop_id', shopId).eq('customer_name', customer.name).order('start_time', { ascending: false });
    setCustomerFullHistory(data || []);
    setShowCustomerModal(true);
  };

  // キーボード操作用ハンドラー
  const handleKeyDown = (e) => {
    if (customers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < customers.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        openCustomerDetail(customers[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setSearchTerm('');
      setCustomers([]);
    }
  };

// 🆕 修正後：名寄せスカウター搭載版
const openDetail = async (res) => {
  if (res.shop_id && res.shop_id !== shopId) {
    alert(`こちらは他店舗...`);
    return;
  }
  setSelectedRes(res);

  let cust = null;

  // 🆕 修正ポイント：まず、予約データに紐付いている顧客IDがあるか確認
  if (res.customer_id) {
    const { data: matched } = await supabase
      .from('customers')
      .select('*')
      .eq('id', res.customer_id)
      .maybeSingle();
    cust = matched;
  }

  // もしIDでヒットしなかった場合のみ、電話・メールでスカウターを回す
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

  // 以降の統合チェックロジックへ...
  if (cust) {
    if (cust.id === res.customer_id) {
      finalizeOpenDetail(res, cust);
      return;
    }
    setMergeCandidate(cust);
    setShowMergeConfirm(true);
    return;
  }
  finalizeOpenDetail(res, cust);
};
  // 🆕 共通処理：詳細モーダルを表示するための確定処理
  const finalizeOpenDetail = (res, cust) => {
    // 💡 予約時に入力された詳細データ（住所やカスタム質問回答など）を取得
    const visitInfo = res.options?.visit_info || {};

    // 🆕 修正：全項目 ＆ カスタム質問の回答を State (editFields) に集約して読み込む
    const allFields = {
      name: cust ? (cust.name || res.customer_name) : res.customer_name,
      furigana: cust?.furigana || visitInfo.furigana || '',
      phone: cust?.phone || res.customer_phone || '',
      email: cust?.email || res.customer_email || '',
      zip_code: cust?.zip_code || visitInfo.zip_code || '',
      address: cust?.address || visitInfo.address || '',
      parking: cust?.parking || visitInfo.parking || '',
      building_type: cust?.building_type || visitInfo.building_type || '',
      care_notes: cust?.care_notes || visitInfo.care_notes || '',
      company_name: cust?.company_name || visitInfo.company_name || '',
      symptoms: cust?.symptoms || visitInfo.symptoms || '',
      request_details: cust?.request_details || visitInfo.request_details || '',
      memo: cust?.memo || '',
      line_user_id: cust?.line_user_id || res.line_user_id || null,
      // 💡 重要：カスタム質問の回答を確実にセット
      custom_answers: visitInfo.custom_answers || cust?.custom_answers || {}
    };

    if (cust) {
      setSelectedCustomer(cust);
      setEditFields(allFields);
    } else {
      setSelectedCustomer(null);
      setEditFields(allFields);
    }

    const history = reservations
      .filter(r => 
        r.shop_id === shopId && 
        r.res_type === 'normal' && 
        (r.customer_name === res.customer_name || (cust?.id && r.customer_id === cust.id))
      )
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    setCustomerHistory(history);
    setShowDetailModal(true);
  };

  // 🆕 ここから追記：理想の名寄せ：名前の選択肢を持たせた統合処理
  const handleMergeAction = async (masterId, finalName) => {
    try {
      // 1. 予約データのIDと名前を、選んだ名前に書き換えてマスタに紐付ける
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          customer_id: masterId,
          customer_name: finalName // 予約票上の表示名も統一する
        })
        .eq('id', selectedRes.id);

      if (resError) throw resError;

      // 2. 顧客マスタ側の名前も、三土手さんが選んだ「正解の名前」で更新
      const customerUpdate = { 
        name: finalName,
        updated_at: new Date().toISOString()
      };

      // Google IDがあれば紐付けを維持/追加
      if (selectedRes.auth_id) {
        customerUpdate.auth_id = selectedRes.auth_id;
      }

      const { error: custError } = await supabase
        .from('customers')
        .update(customerUpdate)
        .eq('id', masterId);

      if (custError) throw custError;

      console.log(`✅ 統合完了: 「${finalName}」様としてマスタを確定しました`);
      
      setShowMergeConfirm(false);
      fetchData(); // カレンダーの表示名を更新するために再取得
      finalizeOpenDetail(selectedRes, { ...mergeCandidate, name: finalName }); 
    } catch (err) {
      console.error("名寄せエラー:", err);
      alert("統合処理に失敗しました。");
    }
  };
// 🆕 追記ここまで

  // 🆕 追加：画面に通知を出す関数 [cite: 2026-03-08]
  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

// ✅ 重複防止・データ保護・一括紐付けロジック：完全版
  const handleUpdateCustomer = async () => {
    try {
      const normalizedName = editFields.name.replace(/　/g, ' ').trim();
      if (!normalizedName) {
        alert("お名前を入力してください。");
        return;
      }

      // 💡 A: ブロック枠(blocked) または プライベート予定(private_task) の場合
      if (selectedRes?.res_type === 'blocked' || selectedRes?.res_type === 'private_task') {
        const isPrivate = selectedRes.res_type === 'private_task';
        const targetTable = isPrivate ? 'private_tasks' : 'reservations';
        const updateData = isPrivate 
          ? { title: normalizedName, note: editFields.memo } 
          : { customer_name: normalizedName };

        const { error } = await supabase.from(targetTable).update(updateData).eq('id', selectedRes.id);
        if (error) throw error;
        showMsg('予定を更新しました！');
        setShowDetailModal(false);
        fetchData();
        return;
      }

      // 💡 B: 通常予約の場合（名簿マスタと連動）
      
      // 1. まず「名前」をキーにして今の名簿データを取得（IDや最新の電話番号を確認）
      const { data: currentMaster } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .eq('name', normalizedName)
        .maybeSingle();

      // 2. 顧客IDを特定
      const finalTargetId = currentMaster?.id || selectedCustomer?.id;

      // 3. 顧客マスタ用データの作成（空欄上書き防止ガード！）
      // 「入力があれば使う > なければマスタの値を使う > それもなければ今回の予約時の値を使う」
      const customerPayload = {
        shop_id: shopId,
        name: normalizedName,
        admin_name: normalizedName,
        furigana: editFields.furigana || currentMaster?.furigana || '',
        phone: editFields.phone || currentMaster?.phone || selectedRes.customer_phone || '',
        email: editFields.email || currentMaster?.email || selectedRes.customer_email || '',
        address: editFields.address || currentMaster?.address || '',
        zip_code: editFields.zip_code || currentMaster?.zip_code || '',
        parking: editFields.parking || currentMaster?.parking || '',
        building_type: editFields.building_type || currentMaster?.building_type || '',
        care_notes: editFields.care_notes || currentMaster?.care_notes || '',
        company_name: editFields.company_name || currentMaster?.company_name || '',
        symptoms: editFields.symptoms || currentMaster?.symptoms || '',
        request_details: editFields.request_details || currentMaster?.request_details || '',
        memo: editFields.memo || currentMaster?.memo || '', // メモも保護！
        line_user_id: editFields.line_user_id || currentMaster?.line_user_id || selectedRes.line_user_id || null,
        updated_at: new Date().toISOString()
      };

      if (finalTargetId) {
        customerPayload.id = finalTargetId;
      }

      // 4. 名簿（customers）を更新
      const { data: savedCust, error: custError } = await supabase
        .from('customers')
        .upsert(customerPayload, { onConflict: 'id' })
        .select()
        .single();
      
      if (custError) throw custError;
      const finalCustomerId = savedCust.id;

      // --- 🆕 5. 【重要】同じ名前の過去予約も一気に紐付け！ ---
      // これにより、昔の「記録なし」だった予約もすべてこのお客様の履歴として繋がります
      await supabase
        .from('reservations')
        .update({ customer_id: finalCustomerId })
        .eq('shop_id', shopId)
        .eq('customer_name', normalizedName)
        .is('customer_id', null);

      // 6. 今の予約データも最新化
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          customer_name: normalizedName,
          customer_phone: customerPayload.phone,
          customer_email: customerPayload.email,
          customer_id: finalCustomerId, // ガッチリ紐付け
          memo: null // マスタに一本化したので予約側は空にする
        })
        .eq('id', selectedRes.id);

      if (resError) throw resError;

      showMsg('情報を保存し、全履歴を紐付けました！✨'); 
      setShowDetailModal(false); 
      fetchData(); 
    } catch (err) {
      console.error(err);
      alert('保存エラー: ' + err.message);
    }
  }; 

  // 🆕 追加：プライベート予定(private_tasksテーブル)を保存する関数
  const handleSavePrivateTask = async () => {
    if (!privateTaskFields.title) {
      alert("予定の内容（タイトル）を入力してください。");
      return;
    }

    try {
      const start = new Date(`${selectedDate}T${targetTime}:00`);
      const interval = shop.slot_interval_min || 15;
      const end = new Date(start.getTime() + interval * 60000);

      const { error } = await supabase.from('private_tasks').insert([{
        shop_id: shopId,
        title: privateTaskFields.title,
        note: privateTaskFields.note,
        start_time: start.toISOString(),
        end_time: end.toISOString()
      }]);

      if (error) throw error;

      // 成功したらリセットして閉じる
      setShowPrivateModal(false);
      setPrivateTaskFields({ title: '', note: '' });
      showMsg("プライベート予定を追加しました☕️");
      fetchData(); // 画面を再読み込みしてカレンダーに反映
    } catch (err) {
      console.error("保存エラー:", err.message);
      alert("保存に失敗しました。");
    }
  };

// --- [330行目付近] ---
  // 🆕 キャンセル（記録を残す）処理
  const cancelRes = async (id) => {
    if (!window.confirm("この予約を「キャンセル扱い」にして記録に残しますか？\n（予約枠は空きます）")) return;

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'canceled' }) // 🚀 削除せずステータスだけ更新
        .eq('id', id);

      if (error) throw error;
      
      setShowDetailModal(false);
      fetchData();
      showMsg("キャンセルとして記録しました");
    } catch (err) {
      alert("エラー: " + err.message);
    }
  };

  const deleteRes = async (id) => {
    const isPrivate = selectedRes?.res_type === 'private_task';
    const isBlock = selectedRes?.res_type === 'blocked';
    
    // メッセージの出し分け
    let msg = 'この予約データを消去して予約を「可能」に戻しますか？';
    if (isPrivate) msg = 'このプライベート予定を削除しますか？';
    if (isBlock) msg = 'このブロックを解除して予約を「可能」に戻しますか？';
    
    if (window.confirm(msg)) {
      // ✅ 🆕 修正：テーブルを使い分ける
      const targetTable = isPrivate ? 'private_tasks' : 'reservations';
      const { error: deleteError } = await supabase.from(targetTable).delete().eq('id', id);

      if (deleteError) { alert('削除に失敗しました: ' + deleteError.message); return; }

      // 予約（normal）の場合のみ、顧客マスタの来店回数を減らすロジック（既存）
      if (!isPrivate && selectedRes.res_type === 'normal') {
        const { customer_name } = selectedRes;
        const { count } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('shop_id', shopId).eq('customer_name', customer_name);
        if (count === 0) {
          await supabase.from('customers').delete().eq('shop_id', shopId).eq('name', customer_name);
        } else {
          const { data: cust } = await supabase.from('customers').select('id, total_visits').eq('shop_id', shopId).eq('name', customer_name).maybeSingle();
          if (cust) {
            await supabase.from('customers').update({ total_visits: Math.max(0, (cust.total_visits || 1) - 1) }).eq('id', cust.id);
          }
        }
      }
      
      setShowDetailModal(false); 
      fetchData(); // 再読み込み
      showMsg(isPrivate ? "予定を削除しました" : "予約を削除しました");
    }
  };
  
  // 🆕 定期キープ（施設とのお約束）の判定：エラー修正版
  const checkIsRegularKeep = (date) => {
    const dStr = getJapanDateStr(date);
    
    // 🆕 【ここを追加！】もし除外リストに入っていたら、予定なしとして返す
    if (exclusions.includes(dStr)) return null;

    const day = date.getDay(); // 0:日, 1:月...
    const dom = date.getDate();
    const m = date.getMonth() + 1;
    const nthWeek = Math.ceil(dom / 7);

    // 最終週・最後から2番目の判定用
    const tempNext = new Date(date); tempNext.setDate(dom + 7);
    const isLastWeek = tempNext.getMonth() !== date.getMonth();
    const tempNext2 = new Date(date); tempNext2.setDate(dom + 14);
    const isSecondToLastWeek = (tempNext2.getMonth() !== date.getMonth()) && !isLastWeek;

    let result = null; 
    
    // facilityConnections をループして条件に合うルールを探す
    facilityConnections.forEach(conn => {
      conn.regular_rules?.forEach(rule => {
        // 月・曜日・週の条件が一致するかチェック
        const monthMatch = (rule.monthType === 0) || (rule.monthType === 1 && m % 2 !== 0) || (rule.monthType === 2 && m % 2 === 0);
        const dayMatch = (rule.day === day);
        let weekMatch = (rule.week === nthWeek);
        if (rule.week === -1) weekMatch = isLastWeek;
        if (rule.week === -2) weekMatch = isSecondToLastWeek;

        if (monthMatch && dayMatch && weekMatch) {
          result = {
            name: conn.facility_users?.facility_name,
            time: rule.time || '09:00',
            // 🆕 キャンセル実行用にIDをセット
            facility_user_id: conn.facility_user_id 
          };
        }
      });
    });
    return result;
  };

  const checkIsRegularHoliday = (date) => {
    if (!shop?.business_hours?.regular_holidays) return false;
    const holidays = shop.business_hours.regular_holidays;
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
    if (holidays[`${nthWeek}-${dayName}`]) return true;
    if (isLastWeek && holidays[`L1-${dayName}`]) return true;
    if (isSecondToLastWeek && holidays[`L2-${dayName}`]) return true;
    return false;
  };

  // ✅ 🆕 追加：長期休暇（夏休み等）の期間中か判定する
  const checkIsSpecialHoliday = (date) => {
    // 💡 DBの新カラム special_holidays を参照します
    if (!shop?.special_holidays || !Array.isArray(shop.special_holidays)) return false;
    
    const dStr = getJapanDateStr(date); // YYYY-MM-DD形式
    return shop.special_holidays.some(h => dStr >= h.start && dStr <= h.end);
  };

  const weekDays = useMemo(() => {
    const days = [];
    const base = new Date(startDate);
    const dayOfWeek = base.getDay(); 
    base.setDate(base.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); 
    for (let i = 0; i < 7; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i); days.push(d);
    }
    return days;
  }, [startDate]);

  const timeSlots = useMemo(() => {
    if (!shop?.business_hours) return [];
    let minTotalMinutes = 24 * 60;
    let maxTotalMinutes = 0;
    let hasOpenDay = false;
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
    const slots = [];
    const interval = shop.slot_interval_min || 15;
    const extraBefore = shop.extra_slots_before || 0; // 🆕 追加
    const extraAfter = shop.extra_slots_after || 0;   // 🆕 追加

    // 🆕 拡張分を含めた開始・終了時間を計算
    const finalStart = minTotalMinutes - (extraBefore * interval);
    const finalEnd = maxTotalMinutes + (extraAfter * interval);

    for (let m = finalStart; m <= finalEnd; m += interval) {
      const h = Math.floor(m / 60); const mm = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
    return slots;
  }, [shop]);

    // ✅ 🆕 【Step B：自動スクロール実行ロジック】ここから差し込み
  useEffect(() => {
    // 読み込みが終わり、時間軸データがあり、Refが準備できている時だけ実行
    if (!loading && timeSlots.length > 0 && scrollContainerRef.current) {
      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();

      // 現在時刻に一番近い時間軸のインデックス（番号）を探す
      const targetIdx = timeSlots.findIndex(slot => {
        const [h, m] = slot.split(':').map(Number);
        return (h === currentH && currentM < m + 30) || h > currentH;
      });

      if (targetIdx !== -1) {
        const rowHeight = 60; // 1マスの高さ
        // 少し余裕を持って2コマ分（120px）上にスクロールさせる
        scrollContainerRef.current.scrollTop = Math.max(0, (targetIdx - 2) * rowHeight);
      }
    }
  }, [loading, timeSlots]); 
  // ✅ 🆕 差し込みここまで

  const getJapanDateStr = (date) => date.toLocaleDateString('sv-SE');

const getStatusAt = (dateStr, timeStr) => {
    const dateObj = new Date(dateStr);
    const currentSlotTime = timeStr; // "09:00"

    // --- 🏆 優先度1：確定した施設訪問（visit_requests） ---
    const confirmedVisit = visitRequests.find(v => {
      if (v.status !== 'confirmed') return false;
      const vStart = v.start_time?.substring(0, 5) || "09:00";
      if (Array.isArray(v.visit_date_list)) {
        return v.visit_date_list.some(d => {
          if (typeof d === 'string') return d === dateStr && vStart === currentSlotTime;
          return d.date === dateStr && (d.start_time || d.time)?.substring(0, 5) === currentSlotTime;
        });
      }
      return v.scheduled_date === dateStr && vStart === currentSlotTime;
    });

    if (confirmedVisit) {
      return [{
        res_type: 'facility_visit',
        customer_name: confirmedVisit.facility_users?.facility_name, 
        visitId: confirmedVisit.id,
        start_time: `${dateStr}T${timeStr}:00`,
        visitData: confirmedVisit 
      }];
    }

    // --- 🏆 優先度2：手動追加のキープ（★） ---
    const mKeep = manualKeeps.find(k => {
      const kTime = (k.start_time || "09:00").substring(0, 5);
      return k.date === dateStr && kTime === currentSlotTime;
    });
    if (mKeep) {
      return [{
        res_type: 'facility_keep',
        customer_name: `${mKeep.facility_users?.facility_name} 予定`,
        facility_user_id: mKeep.facility_user_id, // 🆕 追加
        start_time: `${dateStr}T${timeStr}:00`,
        isKeep: true
      }];
    }

    const rKeep = checkIsRegularKeep(dateObj);
    if (rKeep && rKeep.time === currentSlotTime) {
      return [{
        res_type: 'facility_keep',
        customer_name: `${rKeep.name} 予定`,
        facility_user_id: rKeep.facility_user_id, // 🆕 追加
        start_time: `${dateStr}T${timeStr}:00`,
        isKeep: true
      }];
    }

    // --- 🏆 優先度3：施設訪問日の「それ以外の時間」をステルスブロック ---
    const currentSlotStart = new Date(`${dateStr}T${timeStr}:00`).getTime();

    // 1. お客様の予約（ねじ込み含む）
    const resMatches = reservations.filter(r => {
      const start = new Date(r.start_time).getTime();
      const end = new Date(r.end_time).getTime();
      const isTimeMatch = currentSlotStart >= start && currentSlotStart < end;
      if (isTimeMatch) {
        if (r.res_type === 'blocked') return r.staff_id === null;
        return true;
      }
      return false;
    });

    // 2. プライベート予定
    const privMatches = privateTasks.filter(p => {
      const start = new Date(p.start_time).getTime();
      const end = new Date(p.end_time).getTime();
      return currentSlotStart >= start && currentSlotStart < end;
    }).map(p => ({ ...p, res_type: 'private_task', customer_name: p.title }));

    const matches = [...resMatches, ...privMatches];
    if (matches.length > 0) return matches; // ✅ 予約があれば即座にそれを表示！

    // --- 🏆 優先度4：予約がない枠だけ、施設訪問日の「ステルスブロック」をかける ---
    // status に 'completed' も含めることで、お会計後もブロックを維持します
    const hasAnyConfirmedVisitThisDay = visitRequests.some(v => 
      (v.status === 'confirmed' || v.status === 'completed') && 
      (v.scheduled_date === dateStr || (Array.isArray(v.visit_date_list) && v.visit_date_list.some(d => d.date === dateStr)))
    );
    const hasAnyKeepThisDay = manualKeeps.some(k => k.date === dateStr) || checkIsRegularKeep(dateObj);

    if (hasAnyConfirmedVisitThisDay || hasAnyKeepThisDay) {
      return [{ res_type: 'facility_day_stealth', customer_name: '', start_time: `${dateStr}T${timeStr}:00` }];
    }

    // --- 🏆 優先度5：定休日・長期休暇・営業時間内判定 ---
    const isSpecialHoliday = checkIsSpecialHoliday(dateObj);
    if (checkIsRegularHoliday(dateObj) || isSpecialHoliday) {
      return { 
        res_type: 'blocked', 
        customer_name: isSpecialHoliday ? (shop.special_holidays.find(h => getJapanDateStr(dateObj) >= h.start && getJapanDateStr(dateObj) <= h.end)?.name || '長期休暇') : '定休日', 
        start_time: `${dateStr}T${timeStr}:00`, isRegularHoliday: true 
      };
    }

    // 営業時間内のインターバルや自動詰め表示（略：既存ロジックを継続）
    // ...
    return null;
  };
  const handleBlockTime = async () => {
    // 🆕 1. 予定の名前を入力してもらう小窓を出す
    const reason = window.prompt("予定名（例：打ち合わせ、忘年会）を入力してください", "管理者ブロック");
    
    // 🆕 2. 「キャンセル」を押されたら何もしない
    if (reason === null) return; 

    const start = new Date(`${selectedDate}T${targetTime}:00`);
    const interval = shop.slot_interval_min || 15;
    const end = new Date(start.getTime() + interval * 60000);
    
const insertData = {
  shop_id: shopId, 
  customer_name: reason, 
  res_type: 'blocked',
  is_block: true, // 🚀 🆕 「これは予約枠のブロックです」という印を付ける
  start_time: start.toISOString(), 
  end_time: end.toISOString(),
  total_slots: 1, 
  customer_email: null, 
  customer_phone: '---', 
  options: { type: 'admin_block' }
};
    
    const { error } = await supabase.from('reservations').insert([insertData]);
    if (error) alert(`エラー: ${error.message}`); 
    else { setShowMenuModal(false); fetchData(); }
  };

  const handleBlockFullDay = async () => {
    if (!window.confirm(`${selectedDate.replace(/-/g, '/')} を終日「予約不可」にしますか？`)) return;
    const interval = shop.slot_interval_min || 15;
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(selectedDate).getDay()];
    const hours = shop.business_hours?.[dayName];
    const openStr = (hours && !hours.is_closed && hours.open) ? hours.open : "09:00";
    const closeStr = (hours && !hours.is_closed && hours.close) ? hours.close : "18:00";
    const start = new Date(`${selectedDate}T${openStr}:00`);
    const end = new Date(`${selectedDate}T${closeStr}:00`);
    const [oh, om] = openStr.split(':').map(Number); const [ch, cm] = closeStr.split(':').map(Number);
    const totalMinutes = (ch * 60 + cm) - (oh * 60 + om);
    const slotsCount = Math.ceil(totalMinutes / interval);
    const insertData = {
      shop_id: shopId, 
      customer_name: '臨時休業', 
      res_type: 'blocked',
      is_block: true, // 🚀 🆕 「これは予約枠のブロックです」という印を付ける
      start_at: start.toISOString(), 
      end_at: end.toISOString(),
      start_time: start.toISOString(), 
      end_time: end.toISOString(),
      total_slots: slotsCount, 
      customer_email: null, 
      customer_phone: '---',
      options: { services: [], isFullDay: true }
    };
    const { error } = await supabase.from('reservations').insert([insertData]);
    if (error) alert(`エラー: ${error.message}`); else { setShowMenuModal(false); fetchData(); }
  };

  const miniCalendarDays = useMemo(() => {
    const year = viewMonth.getFullYear(); const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [viewMonth]);

  const goPrev = () => setStartDate(new Date(new Date(startDate).setDate(new Date(startDate).getDate() - 7)));
  const goNext = () => setStartDate(new Date(new Date(startDate).setDate(new Date(startDate).getDate() + 7)));
  const goPrevMonth = () => setStartDate(new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() - 1)));
  const goNextMonth = () => setStartDate(new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)));
  const goToday = () => { const today = new Date(); setStartDate(today); setSelectedDate(today.toLocaleDateString('sv-SE')); navigate(`/admin/${shopId}/reservations`, { replace: true }); };

  const themeColor = shop?.theme_color || '#2563eb';
  const themeColorLight = `${themeColor}15`; 

  const isManagementEnabled = shop?.is_management_enabled === true;

  const miniBtnStyle = { border: 'none', background: 'none', cursor: 'pointer', color: themeColor };
  const floatNavBtnStyle = { border: 'none', background: 'none', width: '60px', height: '50px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' };
  const modalContentStyle = { background: '#fff', width: '95%', borderRadius: '25px', padding: '30px', maxHeight: '85vh', overflowY: 'auto' };
  const headerBtnStylePC = { padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' };
  const mobileArrowBtnStyle = { background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer' };
  const labelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' };
  const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px', fontSize: '1rem', boxSizing: 'border-box' };

  const getFamilyName = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.split(/[\s\u3000]+/); 
    return parts[0];
  };

  // 🚀 🆕 ここに追加：現在地の赤い線の位置（高さ・列）を計算するロジック
  // 🚀 🆕 「今の時間枠」かどうかを判定する関数
  const applyCurrentTimeMarker = (dateStr, slotTime) => {
    const today = new Date();
    // 1. 今日かどうかチェック
    if (getJapanDateStr(today) !== dateStr) return false;

    // 2. このスロットの時間内（例：11:00 〜 11:30）に現在時刻があるか
    const [h, m] = slotTime.split(':').map(Number);
    const slotStartMin = h * 60 + m;
    const interval = shop?.slot_interval_min || 30;
    const slotEndMin = slotStartMin + interval;

    const nowMin = today.getHours() * 60 + today.getMinutes();

    return nowMin >= slotStartMin && nowMin < slotEndMin;
  };

return (
    <div style={{ display: 'flex', width: '100vw', height: '100dvh', background: '#fff', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      {/* 🆕 追記：通知メッセージを表示するボックス [cite: 2026-03-08] */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 10001, textAlign: 'center', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          {message}
        </div>
      )}
      {isPC && (
        
        <div style={{ width: '260px', flexShrink: 0, borderRight: '0.5px solid #cbd5e1', padding: '18px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#fff', zIndex: 100 }}>

{/* --- 1段目：タイトルと設定 --- */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* 💡 左側のアイコン内の文字も、店舗名の1文字目に自動で変わるようにしました */}
              <div style={{ width: '32px', height: '32px', background: themeColor, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {(shop?.business_name || 'S')[0]}
              </div>
              
              {/* 🚀 🆕 ここを店舗名に変更 */}
              <h1 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, color: '#1e293b' }}>
                {shop?.business_name || 'SnipSnap Admin'}
              </h1>
            </div>
            <button 
              onClick={() => navigate(`/admin/${shopId}/dashboard`)}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', padding: '6px', display: 'flex', alignItems: 'center', color: '#64748b' }}
            >
              ⚙️
            </button>
          </div>

          {/* --- 2段目：切り替えスイッチ（カレンダーも維持！） --- */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }}>
            <button style={{ ...switchBtnStyle(true), flex: 1 }}>カレンダー</button>
            <button 
              onClick={() => navigate(`/admin/${shopId}/timeline?date=${selectedDate}`)} 
              style={{ ...switchBtnStyle(false), flex: 1 }}
            >
              タイムライン
            </button>
          </div>

          <div style={{ border: '1px solid #eee', borderRadius: '12px', padding: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 'bold' }}>
              {viewMonth.getFullYear()}年 {viewMonth.getMonth() + 1}月
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth() - 1)))} style={miniBtnStyle}>＜</button>
                <button onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth() + 1)))} style={miniBtnStyle}>＞</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.8rem' }}>
              {['月','火','水','木','金','土','日'].map(d => <div key={d} style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold' }}>{d}</div>)}
              {miniCalendarDays.map((date, i) => date ? <div key={i} onClick={() => { setStartDate(date); setSelectedDate(getJapanDateStr(date)); }} style={{ padding: '8px 0', cursor: 'pointer', borderRadius: '50%', background: getJapanDateStr(date) === selectedDate ? themeColor : 'none', color: getJapanDateStr(date) === selectedDate ? '#fff' : '#475569' }}>{date.getDate()}</div> : <div key={i} />)}
            </div>
          </div>

<div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* ✅ 追加：現場での実行用「今日のタスク」ボタン [cite: 2026-03-06] */}
            <button 
              onClick={() => navigate(`/admin/${shopId}/today-tasks`)}
              style={{ 
                padding: '15px', 
                background: '#1e293b', // カレンダーと差別化するために深い色に
                color: '#fff', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              ⚡ 本日のタスク (実行)
            </button>

            <button 
              onClick={() => isManagementEnabled && navigate(`/admin/${shopId}/management`)} 
              style={{ 
                padding: '15px',
                background: isManagementEnabled ? themeColor : '#e2e8f0', 
                color: isManagementEnabled ? '#fff' : '#94a3b8', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: isManagementEnabled ? 'pointer' : 'not-allowed', 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              disabled={!isManagementEnabled}
            >               
              {isManagementEnabled ? '📊 顧客・売上管理へ' : '🔒 顧客・売上管理 (未解放)'}
            </button>
          </div>
                  </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ padding: isPC ? '15px 25px' : '15px 10px', borderBottom: '0.5px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          {isPC ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={goToday} style={headerBtnStylePC}>今日</button>
                <button onClick={goPrev} style={headerBtnStylePC}>前週</button>
                <button onClick={goNext} style={headerBtnStylePC}>次週</button>
              </div>
              <div style={{ position: 'relative', marginLeft: '10px', width: '300px' }}>
                <input 
  type="text" 
  autoComplete="off" // 👈 これで「勝手に出さないで」と命令
  name="search-no-autofill" // 👈 ブラウザが推測できない名前にする
  placeholder="👤 顧客を検索..." 
  value={searchTerm} 
  onChange={(e) => setSearchTerm(e.target.value)} 
  onKeyDown={handleKeyDown} 
  style={{ width: '100%', padding: '12px 15px 12px 40px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem' }} 
/>
                <span style={{ position: 'absolute', left: '12px', top: '12px', opacity: 0.4 }}>🔍</span>
                {customers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', marginTop: '5px', zIndex: 1000, border: '1px solid #eee' }}>
                    {customers.map((c, index) => (
                      <div 
                        key={c.id} 
                        onClick={() => openCustomerDetail(c)} 
                        style={{ 
                          padding: '12px', 
                          borderBottom: '1px solid #f8fafc', 
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          background: index === selectedIndex ? themeColorLight : 'transparent'
                        }}
                      >
<div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
  {c.admin_name || c.name} 様 {c.admin_name && c.admin_name !== c.name ? `(${c.name})` : ''}
</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{c.phone || '電話未登録'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 0 auto', fontWeight: '900', color: '#1e293b' }}>{startDate.getFullYear()}年 {startDate.getMonth() + 1}月</h2>
            </div>
) : (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '15px', position: 'relative' }}>
    {/* 🆕 修正：スマホでも週単位でサクサク移動できるように変更 */}
    <button onClick={goPrev} style={mobileArrowBtnStyle}>◀</button>
    <h2 style={{ fontSize: '1.3rem', margin: 0, fontWeight: '900', color: '#1e293b' }}>{startDate.getFullYear()}年 {startDate.getMonth() + 1}月</h2>
    <button onClick={goNext} style={mobileArrowBtnStyle}>▶</button>
              
              
            </div>
          )}
          </div>

{/* ✅ 親要素：はみ出しを隠し、高さを固定 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={startDate.toISOString()}
      ref={scrollContainerRef}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.2, opacity: { duration: 0.1 } }}
      drag="x"
      dragDirectionLock={true}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0}
      onDragEnd={(e, { offset }) => {
        const swipeThreshold = 50;
        if (offset.x > swipeThreshold) goPrev();
        else if (offset.x < -swipeThreshold) goNext();
      }}
      style={{ flex: 1, width: '100%', overflowY: 'auto', overflowX: isPC ? 'auto' : 'hidden', cursor: 'grab', touchAction: 'pan-y' }}
      whileTap={{ cursor: 'grabbing' }}
    >

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: isPC ? '900px' : '100%' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
          <tr>
            <th style={{ width: isPC ? '80px' : '32px', borderBottom: '0.5px solid #cbd5e1' }}></th>
            {weekDays.map(date => {
              const isToday = getJapanDateStr(new Date()) === getJapanDateStr(date);
              return (
                <th key={date.toString()} style={{ padding: '4px 0', borderBottom: '0.5px solid #cbd5e1' }}>
                  <div style={{ fontSize: '0.6rem', color: isToday ? themeColor : '#666' }}>{['日','月','火','水','木','金','土'][date.getDay()]}</div>
                  <div style={{ fontSize: isPC ? '1.5rem' : '0.9rem', fontWeight: 'bold', color: isToday ? '#fff' : '#333', background: isToday ? themeColor : 'none', width: isPC ? '40px' : '22px', height: isPC ? '40px' : '22px', borderRadius: '50%', margin: '2px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{date.getDate()}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(time => (
            <tr key={time} style={{ height: '60px' }}>
              {/* 左端の時間軸 */}
              <td style={{ borderRight: '0.5px solid #cbd5e1', borderBottom: '0.5px solid #cbd5e1', textAlign: 'center', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>{time}</span>
              </td>

              {weekDays.map(date => {
                const dStr = getJapanDateStr(date);
                const resAt = getStatusAt(dStr, time);
                const isArray = Array.isArray(resAt);
                const hasRes = resAt !== null;
                const firstRes = isArray ? resAt[0] : resAt;
                const reservationCount = isArray ? resAt.length : 0;

                // 🆕 判定時間を10秒に延長（新着予約の点滅用）
                const isNew = isArray && resAt.some(r => {
                  if (!r.created_at) return false;
                  return (new Date().getTime() - new Date(r.created_at).getTime()) < 10000;
                });

                const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
                const hours = shop?.business_hours?.[dayName];
                const isStandardTime = hours && !hours.is_closed && time >= hours.open && time < hours.close;

                // この枠でちょうど開始するか
                const startingHere = isArray ? resAt.filter(r => 
                  new Date(r.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }) === time
                ) : [];
                const isStart = startingHere.length > 0;

                const colors = getCustomerColor(firstRes?.customer_name);
                const isOtherShop = isArray && resAt.some(r => r.shop_id !== shopId);
                const isBlocked = (isArray && resAt.some(r => r.res_type === 'blocked')) || (firstRes?.res_type === 'blocked');
                const isRegularHoliday = !isArray && firstRes?.isRegularHoliday;
                const isSystemBlocked = !isArray && firstRes?.res_type === 'system_blocked';

                return (
                  <td 
                    key={`${dStr}-${time}`} 
                    // 🚀 🆕 async を追加して、中で await を使えるようにします
                    onClick={async () => { 
                      setSelectedDate(dStr); 
                      setTargetTime(time);
                      
                      // 🆕 定休日やシステムブロックかどうかを先に判定します
                      const firstItem = Array.isArray(resAt) ? resAt[0] : resAt;
                      const isBgBlock = firstItem?.isRegularHoliday || firstItem?.res_type === 'system_blocked';

                      // --- 1. データが何もない、または「定休日」枠の場合 ---
                      if (!hasRes || isBgBlock) {
                        if (isStandardTime && !isRegularHoliday) {
                          setShowMenuModal(true);
                        } else {
                          setPrivateTaskFields({ title: '', note: '' });
                          setShowPrivateModal(true); 
                        }
                        return;
                      }

                      // --- 2. 実際の予約データがある場合 ---
                      const items = Array.isArray(resAt) ? resAt : [resAt];

                      if (items.length > 1) {
                        setSelectedSlotReservations(items);
                        setShowSlotListModal(true);
                        return;
                      }

                      const activeTask = items[0];

                      // 🚀 🆕 【ここから施設訪問のガード判定】
                      if (activeTask.res_type === 'facility_visit') {
                        // 1人でも「完了」している人がいるか、その場でDBに問い合わせます
                        const { count } = await supabase
                          .from('visit_request_residents')
                          .select('id', { count: 'exact', head: true })
                          .eq('visit_request_id', activeTask.visitId)
                          .eq('status', 'completed');

                        if (count > 0) {
                          // 💡 1人でも終わっていれば、詳細（名簿）を開く
                          openVisitDetail(activeTask.visitId, activeTask.customer_name, activeTask.visitData);
                        } else {
                          // 💡 全員未完了なら、削除の確認（handleDeleteVisit）へ
                          handleDeleteVisit(activeTask.visitId, dStr, activeTask.customer_name);
                        }
                      } 
                      else if (activeTask.res_type === 'facility_keep') {
                        handleCancelKeep(activeTask.facility_user_id, dStr, activeTask.customer_name.replace(' 予定', ''));
                      }
                      // 💡 ここでは「背景の定休日」は除外されているので、手動で入れたブロックや予約だけが詳細に飛びます
                      else if (activeTask.res_type === 'normal' || activeTask.res_type === 'blocked' || activeTask.res_type === 'private_task') {
                        openDetail(activeTask); 
                      }
                      else if (activeTask.res_type === 'facility_day_stealth') {
                        if (isStandardTime && !isRegularHoliday) {
                          setShowMenuModal(true);
                        } else {
                          setPrivateTaskFields({ title: '', note: '' });
                          setShowPrivateModal(true);
                        }
                      }
                    }}
                    style={{ 
                      borderRight: '0.1px solid #cbd5e1', 
                      borderBottom: '0.1px solid #cbd5e1', 
                      position: 'relative', 
                      cursor: 'pointer', 
                      background: isStandardTime ? '#fff' : '#fffff3',
                      
                      // 🚀 🆕 ここを追加：今の時間枠の左側だけ赤く太くする
                      ...(applyCurrentTimeMarker(dStr, time) && {
                        borderLeft: '3px solid #14a9d7',
                        // 💡 赤い棒が枠線に隠れないように zIndex を指定
                        zIndex: 10 
                      })
                    }}
                  >
                    {hasRes && !isSystemBlocked && (
                      <div style={{ 
                        position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: (firstRes?.res_type === 'facility_day_stealth') ? 'transparent' : 
                                    (isRegularHoliday || isBlocked) ? '#f1f5f9' : 
                                    (isOtherShop ? '#f8fafc' : (isStart ? colors.bg : '#fff')),
                        borderLeft: (firstRes?.res_type === 'facility_day_stealth' || isRegularHoliday || isBlocked) ? 'none' : 
                                    `2px solid ${isOtherShop ? '#cbd5e1' : colors.line}`,
                        animation: (isNew && isStart) ? 'flashGold 2s ease-out' : 'none'
                      }}>
                        {firstRes?.res_type !== 'facility_day_stealth' && (
                          <>
                            {(isRegularHoliday || isBlocked) ? (
                              isStart && <span style={{fontSize:'0.65rem', fontWeight:'bold', color:'#94a3b8'}}>{firstRes.customer_name}</span>
                            ) : (
                              isStart ? (
                                <div style={{ fontWeight: 'bold', fontSize: isPC ? '0.85rem' : '0.7rem', color: isOtherShop ? '#94a3b8' : colors.text, textAlign: 'center', whiteSpace: 'nowrap', padding: '0 4px' }}>
                                  {(() => {
  if (startingHere.length === 1) {
    const res = startingHere[0];
    
    // --- 🏢 施設訪問の場合 ---
    if (res.res_type === 'facility_visit') {
      return (
        <div style={{ display: 'flex', flexDirection: isPC ? 'row' : 'column', alignItems: 'center', gap: '4px', color: '#4f46e5' }}>
          <Building2 size={isPC ? 16 : 12} strokeWidth={2.5} />
          {/* ✅ 施設名のみ表示（金額を削除しました） */}
          <span style={{ fontSize: isPC ? '0.8rem' : '0.65rem', fontWeight: 'bold' }}>
            {isPC ? res.customer_name : res.customer_name.slice(0, 4)}
          </span>
        </div>
      );
    }

    // --- 👤 個人・プライベート予定の場合 ---
    const masterName = res.res_type === 'private_task' ? res.customer_name : (res.customers?.name || res.customer_name);
    const name = masterName?.split(/[\s　]+/)[0] || "名前なし";
    const countSuffix = reservationCount > 1 ? ` (${reservationCount}名)` : " 様";

    // 🚀 🆕 追加：biz_type（識別キー）を使って、専用屋号を取得する
    const brandLabel = categoryMap[res.biz_type];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
        
        {/* 🚀 🆕 追加：屋号バッジの表示（識別キーがセットされている場合のみ） */}
        {brandLabel && (
          <div style={{ 
            fontSize: '0.6rem', 
            padding: '1px 5px', 
            borderRadius: '4px', 
            marginBottom: '3px',
            // キーによって色を分けるとさらに見やすいです
            background: res.biz_type === 'foot' ? '#4285f4' : '#d34817', 
            color: '#fff', 
            fontWeight: '900', 
            transform: 'scale(0.85)',
            whiteSpace: 'nowrap'
          }}>
            {brandLabel.slice(0, 5)} {/* 長い場合は5文字でカット */}
          </div>
        )}

        {isPC ? (
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{name}{countSuffix}</span>
        ) : (
          <span style={{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: '0.75rem', fontWeight: 'bold' }}>{name}</span>
        )}
      </div>
    );
  }
  return <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#64748b' }}>👥 {reservationCount}名</div>;
})()}
                                </div>
                              ) : null
                            )}
                          </>
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
    </motion.div>
  </AnimatePresence>
</div>
        
        {!isPC && (
        <div style={{ 
          position: 'fixed', bottom: 0, left: 0, right: 0, height: '75px', 
          background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', 
          justifyContent: 'space-around', alignItems: 'center', zIndex: 2000, 
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 15px rgba(0,0,0,0.05)' 
        }}>
          {/* 1. ライン（タイムライン） */}
          <button onClick={() => navigate(`/admin/${shopId}/timeline?date=${selectedDate}`)} style={mobileTabStyle(false, '#4b2c85')}>
            <Activity size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>ライン</span>
          </button>

          {/* 2. タスク（現場実行） */}
          <button onClick={() => navigate(`/admin/${shopId}/today-tasks`)} style={mobileTabStyle(false, '#1e293b')}>
            <Clipboard size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>タスク</span>
          </button>

          {/* 3. 今日（カレンダーの今日に戻る） */}
          <button onClick={goToday} style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            background: themeColorLight, border: `1px solid ${themeColor}33`, 
            color: themeColor, borderRadius: '15px', padding: '8px 15px', cursor: 'pointer' 
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>今日</span>
          </button>

          {/* 4. 管理（名簿・売上） */}
          <button onClick={() => navigate(`/admin/${shopId}/management`)} style={mobileTabStyle(false, '#008000')}>
            <BarChart3 size={22} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>管理</span>
          </button>
        </div>
      )}
      </div>

{/* 🆕 3択の名寄せ（マージ）確認モーダル */}
{showMergeConfirm && (
  <div 
    onClick={() => setShowMergeConfirm(false)} 
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 5000, 
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' 
    }}
  >
    <div 
      onClick={(e) => e.stopPropagation()} 
      style={{ 
        background: '#fff', width: '90%', maxWidth: '400px', borderRadius: '30px', 
        padding: '35px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' 
      }}
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
        {/* 選択肢A：店主が把握している名前（大造さん）を守る */}
        <button 
          onClick={() => handleMergeAction(mergeCandidate.id, mergeCandidate.name)}
          style={{ 
            padding: '18px', background: themeColor, color: '#fff', border: 'none', 
            borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' 
          }}
        >
          👤 既存の「{mergeCandidate?.name}」様に統合
        </button>

        {/* 選択肢B：お客様が新しく名乗った名前（ハム太郎）を正式採用してあげる */}
        <button 
          onClick={() => handleMergeAction(mergeCandidate.id, selectedRes.customer_name)}
          style={{ 
            padding: '16px', background: '#fff', color: themeColor, 
            border: `2px solid ${themeColor}`, borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer' 
          }}
        >
          🐹 今回の「{selectedRes?.customer_name}」様へ名前を更新
        </button>

        {/* 選択肢C：同姓同名の別人として新規登録 */}
        <button 
          onClick={() => {
            setShowMergeConfirm(false);
            finalizeOpenDetail(selectedRes, null); 
          }}
          style={{ padding: '12px', background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          🙅 同姓同名の別人として別名簿で管理
        </button>
      </div>
          </div>
  </div>
)}

{(showCustomerModal || showDetailModal) && (
        <div onClick={() => { if(selectedRes?.isRegularHoliday) return; setShowCustomerModal(false); setShowDetailModal(false); }} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '650px', position: 'relative' }}>
            
            {/* 🆕 最上部：ねじ込み予約ボタン (通常予約がある場合のみ表示) */}
            {selectedRes?.res_type === 'normal' && (
              <button 
  onClick={() => navigate(`/shop/${shopId}/reserve`, { 
    state: { 
      adminDate: selectedDate, 
      adminTime: targetTime, 
      fromView: 'calendar', // ✅ カレンダーから来た目印
      isAdminMode: true,
      adminStaffId: staffs.length === 1 ? staffs[0].id : null
    } 
  })} 
                style={{ 
                  width: '100%', 
                  padding: '16px', 
                  background: themeColor, 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '15px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  marginBottom: '20px',
                  fontSize: '1rem',
                  boxShadow: `0 4px 12px ${themeColor}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                ➕ この時間にさらに予約を入れる（ねじ込み）
              </button>
            )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                {showCustomerModal ? '👤 顧客マスター編集' : (selectedRes?.res_type === 'blocked' ? (selectedRes.isRegularHoliday ? '📅 定休日' : '🚫 ブロック設定') : '📅 予約詳細・名簿更新')}
              </h2>
              <button onClick={() => { setShowCustomerModal(false); setShowDetailModal(false); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '5px' }}>×</button>
            </div>

            {/* ✅ 🆕 修正：ブロック枠 または プライベート予定 の場合はシンプルUIを表示 */}
            {(selectedRes?.res_type === 'blocked' || selectedRes?.res_type === 'private_task') ? (
              
              /* ==========================================
                 🚫 A：シンプルUI（ブロック・プライベート予定専用）
                 ========================================== */
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

                  {/* 🆕 プライベート予定の場合のみ「メモ」を表示 */}
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

              /* ==========================================
                 👤 パターンB：通常予約（リッチな顧客カルテ ＆ 履歴）
                 ========================================== */
              <div style={{ display: 'grid', gridTemplateColumns: isPC ? '1fr 1fr' : '1fr', gap: '25px' }}>
                
                {/* 📝 左側：入力フォーム一式 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    
                    {/* 📋 予約メニュー内訳 */}
                    <div style={{ background: themeColorLight, padding: '16px', borderRadius: '15px', marginBottom: '20px', border: `1px solid ${themeColor}` }}>
      {/* 🆕 事業名の表示を追加 */}
      {categoryMap[selectedRes?.category] && (
        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
          🏢 受付事業：{categoryMap[selectedRes?.category]}
        </div>
      )}
      
      <label style={{ fontSize: '0.75rem', fontWeight: '900', color: themeColor, display: 'block', marginBottom: '10px' }}>📋 予約メニュー内訳</label>
      <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{selectedRes?.menu_name || 'メニュー未設定'}</div>
    </div>

                    {/* 🆕 修正：ここから動的フォーム（順番固定版） */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        // 🏆 三土手さん理想の表示順を定義
                        const fieldOrder = [
                          'name', 'furigana', 'email', 'phone', 
                          'zip_code', 'address', 'parking', 
                          'building_type', 'care_notes', 'company_name', 
                          'symptoms', 'request_details'
                        ];

                        return fieldOrder.map((key) => {
  // 表示判定（基本4項目 or 必須設定項目）
  if (!shouldShowInAdmin(key)) return null;

  return (
    <div key={key}>
      {/* 🆕 ラベルとショートカットボタンを横並びにするコンテナ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{getFieldLabel(key)}</label>

        {/* 📞 電話をかけるボタン (phoneかつデータがある時のみ) */}
        {key === 'phone' && editFields.phone && (
          <a 
            href={`tel:${editFields.phone}`}
            style={{ 
              textDecoration: 'none', 
              background: '#10b981', 
              color: '#fff', 
              padding: '2px 8px', 
              borderRadius: '6px', 
              fontSize: '0.65rem', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 4px rgba(16,185,129,0.2)'
            }}
          >
            <span>電話をかける</span> 📞
          </a>
        )}

        {key === 'name' && editFields.line_user_id && (
                              <span style={badgeStyle('#06C755')}>LINE連携済み ✅</span>
                            )}

        {/* 📍 マップを開くボタン (addressかつデータがある時のみ) */}
        {key === 'address' && editFields.address && (
          <a 
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editFields.address)}`}
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              textDecoration: 'none', 
              background: '#3b82f6', 
              color: '#fff', 
              padding: '2px 8px', 
              borderRadius: '6px', 
              fontSize: '0.65rem', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 4px rgba(59,130,246,0.2)'
            }}
          >
            <span>マップで開く</span> 📍
          </a>
        )}
      </div>

      {/* 💡 入力欄はスッキリ配置 */}
      {key === 'parking' ? (
        <select 
          value={editFields[key] || ''} 
          onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} 
          style={inputStyle}
        >
          <option value="">未選択</option>
          <option value="あり">あり</option>
          <option value="なし">なし</option>
        </select>
      ) : (
        <input 
          type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} 
          value={editFields[key] || ''} 
          onChange={(e) => setEditFields({...editFields, [key]: e.target.value})} 
          style={inputStyle} // 💡 以前入れた paddingRight 50px は不要なので削除
          placeholder="未登録"
        />
      )}
    </div>
  );
});
                      })()}

                      {/* 🆕 カスタム質問（ラジオボタン）の回答表示セクション */}
                      {shop?.form_config?.custom_questions?.map((q) => {
                        // 💡 editFields.custom_answers から回答を抽出
                        const answer = editFields.custom_answers?.[q.id];
                        // 必須である、または回答がある場合のみ表示
                        if (q.required || answer) {
                          return (
                            <div key={q.id} style={{ 
                              background: '#fff', 
                              padding: '12px', 
                              borderRadius: '12px', 
                              border: q.required ? `2px solid ${themeColor}33` : '1px solid #e2e8f0',
                              marginTop: '5px'
                            }}>
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

                      {/* 顧客メモ（マスタ共通）は常に一番下 */}
                      <div>
                        <label style={labelStyle}>顧客メモ（マスタ共通・内部用）</label>
                        <textarea 
                          value={editFields.memo} 
                          onChange={(e) => setEditFields({...editFields, memo: e.target.value})} 
                          style={{ ...inputStyle, height: '100px' }} 
                          placeholder="お客様には見えない管理者用メモです" 
                        />
                      </div>
                    </div>
                    
                    <button onClick={handleUpdateCustomer} style={{ width: '100%', padding: '14px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' }}>情報を保存</button>

                    {/* 🆕 2段構えの削除・キャンセルエリア */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <button 
                        onClick={() => cancelRes(selectedRes.id)} 
                        style={{ padding: '12px', background: '#fff', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        キャンセル処理
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

                {/* 🕒 右側：来店履歴エリア */}
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b' }}>🕒 来店履歴 ＆ 予定</h4>
                  <div style={{ height: isPC ? '420px' : '250px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '15px', background: '#f8fafc', padding: '5px' }}>
                    {customerHistory.map((h, idx) => {
                      const hDate = new Date(h.start_time);
                      const isToday = hDate.toLocaleDateString('sv-SE') === new Date().toLocaleDateString('sv-SE');
                      const hBrandLabel = categoryMap[h.biz_type];
                      // 🚀 1. キャンセル判定のフラグ
                      const isCanceled = h.status === 'canceled';

                      return (
                        <div 
                          key={h.id} 
                          style={{ 
                            padding: '15px', 
                            borderBottom: '1px solid #eee', 
                            background: isCanceled ? '#fcfcfc' : '#fff', // キャンセルなら背景をわずかにグレーに
                            borderRadius: isToday ? '12px' : '0', 
                            border: isToday ? `2px solid ${themeColor}` : 'none',
                            opacity: isCanceled ? 0.7 : 1, // キャンセルなら全体を少し薄く
                            position: 'relative'
                          }}
                        >
                          {/* 上段：日付と金額の行 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {/* 🚀 2. 日付に斜線を適用 */}
                              <span style={{ 
                                fontWeight: 'bold', 
                                fontSize: '0.9rem',
                                color: isCanceled ? '#94a3b8' : '#1e293b',
                                textDecoration: isCanceled ? 'line-through' : 'none' 
                              }}>
                                {hDate.toLocaleDateString('ja-JP')}
                              </span>
                              
                              {/* 屋号バッジ */}
                              {hBrandLabel && (
                                <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: h.biz_type === 'foot' ? '#4285f4' : '#d34817', color: '#fff', fontWeight: '900', whiteSpace: 'nowrap' }}>
                                  {hBrandLabel.slice(0, 5)}
                                </span>
                              )}

                              {/* 🚀 3. 「当日キャンセル」バッジを表示 */}
                              {isCanceled && (
                                <span style={{ fontSize: '0.6rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #fecaca' }}>
                                  当日キャンセル
                                </span>
                              )}
                            </div>

                            {/* 金額表示 */}
                            {(() => {
                              const displayPrice = h.total_price > 0 ? h.total_price : parseReservationDetails(h).totalPrice;
                              return (
                                <span style={{ 
                                  color: isCanceled ? '#94a3b8' : '#e11d48', 
                                  fontWeight: 'bold',
                                  fontSize: '0.9rem',
                                  textDecoration: isCanceled ? 'line-through' : 'none' 
                                }}>
                                  ¥{displayPrice.toLocaleString()}
                                  {h.total_price === 0 && <small style={{fontSize:'0.6rem', marginLeft:'2px'}}>(予)</small>}
                                </span>
                              );
                            })()}
                          </div>

                          {/* 下段：メニュー名 */}
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
            {!isPC && (
              <button onClick={() => { setShowCustomerModal(false); setShowDetailModal(false); }} style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>閉じる ✕</button>
            )}
          </div>
        </div>
      )}

{/* 👥 2. 予約者選択リストModal (複数予約がある場合に表示) */}
      {showSlotListModal && (
        <div onClick={() => setShowSlotListModal(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '450px', textAlign: 'center', background: '#f8fafc', padding: '25px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
              <p style={{ fontWeight: '900', color: themeColor, fontSize: '1.8rem', margin: 0 }}>{targetTime} の予約</p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '5px' }}>詳細を見たい方を選択してください</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto', padding: '5px' }}>
              {/* 🆕 最上部：ねじ込み予約ボタン (リストModal版) */}
              <div 
  onClick={() => {
    setShowSlotListModal(false);
    navigate(`/shop/${shopId}/reserve`, { 
      state: { 
        adminDate: selectedDate, 
        adminTime: targetTime, 
        fromView: 'calendar', // ✅ カレンダーから来た目印
        isAdminMode: true,
        adminStaffId: staffs.length === 1 ? staffs[0].id : null
      } 
    });
  }}
                style={{
                  background: themeColor,
                  padding: '18px',
                  borderRadius: '18px',
                  border: `2px solid ${themeColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: 'bold',
                  boxShadow: `0 4px 12px ${themeColor}44`,
                  marginBottom: '10px'
                }}
              >
                ➕ 新しい予約をねじ込む
              </div>

              {selectedSlotReservations.map((res, idx) => (
                <div key={res.id || idx} onClick={() => { setShowSlotListModal(false); openDetail(res); }} style={{ background: '#fff', padding: '18px', borderRadius: '18px', border: `1px solid #e2e8f0`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <div style={{ textAlign: 'left', flex: 1 }}>
<div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1e293b', marginBottom: '4px' }}>
  {res.res_type === 'blocked' ? `🚫 ${res.customer_name}` : `👤 ${res.customers?.admin_name || res.customer_name} 様`}
</div>
<div style={{ fontSize: '0.75rem', color: '#64748b' }}>
  {res.res_type === 'normal' ? (
    <>
      <div style={{ color: themeColor, fontWeight: 'bold' }}>📋 {res.menu_name || res.options?.services?.map(s => s.name).join(', ') || 'メニュー未設定'}</div>
      <div style={{ marginTop: '2px' }}>👤 担当: {res.staffs?.name || '店舗スタッフ'}</div>
    </>
  ) : 'スケジュールブロック'}
</div>
                  </div>
                  <div style={{ color: themeColor, fontSize: '1.2rem' }}>〉</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSlotListModal(false)} style={{ marginTop: '25px', padding: '12px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>

            {!isPC && (
              <button 
                onClick={() => setShowSlotListModal(false)} 
                style={{ 
                  position: 'fixed', 
                  bottom: '30px', 
                  left: '50%', 
                  transform: 'translateX(-50%)', 
                  background: '#1e293b', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '12px 40px', 
                  borderRadius: '50px', 
                  fontWeight: 'bold', 
                  boxShadow: '0 10px 20px rgba(0,0,0,0.3)', 
                  zIndex: 4000 
                }}
              >
                閉じる ✕
              </button>
            )}
          </div>
        </div>
      )}

{/* ⚙️ 3. 管理メニューModal (本家再現：ねじ込み予約・ブロック) */}
      {showMenuModal && (
        <div onClick={() => setShowMenuModal(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: '35px', borderRadius: '30px', width: '90%', maxWidth: '340px', textAlign: 'center', position: 'relative' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.9rem' }}>{selectedDate.replace(/-/g, '/')}</h3>
            <p style={{ fontWeight: '900', color: themeColor, fontSize: '2.2rem', margin: '0 0 30px 0' }}>{targetTime}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
<button 
  onClick={() => navigate(`/shop/${shopId}/reserve`, { 
    state: { 
      adminDate: selectedDate, 
      adminTime: targetTime, 
      fromView: 'calendar', // ✅ カレンダーから来た目印
      isAdminMode: true,
      adminStaffId: staffs.length === 1 ? staffs[0].id : null
    } 
  })} 
  style={{ padding: '22px', background: themeColor, color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.2rem' }}
>
  予約を入れる
</button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={handleBlockTime} style={{ padding: '15px', background: '#fff', color: themeColor, border: `2px solid ${themeColorLight}`, borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>「✕」または予定</button>
                <button onClick={handleBlockFullDay} style={{ padding: '15px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>今日を休みにする</button>
              </div>
<button onClick={() => setShowMenuModal(false)} style={{ padding: '15px', border: 'none', background: 'none', color: '#94a3b8' }}>キャンセル</button>
            </div>
            {!isPC && (
              <button onClick={() => setShowMenuModal(false)} style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>閉じる ✕</button>
            )}
          </div>
        </div>
)}

      {/* 🆕 追加：プライベート予定入力用モーダル */}
      {showPrivateModal && (
        <div style={overlayStyle} onClick={() => setShowPrivateModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ ...modalContentStyle, maxWidth: '400px', textAlign: 'center', position: 'relative', padding: '35px' }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🕒</div>
            <h3 style={{ margin: '0 0 5px 0', color: themeColor, fontWeight: '900' }}>プライベート予定</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '25px' }}>{selectedDate.replace(/-/g, '/')} {targetTime}</p>
            
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={labelStyle}>予定の内容（必須）</label>
              <input 
                type="text" 
                placeholder="例：休憩、買い出し、銀行など" 
                value={privateTaskFields.title}
                onChange={(e) => setPrivateTaskFields({ ...privateTaskFields, title: e.target.value })}
                style={inputStyle}
              />
              
              <label style={labelStyle}>メモ (任意)</label>
              <textarea 
                placeholder="詳細な内容があれば入力してください"
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
            
            {!isPC && (
              <button onClick={() => setShowPrivateModal(false)} style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '12px 40px', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 4000 }}>閉じる ✕</button>
            )}
          </div>
        </div>
      )}

      {/* 🆕 ここから追記：🏢 施設訪問詳細（名簿）モーダル本体 */}
{showVisitDetailModal && (
  <div style={overlayStyle} onClick={() => setShowVisitDetailModal(false)}>
    <div onClick={(e) => e.stopPropagation()} style={{ ...modalContentStyle, maxWidth: '500px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>🏢</div>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e293b' }}>{selectedRes?.customer_name}</h2>
        {/* 🆕 親予約がある場合に「継続分」と表示 */}
        {selectedRes?.parent_id && <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>※ 複数日訪問の継続分</span>}
      </div>

      {/* 🆕 【重要】残り人数のカウント計算 */}
      {(() => {
        const total = visitResidents.length;
        const remaining = visitResidents.filter(r => r.status === 'pending').length;
        const done = total - remaining;

        return (
          <div style={{ background: '#fcfaf7', padding: '15px', borderRadius: '15px', border: '1px solid #f0e6d2', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#948b83', fontWeight: 'bold', marginBottom: '5px' }}>施術の進捗状況</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#3d2b1f' }}>
              残り <span style={{ color: '#c5a059', fontSize: '2rem' }}>{remaining}</span> 名 / 全体 {total} 名
            </div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '5px', fontWeight: 'bold' }}>
              （現在までに {done} 名が完了済み）
            </div>
          </div>
        );
      })()}

      {/* 📋 施術予定者リスト（まだ残っている人を優先して表示） */}
      <p style={{ color: '#64748b', fontWeight: 'bold', marginBottom: '10px', fontSize: '0.85rem' }}>👥 本日の施術予定者（未完了の方）</p>
      <div style={{ maxHeight: '250px', overflowY: 'auto', background: '#f8fafc', borderRadius: '15px', padding: '10px', border: '1px solid #eee' }}>
        {visitResidents
          .filter(r => r.status === 'pending') // 💡 未完了の人だけリストに出す（スッキリ！）
          .map((item, idx) => (
            <div key={idx} style={{ background: '#fff', padding: '10px 15px', borderRadius: '10px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' }}>{item.members?.name} 様</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.members?.room}号室</div>
              </div>
              <span style={{ fontSize: '0.8rem', color: themeColor, fontWeight: 'bold' }}>{item.menu_name}</span>
            </div>
        ))}
        {visitResidents.filter(r => r.status === 'pending').length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>すべて完了しました！✨</div>
        )}
      </div>

      <button onClick={() => setShowVisitDetailModal(false)} style={{ width: '100%', marginTop: '20px', padding: '15px', background: '#3d2b1f', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
        詳細を閉じる
      </button>
    </div>
  </div>
)}
{/* 🆕 追記ここまで */}

{/* 🆕 追記：予約枠をピカッと光らせるアニメーション */}
<style>{`
        @keyframes flashGold {
          0% { 
            background-color: #fdd835 !important; /* 強めの黄色 */
            box-shadow: 0 0 40px #fdd835, inset 0 0 20px #fff; 
            transform: scale(1.1); /* 少し大きく浮かび上がる */
            z-index: 100;
          }
          70% {
            transform: scale(1.05);
          }
          100% { 
            /* 最終的には元の色に戻る（アニメーション終了で style の背景色に戻ります） */
            transform: scale(1);
            box-shadow: 0 0 0px transparent;
          }
        }
      `}</style>
      
    </div> // コンポーネント全体の閉じ
  );
}
// 🆕 画面切り替えスイッチ用のスタイル（これを追加してください）
const switchBtnStyle = (active) => ({ 
  padding: '5px 15px', 
  borderRadius: '6px', 
  border: 'none', 
  background: active ? '#fff' : 'transparent', 
  fontWeight: 'bold', 
  fontSize: '0.75rem', 
  cursor: 'pointer', 
  boxShadow: active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', 
  color: active ? '#1e293b' : '#64748b',
  transition: 'all 0.2s'
});
const mobileTabStyle = (active, color) => ({
  display: 'flex', 
  flexDirection: 'column', 
  alignItems: 'center', 
  justifyContent: 'center', 
  gap: '4px',
  background: 'none', 
  border: 'none', 
  color: active ? color : '#94a3b8',
  cursor: 'pointer', 
  flex: 1, 
  padding: '8px 0', 
  transition: 'all 0.2s'
});

const badgeStyle = (color) => ({
  textDecoration: 'none', 
  background: color, 
  color: '#fff',
  padding: '2px 8px', 
  borderRadius: '6px', 
  fontSize: '0.65rem',
  fontWeight: 'bold', 
  display: 'inline-flex', // 横並びにする
  alignItems: 'center', 
  gap: '4px',
  boxShadow: `0 2px 4px ${color}33`,
  marginLeft: '10px' // お名前の横に少し隙間を作る
});

export default AdminReservations;