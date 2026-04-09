import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Send, User, Mail, MessageSquare, Phone, CheckCircle2 } from 'lucide-react';

const InquiryForm = ({ shopId: propsShopId, themeColor: propsThemeColor }) => {
  const { shopId: paramsShopId } = useParams();
  const shopId = propsShopId || paramsShopId;

  const [formData, setFormData] = useState({});
  const [standardFields, setStandardFields] = useState({});
  const [customQuestions, setCustomQuestions] = useState([]);
  const [displayShopName, setDisplayShopName] = useState('');
  const [themeColor, setThemeColor] = useState(propsThemeColor || '#2563eb');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!shopId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('theme_color, form_config, business_name') // 🆕 business_nameも取得
        .eq('id', shopId)
        .single();

      if (!error && data) {
        setThemeColor(data.theme_color || '#2563eb');

        // 🚀 🆕 屋号の判定リレー開始
        const params = new URLSearchParams(window.location.search);
        const bizType = params.get('type');
        let finalName = data.business_name; // 初期値はメイン店舗名

        if (bizType) {
          // URLにtypeがあれば、対応するカテゴリの「専用屋号」を探しに行く
          const { data: catData } = await supabase
            .from('service_categories')
            .select('custom_shop_name')
            .eq('shop_id', shopId)
            .eq('url_key', bizType)
            .maybeSingle();
          
          if (catData?.custom_shop_name) {
            finalName = catData.custom_shop_name;
          }
        }
        setDisplayShopName(finalName); // 特定した名前を保存
        if (data.form_config) {
          const { custom_questions, ...rest } = data.form_config;
          setStandardFields(rest || {});
          setCustomQuestions(custom_questions || []);
        }
      }
      setLoading(false);
    };
    fetchSettings();
  }, [shopId]);

  const activeStandardFields = Object.entries(standardFields)
    .filter(([key, config]) => config && config.inquiry_enabled === true)
    .map(([key, config]) => ({ id: key, ...config }));

  const activeCustomQuestions = customQuestions.filter(q => q && q.inquiry_enabled === true);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error: dbError } = await supabase.from('inquiries').insert([{
        shop_id: shopId,
        name: formData.name || '不明',
        email: formData.email || '',
        phone: formData.phone || '',
        content: formData.content,
        custom_answers: formData, 
        status: 'unread'
      }]);
      if (dbError) throw dbError;

      const { error: funcError } = await supabase.functions.invoke('resend', {
        body: { 
          type: 'inquiry', 
          shopId, 
          // 🚀 🆕 ここを追加！ Edge Function（Resend）側でこの名前が使われます
          shopName: displayShopName, 
          ...formData 
        }
      });
      if (funcError) throw funcError;

      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert("送信に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div style={loadingStyle}>読み込み中...</div>;

  if (isSuccess) {
    return (
      <div style={containerStyle}>
        <div style={successBoxStyle}>
          <CheckCircle2 size={56} color="#10b981" />
          <h3 style={{ marginTop: '20px', fontSize: '1.4rem' }}>送信完了</h3>
          <p style={{ color: '#64748b', margin: '15px 0 25px' }}>お問い合わせありがとうございました。</p>
          <button onClick={() => setIsSuccess(false)} style={backBtnStyle(themeColor)}>閉じる</button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={headerStyle}>
          <div style={iconBoxStyle(themeColor)}>
            <MessageSquare size={24} color={themeColor} />
          </div>
          <div>
            <h3 style={titleStyle}>お問い合わせ</h3>
            <p style={subTitleStyle}>内容を確認し、順次ご連絡いたします</p>
          </div>
        </div>
        
        <div style={fieldGridStyle}>
          {activeStandardFields.map((field) => (
            <div key={field.id} style={inputGroup}>
              <label style={labelStyle}>{field.label} {field.required && <span style={{color:'#ef4444'}}>*</span>}</label>
              <input 
                type={field.id === 'email' ? 'email' : field.id === 'phone' ? 'tel' : 'text'} 
                name={field.id} 
                required={field.required} 
                onChange={handleInputChange} 
                style={inputStyle} 
                placeholder={field.label} 
              />
            </div>
          ))}

          {activeCustomQuestions.map((q) => (
            <div key={q.id} style={inputGroup}>
              <label style={labelStyle}>{q.label} {q.required && <span style={{color:'#ef4444'}}>*</span>}</label>
              {q.options ? (
                <select name={q.id} required={q.required} onChange={handleInputChange} style={inputStyle}>
                  <option value="">選択してください</option>
                  {q.options.split(',').map(opt => <option key={opt} value={opt}>{opt.trim()}</option>)}
                </select>
              ) : (
                <input type="text" name={q.id} required={q.required} onChange={handleInputChange} style={inputStyle} placeholder={q.label} />
              )}
            </div>
          ))}
        </div>

        <div style={{ ...inputGroup, borderTop: '1px solid #f1f5f9', paddingTop: '20px', marginTop: '10px' }}>
          <label style={labelStyle}>お問い合わせ内容 <span style={{color:'#ef4444'}}>*</span></label>
          <textarea name="content" required onChange={handleInputChange} style={{ ...inputStyle, minHeight: '140px' }} placeholder="ご質問などをご自由にご入力ください" />
        </div>

        <button type="submit" disabled={isSubmitting} style={submitBtnStyle(themeColor)}>
          {isSubmitting ? '送信中...' : 'この内容で送信する'} <Send size={18} />
        </button>
      </form>
    </div>
  );
};

// --- ✨ デザインを一新したスタイル定義 ---
const containerStyle = { 
  minHeight: '100vh', // 画面いっぱいの高さ
  background: '#f8fafc', // 🚀 🆕 綺麗なオフホワイトの背景
  display: 'grid', 
  placeItems: 'center', // 🚀 🆕 上下左右の完璧なセンタリング
  padding: '20px',
  boxSizing: 'border-box'
};

const formStyle = { 
  width: '100%',
  maxWidth: '500px', // 少し幅を広げました
  background: '#fff', 
  padding: '40px', // 余白をたっぷりと
  borderRadius: '32px', // 角をさらに丸く
  border: '1px solid #e2e8f0', 
  boxShadow: '0 20px 50px -12px rgba(0,0,0,0.08)', // 柔らかい大きな影
  boxSizing: 'border-box'
};

const headerStyle = { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' };
const iconBoxStyle = (color) => ({ padding: '12px', background: `${color}10`, borderRadius: '16px' });
const titleStyle = { margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#1e293b' };
const subTitleStyle = { margin: 0, fontSize: '0.85rem', color: '#64748b' };

const fieldGridStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };
const inputGroup = { marginBottom: '20px' };
const labelStyle = { fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '8px', display: 'block' };
const inputStyle = { width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '1rem', boxSizing: 'border-box', background: '#f8fafc', outline: 'none', transition: 'all 0.2s' };

const submitBtnStyle = (color) => ({ 
  width: '100%', padding: '18px', borderRadius: '18px', background: color, color: '#fff', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', 
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px', boxShadow: `0 10px 20px ${color}33`
});

const successBoxStyle = { 
  textAlign: 'center', padding: '60px 40px', background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '500px', 
  border: '1px solid #e2e8f0', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.08)' 
};

const backBtnStyle = (color) => ({ marginTop: '10px', padding: '12px 40px', borderRadius: '14px', border: `2px solid ${color}`, background: 'transparent', color: color, fontWeight: 'bold', cursor: 'pointer' });
const loadingStyle = { textAlign: 'center', padding: '100px', color: '#64748b', background: '#f8fafc', minHeight: '100vh' };

export default InquiryForm;