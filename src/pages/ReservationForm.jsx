import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
// ✅ 修正：通知専用の supabaseAnon もインポートに追加
import { supabase, supabaseAnon } from '../supabaseClient';
// 💡 重要：LINEログイン（LIFF）を操作するためのSDK
import liff from '@line/liff';
// ✅ アイコンとボタン部品を追加
import { MapPin, CheckCircle2, ChevronRight } from 'lucide-react';

function ReservationForm() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 管理者画面からの「ねじ込み予約」データ
  const isAdminMode = location.state?.adminDate && location.state?.adminTime;
  const adminDate = location.state?.adminDate;
  const adminTime = location.state?.adminTime;
  const adminStaffId = location.state?.adminStaffId;
  const fromView = location.state?.fromView;

  // 💡 LINE経由判定
  const queryParams = new URLSearchParams(location.search);
  const isLineSource = queryParams.get('source') === 'line';
  const isLineApp = /Line/i.test(navigator.userAgent);

  // 🆕 【重要】入り口識別キー（?type=xxx）を取得
  const entryType = queryParams.get('type');
  // 🆕 スタッフID（?staff=xxx）を取得
  const staffIdFromUrl = queryParams.get('staff');

  // 基本データState
  const [shop, setShop] = useState(null);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [options, setOptions] = useState([]);
const [targetStaffName, setTargetStaffName] = useState(''); 
  const [autoStaffId, setAutoStaffId] = useState(null); // 🆕 自動セットされたスタッフIDを保存  

  // ✅ 1. 訪問型とみなす業種リスト（BasicSettingsの選択肢と合わせる）
const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];

  // ✅ 2. 新しいState
  const [visitorZip, setVisitorZip] = useState(''); // 🆕 追加：郵便番号用
  const [visitorAddress, setVisitorAddress] = useState('');
  const [isAddressFixed, setIsAddressFixed] = useState(false);
  const [isVisitService, setIsVisitService] = useState(false);

  // --- 複数名予約用のState ---
  // --- 複数名予約用のState ---
  const [people, setPeople] = useState([]); 
  const [selectedServices, setSelectedServices] = useState([]); 
  const [selectedOptions, setSelectedOptions] = useState({}); 
  
  const [loading, setLoading] = useState(true);
  const [lineUser, setLineUser] = useState(null);
  // 🆕 Googleログインユーザーのプロフィールを保持するState

  const [authUserProfile, setAuthUserProfile] = useState(null);
  // 🆕 【着せ替え用】画面に表示するブランド情報
  const [displayBranding, setDisplayBranding] = useState({ name: '', desc: '' });

  const categoryRefs = useRef({});
  const serviceRefs = useRef({});

  useEffect(() => {
    // 🆕 ページ表示時に強制的に最上部へ
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    fetchData();
    // 💡 ここでの initLiff() 呼び出しは削除します
  }, [shopId]);
  
  const initLiff = async (dynamicLiffId) => {
    try {
      if (!dynamicLiffId) {
        console.warn('LIFF IDが設定されていません');
        return;
      }
      await liff.init({ liffId: dynamicLiffId }); 
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        setLineUser(profile);
      } else {
        liff.login(); 
      }
    } catch (err) {
      console.error('LIFF Initialization failed', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const shopRes = await supabase.from('profiles').select('*').eq('id', shopId).single();
    
if (shopRes.data) {
      // ✅ 🆕 差し込み：プラン1 且つ 管理者モードでない場合はブロック
      if (shopRes.data.service_plan === 1 && !isAdminMode) {
        setShop(null); // shopを空にする
        setLoading(false);
        return; 
        // 💡 これで、下の「店舗が見つかりません」または「予約受付停止」の画面になります
      }

      setShop(shopRes.data);
            
      // ✅ 1. キーワードが含まれているか判定（キーワード方式）
      const businessTypeName = shopRes.data.business_type || '';
      const isVisit = VISIT_KEYWORDS.some(keyword => businessTypeName.includes(keyword));
      
      setIsVisitService(isVisit);

      // 来店型（isVisitがfalse）なら、最初から住所入力をスキップ（確定状態）にする
      if (!isVisit) {
        setIsAddressFixed(true);
      }

      // ✅ 2. LINEログイン（LIFF）の初期化（これは絶対に消さない！）
      if (shopRes.data.liff_id && (isLineSource || isLineApp)) {
        initLiff(shopRes.data.liff_id);
      }
            
      // ✅ 1. まずは初期値として本来の店名と説明文をセット
      setDisplayBranding({ 
        name: shopRes.data.business_name, 
        desc: shopRes.data.description 
      });

      // 🆕 管理者モード：ねじ込み対象スタッフの名前を取得
      if (isAdminMode && adminStaffId) {
        const { data: sData } = await supabase.from('staffs').select('name').eq('id', adminStaffId).single();
        if (sData) setTargetStaffName(sData.name);
      } else if (isAdminMode && !adminStaffId) {
        setTargetStaffName('フリー（担当なし）');
      }

      if (!shopRes.data.is_suspended) {
        // カテゴリ取得
// ✅ 🆕 修正：店販商品用カテゴリと調整用カテゴリを除外して取得する
let catQuery = supabase.from('service_categories')
  .select('*')
  .eq('shop_id', shopId)
  // 💡 調整用カテゴリ（is_adjustment_cat）が null または false のものだけ
  .or('is_adjustment_cat.is.null,is_adjustment_cat.eq.false')
  // 💡 店販商品用カテゴリ（is_product_cat）が null または false のものだけ
  .or('is_product_cat.is.null,is_product_cat.eq.false')
  .order('sort_order');
          const catRes = await catQuery;
        
        if (catRes.data) {
          // ✅ 修正：施設専用（is_facility_only）フラグをチェックする
          const filteredCats = catRes.data.filter(c => {
            // 1. 施設専用フラグが TRUE のものは、一般予約フォームでは常に非表示にする
            if (c.is_facility_only) return false;

            // 2. 既存の入り口識別キー（url_key）による絞り込み
            return entryType ? c.url_key === entryType : !c.url_key;
          });
          
          setCategories(filteredCats);

          // 🆕 3. 【強制着せ替えロジック】
          if (entryType) {
            const brandingSource = catRes.data.find(c => c.url_key === entryType);
            if (brandingSource) {
              setDisplayBranding({
                name: brandingSource.custom_shop_name || shopRes.data.business_name,
                desc: brandingSource.custom_description || shopRes.data.description
              });
            }
          }
        }

        const servRes = await supabase
  .from('services')
  .select('*')
  .eq('shop_id', shopId)
  .or('show_on_print.is.null,show_on_print.eq.false') // ✅ false または null のものを取得
  .order('sort_order');

if (servRes.data) setServices(servRes.data);
const optRes = await supabase.from('service_options').select('*');
        if (optRes.data) setOptions(optRes.data);

        // ✅ スタッフが一人なら自動セットするロジック（State版）
        const { data: staffList } = await supabase.from('staffs').select('*').eq('shop_id', shopId);
        if (staffList && staffList.length === 1 && !isAdminMode && !staffIdFromUrl) {
          console.log("👤 1人営業のため担当者を自動設定:", staffList[0].name);
          setTargetStaffName(staffList[0].name);
setAutoStaffId(staffList[0].id); // Stateに保存
        }

// 🆕 Googleログインユーザー情報の取得
        // 🛡️ 管理者ねじ込みモード(isAdminMode)の場合は、ログイン情報を無視する
        const { data: { user } } = await supabase.auth.getUser();
        if (user && !isAdminMode) {
          // 🆕 住所(address)と郵便番号(zip_code)を select に追加 [cite: 2025-12-01]
          const { data: profile } = await supabase
            .from('app_users')
            .select('display_name, email, phone, address, zip_code')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile) {
            setAuthUserProfile(profile);

            // 🆕 訪問型(isVisit) かつ マイページに住所がある場合、Stateにセットする [cite: 2025-12-01]
            if (isVisit && profile.address) {
              setVisitorZip(profile.zip_code || '');
              setVisitorAddress(profile.address || '');
              setIsAddressFixed(true); // 👈 これで入力欄を閉じてメニュー選択へ進める
              console.log("🏠 マイページから訪問先住所を自動セットしました");
            }
          }
        } else if (isAdminMode) {
              console.log("🛡️ 管理者モード：ログインユーザー情報を読み込みません");
        }
        
      } // !shopRes.data.is_suspended の閉じ
    } // shopRes.data の閉じ
    setLoading(false);
  };
  // ✅ 追加：リピーター対応（LINEログイン後に名簿から前回の住所を自動セット）
  useEffect(() => {
    const fetchPreviousAddress = async () => {
      // 訪問型サービス かつ LINEユーザーが判明している かつ 住所がまだ空 の場合
      if (isVisitService && lineUser?.userId && !visitorAddress) {
        const { data: cust } = await supabase
          .from('customers')
          .select('address')
          .eq('shop_id', shopId)
          .eq('line_user_id', lineUser.userId)
          .maybeSingle();

        if (cust?.address) {
          console.log("🏠 前回の住所を自動セットしました:", cust.address);
          setVisitorAddress(cust.address);
          setIsAddressFixed(true); // 住所があれば最初からメニューを表示状態にする
        }
      }
    };
fetchPreviousAddress();
  }, [lineUser, isVisitService, shopId]);

  // 🆕 【ここに追加！】郵便番号から住所を自動取得する関数
  const handleZipSearch = async () => {
    // 1. 入力チェック（7桁あるか）
    if (visitorZip.length < 7) {
      alert("郵便番号を7桁で入力してください（ハイフンなし）");
      return;
    }

    try {
      // 2. 無料のAPI（zipcloud）に問い合わせ
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${visitorZip}`);
      const data = await res.json();

      if (data.results) {
        // 3. 成功したら住所をセット
        const { address1, address2, address3 } = data.results[0];
        const fullAddress = `${address1}${address2}${address3}`;
        setVisitorAddress(fullAddress);
        console.log("📮 郵便番号から住所を取得しました:", fullAddress);
      } else {
        alert("住所が見つかりませんでした。正しい郵便番号を入力してください。");
      }
    } catch (err) {
      console.error("❌ 郵便番号検索エラー:", err);
      alert("一時的に住所検索が利用できません。手動で入力してください。");
    }
  };

  // --- 複数名対応の計算ロジック（維持） ---
  const currentPersonSlots = selectedServices.reduce((sum, s) => sum + s.slots, 0) + 
    Object.values(selectedOptions).flat().reduce((sum, opt) => sum + (opt?.additional_slots || 0), 0);

  const pastPeopleSlots = people.reduce((sum, p) => sum + p.slots, 0);

  const totalSlotsNeeded = pastPeopleSlots + currentPersonSlots;

  const checkRequiredMet = () => {
    return selectedServices.every(s => {
      const cat = categories.find(c => c.name === s.category);
      if (!cat?.required_categories) return true;
      const requiredNames = cat.required_categories.split(',').map(n => n.trim()).filter(n => n);
      if (requiredNames.length === 0) return true;
      return requiredNames.every(reqName => 
        selectedServices.some(ss => ss.category === reqName)
      );
    });
  };

  const isTotalTimeOk = totalSlotsNeeded > 0;
  const isRequiredMet = checkRequiredMet();

  const handleAddPerson = () => {
    if (people.length >= 3) return; 
    
    // 💡 複数選択時は配列に入っているので .flat() で平坦化して名前を結合します
    const baseName = selectedServices.map(s => s.name).join(', ');
    const optName = Object.values(selectedOptions).flat().map(o => o?.option_name).filter(Boolean).join(', ');
    const fullName = optName ? `${baseName}（${optName}）` : baseName;

    setPeople([...people, { 
      services: selectedServices, 
      options: selectedOptions, 
      slots: currentPersonSlots,
      fullName: fullName 
    }]);

    setSelectedServices([]);
    setSelectedOptions({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const removePerson = (index) => {
    const newPeople = [...people];
    newPeople.splice(index, 1);
    setPeople(newPeople);
  };

  const disabledCategoryNames = selectedServices.reduce((acc, s) => {
    const cat = categories.find(c => c.name === s.category);
    if (cat?.disable_categories) return [...acc, ...cat.disable_categories.split(',').map(n => n.trim())];
    return acc;
  }, []);

  const scrollToNextValidCategory = (currentCatIdx) => {
    const nextValidCat = categories.slice(currentCatIdx + 1).find(cat => !disabledCategoryNames.includes(cat.name));
    if (nextValidCat && categoryRefs.current[nextValidCat.id]) {
      setTimeout(() => categoryRefs.current[nextValidCat.id].scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  };

  const toggleService = (service, catIdx) => {
    if (disabledCategoryNames.includes(service.category)) return;
    const currentCategory = categories.find(c => c.name === service.category);
    const allowMultipleInCat = currentCategory?.allow_multiple_in_category;
    const hasOptions = options.some(o => o.service_id === service.id);

    if (!shop.allow_multiple_services) {
      setSelectedServices([service]);
      setSelectedOptions({});
      if (!hasOptions) scrollToNextValidCategory(catIdx);
      else scrollIntoService(service.id);
    } else {
      const isAlreadySelected = selectedServices.find(s => s.id === service.id);
      if (isAlreadySelected) {
        const newSelection = selectedServices.filter(s => s.id !== service.id);
        setSelectedServices(newSelection);
        const newOpts = { ...selectedOptions };
        Object.keys(newOpts).forEach(key => {
          if (key.startsWith(`${service.id}-`)) delete newOpts[key];
        });
        setSelectedOptions(newOpts);
      } else {
        let newSelection = allowMultipleInCat 
          ? [...selectedServices, service]
          : [...selectedServices.filter(s => s.category !== service.category), service];
        
        if (!allowMultipleInCat) {
          const newOpts = { ...selectedOptions };
          const oldServiceInCat = selectedServices.find(s => s.category === service.category);
          if (oldServiceInCat) {
            Object.keys(newOpts).forEach(key => {
              if (key.startsWith(`${oldServiceInCat.id}-`)) delete newOpts[key];
            });
          }
          setSelectedOptions(newOpts);
        }

        setSelectedServices(newSelection);
        if (!allowMultipleInCat && !hasOptions) scrollToNextValidCategory(catIdx);
        else if (hasOptions) scrollIntoService(service.id);
      }
    }
  };

  const scrollIntoService = (serviceId) => {
    setTimeout(() => { if (serviceRefs.current[serviceId]) serviceRefs.current[serviceId].scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
  };

  const handleOptionSelect = (serviceId, groupName, opt, catIdx) => {
    const key = `${serviceId}-${groupName}`;
    const currentSelected = selectedOptions[key] || [];
    
    let newOptionsForGroup;

    if (opt.is_multiple) {
      // 💡 複数選択可能な場合：トグル処理（既にあれば消す、なければ追加）
      const isAlreadyChosen = Array.isArray(currentSelected) 
        ? currentSelected.find(o => o.id === opt.id)
        : currentSelected?.id === opt.id;

      if (isAlreadyChosen) {
        newOptionsForGroup = Array.isArray(currentSelected) 
          ? currentSelected.filter(o => o.id !== opt.id)
          : [];
      } else {
        newOptionsForGroup = Array.isArray(currentSelected) 
          ? [...currentSelected, opt]
          : [currentSelected, opt].filter(Boolean);
      }
    } else {
      // 💡 単一選択の場合：上書き（配列の0番目に1つだけ入れる）
      newOptionsForGroup = [opt];
    }

    const newSelectedOptions = { ...selectedOptions, [key]: newOptionsForGroup };
    setSelectedOptions(newSelectedOptions);

    // 単一選択で、かつ選択が完了した（空でない）場合のみ次のカテゴリへスクロール
    if (!opt.is_multiple && newOptionsForGroup.length > 0) {
      const grouped = getGroupedOptions(serviceId);
      if (Object.keys(grouped).every(gn => newSelectedOptions[`${serviceId}-${gn}`]?.length > 0)) {
        scrollToNextValidCategory(catIdx);
      }
    }
  };

const handleNextStep = () => {
    window.scrollTo(0, 0);

    // 1. 今回の選択分も含めた「最終的な予約者リスト」を一時的に作成
    const currentBaseName = selectedServices.map(s => s.name).join(', ');
    const currentOptionsFlat = Object.values(selectedOptions).flat();
    const currentOptionName = currentOptionsFlat.map(o => o?.option_name).filter(Boolean).join(', ');
    const currentFullName = currentOptionName ? `${currentBaseName}（${currentOptionName}）` : currentBaseName;

    const finalPeople = [...people, { 
      services: selectedServices, 
      options: selectedOptions, 
      slots: currentPersonSlots,
      fullName: currentFullName 
    }];

    // 🆕 2. 【重要】全メニューが「売上対象外」設定かどうかを判定
    // every を使って「全員の全メニューが is_sales_excluded === true であるか」を調べます
    const isExcluded = finalPeople.every(p => 
      p.services.every(s => s.is_sales_excluded === true)
    );

    // 3. 次のステップへ引き継ぐ共通データ一式
    const commonState = { 
      people: finalPeople,
      isSalesExcluded: isExcluded, // 🆕 このフラグを次の画面へバトンタッチ！
      totalSlotsNeeded,
      lineUser,
      authUserProfile, 
      visitorZip,
      visitorAddress,
      customShopName: displayBranding.name,
      bizType: entryType || location.state?.adminBizType,
      staffId: adminStaffId || staffIdFromUrl || autoStaffId,
      fromView: fromView
    };

    // 4. 画面遷移
    if (isAdminMode) {
      // 管理者ねじ込みモードなら直接「確認画面」へ
      const confirmUrl = `/shop/${shopId}/confirm${adminStaffId ? `?staff=${adminStaffId}` : ''}`;
      navigate(confirmUrl, { 
        state: { ...commonState, date: adminDate, time: adminTime, adminDate, adminTime } 
      });
    } else {
      // 一般客なら「日時選択画面」へ
      const nextUrl = `/shop/${shopId}/reserve/time${staffIdFromUrl ? `?staff=${staffIdFromUrl}` : ''}`;
      navigate(nextUrl, { state: commonState });
    }
  };

  // ✅ 抜けていたヘルパー関数とロジックをここに配置
  const getGroupedOptions = (serviceId) => {
    return options.filter(o => o.service_id === serviceId).reduce((acc, opt) => {
      if (!acc[opt.group_name]) acc[opt.group_name] = [];
      acc[opt.group_name].push(opt);
      return acc;
    }, {});
  };

  const allOptionsSelected = selectedServices.every(s => {
    const grouped = getGroupedOptions(s.id);
    // 💡 単一選択（is_multiple: false）のグループは、必ず1つ以上選ばれている必要がある
    // 複数選択（is_multiple: true）のグループは、0個でもOKとする（または1個以上とするかはお好みで）
    return Object.keys(grouped).every(groupName => {
      const optsInGroup = grouped[groupName];
      const isMultipleGroup = optsInGroup[0]?.is_multiple;
      const selections = selectedOptions[`${s.id}-${groupName}`];
      
      if (isMultipleGroup) return true; // 複数選択グループは任意（0個でも進める）とする場合
      return selections && selections.length > 0; // 単一選択は必須
    });
  });

  if (loading) return <div style={{ textAlign: 'center', padding: '100px', color: '#666' }}>読み込み中...</div>;
  if (shop?.is_suspended) return <div style={{ padding: '60px 20px', textAlign: 'center' }}><h2>現在、予約受付を停止しています</h2></div>;
  if (!shop) return <div style={{ textAlign: 'center', padding: '50px' }}>店舗が見つかりません</div>;

  const themeColor = shop?.theme_color || '#2563eb';

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto', color: '#333', paddingBottom: '160px' }}>
      
      <Link to="/" style={{ position: 'fixed', top: '15px', left: '15px', zIndex: 1100, background: 'rgba(255,255,255,0.9)', color: '#666', textDecoration: 'none', fontSize: '0.7rem', padding: '6px 10px', borderRadius: '15px', border: '1px solid #ddd' }}>← 戻る</Link>
      
      <div style={{ marginTop: '30px', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.4rem' }}>{displayBranding.name}</h2>

        {/* 🚗 訪問型住所入力エリア */}
        {isVisitService && !isAdminMode && (
          <div style={{ marginBottom: '25px', padding: '20px', background: isAddressFixed ? '#f8fafc' : '#fff', borderRadius: '16px', border: isAddressFixed ? '1px solid #e2e8f0' : `2px solid ${themeColor}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', marginBottom: '15px', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={20} /> 1. 訪問先の住所を入力
            </h3>
            {!isAddressFixed ? (
              <>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px' }}>郵便番号を入力すると住所が自動入力されます。</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    type="tel" 
                    value={visitorZip} 
                    onChange={(e) => setVisitorZip(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))} 
                    placeholder="郵便番号(7桁)" 
                    style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem' }} 
                  />
                  <button onClick={handleZipSearch} type="button" style={{ padding: '0 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', color: '#475569' }}>住所検索</button>
                </div>
                <input 
                  type="text" 
                  value={visitorAddress} 
                  onChange={(e) => setVisitorAddress(e.target.value)} 
                  placeholder="市区町村・番地・建物名まで入力してください" 
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1rem', marginBottom: '12px', boxSizing: 'border-box' }} 
                />
<button 
  // 🚀 🆕 1.末尾が数字 2.ハイフンあり 3.丁目/番地/号/の が含まれる かをチェック
  disabled={!visitorAddress || !(/[0-9０-９一二三四五六七八九十]$|[\-\－]|丁目|番地|号|の[一二三四五六七八九十]/.test(visitorAddress))} 
  onClick={() => setIsAddressFixed(true)} 
  style={{ 
    width: '100%', padding: '14px', 
    // 判定ロジックを共通化
    background: (visitorAddress && /[0-9０-９一二三四五六七八九十]$|[\-\－]|丁目|番地|号|の[一二三四五六七八九十]/.test(visitorAddress)) ? themeColor : '#cbd5e1', 
    color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' 
  }}
>
  {!visitorAddress ? '住所を入力してください' 
   : !(/[0-9０-９一二三四五六七八九十]$|[\-\－]|丁目|番地|号|の[一二三四五六七八九十]/.test(visitorAddress)) ? '番地まで入力してください' 
   : 'この場所で空き枠を探す'}
</button>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: themeColor, fontWeight: 'bold', marginBottom: '4px' }}>📍 訪問先（前回と同じ場所を表示中）</p>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{visitorAddress}</div>
                </div>
                <button onClick={() => setIsAddressFixed(false)} style={{ background: 'none', border: `2px solid ${themeColor}`, color: themeColor, padding: '5px 15px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>変更</button>
              </div>
            )}
          </div>
        )}

        {lineUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '10px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
            <img src={lineUser.pictureUrl} style={{ width: '30px', height: '30px', borderRadius: '50%' }} alt="LINE" />
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534' }}>{lineUser.displayName} さん、こんにちは！</span>
          </div>
        )}

        {/* 🆕 Googleログインユーザーへの挨拶表示 */}
        {authUserProfile && !lineUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '10px', background: `${themeColor}10`, borderRadius: '10px', border: `1px solid ${themeColor}30` }}>
            <span style={{ fontSize: '1.2rem' }}>👋</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: themeColor }}>
              {authUserProfile.display_name} 様、こんにちは！
            </span>
          </div>
        )}

        {people.length > 0 && (
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', marginBottom: '8px' }}>現在の予約内容：</p>
            {people.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '4px 0', borderBottom: idx < people.length - 1 ? '1px dashed #eee' : 'none' }}>
                <span style={{ color: themeColor, fontWeight: 'bold' }}>{idx + 1}人目：{p.services.map(s => s.name).join(', ')}</span>
                <button onClick={() => removePerson(idx)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.9rem', cursor: 'pointer' }}>×</button>
              </div>
            ))}
          </div>
        )}

        {isAdminMode && (
          <div style={{ background: '#fef3c7', color: '#92400e', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '15px', border: '1px solid #fcd34d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️ 管理者ねじ込み予約：確定画面へ直行します</span>
            </div>
            <div style={{ marginTop: '5px', fontSize: '0.75rem', opacity: 0.9 }}>
              日時：{adminDate} {adminTime}<br />
              担当：{targetStaffName}
            </div>
          </div>
        )}
        
        {/* --- 店舗説明文 --- */}
        {displayBranding.desc && (
          <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6' }}>
  {displayBranding.desc && displayBranding.desc.split('/').map((line, idx) => (
    <React.Fragment key={idx}>
      {line.trim()}
      {idx < displayBranding.desc.split('/').length - 1 && <br />}
    </React.Fragment>
  ))}
</p>
        )}
      </div>

      {/* 🚀 🆕 【住所確定ガード】訪問型サービスで住所未確定ならメニューを隠す */}
      {(!isVisitService || isAddressFixed || isAdminMode) ? (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <h3 style={{ fontSize: '1rem', borderLeft: `4px solid ${themeColor}`, paddingLeft: '10px', marginBottom: '20px' }}>
            {people.length === 0 ? "2. メニューを選択" : `${people.length + 1}人目のメニューを選択`}
          </h3>
          
          {categories
            .filter(cat => {
              // カテゴリ内に表示用メニューがあるかチェック
              return services.some(s => s.category === cat.name && !s.show_on_print);
            })
            .map((cat, idx) => {
              const isDisabled = disabledCategoryNames.includes(cat.name);
              return (
                <div key={cat.id} ref={el => categoryRefs.current[cat.id] = el} style={{ marginBottom: '35px', opacity: isDisabled ? 0.3 : 1 }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '12px', lineHeight: '1.4' }}>
                    {cat.name.split('/').map((text, i) => (
                      <React.Fragment key={i}>
                        {text.trim()}
                        {i < cat.name.split('/').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </h4>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {services
                      .filter(s => s.category === cat.name)
                      .filter(service => {
                        if (service.show_on_print) return false; 
                        if (isAdminMode) return true;
                        return !service.is_admin_only;
                      })
                      .map(service => {
                        const isSelected = selectedServices.find(s => s.id === service.id);
                        const groupedOpts = getGroupedOptions(service.id);
                        return (
                          <div key={service.id} ref={el => serviceRefs.current[service.id] = el} 
                               style={{ border: isSelected ? `2px solid ${themeColor}` : '1px solid #ddd', borderRadius: '12px', background: 'white' }}>
                            <button disabled={isDisabled} onClick={() => toggleService(service, idx)} style={{ width: '100%', padding: '15px', border: 'none', background: 'none', textAlign: 'left' }}>
                              <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ 
                                  width: '18px', height: '18px', border: `2px solid ${themeColor}`, 
                                  borderRadius: cat.allow_multiple_in_category ? '4px' : '50%', 
                                  background: isSelected ? themeColor : 'transparent', 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' 
                                }}>{isSelected && '✓'}</div>
                                <span style={{ lineHeight: '1.4' }}>
  {service.name.split('/').map((text, i) => (
    <React.Fragment key={i}>
      {text.trim()}
      {i < service.name.split('/').length - 1 && <br />}
    </React.Fragment>
  ))}
</span>
                              </div>
                            </button>
                            {isSelected && !isDisabled && Object.keys(groupedOpts).length > 0 && (
                              <div style={{ padding: '0 15px 15px 15px', background: '#f8fafc' }}>
                                {Object.keys(groupedOpts).map(gn => (
                                  <div key={gn} style={{ marginTop: '10px' }}>
                                    <p style={{ fontSize: '0.7rem', color: '#475569' }}>└ {gn}</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                      {groupedOpts[gn].map(opt => {
                                        const selections = selectedOptions[`${service.id}-${gn}`] || [];
                                        const isOptSelected = Array.isArray(selections) 
                                          ? selections.some(o => o.id === opt.id)
                                          : selections?.id === opt.id;
                                        return (
                                          <button 
                                            key={opt.id} 
                                            onClick={() => handleOptionSelect(service.id, gn, opt, idx)} 
                                            style={{ 
                                              padding: '10px 5px', borderRadius: '8px', border: '1px solid', 
                                              borderColor: isOptSelected ? themeColor : '#cbd5e1', 
                                              background: isOptSelected ? themeColor : 'white', 
                                              color: isOptSelected ? 'white' : '#475569', 
                                              fontSize: '0.8rem',
                                              boxShadow: isOptSelected ? `0 2px 4px ${themeColor}44` : 'none'
                                            }}
                                          >
                                            <span style={{ lineHeight: '1.2', display: 'block' }}>
  {opt.option_name.split('/').map((text, i) => (
    <React.Fragment key={i}>
      {text.trim()}
      {i < opt.option_name.split('/').length - 1 && <br />}
    </React.Fragment>
  ))}
</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              );
            })
          }
        </div>
      ) : (
        /* 🚀 🆕 住所がまだ決まっていない時に出す「待機ガイド」 */
        <div style={{ 
          textAlign: 'center', padding: '60px 20px', background: '#fff', 
          borderRadius: '24px', border: '1px dashed #e2e8f0', marginTop: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
        }}>
          <div style={{ width: '60px', height: '60px', background: `${themeColor}10`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <MapPin size={30} color={themeColor} />
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>メニューを表示します</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6', margin: 0 }}>
            訪問先までの移動時間を計算するため、<br />
            まずは**一番上のフォームに住所を入力**し、<br />
            確定ボタンを押してください。
          </p>
        </div>
      )}

      {/* --- 追加でもう一人 ＋ ボタン（条件付き） --- */}
      {shop?.allow_multi_person_reservation && selectedServices.length > 0 && people.length < 3 && allOptionsSelected && isRequiredMet && (
        <button 
          onClick={handleAddPerson}
          style={{ 
            position: 'fixed', bottom: '100px', right: '15px', zIndex: 999, 
            writingMode: 'vertical-rl',
            background: themeColor, color: 'white', padding: '15px 8px', 
            borderRadius: '8px 0 0 8px', border: 'none', fontWeight: 'bold', 
            fontSize: '0.85rem', boxShadow: '-4px 4px 12px rgba(0,0,0,0.1)', 
            cursor: 'pointer', animation: 'slideIn 0.3s ease-out'
          }}
        >
          追加でもう一人 ＋
        </button>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* --- 固定フッター：予約ボタンエリア --- */}
      {(selectedServices.length > 0 || people.length > 0 || (isVisitService && !isAddressFixed && !isAdminMode)) && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(10px)', padding: '15px 20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', zIndex: 1000, boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
          <button 
            // 🚀 🆕 管理者の時は住所チェックを完全にスルー！
            disabled={
              !allOptionsSelected || !isRequiredMet || !isTotalTimeOk || 
              (isVisitService && !isAdminMode && (!isAddressFixed || !(/[0-9０-９一二三四五六七八九十]$|[\-\－]|丁目|番地|号|の[一二三四五六七八九十]/.test(visitorAddress))))
            } 
            onClick={handleNextStep} 
            style={{ 
              width: '100%', maxWidth: '400px', padding: '16px', 
              // 🚀 🆕 背景色も管理者の時は住所を無視！
              background: (!allOptionsSelected || !isRequiredMet || !isTotalTimeOk || (isVisitService && !isAdminMode && (!isAddressFixed || !(/[0-9０-９一二三四五六七八九十]$|[\-\－]|丁目|番地|号|の[一二三四五六七八九十]/.test(visitorAddress))))) ? '#cbd5e1' : themeColor, 
              color: 'white', border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '1rem'
            }}
          >
            {/* 🚀 🆕 メッセージの出し分け：管理者を最優先に */}
            {isAdminMode ? (
              (!allOptionsSelected || !isRequiredMet || !isTotalTimeOk) ? 'メニューを選択してください' : `予約内容を確定する (${totalSlotsNeeded * (shop?.slot_interval_min || 15)}分)`
            ) : (
              isVisitService && !isAddressFixed ? (
                !(/[0-9０-９一二三四五六七八九十]$|[\-\－]|丁目|番地|号|の[一二三四五六七八九十]/.test(visitorAddress)) ? '番地（数字）を入力してください' : '1. 訪問先を確定してください'
              ) : !allOptionsSelected ? 'オプションを選択してください' 
                : !isRequiredMet ? '必須メニューが未選択です' 
                : `日時選択へ進む (${totalSlotsNeeded * (shop?.slot_interval_min || 15)}分)`
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default ReservationForm;