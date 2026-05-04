import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  FileText, Calendar, Building2, Printer, Search, 
  ChevronLeft, ChevronRight, Calculator, User, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityInvoice_PC = ({ facilityId, sharedDate, setSharedDate }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const year = sharedDate.getFullYear();
  const month = sharedDate.getMonth();

  useEffect(() => { fetchInvoiceData(); }, [facilityId, sharedDate]);

  const fetchInvoiceData = async () => {
    setLoading(true);
    const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

    // 🚀 1. 「完了した個人」をベースに取得。 profiles(id) と scheduled_date を確実に取り込みます
    const { data: residents, error: rError } = await supabase
      .from('visit_request_residents')
      .select(`
        *,
        members(name, room, floor),
        visit_requests!inner(scheduled_date, shop_id, profiles(id, business_name, theme_color))
      `)
      .eq('visit_requests.facility_user_id', facilityId)
      .eq('status', 'completed')
      .gte('completed_at', `${startOfMonth}T00:00:00`)
      .lte('completed_at', `${endOfMonth}T23:59:59`);

    if (!residents || residents.length === 0) {
      setData([]); setLoading(false); return;
    }

    // 🚀 2. 正確な単価を出すためのマスター取得（施設専用カテゴリで絞り込み）
    const shopIds = Array.from(new Set(residents.map(r => r.visit_requests.shop_id)));
    const [catRes, servRes, optRes] = await Promise.all([
      supabase.from('service_categories').select('name, is_facility_only').in('shop_id', shopIds),
      supabase.from('services').select('*').in('shop_id', shopIds),
      supabase.from('service_options').select('*')
    ]);

    const facilityOnlyCatNames = catRes.data?.filter(c => c.is_facility_only).map(c => c.name) || [];
    const facilityServices = servRes.data?.filter(s => facilityOnlyCatNames.includes(s.category)) || [];
    const options = optRes.data || [];

    // 🚀 3. データの整形
    const grouped = {};
    residents.forEach(r => {
      const shopId = r.visit_requests.shop_id;
      const shopInfo = r.visit_requests.profiles; // 💡 ここに id が入るようになります
      
      if (!grouped[shopId]) {
        grouped[shopId] = { shop: shopInfo, totalAmount: 0, residents: [] };
      }

      // --- 金額計算 ---
      const match = r.menu_name?.match(/^(.+?)（(.+?)）$/);
      const parentName = match ? match[1].trim() : r.menu_name?.trim();
      const optionName = match ? match[2].trim() : null;

      const service = facilityServices.find(s => s.shop_id === shopId && s.name === parentName);
      let price = Number(service?.price) || 0;

      if (optionName && service) {
        const opt = options.find(o => o.service_id === service.id && o.option_name === optionName);
        price += (Number(opt?.additional_price) || 0);
      }
      
      // --- 🚀 🆕 日付の特定：実際に「完了した日(completed_at)」を正解にします ---
      // completed_at には "2026-04-23T12:00:00" のように時間がくっついているので、'T' の前（日付）だけを切り出します
      // もし何らかの理由で完了日がない場合は、予備として予定日を使います
      const actualDate = r.completed_at ? r.completed_at.split('T')[0] : r.visit_requests.scheduled_date;

      grouped[shopId].totalAmount += price;
      grouped[shopId].residents.push({
        id: r.id, // 🚀 🆕 ReactのKeyエラー対策
        date: actualDate, 
        name: r.members?.name,
        floor: r.members?.floor,
        room: r.members?.room,
        menu: r.menu_name,
        price: price
      });
    });

    // 最後に日付順に並び替える
    const finalData = Object.values(grouped).map(g => ({
      ...g,
      residents: g.residents.sort((a, b) => a.date.localeCompare(b.date))
    }));

    setData(finalData);
    setLoading(false);
  };

  // 🔍 検索フィルタ
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(g => 
      g.shop.business_name.includes(searchTerm) || 
      g.residents.some(r => r.name.includes(searchTerm))
    );
  }, [data, searchTerm]);

  // 全業者合算の総計
  const grandTotal = filteredData.reduce((sum, g) => sum + g.totalAmount, 0);

  if (loading) return <div style={centerStyle}>利用明細を集計中...</div>;

  return (
    <div style={containerStyle}>
      <header style={headerArea}>
        <div style={titleGroup}>
          <h2 style={titleStyle}><CreditCard size={24} /> 利用明細・精算確認</h2>
          <p style={descStyle}>業者ごとの請求内訳と入居者様の個人別利用金額です。</p>
        </div>

        <div style={monthControl}>
          <button onClick={() => setSharedDate(new Date(year, month - 1, 1))} style={navMiniBtn}><ChevronLeft size={16}/></button>
          <span style={monthLabel}>{year} / {month + 1}</span>
          <button onClick={() => setSharedDate(new Date(year, month + 1, 1))} style={navMiniBtn}><ChevronRight size={16}/></button>
        </div>
      </header>

      {/* 総計サマリーカード */}
      <div style={grandTotalCard}>
        <div style={totalInfo}>
          <span style={totalLabel}>{month + 1}月分の総利用金額</span>
          <div style={totalAmountText}>
            <small>¥</small>{grandTotal.toLocaleString()}<span style={{fontSize:'1rem', marginLeft:'10px'}}>（税込）</span>
          </div>
        </div>
        <button style={printBtn} onClick={() => window.print()}>
          <Printer size={18} /> 明細をまとめて印刷
        </button>
      </div>

      {/* 業者別明細リスト */}
      <div style={listContainer}>
        {filteredData.length === 0 ? (
          <div style={emptyCard}>今月の利用データはありません。</div>
        ) : (
          filteredData.map(group => (
            <div key={group.shop.id} style={shopSectionCard}>
              <div style={shopHeader(group.shop.theme_color)}>
                <div style={shopTitleGroup}>
                  <Building2 size={20} />
                  <strong>{group.shop.business_name}</strong>
                  <span style={shopCountBadge}>{group.residents.length}件</span>
                </div>
                <div style={shopSubTotal}>
                  店舗合計: <strong>¥{group.totalAmount.toLocaleString()}</strong>
                </div>
              </div>

              <div style={tableWrapper}>
                <table style={invoiceTable}>
                  <thead>
                    <tr>
                      <th style={thStyle}>実施日</th>
                      <th style={thStyle}>お名前</th>
                      <th style={thStyle}>お部屋</th>
                      <th style={thStyle}>メニュー</th>
                      <th style={thRightStyle}>単価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.residents.map((r, i) => (
                      <tr key={i} style={trStyle}>
                        <td style={tdStyle}>{r.date.replace(/-/g,'/')}</td>
                        <td style={tdNameStyle}>{r.name} 様</td>
                        <td style={tdStyle}>{r.room}</td>
                        <td style={tdMenuStyle}>{r.menu}</td>
                        <td style={tdRightStyle}>¥{r.price.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ==========================================
          🚀 🆕 印刷用の中身セクション（Hydrationエラー対策版）
          ========================================== */}
      <div id="print-area" className="print-only">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><td style={{ height: '12mm' }}></td></tr></thead>
          <tbody>
            <tr>
              <td>
                <div style={{ padding: '0 15mm' }}>
                  <h1 style={{ textAlign: 'center', margin: '0 0 5px 0', fontSize: '22pt' }}>利用明細書</h1>
                  <p style={{ textAlign: 'center', fontSize: '13pt', fontWeight: 'bold', margin: '0 0 10px 0' }}>({year}年{month + 1}月分)</p>
                  <p style={{ textAlign: 'right', fontSize: '10pt', margin: '0 0 15px 0' }}>発行日: {new Date().toLocaleDateString('ja-JP')}</p>
                  
                  {filteredData.map(g => (
                    <div key={g.shop.id} style={{ marginBottom: '30px' }}>
                      <h2 style={{ borderBottom: '2px solid #000', paddingBottom: '3px', fontSize: '15pt', marginBottom: '10px' }}>■ {g.shop.business_name}</h2>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#eee' }}>
                            <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10pt' }}>実施日</th>
                            <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10pt' }}>お名前</th>
                            <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10pt' }}>部屋</th>
                            <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10pt' }}>メニュー</th>
                            <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10pt' }}>金額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.residents.map((r, i) => (
                            <tr key={i}>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '9.5pt' }}>{r.date.replace(/-/g, '/')}</td>
                              <td style={{ border: '1px solid #000', padding: '6px', fontSize: '9.5pt' }}>{r.name} 様</td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '9.5pt' }}>{r.room}</td>
                              <td style={{ border: '1px solid #000', padding: '6px', fontSize: '9.5pt' }}>{r.menu}</td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '9.5pt', fontWeight: 'bold' }}>¥{r.price.toLocaleString()}</td>
                            </tr>
                          ))}
                          <tr style={{ background: '#f9f9f9' }}>
                            <td colSpan="4" style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', fontSize: '10pt' }}>店舗合計</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold', fontSize: '11pt' }}>¥{g.totalAmount.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontSize: '18pt', fontWeight: '900', marginTop: '20px', borderTop: '3px double #000', paddingTop: '10px' }}>総支払予定額： ¥{grandTotal.toLocaleString()} (税込)</div>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td style={{ height: '12mm' }}></td></tr></tfoot>
        </table>
      </div>

      {/* 🚀 🆕 印刷用CSS（URLを消して、余白を確保する） */}
      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          /* 1. ブラウザのURL表示を消す */
          @page { margin: 0; }

          /* 2. 画面全体を一旦「不可視」にする（場所は残す） */
          body {
            visibility: hidden;
            background: #fff !important;
          }

          /* 3. 印刷エリアだけを「可視」にする */
          #print-area, #print-area * {
            visibility: visible;
          }

          /* 4. 印刷エリアを紙の左上に強制移動（これで白紙を防止） */
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }

          /* 5. 余計なスペースを作っている元の要素を完全に消す */
          header, .no-print, button, input {
            display: none !important;
          }

          .print-only { font-family: "MS Mincho", "Hiragino Mincho Pro", serif; }
        }
      `}</style>
    </div>
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

const grandTotalCard = { background: '#3d2b1f', color: '#fff', padding: '30px 40px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', boxShadow: '0 10px 30px rgba(61, 43, 31, 0.2)' };
const totalInfo = { display: 'flex', flexDirection: 'column' };
const totalLabel = { fontSize: '0.9rem', opacity: 0.8, marginBottom: '5px' };
const totalAmountText = { fontSize: '2.5rem', fontWeight: '900' };

const printBtn = { display: 'flex', alignItems: 'center', gap: '10px', background: '#c5a059', color: '#3d2b1f', border: 'none', padding: '12px 25px', borderRadius: '15px', fontWeight: '900', cursor: 'pointer', transition: '0.2s' };

const listContainer = { display: 'flex', flexDirection: 'column', gap: '30px' };
const shopSectionCard = { background: '#fff', borderRadius: '20px', border: '1px solid #eee', overflow: 'hidden' };
const shopHeader = (color) => ({ padding: '15px 25px', background: color ? `${color}10` : '#f8fafc', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
const shopTitleGroup = { display: 'flex', alignItems: 'center', gap: '10px', color: '#3d2b1f' };
const shopCountBadge = { background: '#3d2b1f', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '5px' };
const shopSubTotal = { fontSize: '0.9rem', color: '#64748b' };

const tableWrapper = { padding: '10px' };
const invoiceTable = { width: '100%', borderCollapse: 'collapse' };
const thStyle = { textAlign: 'left', padding: '12px 15px', fontSize: '0.75rem', color: '#94a3b8', borderBottom: '1px solid #eee' };
const thRightStyle = { ...thStyle, textAlign: 'right' };
const trStyle = { borderBottom: '1px solid #f8fafc' };
const tdStyle = { padding: '12px 15px', fontSize: '0.85rem', color: '#1e293b' };
const tdNameStyle = { ...tdStyle, fontWeight: 'bold' };
const tdMenuStyle = { ...tdStyle, color: '#c5a059', fontWeight: 'bold' };
const tdRightStyle = { ...tdStyle, textAlign: 'right', fontWeight: '900' };

const emptyCard = { textAlign: 'center', padding: '80px', background: '#fff', borderRadius: '24px', color: '#cbd5e1', border: '2px dashed #f1f5f9' };
const centerStyle = { height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: 'bold' };

export default FacilityInvoice_PC;