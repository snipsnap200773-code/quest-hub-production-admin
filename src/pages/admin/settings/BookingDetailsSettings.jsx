import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  ClipboardList, ArrowLeft, Save, CheckCircle2, 
  MapPin, Car, Building2, HeartPulse, MessageSquare, 
  ToggleLeft, ToggleRight,
  User, Mail, Phone, Scissors, Sparkles, Plus, Trash2
} from 'lucide-react';

const ConfigItem = ({ id, icon: Icon, title, description, formConfig, themeColor, toggleField }) => {
  if (!formConfig || !formConfig[id]) return null;

  return (
    <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
          <div style={{ padding: '10px', background: `${themeColor}10`, borderRadius: '12px', height: 'fit-content' }}>
            <Icon size={24} color={themeColor} />
          </div>
          <div>
            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{title}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{description}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#ef4444', marginBottom: '4px', fontWeight: 'bold' }}>必須</div>
            <button onClick={() => toggleField(id, 'required')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: formConfig[id].required ? '#ef4444' : '#cbd5e1' }} disabled={id === 'name'}>
              {formConfig[id].required ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </button>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>Web</div>
            <button onClick={() => toggleField(id, 'normal')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: formConfig[id].enabled ? themeColor : '#cbd5e1' }}>
              {formConfig[id].enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </button>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#16a34a', marginBottom: '4px', fontWeight: 'bold' }}>LINE</div>
            <button onClick={() => toggleField(id, 'line')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: formConfig[id].line_enabled ? '#16a34a' : '#cbd5e1' }}>
              {formConfig[id].line_enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </button>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginBottom: '4px', fontWeight: 'bold' }}>問合せ</div>
            <button onClick={() => toggleField(id, 'inquiry')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: formConfig[id].inquiry_enabled ? '#f59e0b' : '#cbd5e1' }}>
              {formConfig[id].inquiry_enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 復元：カスタム質問用コンポーネント
const CustomFieldItem = ({ field, themeColor, updateCustomField, deleteCustomField }) => {
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' };
  return (
    <div style={{ marginBottom: '20px', padding: '20px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color={themeColor} /> カスタム質問
        </div>
        <button onClick={() => deleteCustomField(field.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Trash2 size={18} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>質問内容</label>
          <input type="text" value={field.label || ''} onChange={(e) => updateCustomField(field.id, 'label', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>選択肢（カンマ区切り）</label>
          <input type="text" value={field.options} onChange={(e) => updateCustomField(field.id, 'options', e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '25px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold' }}>必須:</span>
          <button onClick={() => updateCustomField(field.id, 'required', !field.required)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: field.required ? '#ef4444' : '#cbd5e1' }}>
            {field.required ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>Web:</span>
          <button onClick={() => updateCustomField(field.id, 'enabled', !field.enabled)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: field.enabled ? themeColor : '#cbd5e1' }}>
            {field.enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 'bold' }}>LINE:</span>
          <button onClick={() => updateCustomField(field.id, 'line_enabled', !field.line_enabled)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: field.line_enabled ? '#16a34a' : '#cbd5e1' }}>
            {field.line_enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 'bold' }}>問合せ:</span>
          <button onClick={() => updateCustomField(field.id, 'inquiry_enabled', !field.inquiry_enabled)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: field.inquiry_enabled ? '#f59e0b' : '#cbd5e1' }}>
            {field.inquiry_enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
        </div>
      </div>
    </div>
  );
};

const BookingDetailsSettings = ({ reloadPreview }) => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [brandCategories, setBrandCategories] = useState([]);
  const [customFields, setCustomFields] = useState([]); // 復元

  // すべての項目を初期値としてセット
  const [formConfig, setFormConfig] = useState({
    name: { enabled: true, line_enabled: true, label: "お名前", required: true },
    furigana: { enabled: false, line_enabled: false, label: "ふりがな", required: false },
    email: { enabled: true, line_enabled: true, label: "メールアドレス", required: true },
    phone: { enabled: true, line_enabled: true, label: "電話番号", required: true },
    zip_code: { enabled: false, line_enabled: false, label: "郵便番号", required: false },
    address: { enabled: false, line_enabled: false, label: "住所", required: false },
    parking: { enabled: false, line_enabled: false, label: "駐車場", required: false },
    building_type: { enabled: false, line_enabled: false, label: "建物", required: false },
    care_notes: { enabled: false, line_enabled: false, label: "介助状況", required: false },
    company_name: { enabled: false, line_enabled: false, label: "会社名", required: false },
    symptoms: { enabled: false, line_enabled: false, label: "お悩み", required: false },
    request_details: { enabled: false, line_enabled: false, label: "詳細要望", required: false },
    notes: { enabled: true, line_enabled: true, label: "備考欄", required: false }
  });

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isPC = windowWidth > 900;

  useEffect(() => { if (shopId) fetchSettings(); }, [shopId]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('profiles').select('theme_color, form_config').eq('id', shopId).single();
    if (data) {
      setThemeColor(data.theme_color || '#2563eb');
      if (data.form_config) {
        const { custom_questions, ...restConfig } = data.form_config;
        setFormConfig(prev => ({ ...prev, ...(restConfig || {}) }));
        setCustomFields(custom_questions || []);
      }

      const { data: catData } = await supabase
        .from('service_categories')
        .select('name, url_key, custom_shop_name')
        .eq('shop_id', shopId)
        .neq('url_key', '') 
        .not('url_key', 'is', null); 
      
      if (catData) setBrandCategories(catData);
    }
  };

  const inquiryUrl = `${window.location.origin}/shop/${shopId}/inquiry`;

  const showMsg = (txt) => { 
    setMessage(txt); 
    setTimeout(() => setMessage(''), 3000);
    if (typeof reloadPreview === 'function') {
      setTimeout(() => reloadPreview(), 300);
    }
  };

  const handleSave = async () => {
    const payload = { ...formConfig, custom_questions: customFields };
    const { error } = await supabase.from('profiles').update({ form_config: payload }).eq('id', shopId);
    if (!error) showMsg('予約項目の設定を保存しました！');
    else alert('保存に失敗しました。');
  };

  const toggleField = (key, type = 'normal') => {
    let targetKey = 'enabled';
    if (type === 'line') targetKey = 'line_enabled';
    if (type === 'required') targetKey = 'required';
    if (type === 'inquiry') targetKey = 'inquiry_enabled';
    
    setFormConfig(prev => ({ 
      ...prev, 
      [key]: { ...prev[key], [targetKey]: !prev[key][targetKey] } 
    }));
  };

  // カスタム質問の操作関数復元
  const addCustomField = () => {
    const newField = { id: `custom_${Date.now()}`, label: '新しい質問', options: 'はい,いいえ', enabled: true, line_enabled: true, required: false };
    setCustomFields([...customFields, newField]);
  };

  const updateCustomField = (id, key, value) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const deleteCustomField = (id) => {
    if (window.confirm('削除しますか？')) setCustomFields(customFields.filter(f => f.id !== id));
  };

  const containerStyle = { fontFamily: 'sans-serif', maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px' };
  const cardStyle = { marginBottom: '20px', background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };

  return (
    <div style={containerStyle}>
      {message && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', padding: '15px', background: '#dcfce7', color: '#166534', borderRadius: '12px', zIndex: 2000, textAlign: 'center', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          <CheckCircle2 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '30px' }}>
        <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={18} /> {isPC ? 'ダッシュボードへ戻る' : '戻る'}
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '24px', fontWeight: 'bold' }}>
        <ClipboardList size={28} style={{ verticalAlign: 'middle', marginRight: '10px' }} /> 予約時の入力項目設定
      </h2>

      <h3 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '15px', paddingLeft: '10px' }}>▼ 基本情報</h3>
      <section style={{ ...cardStyle, borderTop: `6px solid #94a3b8` }}>
        <ConfigItem id="name" icon={User} title="お名前" description="必須項目です。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="furigana" icon={User} title="ふりがな" description="読み仮名を有効にします。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="email" icon={Mail} title="メールアドレス" description="通知先になります。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="phone" icon={Phone} title="電話番号" description="緊急連絡先です。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
      </section>

      {/* 復元：業種別項目 */}
      <h3 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '15px', paddingLeft: '10px' }}>▼ 業種別項目</h3>
      <section style={{ ...cardStyle, borderTop: `6px solid ${themeColor}` }}>
        <ConfigItem id="zip_code" icon={MapPin} title="郵便番号" description="住所入力の補助。移動時間の計算に使用されます。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="address" icon={MapPin} title="住所" description="訪問サービス用。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="parking" icon={Car} title="駐車場" description="駐車場の有無。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="building_type" icon={Building2} title="建物の種類" description="戸建・集合住宅など。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="care_notes" icon={HeartPulse} title="お身体の状況" description="介助の有無など。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="symptoms" icon={Sparkles} title="お悩み" description="状態やレベル。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="request_details" icon={Scissors} title="詳細要望" description="デザイン等。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
        <ConfigItem id="notes" icon={MessageSquare} title="備考欄" description="末尾に固定されます。" formConfig={formConfig} themeColor={themeColor} toggleField={toggleField} />
      </section>
      
      {/* 復元：カスタム質問 */}
      <h3 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '15px', paddingLeft: '10px' }}>▼ カスタム質問（ラジオボタン）</h3>
      <section style={{ ...cardStyle, borderTop: `6px solid #fbbf24` }}>
        {customFields.map(field => (
          <CustomFieldItem key={field.id} field={field} themeColor={themeColor} updateCustomField={updateCustomField} deleteCustomField={deleteCustomField} />
        ))}
        <button onClick={addCustomField} style={{ width: '100%', padding: '15px', background: '#fff', border: '2px dashed #fbbf24', borderRadius: '12px', color: '#b45309', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Plus size={20} /> 質問を追加
        </button>
      </section>

      {/* 👇 修正：BookingScheduleSettings と同じ、フッター固定＆横幅いっぱいのデザインに統一 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '24px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', zIndex: 1000 }}>
        <button onClick={handleSave} style={{ width: '100%', maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '18px', background: themeColor, color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: `0 10px 25px ${themeColor}66`, cursor: 'pointer' }}>
          <Save size={22} /> 設定を保存 💾
        </button>
      </div>
    </div>
  );
};

const copyBtnStyle = (color) => ({
  padding: '10px 20px',
  background: color,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '0.85rem',
  transition: 'opacity 0.2s'
});

export default BookingDetailsSettings;