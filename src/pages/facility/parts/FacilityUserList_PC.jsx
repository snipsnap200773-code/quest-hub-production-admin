import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  UserPlus, Edit2, Trash2, Home, User, ChevronDown, ChevronUp, 
  AlertCircle, X, Info, FileText 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // 🚀 アニメーション用

export default function FacilityUserList_PC({ facilityId, isMobile }) {
  // --- 1. State 管理 ---
  const [residents, setResidents] = useState([]);
  const [facilityName, setFacilityName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false); // スマホは最初閉じておく
  const [detailMember, setDetailMember] = useState(null); // 🚀 ポップアップ用

  // フォーム用入力State
  const [newFloor, setNewFloor] = useState('1F');
  const [newRoom, setNewRoom] = useState('');
  const [newName, setNewName] = useState('');
  const [newKana, setNewKana] = useState(''); 
  const [newNotes, setNewNotes] = useState(''); 
  const [isBedCut, setIsBedCut] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [sortBy, setSortBy] = useState('room');

  // --- 2. データ取得ロジック ---
  useEffect(() => { 
    const init = async () => {
      const { data: fac } = await supabase.from('facility_users').select('facility_name').eq('id', facilityId).single();
      if (fac) {
        setFacilityName(fac.facility_name);
        fetchResidents();
      }
    };
    init();
  }, [facilityId]);

  const fetchResidents = async () => {
    setLoading(true);
    // 🚀 🆕 is_active が true（現役）の人だけを取得するように変更
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('facility_user_id', facilityId)
      .eq('is_active', true); 
      
    setResidents(data || []);
    setLoading(false);
  };

  // --- 3. 操作ロジック ---
  const handleSubmit = async () => {
    if (!newRoom || !newName) { alert("部屋番号とお名前は必須です"); return; }
    const userData = { 
      facility_user_id: facilityId, facility: facilityName, floor: newFloor, 
      room: newRoom, name: newName, kana: newKana, notes: newNotes, isBedCut: isBedCut 
    };
    if (editingId) {
      await supabase.from('members').update(userData).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('members').insert([userData]);
    }
    await fetchResidents(); resetForm();
    if (isMobile) setIsFormOpen(false);
  };

  const resetForm = () => {
    setNewRoom(''); setNewName(''); setNewKana(''); setNewNotes(''); setIsBedCut(false); setNewFloor('1F');
  };

  const startEdit = (res) => {
    setEditingId(res.id); 
    setNewFloor(res.floor || '1F');
    setNewRoom(res.room || '');
    setNewName(res.name || '');
    setNewKana(res.kana || ''); 
    setNewNotes(res.notes || ''); 
    setIsBedCut(!!res.isBedCut);
    setIsFormOpen(true);
    setDetailMember(null); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🚀 🆕 スマート削除ロジック（ここに追加！）
  const handleDeleteMember = async (memberId, memberName) => {
    if (!window.confirm(`「${memberName}」様を名簿から削除しますか？`)) return;

    try {
      // 1. 全店舗を通じた利用実績があるかチェック
      const { count, error: countErr } = await supabase
        .from('visit_request_residents')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', memberId);

      if (countErr) throw countErr;

      if (count > 0) {
        // 🏥 パターンA：実績あり ➔ 論理削除（非表示にするだけ）
        const { error: upErr } = await supabase
          .from('members')
          .update({ is_active: false })
          .eq('id', memberId);

        if (upErr) throw upErr;
        alert("過去の利用実績があるため、データを保護した状態で名簿から外しました。");
      } else {
        // 🧹 パターンB：実績なし ➔ 物理削除（DBから完全に消す）
        const { error: delErr } = await supabase
          .from('members')
          .delete()
          .eq('id', memberId);

        if (delErr) throw delErr;
        alert("名簿から完全に削除しました。");
      }

      fetchResidents(); // リストを更新
    } catch (err) {
      console.error(err);
      alert("削除処理中にエラーが発生しました: " + err.message);
    }
  };

  const sortedResidents = [...residents].sort((a, b) => {
    if (sortBy === 'room') {
      return ((a.floor || '') + (a.room || '')).localeCompare((b.floor || '') + (b.room || ''), 'ja', { numeric: true });
    }
    return (a.kana || '').localeCompare(b.kana || '', 'ja');
  });

  // --- 4. 詳細ポップアップ (Modal) ---
  function renderDetailModal() {
    if (!detailMember) return null;
    return (
      <div style={modalOverlay} onClick={() => setDetailMember(null)}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={modalContent} onClick={e => e.stopPropagation()}
        >
          <div style={modalHeader}>
             <h3 style={{margin:0}}>入居者詳細</h3>
             <button onClick={() => setDetailMember(null)} style={closeCircle}><X size={20}/></button>
          </div>
          <div style={modalBody}>
            <div style={detailRow}>
              <span style={detailLabel}>お名前</span>
              <div style={{fontWeight:'900', fontSize:'1.4rem'}}>{detailMember.name} 様</div>
              <div style={{fontSize:'0.85rem', color:'#94a3b8'}}>{detailMember.kana}</div>
            </div>
            <div style={{display:'flex', gap:'20px', marginTop:'20px'}}>
               <div style={{flex:1}}>
                 <span style={detailLabel}>居室</span>
                 <div style={{fontWeight:'bold'}}>{detailMember.floor} / {detailMember.room}号室</div>
               </div>
               <div style={{flex:1}}>
                 <span style={detailLabel}>ベッドカット</span>
                 <div>{detailMember.isBedCut ? <span style={bedCutBadge}>必要（寝たまま）</span> : <span style={{color:'#94a3b8'}}>不要</span>}</div>
               </div>
            </div>
            <div style={{marginTop:'20px', padding:'15px', background:'#f8fafc', borderRadius:'12px'}}>
              <span style={detailLabel}>特記事項</span>
              <div style={{fontSize:'0.95rem', lineHeight:'1.6', marginTop:'5px', whiteSpace:'pre-wrap'}}>
                {detailMember.notes || '（特になし）'}
              </div>
            </div>
            <button onClick={() => startEdit(detailMember)} style={detailEditBtn}>
              <Edit2 size={16}/> この情報を編集する
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- 5. スマホ版 表示関数 ---
  function renderMobileView() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={mCardStyle}>
          <button onClick={() => setIsFormOpen(!isFormOpen)} style={mFormToggleBtn}>
            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
              <UserPlus size={20} />
              <span style={{fontWeight:'900'}}>{editingId ? '情報を編集する' : '入居者を登録'}</span>
            </div>
            {isFormOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {isFormOpen && (
            <div style={{ padding: '20px', borderTop: '1px solid #eee' }}>
               <label style={mLabelStyle}>階数選択</label>
               <div style={floorBtnGroup}>{['1F','2F','3F','4F','5F'].map(f => <button key={f} onClick={() => setNewFloor(f)} style={floorBtn(newFloor === f)}>{f}</button>)}</div>
               <div style={{marginTop:'15px'}}><label style={mLabelStyle}>部屋 / 名前</label>
                  <div style={{display:'flex', gap:'10px'}}>
                    <input style={{...mInputStyle, flex:1}} value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="101" />
                    <input style={{...mInputStyle, flex:2}} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="名前" />
                  </div>
               </div>
               <div style={{marginTop:'15px'}}>
                  <label style={mLabelStyle}>ベッドカット</label>
                  <div style={toggleButtonGroup}>
                    <button onClick={() => setIsBedCut(false)} style={toggleBtn(!isBedCut)}>不要</button>
                    <button onClick={() => setIsBedCut(true)} style={toggleBtn(isBedCut)}>必要</button>
                  </div>
               </div>
               <div style={{marginTop:'15px'}}><label style={mLabelStyle}>備考</label><textarea style={pcTextarea} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="メモ" /></div>
               <button onClick={handleSubmit} style={mSubmitBtn}>{editingId ? '保存する' : '名簿に追加'}</button>
            </div>
          )}
        </div>
        {sortedResidents.map(u => (
          <div key={u.id} style={mResidentCard} onClick={() => setDetailMember(u)}>
            <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
              <div style={mFloorBadge}>{u.floor}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'0.75rem', color:'#94a3b8'}}>{u.room}号室</div>
                <div style={{fontWeight:'900', fontSize:'1.1rem'}}>{u.name} 様</div>
                {u.isBedCut && <div style={{...bedCutBadge, display:'inline-flex', marginTop:'4px'}}><AlertCircle size={10}/> ベッドカット</div>}
              </div>
              <Info size={18} color="#cbd5e1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- 6. PC版 表示関数 ---
  function renderPCView() {
    return (
      <div style={contentWrapper}>
        <aside style={pcFormSide}>
          <div style={formHeader}><UserPlus size={22} color="#c5a059" /><h3 style={{margin:0}}>{editingId ? '情報の編集' : '新規登録'}</h3></div>
          <div style={{padding:'25px'}}>
            <div style={formGroup}><label style={labelStyle}>階数</label><div style={floorBtnGroup}>{['1F','2F','3F','4F','5F'].map(f => <button key={f} onClick={() => setNewFloor(f)} style={floorBtn(newFloor === f)}>{f}</button>)}</div></div>
            <div style={{display:'flex', gap:'15px', marginTop:'20px'}}>
              <div style={{flex:1}}><label style={labelStyle}>部屋番号</label><input style={pcInput} value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="101" /></div>
              <div style={{flex:2}}><label style={labelStyle}>お名前</label><input style={pcInput} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="名前" /></div>
            </div>
            <div style={{marginTop:'20px'}}><label style={labelStyle}>ふりがな</label><input style={pcInput} value={newKana} onChange={(e) => setNewKana(e.target.value)} placeholder="ふりがな" /></div>
            <div style={{marginTop:'20px'}}><label style={labelStyle}>ベッドカット</label><div style={toggleButtonGroup}><button onClick={() => setIsBedCut(false)} style={toggleBtn(!isBedCut)}>不要</button><button onClick={() => setIsBedCut(true)} style={toggleBtn(isBedCut)}>必要</button></div></div>
            <div style={{marginTop:'20px'}}><label style={labelStyle}>特記事項</label><textarea style={pcTextarea} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="メモ" /></div>
            <button onClick={handleSubmit} style={pcSubmitBtn}>{editingId ? '変更を保存する' : '登録する'}</button>
            {editingId && <button onClick={() => {setEditingId(null); resetForm();}} style={mCancelBtn}>編集をキャンセル</button>}
          </div>
        </aside>

        <main style={pcListSide}>
          <div style={pcListHeader}>
            <div style={{display:'flex', alignItems:'center', gap:'12px'}}><span style={pcCountBadge}>{residents.length}名</span><h3 style={{margin:0, fontSize:'1.1rem'}}>入居者一覧</h3></div>
            <div style={sortGroup}><button onClick={() => setSortBy('room')} style={sortTab(sortBy === 'room')}>部屋順</button><button onClick={() => setSortBy('name')} style={sortTab(sortBy === 'name')}>名前順</button></div>
          </div>
          <div style={pcTableScroll}>
            <table style={pcTable}>
              <thead>
                <tr style={pcThead}>
                  <th style={{padding:'15px', textAlign:'center', width:'70px'}}>階</th>
                  <th style={{padding:'15px', width:'80px'}}>部屋</th>
                  <th style={{padding:'15px'}}>お名前（詳細を見るにはクリック）</th>
                  <th style={{padding:'15px', width:'120px', textAlign:'center'}}>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedResidents.map(u => (
                  <tr key={u.id} style={pcTr}>
                    <td style={{textAlign:'center'}}><span style={floorBadge}>{u.floor}</span></td>
                    <td style={{fontWeight:'900', color:'#1e293b'}}>{u.room}</td>
                    <td onClick={() => setDetailMember(u)} style={{cursor:'pointer'}}>
                      <div style={nameWrapper}>
                        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                           <div style={{fontWeight:'900', fontSize:'1.1rem'}}>{u.name} 様</div>
                           {u.isBedCut && <AlertCircle size={14} color="#ef4444" />}
                        </div>
                        <div style={{fontSize:'0.75rem', color:'#94a3b8'}}>{u.kana}</div>
                      </div>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <div style={btnActions}>
                        <button onClick={() => startEdit(u)} style={pcActionBtn}><Edit2 size={14}/></button>
                        {/* 🚀 🆕 修正：上で作った handleDeleteMember を呼び出す形に変更 */}
                        <button onClick={() => handleDeleteMember(u.id, u.name)} style={pcDelBtn}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    );
  }

  if (loading) return <div style={{textAlign:'center', padding:'100px'}}>読み込み中...</div>;

  return (
    <div style={containerStyle}>
      {isMobile ? renderMobileView() : renderPCView()}
      {/* 🚀 ポップアップ表示 */}
      <AnimatePresence>
        {detailMember && renderDetailModal()}
      </AnimatePresence>
    </div>
  );
}

// --- スタイル定義 (Modal関連を追加) ---
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' };
const modalContent = { width: '90%', maxWidth: '450px', background: '#fff', borderRadius: '30px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const modalHeader = { padding: '20px 25px', background: '#fcfaf7', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '900' };
const modalBody = { padding: '30px' };
const closeCircle = { background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const detailRow = { marginBottom: '15px' };
const detailLabel = { display: 'block', fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' };
const detailEditBtn = { width: '100%', marginTop: '30px', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b' };

// (以前のスタイルは維持)
const containerStyle = { width: '100%', margin: '0 auto' };
const contentWrapper = { display: 'flex', gap: '30px', alignItems: 'flex-start' };
const pcFormSide = { width: '380px', background: '#fff', borderRadius: '24px', border: '1px solid #eee', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' };
const pcListSide = { flex: 1, background: '#fff', borderRadius: '24px', border: '1px solid #eee', overflow: 'hidden' };
const pcListHeader = { padding: '20px 25px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fcfaf7' };
const pcCountBadge = { background: '#3d2b1f', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' };
const pcTableScroll = { overflowY: 'auto', maxHeight: '70vh' };
const pcTable = { width: '100%', borderCollapse: 'collapse' };
const pcThead = { borderBottom: '2px solid #f1f5f9', background: '#fcfaf7' };
const pcTr = { borderBottom: '1px solid #f8fafc', height: '75px' };
const pcInput = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' };
const pcTextarea = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', minHeight: '80px', resize: 'none', boxSizing: 'border-box', fontSize: '0.9rem' };
const pcSubmitBtn = { width: '100%', marginTop: '20px', padding: '18px', borderRadius: '15px', border: 'none', background: '#3d2b1f', color: '#fff', fontWeight: '900', cursor: 'pointer' };
const pcActionBtn = { padding: '8px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', color: '#64748b', cursor: 'pointer' };
const pcDelBtn = { padding: '8px', borderRadius: '8px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' };
const nameWrapper = { display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'nowrap' };
const mCardStyle = { background: '#fff', borderRadius: '20px', border: '1px solid #eee', overflow: 'hidden', marginBottom:'15px' };
const mFormToggleBtn = { width: '100%', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', color: '#3d2b1f', cursor: 'pointer' };
const mInputStyle = { width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', boxSizing: 'border-box' };
const mSubmitBtn = { width: '100%', marginTop: '20px', padding: '16px', borderRadius: '12px', border: 'none', background: '#3d2b1f', color: '#fff', fontWeight: '900' };
const mLabelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', marginBottom: '5px', display: 'block' };
const mResidentCard = { background: '#fff', padding: '15px', borderRadius: '18px', border: '1px solid #eee', marginBottom: '10px' };
const mFloorBadge = { width: '40px', height: '40px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#3d2b1f' };
const mEditBtn = { padding: '10px', borderRadius: '12px', background: '#f1f5f9', border: 'none', color: '#64748b' };
const mDelBtn = { padding: '10px', borderRadius: '12px', background: '#fef2f2', border: 'none', color: '#ef4444' };
const formHeader = { display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 25px', background: '#fcfaf7', borderBottom: '1px solid #f1f5f9', color: '#3d2b1f', fontWeight: '900' };
const formGroup = { marginBottom: '0' };
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: '900', color: '#64748b', marginBottom: '8px' };
const floorBtnGroup = { display: 'flex', gap: '5px' };
const floorBtn = (active) => ({ flex: 1, padding: '12px 0', borderRadius: '10px', border: active ? '2px solid #3d2b1f' : '1px solid #e2e8f0', background: active ? '#3d2b1f' : '#fff', color: active ? '#fff' : '#3d2b1f', fontWeight: '900', cursor: 'pointer' });
const floorBadge = { background: '#f1f5f9', color: '#3d2b1f', padding: '4px 10px', borderRadius: '8px', fontWeight: '900', fontSize: '0.8rem' };
const sortGroup = { display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px' };
const sortTab = (active) => ({ padding: '6px 15px', border: 'none', borderRadius: '8px', background: active ? '#fff' : 'transparent', color: active ? '#3d2b1f' : '#94a3b8', fontWeight: '900', cursor: 'pointer', fontSize: '0.75rem' });
const btnActions = { display: 'flex', gap: '5px', justifyContent: 'center' };
const toggleButtonGroup = { display: 'flex', gap: '8px' };
const toggleBtn = (active) => ({ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: active ? '#2d6a4f' : '#f1f5f2', color: active ? '#fff' : '#2d6a4f', fontWeight: '900', cursor: 'pointer', fontSize: '0.85rem' });
const bedCutBadge = { background: '#fef2f2', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #fee2e2' };
const mCancelBtn = { width: '100%', marginTop: '10px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'underline', cursor:'pointer' };