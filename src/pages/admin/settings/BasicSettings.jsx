import React, { useEffect, useState } from 'react';
// 🆕 INDUSTRY_LABELS に加え、getSubCategories も追加
import { INDUSTRY_LABELS, getSubCategories } from '../../../constants/industryMaster';

import { useParams, useNavigate, Link } from 'react-router-dom';

// ... (lucide-reactのインポートは維持)

import { supabase } from "../../../supabaseClient";
import { 
  ArrowLeft, Sparkles, Save, Camera, MapPin, 
  User, Phone, Mail, Globe, Info, AlertCircle 
} from 'lucide-react';

// 🆕 作成したHelpTooltipを読み込む（同じ階層に作った場合）
import HelpTooltip from '../../../components/ui/HelpTooltip';



const BasicSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();

  // 🆕 画面サイズ管理を追加（ボタンをレスポンシブにするため）
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900;

  // --- 1. State 管理 (本家から完全移植) ---
  const [message, setMessage] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessNameKana, setBusinessNameKana] = useState('');
const [ownerName, setOwnerName] = useState('');
  const [ownerNameKana, setOwnerNameKana] = useState('');
  const [businessType, setBusinessType] = useState('');
  // 🆕 小カテゴリ保存用の変数を追加
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
      setBusinessType(data.business_type || '');
      // 🆕 データベースから小カテゴリの値を取得
      setSubBusinessType(data.sub_business_type || '');
      setPhone(data.phone || '');
      setEmailContact(data.email_contact || '');
// ✅ 郵便番号、住所に加え、拠点住所と移動スピードも取得する
setZipCode(data.zip_code || ''); // 🆕 郵便番号を取得
setAddress(data.address || '');
      setBaseAddress(data.base_address || data.address || ''); // 拠点住所が空なら店舗住所を初期値に
      setMinutesPerKm(data.minutes_per_km ?? 3); // nullやundefinedならデフォルト値の3を入れる
      setDescription(data.description || '');
      setIntroText(data.intro_text || '');
      setNotes(data.notes || '');
      setImageUrl(data.image_url || '');
      setOfficialUrl(data.official_url || '');
      setThemeColor(data.theme_color || '#2563eb');
    }
  };

  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  // --- 画像アップロード処理 (修正済みの確実なロジックを完全維持) ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${shopId}-main.${fileExt}`;
    
    showMsg('画像を更新中...');

    const { data, error: uploadError } = await supabase.storage
      .from('shop-images')
      .upload(fileName, file, { 
        contentType: 'image/jpeg', 
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
  
  // --- 保存処理 ---
const handleSave = async () => {
    const { error } = await supabase.from('profiles').update({
      business_name: businessName, business_name_kana: businessNameKana,
      owner_name: ownerName, owner_name_kana: ownerNameKana,
      business_type: businessType, 
      // 🆕 保存対象に小カテゴリを追加
      sub_business_type: subBusinessType,
      phone, email_contact: emailContact, 
      zip_code: zipCode, // 🆕 保存対象に郵便番号を追加
      address,
      description, intro_text: introText, notes, image_url: imageUrl, official_url: officialUrl,
      // 🆕 保存対象に追加
      base_address: baseAddress,
      minutes_per_km: minutesPerKm
    }).eq('id', shopId);

    if (!error) showMsg('店舗プロフィールを保存しました！');
    else alert('保存に失敗しました。');
  };

  // --- スタイル定義 ---
  const containerStyle = { fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', position: 'relative' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem', background: '#fff' };
  const labelStyle = { fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#334155' };

  return (
    <div style={containerStyle}>
      {/* 🔔 通知メッセージ */}
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 1001, textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

{/* 🚀 ナビゲーションヘッダー（オシャレ＆レスポンシブ版） */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', gap: '10px' }}>
        <button 
          onClick={() => navigate(`/admin/${shopId}/dashboard`)}
          style={{ 
            background: '#fff', 
            border: '1px solid #e2e8f0', 
            padding: isPC ? '10px 20px' : '10px 12px', 
            borderRadius: '30px', 
            fontWeight: 'bold', 
            color: '#64748b', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: isPC ? '1rem' : '0.8rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            whiteSpace: 'nowrap'
          }}
        >
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ' : '戻る'}
        </button>

        <button 
          // 🚀 🆕 案内人機能を一旦停止（リンク解除 ＆ 無効化）
          disabled={true} 
          style={{ 
            background: '#cbd5e1', // 鮮やかな色からグレーに変更
            border: 'none', 
            padding: isPC ? '10px 20px' : '10px 15px', 
            borderRadius: '30px', 
            fontSize: isPC ? '0.9rem' : '0.8rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'not-allowed', // カーソルを「禁止マーク」に変更
            boxShadow: 'none', // 影を消して平坦にする
            whiteSpace: 'nowrap'
          }}
        >
          {/* ラベルも「準備中」などにすると親切です */}
          <Sparkles size={16} /> {isPC ? '案内人（準備中）' : '準備中'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        店舗基本設定
      </h2>

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={20} color={themeColor} /> 店舗プロフィール
        </h3>
        
        {/* --- 🖼️ 店舗画像セクション --- */}
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
  店舗画像（推奨 1:1）
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
              📸 写真を撮る / 変更する
            </button>
          </div>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>代表者名</label>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={inputStyle} placeholder="お名前" />
          </div>
          <div>
            <label style={labelStyle}>ふりがな</label>
            <input value={ownerNameKana} onChange={(e) => setOwnerNameKana(e.target.value)} style={inputStyle} placeholder="おなまえ" />
          </div>
        </div>

{/* --- 業種選択セクション（二段構え） --- */}
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
  大カテゴリ（業種）
  <HelpTooltip themeColor={themeColor} text="お店のメインの業種を選択してください。これにより、予約フォームの初期項目やポータルサイトでの表示が最適化されます。" />
</label>
            <select 
              value={businessType} 
              onChange={(e) => {
                setBusinessType(e.target.value);
                setSubBusinessType(''); // 大カテゴリを変えたら小カテゴリはリセット
              }} 
              style={{ ...inputStyle, fontWeight: 'bold', color: themeColor }}
            >
              <option value="">-- 業種を選択してください --</option>
              {INDUSTRY_LABELS.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          </div>

          {/* 🆕 小カテゴリの表示：選択した大カテゴリにサブ項目がある場合のみ出現 */}
          {businessType && getSubCategories(businessType).length > 0 && (
            <div style={{ marginTop: '15px', paddingLeft: '15px', borderLeft: `3px solid ${themeColor}` }}>
              <label style={labelStyle}>詳細ジャンル（小カテゴリ）</label>
              <select 
                value={subBusinessType} 
                onChange={(e) => setSubBusinessType(e.target.value)} 
                style={inputStyle}
              >
                <option value="">-- 詳細を選択 --</option>
                {getSubCategories(businessType).map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}><Globe size={14} /> 公式サイトURL</label>
          <input value={officialUrl} onChange={(e) => setOfficialUrl(e.target.value)} style={inputStyle} placeholder="https://..." />
        </div>
        
        {/* 🆕 郵便番号 ＆ 住所 セクション */}
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
        
        {/* 🆕 訪問サービス専用設定セクション */}
        <div style={{ marginTop: '30px', padding: '20px', background: '#f0f9ff', borderRadius: '16px', border: '1px solid #bae6fd' }}>
          <h4 style={{ marginTop: 0, fontSize: '0.9rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} /> 訪問サービス・移動時間設定
          </h4>
          <p style={{ fontSize: '0.75rem', color: '#0c4a6e', marginBottom: '15px' }}>
            ※訪問先までの移動時間を自動計算するために使用します。
          </p>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
  出発・帰還の拠点住所
  <HelpTooltip themeColor={themeColor} text="出張・訪問サービスを行う際の「出発地点」です。自宅や事務所の住所を入力してください。店舗と同じ場所なら同じ住所でOKです。" />
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
  <HelpTooltip themeColor={themeColor} text="1km移動するのにかかる「分」を入力します（例：車なら3分、自転車なら5分）。これにより、移動時間を含めた予約枠の自動調整が行われます。" />
</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem' }}>1km あたり</span>
              <input 
                type="number" 
                value={minutesPerKm} 
                onChange={(e) => setMinutesPerKm(e.target.value)} 
                style={{ ...inputStyle, width: '80px', textAlign: 'center' }} 
              />
              <span style={{ fontSize: '0.85rem' }}>分で移動</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '5px' }}>
              （例：車なら3分、自転車なら5分程度が目安です）
            </p>
          </div>
        </div>

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
        
        {/* サブタイトル (プレビュー付き) */}
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
  サブタイトル (予約画面に表示されます)
  <HelpTooltip themeColor={themeColor} text="店名の下に表示される短いキャッチコピーです。「/」を入力した場所で、実際の画面では改行されます。" />
</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} placeholder="スラッシュ(/)で改行できます" />
<div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: `1px solid ${themeColor}22` }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: themeColor, lineHeight: '1.6' }}>
            {description ? (description || '').split('/').map((line, idx) => (
              <React.Fragment key={idx}>{line}{idx < (description || '').split('/').length - 1 && <br />}</React.Fragment>
            )) : 'プレビューが表示されます'}
          </div>
        </div>

        {/* 紹介・詳細 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}><Info size={14} /> 店舗紹介・詳細アピール文</label>
          <textarea value={introText} onChange={(e) => setIntroText(e.target.value)} style={{ ...inputStyle, minHeight: '150px' }} placeholder="お客様へのメッセージをご記入ください" />
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}><AlertCircle size={14} /> 注意事項</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, border: '2px solid #fee2e2', minHeight: '80px' }} placeholder="キャンセル規定や遅刻についてなど" />
        </div>

        <button 
          onClick={handleSave} 
          style={{ width: '100%', padding: '18px', background: themeColor, color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '10px', boxShadow: `0 8px 20px ${themeColor}44`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Save size={20} /> 設定内容を保存する 💾
        </button>
      </section>
    </div>
  );
};

export default BasicSettings;