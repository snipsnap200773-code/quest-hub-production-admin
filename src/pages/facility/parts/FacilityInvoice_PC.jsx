import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { ReceiptText, X, Printer, ChevronLeft, ChevronRight, Building2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 🆕 追加：.range()でページングして「本当に全件」取得するヘルパー
const fetchAllRows = async (queryFactory) => {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFactory().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
};

const FacilityInvoice_PC = ({ facilityId, selectedShopId }) => {
  const [loading, setLoading] = useState(true);
  const [facilityName, setFacilityName] = useState('');
  const [salesRecords, setSalesRecords] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);

  // --- 状態管理用 ---
  // 🚀 🆕 ポップアップは廃止するので showInvoiceModal と connectedShops は削除
  const [selectedShop, setSelectedShop] = useState(null); 
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear());
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1);

  // 🚀 🆕 依存配列に selectedShopId を追加
  useEffect(() => {
    const fetchData = async () => {
      if (!facilityId || !selectedShopId) return; // 👈 🚀 IDがない時はスキップ
      setLoading(true);
      try {
        // ① 施設名を取得
        const { data: facUser } = await supabase.from('facility_users').select('facility_name').eq('id', facilityId).single();
        const fName = facUser?.facility_name || '';
        setFacilityName(fName);

        // ② 🚀 🆕 選択された業者のみを取得
        const { data: connection } = await supabase
          .from('shop_facility_connections')
          .select('profiles(*)')
          .eq('facility_user_id', facilityId)
          .eq('shop_id', selectedShopId)
          .single();
        
        const shop = connection?.profiles;
        setSelectedShop(shop || null);

        if (shop) {
          // ③ 🚀 🆕 選択された業者だけの売上と顧客名簿を取得（1000件の壁対策済み）
          const [salesAll, customersAll] = await Promise.all([
            fetchAllRows(() => supabase.from('sales').select('*').eq('shop_id', selectedShopId)),
            fetchAllRows(() => supabase.from('customers').select('id, name, shop_id').eq('shop_id', selectedShopId))
          ]);

          setSalesRecords(salesAll);
          setAllCustomers(customersAll);
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [facilityId, selectedShopId]);

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
      const [y, m] = s.sale_date.split('-').map(Number); // 👈 修正：Dateを経由せず文字列から直接年月を取り出す
      return y === invoiceYear && m === invoiceMonth && targetCustomerIds.includes(s.customer_id);
    });
  }, [salesRecords, targetCustomerIds, invoiceYear, invoiceMonth, selectedShop]);

  const totalAmount = filteredSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

  const handlePrintInvoice = async () => {
    const printWin = window.open('', '_blank', 'width=900,height=1000');

    // 🚀 🆕 【超重要】名簿（membersテーブル）から、この施設の全員の「お名前 ➔ ふりがな」の最新マップをサクッと取得
    const { data: memberKanas } = await supabase
      .from('members')
      .select('name, kana')
      .eq('facility_user_id', facilityId);

    const kanaLookup = {};
    memberKanas?.forEach(m => {
      if (m.name) kanaLookup[m.name.trim()] = m.kana || "";
    });

    const members = filteredSales.flatMap(s => {
      const details = typeof s.details === 'string' ? JSON.parse(s.details || '{}') : (s.details || {});
      if (details.members_list && details.members_list.length > 0) {
        return details.members_list.map(m => {
          const trimmedName = (m.name || "").trim();
          return { 
            ...m, 
            date: s.sale_date || s.created_at?.split('T')[0] || '',
            // 🚀 🆕 もし売上データ側にふりがなが無ければ、今名簿にある最新のふりがなを全自動でドッキング！
            kana: m.kana || kanaLookup[trimmedName] || "" 
          };
        });
      }
      return [{ date: s.sale_date, name: facilityName, floor: '-', menu: '施設訪問 施術一式', price: s.total_amount }];
    });
    
    // 🚀 これで確実に全員分のふりがなが揃った状態で、美しい2段階ソートが行われます！
    members.sort((a, b) => {
      // ① まずは日付で比較（古い順）
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      if (dateCompare !== 0) return dateCompare;

      // ② 日付が同じなら、フロア・階数で比較（低い階から順）
      // 💡 1F や 2F といった文字列から数字だけを抜き出して正しく1階➔2階と並べます
      const fA = parseInt(String(a.floor).replace(/[^0-9]/g, '')) || 999;
      const fB = parseInt(String(b.floor).replace(/[^0-9]/g, '')) || 999;
      if (fA !== fB) return fA - fB;

      // ③ 日付も階数も同じなら、最後にふりがな（あいうえお順）で並び替え
      const kanaA = (a.kana || a.name || "").trim();
      const kanaB = (b.kana || b.name || "").trim();
      return kanaA.localeCompare(kanaB, 'ja');
    });

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
                ${members.map((m, i) => `<tr><td align="center">${i + 1}</td><td align="center">${m.date?.slice(5).replace('-', '/')}</td><td align="center">${m.floor?.toString().replace(/F/g, '') || '-'}F</td><td><strong>${m.name} 様</strong></td><td>${m.menu || ''}</td><td align="right">¥${Number(m.price || 0).toLocaleString()}</td></tr>`).join('')}
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

  if (loading || !selectedShop) return <div style={centerStyle}>利用データを集計中...</div>;

  // 🚀 🆕 無料プラン（システム制限中）の場合のブロック画面
  if (selectedShop.subscription_plan === 'free') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '24px', border: '1px solid #fee2e2', marginTop: '20px' }}>
          <div style={{ background: '#fef2f2', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <AlertCircle size={32} color="#ef4444" />
          </div>
          <h2 style={{ color: '#1e293b', margin: '0 0 15px 0' }}>システム利用制限中</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6' }}>
            現在、「<strong>{selectedShop.business_name}</strong>」様はシステム利用制限中のため、<br/>
            明細の自動発行機能がストップされています。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <header style={headerArea}>
        <div style={titleGroup}>
          <h2 style={titleStyle}><ReceiptText size={24} /> 利用明細・精算確認</h2>
          <p style={descStyle}>【{selectedShop.business_name}】の訪問履歴と利用明細を確認・印刷できます。</p>
        </div>
      </header>

      {/* 🚀 🆕 ポップアップではなく、画面に直接表示する */}
      <div style={{ padding: '30px', background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 20px rgba(0,0,0,0.02)' }}>
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

const circleBtn = { width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const monthBtn = (active) => ({ padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', background: active ? '#1e293b' : '#fff', color: active ? '#fff' : '#334155' });
const amountDisplayArea = { background: '#f8fafc', padding: '40px 20px', borderRadius: '20px', border: '1px solid #e2e8f0', textAlign: 'center', marginTop: '20px' };
const printFullBtn = { background: '#3d2b1f', color: '#fff', border: 'none', padding: '15px 35px', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' };

export default FacilityInvoice_PC;