import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { ReceiptText, X, Printer, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FacilityInvoice_PC = ({ facilityId }) => {
  const [loading, setLoading] = useState(true);
  const [facilityName, setFacilityName] = useState('');
  const [connectedShops, setConnectedShops] = useState([]); // 提携業者リスト
  const [salesRecords, setSalesRecords] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);

  // --- ポップアップ管理用 ---
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null); // 選択された業者
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear());
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    const fetchData = async () => {
      if (!facilityId) return;
      setLoading(true);
      try {
        // ① 施設名を取得
        const { data: facUser } = await supabase.from('facility_users').select('facility_name').eq('id', facilityId).single();
        const fName = facUser?.facility_name || '';
        setFacilityName(fName);

        // ② 提携しているすべての業者を取得
        const { data: connections } = await supabase
          .from('shop_facility_connections')
          .select('shop_id, profiles(*)')
          .eq('facility_user_id', facilityId)
          .eq('status', 'active');
        
        const shops = connections?.map(c => c.profiles) || [];
        setConnectedShops(shops);

        if (shops.length > 0) {
          const shopIds = shops.map(s => s.id);
          
          // ③ 全業者の売上と顧客名簿をまとめて取得
          const [sRes, cRes] = await Promise.all([
            supabase.from('sales').select('*').in('shop_id', shopIds),
            supabase.from('customers').select('id, name, shop_id').in('shop_id', shopIds)
          ]);

          setSalesRecords(sRes.data || []);
          setAllCustomers(cRes.data || []);
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [facilityId]);

  // 🚀 選択された業者 ＆ 施設名に一致する顧客IDを特定
  const targetCustomerIds = useMemo(() => {
    if (!selectedShop) return [];
    return allCustomers
      .filter(c => c.name === facilityName && c.shop_id === selectedShop.id)
      .map(c => c.id);
  }, [allCustomers, facilityName, selectedShop]);

  // 🚀 選択された業者 ＆ 年月でフィルタ
  const filteredSales = useMemo(() => {
    if (!selectedShop) return [];
    return salesRecords.filter(s => {
      if (!s.sale_date || s.shop_id !== selectedShop.id) return false;
      const d = new Date(s.sale_date);
      return d.getFullYear() === invoiceYear && (d.getMonth() + 1) === invoiceMonth && targetCustomerIds.includes(s.customer_id);
    });
  }, [salesRecords, targetCustomerIds, invoiceYear, invoiceMonth, selectedShop]);

  const totalAmount = filteredSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

  const handlePrintInvoice = () => {
    const printWin = window.open('', '_blank', 'width=900,height=1000');
    const members = filteredSales.flatMap(s => {
      const details = typeof s.details === 'string' ? JSON.parse(s.details || '{}') : (s.details || {});
      if (details.members_list && details.members_list.length > 0) {
        return details.members_list.map(m => ({ ...m, date: s.sale_date || s.created_at.split('T')[0] }));
      }
      return [{ date: s.sale_date, name: facilityName, floor: '-', menu: '施設訪問 施術一式', price: s.total_amount }];
    });
    members.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    let content = `
      <html>
        <head>
          <title>利用明細書</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: "MS Mincho", serif; padding: 0; margin: 0; background: white; color: black; line-height: 1.4; }
            .page { width: 100%; box-sizing: border-box; }
            .header-flex { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
            .title-area { border-bottom: 2px solid #000; padding-bottom: 5px; width: 320px; font-size: 22pt; font-weight: bold; }
            .shop-info { text-align: right; font-size: 9.5pt; }
            .target-name { font-size: 20pt; font-weight: bold; border-bottom: 3px solid #000; display: inline-block; padding-bottom: 2px; min-width: 350px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; border-top: 2px solid #000; }
            th, td { padding: 8px 4px; border-bottom: 1px solid #ccc; font-size: 10pt; }
            th { border-bottom: 1px solid #000; background: #fff; text-align: center; }
            .total-section { text-align: center; margin: 40px 0; }
            .total-box { font-size: 20pt; font-weight: 900; border-bottom: 3px double #000; padding: 5px 40px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header-flex">
              <div class="title-area">${invoiceMonth}月度 利用明細書</div>
              <div class="shop-info">
                <div style="font-weight:bold; font-size:11pt;">${selectedShop?.business_name || ''}</div>
                <div>〒${selectedShop?.zip_code || ''}</div>
                <div>${selectedShop?.address || ''}</div>
                <div>TEL: ${selectedShop?.phone || ''}</div>
              </div>
            </div>
            <div class="target-name">${facilityName} 様</div>
            <table>
              <thead><tr><th>No</th><th>日付</th><th>階数</th><th>名前</th><th>メニュー</th><th>金額</th></tr></thead>
              <tbody>
                ${members.map((m, i) => `<tr><td align="center">${i + 1}</td><td align="center">${m.date?.slice(5).replace('-', '/')}</td><td align="center">${m.floor || '-'}F</td><td><strong>${m.name} 様</strong></td><td>${m.menu || ''}</td><td align="right">¥${Number(m.price || 0).toLocaleString()}</td></tr>`).join('')}
              </tbody>
            </table>
            <div class="total-section"><div class="total-box">合計金額： ¥ ${totalAmount.toLocaleString()} - (税込)</div></div>
          </div>
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `;
    printWin.document.write(content);
    printWin.document.close();
  };

  if (loading) return <div style={centerStyle}>利用データを集計中...</div>;

  return (
    <div style={containerStyle}>
      <header style={headerArea}>
        <div style={titleGroup}>
          <h2 style={titleStyle}><ReceiptText size={24} /> 利用明細・精算確認</h2>
          <p style={descStyle}>提携業者ごとの訪問履歴と利用明細を確認・印刷できます。</p>
        </div>
      </header>

      {/* 🚀 業者選択セクション：提携している業者を並べる */}
      <div style={shopGrid}>
        {connectedShops.length === 0 ? (
          <div style={emptyCard}>提携中の業者はまだありません。</div>
        ) : (
          connectedShops.map(shop => (
            <motion.div key={shop.id} whileHover={{y: -5}} style={shopCard}>
              <div style={shopHeader(shop.theme_color)}>
                <Building2 size={24} />
                <h3 style={shopNameText}>{shop.business_name}</h3>
              </div>
              <div style={shopBody}>
                <p style={shopDesc}>この業者の利用明細を発行します。</p>
                <button 
                  onClick={() => { setSelectedShop(shop); setShowInvoiceModal(true); }} 
                  style={shopBtn(shop.theme_color)}
                >
                  <ReceiptText size={18} /> 明細を発行する
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showInvoiceModal && selectedShop && (
          <div style={modalOverlayStyle} onClick={() => setShowInvoiceModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={modalContentStyle} onClick={e => e.stopPropagation()}>
              <div style={modalHeader}>
                <h3 style={{ margin: 0 }}>📄 {selectedShop.business_name} の利用明細</h3>
                <button onClick={() => setShowInvoiceModal(false)} style={closeBtn}><X size={24}/></button>
              </div>
              <div style={{ padding: '25px' }}>
                <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                    <button onClick={() => setInvoiceYear(y => y - 1)} style={circleBtn}><ChevronLeft /></button>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{invoiceYear}年</span>
                    <button onClick={() => setInvoiceYear(y => y + 1)} style={circleBtn}><ChevronRight /></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <button key={m} onClick={() => setInvoiceMonth(m)} style={monthBtn(invoiceMonth === m)}>{m}月</button>
                    ))}
                  </div>
                </div>
                <div style={amountDisplayArea}>
                  <p style={{ color: '#64748b', fontWeight: 'bold', marginBottom: '10px' }}>{facilityName} 様 / {invoiceYear}年{invoiceMonth}月分</p>
                  <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#1e293b' }}>
                    合計：¥ {totalAmount.toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '25px' }}>
                    <button onClick={handlePrintInvoice} style={printFullBtn} disabled={totalAmount === 0}>
                      <Printer size={18} /> 利用明細書を印刷する
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- スタイル定義 ---
const containerStyle = { width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '20px' };
const headerArea = { marginBottom: '30px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' };
const titleGroup = { flex: 1 };
const titleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.6rem', fontWeight: '900', color: '#3d2b1f', margin: 0 };
const descStyle = { fontSize: '0.85rem', color: '#64748b', marginTop: '5px' };
const centerStyle = { textAlign: 'center', padding: '100px', color: '#94a3b8' };

const shopGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' };
const shopCard = { background: '#fff', borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' };
const shopHeader = (color) => ({ background: color ? `${color}15` : '#f8fafc', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', color: color || '#333' });
const shopNameText = { margin: 0, fontSize: '1.2rem', fontWeight: '900' };
const shopBody = { padding: '20px', textAlign: 'center' };
const shopDesc = { fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' };
const shopBtn = (color) => ({ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '15px', border: 'none', background: color || '#3d2b1f', color: '#fff', fontWeight: 'bold', cursor: 'pointer' });

const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContentStyle = { background: '#fff', width: '90%', maxWidth: '580px', borderRadius: '32px', overflow: 'hidden' };
const modalHeader = { padding: '20px 25px', borderBottom: '2px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const closeBtn = { border: 'none', background: 'none', cursor: 'pointer' };
const circleBtn = { width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const monthBtn = (active) => ({ padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', background: active ? '#1e293b' : '#fff', color: active ? '#fff' : '#334155' });
const amountDisplayArea = { background: '#f8fafc', padding: '40px 20px', borderRadius: '20px', border: '1px solid #e2e8f0', textAlign: 'center' };
const printFullBtn = { background: '#3d2b1f', color: '#fff', border: 'none', padding: '15px 35px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' };
const emptyCard = { gridColumn: '1/-1', textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '24px', color: '#cbd5e1', border: '2px dashed #f1f5f9' };

export default FacilityInvoice_PC;