import React from 'react';

// ⚠️ 2026/09/26【CE】：予約に保存された「今回の訪問先」を、名簿の住所とは別に表示する部品（admin だけ）。
//    予約詳細の「住所」欄は名簿（customers）の住所。訪問先は予約ごとに違うことがあるため、
//    お客様が予約のときに入力した住所（options.visit_info.address）をここに出す。
//    訪問の予約かどうかは、予約時の「ご利用形式」（options.form_input.service_mode）で決める。
//    visit_info.address は来店の予約にも入る（ログイン客の登録住所・ねじ込みの名簿の住所）ので、
//    住所があるだけでは訪問と判断しない。
//    ※ ねじ込みは service_mode を保存していないので、今は表示されない（1-15 ② で保存するようにする）
const getVisitDestination = (res) => {
  if (!res || res.res_type !== 'normal') return null;

  let opt = res.options || {};
  if (typeof opt === 'string') {
    try { opt = JSON.parse(opt); } catch { opt = {}; }
  }

  if (opt.form_input?.service_mode !== 'visit') return null;

  const vi = opt.visit_info || {};
  return {
    address: (vi.address || '').trim(),
    parking: vi.parking || ''
  };
};

const VisitDestinationBox = ({ res }) => {
  const dest = getVisitDestination(res);
  if (!dest) return null;

  return (
    <div style={{ background: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '12px', padding: '14px', marginBottom: '15px', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#1d4ed8' }}>🚗 今回の訪問先</span>
        {dest.address && (
          
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}
          >
            マップで開く 📍
          </a>
        )}
      </div>
      <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: dest.address ? '#1e293b' : '#dc2626', wordBreak: 'break-all' }}>
        {dest.address || '住所の記録がありません。お客様に確認してください。'}
      </div>
      {dest.parking && (
        <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '6px' }}>🅿️ 駐車場：{dest.parking}</div>
      )}
      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '8px', lineHeight: 1.5 }}>
        お客様がこの予約のときに入力した住所です（名簿の住所とは別）。訪問のときは、こちらを確認してください。
      </div>
    </div>
  );
};

export default VisitDestinationBox;