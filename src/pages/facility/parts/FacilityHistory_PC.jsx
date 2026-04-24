import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  History, Calendar, Scissors, ChevronDown, ChevronUp, 
  CheckCircle2, Printer, Search, ChevronLeft, ChevronRight, Building2, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityHistory_PC = ({ facilityId, sharedDate, setSharedDate }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedShopId, setExpandedShopId] = useState(null); // 🚀 🆕 業者IDで開閉管理
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState('name');

  const year = sharedDate.getFullYear();
  const month = sharedDate.getMonth();

  useEffect(() => { fetchHistory(); }, [facilityId, sharedDate]);

  const fetchHistory = async () => {
    setLoading(true);
    const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

    const { data: visitsData, error: vError } = await supabase
      .from('visit_requests')
      .select(`
        id, scheduled_date, start_time, status, parent_id, shop_id,
        profiles (id, business_name, theme_color, business_type)
      `)
      .eq('facility_user_id', facilityId)
      .eq('status', 'completed')
      .gte('scheduled_date', startOfMonth)
      .lte('scheduled_date', endOfMonth)
      .order('scheduled_date', { ascending: false });

    if (vError) {
      console.error(vError);
      setLoading(false);
      return;
    }

    const allRelevantIds = Array.from(new Set(visitsData.map(v => v.parent_id || v.id)));
    
    const { data: allResidents, error: rError } = await supabase
      .from('visit_request_residents')
      .select('*, members(name, room, floor, kana)') 
      .in('visit_request_id', allRelevantIds)
      .eq('status', 'completed');

    if (!rError) {
      const combinedData = visitsData.map(visit => {
        const targetId = visit.parent_id || visit.id;
        const residents = allResidents.filter(r => 
          r.visit_request_id === targetId && 
          r.completed_at?.split('T')[0] === visit.scheduled_date
        );
        return { ...visit, residents };
      });
      setHistory(combinedData);
    }
    setLoading(false);
  };

  // 🚀 🆕 【業者ごとにグループ化】するロジック
  const groupedHistory = useMemo(() => {
    const groups = {};
    history.forEach(visit => {
      const shopId = visit.shop_id;
      if (!groups[shopId]) {
        groups[shopId] = {
          shop: visit.profiles,
          visits: [],
          totalResidents: 0
        };
      }

      // --- 📋 この訪問日の入居者リストをソート ---
      const sortedResidents = [...(visit.residents || [])].sort((a, b) => {
        // 🚀 🆕 ふりがな(kana)を優先し、なければ名前(name)を使用するロジック（ListUpと同じ）
        const kanaA = (a.members?.kana || a.members?.name || "").trim();
        const kanaB = (b.members?.kana || b.members?.name || "").trim();

        if (sortMode === 'floor') {
          // 1. 階数で比較
          const fA = parseInt(String(a.members?.floor).replace(/[^0-9]/g, '')) || 999;
          const fB = parseInt(String(b.members?.floor).replace(/[^0-9]/g, '')) || 999;
          if (fA !== fB) return fA - fB;
          
          // 2. 階数が同じなら、あいうえお順
          return kanaA.localeCompare(kanaB, 'ja');
        } else {
          // 🚀 あいうえお順
          return kanaA.localeCompare(kanaB, 'ja');
        }
      });

      groups[shopId].visits.push({ ...visit, residents: sortedResidents });
      groups[shopId].totalResidents += visit.residents?.length || 0;
    });
    
    // 検索フィルタリング
    return Object.values(groups).filter(g => 
      g.shop.business_name.includes(searchTerm) || 
      g.visits.some(v => v.residents.some(r => r.members?.name.includes(searchTerm)))
    );
  }, [history, searchTerm, sortMode]);

  if (loading) return <div style={centerStyle}>記録を読み込み中...</div>;

  return (
    <div style={containerStyle}>
      <header style={headerArea}>
        <div style={titleGroup}>
          <h2 style={titleStyle}><History size={24} /> 過去の訪問記録</h2>
          <p style={descStyle}>{year}年{month + 1}月の実施レポートです。</p>
        </div>

        <div style={monthControl}>
          <button onClick={() => setSharedDate(new Date(year, month - 1, 1))} style={navMiniBtn}><ChevronLeft size={16}/></button>
          <span style={monthLabel}>{year} / {month + 1}</span>
          <button onClick={() => setSharedDate(new Date(year, month + 1, 1))} style={navMiniBtn}><ChevronRight size={16}/></button>
        </div>
      </header>

      <div style={searchAndAction}>
        <div style={{ ...searchBox, flex: 1 }}>
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="業者名や入居者名で絞り込み..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={searchInput}
          />
        </div>
        <button style={monthPrintBtn} onClick={() => window.print()}>
          <Printer size={18} /> 月間レポートを印刷
        </button>
      </div>

      {groupedHistory.length === 0 ? (
        <div style={emptyCard}>この月の訪問記録はありません。</div>
      ) : (
        <div style={listContainer}>
          {groupedHistory.map((group) => (
            <div key={group.shop.id} style={shopCard}>
              {/* 🏢 業者カード（ヘッダー） */}
              <div 
                style={shopCardHeader(group.shop.theme_color)} 
                onClick={() => setExpandedShopId(expandedShopId === group.shop.id ? null : group.shop.id)}
              >
                <div style={shopInfoGroup}>
                  <div style={shopIconBox(group.shop.theme_color)}>
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 style={shopNameTitle}>{group.shop.business_name}</h3>
                    <span style={shopTypeLabel}>{group.shop.business_type}</span>
                  </div>
                </div>
                
                <div style={shopSummaryGroup}>
                  <div style={summaryItem}>
                    <span style={sumLabel}>訪問回数</span>
                    <span style={sumValue}>{group.visits.length} 回</span>
                  </div>
                  <div style={summaryItem}>
                    <span style={sumLabel}>総施術人数</span>
                    <span style={sumValue}>{group.totalResidents} 名</span>
                  </div>
                  {expandedShopId === group.shop.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
              </div>

              {/* 📋 訪問日ごとの内訳リスト */}
              <AnimatePresence>
                {expandedShopId === group.shop.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                    <div style={visitDetailList}>
                      
                      {/* 🚀 🆕 カード内の専用ソートボタン */}
                      <div style={localSortArea}>
                        <span style={localSortLabel}>リストの並び替え：</span>
                        <div style={localSortSwitch}>
                          <button onClick={() => setSortMode('name')} style={sortTabStyle(sortMode === 'name')}>あいうえお順</button>
                          <button onClick={() => setSortMode('floor')} style={sortTabStyle(sortMode === 'floor')}>階数順</button>
                        </div>
                      </div>

                      {group.visits.map((visit) => (
                        <div key={visit.id} style={visitRow}>
                          <div style={visitDateInfo}>
                            <Calendar size={16} color="#94a3b8" />
                            <strong>{visit.scheduled_date.replace(/-/g, '/')}</strong>
                            <span style={countLabel}>{visit.residents?.length || 0}名 完了</span>
                          </div>
                          <div style={residentVerticalList}>
                            {visit.residents.map((res) => (
                              <div key={res.id} style={residentRowMini}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={floorBadge}>{res.members?.floor}</span>
                                  <span style={roomNum}>{res.members?.room}</span>
                                  <span style={resNameText}>{res.members?.name} 様</span>
                                </div>
                                <span style={resMenuText}>{res.menu_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* ==========================================
          🚀 🆕 1. 印刷用の中身セクション（修正版）
          ========================================== */}
      <div id="print-area" className="print-only">
        <div style={{ padding: '20px', border: '2px solid #333', marginBottom: '30px' }}>
          <h1 style={{ textAlign: 'center', margin: '0 0 10px 0', fontSize: '22pt', letterSpacing: '2px' }}>
            訪問サービス実施報告書
          </h1>
          <p style={{ textAlign: 'center', margin: 0, fontSize: '14pt', fontWeight: 'bold', color: '#666' }}>
             対象期間：{year}年{month + 1}月度
          </p>
        </div>

        <div style={{ textAlign: 'right', marginBottom: '40px', fontSize: '11pt' }}>
          作成日：{new Date().toLocaleDateString('ja-JP')}
        </div>

        {groupedHistory.map(g => (
          <div key={g.shop.id} style={{ marginBottom: '50px', pageBreakInside: 'avoid' }}>
            {/* 業者名・ヘッダー */}
            <div style={{ background: '#eee', padding: '10px 15px', borderLeft: '10px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '16pt' }}>
                ■ {g.shop.business_name} <small style={{fontSize: '10pt', fontWeight: 'normal'}}>({g.shop.business_type})</small>
              </h2>
              <span style={{ fontSize: '12pt', fontWeight: 'bold' }}>当月実施合計：{g.totalResidents} 名</span>
            </div>
            
            {g.visits.map(v => (
              <div key={v.id} style={{ marginBottom: '25px', paddingLeft: '10px' }}>
                <div style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px', display: 'flex', gap: '20px' }}>
                  <span>【実施日：{v.scheduled_date.replace(/-/g, '/')}】</span>
                  <span>実施人数：{v.residents.length} 名</span>
                </div>

                {/* 🚀 🆕 箇条書きではなく、3カラム（または2カラム）で整列させる */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', // 3人ずつ横に並べる
                  gap: '8px', 
                  fontSize: '11pt',
                  lineHeight: '1.4'
                }}>
                  {v.residents.map(r => (
                    <div key={r.id} style={{ padding: '4px 8px', border: '1px solid #eee', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        <small style={{ fontSize: '8pt', color: '#666', marginRight: '5px' }}>
                          {r.members?.floor?.toString().replace('F', '')}F
                        </small>
                        {r.members?.name}様
                      </span>
                      <span style={{ fontSize: '9pt', fontWeight: 'bold' }}>({r.menu_name})</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* 🚀 🆕 報告書の「印」や「確認欄」を追加してフォーマルに */}
        <div style={{ marginTop: '100px', display: 'flex', justifyContent: 'flex-end', gap: '30px' }}>
          <div style={{ width: '120px', height: '80px', border: '1px solid #ccc', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px' }}>
            <div style={{ fontSize: '8pt', color: '#999' }}>施設確認印</div>
            <div style={{ height: '50px' }}></div>
          </div>
          <div style={{ width: '120px', height: '80px', border: '1px solid #ccc', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px' }}>
            <div style={{ fontSize: '8pt', color: '#999' }}>業者担当印</div>
            <div style={{ height: '50px' }}></div>
          </div>
        </div>
      </div>

      {/* ==========================================
          🚀 🆕 2. 印刷用CSSの修正
          ========================================== */}
      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            display: block !important; 
            color: #000 !important;
            background: #fff !important;
          }
          /* 改ページの設定 */
          h2 { page-break-after: avoid; }
          .print-only { font-family: "MS Mincho", "Hiragino Mincho Pro", serif; }
        }
      `}</style>

    </div> // 👈 一番外側の containerStyle の閉じ
  );
};

// --- スタイル定義 ---
const containerStyle = { width: '100%', margin: '0 auto', padding: '0' };
const headerArea = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const titleGroup = { flex: 1 };
const titleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.6rem', fontWeight: '900', color: '#3d2b1f', margin: 0 };
const descStyle = { fontSize: '0.85rem', color: '#64748b', marginTop: '5px' };

const monthControl = { display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '8px 16px', borderRadius: '15px', border: '1px solid #eee' };
const monthLabel = { fontWeight: '900', fontSize: '1.1rem', color: '#3d2b1f', minWidth: '100px', textAlign: 'center' };
const navMiniBtn = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const searchAndAction = { display: 'flex', gap: '15px', marginBottom: '25px' };
const searchBox = { flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '12px 20px', borderRadius: '15px', border: '1px solid #eee' };
const searchInput = { border: 'none', outline: 'none', fontSize: '0.9rem', width: '100%' };
const monthPrintBtn = { display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', borderRadius: '15px', border: 'none', background: '#3d2b1f', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' };

const listContainer = { display: 'flex', flexDirection: 'column', gap: '20px' };
const shopCard = { background: '#fff', borderRadius: '24px', border: '1px solid #eee', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' };

const shopCardHeader = (color) => ({
  padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
  background: color ? `linear-gradient(135deg, ${color}08 0%, #fff 100%)` : '#fff',
  borderLeft: `6px solid ${color || '#3d2b1f'}`
});

const shopInfoGroup = { display: 'flex', alignItems: 'center', gap: '15px' };
const shopIconBox = (color) => ({ width: '50px', height: '50px', borderRadius: '14px', background: color || '#3d2b1f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const shopNameTitle = { margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' };
const shopTypeLabel = { fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' };

const shopSummaryGroup = { display: 'flex', alignItems: 'center', gap: '30px' };
const summaryItem = { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' };
const sumLabel = { fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold' };
const sumValue = { fontSize: '1.1rem', fontWeight: '900', color: '#3d2b1f' };

const visitDetailList = { padding: '10px 25px 25px', background: '#fcfaf7' };
const visitRow = { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '8px' };
const visitDateInfo = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem' };
const countLabel = { fontSize: '0.8rem', background: '#3d2b1f', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' };
const residentNamesLine = { fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5' };

const centerStyle = { height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: 'bold' };
const emptyCard = { textAlign: 'center', padding: '80px', background: '#fff', borderRadius: '24px', color: '#cbd5e1', border: '2px dashed #f1f5f9' };

// 🚀 🆕 ここから「カード内ソート用」の3つを追加
const localSortArea = { 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'flex-end', 
  gap: '12px', 
  marginBottom: '15px',
  paddingBottom: '10px',
  borderBottom: '1px dashed #eee'
};
const localSortLabel = { fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' };
const localSortSwitch = { display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '2px' };
// 🚀 🆕 ここまで

// 💡 少しコンパクト（padding: 6px 12px）に微調整しました
const sortTabStyle = (active) => ({
  padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '0.7rem', fontWeight: 'bold',
  cursor: 'pointer', transition: '0.2s',
  background: active ? '#fff' : 'transparent',
  color: active ? '#3d2b1f' : '#94a3b8',
  boxShadow: active ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
});

const residentVerticalList = { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' };
const residentRowMini = { 
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
  background: '#fff', padding: '10px 15px', borderRadius: '10px', border: '1px solid #f1f5f9' 
};
const floorBadge = { background: '#3d2b1f', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', minWidth: '30px', textAlign: 'center' };
const roomNum = { fontSize: '0.75rem', color: '#94a3b8', width: '40px' };
const resNameText = { fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' };
const resMenuText = { fontSize: '0.8rem', color: '#c5a059', fontWeight: 'bold' };

export default FacilityHistory_PC;