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
      // ✨ 🆕 修正：status が 'pending'（復活分）のものは、DBデータであっても「新規追加（オレンジ色の札）」として扱うようにフラグを出し分ける
      ...dbReservedResidents.map(r => ({ ...r, isFromDB: r.status !== 'pending' })),
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
  useEffect(() => { fetchSummary(); }, [facilityId, sharedDate]);

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
      // 🚀 表示月キーを作成 (例: "2026-05")
      const currentMonthKey = `${year}-${month}`;

      // 1. 基本情報の取得（ドラフト）
      const { data: draftData } = await supabase
        .from('visit_list_drafts')
        .select('*, members(*)')
        .eq('facility_user_id', facilityId)
        .eq('scheduled_month', currentMonthKey);

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
        .select('id, scheduled_date, status, start_time, parent_id')
        .eq('facility_user_id', facilityId)
        .gte('scheduled_date', startOfMonth)
        .lte('scheduled_date', endOfMonth)
        .neq('status', 'canceled');

      // 🚀 🆕 追加：今月すでに予約が確定しているメンバー情報を取得
      const { data: reservedData } = await supabase
        .from('visit_request_residents')
        .select('*, members(*), visit_requests!inner(id, scheduled_date, status, parent_id)')
        .eq('visit_requests.facility_user_id', facilityId)
        .neq('visit_requests.status', 'canceled') // ✅ 【ここを追加！】キャンセルされた日程のメンバーはカウントから除外します
        .gte('visit_requests.scheduled_date', startOfMonth)
        .lte('visit_requests.scheduled_date', endOfMonth);

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
    const list = [];
    
    // 1. 確定済みの日程（変更チェック付き）
    confirmedDates.forEach(cd => {
      const change = manualKeeps.find(k => k.date === cd.scheduled_date);
      const isTimeChanged = change && cd.start_time && change.start_time !== cd.start_time;
      
      list.push({ 
        date: cd.scheduled_date, 
        time: change?.start_time || cd.start_time, 
        originalTime: cd.start_time,
        isTimeChanged,
        type: cd.status 
      });
    });

    // 2. まったく新しいキープ日
    ensuredDates.forEach(ed => {
      if (!list.some(l => l.date === ed.date)) {
        list.push({ ...ed, type: 'new' });
      }
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [ensuredDates, confirmedDates, manualKeeps]);

  // 🚀 🆕 1. 既存の予約に対して「時間の変更」があるか判定
  const hasTimeChanges = useMemo(() => {
    return confirmedDates.some(cd => {
      const keep = manualKeeps.find(k => k.date === cd.scheduled_date);
      // 手動キープがあり、かつ時間が既存の予約と違う場合に true
      return keep && keep.start_time && keep.start_time !== cd.start_time;
    });
  }, [confirmedDates, manualKeeps]);

  // 🚀 🆕 2. 全体として「何かしらの変更」があるか（新規日程 or 新規メンバー or 時間変更）
  const isAnythingChanged = useMemo(() => {
    return ensuredDates.length > 0 || drafts.length > 0 || hasTimeChanges;
  }, [ensuredDates, drafts, hasTimeChanges]);

  const handleFinalSubmit = async () => {
    if (allDisplayVisits.length === 0) return alert("訪問予定日が設定されていません。");
    if (sortedDrafts.length === 0) return alert("施術希望者が選択されていません。");

    setLoading(true);
    try {
      // 🚀 🆕 その月の「マスターID（名簿の親）」を特定します
      let masterRequestId = null;

      // 1. まず既存の予約から、その月の「一番最初の日（parent_idがないもの）」を探す
      const existingMaster = confirmedDates.find(d => !d.parent_id && d.status !== 'canceled');

      // 🚀 🆕 既存予約の開始時間に変更があればDBを更新する
      for (const cd of confirmedDates) {
        const matchingKeep = manualKeeps.find(k => k.date === cd.scheduled_date);
        if (matchingKeep && matchingKeep.start_time && matchingKeep.start_time !== cd.start_time) {
          await supabase.from('visit_requests')
            .update({ start_time: matchingKeep.start_time })
            .eq('id', cd.id);
        }
      }

      // --- パターンA：新しく確保した日程がある場合 ---
      if (ensuredDates.length > 0) {
        let firstNewId = null;
        for (let i = 0; i < ensuredDates.length; i++) {
          const { data: request, error: reqErr } = await supabase
            .from('visit_requests')
            .insert([{
              facility_user_id: facilityId,
              shop_id: shopInfo.id,
              scheduled_date: ensuredDates[i].date,
              start_time: ensuredDates[i].time,
              status: 'confirmed',
              // 💡 既存のマスターがいればそれを、なければ今回の1日目を親にする
              parent_id: existingMaster ? existingMaster.id : firstNewId
            }]).select().single();

          if (reqErr) throw reqErr;
          if (i === 0) firstNewId = request.id;
        }
        // 新しく作った場合、その1日目をマスターとする（既存がなければ）
        masterRequestId = existingMaster ? existingMaster.id : firstNewId;
      } 
      // --- パターンB：既存の枠への追加のみ ---
      else {
        masterRequestId = existingMaster?.id;
      }

      // 🚀 2. 全ての新規メンバー(drafts)を、この「マスターID」に紐付けて一括登録！
      if (drafts.length > 0 && masterRequestId) {
        const residentPayloads = drafts.map(d => ({
          visit_request_id: masterRequestId, // 💡 全員同じ「親」に紐付ける（プール化）
          member_id: d.member_id,
          menu_name: d.menu_name,
          status: 'pending'
        }));

        const { error: resErr } = await supabase.from('visit_request_residents').insert(residentPayloads);
        if (resErr) throw resErr;
      }

      // --- 🚀 3. メール送信ロジックの強化 ---
      
      // ① 今回新しく追加された人のリスト
      const addedListText = drafts.map(d => `・${d.members?.name} 様 (${d.menu_name}) [追加分]`).join('\n');
      
      // ② 既に確定している人のリスト（完了済みかどうかも記載）
      const confirmedListText = dbReservedResidents.map(r => 
        `・${r.members?.name} 様 (${r.menu_name}) ${r.status === 'completed' ? '[施術完了済]' : '[既存予定]'}`
      ).join('\n');

      // ③ 日程リスト（時間変更があればそれも反映されるように）
      const formattedDatesForMail = allDisplayVisits.map(d => 
        `${d.date.replace(/-/g, '/')} (${d.time.substring(0,5)})${d.isTimeChanged ? ' ※時間変更あり' : ''}`
      );

      // ④ 判定：これが「新規」か「追加修正」か
      const isUpdate = dbReservedResidents.length > 0;

      await supabase.functions.invoke('resend', {
        body: {
          // 🚀 🆕 type を条件によって切り替える
          type: isUpdate ? 'facility_booking_update' : 'facility_booking',
          shopName: shopInfo.business_name,
          shopEmail: shopInfo.email_contact,
          facilityName: facilityName,
          facilityFurigana: facilityFurigana,
          facilityEmail: facilityEmail,
          scheduledDates: formattedDatesForMail, 
          residentCount: sortedDrafts.length, // 合計人数
          addedCount: drafts.length,          // 今回追加した人数
          residentListText: `${addedListText}\n\n【全体の名簿（確認用）】\n${confirmedListText}`,
          shopId: shopInfo.id,
          facilityId: facilityId
        }
      });

      // 🚀 お掃除
      const targetDate = (sharedDate && !isNaN(new Date(sharedDate).getTime())) ? new Date(sharedDate) : new Date();
      const targetMonthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

      // ① 今月の名簿下書きをお掃除
      await supabase.from('visit_list_drafts').delete().eq('facility_user_id', facilityId).eq('scheduled_month', targetMonthKey);
      
      // ✨ 🛠️ 修正後：未来の単発キープを巻き添えにしないよう、今確定させた「その月」のキープ日だけを前方一致で狙い撃ちしてお掃除する
      await supabase.from('keep_dates')
        .delete()
        .eq('facility_user_id', facilityId)
        .like('date', `${targetMonthKey}%`); // 例: "2026-07%" で始まるキープ枠だけを安全に消す

      alert(`予約の送信が完了しました！✨`);
      
      // 🚀 🆕 送信完了アラートが閉じられたら、ページ全体を強制リロードして、Portal側のアラートバナーを完全に消去します！
      window.location.reload();
      
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
    background: isCompleted ? '#f1f5f9' : (isConfirmed ? (item.isTimeChanged ? '#0ea5e9' : '#10b981') : '#3d2b1f'),
    color: isCompleted ? '#94a3b8' : '#fff',
  }}
>
  {isCompleted && <CheckCircle2 size={12} />}
  {item.date.replace(/-/g,'/')}
  <small style={{ marginLeft: '4px', opacity: 0.9, fontWeight: '900' }}>
    {item.isTimeChanged ? (
      `(${item.originalTime?.substring(0,5)} ➔ ${item.time.substring(0,5)}に変更)`
    ) : (
      `(${item.time?.substring(0, 5)})`
    )}
  </small>
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
      <div style={bookingGroupHeader}>{currentLabel}</div>
    )}
    
    {/* 🚀 🆕 修正：キャンセル済みなら背景をグレーにし、半透明にするスタイル */}
    <div style={{
      ...pRow,
      opacity: d.status === 'canceled' ? 0.5 : 1, // 半透明
      background: d.status === 'canceled' ? '#f8fafc' : 'transparent', // 薄いグレー背景
      padding: '10px 5px',
      borderRadius: '8px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        
        {/* 🚀 🆕 ステータスバッジを「キャンセル」に対応させる */}
        <span style={{ 
          fontSize: '0.65rem', 
          fontWeight: '900', 
          padding: '2px 6px', 
          borderRadius: '4px',
          background: d.status === 'canceled' ? '#ef4444' : (d.status === 'completed' ? '#94a3b8' : (d.isFromDB ? '#10b981' : '#f59e0b')),
          color: '#fff' 
        }}>
          {d.status === 'canceled' ? 'キャンセル' : (d.status === 'completed' ? '完了' : (d.isFromDB ? '確定済' : '新規追加'))}
        </span>

        <span style={pRoomBadge}>
          {res.room ? res.room : "---"} 
        </span>
        
        {/* 🚀 🆕 キャンセルなら名前に打消し線を引く */}
        <span style={{ 
          ...pName, 
          textDecoration: d.status === 'canceled' ? 'line-through' : 'none',
          color: d.status === 'canceled' ? '#94a3b8' : '#334155'
        }}>
          {res.name} 様
        </span>
      </div>
      <span style={{ ...pMenu, color: d.isFromDB ? '#94a3b8' : '#c5a059' }}>{d.menu_name}</span>
    </div>
  </motion.div>
);
              });
            })()}
          </div>
        </div>

        {/* 🚀 修正：何らかの変更（時間変更含む）があれば、この案内を非表示にする */}
{!isAnythingChanged && (
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
          // 🚀 修正：ローディング中、または「全く変更がない」場合にボタンを無効化
          disabled={loading || !isAnythingChanged} 
          style={{
            ...finalBtn(loading),
            background: (loading || !isAnythingChanged) ? '#ccc' : '#3d2b1f'
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