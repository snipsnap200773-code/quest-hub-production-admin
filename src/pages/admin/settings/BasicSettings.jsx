import React, { useEffect, useState } from 'react';
import { INDUSTRY_LABELS, getSubCategories } from '../../../constants/industryMaster';
import { useParams, useNavigate } from 'react-router-dom';

import { supabase } from "../../../supabaseClient";
import { 
  ArrowLeft, Sparkles, Save, Camera, MapPin, 
  User, Phone, Mail, Globe, Info, Clock, Calendar,
  Instagram, Twitter, Youtube, Quote, Image as ImageIcon, Plus, Trash2, List, HelpCircle
} from 'lucide-react';

import HelpTooltip from '../../../components/ui/HelpTooltip';
import imageCompression from 'browser-image-compression';

const BasicSettings = ({ reloadPreview, setShowMobilePreview }) => {
  const { shopId } = useParams();
  const navigate = useNavigate();

  // 画面サイズ管理
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900;

  // --- State 管理 ---
  const [message, setMessage] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessNameKana, setBusinessNameKana] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerNameKana, setOwnerNameKana] = useState('');
  // 👇 🌟 修正：文字列('')から配列([])に変更
  const [businessType, setBusinessType] = useState([]);
  const [subBusinessType, setSubBusinessType] = useState('');
  const [phone, setPhone] = useState('');
  const [emailContact, setEmailContact] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [baseAddress, setBaseAddress] = useState('');
  const [minutesPerKm, setMinutesPerKm] = useState(3);
  const [description, setDescription] = useState('');
  const [introText, setIntroText] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [officialUrl, setOfficialUrl] = useState('');
  const [themeColor, setThemeColor] = useState('#2563eb');

  // 🆕 フェイズ2で追加した State
  const [catchphrase, setCatchphrase] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [regularHoliday, setRegularHoliday] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ownerBio, setOwnerBio] = useState('');

  // 🔽 ここにフェイズ3の State を追加
  const [ownerImageUrl, setOwnerImageUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [gallerySectionTitle, setGallerySectionTitle] = useState('ギャラリー'); // 👈 追加
  const [menuSectionSubtitle, setMenuSectionSubtitle] = useState('PRICE');
  const [menuSectionTitle, setMenuSectionTitle] = useState('料金表');
  const [highlightMenus, setHighlightMenus] = useState([]);
  const [faqs, setFaqs] = useState([]);

  // 🛑 週間スケジュール用のStateを追加
  const [weeklySchedule, setWeeklySchedule] = useState([]);
  const [weeklyScheduleNote, setWeeklyScheduleNote] = useState('');

  // 🚀 🆕 変更検知用のStateとロジックを追加
  const [initialDataStr, setInitialDataStr] = useState(null);
  const [isDataReady, setIsDataReady] = useState(false);

  // 📝 現在の全入力状態を文字列（JSON）化してまとめる
  const currentDataStr = JSON.stringify({
    businessName, businessNameKana, ownerName, ownerNameKana, businessType, subBusinessType, phone, emailContact, zipCode, address, baseAddress, minutesPerKm: Number(minutesPerKm), description, introText, notes, imageUrl, officialUrl, themeColor, catchphrase, businessHours, regularHoliday, instagramUrl, xUrl, youtubeUrl, ownerBio, ownerImageUrl, galleryUrls, gallerySectionTitle, menuSectionSubtitle, menuSectionTitle, highlightMenus, faqs, weeklySchedule, weeklyScheduleNote
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

  useEffect(() => {
    if (shopId) fetchInitialShopData();
  }, [shopId]);

  const fetchInitialShopData = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
    if (data) {
      setBusinessName(data.business_name || '');
      setBusinessNameKana(data.business_name_kana || '');
      setOwnerName(data.owner_name || '');
      setOwnerNameKana(data.owner_name_kana || '');
      
      // 🚀 🆕 修正：配列で保存されていても、文字列で保存されていても安全に読み込んでクラッシュを防ぐ
      let parsedBusinessTypes = [];
      if (Array.isArray(data.business_type)) {
        parsedBusinessTypes = data.business_type;
      } else if (typeof data.business_type === 'string') {
        parsedBusinessTypes = data.business_type.split(/,|、/).map(s => s.trim()).filter(Boolean);
      }
      setBusinessType(parsedBusinessTypes);

      setSubBusinessType(data.sub_business_type || '');
      setPhone(data.phone || '');
      setEmailContact(data.email_contact || '');
      setZipCode(data.zip_code || '');
      setAddress(data.address || '');
      setBaseAddress(data.base_address || data.address || '');
      setMinutesPerKm(data.minutes_per_km ?? 3);
      setDescription(data.description || '');
      setIntroText(data.intro_text || '');
      setNotes(data.notes || '');
      setImageUrl(data.image_url || '');
      setOfficialUrl(data.official_url || '');
      setThemeColor(data.theme_color || '#2563eb');

      // 🆕 取得処理の追加
      setCatchphrase(data.catchphrase || '');
      setBusinessHours(data.display_business_hours || '');
      setRegularHoliday(data.regular_holiday || '');
      setInstagramUrl(data.instagram_url || '');
      setXUrl(data.x_url || '');
      setYoutubeUrl(data.youtube_url || '');
      setOwnerBio(data.owner_bio || '');

      // 🆕 取得処理の追加
      setOwnerImageUrl(data.owner_image_url || '');
      setGalleryUrls(data.gallery_urls || []);
      setGallerySectionTitle(data.gallery_section_title || 'ギャラリー'); // 👈 追加
      setMenuSectionSubtitle(data.menu_section_subtitle || 'PRICE');
      setMenuSectionTitle(data.menu_section_title || '料金表');
      
      // 🛑 ここを修正：古いデータを新しい「カテゴリ型」に自動変換してエラーを防ぐ
      const fetchedMenus = data.highlight_menus || [];
      if (fetchedMenus.length > 0 && !fetchedMenus[0].items) {
        setHighlightMenus([{ categoryName: '基本メニュー', items: fetchedMenus }]);
      } else {
        setHighlightMenus(fetchedMenus);
      }
      
      setFaqs(data.faqs || []);
      setWeeklySchedule(data.weekly_schedule || []);
      setWeeklyScheduleNote(data.weekly_schedule_note || '');
      
      setIsDataReady(true); // 🚀 🆕 追加：データの読み込み完了を合図する
    }
  };

  const showMsg = (txt) => { 
    setMessage(txt); 
    setTimeout(() => setMessage(''), 3000); 
    if (typeof reloadPreview === 'function') {
      setTimeout(() => reloadPreview(), 300);
    }
  };

  // --- 画像圧縮共通関数 ---
  const compressImage = async (imageFile) => {
    const options = {
      maxSizeMB: 0.3,          // 最大ファイルサイズ（0.3MB = 300KB）
      maxWidthOrHeight: 1200,  // 最大幅/高さ（1200pxを超えたら縮小）
      useWebWorker: true,      // 処理を軽くするための設定
    };
    try {
      showMsg('画像を最適化しています...');
      return await imageCompression(imageFile, options);
    } catch (error) {
      console.error('画像圧縮エラー:', error);
      return imageFile; // エラー時は念のため元のファイルを返す
    }
  };

  // --- 画像アップロード処理 ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 🛑 圧縮処理を実行
    const compressedFile = await compressImage(file);

    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${shopId}-main.${fileExt}`;
    
    showMsg('画像を更新中...');

    const { error: uploadError } = await supabase.storage
      .from('shop-images')
      .upload(fileName, compressedFile, { // 🛑 file から compressedFile に変更
        contentType: compressedFile.type || 'image/jpeg', 
        upsert: true 
      });

    if (uploadError) {
      console.error("Storage詳細エラー:", uploadError); 
      alert('アップロード失敗: ' + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('shop-images')
      .getPublicUrl(fileName);
    
    const publicUrl = urlData.publicUrl;

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ image_url: publicUrl })
      .eq('id', shopId);

    if (dbError) {
      alert('DBのURL更新に失敗しました: ' + dbError.message);
      return;
    }

    setImageUrl(`${publicUrl}?t=${Date.now()}`);
    showMsg('画像を拠点の看板として掲げました！');
  };
  
  // --- 画像アップロード共通関数 ---
  const uploadImageToStorage = async (file, fileName) => {
    const { error: uploadError } = await supabase.storage
      .from('shop-images')
      .upload(fileName, file, { contentType: file.type || 'image/jpeg', upsert: true });

    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('shop-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // 🆕 代表者画像アップロード
  const handleOwnerImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // 🛑 圧縮処理を実行
      const compressedFile = await compressImage(file);
      showMsg('代表者画像を更新中...');
      const fileName = `${shopId}-owner.${compressedFile.name.split('.').pop()}`;
      const url = await uploadImageToStorage(compressedFile, fileName); // 🛑 compressedFile に変更
      setOwnerImageUrl(`${url}?t=${Date.now()}`);
      showMsg('代表者画像を更新しました！');
    } catch (err) {
      alert('アップロード失敗: ' + err.message);
    }
  };

  // 🆕 ギャラリー画像アップロード＆削除
  const handleGalleryUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // 🛑 圧縮処理を実行
      const compressedFile = await compressImage(file);
      showMsg('ギャラリー画像をアップロード中...');
      const fileName = `${shopId}-gallery-${Date.now()}.${compressedFile.name.split('.').pop()}`;
      const url = await uploadImageToStorage(compressedFile, fileName); // 🛑 compressedFile に変更
      setGalleryUrls([...galleryUrls, url]);
      showMsg('ギャラリーに追加しました！');
    } catch (err) {
      alert('アップロード失敗: ' + err.message);
    }
  };
  const removeGalleryImage = (indexToRemove) => {
    setGalleryUrls(galleryUrls.filter((_, i) => i !== indexToRemove));
  };

  // 🆕 動的リスト操作（メニュー）の設定
  const addMenuCategory = () => {
    setHighlightMenus([...highlightMenus, { categoryName: '', items: [{ name: '', price: '', desc: '' }] }]);
  };
  const removeMenuCategory = (catIdx) => {
    setHighlightMenus(highlightMenus.filter((_, i) => i !== catIdx));
  };
  const updateMenuCategoryName = (catIdx, value) => {
    const newMenus = [...highlightMenus];
    newMenus[catIdx].categoryName = value;
    setHighlightMenus(newMenus);
  };
  const addMenuItem = (catIdx) => {
    const newMenus = [...highlightMenus];
    newMenus[catIdx].items.push({ name: '', price: '', desc: '' });
    setHighlightMenus(newMenus);
  };
  const removeMenuItem = (catIdx, itemIdx) => {
    const newMenus = [...highlightMenus];
    newMenus[catIdx].items = newMenus[catIdx].items.filter((_, i) => i !== itemIdx);
    setHighlightMenus(newMenus);
  };
  const updateMenuItem = (catIdx, itemIdx, field, value) => {
    const newMenus = [...highlightMenus];
    newMenus[catIdx].items[itemIdx][field] = value;
    setHighlightMenus(newMenus);
  };

  // 🆕 動的リスト操作（FAQ）の設定
  const addFaq = () => setFaqs([...faqs, { q: '', a: '' }]);
  const updateFaq = (index, field, value) => {
    const newFaqs = [...faqs];
    newFaqs[index][field] = value;
    setFaqs(newFaqs);
  };
  const removeFaq = (index) => setFaqs(faqs.filter((_, i) => i !== index));

  // 🆕 スケジュール表の操作
  const addSchedule = () => {
    setWeeklySchedule([...weeklySchedule, { time: '', mon: '○', tue: '○', wed: '○', thu: '○', fri: '○', sat: '○', sun: '休', hol: '休' }]);
  };
  const updateSchedule = (idx, field, value) => {
    const newSchedule = [...weeklySchedule];
    newSchedule[idx][field] = value;
    setWeeklySchedule(newSchedule);
  };
  const removeSchedule = (idx) => {
    setWeeklySchedule(weeklySchedule.filter((_, i) => i !== idx));
  };

  // --- 保存処理 ---
  const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      business_name: businessName, 
      business_name_kana: businessNameKana,
      owner_name: ownerName, 
      owner_name_kana: ownerNameKana,
      // 👇 🌟 修正：配列をカンマ区切りの文字列に合体させる
      business_type: businessType.join(','), 
      sub_business_type: subBusinessType,
      phone,
      email_contact: emailContact, 
      zip_code: zipCode, 
      address,
      description, 
      intro_text: introText, 
      notes, 
      image_url: imageUrl, 
      official_url: officialUrl,
      base_address: baseAddress,
      minutes_per_km: Number(minutesPerKm) || 3, // 🔧 修正：文字列のまま保存されるのを防ぎ、数値に統一する

      // 🆕 保存対象に追加
      catchphrase,
      display_business_hours: businessHours,
      regular_holiday: regularHoliday,
      instagram_url: instagramUrl,
      x_url: xUrl,
      youtube_url: youtubeUrl,
      owner_bio: ownerBio,

      // 🆕 追加データの保存
      gallery_urls: galleryUrls,
      menu_section_subtitle: menuSectionSubtitle,
      menu_section_title: menuSectionTitle,
      highlight_menus: highlightMenus,
      faqs: faqs,   // 👈 🛑このカンマ(,)を忘れずに！
      weekly_schedule: weeklySchedule,
      weekly_schedule_note: weeklyScheduleNote
    }).eq('id', shopId);

    if (!error) {
      showMsg('店舗プロフィールを保存しました！');
      setInitialDataStr(currentDataStr); // 🚀 🆕 追加：保存完了後に変更検知をリセット
    } else {
      alert('保存に失敗しました。');
    }
  };

  // --- スタイル定義 ---
  const containerStyle = { fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', position: 'relative' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };
  const labelStyle = { fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#334155' };

  const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];
  // 👇 🌟 修正：配列を一度カンマ区切りの文字列にしてからキーワード判定する
  const isVisit = VISIT_KEYWORDS.some(keyword => (businessType.join(',') || '').includes(keyword));

  return (
    <div style={containerStyle}>
      {/* 🔔 通知メッセージ */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          {message}
        </div>
      )}


      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        店舗基本設定
      </h2>

      {/* === 1. 基本プロフィール === */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={20} color={themeColor} /> 店舗プロフィール
        </h3>
        
        {/* 店舗画像 */}
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
          店舗メイン画像（推奨 1:1）
          <HelpTooltip themeColor={themeColor} text="予約サイトのトップに大きく表示される看板写真です。正方形（1:1）の画像が最も綺麗に表示されます。" />
        </label>
        <div style={{ marginBottom: '24px', padding: '24px', background: '#f8fafc', borderRadius: '20px', border: '2px dashed #cbd5e1', textAlign: 'center' }}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt="preview" 
              style={{ width: '140px', height: '140px', objectFit: 'cover', borderRadius: '16px', marginBottom: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} 
            />
          ) : (
            <div style={{ width: '140px', height: '140px', background: '#e2e8f0', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.8rem', margin: '0 auto 16px', fontWeight: 'bold' }}>
              NO IMAGE
            </div>
          )}
          <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '300px' }}>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={handleFileUpload} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }} 
            />
            <button 
              type="button" 
              style={{ width: '100%', padding: '12px', background: '#fff', border: `2px solid ${themeColor}`, color: themeColor, borderRadius: '12px', fontWeight: 'bold', fontSize: '0.9rem' }}
            >
              写真を撮る / 変更する
            </button>
          </div>
        </div>

        {/* 🆕 キャッチコピー */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
            <Quote size={14} /> キャッチコピー（一言アピール）
            <HelpTooltip themeColor={themeColor} text="トップページのメイン画像上に強調して表示されます。Enterで自由な位置に改行を入れられます。" />
          </label>
          {/* 🛑 <input> から高さを設けた <textarea> へ変更 */}
          <textarea 
            value={catchphrase} 
            onChange={(e) => setCatchphrase(e.target.value)} 
            style={{ ...inputStyle, minHeight: '80px', lineHeight: '1.5' }} 
            placeholder="例:&#10;お一人おひとりの髪質やライフスタイルに合わせて、&#10;あなただけの「イロ」と「カタチ」をご提案します。" 
          />
        </div>

        {/* 店舗名・代表者名 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>店舗名</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} style={inputStyle} placeholder="お店の名前" />
          </div>
          <div>
            <label style={labelStyle}>ふりがな</label>
            <input value={businessNameKana} onChange={(e) => setBusinessNameKana(e.target.value)} style={inputStyle} placeholder="てんぽめい" />
          </div>
        </div>

        {/* 代表者情報 ＆ 画像 */}
        <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '16px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}><User size={18} /> 代表者情報</h4>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* 代表者画像アップロード */}
            <div style={{ textAlign: 'center', width: '100px' }}>
              {ownerImageUrl ? (
                <img src={ownerImageUrl} alt="owner" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '50%', marginBottom: '10px', border: `2px solid ${themeColor}` }} />
              ) : (
                <div style={{ width: '100px', height: '100px', background: '#cbd5e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: '10px' }}><User size={40} /></div>
              )}
              <div style={{ position: 'relative' }}>
                <input type="file" accept="image/*" onChange={handleOwnerImageUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                <button type="button" style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '20px', border: `1px solid ${themeColor}`, color: themeColor, background: '#fff' }}>写真を撮る / 変更する</button>
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div><label style={labelStyle}>代表者名</label><input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={inputStyle} placeholder="お名前" /></div>
                <div><label style={labelStyle}>ふりがな</label><input value={ownerNameKana} onChange={(e) => setOwnerNameKana(e.target.value)} style={inputStyle} placeholder="おなまえ" /></div>
              </div>
              <div>
                <label style={labelStyle}>メッセージ（代表者からのご挨拶文）</label>
                <textarea value={ownerBio} onChange={(e) => setOwnerBio(e.target.value)} style={{ ...inputStyle, minHeight: '80px' }} placeholder="お客様へのご挨拶" />
              </div>
            </div>
          </div>
        </div>

        {/* 業種選択 */}
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
              業種（複数選択可）
              <HelpTooltip themeColor={themeColor} text="お店が提供している業種をすべて選択してください。複数選択可能です。" />
            </label>
            {/* 👇 🌟 修正：複数選択可能なボタングループに変更 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '5px' }}>
              {INDUSTRY_LABELS.map(label => {
                const isActive = businessType.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      // 🔧 修正：setState の更新関数の中で別のStateを更新するのは避け、
                      // 計算とその後の副作用（別Stateの更新）を分離する
                      const newArr = isActive ? businessType.filter(t => t !== label) : [...businessType, label];
                      setBusinessType(newArr);
                      setSubBusinessType(''); // 大カテゴリが変わったら小カテゴリを一旦リセット
                    }}
                    style={{
                      padding: '8px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer',
                      background: isActive ? themeColor : '#fff',
                      color: isActive ? '#fff' : '#64748b',
                      border: isActive ? 'none' : '1px solid #cbd5e1',
                      transition: 'all 0.2s'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 👇 🌟 修正：選択された全ての大カテゴリのサブカテゴリを合体させて表示 */}
          {businessType.length > 0 && businessType.flatMap(type => getSubCategories(type)).length > 0 && (
            <div style={{ marginTop: '15px', paddingLeft: '15px', borderLeft: `3px solid ${themeColor}` }}>
              <label style={labelStyle}>詳細ジャンル（任意）</label>
              <select 
                value={subBusinessType} 
                onChange={(e) => setSubBusinessType(e.target.value)} 
                style={inputStyle}
              >
                <option value="">-- 詳細を選択 --</option>
                {businessType.flatMap(type => getSubCategories(type)).map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 店舗紹介・詳細アピール文 */}
        <div style={{ marginBottom: '20px' }}>
  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
    <Info size={14} /> 店舗紹介文
    {/* 🆕 追加：他の2つの入力欄との違いを明記 */}
    <HelpTooltip themeColor={themeColor} text="ページ中盤に表示される、お店の特徴やこだわりを説明する長文です。トップの短いキャッチコピーとは別に、じっくり読んでもらう文章として使えます。" />
  </label>
  <textarea value={introText} onChange={(e) => setIntroText(e.target.value)} style={{ ...inputStyle, minHeight: '150px' }} placeholder="お客様へのメッセージをご記入ください" />
</div>
      </section>

      {/* 🆕 === ギャラリー === */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}><ImageIcon size={20} color={themeColor} /> ギャラリー設定</h3>
        
        {/* 🛑 ギャラリーのタイトル変更用入力欄を追加 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>セクションのタイトル</label>
          <input 
            value={gallerySectionTitle} 
            onChange={(e) => setGallerySectionTitle(e.target.value)} 
            style={inputStyle} 
            placeholder="例: ギャラリー、店内風景、スタイルカタログ など" 
          />
        </div>

        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '15px' }}>実績や店内の雰囲気などを複数枚登録できます。</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          {galleryUrls.map((url, idx) => (
            <div key={idx} style={{ position: 'relative', paddingTop: '100%' }}>
              <img src={url} alt={`gallery-${idx}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
              <button onClick={() => removeGalleryImage(idx)} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}><Trash2 size={12} /></button>
            </div>
          ))}
          <div style={{ position: 'relative', paddingTop: '100%', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Plus size={24} />
              <span style={{ fontSize: '0.7rem', marginTop: '4px' }}>追加</span>
            </div>
            <input type="file" accept="image/*" onChange={handleGalleryUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
          </div>
        </div>
      </section>

      {/* 🆕 === カスタムメニュー・料金表 === */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <List size={20} color={themeColor} /> メニュー・料金表設定
        </h3>

        {/* 🛑 サブタイトルとタイトルを横並びで入力できるように変更 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
  <label style={labelStyle}>見出し（小）</label>
  <input 
    value={menuSectionSubtitle} 
    onChange={(e) => setMenuSectionSubtitle(e.target.value)} 
    style={inputStyle} 
    placeholder="例: PRICE, SERVICE" 
  />
</div>
<div>
  <label style={labelStyle}>見出し（大）</label>
  <input 
    value={menuSectionTitle} 
    onChange={(e) => setMenuSectionTitle(e.target.value)} 
    style={inputStyle} 
    placeholder="例: 料金表, メニュー" 
  />
</div>
        </div>
        
        {highlightMenus.map((category, catIdx) => (
          <div key={catIdx} style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #cbd5e1', position: 'relative' }}>
            <button onClick={() => removeMenuCategory(catIdx)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
            
            <div style={{ marginBottom: '15px', paddingRight: '30px' }}>
              <label style={{...labelStyle, fontSize: '0.8rem', color: themeColor}}>カテゴリ名</label>
              <input 
                value={category.categoryName} 
                onChange={(e) => updateMenuCategoryName(catIdx, e.target.value)} 
                style={{...inputStyle, border: `2px solid ${themeColor}66`}} 
                placeholder="例: Color (シャンプー別)" 
              />
            </div>

            {category.items.map((item, itemIdx) => (
              <div key={itemIdx} style={{ background: '#fff', padding: '10px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #e2e8f0', position: 'relative' }}>
                <button onClick={() => removeMenuItem(catIdx, itemIdx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Trash2 size={16} /></button>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', paddingRight: '25px', marginBottom: '5px' }}>
                  <div>
                    <label style={{...labelStyle, fontSize: '0.7rem'}}>メニュー名</label>
                    <input value={item.name} onChange={(e) => updateMenuItem(catIdx, itemIdx, 'name', e.target.value)} style={{...inputStyle, padding: '8px'}} placeholder="リタッチ" />
                  </div>
                  <div>
                    <label style={{...labelStyle, fontSize: '0.7rem'}}>料金</label>
                    <input value={item.price} onChange={(e) => updateMenuItem(catIdx, itemIdx, 'price', e.target.value)} style={{...inputStyle, padding: '8px'}} placeholder="¥4,000" />
                  </div>
                </div>
                <div style={{ paddingRight: '25px' }}>
                  <input value={item.desc} onChange={(e) => updateMenuItem(catIdx, itemIdx, 'desc', e.target.value)} style={{...inputStyle, padding: '6px 8px', fontSize: '0.8rem'}} placeholder="補足説明（不要な場合は空欄）" />
                </div>
              </div>
            ))}
            
            <button onClick={() => addMenuItem(catIdx)} style={{ width: '100%', padding: '10px', background: '#f1f5f9', border: '1px dashed #cbd5e1', color: '#475569', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}>
              <Plus size={16} /> このカテゴリにメニューを追加
            </button>
          </div>
        ))}
        
        <button onClick={addMenuCategory} style={{ width: '100%', padding: '12px', background: '#fff', border: `2px dashed ${themeColor}`, color: themeColor, borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
          <Plus size={18} /> 新しいカテゴリを追加する
        </button>
      </section>

      {/* 🆕 === よくある質問 (FAQ) === */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}><HelpCircle size={20} color={themeColor} /> よくある質問 (FAQ)</h3>
        
        {faqs.map((faq, idx) => (
          <div key={idx} style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '15px', border: '1px solid #e2e8f0', position: 'relative' }}>
            <button onClick={() => removeFaq(idx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
            <div style={{ marginBottom: '10px', paddingRight: '25px' }}>
              <label style={{...labelStyle, fontSize: '0.75rem', color: '#d97706'}}>Q. 質問</label>
              <input value={faq.q} onChange={(e) => updateFaq(idx, 'q', e.target.value)} style={{...inputStyle, padding: '8px', borderColor: '#fde68a'}} placeholder="クレジットカードは使えますか？" />
            </div>
            <div>
              <label style={{...labelStyle, fontSize: '0.75rem', color: '#059669'}}>A. 回答</label>
              <textarea value={faq.a} onChange={(e) => updateFaq(idx, 'a', e.target.value)} style={{...inputStyle, padding: '8px', borderColor: '#a7f3d0', minHeight: '60px'}} placeholder="はい、VISA/Master等ご利用いただけます。" />
            </div>
          </div>
        ))}
        <button onClick={addFaq} style={{ width: '100%', padding: '12px', background: '#fff', border: `2px dashed ${themeColor}`, color: themeColor, borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
          <Plus size={18} /> 質問を追加する
        </button>
      </section>

      {/* === 2. 営業情報・アクセス === */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={20} color={themeColor} /> 営業情報・アクセス
        </h3>

        {/* 🆕 営業時間 ＆ 定休日 */}
        <div style={{ display: 'grid', gridTemplateColumns: isPC ? '1fr 1fr' : '1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}><Clock size={14} /> 営業時間</label>
            <input 
              value={businessHours} 
              onChange={(e) => setBusinessHours(e.target.value)} 
              style={inputStyle} 
              placeholder="例: 10:00〜20:00（最終受付 19:00）" 
            />
          </div>
          <div>
            <label style={labelStyle}><Calendar size={14} /> 定休日</label>
            <input 
              value={regularHoliday} 
              onChange={(e) => setRegularHoliday(e.target.value)} 
              style={inputStyle} 
              placeholder="例: 毎週火曜日・第2水曜日" 
            />
          </div>
        </div>

        {/* 郵便番号 ＆ 住所 */}
        <div style={{ display: 'grid', gridTemplateColumns: isPC ? '150px 1fr' : '1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>郵便番号</label>
            <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} style={inputStyle} placeholder="123-4567" />
          </div>
          <div>
            <label style={labelStyle}><MapPin size={14} /> 住所</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} placeholder="店舗の所在地" />
          </div>
        </div>

        {/* 訪問サービス設定 */}
        {isVisit && (
          <div style={{ marginTop: '20px', marginBottom: '20px', padding: '20px', background: '#f0f9ff', borderRadius: '16px', border: '1px solid #bae6fd' }}>
            <h4 style={{ marginTop: 0, fontSize: '0.9rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} /> 訪問サービス・移動時間設定
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#0c4a6e', marginBottom: '15px' }}>
              ※訪問先までの移動時間を自動計算するために使用します。
            </p>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                拠点住所（出発・帰着地点）
                <HelpTooltip themeColor={themeColor} text="出張・訪問サービスを行う際の「出発地点」であり「戻ってくる場所」でもあります。" />
              </label>
              <input 
                value={baseAddress} 
                onChange={(e) => setBaseAddress(e.target.value)} 
                style={inputStyle} 
                placeholder="事務所や自宅の住所" 
              />
            </div>

            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                移動スピード目安
                <HelpTooltip themeColor={themeColor} text="1km移動するのにかかる「分」を入力します。" />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem' }}>1km あたり</span>
                <input 
                  type="number" 
                  value={minutesPerKm} 
                  onChange={(e) => setMinutesPerKm(e.target.value === '' ? '' : Number(e.target.value))} 
                  style={{ ...inputStyle, width: '80px', textAlign: 'center' }} 
                />
                <span style={{ fontSize: '0.85rem' }}>分で移動</span>
              </div>
            </div>
          </div>
        )}

        {/* 電話番号 ＆ メール */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}><Phone size={14} /> 電話番号</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="090-0000-0000" />
          </div>
          <div>
            <label style={labelStyle}><Mail size={14} /> お問い合わせ用メール</label>
            <input type="email" value={emailContact} onChange={(e) => setEmailContact(e.target.value)} style={inputStyle} placeholder="mail@example.com" />
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={labelStyle}><Globe size={14} /> 公式サイトURL（外部サイトがある場合）</label>
          <input value={officialUrl} onChange={(e) => setOfficialUrl(e.target.value)} style={inputStyle} placeholder="https://..." />
        </div>
        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px dashed #cbd5e1' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color={themeColor} /> 週間スケジュール表
          </h4>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '15px' }}>
            ※曜日ごとの詳細な時間割（○、×、休 など）を作成できます。診療時間や受付時間帯が曜日で異なる場合にご利用ください。
</p>
          
          <div style={{ overflowX: 'auto', marginBottom: '15px' }}>
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: themeColor, color: '#fff', fontSize: '0.8rem' }}>
                  <th style={{ padding: '8px', borderRadius: '8px 0 0 0', width: '120px' }}>時間枠</th>
                  <th style={{ padding: '8px' }}>月</th>
                  <th style={{ padding: '8px' }}>火</th>
                  <th style={{ padding: '8px' }}>水</th>
                  <th style={{ padding: '8px' }}>木</th>
                  <th style={{ padding: '8px' }}>金</th>
                  <th style={{ padding: '8px', color: '#bfdbfe' }}>土</th>
                  <th style={{ padding: '8px', color: '#fecaca' }}>日</th>
                  <th style={{ padding: '8px', color: '#fecaca' }}>祝</th>
                  <th style={{ padding: '8px', borderRadius: '0 8px 0 0' }}></th>
                </tr>
              </thead>
              <tbody>
                {weeklySchedule.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '8px' }}>
                      <input value={row.time} onChange={(e) => updateSchedule(idx, 'time', e.target.value)} style={{...inputStyle, padding: '6px', fontSize: '0.75rem', textAlign: 'center'}} placeholder="9:00〜12:00" />
                    </td>
                    {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'hol'].map(day => (
                      <td key={day} style={{ padding: '4px' }}>
                        <input value={row[day]} onChange={(e) => updateSchedule(idx, day, e.target.value)} style={{...inputStyle, padding: '6px', fontSize: '0.8rem', textAlign: 'center'}} />
                      </td>
                    ))}
                    <td style={{ padding: '8px' }}>
                      <button onClick={() => removeSchedule(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addSchedule} style={{ width: '100%', padding: '10px', background: '#fff', border: `1px dashed ${themeColor}`, color: themeColor, borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' }}>
            <Plus size={16} /> 時間枠を追加する
          </button>

          {/* 🆕 補足注記コメント入力欄 */}
          <div style={{ marginTop: '15px' }}>
            <label style={{ ...labelStyle, fontSize: '0.8rem', color: '#64748b' }}>※ 補足コメント（スケジュール表の最下部に表示）</label>
            <input 
              value={weeklyScheduleNote} 
              onChange={(e) => setWeeklyScheduleNote(e.target.value)} 
              style={{ ...inputStyle, fontSize: '0.85rem', padding: '8px 12px' }} 
              placeholder="例: ※祝日の営業時間は土曜と同じになります / ※予約優先制" 
            />
          </div>
        </div>
      </section>

      {/* 🆕 === 3. SNS・外部リンク設定 === */}
      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={20} color={themeColor} /> SNSアカウント設定
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={labelStyle}><Instagram size={16} color="#e1306c" /> Instagram URL</label>
            <input 
              value={instagramUrl} 
              onChange={(e) => setInstagramUrl(e.target.value)} 
              style={inputStyle} 
              placeholder="https://www.instagram.com/your_account" 
            />
          </div>

          <div>
            <label style={labelStyle}><Twitter size={16} color="#1da1f2" /> X (旧Twitter) URL</label>
            <input 
              value={xUrl} 
              onChange={(e) => setXUrl(e.target.value)} 
              style={inputStyle} 
              placeholder="https://x.com/your_account" 
            />
          </div>

          <div>
            <label style={labelStyle}><Youtube size={16} color="#ff0000" /> YouTube URL</label>
            <input 
              value={youtubeUrl} 
              onChange={(e) => setYoutubeUrl(e.target.value)} 
              style={inputStyle} 
              placeholder="https://www.youtube.com/@your_channel" 
            />
          </div>
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
                navigate(`?preview=shop`, { replace: true });
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

export default BasicSettings;