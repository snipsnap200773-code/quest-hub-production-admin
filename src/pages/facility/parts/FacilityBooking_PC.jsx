import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { CheckCircle2, Calendar, Users, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const FacilityBooking_PC = ({ facilityId, setActiveTab, sharedDate }) => {
  // 🚀 1. まず全ての useState（箱作り）を一番上にまとめます
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [bookingSortMode, setBookingSortMode] = useState('floor');
  const [shopInfo, setShopInfo] = useState(null);
  const [facilityName, setFacilityName] = useState('');
  const [facilityEmail, setFacilityEmail] = useState('');
  const [facilityFurigana, setFacilityFurigana] = useState('');
  const [manualKeeps, setManualKeeps] = useState([]);
  const [regularRules, setRegularRules] = useState([]);
  const [confirmedDates, setConfirmedDates] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  // 💡 これを sortedDrafts より上に持ってくるのがポイントです！
  const [dbReservedResidents, setDbReservedResidents] = useState([]);

  // 🚀 2. 全ての箱が準備できた後に、useMemo（計算）を書きます
  const sortedDrafts = useMemo(() => {
    const combined = [
      ...dbReservedResidents.map(r => ({ ...r, isFromDB: true })),
      ...drafts.map(d => ({ ...d, isFromDB: false }))
    ];

    return combined.sort((a, b) => {
      const m1 = a.members || {};
      const m2 = b.members || {};
      
      if (bookingSortMode === 'floor') {
        const f1 = parseInt(String(m1.floor).replace(/[^0-9]/g, '')) || 999;
        const f2 = parseInt(String(m2.floor).replace(/[^0-9]/g, '')) || 999;
        if (f1 !== f2) return f1 - f2;
        return (m1.room || "").localeCompare(m2.room || "", undefined, { numeric: true });
      } else {
        const k1 = (m1.kana || m1.name || "").trim();
        const k2 = (m2.kana || m2.name || "").trim();
        return k1.localeCompare(k2, 'ja');
      }
    });
  }, [drafts, dbReservedResidents, bookingSortMode]);

  // 🚀 3. その後に useEffect や関数を続けます
  useEffect(() => { fetchSummary(); }, [facilityId]);

  const fetchSummary = async () => {
    setLoading(true); // 読み込み開始

    // --- ① 日付計算の安全装置 ---
    const now = new Date();
    // sharedDate が正しくない場合は「今日」を基準にする
    const targetDate = (sharedDate && !isNaN(new Date(sharedDate).getTime())) 
      ? new Date(sharedDate) 
      : now;

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, targetDate.getMonth() + 1, 0).getDate();

    const startOfMonth = `${year}-${month}-01`;
    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    console.log("🔍 取得対象月:", startOfMonth, "〜", endOfMonth);

    try {
      // 1. 基本情報の取得（ドラフト）
      const { data: draftData } = await supabase
        .from('visit_list_drafts')
        .select('*, members(*)')
        .eq('facility_user_id', facilityId);

      // 2. 提携情報の取得（single を maybeSingle に変更して 406 エラーを回避）
      const { data: connData } = await supabase
        .from('shop_facility_connections')
        .select('shop_id, regular_rules, profiles(*)')
        .eq('facility_user_id', facilityId)
        .eq('status', 'active')
        .maybeSingle(); // 👈 ここが重要！

      // 3. 施設自身の情報を取得
      const { data: facData } = await supabase
        .from('facility_users')
        .select('facility_name, email, furigana')
        .eq('id', facilityId)
        .maybeSingle();

      if (facData) {
        setFacilityName(facData.facility_name || '');
        setFacilityEmail(facData.email || '');
        setFacilityFurigana(facData.furigana || '');
      }

      // 4. 三土手さんが提示した「既存予約」の取得部分（日付変数を安全にして実行）
      const { data: visitDatesRes } = await supabase
        .from('visit_requests')
        .select('id, scheduled_date, status, start_time') // 🚀 🆕 IDも取得するように修正
        .eq('facility_user_id', facilityId)
        .gte('scheduled_date', startOfMonth)
        .lte('scheduled_date', endOfMonth)
        .neq('status', 'canceled');

      // 🚀 🆕 追加：今月すでに予約が確定しているメンバー情報を取得
      const { data: reservedData } = await supabase
        .from('visit_request_residents')
        .select('*, members(*), visit_requests!inner(id, scheduled_date, status, parent_id)')
        .eq('visit_requests.facility_user_id', facilityId)
        .gte('visit_requests.scheduled_date', startOfMonth)
        .lte('visit_requests.scheduled_date', endOfMonth)
        .neq('visit_requests.status', 'canceled');

      // --- 各Stateへの反映 ---
      setDrafts(draftData || []);
      setShopInfo(connData?.profiles || null);
      setRegularRules(connData?.regular_rules || []);
      setConfirmedDates(visitDatesRes || []);
      setDbReservedResidents(reservedData || []); // 🚀 🆕 追加：取得したメンバー情報をセット

      // 5. 確保済み日程の取得（手動キープ ＆ 除外日）
      const [keepRes, exclRes] = await Promise.all([
        supabase.from('keep_dates')
          .select('date, start_time')
          .eq('facility_user_id', facilityId)
          .gte('date', startOfMonth)
          .lte('date', endOfMonth), // 👈 追加
        supabase.from('regular_keep_exclusions')
          .select('excluded_date')
          .eq('facility_user_id', facilityId)
          .gte('excluded_date', startOfMonth)
          .lte('excluded_date', endOfMonth) // 👈 追加
      ]);

      setManualKeeps(keepRes.data || []);
      setExclusions(exclRes.data?.map(e => e.excluded_date) || []);

    } catch (err) {
      console.error("🔥 fetchSummary で致命的なエラー:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // 定期キープの判定ロジック
  const checkIsRegularKeep = (date) => {
    const day = date.getDay();
    const dom = date.getDate();
    const m = date.getMonth() + 1;
    const nthWeek = Math.ceil(dom / 7);
    const t7 = new Date(date); t7.setDate(dom + 7);
    const isL1 = t7.getMonth() !== date.getMonth(); 
    const t14 = new Date(date); t14.setDate(dom + 14);
    const isL2 = t14.getMonth() !== date.getMonth() && !isL1;

    let matchTime = null;
    regularRules?.forEach(r => {
      const monthMatch = (r.monthType === 0) || (r.monthType === 1 && m % 2 !== 0) || (r.monthType === 2 && m % 2 === 0);
      const dayMatch = (r.day === day);
      const weekMatch = (r.week === nthWeek) || (r.week === -1 && isL1) || (r.week === -2 && isL2);
      if (monthMatch && dayMatch && weekMatch) matchTime = r.time;
    });
    return matchTime;
  };

  // 🚀 🆕 【ここがポイント！】今回送る「新規予約」だけを抽出
  const ensuredDates = useMemo(() => {
    const list = [];
    
    // 🚀 🆕 今表示している「年月（例：2026-05）」を特定
    const baseDate = sharedDate || new Date();
    const targetMonthPrefix = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`;

    manualKeeps.forEach(k => {
      // 🚀 🆕 日付が「今表示している月」で始まり、かつまだ予約確定されていないものだけを抽出
      const isCorrectMonth = k.date.startsWith(targetMonthPrefix);
      const isAlreadyBooked = confirmedDates.some(cd => cd.scheduled_date === k.date);

      if (isCorrectMonth && !isAlreadyBooked) {
        list.push({ date: k.date, time: k.start_time || '09:00' });
      }
    });

    // 定期キープの判定ロジック（以下、baseDateを使って月の日数分ループする処理へ続く）
    const targetYear = baseDate.getFullYear();
    const targetMonth = baseDate.getMonth();
    const lastDate = new Date(targetYear, targetMonth + 1, 0).getDate();

    for (let d = 1; d <= lastDate; d++) {
      const date = new Date(targetYear, targetMonth, d);
      const dateStr = date.toLocaleDateString('sv-SE');
      const regTime = checkIsRegularKeep(date);

      // 定期日 ＆ 除外されていない ＆ 手動と被っていない ＆ まだ予約されていない日
      if (regTime && !exclusions.includes(dateStr) && !list.some(item => item.date === dateStr) && !confirmedDates.some(cd => cd.scheduled_date === dateStr)) {
        list.push({ date: dateStr, time: regTime });
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [manualKeeps, regularRules, exclusions, confirmedDates, sharedDate]);

  // 🚀 🆕 【表示用】全日程（完了・確定・新規）を合算
  const allDisplayVisits = useMemo(() => {
    const list = ensuredDates.map(d => ({ ...d, type: 'new' }));
    confirmedDates.forEach(cd => {
      if (!list.some(l => l.date === cd.scheduled_date)) {
        list.push({ date: cd.scheduled_date, time: cd.start_time, type: cd.status }); 
      }
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [ensuredDates, confirmedDates]);
  // 🚀 🆕 ここまで追加

  const handleFinalSubmit = async () => {
    // 🚀 🆕 修正：新しい日程がなくても、既存の確定日があり、かつ追加する希望者がいれば実行可能にする
    if (ensuredDates.length === 0 && confirmedDates.length === 0) return alert("訪問予定日が設定されていません。");
    if (drafts.length === 0) return alert("追加する希望者が選択されていません。");

    setLoading(true);
    try {
      let targetRequestId = null;

      // --- パターンA：新しく確保した日程（キープ枠）がある場合 ---
      if (ensuredDates.length > 0) {
        let firstRequestId = null;
        for (let i = 0; i < ensuredDates.length; i++) {
          const { data: request, error: reqErr } = await supabase
            .from('visit_requests')
            .insert([{
              facility_user_id: facilityId,
              shop_id: shopInfo.id,
              scheduled_date: ensuredDates[i].date,
              start_time: ensuredDates[i].time,
              status: 'confirmed',
              parent_id: firstRequestId
            }]).select().single();

          if (reqErr) throw reqErr;
          if (i === 0) firstRequestId = request.id;
        }
        targetRequestId = firstRequestId;
      } 
      // --- パターンB：新しい日程はなく、既存の予約枠に追加するだけの場合 ---
      else {
        // 今月の既存予約（キャンセル以外）の中から最初のものを親IDとして特定する
        const parentRequest = confirmedDates.find(d => d.status !== 'canceled');
        if (!parentRequest) throw new Error("追加先の予約枠が見つかりませんでした。");
        targetRequestId = parentRequest.id;
      }

      // 🚀 🆕 共通処理：「新しく選んだ人(drafts)」だけを、特定したIDに紐付けて追加登録する
      const residentPayloads = drafts.map(d => ({
        visit_request_id: targetRequestId,
        member_id: d.member_id,
        menu_name: d.menu_name,
        status: 'pending' // 追加分も初期ステータスはpending
      }));

      const { error: resErr } = await supabase.from('visit_request_residents').insert(residentPayloads);
      if (resErr) throw resErr;

      // 🚀 メール送信：今回は「追加分」であることを伝える
      const residentListText = drafts.map(d => `・${d.members?.name} 様 (${d.menu_name})`).join('\n');
      const datesForMail = ensuredDates.length > 0 ? ensuredDates : confirmedDates; // 新規日程があればそれ、なければ既存日程
      const formattedDatesForMail = datesForMail.map(d => `${(d.date || d.scheduled_date).replace(/-/g, '/')} (${d.time || d.start_time?.substring(0,5)})`);

      await supabase.functions.invoke('resend', {
        body: {
          type: 'facility_booking',
          shopName: shopInfo.business_name,
          shopEmail: shopInfo.email_contact,
          facilityName: facilityName,
          facilityFurigana: facilityFurigana,
          facilityEmail: facilityEmail,
          scheduledDates: formattedDatesForMail, 
          residentCount: drafts.length,
          residentListText: residentListText,
          shopId: shopInfo.id,
          facilityId: facilityId
        }
      });

      // 🚀 お掃除
      await supabase.from('visit_list_drafts').delete().eq('facility_user_id', facilityId);
      await supabase.from('keep_dates').delete().eq('facility_user_id', facilityId);

      alert(`予約の送信が完了しました！✨`);
      setActiveTab('status'); 
    } catch (err) {
      console.error(err);
      alert("エラー: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={containerStyle}>
      <button onClick={() => setActiveTab('list-up')} style={backBtn}>
        <ArrowLeft size={18} /> リストアップ画面へ戻る
      </button>

      <div style={summaryCard}>
        <h2 style={title}><CheckCircle2 color="#c5a059" /> 予約内容の最終確認</h2>
        <p style={subTitle}>以下の内容で <strong>{shopInfo?.business_name}</strong> さんに予約を依頼します。</p>

        <div style={grid}>
          <div style={infoBox}>
            <div style={label}><Calendar size={16} /> 今月の訪問予定（{allDisplayVisits.length}日間）</div>
            <div style={dateList}>
              {allDisplayVisits.map(item => {
                // ...（日付の表示ループは変更なしなのでそのまま）...
                const isCompleted = item.type === 'completed';
                const isConfirmed = item.type === 'confirmed';

                return (
                  <span 
                    key={item.date} 
                    style={{
                      ...dateTag,
                      background: isCompleted ? '#f1f5f9' : (isConfirmed ? '#10b981' : '#3d2b1f'),
                      color: isCompleted ? '#94a3b8' : '#fff',
                      border: isCompleted ? '1px solid #e2e8f0' : 'none',
                      opacity: isCompleted ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isCompleted && <CheckCircle2 size={12} />}
                    {item.date.replace(/-/g,'/')}
                    <small style={{ marginLeft: '4px', opacity: 0.8 }}>({item.time?.substring(0, 5)})</small>
                    {isCompleted && <span style={{ fontSize: '0.6rem' }}>[完了]</span>}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={infoBox}>
            <div style={label}><Users size={16} /> 今月の施術予定の合計</div>
            <div style={countNum}>
              {sortedDrafts.length} <small>名</small>
              {/* 🚀 🆕 内訳を表示 */}
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '5px' }}>
                (内訳: 追加分 {drafts.length}名 / 確定済 {dbReservedResidents.length}名)
              </div>
            </div>
          </div>
        </div>

        <div style={residentPreview}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ ...smallTitle, margin: 0 }}>希望者一覧（各日程共通）</h4>
            {/* ...（ソートタブは変更なし）... */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
              <button onClick={() => setBookingSortMode('floor')} style={miniSortTabStyle(bookingSortMode === 'floor')}>階数</button>
              <button onClick={() => setBookingSortMode('name')} style={miniSortTabStyle(bookingSortMode === 'name')}>名前</button>
            </div>
          </div>

          <div style={previewScroll}>
            {(() => {
              let lastLabel = ""; 
              return sortedDrafts.map((d) => { 
                const res = d.members || {};
                let currentLabel = "";
                if (bookingSortMode === 'floor') {
                  currentLabel = res.floor ? (String(res.floor).includes('F') ? res.floor : `${res.floor}F`) : "未設定";
                } else {
                  currentLabel = (res.kana || res.name || "？").charAt(0);
                }

                const isNewGroup = currentLabel !== lastLabel;
                lastLabel = currentLabel;

                return (
                  <motion.div key={d.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {isNewGroup && (
                      <div style={bookingGroupHeader}>
                        {currentLabel}
                      </div>
                    )}
                    
                    <div style={pRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* 🚀 🆕 確定済みの場合はバッジを表示 */}
                        {d.isFromDB && (
                          <span style={{ fontSize: '0.65rem', background: d.status === 'completed' ? '#94a3b8' : '#10b981', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {d.status === 'completed' ? '完了' : '確定済'}
                          </span>
                        )}
                        <span style={pRoomBadge}>
                          {res.room ? res.room : "---"} 
                        </span>
                        <span style={pName}>{res.name} 様</span>
                      </div>
                      <span style={{ ...pMenu, color: d.isFromDB ? '#94a3b8' : '#c5a059' }}>{d.menu_name}</span>
                    </div>
                  </motion.div>
                );
              });
            })()}
          </div>
        </div>

        {/* 🚀 🆕 追加：新規の追加内容がない場合のアナウンス */}
        {ensuredDates.length === 0 && drafts.length === 0 && (
          <div style={{ 
            background: '#f8fafc', 
            border: '2px dashed #cbd5e1', 
            borderRadius: '20px', 
            padding: '20px', 
            marginBottom: '20px', 
            textAlign: 'center' 
          }}>
            <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'bold', margin: 0, lineHeight: '1.6' }}>
              ℹ️ 現在、新しく追加された内容はありません。<br/>
              予約日または施術希望者を追加する場合は、<br/>
              「キープ！この日とった！」か「リストアップしよう！」で追加して、<br/>
              再度この画面で予約を確定してください。
            </p>
          </div>
        )}

        <button 
          onClick={handleFinalSubmit} 
          // 🚀 🆕 修正：日程もドラフトも空（＝何も新しく追加していない）ならボタンを無効化
          disabled={loading || (ensuredDates.length === 0 && drafts.length === 0)} 
          style={{
            ...finalBtn(loading),
            // 🚀 🆕 追加分がない場合は背景を灰色にする
            background: (loading || (ensuredDates.length === 0 && drafts.length === 0)) ? '#ccc' : '#3d2b1f'
          }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
          {loading ? '送信中...' : 'この内容で予約を確定して依頼する'}
        </button>
      </div>
    </div>
  );
};

// スタイル定義は変更なし
const containerStyle = { width: '100%', margin: '0 auto', padding: '0' };
const backBtn = { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', fontWeight: 'bold' };
const summaryCard = { background: '#fff', borderRadius: '30px', padding: '40px', border: '1px solid #eee', boxShadow: '0 15px 40px rgba(0,0,0,0.05)' };
const title = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.8rem', margin: '0 0 10px 0', color: '#3d2b1f', fontWeight: '900' };
const subTitle = { fontSize: '1rem', color: '#64748b', marginBottom: '30px' };
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' };
const infoBox = { background: '#fcfaf7', padding: '20px', borderRadius: '20px', border: '1px solid #f0e6d2' };
const label = { fontSize: '0.8rem', color: '#948b83', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' };
const dateList = { display: 'flex', flexWrap: 'wrap', gap: '8px' };
const dateTag = { background: '#3d2b1f', color: '#fff', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold' };
const countNum = { fontSize: '2.5rem', fontWeight: '900', color: '#c5a059' };
const residentPreview = { background: '#fff', border: '1px solid #eee', borderRadius: '20px', padding: '20px', marginBottom: '40px' };
const smallTitle = { margin: '0 0 15px 0', fontSize: '0.9rem', color: '#3d2b1f' };
const previewScroll = { 
  maxHeight: '600px', // 🚀 修正：高さを大幅にアップ（約3倍）
  minHeight: '350px', // 🚀 追加：最低限の高さ
  overflowY: 'auto',
  paddingRight: '12px',
  borderBottom: '1px solid #f8fafc'
};
const pRow = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc' };
const pName = { fontWeight: 'bold', color: '#334155' };
const pMenu = { color: '#c5a059', fontWeight: 'bold', fontSize: '0.9rem' };
const finalBtn = (loading) => ({ width: '100%', padding: '25px', borderRadius: '20px', border: 'none', background: loading ? '#ccc' : '#3d2b1f', color: '#fff', fontSize: '1.2rem', fontWeight: '900', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', boxShadow: '0 10px 25px rgba(61,43,31,0.2)' });
// 🚀 追加：予約画面用のミニソートタブ
const miniSortTabStyle = (active) => ({
  padding: '4px 10px',
  borderRadius: '6px',
  fontSize: '0.65rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  border: 'none',
  background: active ? '#fff' : 'transparent',
  color: active ? '#3d2b1f' : '#64748b',
  boxShadow: active ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
  transition: '0.2s'
});

// 🚀 追加：グループ見出しのスタイル
const bookingGroupHeader = {
  fontSize: '0.8rem',
  fontWeight: '900',
  color: '#c5a059',
  padding: '15px 5px 8px',
  borderBottom: '2px solid #f1f5f9', // 線を少し太く
  marginBottom: '8px',
  background: '#fff',
  position: 'sticky', // 🚀 追加：スクロールしても階数が見えるように
  top: 0,
  zIndex: 1
};

// 🚀 追加：部屋番号バッジ
const pRoomBadge = {
  fontSize: '0.75rem',      // 🚀 少し大きくしました
  background: '#f1f5f9',
  color: '#475569',         // 🚀 文字色を少し濃くして視認性アップ
  padding: '3px 8px',
  borderRadius: '6px',
  fontWeight: '900',        // 🚀 太字に
  minWidth: '55px',         // 🚀 幅を固定（101号室なども綺麗に収まる）
  textAlign: 'center',
  display: 'inline-block'
};
export default FacilityBooking_PC;