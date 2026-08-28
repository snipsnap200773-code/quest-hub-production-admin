import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  ArrowLeft, Sparkles, Save, Edit2, Trash2, ArrowUp, ArrowDown,
  Layers, Link2, AlertCircle, CheckCircle2, AlertTriangle, Users, Globe // 👈 Globe を追加
} from 'lucide-react';
import HelpTooltip from '../../../components/ui/HelpTooltip';

// 🚀 SettingsPreviewLayout から reloadPreview と setShowMobilePreview を受け取る
const BookingFormSettings = ({ reloadPreview, setShowMobilePreview }) => { // 👈 setShowMobilePreview を追加
  const { shopId } = useParams();
  const navigate = useNavigate();
  const BIZ_URL = "https://questhub-portal.vercel.app";
  const menuFormRef = useRef(null);
  const categoryFormRef = useRef(null); // 👈 これを追加

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900; 

  const [message, setMessage] = useState('');
  const [shopData, setShopData] = useState(null);
  
  // --- 状態管理 ---
  // 1. MenuSettings由来
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [options, setOptions] = useState([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [slotIntervalMin, setSlotIntervalMin] = useState(30);
  
  // カテゴリ用
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newUrlKey, setNewUrlKey] = useState(''); 
  const [newCustomShopName, setNewCustomShopName] = useState(''); 
  const [newCustomDescription, setNewCustomDescription] = useState(''); 
  const [isFacilityOnlyCat, setIsFacilityOnlyCat] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingDisableCatId, setEditingDisableCatId] = useState(null);

  // メニュー用
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceSlots, setNewServiceSlots] = useState(1);
  const [newServicePrice, setNewServicePrice] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [isFullDay, setIsFullDay] = useState(false);
  const [isAdminOnly, setIsAdminOnly] = useState(false);
  const [isSalesExcluded, setIsSalesExcluded] = useState(false);
  const [showOnPrint, setShowOnPrint] = useState(false);
  const [useRestriction, setUseRestriction] = useState(false);
  const [timeRanges, setTimeRanges] = useState([{ start: '08:00', end: '09:00' }]);

  // 枝メニュー用
  const [activeServiceForOptions, setActiveServiceForOptions] = useState(null);
  const [optGroupName, setOptGroupName] = useState(''); 
  const [optName, setOptName] = useState('');                  
  const [optSlots, setOptSlots] = useState(0);
  const [optPrice, setOptPrice] = useState(0);
  const [optIsMultiple, setOptIsMultiple] = useState(false);
  const [optIsAdminOnly, setOptIsAdminOnly] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState(null);

  // 2. 引っ越し組 (BasicSettings由来 ＆ ScheduleSettings由来)
  const [notes, setNotes] = useState('');
  const [allowMultiPerson, setAllowMultiPerson] = useState(true);
  const [description, setDescription] = useState(''); // 👈 🆕 追加：Basicから引っ越し

  // 👇 🌟 🆕 追加：店舗が持っている大業種のリストを保持する
  const [shopIndustries, setShopIndustries] = useState([]);
  const [newTargetIndustry, setNewTargetIndustry] = useState(''); // 👈 カテゴリ作成用の選択State

  // 🚀 🆕 変更検知用のStateとロジックを追加（フッターで保存する4項目のみ）
  const [initialDataStr, setInitialDataStr] = useState(null);
  const [isDataReady, setIsDataReady] = useState(false);

  const currentDataStr = JSON.stringify({
    allowMultiple, allowMultiPerson, description, notes
  });
  const hasChanges = initialDataStr !== null && initialDataStr !== currentDataStr;

  useEffect(() => {
    if (isDataReady) {
      setInitialDataStr(currentDataStr);
      setIsDataReady(false);
    }
  }, [isDataReady, currentDataStr]);

  const themeColor = shopData?.theme_color || '#2563eb';
  
  // 👇 🆕 追加：店舗の業種が「訪問サービス系」かどうかを判定する
  const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];
  const isVisit = VISIT_KEYWORDS.some(keyword => (shopData?.business_type || '').includes(keyword));

  useEffect(() => {
    if (shopId) {
      fetchInitialShopData();
      fetchMenuDetails(); // 👈 🚀 復活：これが消えていたためメニューが出なくなっていました！
    }
  }, [shopId]);

  const fetchInitialShopData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setShopData(data);
      setAllowMultiple(data.allow_multiple_services);
      setSlotIntervalMin(data.slot_interval_min || 30);
      setNotes(data.notes || ''); 
      setAllowMultiPerson(data.allow_multi_person_reservation ?? true); 
      setDescription(data.description || ''); // 👈 🆕 追加：Basicから引っ越し

      // 👇 🌟 修正：文字列でも配列でも、全角カンマが混ざっていても確実に分割して読み取るように強化
      let industries = [];
      if (Array.isArray(data.business_type)) {
        industries = data.business_type;
      } else if (typeof data.business_type === 'string') {
        industries = data.business_type.split(/,|、/).map(s => s.trim()).filter(Boolean);
      }
      setShopIndustries(industries);

      setIsDataReady(true); // 🚀 🆕 追加：データの読み込み完了を合図する
    }
  };

  const fetchMenuDetails = async () => {
    const catRes = await supabase.from('service_categories')
      .select('*').eq('shop_id', shopId)
      .or('is_adjustment_cat.is.null,is_adjustment_cat.eq.false')
      .or('is_product_cat.is.null,is_product_cat.eq.false')
      .order('sort_order');
    const servRes = await supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order');
    
    // 🚀 1000件バグ回避：自店舗のメニューIDに紐づく枝分かれオプションのみを安全に取得
    const serviceIds = (servRes.data || []).map(s => s.id);
    let optData = [];
    if (serviceIds.length > 0) {
      const { data: optRes } = await supabase.from('service_options').select('*').in('service_id', serviceIds);
      optData = optRes || [];
    }

    if (catRes.data) setCategories(catRes.data);
    if (servRes.data) setServices(servRes.data);
    if (optData) setOptions(optData); // 👈 optRes.data ではなく optData をセット
  };

  const showMsg = (txt) => { 
    setMessage(txt); 
    setTimeout(() => setMessage(''), 3000); 
    if (typeof reloadPreview === 'function') {
      setTimeout(() => reloadPreview(), 300);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showMsg('URLをコピーしました！ 📋');
  };

  const moveItem = async (type, list, id, direction) => {
    const idx = list.findIndex(item => item.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const itemA = list[idx];
    const itemB = list[targetIdx];
    const tableMap = { category: 'service_categories', service: 'services' };
    const table = tableMap[type] || 'services';

    try {
      const updates = [
        { ...itemA, sort_order: itemB.sort_order },
        { ...itemB, sort_order: itemA.sort_order }
      ];
      const { error } = await supabase.from(table).upsert(updates);
      if (error) throw error;
      fetchMenuDetails();
    } catch (err) {
      alert("並び替えができませんでした。一度ページを更新してください。");
    }
  };

  // --- 保存・送信ハンドラー ---
  const handleSaveBasic = async () => {
    const { error } = await supabase.from('profiles').update({
      allow_multiple_services: allowMultiple,
      allow_multi_person_reservation: allowMultiPerson, 
      notes: notes,
      description: description // 👈 🆕 追加：引っ越し組を追加
      // ※slotIntervalMin はグループ3へお引っ越し予定なのでここでは保存しません
    }).eq('id', shopId);
    
    if (!error) {
      showMsg('予約フォームの基本設定を保存しました！');
      setInitialDataStr(currentDataStr); // 🚀 🆕 追加：保存完了後に変更検知をリセット
    } else {
      alert('保存に失敗しました。');
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      name: newCategoryName, url_key: newUrlKey, custom_shop_name: newCustomShopName,
      custom_description: newCustomDescription, is_facility_only: isFacilityOnlyCat,
      target_industry: newTargetIndustry || null // 👈 🌟 🆕 追加
    };

    if (editingCategoryId) {
      const oldCategory = categories.find(c => c.id === editingCategoryId);
      await supabase.from('service_categories').update(payload).eq('id', editingCategoryId);
      if (oldCategory?.name && oldCategory.name !== newCategoryName) {
        await supabase.from('services').update({ category: newCategoryName }).eq('shop_id', shopId).eq('category', oldCategory.name);
      }
    } else {
      await supabase.from('service_categories').insert([{ ...payload, shop_id: shopId, sort_order: categories.length }]);
    }
    setEditingCategoryId(null); setNewCategoryName(''); setNewUrlKey(''); setNewCustomShopName(''); setNewCustomDescription(''); setIsFacilityOnlyCat(false); setNewTargetIndustry(''); // 👈 🌟 🆕 初期化を追加
    fetchMenuDetails(); showMsg('カテゴリを更新しました');
  };

  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    if (categories.length === 0) return alert("先にカテゴリを登録してください。");
    const finalCategory = selectedCategory || (categories[0]?.name || 'その他');
    const serviceData = { 
      shop_id: shopId, name: newServiceName, slots: Number(newServiceSlots), price: Number(newServicePrice), 
      category: finalCategory, restricted_hours: useRestriction ? timeRanges : null,
      is_full_day: isFullDay, is_admin_only: isAdminOnly, is_sales_excluded: isSalesExcluded, show_on_print: showOnPrint
    };

    if (editingServiceId) await supabase.from('services').update(serviceData).eq('id', editingServiceId);
    else await supabase.from('services').insert([{ ...serviceData, sort_order: services.length }]);
    
    setEditingServiceId(null); setNewServiceName(''); setNewServiceSlots(1); setNewServicePrice(0); setIsFullDay(false); setIsAdminOnly(false); setShowOnPrint(false);
    fetchMenuDetails(); showMsg('メニューを保存しました');
  };

  const handleOptionSubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      service_id: activeServiceForOptions.id, group_name: optGroupName, option_name: optName, 
      additional_slots: Number(optSlots), additional_price: Number(optPrice), is_multiple: optIsMultiple, is_admin_only: optIsAdminOnly
    };
    if (editingOptionId) await supabase.from('service_options').update(payload).eq('id', editingOptionId);
    else await supabase.from('service_options').insert([payload]);

    setEditingOptionId(null); setOptName(''); setOptSlots(0); setOptPrice(0); 
    fetchMenuDetails(); showMsg(editingOptionId ? '枝メニューを更新しました' : '枝メニューを追加しました');
  };

  const handleToggleOptionGroupMultiple = async (serviceId, groupName, currentStatus) => {
    await supabase.from('service_options').update({ is_multiple: !currentStatus }).eq('service_id', serviceId).eq('group_name', groupName);
    fetchMenuDetails(); showMsg(`グループ設定を更新しました`);
  };
  
  const handleToggleDisableCat = async (catId, targetCatName) => {
    const targetCat = categories.find(c => c.id === catId);
    if (!targetCat) return;
    let currentDisables = (targetCat.disable_categories || '').split(',').map(s => s.trim()).filter(s => s);
    if (currentDisables.includes(targetCatName)) currentDisables = currentDisables.filter(name => name !== targetCatName);
    else currentDisables.push(targetCatName);
    await supabase.from('service_categories').update({ disable_categories: currentDisables.join(',') }).eq('id', catId);
    fetchMenuDetails();
  };

  const handleToggleRequiredCat = async (catId, targetCatName) => {
    const targetCat = categories.find(c => c.id === catId);
    let currentRequired = targetCat.required_categories ? targetCat.required_categories.split(',').map(s => s.trim()).filter(s => s) : [];
    if (currentRequired.includes(targetCatName)) currentRequired = currentRequired.filter(name => name !== targetCatName);
    else currentRequired.push(targetCatName);
    await supabase.from('service_categories').update({ required_categories: currentRequired.join(',') }).eq('id', catId);
    fetchMenuDetails();
  };


  // --- スタイル定義 ---
  const containerStyle = { fontFamily: 'sans-serif', width: '100%', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', position: 'relative', boxSizing: 'border-box' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };

  return (
    <div style={containerStyle}>
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        予約フォームの設定
      </h2>

      {/* --- 🚀 統合セクション：フォームの基本設定 --- */}
      <section style={{ ...cardStyle, border: `2px solid ${themeColor}` }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: themeColor, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <AlertCircle size={20} /> フォームの基本設定
        </h3>

        {/* 👇 MenuSettingsからの引っ越し：複数カテゴリ選択 */}
        <div style={{ marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <b style={{ fontSize: '0.9rem', color: '#334155' }}>複数のカテゴリ選択を許可する</b>
                <HelpTooltip themeColor={themeColor} text="お客様が異なるカテゴリのメニューを一度に複数選べるようにします。" />
              </div>
            </div>
            <div onClick={() => setAllowMultiple(!allowMultiple)} style={{ width: '52px', height: '28px', background: allowMultiple ? themeColor : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
              <div style={{ position: 'absolute', top: '2px', left: allowMultiple ? '26px' : '2px', width: '24px', height: '24px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </label>
        </div>

        {/* 👇 ScheduleSettingsからの引っ越し：複数名予約 */}
        <div style={{ marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <b style={{ fontSize: '0.9rem', color: '#334155' }}>複数名（最大3名）の同時予約</b>
                <HelpTooltip themeColor={themeColor} text="お客様が予約フォームで「追加でもう一人予約する」ボタンを使えるようにします。ご家族や友人同士の予約を許可する場合にONにします。" />
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>予約フォームの「追加でもう一人」ボタンの表示設定</span>
            </div>
            <div onClick={() => setAllowMultiPerson(!allowMultiPerson)} style={{ width: '52px', height: '28px', background: allowMultiPerson ? themeColor : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
              <div style={{ position: 'absolute', top: '2px', left: allowMultiPerson ? '26px' : '2px', width: '24px', height: '24px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </label>
        </div>

        {/* 👇 BasicSettingsからの引っ越し：注意事項 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#334155' }}>
            サブタイトル (予約画面に表示されます)
            <HelpTooltip themeColor={themeColor} text="店名の下に表示される短いキャッチコピーです。「/」を入力した場所で、実際の画面では改行されます。" />
          </label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} placeholder="スラッシュ(/)で改行できます" />
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: `1px solid ${themeColor}22` }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: themeColor, lineHeight: '1.6' }}>
              {description ? (description || '').split('/').map((line, idx) => (
                <React.Fragment key={idx}>{line}{idx < (description || '').split('/').length - 1 && <br />}</React.Fragment>
              )) : 'プレビューが表示されます'}
            </div>
          </div>
        </div>

        {/* 👇 BasicSettingsからの引っ越し：注意事項 */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#334155' }}>
            <AlertTriangle size={14} color="#ef4444" /> 注意事項 (予約フォーム上部に表示)
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, border: '2px solid #fee2e2', minHeight: '80px', background: '#fff5f5' }} placeholder="キャンセル規定や遅刻についてなど" />
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
              onClick={handleSaveBasic} 
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
              <Save size={20} /> {hasChanges ? '未保存の変更があります' : '変更はありません'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ flex: 1, padding: '10px 0', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>戻る</span>
            </button>
            <button 
              onClick={handleSaveBasic} 
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
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{hasChanges ? '保存する' : '変更なし'}</span>
            </button>
            <button 
              onClick={() => {
                navigate(`?preview=reserve`, { replace: true });
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

      {/* --- 以降は MenuSettings と同じカテゴリ・メニュー登録 --- */}
      <section ref={categoryFormRef} style={cardStyle}> {/* 👈 ref={categoryFormRef} を追加 */}
        <h3 style={{ marginTop: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Layers size={20} color="#64748b" /> カテゴリ設定
        </h3>
        <form onSubmit={handleCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <input placeholder="カテゴリ名 (例: カット, カラー)" value={newCategoryName || ''} onChange={(e) => setNewCategoryName(e.target.value)} style={inputStyle} required />
          
          {/* 👇 🌟 修正：店舗の業種数に関わらず常に表示するように変更（length > 0） */}
          {shopIndustries.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>対象とする大業種（ハイブリッド用）</span>
                <HelpTooltip themeColor={themeColor} text="お客様が予約画面で「店舗へ行く」「訪問してもらう」などを選んだ際、どのタブでこのカテゴリを表示させるか設定します。" />
              </div>
              <select 
                value={newTargetIndustry} 
                onChange={(e) => setNewTargetIndustry(e.target.value)} 
                style={inputStyle}
              >
                <option value="">全業種で表示する（共通）</option>
                {shopIndustries.map(ind => (
                  <option key={ind} value={ind}>{ind} 専用</option>
                ))}
              </select>
            </div>
          )}
          {/* 👆 追加ここまで */}

          {/* 👇 ここから追加：ONになっている店舗のみ入力欄を表示 */}
          {shopData?.is_multibrand_enabled && (
            <>
              {/* ラベル部分の復元 */}
              <div style={{ display: 'flex', flexDirection: isPC ? 'row' : 'column', gap: '10px', alignItems: isPC ? 'center' : 'flex-start', marginBottom: '5px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>識別キー</span>
                  <HelpTooltip themeColor={themeColor} text="英数字を入力すると、このカテゴリ専用の予約URLを作成できます（例：hair）。" />
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>専用屋号</span>
                  <HelpTooltip themeColor={themeColor} text="このカテゴリの予約画面だけ、別の店名を表示したい場合に入力します。" />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: isPC ? 'row' : 'column', gap: '10px' }}>
                <input placeholder="例: yukado" value={newUrlKey} onChange={(e) => setNewUrlKey(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <input placeholder="例: 訪問カット 結美" value={newCustomShopName} onChange={(e) => setNewCustomShopName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              </div>
              <textarea placeholder="専用サブタイトル・説明文 (任意)" value={newCustomDescription} onChange={(e) => setNewCustomDescription(e.target.value)} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} />
            </>
          )}
          {/* 👆 追加ここまで */}
          
          {/* 👇 修正：訪問系の場合のみ「施設予約専用」のチェックボックスを表示 */}
          {isVisit && (
            <div style={{ padding: '12px', background: isFacilityOnlyCat ? '#f0f9ff' : '#f8fafc', borderRadius: '12px', border: isFacilityOnlyCat ? '2px solid #0ea5e9' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={isFacilityOnlyCat} onChange={(e) => setIsFacilityOnlyCat(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isFacilityOnlyCat ? '#0369a1' : '#64748b' }}>このカテゴリを【施設予約専用】にする</span>
                <HelpTooltip themeColor={themeColor} text="介護施設専用のメニューです" />
              </div>
            </div>
          )}

          <button type="submit" style={{ width: '100%', padding: '14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            {editingCategoryId ? 'カテゴリを更新' : '新しいカテゴリを登録'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {categories.map((c, idx) => (
            <div key={c.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{c.name}</span>
                  {/* 👇 🌟 🆕 追加：どの大業種用かバッジを表示する */}
                  {c.target_industry && <span style={{ fontSize: '0.65rem', padding: '2px 8px', background: themeColor, color: '#fff', borderRadius: '4px' }}>{c.target_industry}</span>}

                  {c.url_key && <span style={{ fontSize: '0.65rem', padding: '2px 8px', background: '#f1f5f9', color: '#64748b', borderRadius: '4px', border: '1px solid #cbd5e1' }}>🔑 {c.url_key}</span>}
                  
                  {/* 👇 修正：訪問系の場合のみ、一覧の「施設専用」ラベルを表示 */}
                  {isVisit && c.is_facility_only && <span style={{ fontSize: '0.6rem', padding: '2px 8px', background: '#0ea5e9', color: '#fff', borderRadius: '4px' }}>施設専用</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => moveItem('category', categories, c.id, 'up')} disabled={idx === 0} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}><ArrowUp size={16} /></button>
                  <button onClick={() => moveItem('category', categories, c.id, 'down')} disabled={idx === categories.length - 1} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px' }}><ArrowDown size={16} /></button>
                  <button onClick={() => { 
  setEditingCategoryId(c.id); 
  setNewCategoryName(c.name); 
  setNewUrlKey(c.url_key || ''); 
  setNewCustomShopName(c.custom_shop_name || ''); 
  setNewCustomDescription(c.custom_description || ''); 
  setIsFacilityOnlyCat(!!c.is_facility_only); 
  setNewTargetIndustry(c.target_industry || ''); // 👈 🌟 🆕 追加：設定済みの業種を読み込む
  // 👇 追加：入力フォームの位置まで自動でスクロールさせる
  categoryFormRef.current?.scrollIntoView({ behavior: 'smooth' }); 
}} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6', cursor: 'pointer' }}><Edit2 size={16} /></button>
                  <button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('services').delete().eq('category', c.name); await supabase.from('service_categories').delete().eq('id', c.id); fetchMenuDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444' }}><Trash2 size={16} /></button>
                </div>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={async () => { await supabase.from('service_categories').update({ allow_multiple_in_category: !c.allow_multiple_in_category }).eq('id', c.id); fetchMenuDetails(); }} style={{ fontSize: '0.75rem', padding: '6px 12px', background: c.allow_multiple_in_category ? themeColor : '#fff', color: c.allow_multiple_in_category ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>{c.allow_multiple_in_category ? '複数選択可' : '1つのみ選択'}</button>
                <button onClick={() => setEditingDisableCatId(editingDisableCatId === c.id ? null : c.id)} style={{ fontSize: '0.75rem', padding: '6px 12px', background: editingDisableCatId === c.id ? '#1e293b' : '#fff', color: editingDisableCatId === c.id ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><Link2 size={14} /> 連動設定 {editingDisableCatId === c.id ? 'を閉じる' : ''}</button>
              </div>
              {editingDisableCatId === c.id && (
                <div style={{ marginTop: '16px', padding: '16px', background: '#fff', borderRadius: '16px', border: `2px solid ${themeColor}` }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={14} /> 同時に選べないカテゴリ：</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {categories.filter(t => t.id !== c.id).map(t => {
                      const isDis = c.disable_categories?.split(',').includes(t.name);
                      return <button key={t.id} onClick={() => handleToggleDisableCat(c.id, t.name)} style={{ fontSize: '0.7rem', padding: '5px 10px', borderRadius: '15px', border: '1px solid', borderColor: isDis ? '#ef4444' : '#cbd5e1', background: isDis ? '#fee2e2' : '#fff', color: isDis ? '#ef4444' : '#475569', cursor: 'pointer' }}>{t.name}</button>
                    })}
                  </div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: themeColor, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} /> セットで選ぶ必要があるカテゴリ：</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {categories.filter(t => t.id !== c.id).map(t => {
                      const isReq = c.required_categories?.split(',').includes(t.name);
                      return <button key={t.id} onClick={() => handleToggleRequiredCat(c.id, t.name)} style={{ fontSize: '0.7rem', padding: '5px 10px', borderRadius: '15px', border: '1px solid', borderColor: isReq ? themeColor : '#cbd5e1', background: isReq ? '#dbeafe' : '#fff', color: isReq ? themeColor : '#475569' }}>{t.name}</button>
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* メニュー登録 */}
      <section ref={menuFormRef} style={{ ...cardStyle, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Edit2 size={20} color="#64748b" /> メニュー登録・編集
        </h3>
        <form onSubmit={handleServiceSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>所属カテゴリ</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={inputStyle} required>
              <option value="">-- カテゴリを選択 --</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>メニュー名</label>
            <input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} style={inputStyle} placeholder="例: カット ＆ ブロー" required />
          </div>
          {/* 基本料金（UIも元のリッチな表示に戻しました） */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>基本料金 (税込)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 'bold' }}>¥</span>
              <input 
                type="number" 
                value={newServicePrice} 
                onChange={(e) => setNewServicePrice(e.target.value)} 
                style={{ ...inputStyle, paddingLeft: '30px', fontWeight: '900', color: '#d34817' }} 
                placeholder="0" 
                required 
              />
            </div>
          </div>

          {/* 1. 受付時間制限 */}
          <div style={{ marginBottom: '20px', padding: '15px', background: useRestriction ? `${themeColor}08` : '#f1f5f9', borderRadius: '12px', border: useRestriction ? `1px solid ${themeColor}44` : '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: useRestriction ? '15px' : '0' }}>
              <input type="checkbox" checked={useRestriction} onChange={(e) => setUseRestriction(e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155' }}>このメニューの受付時間を制限する</span>
            </label>
            {useRestriction && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {timeRanges.map((range, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', animation: 'fadeIn 0.3s ease' }}>
                    <input 
                      type="time" 
                      value={range.start} 
                      onChange={(e) => {
                        const newRanges = [...timeRanges];
                        newRanges[index].start = e.target.value;
                        setTimeRanges(newRanges);
                      }} 
                      style={{ ...inputStyle, width: '120px', padding: '8px' }} 
                    />
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>〜</span>
                    <input 
                      type="time" 
                      value={range.end} 
                      onChange={(e) => {
                        const newRanges = [...timeRanges];
                        newRanges[index].end = e.target.value;
                        setTimeRanges(newRanges);
                      }} 
                      style={{ ...inputStyle, width: '120px', padding: '8px' }} 
                    />
                    {timeRanges.length > 1 && (
                      <button type="button" onClick={() => setTimeRanges(timeRanges.filter((_, i) => i !== index))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setTimeRanges([...timeRanges, { start: '18:00', end: '20:00' }])} style={{ alignSelf: 'flex-start', fontSize: '0.75rem', background: '#fff', border: `1px dashed ${themeColor}`, color: themeColor, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '5px' }}>
                  ＋ 時間帯を追加
                </button>
              </div>
            )}
          </div>

          {/* 2. 1日貸切モード */}
          <div style={{ marginBottom: '20px', padding: '15px', background: isFullDay ? '#fff7ed' : '#f8fafc', borderRadius: '12px', border: isFullDay ? '1px solid #ffedd5' : '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isFullDay} onChange={(e) => setIsFullDay(e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isFullDay ? '#c2410c' : '#334155' }}>
                    このメニューで1日（許可時間内）を貸切にする
                  </span>
                  <HelpTooltip themeColor={themeColor} text="1件でも予約が入ればその日の全スロットを自動で埋め、他のお客様が予約できないようにします。" />
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#64748b' }}>※予約が入った際、設定された受付時間内の全スロットを自動で埋めます。</p>
              </div>
            </label>
          </div>

          {/* 3. 管理者専用モード */}
          <div style={{ marginBottom: '20px', padding: '15px', background: isAdminOnly ? '#f1f5f9' : '#fff', borderRadius: '12px', border: isAdminOnly ? `2px solid #64748b` : '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isAdminOnly} onChange={(e) => setIsAdminOnly(e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isAdminOnly ? '#1e293b' : '#334155' }}>
                  【管理者専用】ねじ込み予約のみに表示する
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#64748b' }}>※ONにすると、一般の予約フォームからはこのメニューが見えなくなります。</p>
              </div>
            </label>
          </div>

          {/* 4. 売上対象外 */}
          <div style={{ marginBottom: '20px', padding: '15px', background: isSalesExcluded ? '#fef2f2' : '#fff', borderRadius: '12px', border: isSalesExcluded ? `2px solid #ef4444` : '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isSalesExcluded} onChange={(e) => setIsSalesExcluded(e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isSalesExcluded ? '#ef4444' : '#334155' }}>
                    【売上対象外】カレンダーのみ表示し、レジには出さない
                  </span>
                  <HelpTooltip themeColor={themeColor} text="無料の相談会や現地調査など、カレンダーに予定は入れたいがお会計は発生しないメニューに使用します。" />
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#64748b' }}>※見積りや現地調査など、お会計が発生しないメニューにチェックしてください。</p>
              </div>
            </label>
          </div>

          {/* 👇 修正：訪問系の場合のみ表示 */}
          {/* 5. 掲示用名簿フラグ */}
          {isVisit && (
            <div style={{ marginBottom: '20px', padding: '15px', background: showOnPrint ? '#fffbeb' : '#fff', borderRadius: '12px', border: showOnPrint ? `2px solid #f59e0b` : '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showOnPrint} onChange={(e) => setShowOnPrint(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: showOnPrint ? '#92400e' : '#334155' }}>
                      【掲示用】施設に貼る名簿に「希望メニュー」として載せる
                    </span>
                    <HelpTooltip themeColor={themeColor} text="施設側で印刷して壁に貼る「アナログな予約名簿」に、選択肢としてこのメニューを載せます。" />
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#64748b' }}>※ONにすると、施設側で印刷する「あつまれ綺麗にしたい人」名簿に選択肢として表示されます。</p>
                </div>
              </label>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', marginBottom: '10px', color: '#64748b' }}>
              <span>必要コマ数: <span style={{ color: themeColor, fontSize: '1.1rem' }}>{newServiceSlots}コマ（{newServiceSlots * slotIntervalMin}分）</span></span>
              <HelpTooltip themeColor={themeColor} text="このメニューを完了するのに必要な時間をコマ数で指定してください。" />
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button key={n} type="button" onClick={() => setNewServiceSlots(n)} style={{ width: '45px', height: '45px', borderRadius: '12px', border: '2px solid', borderColor: newServiceSlots === n ? themeColor : '#e2e8f0', background: newServiceSlots === n ? themeColor : 'white', color: newServiceSlots === n ? 'white' : '#1e293b', fontWeight: 'bold', cursor: 'pointer' }}>{n}</button>
              ))}
            </div>
          </div>
          <button type="submit" style={{ width: '100%', padding: '16px', background: themeColor, color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
            {editingServiceId ? 'メニューを更新する' : 'メニューを新規登録'}
          </button>
        </form>
      </section>

      {/* メニュー一覧 */}
      <div style={{ marginTop: '30px' }}>
        <h3 style={{ fontSize: '1rem', color: '#1e293b', marginBottom: '20px', fontWeight: 'bold' }}>現在のメニュー一覧</h3>
        {categories.map((cat) => (
          <div key={cat.id} style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '12px', borderLeft: `4px solid ${themeColor}`, paddingLeft: '10px', fontWeight: 'bold' }}>{cat.name}</h4>
            {services.filter(s => s.category === cat.name).map((s, idx, filteredList) => (
              <div key={s.id} style={{ ...cardStyle, marginBottom: '12px', border: activeServiceForOptions?.id === s.id ? `2px solid ${themeColor}` : '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.8rem', color: themeColor, fontWeight: 'bold' }}>{s.slots}コマ（{s.slots * slotIntervalMin}分）</div>
                      <div style={{ fontSize: '0.8rem', color: '#d34817', fontWeight: 'bold' }}>¥{(s.price || 0).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => {
                      const isClosing = activeServiceForOptions?.id === s.id;
                      setActiveServiceForOptions(isClosing ? null : s);
                      // 👇 🚀 修正：別のメニューの枝パネルを開閉する際、前のメニューで入力していたフォーム内容が
                      // 残ってしまい「全部が管理者専用に見える」等の誤表示・誤登録を防ぐため、必ず初期化する
                      setEditingOptionId(null);
                      setOptGroupName('');
                      setOptName('');
                      setOptSlots(0);
                      setOptPrice(0);
                      setOptIsMultiple(false);
                      setOptIsAdminOnly(false);
                    }} style={{ padding: '6px 12px', background: activeServiceForOptions?.id === s.id ? themeColor : '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', color: activeServiceForOptions?.id === s.id ? '#fff' : '#475569', cursor: 'pointer' }}>枝</button>
                    
                    {/* 👇 復活：並び替えボタン（上） */}
                    <button 
                      onClick={() => moveItem('service', filteredList, s.id, 'up')} 
                      disabled={idx === 0} 
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      <ArrowUp size={16} />
                    </button>
                    
                    {/* 👇 復活：並び替えボタン（下） */}
                    <button 
                      onClick={() => moveItem('service', filteredList, s.id, 'down')} 
                      disabled={idx === filteredList.length - 1} 
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', opacity: idx === filteredList.length - 1 ? 0.3 : 1, cursor: idx === filteredList.length - 1 ? 'not-allowed' : 'pointer' }}
                    >
                      <ArrowDown size={16} />
                    </button>

                    {/* 👇 修正：編集ボタン（先ほど復活させた詳細フラグのデータ復元処理も追加） */}
                    <button 
                      onClick={() => { 
                        setEditingServiceId(s.id); 
                        setNewServiceName(s.name); 
                        setNewServiceSlots(s.slots); 
                        setNewServicePrice(s.price || 0); 
                        setSelectedCategory(s.category); 
                        setIsFullDay(s.is_full_day || false);
                        setIsAdminOnly(s.is_admin_only || false);
                        setIsSalesExcluded(s.is_sales_excluded || false);
                        setShowOnPrint(s.show_on_print || false);
                        
                        // 制限データの復元
                        if (s.restricted_hours) {
                          setUseRestriction(true);
                          setTimeRanges(Array.isArray(s.restricted_hours) ? s.restricted_hours : [s.restricted_hours]);
                        } else {
                          setUseRestriction(false);
                          setTimeRanges([{ start: '08:00', end: '09:00' }]);
                        }

                        menuFormRef.current?.scrollIntoView({ behavior: 'smooth' }); 
                      }} 
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#3b82f6', cursor: 'pointer' }}
                    >
                      <Edit2 size={16} />
                    </button>
                    
                    <button onClick={async () => { if(window.confirm('削除しますか？')){ await supabase.from('services').delete().eq('id', s.id); fetchMenuDetails(); } }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </div>
                </div>

                {/* 枝メニュー */}
                {activeServiceForOptions?.id === s.id && (
                  <div style={{ marginTop: '20px', background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 'bold', color: themeColor, marginBottom: '12px' }}>枝メニュー（追加オプション）の管理</p>
                    <form onSubmit={handleOptionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input placeholder="枝カテゴリ (例: シャンプー, 指名料)" value={optGroupName} onChange={(e) => setOptGroupName(e.target.value)} style={inputStyle} />
                      <input placeholder="枝メニュー名 (例: あり, 担当 A)" value={optName} onChange={(e) => setOptName(e.target.value)} style={inputStyle} required />
                      
                      {/* 👇 1段目：追加コマ数と料金のレイアウト復元 */}
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>追加:</span>
                          <input type="number" value={optSlots} onChange={(e) => setOptSlots(parseInt(e.target.value))} style={{ width: '70px', ...inputStyle }} />
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>コマ</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>料金: +¥</span>
                          <input 
                            type="number" 
                            value={optPrice} 
                            onChange={(e) => setOptPrice(Number(e.target.value))} 
                            style={{ flex: 1, minWidth: '100px', ...inputStyle, fontWeight: 'bold', color: '#d34817' }} 
                            placeholder="0" 
                          />
                        </div>
                      </div>

                      {/* 👇 2段目：設定スイッチ ＆ 登録ボタンの復元 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={optIsMultiple} onChange={(e) => setOptIsMultiple(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>複数選択可</span>
                          </label>
                          
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={optIsAdminOnly} onChange={(e) => setOptIsAdminOnly(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: optIsAdminOnly ? '#ef4444' : '#64748b' }}>
                              {optIsAdminOnly ? '⚠️ 管理者専用' : '🌐 ユーザー可'}
                            </span>
                          </label>
                        </div>

                        <button type="submit" style={{ padding: '12px 25px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                          {editingOptionId ? '枝を更新' : '＋ 枝追加'}
                        </button>
                      </div>
                    </form>                    
                    
                    <div style={{ marginTop: '20px' }}>
                      {Array.from(new Set((options || []).filter(o => o && o.service_id === s.id).map(o => o.group_name || '共通'))).map(group => (
                        <div key={group} style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8' }}>▼ {group || '共通'}</div>
                            {(() => {
                              const groupOptions = options.filter(o => o.service_id === s.id && o.group_name === group);
                              const isMultiple = groupOptions[0]?.is_multiple;
                              return (
                                <button 
                                  type="button" 
                                  onClick={() => handleToggleOptionGroupMultiple(s.id, group, isMultiple)} 
                                  style={{ fontSize: '0.65rem', padding: '4px 10px', background: isMultiple ? themeColor : '#fff', color: isMultiple ? '#fff' : '#475569', border: '1px solid #cbd5e1', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  {isMultiple ? '複数選択可' : '1つのみ選択'}
                                </button>
                              );
                            })()}
                          </div>
                          {options.filter(o => o.service_id === s.id && o.group_name === group).map(o => (
                            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #eee', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 'bold', lineHeight: '1.4', display: 'block' }}>
                                  {o.option_name.split('/').map((text, i) => (
                                    <React.Fragment key={i}>
                                      {text}
                                      {i !== o.option_name.split('/').length - 1 && <br />}
                                    </React.Fragment>
                                  ))}
                                </span>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                                  <span style={{ color: themeColor }}>+{o.additional_slots}コマ</span>
                                  <span style={{ color: '#d34817', fontWeight: 'bold' }}>+¥{(o.additional_price || 0).toLocaleString()}</span>
                                </div>
                              </div>
                              
                              {/* 👇 編集ボタンも復元 */}
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button 
                                  onClick={() => {
                                    setEditingOptionId(o.id);
                                    setOptGroupName(o.group_name || '');
                                    setOptName(o.option_name);
                                    setOptSlots(o.additional_slots || 0);
                                    setOptPrice(o.additional_price || 0);
                                    setOptIsMultiple(o.is_multiple || false);
                                    setOptIsAdminOnly(o.is_admin_only || false);
                                  }} 
                                  style={{ color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button onClick={async () => { if(window.confirm('この枝メニューを削除しますか？')) { await supabase.from('service_options').delete().eq('id', o.id); fetchMenuDetails(); } }} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
export default BookingFormSettings;