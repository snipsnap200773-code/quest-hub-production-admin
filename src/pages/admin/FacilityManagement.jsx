import { INDUSTRY_PRESETS } from '../../constants/industryMaster';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient'; 
import { 
  Building2, Plus, MapPin, Calendar, Users, 
  ChevronRight, X, Save, User, ArrowLeft, Phone, Mail, Trash2, Edit3, Clock, Copy, Link2,
  Search, AlertCircle,
  ArrowRight, CheckCircle2, Send, Filter, Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 定数定義（既存システムから継承）
const DAYS = [
  { label: "月", value: 1 }, { label: "火", value: 2 }, { label: "水", value: 3 },
  { label: "木", value: 4 }, { label: "金", value: 5 }, { label: "土", value: 6 }, { label: "日", value: 0 }
];
const WEEKS = [
  { label: "第1週", value: 1 }, { label: "第2週", value: 2 }, { label: "第3週", value: 3 },
  { label: "第4週", value: 4 }, { label: "最終週", value: -1 }, { label: "最後から2番目", value: -2 }
];
const MONTH_TYPES = [
  { label: "毎月", value: 0 }, { label: "奇数月", value: 1 }, { label: "偶数月", value: 2 }
];

const FacilityManagement = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopSettings, setShopSettings] = useState({ 
    email_notifications_enabled: true,
    is_facility_searchable: false, // 🚀 追加：検索に出るか
    sub_business_type: '理美容',    // 🚀 追加：ジャンル
    bank_name: '',
    bank_branch: '',
    bank_account_type: '普通',
    bank_account_number: '',
    bank_account_holder: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const visitingSubCategories = INDUSTRY_PRESETS.visiting.subCategories;

  // フォームState（既存システムをベースに tenant_id を追加）
  const [formData, setFormData] = useState({ 
    facility_name: '', 
    regular_rules: [], 
    tenant_id: shopId 
  });

  const [selDay, setSelDay] = useState(1);
  const [selWeek, setSelWeek] = useState(1);
  const [selMonthType, setSelMonthType] = useState(0);
  const [selTime, setSelTime] = useState('09:00');

  useEffect(() => {
    fetchFacilities();
  }, [shopId]);

  const fetchFacilities = async () => {
    setLoading(true);

    // ✅ 修正：振込先情報も一緒に取得するように変更
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_notifications_enabled, is_facility_searchable, sub_business_type, bank_name, bank_branch, bank_account_type, bank_account_number, bank_account_holder')
      .eq('id', shopId)
      .single();
    
    if (profile) {
      setShopSettings(profile);
    }
    
    // 🆕 提携ステータスが 'active'（承認済み）のものだけを取得するように修正
    const { data, error } = await supabase
      .from('shop_facility_connections')
      .select(`
        *,
        facility_users (*)
      `)
      .eq('shop_id', shopId)
      .in('status', ['active', 'pending']) // 🆕 active か pending なら取得する
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      const formatted = data.map(item => ({
        ...item.facility_users,
        id: item.facility_users.id,
        status: item.status, // 🆕 ステータス（active or pending）を保持
        regular_rules: item.regular_rules || [],
        connection_id: item.id
      }));
      setFacilities(formatted);
    } else if (error) {
      console.error("取得エラー:", error);
    }
    setLoading(false);
  };

  const addRule = () => {
    // 時間も含めて重複チェック
    const exists = formData.regular_rules?.some(r => 
      r.day === selDay && r.week === selWeek && r.monthType === selMonthType && r.time === selTime
    );
    if (exists) return;
    
    const newRule = { 
      day: selDay, 
      week: selWeek, 
      monthType: selMonthType, 
      time: selTime // 🆕 選択された時間を保存
    };
    setFormData({ ...formData, regular_rules: [...(formData.regular_rules || []), newRule] });
  };

  const removeRule = (idx) => {
    const newRules = formData.regular_rules.filter((_, i) => i !== idx);
    setFormData({ ...formData, regular_rules: newRules });
  };

  // 3. handleSave を「新規なら insert、編集なら update」に整理
const handleSave = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  try {
    if (editingId) {
      // --- ❶ 編集（既存データの更新） ---
      
      // ① 施設マスター（共通アカウント）情報を更新
      const { error: userError } = await supabase
        .from('facility_users')
        .update({
          facility_name: formData.name,
          login_id: formData.login_id || formData.name, // ログインID（無ければ名前を代用）
          password: formData.pw,
          email: formData.email,
          address: formData.address,
          tel: formData.tel
        })
        .eq('id', editingId);

      if (userError) throw userError;

      // ② 店舗との提携ルール（定期キープなど）を更新
      const { error: connError } = await supabase
        .from('shop_facility_connections')
        .update({ 
          regular_rules: formData.regular_rules 
        })
        .eq('facility_user_id', editingId)
        .eq('shop_id', shopId);

      if (connError) throw connError;

    } else {
      // --- ❷ 新規登録（アカウント作成 ＋ 提携） ---
      
      // ① まず施設アカウントを新規作成（facility_usersテーブル）
      const { data: newUser, error: userError } = await supabase
        .from('facility_users')
        .insert([{
          facility_name: formData.name,
          login_id: formData.login_id || formData.email, 
          password: formData.pw,
          email: formData.email,
          address: formData.address,
          tel: formData.tel
        }])
        .select()
        .single();

      if (userError) throw userError;

      // ② 次に、作成されたアカウントと「SnipSnap（店舗）」を提携させる
      const { error: connError } = await supabase
        .from('shop_facility_connections')
        .insert([{
          shop_id: shopId,
          facility_user_id: newUser.id,
          regular_rules: formData.regular_rules
        }]);

      if (connError) throw connError;
    }

    setIsModalOpen(false);
    fetchFacilities(); // 最新の提携リストを再取得
    resetForm();
    alert('施設情報の保存と提携が完了しました！');

  } catch (error) {
    console.error("保存エラー:", error);
    alert('保存に失敗しました: ' + error.message);
  } finally {
    setLoading(false);
  }
};

  // 🆕 1. 施設からの提携申請を「承認」する
  const handleApprove = async (connectionId) => {
    const { error } = await supabase.from('shop_facility_connections').update({ status: 'active' }).eq('id', connectionId);

    if (!error) {
      // 🆕 祝福メール送信
      try {
        const f = facilities.find(item => item.connection_id === connectionId);
        // 店舗自身の情報を取得（profilesテーブルから直接取るか、Stateにあればそれを使う）
        const { data: myShop } = await supabase.from('profiles').select('business_name, email_contact, email').eq('id', shopId).single();

        if (f && myShop) {
          await fetch("https://vcfndmyxypgoreuykwij.supabase.co/functions/v1/resend", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            body: JSON.stringify({
              type: 'partnership_approved',
              shopName: myShop.business_name,
              facilityName: f.facility_name,
              shopEmail: myShop.email_contact || myShop.email,
              facilityEmail: f.email,
              shopId: shopId,
              facilityId: f.id
            })
          });
        }
      } catch (mailErr) {
        console.error("祝福メール送信エラー:", mailErr);
      }

      alert('提携を承認しました！お互いに祝福メールを送信しました🎉');
      fetchFacilities();
    } else {
      alert('承認エラー: ' + error.message);
    }
  };

  // 🆕 2. 施設からの提携申請を「拒否（削除）」する
  const handleReject = async (connectionId) => {
    if (!window.confirm('この申請を拒否して削除しますか？')) return;
    
    const { error } = await supabase
      .from('shop_facility_connections')
      .delete()
      .eq('id', connectionId);

    if (!error) {
      alert('リクエストを削除しました。');
      fetchFacilities();
    }
  };

  // 🆕 【ここを追加！】店舗の通知設定（メールON/OFF）を更新する関数
  const updateShopSetting = async (value) => {
    setIsUpdating(true);
    const { error } = await supabase
      .from('profiles')
      .update({ email_notifications_enabled: value })
      .eq('id', shopId);

    if (!error) {
      setShopSettings({ ...shopSettings, email_notifications_enabled: value });
    } else {
      alert('設定の更新に失敗しました');
    }
    setIsUpdating(false);
  };

  // 🆕 ここから差し込む！！ ==========================================
  // 振込先情報を一括で更新（保存）する関数
  const saveShopGlobalSettings = async () => { // 🚀 名前を広義に変更
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_facility_searchable: shopSettings.is_facility_searchable, // 🚀 追加
          sub_business_type: shopSettings.sub_business_type,          // 🚀 追加
          bank_name: shopSettings.bank_name,
          bank_branch: shopSettings.bank_branch,
          bank_account_type: shopSettings.bank_account_type,
          bank_account_number: shopSettings.bank_account_number,
          bank_account_holder: shopSettings.bank_account_holder
        })
        .eq('id', shopId);

      if (error) throw error;
      alert('ショップ設定を更新しました！✨');
    } catch (err) {
      alert('失敗: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };
  // 🏢 ここまで ======================================================

  const handleDelete = async (f) => {
    const confirmName = window.prompt(`施設「${f.facility_name}」との提携を解消しますか？\n実行する場合は、確認のため施設名を正確に入力してください：`);
    
    if (confirmName === f.facility_name) {
      const { error } = await supabase
        .from('shop_facility_connections')
        .delete()
        .eq('facility_user_id', f.id)
        .eq('shop_id', shopId);

      if (!error) {
        alert('提携を解消しました。');
        fetchFacilities();
      }
    } else if (confirmName !== null) {
      alert('施設名が一致しません。処理を中断しました。');
    }
  };

  // 🆕 3. 表示用にリストを「承認待ち」と「提携済み」に分ける
  const pendingFacilities = facilities.filter(f => f.status === 'pending');
  const activeFacilities = facilities.filter(f => f.status === 'active');

  const openEdit = (f) => {
    setEditingId(f.id);
    // 🆕 店舗が触る必要のないIDやPWなどはStateに入れない
    setFormData({ 
      facility_name: f.facility_name || '', 
      regular_rules: f.regular_rules || [], 
      tenant_id: shopId 
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ facility_name: '', regular_rules: [], tenant_id: shopId });
    setSelMonthType(0);
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to={`/admin/${shopId}/dashboard`} style={backBtnStyle}><ArrowLeft size={20} /></Link>
          <div>
            <h1 style={titleStyle}>全施設名簿マスター</h1>
            <p style={subtitleStyle}>提携施設の管理・定期ルール設定</p>
          </div>
        </div>
        {/* 🆕 自力で作るのではなく、プラットフォームから探しに行くボタンに変更 */}
        <button 
          onClick={() => navigate(`/admin/${shopId}/facility-search`)} 
          style={{...addBtnStyle, background: '#4f46e5', gap: '8px'}}
        >
          <Search size={18} /> 新しい提携先を探す
        </button>
      </header>

      {/* 🆕 店舗側の通知設定パネルを追加 */}
      {/* 🆕 振込先設定パネルを追加 */}
      {!loading && (
        <div style={{ ...cardStyle, marginBottom: '30px', padding: '25px', background: '#fff', border: '2px solid #e0e7ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' }}>
            <div style={iconBoxStyle('#4f46e5')}><Store size={20} /></div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>基本設定（検索公開・振込先）</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
            
            {/* 🆕 左側：公開設定エリア */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
               <div style={settingRow}>
                  <div>
                    <div style={{fontWeight:'bold', fontSize:'0.9rem'}}>施設検索への公開</div>
                    <div style={{fontSize:'0.7rem', color:'#64748b'}}>施設側で検索・リクエストが可能になります</div>
                  </div>
                  {/* スイッチボタン */}
                  <button 
                    onClick={() => setShopSettings({...shopSettings, is_facility_searchable: !shopSettings.is_facility_searchable})}
                    style={toggleBtnStyle(shopSettings.is_facility_searchable)}
                  >
                    {shopSettings.is_facility_searchable ? '公開中' : '非公開'}
                  </button>
               </div>

               <label style={labelStyle}>施設向け専門ジャンル
                  <select 
                    value={shopSettings.sub_business_type} 
                    onChange={(e) => setShopSettings({...shopSettings, sub_business_type: e.target.value})}
                    style={inputStyle}
                  >
                    {visitingSubCategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
               </label>
            </div>

            {/* 右側：振込先エリア */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={labelStyle}>銀行名<input type="text" value={shopSettings.bank_name || ''} onChange={(e) => setShopSettings({...shopSettings, bank_name: e.target.value})} style={inputStyle} /></label>
              <label style={labelStyle}>支店名<input type="text" value={shopSettings.bank_branch || ''} onChange={(e) => setShopSettings({...shopSettings, bank_branch: e.target.value})} style={inputStyle} /></label>
              <label style={labelStyle}>口座番号<input type="text" value={shopSettings.bank_account_number || ''} onChange={(e) => setShopSettings({...shopSettings, bank_account_number: e.target.value})} style={inputStyle} /></label>
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>名義(カナ)<input type="text" value={shopSettings.bank_account_holder || ''} onChange={(e) => setShopSettings({...shopSettings, bank_account_holder: e.target.value})} style={inputStyle} /></label>
            </div>
          </div>
          
          <button 
  onClick={saveShopGlobalSettings} // ✅ この名前に修正！
  disabled={isUpdating}
            style={{ ...addBtnStyle, width: '100%', marginTop: '20px', background: '#1e293b', justifyContent: 'center' }}
          >
            {isUpdating ? '保存中...' : '基本設定をすべて保存する'}
          </button>
        </div>
      )}

      {loading ? <p style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>読込中...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          {/* --- A: 届いている提携申請（pending）セクション --- */}
          {pendingFacilities.length > 0 && (
            <section>
              <h3 style={sectionTitleStyle}>
                <AlertCircle size={18} color="#f97316" /> 届いている提携申請（承認が必要です）
              </h3>
              <div style={gridStyle}>
                {pendingFacilities.map((f) => (
                  <motion.div 
                    key={f.id} 
                    animate={{ boxShadow: ["0px 0px 0px rgba(249,115,22,0)", "0px 0px 15px rgba(249,115,22,0.4)", "0px 0px 0px rgba(249,115,22,0)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ ...cardStyle, border: '2px solid #fdba74', background: '#fffaf5' }}
                  >
                    <div style={cardHeaderStyle}>
                      <div style={{ flex: 1 }}>
                        <h2 style={facilityNameStyle}>{f.facility_name}</h2>
                        <div style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: 'bold', marginTop: '4px' }}>施設側からアタックが届いています</div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleApprove(f.connection_id)} style={{ ...addBtnStyle, background: '#10b981', padding: '8px 16px', fontSize: '0.85rem' }}>承認する</button>
                        {/* 🆕 ゴミ箱から「拒否」ボタンに変更 */}
                        <button onClick={() => handleReject(f.connection_id)} style={{ ...iconBtnStyle, color: '#ef4444', fontSize: '0.8rem', padding: '8px 12px', fontWeight: 'bold' }}>拒否</button>
                      </div>
                    </div>

                    <div style={{ ...infoGridStyle, marginTop: '15px' }}>
                    {f.email && (
                      <a href={`mailto:${f.email}`} style={{ ...infoItemStyle, color: '#4f46e5', textDecoration: 'none' }}>
                        <Mail size={14} /> {f.email}
                      </a>
                    )}
                    {f.tel && (
                      <a href={`tel:${f.tel}`} style={{ ...infoItemStyle, color: '#4f46e5', textDecoration: 'none', fontWeight: 'bold' }}>
                        <Phone size={14} /> {f.tel}
                      </a>
                    )}
                    <div style={infoItemStyle}><User size={14} /> 担当：{f.contact_name || "未登録"}</div>
                    
                    {f.address && (
                      <div style={{ ...infoItemStyle, gridColumn: '1 / -1' }}>
                        <MapPin size={14} /> 
                        <span style={{flex: 1}}>{f.address}</span>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 'bold', textDecoration: 'none' }}
                        >
                          マップを表示
                        </a>
                      </div>
                    )}

                    {f.official_url && (
                      <div style={{ ...infoItemStyle, gridColumn: '1 / -1' }}>
                        <Link2 size={14} /> 
                        <a href={f.official_url} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', textDecoration: 'none' }}>公式サイトを開く</a>
                      </div>
                    )}
                  </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* --- B: 提携済み施設名簿（active）セクション --- */}
          <section>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b', marginBottom: '15px' }}>提携済み施設一覧</h3>
            <div style={gridStyle}>
              {activeFacilities.map((f) => (
                <motion.div key={f.id} whileHover={{ scale: 1.01 }} style={cardStyle}>
                  <div style={cardHeaderStyle}>
                    <div style={{ flex: 1 }}>
                      <h2 style={facilityNameStyle}>{f.facility_name}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => openEdit(f)} style={iconBtnStyle}><Edit3 size={18} /></button>
                      <button onClick={() => handleDelete(f)} style={{...iconBtnStyle, color: '#ef4444'}}><Trash2 size={18} /></button>
                    </div>
                  </div>

                  <div style={ruleSectionStyle}>
                    <div style={sectionLabelStyle}><Clock size={14} /> 定期キープ：</div>
                    <div style={ruleBadgeContainer}>
                      {f.regular_rules?.map((r, i) => (
                        <span key={i} style={ruleBadgeStyle}>
                          {r.monthType === 1 ? '奇数月 ' : r.monthType === 2 ? '偶数月 ' : ''}
                          {WEEKS.find(w => w.value === r.week)?.label}{DAYS.find(d=>d.value===r.day)?.label}曜
                        </span>
                      ))}
                      {(!f.regular_rules || f.regular_rules.length === 0) && <span style={{fontSize:'12px', color:'#cbd5e1'}}>設定なし</span>}
                    </div>
                  </div>
                  
                  {/* 🆕 修正：image_4107ca.png と同じリッチレイアウトの詳細エリア */}
                  <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', border: '1px solid #eef2ff' }}>
                    
                    {/* 担当者名 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#475569' }}>
                      <User size={16} color="#4f46e5" /> 
                      <span>担当：<strong>{f.contact_name || '未登録'}</strong></span>
                    </div>

                    {/* 住所 ＆ Googleマップ連携 */}
                    {f.address && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: '#475569' }}>
                        <MapPin size={16} color="#4f46e5" style={{ marginTop: '2px' }} /> 
                        <div style={{ flex: 1 }}>
                          <div style={{ lineHeight: '1.4' }}>{f.address}</div>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}`} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 'bold', textDecoration: 'none', marginTop: '6px', display: 'inline-block', background: '#fff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          >
                            マップで場所を表示
                          </a>
                        </div>
                      </div>
                    )}

                    {/* 電話番号（即発信） */}
                    {f.tel && (
                      <a href={`tel:${f.tel}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 'bold' }}>
                        <Phone size={16} /> {f.tel} 
                        <span style={{ fontSize: '0.65rem', fontWeight: 'normal', opacity: 0.7 }}>(タップで電話)</span>
                      </a>
                    )}

                    {/* メール（提携後は連絡用として表示） */}
                    {f.email && (
                      <a href={`mailto:${f.email}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#4f46e5', textDecoration: 'none' }}>
                        <Mail size={16} /> {f.email}
                      </a>
                    )}

                    {/* 公式サイト */}
                    {f.official_url && (
                      <a href={f.official_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#4f46e5', textDecoration: 'none', borderTop: '1px solid #eef2ff', paddingTop: '10px', marginTop: '4px' }}>
                        <Link2 size={16} /> 施設公式サイトを開く
                      </a>
                    )}
                  </div>

                  <Link to={`/admin/${shopId}/facilities/${f.id}/residents`} style={linkBtnStyle}>
                    入居者名簿を確認 <ChevronRight size={18} />
                  </Link>
                </motion.div>
              ))}
            </div>
            {activeFacilities.length === 0 && (
              <div style={{ ...emptyCardStyle, padding: '60px' }}>提携済みの施設はありません</div>
            )}
          </section>

        </div>
      )}

      {/* 登録・編集モーダル */}
      <AnimatePresence>
        {isModalOpen && (
          <div style={modalOverlayStyle} onClick={() => setIsModalOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              style={modalContentStyle} 
              onClick={(e) => e.stopPropagation()}
            >
              <div style={modalHeaderStyle}>
                <h3 style={{margin:0, color:'#1e3a8a'}}>{editingId ? "定期訪問日の編集" : "新規施設登録"}</h3>
                <button onClick={() => setIsModalOpen(false)} style={{border:'none', background:'none'}}><X /></button>
              </div>

              <form onSubmit={handleSave} style={formContainerStyle}>
                <div style={scrollAreaStyle}>
                  <div style={formGridStyle}>

                    {/* 定期ルール設定（既存ロジックを維持） */}
                    <div style={ruleConfigBoxStyle}>
                      <div style={{fontWeight:'bold', fontSize:'13px', color:'#1e3a8a', marginBottom:'12px'}}>📅 定期キープの設定</div>
                      
                      <div style={tinyLabelStyle}>月の条件</div>
                      <div style={tileGridStyle}>
                        {MONTH_TYPES.map(m => (
                          <button key={m.value} type="button" onClick={() => setSelMonthType(m.value)} 
                            style={{...tileBtnStyle, backgroundColor: selMonthType === m.value ? '#4f46e5' : '#fff', color: selMonthType === m.value ? '#fff' : '#444'}}>
                            {m.label}
                          </button>
                        ))}
                      </div>

                      <div style={{...tinyLabelStyle, marginTop:'10px'}}>曜日</div>
                      <div style={tileGridStyle}>
                        {DAYS.map(d => (
                          <button key={d.value} type="button" onClick={() => setSelDay(d.value)} 
                            style={{...tileBtnStyle, backgroundColor: selDay === d.value ? '#4f46e5' : '#fff', color: selDay === d.value ? '#fff' : '#444'}}>
                            {d.label}
                          </button>
                        ))}
                      </div>

                      <div style={{...tinyLabelStyle, marginTop:'10px'}}>週</div>
                      <div style={tileGridStyle}>
                        {WEEKS.map(w => (
                          <button key={w.value} type="button" onClick={() => setSelWeek(w.value)} 
                            style={{...tileBtnStyle, backgroundColor: selWeek === w.value ? '#4f46e5' : '#fff', color: selWeek === w.value ? '#fff' : '#444'}}>
                            {w.label}
                          </button>
                        ))}
                      </div>
                      <div style={{...tinyLabelStyle, marginTop:'10px'}}>開始時間</div>
  <input 
    type="time" 
    value={selTime} 
    onChange={(e) => setSelTime(e.target.value)}
    style={{
      width: '100%', padding: '12px', borderRadius: '10px', 
      border: '1px solid #e2e8f0', marginTop: '5px', fontSize: '1rem', fontWeight: 'bold'
    }}
  />
  <button type="button" onClick={addRule} style={ruleAddBtnStyle}>ルールを追加 ➔</button>
                      
                      <div style={ruleListAreaStyle}>
                        {formData.regular_rules?.map((r, i) => (
                          <div key={i} style={ruleBadgeItemStyle}>
                            <span>
                              {r.monthType === 1 ? '奇数 ' : r.monthType === 2 ? '偶数 ' : ''}
                              {WEEKS.find(w=>w.value===r.week)?.label}{DAYS.find(d=>d.value===r.day)?.label}曜
                            </span>
                            <button type="button" onClick={() => removeRule(i)} style={{border:'none', background:'none', color:'#ef4444', cursor:'pointer'}}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={modalFooterStyle}>
                  <button type="button" onClick={() => setIsModalOpen(false)} style={cancelBtnStyle}>キャンセル</button>
                  <button type="submit" style={saveBtnStyle}>{loading ? '保存中...' : '設定を保存'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// スタイル定義（QUEST HUBのデザインに最適化）
const containerStyle = { maxWidth: '1000px', margin: '0 auto', padding: '30px 20px', minHeight: '100vh', background: '#f8fafc' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const titleStyle = { margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' };
const subtitleStyle = { margin: '5px 0 0', fontSize: '0.85rem', color: '#64748b' };
const backBtnStyle = { padding: '10px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' };
const addBtnStyle = { background: '#4f46e5', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100%, 1fr))', gap: '20px' };
const cardStyle = { background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const cardHeaderStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' };
const facilityNameStyle = { margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' };
const idBadgeStyle = { background: '#f1f5f9', color: '#64748b', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' };
const pwBadgeStyle = { background: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' };
const iconBtnStyle = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#64748b' };
const ruleSectionStyle = { background: '#f8fafc', padding: '12px', borderRadius: '16px', marginBottom: '15px' };
const sectionLabelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' };
const ruleBadgeContainer = { display: 'flex', flexWrap: 'wrap', gap: '6px' };
const ruleBadgeStyle = { background: '#4f46e515', color: '#4f46e5', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' };
const infoGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' };
const infoItemStyle = { fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' };
const linkBtnStyle = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#1e293b', color: '#fff', padding: '12px', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' };

const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const modalContentStyle = { background: '#fff', width: '100%', maxWidth: '450px', maxHeight: '90vh', borderRadius: '28px', padding: '30px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const scrollAreaStyle = { flex: 1, overflowY: 'auto', paddingRight: '10px' };
const formGridStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const labelStyle = { fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', display: 'flex', flexDirection: 'column', gap: '5px' };
const inputStyle = { padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' };
const ruleConfigBoxStyle = { background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' };
const tinyLabelStyle = { fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' };
const tileGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '5px' };
const tileBtnStyle = { padding: '8px 2px', fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' };
const ruleAddBtnStyle = { width: '100%', marginTop: '15px', padding: '12px', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const ruleListAreaStyle = { marginTop: '15px', display: 'flex', flexWrap: 'wrap', gap: '8px' };
const ruleBadgeItemStyle = { background: '#fff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' };
const modalFooterStyle = { display: 'flex', gap: '10px', marginTop: '25px' };
const cancelBtnStyle = { flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 'bold', color: '#64748b', cursor: 'pointer' };
const saveBtnStyle = { flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: '#1e293b', color: '#fff', fontWeight: 'bold', cursor: 'pointer' };
const formContainerStyle = { display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const inviteBoxStyle = { marginTop: '15px', padding: '12px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '15px' };
const inviteLabelStyle = { fontSize: '0.7rem', fontWeight: 'bold', color: '#0369a1', marginBottom: '5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' };
const inviteInputGroupStyle = { display: 'flex', gap: '8px' };
const inviteInputStyle = { flex: 1, fontSize: '0.7rem', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', color: '#64748b', outline: 'none' };
const copyBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', background: '#0369a1', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' };
// 🆕 追加：リストが空の時のスタイル
const emptyCardStyle = { 
  gridColumn: '1/-1', 
  textAlign: 'center', 
  padding: '60px', 
  background: '#fff', 
  borderRadius: '24px', 
  color: '#cbd5e1', 
  fontSize: '0.9rem', 
  border: '2px dashed #f1f5f9' 
};

// 🆕 追加：セクションの見出しスタイル
const sectionTitleStyle = { 
  fontSize: '0.9rem', 
  fontWeight: 'bold', 
  color: '#64748b', 
  marginBottom: '15px', 
  display: 'flex', 
  alignItems: 'center', 
  gap: '8px' 
};

const iconBoxStyle = (color) => ({ 
  width: '64px', height: '64px', borderRadius: '20px', 
  background: `${color}10`, color: color, 
  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' 
});

const switchStyle = { 
  position: 'relative', 
  display: 'inline-block', 
  width: '46px', 
  height: '24px' 
};

// 🆕 追加：スイッチの中のつまみのスタイル
const sliderStyle = { 
  position: 'absolute', 
  cursor: 'pointer', 
  top: 0, 
  left: 0, 
  right: 0, 
  bottom: 0, 
  transition: '.3s', 
  borderRadius: '24px' 
};
const settingRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '15px', borderRadius: '15px', border: '1px solid #eef2ff' };
const toggleBtnStyle = (active) => ({ padding: '8px 20px', borderRadius: '20px', border: 'none', fontWeight: '900', cursor: 'pointer', background: active ? '#10b981' : '#cbd5e1', color: '#fff', fontSize: '0.8rem', transition: '0.3s' });
export default FacilityManagement;