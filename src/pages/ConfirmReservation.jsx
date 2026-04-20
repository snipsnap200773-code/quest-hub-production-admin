import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase, supabaseAnon } from '../supabaseClient';
import { Loader2, Sparkles, Clock } from 'lucide-react';
// 🎮 🆕 ゲームとの連絡係をインポート [cite: 2026-03-01]
import { triggerGameEvent } from '../components/game/GameBridge';

function ConfirmReservation() {
  const { shopId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // 🆕 修正1：Stateの追加（ここに4つのStateを定義します）
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedCustomers, setSuggestedCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [staffName, setStaffName] = useState('');
  // 🆕 追記：自動入力通知の表示管理 [cite: 2025-12-01]
  const [showAutoFillToast, setShowAutoFillToast] = useState(false);
  const [customAnswers, setCustomAnswers] = useState({});

  const { 
    people, 
    totalSlotsNeeded, 
    date, 
    time, 
    adminDate, 
    adminTime, 
    lineUser, 
    customShopName,
    staffId,
    fromView,
    visitorZip,
    visitorAddress,
    travelTimeMinutes,
    authUserProfile,
    isSalesExcluded,
    adminBizType
  } = location.state || {};
  
// 🚀 🆕 追加：URLの末尾にある ?type=○○ を読み取る処理
  const params = new URLSearchParams(window.location.search);
  const urlBizType = params.get('type');

  // 💡 管理者ねじ込みならstateの値を、お客様予約ならURLの値を最終的なキーとして採用する
  const finalBizType = adminBizType || urlBizType;
  
  const isAdminEntry = !!adminDate;


  const [shop, setShop] = useState(null);

  

  // 🆕 一括管理用のStateに変更
const [customerData, setCustomerData] = useState({
    name: '', 
    furigana: '', 
    email: '', 
    phone: '', 
    zip_code: visitorZip || '', 
    address: visitorAddress || '', // 🆕 届いた住所があればそれをセット、なければ空
    parking: '', 
    building_type: '', 
    care_notes: '', 
    company_name: '', 
    symptoms: '', 
    request_details: '', 
    notes: ''
  });
    const [formConfig, setFormConfig] = useState(null); // 🆕 フォーム設定用

// 🆕 46行目付近：fetchShop
  const fetchShop = async () => {
    try {
      console.log("🔍 クエストデータ取得開始... shopId:", shopId);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', shopId).single();
      
      if (error) {
        console.error("❌ Supabaseエラー:", error.message);
        return;
      }

if (data) {
        console.log("✅ クエストデータ取得成功:", data.business_name);
        setShop(data);
        const config = data.form_config || {};
        setFormConfig(config);
        
        // 🆕 カスタム質問があれば、回答Stateの初期値をセット
        if (config.custom_questions) {
          const initialAnswers = {};
          config.custom_questions.forEach(q => {
            initialAnswers[q.id] = ''; // 最初は未選択
          });
          setCustomAnswers(initialAnswers);
        }
      }
            else {
        console.warn("⚠️ データが空です。IDが間違っている可能性があります。");
      }
    } catch (err) {
      console.error("🔥 通信エラー:", err);
    }
  };

  // 🆕 修正：fetchStaffName をここに定義します！
const fetchStaffName = async () => {
    try {
      if (staffId) {
        // 1. 指名（staffId）がある場合はその人を優先
        const { data } = await supabase.from('staffs').select('name').eq('id', staffId).single();
        if (data) setStaffName(data.name);
      } else {
        // 🆕 2. 指名がない場合、店舗の全スタッフを確認
        const { data: staffs } = await supabase.from('staffs').select('name').eq('shop_id', shopId);
        
        if (staffs && staffs.length === 1) {
          // 🏆 スタッフが1人しかいないなら、その人を自動的に担当者にセット
          console.log("👤 1人営業のため担当者を自動設定:", staffs[0].name);
          setStaffName(staffs[0].name);
        }
      }
    } catch (err) {
      console.error("🔥 スタッフ取得エラー:", err);
    }
  };

// --- 修正後：Google/LINE共通でDBから全13項目を詳細に反映 ---
useEffect(() => {
  const checkUserAndStore = async () => {
    // 🆕 もし管理者による「ねじ込み（isAdminEntry）」なら、
    // ログイン中のGoogleユーザー（ハム太郎）の情報は一切使わず、真っさらな状態で始める
    if (isAdminEntry) {
      console.log("⚡ 管理者ねじ込みモード：ログインユーザー情報を無視します");
      return; 
    }

    // 以下は、一般客がマイページ等から予約する場合の既存ロジック
    if (authUserProfile) {
      setCustomerData(prev => ({
        ...prev,
        name: prev.name || authUserProfile.display_name || '',
        email: prev.email || authUserProfile.email || '',
        phone: prev.phone || authUserProfile.phone || '',
        zip_code: prev.zip_code || authUserProfile.zip_code || '',
        address: prev.address || authUserProfile.address || '',
      }));

      // 🆕 通知をフワッと出す [cite: 2025-12-01]
      setShowAutoFillToast(true);
      setTimeout(() => setShowAutoFillToast(false), 3000); // 3秒後に消す
    }

    // 2. 🆕 DB検索条件の構築（Google ID または LINE ID）
    const orConditions = [];
    if (authUserProfile?.id) orConditions.push(`auth_id.eq.${authUserProfile.id}`);
    if (lineUser?.userId) orConditions.push(`line_user_id.eq.${lineUser.userId}`);

    if (orConditions.length > 0) {
      // データベースから「三土手 大道」など過去に保存した全情報を探す
      const { data: cust } = await supabase
        .from('customers')
        .select('*')
        .or(orConditions.join(','))
        .eq('shop_id', shopId)
        .maybeSingle();

// 🏆 DBに店舗別の顧客データが見つかった場合
      if (cust) {
        console.log("✅ DBから過去の顧客データを反映:", cust.name);
        setCustomerData(prev => ({
          ...prev,
          // 🆕 マイページから入れた情報(prev)を優先し、なければ過去データ(cust)を使う [cite: 2025-12-01]
          name: prev.name || cust.name, 
          furigana: cust.furigana || '',
          phone: prev.phone || cust.phone,
          email: prev.email || cust.email,
          // 🆕 郵便番号と住所も、マイページの最新(prev)を最優先にする [cite: 2025-12-01]
          zip_code: prev.zip_code || cust.zip_code || visitorZip || '', 
          address: prev.address || cust.address || visitorAddress || '', 
          parking: cust.parking || '', 
          building_type: cust.building_type || '',
          care_notes: cust.care_notes || '',
          company_name: cust.company_name || '',
          symptoms: cust.symptoms || '', 
          request_details: cust.request_details || '',
          notes: cust.notes || '',
          custom_answers: cust.custom_answers || {} 
        }));
        setSelectedCustomerId(cust.id);
      }
    } else if (lineUser?.displayName) {
      // IDがどちらもない場合のフォールバック
      setCustomerData(prev => ({ ...prev, name: prev.name || lineUser.displayName }));
    }
  };

  checkUserAndStore();
  fetchShop();
  fetchStaffName();
}, [lineUser, authUserProfile, shopId]);

// 🆕 顧客検索ロジックを一括State（customerData.name）に対応
  useEffect(() => {
    const searchCustomers = async () => {
      if (!isAdminEntry || !customerData.name || customerData.name.length < 1 || selectedCustomerId) {
        setSuggestedCustomers([]);
        setSelectedIndex(-1);
        return;
      }
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .ilike('name', `%${customerData.name}%`)
        .limit(5);
      
      setSuggestedCustomers(data || []);
      setSelectedIndex(-1);
    };
    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerData.name, selectedCustomerId, isAdminEntry, shopId]);

// 🆕 候補から選んだ際、一括State（customerData）を更新
  const handleSelectCustomer = (c) => {
    setCustomerData({
      ...customerData,
      name: c.name,
      furigana: c.furigana || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '' // 住所データがあればそれもセット
    });
    setSelectedCustomerId(c.id);
    setSuggestedCustomers([]);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (suggestedCustomers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestedCustomers.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();
        handleSelectCustomer(suggestedCustomers[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setSuggestedCustomers([]);
      setSelectedIndex(-1);
    }
  };

  // 🆕 2. 入力ハンドラとスタイルの追加
  // 様々な入力項目（名前、住所、備考など）を一つのStateで管理するための関数
const handleInputChange = (e) => {
    let { name, value } = e.target;
    
    // 🆕 電話番号（phone）の場合は数字以外をその場で消す [cite: 2025-12-01]
    if (name === 'phone') {
      value = value.replace(/[^0-9]/g, '');
    }

    setCustomerData(prev => ({ ...prev, [name]: value }));
    if (name === 'name') setSelectedCustomerId(null);
  };

  // 動的に生成される入力フォーム（input/select/textarea）で共通利用するスタイル定義
  const inputStyle = { 
    width: '100%', 
    padding: '14px', 
    borderRadius: '10px', 
    border: '1px solid #ddd', 
    boxSizing: 'border-box', 
    fontSize: '1rem' 
  };

// ✅ 修正後の保存ロジック（handleReserve）
const handleReserve = async () => {
    // --- 1. バリデーションチェック（標準項目 ＆ カスタム質問） ---
    
    // A. 標準項目のチェック（お名前、電話番号、住所など）
    for (const [key, config] of Object.entries(formConfig)) {
      // 🆕 カスタム質問の配列はここではスキップする [cite: 2025-12-01]
      if (key === 'custom_questions') continue;

      const isEnabled = lineUser ? config.line_enabled : config.enabled;
      
      // 🆕 「設定画面で必須にチェックされている」かつ「表示されている」場合のみチェック [cite: 2025-12-01]
      if (isEnabled && config.required) {
        if (isAdminEntry && key !== 'name') continue; // 管理者ねじ込み時は名前以外スルー
        
        if (!customerData[key]) {
          alert(`${config.label}を入力してください`);
          return;
        }
      }
    }

    // 🆕 B. カスタム質問（ラジオボタン）の必須チェックを追加 [cite: 2025-12-01]
    if (formConfig.custom_questions && !isAdminEntry) {
      for (const q of formConfig.custom_questions) {
        const isEnabled = lineUser ? q.line_enabled : q.enabled;
        
        // 🆕 必須設定になっていて、かつ回答（customAnswers）が空の場合 [cite: 2025-12-01]
        if (isEnabled && q.required) {
          if (!customAnswers[q.id]) {
            alert(`質問「${q.label}」に回答してください`);
            return;
          }
        }
      }
    }

    setIsSubmitting(true);

    try {
      // 💡 🆕 追加：ファイナル・ガード（最終空き枠チェック）
      // 管理者の「ねじ込み」でない場合のみ、本当に枠が空いているか再確認する
      if (!isAdminEntry) {
        const targetDate = adminDate || date;
        const targetTime = adminTime || time;
        const checkStartTime = new Date(`${targetDate}T${targetTime}:00`).toISOString();

        // 同じ時間の予約が何件あるか、DBの最新情報を直接聞きに行く
        const { count, error: checkError } = await supabase
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .eq('start_time', checkStartTime)
          .eq('res_type', 'normal');

        if (checkError) throw checkError;

        // もしすでに最大数（マンツーマンなら1）に達していたら、ここで強制終了
        if (count >= (shop.max_capacity || 1)) {
          alert('申し訳ありません！タッチの差で他の予約が埋まってしまいました。もう一度時間を選び直してください。');
          setIsSubmitting(false);
          navigate(`/shop/${shopId}/reserve`); // 予約画面に戻す
          return;
        }
      }

      // --- ここから下は既存の保存処理 ---
      const getDetailedMenuLabel = () => {
        if (!people || people.length === 0) return 'メニューなし';
        
        return people.map((p, i) => {
          const personPrefix = people.length > 1 ? `${i + 1}人目: ` : '';
          const mainService = p.services.map(s => s.name).join(', ');
          
          // 💡 optionsが配列(複数選択)でもオブジェクト(単一選択)でも対応
          const allOpts = Object.values(p.options || {}).flat().filter(Boolean);
          const optNames = allOpts.map(o => o.option_name).join(', ');
          
          return optNames ? `${personPrefix}${mainService}（${optNames}）` : `${personPrefix}${mainService}`;
        }).join(' / ');
      };

      const menuLabel = getDetailedMenuLabel();

      // --- 3. 日時と終了バッファの計算 ---
      const targetDate = adminDate || date;
      const targetTime = adminTime || time;
      const startDateTime = new Date(`${targetDate}T${targetTime}:00`);
      
// 🆕 日時と終了バッファの計算（準備時間を確実に含める）
// 🆕 1日貸切モード対応：終了時刻の算出ロジック
    const interval = shop.slot_interval_min || 15;
    const buffer = shop.buffer_preparation_min || 0;

    // 現在選択されている全メニューの中から「1日貸切」設定のものを探す
    const selectedServicesList = (people || []).flatMap(p => p.services || []);
    const fullDayMenu = selectedServicesList.find(s => s.is_full_day);

    let totalMinutes;

    if (fullDayMenu) {
      // 💡 1日貸切の場合
      if (fullDayMenu.restricted_hours && fullDayMenu.restricted_hours.length > 0) {
        // 設定された「受付時間制限」の終了時刻までを占有
        const activeRange = fullDayMenu.restricted_hours.find(r => targetTime >= r.start && targetTime < r.end);
        if (activeRange) {
          const [startH, startM] = targetTime.split(':').map(Number);
          const [endH, endM] = activeRange.end.split(':').map(Number);
          totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        } else {
          totalMinutes = (totalSlotsNeeded * interval) + buffer + (travelTimeMinutes || 0);
        }
      } else {
        // 制限がない場合は「店舗の閉店時間」までを占有
        const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(targetDate).getDay()];
        const closeTime = shop.business_hours[dayOfWeek]?.close || "18:00";
        const [startH, startM] = targetTime.split(':').map(Number);
        const [closeH, closeM] = closeTime.split(':').map(Number);
        totalMinutes = (closeH * 60 + closeM) - (startH * 60 + startM);
      }
    } else {
      // 通常メニューの場合
      totalMinutes = (totalSlotsNeeded * interval) + buffer + (travelTimeMinutes || 0);
    }

    const endDateTime = new Date(startDateTime.getTime() + totalMinutes * 60000);
          
      const cancelToken = crypto.randomUUID();
      const cancelUrl = `https://questhub-portal.vercel.app/cancel?token=${cancelToken}`;

      let finalStaffId = staffId;
      let finalStaffName = staffName;

      // スタッフ自動特定（1名のみの場合）
      if (!finalStaffId) {
        const { data: staffs } = await supabase.from('staffs').select('id, name').eq('shop_id', shopId);
        if (staffs && staffs.length === 1) {
          finalStaffId = staffs[0].id;
          finalStaffName = staffs[0].name;
        }
      }

// 既存顧客の検索（名寄せ）
      let finalCustomerId = selectedCustomerId;
      let existingCust = null;

      if (!finalCustomerId) {
        const orConditions = [];

        // ✅ a. Googleログイン済みなら、前の画面から引き継いだIDで探す（getUserを呼ばなくてOK！）
        if (authUserProfile?.id) {
          orConditions.push(`auth_id.eq.${authUserProfile.id}`);
        }
        
        // b. LINE ID で探す
        if (lineUser?.userId) {
          orConditions.push(`line_user_id.eq.${lineUser.userId}`);
        }
        
// c. 電話番号で探す（数字のみを抽出して比較） [cite: 2025-12-01]
        const cleanPhone = customerData.phone?.replace(/[^0-9]/g, '');
        if (cleanPhone && cleanPhone !== '') {
          orConditions.push(`phone.eq.${cleanPhone}`);
        }

        const { data: matched } = await supabase
          .from('customers')
          .select('id, name, admin_name, total_visits')
          .or(orConditions.length > 0 ? orConditions.join(',') : `name.eq.${customerData.name}`)
          .eq('shop_id', shopId)
          .maybeSingle();

        if (matched) {
          finalCustomerId = matched.id;
          existingCust = matched;
        }
      }

// --- 4. 顧客名簿（customers）の保存・更新 ---
      const customerPayload = {
        shop_id: shopId,
        name: customerData.name,
        auth_id: authUserProfile?.id || null,
        furigana: customerData.furigana || null,
        phone: customerData.phone?.replace(/[^0-9]/g, '') || null,
        email: customerData.email || null,
        zip_code: visitorZip || null, 
        address: customerData.address || null,
        // 🆕 業種別項目を追加
        parking: customerData.parking || null,
        building_type: customerData.building_type || null,
        care_notes: customerData.care_notes || null,
        company_name: customerData.company_name || null,
        symptoms: customerData.symptoms || null,
        request_details: customerData.request_details || null,
        notes: customerData.notes || null,
        // 🆕 カスタム質問（もしあれば）
        custom_answers: customerData.custom_answers || null,
        
        line_user_id: lineUser?.userId || null,
        total_visits: (existingCust?.total_visits || 0) + 1,
        last_arrival_at: startDateTime.toISOString(),
        updated_at: new Date().toISOString()
      };

// --- 298行目付近：修正版 ---
      if (finalCustomerId) {
        // 🚀 🆕 修正：既存顧客の情報を更新する際、入力がある場合のみ上書きする
        const updatePayload = {
          total_visits: (existingCust?.total_visits || 0) + 1,
          last_arrival_at: startDateTime.toISOString(),
          updated_at: new Date().toISOString()
        };

        // 💡 もし画面で「ふりがな」が入力されていたら、マスタも最新の名前に更新する
        if (customerData.furigana) {
          updatePayload.furigana = customerData.furigana;
        }

        if (authUserProfile?.id && !existingCust?.auth_id) {
          updatePayload.auth_id = authUserProfile.id;
        }
        if (lineUser?.userId && !existingCust?.line_user_id) {
          updatePayload.line_user_id = lineUser.userId;
        }

        // 実績データと、入力があった項目だけを更新
        await supabase.from('customers').update(updatePayload).eq('id', finalCustomerId);

      } else {
        // 全くの新規客（finalCustomerIdがない）の場合のみ、入力された全項目を名簿に新規作成
        const { data: newCust, error: insError } = await supabase.from('customers').insert([customerPayload]).select().single();
        if (insError) throw insError;
        finalCustomerId = newCust.id;
      }
      
      // 修正箇所：customer_name の決定ロジック
      const finalDisplayName = existingCust?.admin_name || existingCust?.name || customerData.name;
      // ✅ 予約データの挿入
      const { error: dbError } = await supabase.from('reservations').insert([
        {
          shop_id: shopId,
          customer_id: finalCustomerId,
          staff_id: finalStaffId,
          reservation_date: targetDate, 
          customer_name: finalDisplayName,
          customer_phone: customerData.phone || '---',
          customer_email: customerData.email || null,
          zip_code: customerData.zip_code || null,
          // 🆕 ここを start_time と end_time の2つだけに絞ります
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(), 
          total_slots: totalSlotsNeeded,
          res_type: 'normal',
          biz_type: location.state?.bizType,
          line_user_id: lineUser?.userId || null,
          cancel_token: cancelToken,
          menu_name: menuLabel,
          options: { 
            people: people,
            applied_shop_name: customShopName || shop.business_name,
            // 🆕 重要：ここに「売上対象外」という印を刻む！
            is_sales_excluded: isSalesExcluded, 
            visit_info: {
              address: customerData.address,
              parking: customerData.parking,
              custom_answers: customAnswers 
            }
          }
        }
      ]);

      if (dbError) throw dbError;

      // 通知の送信
// ✅ 修正ポイント：宛先メールアドレスと詳細データをすべて backend へ送る
// 通知の送信
      if (!isAdminEntry) {
        // 🆕 名簿(existingCust)に名前があればそちらを、なければ入力された名前(customerData.name)を使用
        const displayNameForEmail = (existingCust && existingCust.name) 
                                      ? existingCust.name 
                                      : customerData.name;

        const allFlattenedOptions = people.flatMap(p => Object.values(p.options || {}).flat()).filter(Boolean);

        await supabaseAnon.functions.invoke('resend', {
          body: {
            type: 'booking', 
            shopId,
            customerName: finalDisplayName, // ✅ 書き換えられた名前を送る
            staffName: finalStaffName || staffName,
            shopName: customShopName || shop.business_name, // 🆕 追加
            startTime: `${targetDate.replace(/-/g, '/')} ${targetTime}`,
            services: menuLabel,
            allOptions: allFlattenedOptions,
            customerEmail: customerData.email, // 🆕 これがないとお客様に届きません！
            shopEmail: shop.email_contact,     // 🆕 これがないと店舗に届きません！
            lineUserId: lineUser?.userId || null,
            cancelUrl: cancelUrl,
            // 🆕 フォームの全入力データを送る
            ...customerData, 
            custom_answers: customAnswers,
            buildingType: customerData.building_type, // 変数名の微調整
            careNotes: customerData.care_notes,
            requestDetails: customerData.request_details
          }
        });
      }      
if (isAdminEntry) {
  // 🚀 管理者の「ねじ込み」は作業効率優先で、ポップアップなしで即戻る
  // 🆕 state に「fromReserve: true」を追加して、カレンダー側にスクロール禁止を伝えます
  navigate(`/admin/${shopId}/reservations?date=${targetDate}`, { 
    state: { newlyAdded: true, fromReserve: true } 
  });
} else {
  // 🚀 一般ユーザーは達成感を味わってもらうために「完了ページ」へ
  navigate('/reserved-success', { 
    state: { 
      shopName: customShopName || shop.business_name,
      startTime: `${targetDate.replace(/-/g, '/')} ${targetTime}`
    } 
  });
}

    } catch (err) {
      console.error(err);
      alert(`エラーが発生しました: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };    
// 🆕 読み込み中であることを視覚化する
  if (!shop) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ marginBottom: '20px', fontSize: '2rem', animation: 'spin 2s linear infinite' }}>⌛</div>
        <p style={{ fontWeight: 'bold' }}>クエスト情報を読み込み中...</p>
        <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>画面が変わらない場合は、DB接続を確認してください。</p>
      </div>
    );
  }
    const themeColor = shop?.theme_color || '#2563eb';
  const displayDate = (adminDate || date).replace(/-/g, '/');
  const displayTime = adminTime || time;

  // ✅ 🆕 修正：選択中の全メニューから「時間制限」があるものを抽出
  const selectedServices = (people || []).flatMap(p => p.services || []);
  const restrictedServices = selectedServices.filter(s => s.restricted_hours && s.restricted_hours.length > 0);

return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333' }}>

      {/* 🚀 🆕 ここから追加：送信中のフルスクリーン・メッセージ */}
      {isSubmitting && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.9)', // 白背景で少し透けさせる
          zIndex: 10000, // 他の要素より一番上に
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          backdropFilter: 'blur(5px)' // 背景をぼかすとおしゃれです
        }}>
          {/* グルグル回るアイコン */}
          <Loader2 size={48} color={themeColor} style={{ animation: 'spin 1s linear infinite' }} />
          
          <div style={{ textAlign: 'center', padding: '0 20px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontWeight: '900' }}>
              予約を送信中...
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: '1.6' }}>
              <b>この処理は10秒ほどかかる場合があります。</b><br />
              画面を閉じずにお待ちください。
            </p>
          </div>
        </div>
      )}
      {/* 🚀 🆕 ここまで追加 */}
      
      {/* 🆕 1. ここに追加：自動入力通知 [cite: 2025-12-01] */}
      <div style={{
        position: 'fixed',
        top: showAutoFillToast ? '20px' : '-60px', // showAutoFillToastがtrueの時だけ降りてくる
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#07aadb', // ポータルカラー
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '50px',
        fontSize: '0.85rem',
        fontWeight: '900',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 10px 25px rgba(7, 170, 219, 0.4)',
        transition: 'all 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28)', // 弾むようなアニメーション [cite: 2026-03-02]
        pointerEvents: 'none' // 下にあるボタンの邪魔をしない
      }}>
        <Sparkles size={18} />
        <span>マイページの情報を反映しました</span>
      </div>

      {/* --- 以下、既存の「戻る」ボタンなどが続きます --- */}
      <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', border: 'none', background: 'none', color: '#666', cursor: 'pointer', fontWeight: 'bold' }}>← 戻る</button>
      
      <h2 style={{ borderLeft: isAdminEntry ? '4px solid #e11d48' : `4px solid ${themeColor}`, paddingLeft: '10px', fontSize: '1.2rem', marginBottom: '25px' }}>
          {isAdminEntry ? '⚡ 店舗ねじ込み予約（入力短縮）' : '予約内容の確認'}
      </h2>

      {lineUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
          <img src={lineUser.pictureUrl} style={{ width: '40px', height: '40px', borderRadius: '50%' }} alt="LINE" />
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534' }}>LINE連携：{lineUser.displayName} 様</div>
        </div>
      )}

      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '15px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
        <p style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 'bold', color: themeColor }}>
          🏨 {customShopName || shop.business_name}
        </p>
        <p style={{ margin: '0 0 12px 0' }}>📅 <b>日時：</b> {displayDate} {displayTime} 〜</p>
        
        {staffName && (
          <p style={{ margin: '0 0 12px 0' }}>👤 <b>担当：</b> {staffName}</p>
        )}

        <p style={{ margin: '0 0 8px 0' }}>📋 <b>選択メニュー：</b></p>
        <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '0.85rem' }}>
          {people && people.map((person, idx) => (
            <div key={idx} style={{ marginBottom: idx < people.length - 1 ? '10px' : 0, paddingBottom: idx < people.length - 1 ? '10px' : 0, borderBottom: idx < people.length - 1 ? '1px dashed #eee' : 'none' }}>
              {people.length > 1 && (
                <div style={{ fontWeight: 'bold', color: themeColor, marginBottom: '4px' }}>{idx + 1}人目</div>
              )}
              <div style={{ fontWeight: 'bold', lineHeight: '1.4' }}>
  {person.fullName.split('/').map((text, i) => (
    <React.Fragment key={i}>
      {text.trim()}
      {i < person.fullName.split('/').length - 1 && <br />}
    </React.Fragment>
  ))}
</div>
            </div>
          ))}

          {/* ✅ 🆕 差し込み：時間制限があるメニューへの補足案内 */}
          {restrictedServices.length > 0 && (
            <div style={{ 
              marginTop: '15px', 
              padding: '12px', 
              background: '#fff7ed', 
              borderRadius: '10px', 
              border: '1px solid #ffedd5', 
              animation: 'fadeIn 0.5s ease' 
            }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#c2410c', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> 受付時間に関するお知らせ
              </p>
              {restrictedServices.map((s, idx) => (
                <div key={idx} style={{ fontSize: '0.75rem', color: '#9a3412', lineHeight: '1.4' }}>
<div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
  <span>・</span>
  <div style={{ flex: 1 }}>
    <b style={{ lineHeight: '1.3' }}>
      {s.name.split('/').map((text, i) => (
        <React.Fragment key={i}>
          {text.trim()}
          {i < s.name.split('/').length - 1 && <br />}
        </React.Fragment>
      ))}
    </b>
    <span> は、専用枠（{s.restricted_hours.map(r => `${r.start}〜${r.end}`).join(', ')}）でのみ受け付けております。</span>
  </div>
</div>                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* --- 1. 基本項目 & 業種別項目のループ --- */}
        {formConfig && Object.entries(formConfig).map(([key, config]) => {
          const isEnabled = lineUser ? config.line_enabled : config.enabled;
          
          // 表示しない条件
          if (!isEnabled) return null;
          if (isAdminEntry && key !== 'name') return null;
          
          // ⚠️ ふりがな、備考欄、郵便番号はこのループ内では直接描画しない（位置を固定するため）
          if (key === 'furigana' || key === 'notes' || key === 'zip_code') return null;

          return (
            <React.Fragment key={key}>
              {/* 各入力項目の div */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
<span style={{ lineHeight: '1.2' }}>
  {config.label.split('/').map((text, i) => (
    <React.Fragment key={i}>
      {text.trim()}
      {i < config.label.split('/').length - 1 && <br />}
    </React.Fragment>
  ))}
</span>
{config.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>

                {key === 'name' ? (
                  <>
                    <input 
                      name="name"
                      type="text" 
                      autoComplete="off"
                      value={customerData.name} 
                      onChange={handleInputChange} 
                      onKeyDown={handleKeyDown}
                      placeholder={`${config.label}を入力`} 
                      style={inputStyle} 
                    />
                    {isAdminEntry && suggestedCustomers.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '10px', zIndex: 100, border: '1px solid #eee', overflow: 'hidden' }}>
                        {suggestedCustomers.map((c, index) => (
                          <div 
                            key={c.id} 
                            onClick={() => handleSelectCustomer(c)} 
                            style={{ 
                              padding: '12px', 
                              borderBottom: '1px solid #f8fafc', 
                              cursor: 'pointer', 
                              fontSize: '0.9rem',
                              background: index === selectedIndex ? `${themeColor}15` : 'transparent'
                            }}
                          >
                            <b>{c.name} 様</b> <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({c.phone || '電話なし'})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : key === 'parking' ? (
                  <select name={key} value={customerData[key]} onChange={handleInputChange} style={inputStyle} required={config.required}>
                    <option value="">選択してください</option>
                    <option value="あり">あり</option>
                    <option value="なし">なし</option>
                  </select>
                ) : (
                  <input 
                    name={key}
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} 
                    value={customerData[key]} 
                    onChange={handleInputChange} 
                    style={inputStyle} 
                    placeholder={`${config.label}を入力`}
                    required={config.required} 
                  />
                )}
              </div>

              {/* 🏆 お名前の直後に強制的に「ふりがな」を挿入 */}
              {key === 'name' && formConfig.furigana && (lineUser ? formConfig.furigana.line_enabled : formConfig.furigana.enabled) && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {formConfig.furigana.label} {formConfig.furigana.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input 
                    name="furigana"
                    type="text" 
                    value={customerData.furigana} 
                    onChange={handleInputChange} 
                    style={inputStyle} 
                    placeholder={`${formConfig.furigana.label}を入力`}
                    required={formConfig.furigana.required} 
                  />
                </div>
              )}

              {/* 🏆 電話番号（phone）の直後に「郵便番号」を挿入するよう変更 */}
              {key === 'phone' && formConfig.zip_code && (lineUser ? formConfig.zip_code.line_enabled : formConfig.zip_code.enabled) && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {formConfig.zip_code.label} {formConfig.zip_code.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input 
                    name="zip_code"
                    type="text" 
                    value={customerData.zip_code} 
                    onChange={handleInputChange} 
                    style={inputStyle} 
                    placeholder="例: 123-4567"
                    required={formConfig.zip_code.required} 
                  />
                </div>
              )}
            </React.Fragment>
          );
})}

        {/* 🆕 【新設】カスタム質問（ラジオボタン）の表示エリア */}
        {formConfig?.custom_questions?.map((q) => {
          const isEnabled = lineUser ? q.line_enabled : q.enabled;
          if (!isEnabled || isAdminEntry) return null; // 管理者ねじ込み時は表示しない

          return (
            <div key={q.id} style={{ marginBottom: '20px', padding: '15px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '12px', color: '#1e293b' }}>
                {q.label} {q.required && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {q.options.split(',').map((opt) => (
                  <label key={opt} style={{ 
                    flex: '1', minWidth: '100px', padding: '10px', borderRadius: '10px', border: '2px solid',
                    borderColor: customAnswers[q.id] === opt ? themeColor : '#e2e8f0',
                    background: customAnswers[q.id] === opt ? `${themeColor}05` : '#fff',
                    textAlign: 'center', cursor: 'pointer', fontSize: '0.9rem', transition: '0.2s'
                  }}>
                    <input 
                      type="radio" 
                      name={q.id} 
                      value={opt} 
                      checked={customAnswers[q.id] === opt}
                      onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                      style={{ display: 'none' }} 
                    />
                    <span style={{ color: customAnswers[q.id] === opt ? themeColor : '#64748b', fontWeight: customAnswers[q.id] === opt ? 'bold' : 'normal' }}>
                      {opt}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* --- 2. 備考欄を一番最後に固定 --- */}
                {!isAdminEntry && formConfig.notes && (lineUser ? formConfig.notes.line_enabled : formConfig.notes.enabled) && (
          <div style={{ marginTop: '10px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
              {formConfig.notes.label} {formConfig.notes.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <textarea 
              name="notes" 
              value={customerData.notes} 
              onChange={handleInputChange} 
              style={{ ...inputStyle, minHeight: '100px', resize: 'none' }} 
              placeholder={`${formConfig.notes.label}があれば入力してください`}
              required={formConfig.notes.required} 
            />
          </div>
        )}

<button 
          onClick={handleReserve} 
          disabled={isSubmitting} 
          style={{ 
            marginTop: '20px', padding: '18px', 
            // 🆕 送信中は中央揃えにしてアイコンと文字を並べる
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: isSubmitting ? '#94a3b8' : (isAdminEntry ? '#e11d48' : themeColor), 
            color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', 
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: `0 4px 12px ${themeColor}33`,
            width: '100%' // 幅を安定させる
          }}
        >
          {isSubmitting ? (
            <>
              {/* 🆕 styleに直接アニメーションを書いています。これでグルグル回ります */}
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
              <span>予約を確定しています...</span>
            </>
          ) : (
            isAdminEntry ? '🚀 ねじ込んで名簿登録' : '予約を確定する'
          )}
        </button>

        {/* 🆕 グルグル回すための専用のアニメーション命令（一度書けばOK） */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
              </div>
    </div>
  );
}

export default ConfirmReservation;