import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
// 🆕 共通設定ファイルをインポート（BasicSettingsと同じ階層を想定）
import { INDUSTRY_LABELS } from '../../../constants/industryMaster';

import { 
  ChevronRight, ChevronLeft, Check, Store, User, MapPin, 
  MessageSquare, Globe, Phone, Mail, FileText, Camera, SkipForward, ListChecks 
} from 'lucide-react';

const BasicSettingsGuide = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    business_name: '', business_name_kana: '', owner_name: '', owner_name_kana: '',
    business_type: '美容室・理容室', address: '', phone: '', email_contact: '',
    official_url: '', description: '', intro_text: '', image_url: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', shopId).single();
      if (data) setFormData(data);
    };
    if (shopId) fetchInitialData();
  }, [shopId]);

  // 入力をDBに即時反映させる関数
  const updateFieldAndSave = async (field, value) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    await supabase.from('profiles').update({ [field]: value }).eq('id', shopId);
  };

  // 画像アップロードとDB同期の完全ロジック
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${shopId}-main.${fileExt}`;

    // 1. Storageへアップロード
    const { error: uploadError } = await supabase.storage
      .from('shop-images')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      alert('アップロード失敗: ' + uploadError.message);
      setLoading(false);
      return;
    }

    // 2. 公開URLの取得
    const { data: urlData } = supabase.storage
      .from('shop-images')
      .getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // 3. profilesテーブルのimage_url列を確実に更新
    await supabase.from('profiles').update({ image_url: publicUrl }).eq('id', shopId);

    // 4. Stateを更新し、画像がある状態で確認画面(Step 10)へ移動
    setFormData(prev => ({ ...prev, image_url: `${publicUrl}?t=${Date.now()}` }));
    setLoading(false);
    setStep(10); 
  };

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  // --- 🎨 スタイル定義（サイド余白統一 & エラー回避） ---
  const containerStyle = { 
    minHeight: '100vh', background: '#0f172a', color: '#fff', 
    fontFamily: 'sans-serif', boxSizing: 'border-box', position: 'relative', 
    width: '100%', display: 'flex', flexDirection: 'column' 
  };
  
  const cardStyle = { 
    width: '100%', maxWidth: '480px', margin: '0 auto', textAlign: 'center', 
    paddingLeft: '20px', paddingRight: '20px', boxSizing: 'border-box', 
    flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' 
  };
  
  const inputStyle = { 
    width: '100%', padding: '16px', borderRadius: '14px', background: '#1e293b', 
    border: '2px solid #334155', color: '#fff', fontSize: '1.1rem', 
    marginBottom: '12px', boxSizing: 'border-box', outline: 'none' 
  };

  const btnPrimary = { 
    width: '100%', padding: '18px', borderRadius: '40px', background: '#2563eb', 
    color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', 
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
    gap: '8px', transition: '0.2s' 
  };

  const btnSkip = { 
    background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', 
    cursor: 'pointer', textAlign: 'center', marginTop: '20px' 
  };

  const backBtnStyle = { 
    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', 
    borderRadius: '50%', width: '44px', height: '44px', display: 'flex', 
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', 
    backdropFilter: 'blur(4px)' 
  };

  const SkipButton = () => (
    <button style={btnSkip} onClick={handleNext}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        この項目をスキップ <SkipForward size={14} />
      </div>
      <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6, marginTop: '4px' }}>
        （※後でいつでも設定できます）
      </span>
    </button>
  );

  const renderStep = () => {
    switch(step) {
      case 0: return (
        <div style={cardStyle}>
          <Store size={60} color="#3b82f6" style={{marginBottom:'32px', alignSelf: 'center'}} />
<h2 style={{fontSize: '1.8rem', marginBottom: '32px'}}>業種を教えてください。</h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
            {/* 🆕 共通マスタから動的にボタンを生成 */}
            {INDUSTRY_LABELS.map(type => (
              <button 
                key={type} 
                onClick={() => { updateFieldAndSave('business_type', type); handleNext(); }} 
                style={{ 
                  ...inputStyle, 
                  textAlign: 'left', 
                  border: formData.business_type === type ? '2px solid #3b82f6' : '2px solid #334155', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '20px',
                  fontSize: '1rem' 
                }}
              >
                {type} {formData.business_type === type && <Check size={24} color="#3b82f6" />}
              </button>
            ))}
          </div>
                  </div>
      );
      case 1: return (
        <div style={cardStyle}>
          <h2 style={{fontSize: '1.8rem', marginBottom: '40px'}}>拠点の名前（屋号）は？</h2>
          <input placeholder="店舗名" style={inputStyle} value={formData.business_name || ''} onChange={e => updateFieldAndSave('business_name', e.target.value)} />
          <input placeholder="かな" style={inputStyle} value={formData.business_name_kana || ''} onChange={e => updateFieldAndSave('business_name_kana', e.target.value)} />
          <button style={{...btnPrimary, marginTop: '20px'}} onClick={handleNext} disabled={!formData.business_name}>次へ <ChevronRight size={20} /></button>
        </div>
      );
      case 2: return (
        <div style={cardStyle}>
          <User size={60} color="#3b82f6" style={{marginBottom:'32px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '1.8rem', marginBottom: '40px'}}>主人の名前を教えてください。</h2>
          <input placeholder="氏名" style={inputStyle} value={formData.owner_name || ''} onChange={e => updateFieldAndSave('owner_name', e.target.value)} />
          <input placeholder="かな" style={inputStyle} value={formData.owner_name_kana || ''} onChange={e => updateFieldAndSave('owner_name_kana', e.target.value)} />
          <button style={{...btnPrimary, marginTop: '20px'}} onClick={handleNext}>次へ <ChevronRight size={20} /></button>
          <SkipButton />
        </div>
      );
      case 3: return (
        <div style={cardStyle}>
          <Globe size={60} color="#3b82f6" style={{marginBottom:'32px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '1.8rem', marginBottom: '40px'}}>公式サイトはありますか？</h2>
          <input placeholder="https://..." style={inputStyle} value={formData.official_url || ''} onChange={e => updateFieldAndSave('official_url', e.target.value)} />
          <button style={{...btnPrimary, marginTop: '20px'}} onClick={handleNext}>次へ <ChevronRight size={20} /></button>
          <SkipButton />
        </div>
      );
      case 4: return (
        <div style={cardStyle}>
          <Phone size={60} color="#3b82f6" style={{marginBottom:'32px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '1.8rem', marginBottom: '40px'}}>電話番号を教えてください。</h2>
          <input type="tel" placeholder="090-0000-0000" style={inputStyle} value={formData.phone || ''} onChange={e => updateFieldAndSave('phone', e.target.value)} />
          <button style={{...btnPrimary, marginTop: '20px'}} onClick={handleNext}>次へ <ChevronRight size={20} /></button>
          <SkipButton />
        </div>
      );
      case 5: return (
        <div style={cardStyle}>
          <Mail size={60} color="#3b82f6" style={{marginBottom:'32px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '1.8rem', marginBottom: '40px'}}>メールアドレスは？</h2>
          <input type="email" placeholder="example@mail.com" style={inputStyle} value={formData.email_contact || ''} onChange={e => updateFieldAndSave('email_contact', e.target.value)} />
          <button style={{...btnPrimary, marginTop: '20px'}} onClick={handleNext}>次へ <ChevronRight size={20} /></button>
          <SkipButton />
        </div>
      );
      case 6: return (
        <div style={cardStyle}>
          <MapPin size={60} color="#3b82f6" style={{marginBottom:'32px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '1.8rem', marginBottom: '40px'}}>拠点の住所はどこですか？</h2>
          <input placeholder="住所を入力" style={inputStyle} value={formData.address || ''} onChange={e => updateFieldAndSave('address', e.target.value)} />
          <button style={{...btnPrimary, marginTop: '20px'}} onClick={handleNext}>次へ <ChevronRight size={20} /></button>
          <SkipButton />
        </div>
      );
      case 7: return (
        <div style={cardStyle}>
          <MessageSquare size={60} color="#3b82f6" style={{marginBottom:'32px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '1.8rem', marginBottom: '40px'}}>サブタイトルを決めましょう。</h2>
          <input placeholder="例：魔王を倒す！" style={inputStyle} value={formData.description || ''} onChange={e => updateFieldAndSave('description', e.target.value)} />
          <button style={{...btnPrimary, marginTop: '20px'}} onClick={handleNext}>次へ <ChevronRight size={20} /></button>
          <SkipButton />
        </div>
      );
      case 8: return (
        <div style={cardStyle}>
          <FileText size={60} color="#3b82f6" style={{marginBottom:'32px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '1.8rem', marginBottom: '40px'}}>店舗の紹介文をどうぞ。</h2>
          <textarea 
            placeholder="冒険者に向けた詳細な説明..." 
            style={{ ...inputStyle, minHeight: '150px', resize: 'none' }} 
            value={formData.intro_text || ''} 
            onChange={e => updateFieldAndSave('intro_text', e.target.value)} 
          />
          <button style={{...btnPrimary, marginTop: '20px'}} onClick={handleNext}>次へ <ChevronRight size={20} /></button>
          <SkipButton />
        </div>
      );
      case 9: return (
        <div style={cardStyle}>
          <Camera size={60} color="#3b82f6" style={{marginBottom:'32px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '1.8rem', marginBottom: '40px'}}>拠点の画像を掲げよう！</h2>
          <div style={{ marginBottom: '24px', padding: '24px', background: '#1e293b', borderRadius: '24px', border: '2px dashed #334155' }}>
            {formData.image_url ? (
              <img src={formData.image_url} alt="preview" style={{ width: '100%', maxWidth: '200px', borderRadius: '16px', aspectRatio: '1/1', objectFit: 'cover' }} />
            ) : (
              <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>NO IMAGE</div>
            )}
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ marginTop: '20px', fontSize: '0.9rem', color: '#94a3b8' }} />
          </div>
          <button style={btnPrimary} onClick={handleNext} disabled={loading}>{loading ? 'アップロード中...' : '確認画面へ進む'}</button>
          <SkipButton />
        </div>
      );
      case 10: return (
        <div style={{
          width: '100%', maxWidth: '480px', margin: '0 auto', textAlign: 'center', 
          paddingLeft: '20px', paddingRight: '20px', boxSizing: 'border-box', 
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', 
          paddingTop: '80px', paddingBottom: '40px'
        }}>
          <ListChecks size={60} color="#10b981" style={{marginBottom:'24px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '1.8rem', marginBottom: '12px'}}>最終確認</h2>
          <p style={{color: '#94a3b8', marginBottom: '32px'}}>全ての冒険準備が整いましたか？</p>
          <div style={{ background: '#1e293b', borderRadius: '20px', padding: '24px', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}>
            {[
              { l: '業種', v: formData.business_type },
              { l: '店舗名', v: formData.business_name },
              { l: 'かな', v: formData.business_name_kana },
              { l: '代表者', v: formData.owner_name },
              { l: '代表かな', v: formData.owner_name_kana },
              { l: 'URL', v: formData.official_url },
              { l: '電話', v: formData.phone },
              { l: 'メール', v: formData.email_contact },
              { l: '住所', v: formData.address },
              { l: 'サブタイ', v: formData.description },
              { l: '紹介文', v: formData.intro_text ? '入力済み' : '未設定' },
              { l: '画像', v: formData.image_url ? '設定済み' : '未設定' }
            ].map(i => (
              <div key={i.l} style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid #334155' }}>
                <span style={{ width: '90px', color: '#64748b', fontWeight: 'bold', fontSize: '0.85rem' }}>{i.l}</span>
                <span style={{ flex: 1, color: '#fff', fontSize: '0.95rem', wordBreak: 'break-all' }}>{i.v || '（スキップ）'}</span>
              </div>
            ))}
          </div>
          <button style={{ ...btnPrimary, background: '#10b981', marginTop: '40px' }} onClick={handleNext}>これで冒険に出る！</button>
        </div>
      );
      case 11: return (
        <div style={cardStyle}>
          <Check size={80} color="#10b981" style={{marginBottom:'32px', alignSelf: 'center'}} />
          <h2 style={{fontSize: '2rem', marginBottom: '16px'}}>全ての準備が完了！</h2>
          <p style={{color: '#94a3b8', marginBottom: '48px'}}>拠点の基本情報が安全に保存されました。</p>
          <button style={{ ...btnPrimary, background: '#10b981' }} onClick={() => navigate(`/admin/${shopId}/dashboard`)}>ダッシュボードへ戻る</button>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ width: '100%', height: '6px', background: '#334155', position: 'fixed', top: 0, left: 0, zIndex: 100 }}>
        <div style={{ width: `${(step / 11) * 100}%`, height: '100%', background: '#3b82f6', transition: '0.4s' }} />
      </div>

      {step > 0 && step < 11 && (
        <div style={{ position: 'fixed', top: '24px', left: '24px', zIndex: 110 }}>
          <button style={backBtnStyle} onClick={handleBack} title="一つ前に戻る">
            <ChevronLeft size={24} />
          </button>
        </div>
      )}

      {renderStep()}
    </div>
  );
};

export default BasicSettingsGuide;