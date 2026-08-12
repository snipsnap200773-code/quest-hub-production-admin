import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { 
  Users, Plus, Trash2, ArrowLeft, Save, 
  Calendar, Copy, QrCode, Check, Scissors 
} from 'lucide-react';

const StaffSettings = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();

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

  // 🚀 🆕 変更検知用のStateと、比較用データの整形関数を追加
  const [initialDataStr, setInitialDataStr] = useState(null);
  const getSimplifiedStaffsStr = (list) => {
    return JSON.stringify(list.map(s => ({
      id: s.id,
      name: s.name,
      role_type: s.role_type || 'stylist',
      concurrent_capacity: s.concurrent_capacity || 1,
      weekly_holidays: s.weekly_holidays || [],
      is_default_for_admin: !!s.is_default_for_admin // true/falseを厳密にするため
    })));
  };

  const DAYS = ['日', '月', '火', '水', '木', '金', '土'];

  useEffect(() => {
    fetchStaffs();
  }, [shopId]);

  const [shopData, setShopData] = useState(null);

  useEffect(() => {
    fetchStaffs();
    fetchShopData(); // 👈 🆕 追加
  }, [shopId]);

  // 👇 🆕 追加：テーマカラーの取得
  const fetchShopData = async () => {
    const { data } = await supabase.from('profiles').select('theme_color').eq('id', shopId).single();
    if (data) setShopData(data);
  };

  const themeColor = shopData?.theme_color || '#2563eb';

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
        weekly_holidays: s.weekly_holidays || [],
        role_type: s.role_type || 'stylist', // 🚀 🆕 技術者/アシスタントの初期値
        concurrent_capacity: s.concurrent_capacity || 1, // 👈 比較用に明示
        is_default_for_admin: !!s.is_default_for_admin   // 👈 比較用に明示
      }));
      setStaffs(initialized);
      setInitialDataStr(getSimplifiedStaffsStr(initialized)); // 🚀 🆕 取得したデータを「初期値」として記憶
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
      role_type: 'stylist', // 🚀 🆕 新規作成時はデフォルトで技術者
      weekly_holidays: []
    }]);

    if (!error) {
      setNewStaffName('');
      fetchStaffs();
    }
  };

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

  // 👇 修正：個別の保存を廃止し、一括で upsert（更新・追加）する関数に変更
  const handleSaveAll = async () => {
    setIsSaving('all');
    try {
      const updates = staffs.map(staff => ({
        id: staff.id,
        shop_id: shopId,
        name: staff.name,
        role: staff.role,
        weekly_holidays: staff.weekly_holidays,
        concurrent_capacity: staff.concurrent_capacity || 1,
        role_type: staff.role_type,
        is_default_for_admin: staff.is_default_for_admin
      }));

      const { error } = await supabase.from('staffs').upsert(updates);
      if (error) throw error;
      
      alert('すべてのスタッフ設定を保存しました！');
      fetchStaffs(); // 状態を再同期
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(null);
    }
  };

  // 🚀 🆕 現在の入力状態を文字列化して、初期データと比較
  const currentDataStr = getSimplifiedStaffsStr(staffs);
  const hasChanges = initialDataStr !== null && initialDataStr !== currentDataStr;

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>読み込み中...</div>;

  return (
    // 👇 修正：ボタンと被らないように paddingBottom: '120px' を追加
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px', paddingBottom: '120px', fontFamily: 'sans-serif' }}>
      
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
            // 🚀 🆕 このスタッフが技術者かどうかを判定
            const isStylist = staff.role_type === 'stylist';

            return (
              <div key={staff.id} style={{ padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  
                  {/* 左側：名前とバッジ */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <input 
                        style={{ fontWeight: 'bold', color: '#1e293b', border: '1px dashed transparent', background: 'transparent', fontSize: '1.1rem', width: '100%', maxWidth: '200px', padding: '4px', outline: 'none' }}
                        value={staff.name}
                        onChange={(e) => setStaffs(prev => prev.map(s => s.id === staff.id ? { ...s, name: e.target.value } : s))}
                        onFocus={(e) => e.target.style.border = '1px dashed #cbd5e1'}
                        onBlur={(e) => e.target.style.border = '1px dashed transparent'}
                      />
                    </div>

                    {/* 👇 修正：flexWrap: 'wrap' と gap: '8px' を設定し、アイテムが自動で折りたたまれるように変更 */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#e2e8f0', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {staff.role === 'owner' ? 'オーナー' : 'スタッフ'}
                      </span>

                      {/* 🚀 🆕 追加：デフォルト設定ボタン */}
                      <button
                        onClick={() => setStaffs(prev => prev.map(s => ({
                          ...s,
                          is_default_for_admin: s.id === staff.id ? !s.is_default_for_admin : false
                        })))}
                        style={{
                          fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap',
                          background: staff.is_default_for_admin ? '#f59e0b' : '#fff',
                          color: staff.is_default_for_admin ? '#fff' : '#64748b'
                        }}
                      >
                        {staff.is_default_for_admin ? '⭐ デフォルト予約先' : '☆ デフォルトに設定'}
                      </button>

                      <select 
                        value={staff.role_type}
                        onChange={(e) => setStaffs(prev => prev.map(s => s.id === staff.id ? { ...s, role_type: e.target.value } : s))}
                        style={{ 
                          fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap',
                          background: isStylist ? '#f43f5e15' : '#f1f5f9',
                          color: isStylist ? '#f43f5e' : '#64748b'
                        }}
                      >
                        <option value="stylist">✂️ 技術者（指名可能）</option>
                        <option value="assistant">🧹 アシスタント（指名不可）</option>
                      </select>
                    </div>
                  </div>

                  {/* 右側：アクションボタン */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* 👇 修正：個別の保存ボタンを削除しました */}
                    <button onClick={() => deleteStaff(staff.id)} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {/* 🚀 🆕 技術者（stylist）の場合だけURL発行エリアを表示する */}
                {isStylist ? (
                  <>
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
                        {copiedId === staff.id ? 'コピー完了！' : '専用予約URLをコピー'}
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
                  </>
                ) : (
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '10px', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', border: '1px dashed #cbd5e1', marginBottom: '20px' }}>
                    このスタッフは「アシスタント」のため、専用の指名予約URLは発行されません。
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
              onClick={handleSaveAll} 
              disabled={!hasChanges || isSaving === 'all'} // 👈 変更がない時は押せない
              style={{ 
                flex: 1, padding: '15px', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s',
                // 👈 変更があればテーマカラー＋点滅、なければグレー
                background: hasChanges ? themeColor : '#cbd5e1', 
                color: '#fff', 
                cursor: (hasChanges && isSaving !== 'all') ? 'pointer' : 'not-allowed', 
                animation: (hasChanges && isSaving !== 'all') ? 'pulse-btn 2s infinite' : 'none' 
              }}
            >
              <Save size={20} /> {isSaving === 'all' ? '保存中...' : (hasChanges ? '未保存の変更があります' : '変更はありません')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <button onClick={() => navigate(`/admin/${shopId}/dashboard`)} style={{ flex: 1, padding: '10px 0', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>戻る</span>
            </button>
            <button 
              onClick={handleSaveAll} 
              disabled={!hasChanges || isSaving === 'all'} // 👈 変更がない時は押せない
              style={{ 
                flex: 1.8, padding: '10px 0', border: 'none', borderRadius: '12px', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: '0.3s',
                // 👈 変更があればテーマカラー＋点滅、なければグレー
                background: hasChanges ? themeColor : '#cbd5e1', 
                color: '#fff', 
                cursor: (hasChanges && isSaving !== 'all') ? 'pointer' : 'not-allowed', 
                animation: (hasChanges && isSaving !== 'all') ? 'pulse-btn 2s infinite' : 'none' 
              }}
            >
              <Save size={20} />
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{isSaving === 'all' ? '保存中...' : (hasChanges ? '保存する' : '変更なし')}</span>
            </button>
            {/* 👇 プレビューボタンと同じ大きさの透明な「空きスペース」 */}
            <div style={{ flex: 1 }}></div>
          </div>
        )}
      </div>

    </div>
  );
};

export default StaffSettings;