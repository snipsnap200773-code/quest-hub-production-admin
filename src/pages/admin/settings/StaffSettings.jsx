import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  Users, Plus, Trash2, ArrowLeft, Save, 
  Calendar, Copy, QrCode, Check 
} from 'lucide-react';

const StaffSettings = () => {
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

  const [staffs, setStaffs] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(null); 
  const [copiedId, setCopiedId] = useState(null); 
  const [showQrId, setShowQrId] = useState(null); 

  const DAYS = ['日', '月', '火', '水', '木', '金', '土'];

  useEffect(() => {
    fetchStaffs();
  }, [shopId]);

  const fetchStaffs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('staffs')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true });
    
    if (data) {
      const initialized = data.map(s => ({
        ...s,
        weekly_holidays: s.weekly_holidays || []
      }));
      setStaffs(initialized);
    }
    setLoading(false);
  };

  const copyUrl = (staffId) => {
    const url = `${window.location.origin}/shop/${shopId}/reserve?staff=${staffId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(staffId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addStaff = async () => {
    if (!newStaffName) return;
    const isFirstStaff = staffs.length === 0;
    const staffId = isFirstStaff ? shopId : crypto.randomUUID();

    const { error } = await supabase.from('staffs').insert([{
      id: staffId,
      shop_id: shopId,
      name: newStaffName,
      role: isFirstStaff ? 'owner' : 'staff',
      weekly_holidays: []
    }]);

    if (!error) {
      setNewStaffName('');
      fetchStaffs();
    }
  };

  // 🆕 スタッフ削除を実行する関数 (追加分)
  const deleteStaff = async (id) => {
    const targetStaff = staffs.find(s => s.id === id);
    if (!window.confirm(`${targetStaff?.name} さんを削除しますか？\n（過去の予約データには影響しません）`)) {
      return;
    }
    try {
      const { error } = await supabase.from('staffs').delete().eq('id', id);
      if (error) throw error;
      setStaffs(staffs.filter(s => s.id !== id));
      alert('スタッフを削除しました。');
    } catch (err) {
      alert('削除に失敗しました: ' + err.message);
    }
  };

  const toggleHoliday = (staffId, dayIndex) => {
    setStaffs(prev => prev.map(s => {
      if (s.id !== staffId) return s;
      const current = s.weekly_holidays;
      const updated = current.includes(dayIndex)
        ? current.filter(d => d !== dayIndex)
        : [...current, dayIndex];
      return { ...s, weekly_holidays: updated };
    }));
  };

  const saveStaffSetting = async (staff) => {
    setIsSaving(staff.id);
    const { error } = await supabase
      .from('staffs')
      .update({ 
        name: staff.name,
        weekly_holidays: staff.weekly_holidays,
        concurrent_capacity: staff.concurrent_capacity || 1 
      })
      .eq('id', staff.id);

    if (!error) {
      alert(`${staff.name}さんの設定を保存しました！`);
    } else {
      console.error(error); 
      alert("保存に失敗しました。SQLでカラム追加はお済みですか？");
    }
    setIsSaving(null);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>読み込み中...</div>;

  return (
<div style={{ maxWidth: '700px', margin: isPC ? '40px auto' : '20px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* 🚀 ナビゲーションヘッダー（オシャレ＆レスポンシブ版） */}
      <div style={{ marginBottom: '30px' }}>
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
      </div>
      
      <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: '#f43f5e10', padding: '10px', borderRadius: '12px', color: '#f43f5e' }}>
            <Users size={24} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>スタッフ管理</h2>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <input 
            type="text" 
            placeholder="新しいスタッフ名" 
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value)}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }}
          />
          <button onClick={addStaff} style={{ background: '#f43f5e', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            <Plus size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {staffs.map(staff => {
            const bookingUrl = `${window.location.origin}/shop/${shopId}/reserve?staff=${staff.id}`;
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingUrl)}`;

            return (
              <div key={staff.id} style={{ padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      style={{ fontWeight: 'bold', color: '#1e293b', border: 'none', background: 'transparent', fontSize: '1.1rem', width: '150px' }}
                      value={staff.name}
                      onChange={(e) => setStaffs(prev => prev.map(s => s.id === staff.id ? { ...s, name: e.target.value } : s))}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#e2e8f0', padding: '2px 8px', borderRadius: '99px' }}>
                      {staff.role === 'owner' ? 'オーナー' : 'スタッフ'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => saveStaffSetting(staff)} 
                      disabled={isSaving === staff.id}
                      style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                    >
                      <Save size={16} /> {isSaving === staff.id ? '保存中...' : '保存'}
                    </button>
                    <button onClick={() => deleteStaff(staff.id)} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <button 
                    onClick={() => copyUrl(staff.id)} 
                    style={{ 
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', 
                      background: copiedId === staff.id ? '#10b981' : '#fff', 
                      color: copiedId === staff.id ? '#fff' : '#1e293b', 
                      border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' 
                    }}
                  >
                    {copiedId === staff.id ? <Check size={16} /> : <Copy size={16} />} 
                    {copiedId === staff.id ? 'コピー完了！' : '予約URLをコピー'}
                  </button>
                  <button 
                    onClick={() => setShowQrId(showQrId === staff.id ? null : staff.id)} 
                    style={{ 
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', 
                      background: showQrId === staff.id ? '#1e293b' : '#fff', 
                      color: showQrId === staff.id ? '#fff' : '#1e293b', 
                      border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer' 
                    }}
                  >
                    <QrCode size={16} /> QRコードを表示
                  </button>
                </div>

                {showQrId === staff.id && (
                  <div style={{ textAlign: 'center', background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '10px' }}>{staff.name}さん専用の予約QRコード</p>
                    <img 
                      src={qrImageUrl} 
                      alt="QR Code" 
                      style={{ width: '150px', height: '150px', marginBottom: '10px', border: '1px solid #f1f5f9' }} 
                    />
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', wordBreak: 'break-all', maxWidth: '300px', margin: '0 auto' }}>
                      {bookingUrl}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '25px', padding: '15px', background: '#fff', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={14} /> 同時並行 予約受け入れ上限（人）
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="number" 
                      value={staff.concurrent_capacity || 1} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setStaffs(prev => prev.map(s => s.id === staff.id ? { ...s, concurrent_capacity: val } : s));
                      }}
                      min="1"
                      style={{ 
                        width: '70px', padding: '10px', borderRadius: '10px', 
                        border: '1px solid #e2e8f0', outline: 'none', fontWeight: 'bold', 
                        textAlign: 'center', color: '#1e293b' 
                      }}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4' }}>
                      ※このスタッフが同じ時間に<br />最大何人まで掛け持ちできるか
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} /> 定休日（毎週）
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {DAYS.map((day, idx) => {
                      const isHoliday = staff.weekly_holidays?.includes(idx);
                      return (
                        <button
                          key={day}
                          onClick={() => toggleHoliday(staff.id, idx)}
                          style={{
                            width: '40px', height: '40px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer',
                            background: isHoliday ? '#f43f5e' : '#fff',
                            color: isHoliday ? '#fff' : '#64748b',
                            transition: 'all 0.2s',
                            border: isHoliday ? 'none' : '1px solid #e2e8f0'
                          }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StaffSettings;