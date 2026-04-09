import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Mail, ShieldAlert, Building2, Save, User, MapPin, Phone, ExternalLink, Send } from 'lucide-react';
// 🚀 🆕 司令塔（マスタ）からカテゴリ情報を読み込む
import { INDUSTRY_PRESETS } from '../../../constants/industryMaster';

const FacilitySettings_PC = ({ facilityId, isMobile }) => {
  const [facility, setFacility] = useState(null);
  const [connectedShops, setConnectedShops] = useState([]); // 🆕 提携状況用State
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [facilityId]);

  const fetchData = async () => {
    setLoading(true);
    // 1. 施設情報の取得
    const { data: fData } = await supabase.from('facility_users').select('*').eq('id', facilityId).single();
    if (fData) setFacility(fData);

    // 🆕 2. 提携・申請中店舗の取得（リクエストパネル用）
    const { data: shopData } = await supabase
      .from('shop_facility_connections')
      .select(`*, profiles (*)`)
      .eq('facility_user_id', facilityId)
      .in('status', ['active', 'pending']);
    setConnectedShops(shopData || []);

    setLoading(false);
  };

  const updateStatus = async (column, value) => {
    const { error } = await supabase.from('facility_users').update({ [column]: value }).eq('id', facilityId);
    if (!error) setFacility(prev => ({ ...prev, [column]: value }));
  };

  // 🚀 🆕 許可カテゴリ配列（allowed_categories）を出し入れする関数
  const toggleCategory = async (catName, isChecked) => {
    let currentList = facility?.allowed_categories || [];
    let newList;
    
    if (isChecked) {
      newList = [...currentList, catName]; // チェックされたら追加
    } else {
      newList = currentList.filter(item => item !== catName); // 外れたら削除
    }

    const { error } = await supabase
      .from('facility_users')
      .update({ allowed_categories: newList })
      .eq('id', facilityId);

    if (!error) {
      setFacility(prev => ({ ...prev, allowed_categories: newList }));
    }
  };

  // 🆕 提携承認・拒否の処理（お祝いメール送信機能付き）
  const handleConnection = async (connectionId, newStatus) => {
    setIsUpdating(true);
    
    if (newStatus === 'rejected') {
      await supabase.from('shop_facility_connections').delete().eq('id', connectionId);
      alert('リクエストを拒否しました。');
    } else {
      // 承認（active）にする
      const { error } = await supabase.from('shop_facility_connections').update({ status: 'active' }).eq('id', connectionId);
      
      if (!error) {
        // --- ここから祝福メール送信（B案） ---
        try {
          const req = connectedShops.find(c => c.id === connectionId);
          if (req) {
            await fetch("https://vcfndmyxypgoreuykwij.supabase.co/functions/v1/resend", {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` 
              },
              body: JSON.stringify({
                type: 'partnership_approved',
                shopName: req.profiles?.business_name,
                facilityName: facility?.facility_name,
                shopEmail: req.profiles?.email_contact || req.profiles?.email,
                facilityEmail: facility?.email,
                shopId: req.shop_id,
                facilityId: facilityId
              })
            });
          }
        } catch (mailErr) {
          console.error("祝福メール送信エラー:", mailErr);
        }
        alert('提携を承認しました！お互いに祝福メールを送信しました🎉');
      }
    }
    fetchData(); // データを再取得して表示を更新
    setIsUpdating(false);
  };

  if (loading) return <div style={{textAlign: 'center', padding: '50px'}}>読み込み中...</div>;

  // 申請中リストの整理
  const pendingRequests = connectedShops.filter(con => con.status === 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* 🆕 1. 届いている提携リクエスト（消えていた部分！） */}
      {pendingRequests.length > 0 && (
        <section style={{ ...panelStyle, border: '2px solid #f59e0b', background: '#fffbeb' }}>
          <h3 style={{ ...panelTitle, color: '#d97706' }}><ShieldAlert size={20} /> 提携リクエストが届いています</h3>
          <p style={{ fontSize: '0.8rem', color: '#b45309', marginBottom: '15px' }}>
            店舗からの申請内容を確認して「承認」すると、名簿の共有が可能になります。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {pendingRequests.map(req => (
              <div key={req.id} style={requestCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#3d2b1f' }}>{req.profiles?.business_name}</h4>
                    <span style={{ fontSize: '0.7rem', color: '#c5a059', fontWeight: 'bold' }}>{req.profiles?.business_type}</span>
                  </div>
                  <div style={{ fontSize: '0.6rem', padding: '4px 8px', borderRadius: '6px', background: '#fef3c7', color: '#d97706', fontWeight: 'bold' }}>
                    相手から申請
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', margin: '15px 0' }}>
                  <div style={infoItem}><User size={14} color="#c5a059" /> 代表：<strong>{req.profiles?.owner_name || '未登録'}</strong></div>
                  <div style={infoItem}><MapPin size={14} color="#c5a059" /> {req.profiles?.address || '住所未登録'}</div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleConnection(req.id, 'active')} style={approveBtnStyle} disabled={isUpdating}>承認する</button>
                  <button onClick={() => handleConnection(req.id, 'rejected')} style={rejectBtnStyle} disabled={isUpdating}>拒否</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. 通知設定・制限設定（PC時は2列） */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
        <section style={panelStyle}>
          <h3 style={panelTitle}><Mail size={20} /> 通知設定</h3>
          <div style={settingRow}>
            <span style={{fontSize: '0.9rem'}}>メールでの新着通知</span>
            <input type="checkbox" style={checkboxStyle} checked={facility?.email_notifications_enabled ?? true} onChange={(e) => updateStatus('email_notifications_enabled', e.target.checked)} />
          </div>
        </section>

        <section style={panelStyle}>
          <h3 style={panelTitle}><ShieldAlert size={20} /> 提携申請の制限</h3>
          {/* 🚀 🆕 マスタの「訪問サービス」のサブカテゴリをすべて表示 */}
          {INDUSTRY_PRESETS.visiting.subCategories.map(cat => {
            // 現在の施設データにそのカテゴリが含まれているか判定
            // ※ カラムがまだ空(null)の場合は、デフォルトで「全許可(true)」として扱います
            const isAllowed = facility?.allowed_categories 
              ? facility.allowed_categories.includes(cat) 
              : true;
            
            return (
              <div key={cat} style={settingRow}>
                <span style={{fontSize: '0.9rem'}}>{cat}</span>
                <input 
                  type="checkbox" 
                  style={checkboxStyle} 
                  checked={isAllowed} 
                  onChange={(e) => toggleCategory(cat, e.target.checked)} 
                />
              </div>
            );
          })}
        </section>
      </div>

      {/* 3. 施設プロフィール（復活済み） */}
      <section style={panelStyle}>
        <h3 style={panelTitle}><Building2 size={20} /> 施設プロフィールの登録・編集</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={inputGroup}>
            <label style={labelStyle}>施設名 <span style={readOnlyLabel}>※変更は運営まで</span></label>
            <input style={{...inputStyle, background: '#f8f9fa', color: '#999'}} value={facility?.facility_name || ''} readOnly />
          </div>
          <div style={inputGroup}><label style={labelStyle}>担当者名</label><input style={inputStyle} value={facility?.contact_name || ''} onChange={e => setFacility({...facility, contact_name: e.target.value})} /></div>
          <div style={inputGroup}><label style={labelStyle}>住所</label><input style={inputStyle} value={facility?.address || ''} onChange={e => setFacility({...facility, address: e.target.value})} /></div>
          <div style={inputGroup}><label style={labelStyle}>電話番号</label><input style={inputStyle} value={facility?.tel || ''} onChange={(e) => setFacility({...facility, tel: e.target.value})} /></div>
          <div style={inputGroup}><label style={labelStyle}>公式サイトURL</label><input style={inputStyle} value={facility?.official_url || ''} onChange={(e) => setFacility({...facility, official_url: e.target.value})} /></div>
          <div style={inputGroup}><label style={labelStyle}>通知用メールアドレス</label><input style={inputStyle} value={facility?.email || ''} onChange={(e) => setFacility({...facility, email: e.target.value})} /></div>
          
          <button style={saveBtnStyle} onClick={async () => {
              await supabase.from('facility_users').update({ contact_name: facility.contact_name, address: facility.address, tel: facility.tel, official_url: facility.official_url, email: facility.email }).eq('id', facilityId);
              alert('設定を保存しました！');
          }}><Save size={18} /> 設定を保存する</button>
        </div>
      </section>
    </div>
  );
};

// スタイル定義
const panelStyle = { background: '#fff', padding: '25px', borderRadius: '18px', border: '1px solid #eee', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };
const panelTitle = { margin: '0 0 15px 0', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', color: '#3d2b1f' };
const settingRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f9f9f9' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '8px' };
const labelStyle = { fontSize: '0.85rem', fontWeight: 'bold', color: '#666', display: 'flex', justifyContent: 'space-between' };
const readOnlyLabel = { fontWeight: 'normal', fontSize: '0.7rem', color: '#ccc' };
const inputStyle = { padding: '14px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none' };
const checkboxStyle = { width: '18px', height: '18px', cursor: 'pointer' };
const saveBtnStyle = { background: '#3d2b1f', color: '#c5a059', border: 'none', padding: '18px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1rem' };
const requestCardStyle = { background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const infoItem = { fontSize: '0.85rem', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' };
const approveBtnStyle = { flex: 2, background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const rejectBtnStyle = { flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };

export default FacilitySettings_PC;