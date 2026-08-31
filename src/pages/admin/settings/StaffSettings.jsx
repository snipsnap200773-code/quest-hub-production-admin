import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../../supabaseClient";
import { useSubscription } from '../../../context/SubscriptionContext';
// 👇 🌟 🆕 追加：業種マスターデータを読み込む
import { INDUSTRY_LABELS } from '../../../constants/industryMaster'; 
import { 
  Users, Plus, Trash2, ArrowLeft, Save, 
  Calendar, Copy, QrCode, Check, Scissors,
  ChevronLeft, ChevronRight, X, Clock 
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

  // 👈 🌟 🆕 契約状態とプランIDを取得
  const { planId } = useSubscription();

  // 👈 🌟 🆕 プランごとの上限設定
  const PLAN_LIMITS = {
    free: { stylist: Infinity, assistant: Infinity }, // 無料版はレジ利用想定で無制限
    solopreneur: { stylist: 1, assistant: 1 },
    party: { stylist: 5, assistant: Infinity },
    guild: { stylist: Infinity, assistant: Infinity },
  };
  // 現在のプランの上限を取得（万が一不明な場合はfree扱い）
  const currentLimit = PLAN_LIMITS[planId] || PLAN_LIMITS.free;

  const [staffs, setStaffs] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('stylist'); // 👈 🌟 🆕 新規追加用の役割State
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(null); 
  const [copiedId, setCopiedId] = useState(null); 
  const [showQrId, setShowQrId] = useState(null); 

  // 🚀 🆕 変更検知用のStateと、比較用データの整形関数を追加
  const [initialDataStr, setInitialDataStr] = useState(null);
  
  const [openCalendarId, setOpenCalendarId] = useState(null); 
  const [staffMonths, setStaffMonths] = useState({}); 

  // 🚀 🆕 追加：シフト編集ポップアップ用のState
  const [editingShift, setEditingShift] = useState(null); 

  const getSimplifiedStaffsStr = (list) => {
    return JSON.stringify(list.map(s => ({
      id: s.id,
      name: s.name,
      role_type: s.role_type || 'stylist',
      concurrent_capacity: s.concurrent_capacity || 1,
      weekly_holidays: s.weekly_holidays || [],
      custom_shifts: s.custom_shifts || {}, // 🚀 🆕 specific_holidays を custom_shifts に変更！
      is_default_for_admin: !!s.is_default_for_admin,
      capable_categories: s.capable_categories || [] // 👈 🌟 🆕 追加
    })));
  };

  const DAYS = ['日', '月', '火', '水', '木', '金', '土'];

  const changeMonth = (staffId, offset) => {
    setStaffMonths(prev => {
      const current = prev[staffId] || new Date();
      return { ...prev, [staffId]: new Date(current.getFullYear(), current.getMonth() + offset, 1) };
    });
  };

  // 🚀 🆕 追加：カレンダーの日付をタップした時、ポップアップを開く関数
  const handleOpenShiftEdit = (staff, dateStr) => {
    const existing = staff.custom_shifts?.[dateStr];
    if (existing) {
      setEditingShift({ staffId: staff.id, dateStr, type: existing.type, start: existing.start || '10:00', end: existing.end || '15:00' });
    } else {
      setEditingShift({ staffId: staff.id, dateStr, type: 'off', start: '10:00', end: '15:00' });
    }
  };

  // 🚀 🆕 追加：ポップアップで「保存」を押した時の関数
  const handleSaveShift = () => {
    if (!editingShift) return;
    setStaffs(prev => prev.map(s => {
      if (s.id !== editingShift.staffId) return s;
      const newShifts = { ...(s.custom_shifts || {}) };
      newShifts[editingShift.dateStr] = {
        type: editingShift.type,
        ...(editingShift.type === 'time' ? { start: editingShift.start, end: editingShift.end } : {})
      };
      return { ...s, custom_shifts: newShifts };
    }));
    setEditingShift(null); // モーダルを閉じる
  };

  // 🚀 🆕 追加：ポップアップで「削除（通常出勤に戻す）」を押した時の関数
  const handleDeleteShift = () => {
    if (!editingShift) return;
    setStaffs(prev => prev.map(s => {
      if (s.id !== editingShift.staffId) return s;
      const newShifts = { ...(s.custom_shifts || {}) };
      delete newShifts[editingShift.dateStr]; // その日の特別設定を削除
      return { ...s, custom_shifts: newShifts };
    }));
    setEditingShift(null); // モーダルを閉じる
  };

  useEffect(() => {
    fetchStaffs();
  }, [shopId]);

  const [shopData, setShopData] = useState(null);
  // ※ categories の useState は削除

  useEffect(() => {
    fetchStaffs();
    fetchShopData(); 
    // ※ fetchCategories() の呼び出しは削除
  }, [shopId]);

  // ※ fetchCategories 関数自体も削除

  // 👇 🌟 修正：テーマカラーと業種（business_type）を取得
  const fetchShopData = async () => {
    const { data } = await supabase.from('profiles').select('theme_color, business_type').eq('id', shopId).single();
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
        custom_shifts: s.custom_shifts || {}, // 🚀 🆕 JSONB用の初期化
        role_type: s.role_type || 'stylist',
        concurrent_capacity: s.concurrent_capacity || 1,
        is_default_for_admin: !!s.is_default_for_admin,
        capable_categories: s.capable_categories || [] // 👈 🌟 🆕 追加
      }));
      setStaffs(initialized);
      setInitialDataStr(getSimplifiedStaffsStr(initialized));
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

    // 👈 🌟 🆕 選ばれた役割（newStaffRole）に応じて上限をチェックする
    if (newStaffRole === 'stylist') {
      const currentStylistCount = staffs.filter(s => s.role_type === 'stylist').length;
      if (currentStylistCount >= currentLimit.stylist) {
        alert(`現在のプランでは、技術者（プレイヤー）の登録は最大 ${currentLimit.stylist} 名までです。\nこれ以上追加する場合は、プランのアップグレードをお願いいたします。`);
        return; 
      }
    } else {
      const currentAssistantCount = staffs.filter(s => s.role_type === 'assistant').length;
      if (currentAssistantCount >= currentLimit.assistant) {
        alert(`現在のプランでは、アシスタントの登録は最大 ${currentLimit.assistant} 名までです。\nこれ以上追加する場合は、プランのアップグレードをお願いいたします。`);
        return; 
      }
    }

    const isFirstStaff = staffs.length === 0;
    const staffId = isFirstStaff ? shopId : crypto.randomUUID();

    const { error } = await supabase.from('staffs').insert([{
      id: staffId,
      shop_id: shopId,
      name: newStaffName,
      role: isFirstStaff ? 'owner' : 'staff',
      role_type: newStaffRole, // 👈 🌟 🆕 選択された役割をセットする
      weekly_holidays: [],
      custom_shifts: {},
      capable_categories: [] // 👈 🌟 🆕 追加
    }]);

    if (!error) {
      setNewStaffName('');
      // 必要であれば setNewStaffRole('stylist'); でリセットしてもOKです
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
      const current = s.weekly_holidays || [];
      const updated = current.includes(dayIndex)
        ? current.filter(d => d !== dayIndex)
        : [...current, dayIndex];
      return { ...s, weekly_holidays: updated };
    }));
  };

  // 👇 🌟 🆕 ここから追加：担当業種のオンオフを切り替える関数
  const toggleCategory = (staffId, categoryName) => {
    setStaffs(prev => prev.map(s => {
      if (s.id !== staffId) return s;
      const current = s.capable_categories || [];
      const updated = current.includes(categoryName)
        ? current.filter(c => c !== categoryName)
        : [...current, categoryName];
      return { ...s, capable_categories: updated };
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
        custom_shifts: staff.custom_shifts, // 🚀 🆕 保存対象を custom_shifts に！
        concurrent_capacity: staff.concurrent_capacity || 1,
        role_type: staff.role_type,
        is_default_for_admin: staff.is_default_for_admin,
        capable_categories: staff.capable_categories // 👈 🌟 🆕 保存対象に追加
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
          
          {/* 👈 🌟 🆕 追加：役割を選択するプルダウン */}
          <select 
            value={newStaffRole}
            onChange={(e) => setNewStaffRole(e.target.value)}
            style={{ 
              padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', 
              outline: 'none', background: '#fff', color: '#1e293b', fontWeight: 'bold' 
            }}
          >
            <option value="stylist">✂️ 技術者</option>
            <option value="assistant">🧹 アシスト</option>
          </select>

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
                        onChange={(e) => {
                          const newRole = e.target.value;
                          
                          // 👈 🌟 🆕 役割変更時の上限チェック
                          if (newRole === 'stylist') {
                            const currentStylistCount = staffs.filter(s => s.role_type === 'stylist').length;
                            if (currentStylistCount >= currentLimit.stylist) {
                              alert(`技術者（プレイヤー）の登録上限（${currentLimit.stylist}名）に達しているため、役割を変更できません。`);
                              return; // 変更をキャンセル
                            }
                          } else if (newRole === 'assistant') {
                            const currentAssistantCount = staffs.filter(s => s.role_type === 'assistant').length;
                            if (currentAssistantCount >= currentLimit.assistant) {
                              alert(`アシスタントの登録上限（${currentLimit.assistant}名）に達しているため、役割を変更できません。`);
                              return; // 変更をキャンセル
                            }
                          }
                          
                          // 問題なければ変更を適用
                          setStaffs(prev => prev.map(s => s.id === staff.id ? { ...s, role_type: newRole } : s));
                        }}
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

                {/* 🚀 🆕 修正：役割（技術者 vs アシスタント）によってラベルと説明文を切り替える */}
                <div style={{ marginBottom: '25px', padding: '15px', background: isStylist ? '#fff' : '#f0f9ff', borderRadius: '15px', border: `1px solid ${isStylist ? '#e2e8f0' : '#bae6fd'}` }}>
                  <div style={{ fontSize: '0.8rem', color: isStylist ? '#64748b' : '#0284c7', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                    <Users size={14} /> 
                    {isStylist ? '個人の同時受け入れ上限（人）' : '店舗のサポート力（人）'}
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
                    <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                      {isStylist ? (
                        <>アシスタントがいる前提で、この人が同じ時間に<br />最大何人まで掛け持ちできるか</>
                      ) : (
                        <>この人が出勤していると、お店全体の<br />最大受け入れ枠がプラス何人増えるか</>
                      )}
                    </div>
                  </div>
                </div>

                {/* 👇 🌟 🆕 ここから追加：担当業種の設定パネル */}
                {(() => {
                  // 🚀 🆕 修正：配列でもカンマ区切りの文字列でも安全にパースしてクラッシュを防ぐ
                  let shopBusinessTypes = [];
                  if (Array.isArray(shopData?.business_type)) {
                    shopBusinessTypes = shopData.business_type;
                  } else if (typeof shopData?.business_type === 'string') {
                    shopBusinessTypes = shopData.business_type.split(/,|、/).map(s => s.trim()).filter(Boolean);
                  }
                  
                  // 👇 🌟 修正：登録されている大カテゴリが1つ以下（単一業態）なら、この設定パネル自体を非表示にする
                  if (shopBusinessTypes.length <= 1) return null;

                  return (
                    <div style={{ marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                        <Scissors size={14} /> 担当できる業種（プラットフォーム連携用）
                      </div>
                      {shopBusinessTypes.length > 0 ? (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {shopBusinessTypes.map((industryName) => {
                            const isCapable = staff.capable_categories?.includes(industryName);
                            return (
                              <button
                                key={industryName}
                                type="button"
                                onClick={() => toggleCategory(staff.id, industryName)}
                                style={{
                                  padding: '8px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer',
                                  background: isCapable ? '#1e293b' : '#fff',
                                  color: isCapable ? '#fff' : '#64748b',
                                  border: isCapable ? 'none' : '1px solid #cbd5e1',
                                  transition: 'all 0.2s',
                                  display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                              >
                                {isCapable && <Check size={14} />}
                                {industryName}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>※店舗の業種が設定されていません。</div>
                      )}
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '10px', lineHeight: '1.4' }}>
                        ※この店舗が複数の業種を兼任している場合、このスタッフが担当する業種を選択してください。<br/>
                        ※一つも選択していない場合は、すべての業種の予約を受け付ける（制限なし）扱いになります。
                      </div>
                    </div>
                  );
                })()}
                {/* 👆 追加ここまで */}

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

                {/* ======================================================= */}
                {/* 🚀 🆕 ここから追加：シフト休み（特定日）設定カレンダーUI */}
                {/* ======================================================= */}
                <div style={{ marginTop: '20px', borderTop: '1px dashed #cbd5e1', paddingTop: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                      <Calendar size={14} /> シフト休み（特定日）の設定
                    </div>
                    <button
                      onClick={() => setOpenCalendarId(openCalendarId === staff.id ? null : staff.id)}
                      style={{ 
                        fontSize: '0.75rem', padding: '6px 12px', borderRadius: '8px', 
                        background: openCalendarId === staff.id ? '#1e293b' : '#fff', 
                        color: openCalendarId === staff.id ? '#fff' : '#1e293b', 
                        border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s'
                      }}
                    >
                      {openCalendarId === staff.id ? 'カレンダーを閉じる' : '📅 カレンダーを開く'}
                    </button>
                  </div>

                  {/* カレンダー本体 */}
                  {openCalendarId === staff.id && (
                    <div style={{ marginTop: '15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '15px', padding: '15px', animation: 'fadeIn 0.3s ease' }}>
                      {(() => {
                        const vMonth = staffMonths[staff.id] || new Date();
                        const y = vMonth.getFullYear();
                        const m = vMonth.getMonth();
                        const firstDay = new Date(y, m, 1).getDay();
                        const daysInMonth = new Date(y, m + 1, 0).getDate();
                        const days = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];

                        return (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <button onClick={() => changeMonth(staff.id, -1)} style={{ background: '#f1f5f9', border: 'none', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={16}/></button>
                              <div style={{ fontWeight: '900', color: '#1e293b' }}>{y}年 {m + 1}月</div>
                              <button onClick={() => changeMonth(staff.id, 1)} style={{ background: '#f1f5f9', border: 'none', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={16}/></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '8px' }}>
                              {['日', '月', '火', '水', '木', '金', '土'].map(d => <div key={d}>{d}</div>)}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                              {days.map((d, i) => {
                                if (!d) return <div key={i} />;
                                const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                
                                // 🚀 🆕 修正：その日のシフト設定を取り出す
                                const shiftData = staff.custom_shifts?.[dStr];
                                const isOff = shiftData?.type === 'off';
                                const isTime = shiftData?.type === 'time';

                                return (
                                  <div
                                    key={i}
                                    onClick={() => handleOpenShiftEdit(staff, dStr)} // 🚀 🆕 タップでポップアップを開く！
                                    style={{
                                      padding: '8px 0', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer',
                                      // 🚀 🆕 休みは赤、時短はオレンジ、通常はグレー
                                      background: isOff ? '#f43f5e' : (isTime ? '#f59e0b' : '#f8fafc'),
                                      color: (isOff || isTime) ? '#fff' : '#1e293b',
                                      border: (isOff || isTime) ? 'none' : '1px solid #e2e8f0',
                                      textAlign: 'center', transition: '0.1s'
                                    }}
                                  >
                                    {d}
                                    {/* 時短の場合は小さな時計マークを出す */}
                                    {isTime && <div style={{ fontSize: '0.5rem', marginTop: '-2px' }}>🕒</div>}
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '10px', textAlign: 'center' }}>
                              タップして「休み」や「出勤時間」を設定します。
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* 🚀 🆕 修正：選択されている日付のバッジ表示 */}
                  {Object.keys(staff.custom_shifts || {}).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                      {Object.entries(staff.custom_shifts).sort(([a], [b]) => a.localeCompare(b)).map(([dStr, shift]) => (
                        <span 
                          key={dStr} 
                          onClick={() => handleOpenShiftEdit(staff, dStr)}
                          style={{ 
                            fontSize: '0.7rem', cursor: 'pointer',
                            background: shift.type === 'off' ? '#fff1f2' : '#fffbeb', 
                            color: shift.type === 'off' ? '#e11d48' : '#d97706', 
                            padding: '4px 8px', borderRadius: '6px', 
                            border: `1px solid ${shift.type === 'off' ? '#fecdd3' : '#fde68a'}`, 
                            fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' 
                          }}
                        >
                          {dStr.replace(/-/g, '/')}
                          {shift.type === 'off' ? ' (休み)' : ` (${shift.start}〜${shift.end})`}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* 🚀 🆕 古い specific_holidays の残骸ブロックは削除しました */}
                </div>
                {/* 🚀 🆕 追加ここまで */}

              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================= */}
      {/* 🚀 🆕 ここに追加：シフト時間設定ポップアップ */}
      {/* ======================================================= */}
      {editingShift && (
        <div 
          onClick={() => setEditingShift(null)} // 🚀 🆕 追加：外側の背景をタップしたら閉じる
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} // 🚀 🆕 追加：内側（白いパネル部分）をタップしても閉じないようにブロック
            style={{ background: '#fff', width: '90%', maxWidth: '350px', borderRadius: '24px', padding: '25px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', color: '#1e293b' }}>
              {editingShift.dateStr.replace(/-/g, '/')} のシフト
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '20px' }}>
              {staffs.find(s => s.id === editingShift.staffId)?.name} さんの設定
            </p>

            {/* 選択ボタン：終日休み vs 時間指定 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button 
                onClick={() => setEditingShift({ ...editingShift, type: 'off' })}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: editingShift.type === 'off' ? '2px solid #f43f5e' : '1px solid #e2e8f0', background: editingShift.type === 'off' ? '#fff1f2' : '#fff', color: editingShift.type === 'off' ? '#f43f5e' : '#64748b', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
              >
                終日休み
              </button>
              <button 
                onClick={() => setEditingShift({ ...editingShift, type: 'time' })}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: editingShift.type === 'time' ? '2px solid #f59e0b' : '1px solid #e2e8f0', background: editingShift.type === 'time' ? '#fffbeb' : '#fff', color: editingShift.type === 'time' ? '#d97706' : '#64748b', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
              >
                時間指定（出勤）
              </button>
            </div>

            {/* 時間指定が選ばれた時だけ表示する入力欄 */}
            {editingShift.type === 'time' && (
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Clock size={18} color="#94a3b8" />
                <input 
                  type="time" 
                  value={editingShift.start} 
                  onChange={(e) => setEditingShift({ ...editingShift, start: e.target.value })} 
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 'bold', outline: 'none' }}
                />
                <span style={{ fontWeight: 'bold', color: '#64748b' }}>〜</span>
                <input 
                  type="time" 
                  value={editingShift.end} 
                  onChange={(e) => setEditingShift({ ...editingShift, end: e.target.value })} 
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 'bold', outline: 'none' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={handleSaveShift} style={{ width: '100%', padding: '14px', background: themeColor, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                設定を適用する
              </button>
              <button onClick={handleDeleteShift} style={{ width: '100%', padding: '14px', background: '#fff', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
                🗑 この日の特別設定を消す（通常通り）
              </button>
              <button onClick={() => setEditingShift(null)} style={{ width: '100%', padding: '10px', background: 'none', color: '#94a3b8', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🚀 🆕 追加ここまで */}

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