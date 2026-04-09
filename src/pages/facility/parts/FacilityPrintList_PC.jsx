import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Printer, Building2, ChevronRight, Loader2, Square, ArrowLeft, CheckCircle2 } from 'lucide-react';

const FacilityPrintList_PC = ({ facilityId, isMobile }) => {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [members, setMembers] = useState([]);
  const [services, setServices] = useState([]);
  const [lastVisits, setLastVisits] = useState({});
  const [loading, setLoading] = useState(false);
  const [printLayout, setPrintLayout] = useState('portrait'); 

  useEffect(() => { fetchPartners(); }, [facilityId]);

  const fetchPartners = async () => {
    const { data } = await supabase
      .from('shop_facility_connections')
      .select(`*, profiles (id, business_name, theme_color, business_type)`)
      .eq('facility_user_id', facilityId)
      .eq('status', 'active');
    setShops(data?.map(d => d.profiles) || []);
  };

  const handleSelectShop = async (shop) => {
    setLoading(true);
    setSelectedShop(shop);
    const [memRes, servRes, histRes] = await Promise.all([
      supabase.from('members').select('*').eq('facility_user_id', facilityId).order('floor', { ascending: true }).order('room', { ascending: true }),
      supabase.from('services').select('*').eq('shop_id', shop.id).eq('show_on_print', true),
      supabase.from('visit_request_residents').select('member_id, completed_at, visit_requests!inner(shop_id)').eq('status', 'completed').eq('visit_requests.shop_id', shop.id).order('completed_at', { ascending: false })
    ]);
    setServices(servRes.data || []);
    setMembers(memRes.data || []);
    const visitMap = {};
    histRes.data?.forEach(h => { if (!visitMap[h.member_id]) visitMap[h.member_id] = h.completed_at.split('T')[0].slice(5).replace('-', '/'); });
    setLastVisits(visitMap);
    setLoading(false);
  };

  const floorGroups = useMemo(() => {
    return members.reduce((acc, m) => {
      const f = m.floor || '不明';
      if (!acc[f]) acc[f] = [];
      acc[f].push(m);
      return acc;
    }, {});
  }, [members]);

  // 1. 業者選択画面（共通）
  if (!selectedShop) {
    return (
      <div style={containerStyle(isMobile)}>
        <div style={headerArea}>
          <h2 style={titleStyle}><Printer size={24} /> 掲示用名簿の作成</h2>
        </div>
        <div style={shopGrid(isMobile)}>
          {shops.map(shop => (
            <button key={shop.id} onClick={() => handleSelectShop(shop)} style={shopCard}>
              <div style={shopIconCircle(shop.theme_color)}><Building2 size={32} color="#fff" /></div>
              <strong style={{marginTop:'15px', color:'#3d2b1f'}}>{shop.business_name}</strong>
              <div style={selectBadge}>名簿を作成する ➔</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 2. スマホ版：設定リモコン画面
  if (isMobile) {
    return (
      <div style={containerStyle(true)}>
        <button onClick={() => setSelectedShop(null)} style={backBtn}>
          <ArrowLeft size={18} /> 業者一覧へ戻る
        </button>

        <div style={mRemoteCard}>
          <div style={mRemoteHeader}>
            <div style={shopBadge(selectedShop.theme_color)}>{selectedShop.business_type}</div>
            <h2 style={{margin:'10px 0 0', fontSize:'1.4rem'}}>{selectedShop.business_name}</h2>
            <p style={{color:'#64748b', fontSize:'0.85rem'}}>掲示用名簿の印刷準備が完了しました</p>
          </div>

          <div style={mSettingArea}>
            <p style={mLabel}>用紙の向きを選択</p>
            <div style={layoutSwitchContainer}>
              <button onClick={() => setPrintLayout('portrait')} style={layoutBtn(printLayout === 'portrait')}>縦向き</button>
              <button onClick={() => setPrintLayout('landscape')} style={layoutBtn(printLayout === 'landscape')}>横向き</button>
            </div>
          </div>

          <button style={mPrintExecBtn} onClick={() => window.print()}>
            <Printer size={20} /> この設定で印刷する
          </button>
          <p style={{fontSize:'0.75rem', color:'#94a3b8', textAlign:'center', marginTop:'15px'}}>
            ※スマホからプリント対応のプリンターへ送信されます
          </p>
        </div>

        {/* 隠し要素：印刷時にはこれだけが表示される */}
        <div id="print-area" style={{display:'none'}}>
           {renderPrintPreview(floorGroups, selectedShop, services, lastVisits, printLayout)}
        </div>
      </div>
    );
  }

  // 3. PC版：ワイドプレビュー画面
  return (
    <div style={containerStyle(false)}>
      <header className="no-print" style={headerArea}>
        <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
          <button onClick={() => setSelectedShop(null)} style={backBtn}>← 戻る</button>
          <h2 style={titleStyle}>【{selectedShop.business_name}】掲示用リスト プレビュー</h2>
        </div>

        <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
          <div style={layoutSwitchContainer}>
            <span style={{fontSize:'0.8rem', fontWeight:'bold', color:'#64748b', marginRight:'5px'}}>向き：</span>
            <button onClick={() => setPrintLayout('portrait')} style={layoutBtn(printLayout === 'portrait')}>縦向き</button>
            <button onClick={() => setPrintLayout('landscape')} style={layoutBtn(printLayout === 'landscape')}>横向き</button>
          </div>
          <button style={printBtn} onClick={() => window.print()}><Printer size={18} /> 印刷を実行する</button>
        </div>
      </header>

      <div id="print-area">
        {renderPrintPreview(floorGroups, selectedShop, services, lastVisits, printLayout)}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; display: block !important; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: ${printLayout}; margin: 10mm; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

// 共通の印刷用レンダリング関数
const renderPrintPreview = (floorGroups, shop, services, lastVisits, printLayout) => (
  Object.entries(floorGroups).map(([floor, floorMembers]) => (
    <div key={floor} style={pageWrapper}>
      <div style={printHeader}>
        <div>
          <h1 style={printTitle}>{shop.business_name} あつまれ綺麗にしたい人</h1>
          <p style={printDate}>訪問予定日：　月　日（　）</p>
        </div>
        <div style={floorBadge}>フロア：<span style={{fontSize:'24pt'}}>{floor}</span>F</div>
      </div>

      <table style={printTable}>
        <thead>
          <tr>
            <th style={thStyleNo}>申込</th>
            <th style={thStyleRoom}>部屋</th>
            <th style={thStyleName}>お名前</th>
            <th style={{...thStyleMenu, width: printLayout === 'landscape' ? 'auto' : '300px'}}>希望メニュー</th>
            <th style={thStyleLast}>前回</th>
          </tr>
        </thead>
        <tbody>
          {floorMembers.map(m => (
            <tr key={m.id}>
              <td style={tdCenter}><div style={printCheck}></div></td>
              <td style={tdCenter}>{m.room}</td>
              <td style={tdName}>{m.name} 様</td>
              <td style={tdMenuArea}>
                <div style={menuGridRow}>
                  {services.map(s => (
                    <div key={s.id} style={menuCheckItem}>
                      <span style={menuBox}></span>
                      <span style={menuNameText}>{s.name}</span>
                    </div>
                  ))}
                </div>
              </td>
              <td style={tdLast}>{lastVisits[m.id] || 'ー'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ))
);

// --- スタイル定義 ---
const containerStyle = (isMobile) => ({ 
  width: '100%', 
  maxWidth: isMobile ? '100%' : '1200px', // 🚀 🆕 PC版はワイドに！
  margin: '0 auto', 
  padding: isMobile ? '10px' : '0' 
});

const headerArea = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', gap: '20px' };
const titleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: '900', color: '#3d2b1f' };
const shopGrid = (isMobile) => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px', marginTop: '20px' });
const shopCard = { background: '#fff', border: '1px solid #eee', borderRadius: '24px', padding: '30px', cursor: 'pointer', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' };
const shopIconCircle = (color) => ({ width: '60px', height: '60px', borderRadius: '50%', background: color || '#c5a059', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const selectBadge = { marginTop: '15px', fontSize: '0.8rem', color: '#c5a059', fontWeight:'900' };

// 🚀 🆕 スマホリモコン用スタイル
const mRemoteCard = { background: '#fff', borderRadius: '30px', border: '1px solid #eee', padding: '40px 25px', marginTop: '20px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' };
const mRemoteHeader = { marginBottom: '40px' };
const shopBadge = (color) => ({ display: 'inline-block', padding: '4px 12px', background: `${color}15`, color: color, fontSize: '0.7rem', fontWeight: '900', borderRadius: '6px' });
const mSettingArea = { background: '#f8fafc', padding: '20px', borderRadius: '20px', marginBottom: '30px' };
const mLabel = { fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', marginBottom: '12px' };
const mPrintExecBtn = { width: '100%', padding: '20px', background: '#3d2b1f', color: '#fff', borderRadius: '18px', border: 'none', fontSize: '1.1rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 8px 16px rgba(61,43,31,0.2)' };

// PC/プレビュー用
const layoutSwitchContainer = { display: 'flex', alignItems: 'center', gap: '5px', background: '#f1f5f9', padding: '5px', borderRadius: '12px' };
const layoutBtn = (active) => ({ padding: '8px 20px', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', background: active ? '#3d2b1f' : 'transparent', color: active ? '#fff' : '#64748b' });
const printBtn = { display: 'flex', alignItems: 'center', gap: '10px', background: '#3d2b1f', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' };
const backBtn = { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' };

// 印刷実体（プレビュー）
const pageWrapper = { background: '#fff', padding: '30px', marginBottom: '30px', border: '1px solid #ddd', boxShadow: '0 5px 15px rgba(0,0,0,0.05)', pageBreakAfter: 'always' };
const printHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #000', paddingBottom: '10px', marginBottom: '15px' };
const printTitle = { fontSize: '18pt', margin: 0, fontWeight: 'bold', color: '#000' };
const printDate = { fontSize: '12pt', margin: '5px 0 0', color: '#000' };
const floorBadge = { fontSize: '14pt', fontWeight: 'bold', color: '#000' };
const printTable = { width: '100%', borderCollapse: 'collapse', border: '2px solid #000' };
const thStyleBase = { border: '1px solid #000', padding: '8px 4px', background: '#f2f2f2', fontSize: '10pt', textAlign: 'center', color: '#000' };
const thStyleNo = { ...thStyleBase, width: '45px' };
const thStyleRoom = { ...thStyleBase, width: '60px' };
const thStyleName = { ...thStyleBase, width: '150px' };
const thStyleMenu = { ...thStyleBase };
const thStyleLast = { ...thStyleBase, width: '70px' };
const tdBase = { border: '1px solid #000', padding: '8px 10px', fontSize: '11pt', height: '40px', color: '#000' };
const tdCenter = { ...tdBase, textAlign: 'center' };
const tdName = { ...tdBase, fontWeight: 'bold', fontSize: '12pt' };
const tdMenuArea = { ...tdBase, padding: '10px' };
const menuGridRow = { display: 'flex', flexDirection: 'row', gap: '15px', flexWrap: 'wrap', alignItems: 'center' };
const menuCheckItem = { display: 'flex', alignItems: 'center', gap: '6px' };
const menuBox = { width: '16px', height: '16px', border: '1.5px solid #000', display: 'inline-block', flexShrink: 0 };
const menuNameText = { fontSize: '11pt', lineHeight: '1.2', fontWeight: '500', whiteSpace: 'normal', maxWidth: '200px' };
const tdLast = { ...tdBase, textAlign: 'center', fontSize: '10pt' };
const printCheck = { width: '25px', height: '25px', border: '1.5px solid #1e293b', margin: '0 auto' };

export default FacilityPrintList_PC;