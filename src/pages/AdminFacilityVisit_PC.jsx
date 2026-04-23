import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // 💡 階層が一つ浅くなったので ../ に修正
import { 
  ArrowLeft, CheckCircle2, Clock, XCircle, 
  Building2, Loader2, CheckCircle, Calculator, ReceiptText,
  Plus,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
const getKanaGroup = (kana) => {
  if (!kana) return "その他";
  const firstChar = kana.charAt(0);
  if (firstChar.match(/[あ-おア-オ]/)) return "あ行";
  if (firstChar.match(/[か-こカ-コ]/)) return "か行";
  if (firstChar.match(/[さ-そサ-ソ]/)) return "さ行";
  if (firstChar.match(/[た-とタ-ト]/)) return "た行";
  if (firstChar.match(/[な-のナ-ノ]/)) return "な行";
  if (firstChar.match(/[は-ほハ-ホ]/)) return "は行";
  if (firstChar.match(/[ま-もマ-モ]/)) return "ま行";
  if (firstChar.match(/[や-よヤ-ヨ]/)) return "や行";
  if (firstChar.match(/[ら-ろラ-ロ]/)) return "ら行";
  if (firstChar.match(/[わ-をワ-ヲ]/)) return "わ行";
  return "その他";
};

// 見出し札のデザイン
const groupHeaderStyle = {
  padding: '15px 10px 5px',
  fontSize: '0.9rem',
  fontWeight: '900',
  color: '#4f46e5',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  borderBottom: '2px solid #e0e7ff',
  marginBottom: '10px',
  background: 'linear-gradient(to right, #fff, #f8fafc)',
  position: 'sticky',
  top: 0,
  zIndex: 2
};

const AdminFacilityVisit_PC = () => {
  const { shopId, visitId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState(null);
  const [residents, setResidents] = useState([]);
  const [shopData, setShopData] = useState(null);

  const [message, setMessage] = useState('');
  const showMsg = (txt) => { setMessage(txt); setTimeout(() => setMessage(''), 3000); };

  // 🆕 追加：入居者追加ポップアップ用
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [sortMode, setSortMode] = useState('name');
  const [lastVisits, setLastVisits] = useState({});

  // 🆕 メインの名簿リスト用の並び替え設定
  const [listSortMode, setListSortMode] = useState('floor');

  // 🆕 ここから差し込む！！ ==========================================
  const [showSubMenuModal, setShowSubMenuModal] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(null); // { residentId, service }
  // 🏢 ここまで ======================================================

  // 🆕 🚀 ここから追加！！ ==========================================
  const [showMenuSelector, setShowMenuSelector] = useState(false); // 全メニュー選択画面用
  const [targetResident, setTargetResident] = useState(null);      // 変更対象の入居者

  // ボタンが押された時の処理
  const handleMenuClick = async (residentId, service) => {
    // 💡 枝メニューの中から「このメニュー用」かつ「管理者専用」のものがあるか探す
    const adminOptions = (options || []).filter(opt => 
      opt.service_id === service.id && opt.is_admin_only === true
    );

    if (adminOptions.length > 0) {
      // 枝メニューがあれば、一旦ポップアップへ
      setPendingSelection({ residentId, service, adminOptions });
      setShowSubMenuModal(true);
    } else {
      // なければ、これまでの通り親メニュー名で即更新
      updateResidentMenu(residentId, service.name);
    }
  };

  // ✅ 追記：実際のデータベース更新を実行する関数
  const updateResidentMenu = async (residentId, finalMenuName) => {
    const { error } = await supabase
      .from('visit_request_residents')
      .update({ menu_name: finalMenuName })
      .eq('id', residentId);

    if (!error) {
      setResidents(prev => prev.map(r => r.id === residentId ? { ...r, menu_name: finalMenuName } : r));
      setShowSubMenuModal(false);
    } else {
      alert("更新に失敗しました。");
    }
  };

  // 🆕 追加：売上計算用
  const [services, setServices] = useState([]); 
  const [options, setOptions] = useState([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  useEffect(() => { fetchData(); }, [visitId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. 訪問情報の取得
      const { data: vData } = await supabase
        .from('visit_requests')
        .select('*, facility_users(facility_name), profiles(*)')
        .eq('id', visitId)
        .single();

      if (vData) {
        setVisit(vData);
        setShopData(vData.profiles);

        // 🆕 名簿を読み込む先のIDを決定（親がいれば親のID、いなければ自分）
        const targetIdForResidents = vData.parent_id || vData.id;

        // 💡 2. 入居者名簿と進捗の取得（ここを追記！）
        const { data: rData } = await supabase
          .from('visit_request_residents')
          .select('*, members(name, kana, room, floor)') // 👈 ここに furigana を追加！
          .eq('visit_request_id', targetIdForResidents);
        setResidents(rData || []);

        // 🆕 🚀 ここから：前回訪問日を取得するロジックを追加！！ ==================
        if (rData && rData.length > 0) {
          const memberIds = rData.map(r => r.member_id);
          const { data: pastRecords } = await supabase
            .from('visit_request_residents')
            .select('member_id, completed_at')
            .in('member_id', memberIds)
            .eq('status', 'completed')
            .lt('completed_at', `${vData.scheduled_date}T00:00:00Z`) // 今回より前の記録だけ
            .order('completed_at', { ascending: false });

          // メンバーごとに最新の完了日をマッピング
          const visitMap = {};
          pastRecords?.forEach(rec => {
            if (!visitMap[rec.member_id]) {
              visitMap[rec.member_id] = rec.completed_at;
            }
          });
          setLastVisits(visitMap);
        }
        // 🏢 ここまで ======================================================

        // 💡 3. サービスマスター（単価）を取得
        const { data: cData } = await supabase
          .from('service_categories')
          .select('name, is_facility_only')
          .eq('shop_id', shopId);
        const facilityCatNames = cData?.filter(c => c.is_facility_only).map(c => c.name) || [];

        // 💡 4. サービスマスターを取得し、施設用メニューのみに絞り込む
        const { data: sData } = await supabase
          .from('services')
          .select('*')
          .eq('shop_id', shopId);
        
        // 施設訪問画面なので、施設専用カテゴリに属するメニューだけに限定する
        const facilityServices = sData?.filter(s => facilityCatNames.includes(s.category)) || [];
        setServices(facilityServices);

        // 🆕 枝メニューも一緒に取得しておく
        const { data: oData } = await supabase.from('service_options').select('*');
        setOptions(oData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🔄 🆕 ステータス切り替え ＆ 枝メニュー判定ロジック
  const handleToggleStatus = async (res) => {
    const currentStatus = res.status;
    const nextStatus = currentStatus === 'pending' ? 'completed' : 
                       currentStatus === 'completed' ? 'cancelled' : 'pending';

    if (nextStatus === 'completed') {
      // 💡 🚀 修正：メニュー名の中に「枝メニュー設定」を持つサービスが含まれているか探す
      const serviceWithAdminOptions = services.find(s => 
        res.menu_name?.includes(s.name) && 
        options.some(opt => opt.service_id === s.id && opt.is_admin_only === true)
      );
      
      if (serviceWithAdminOptions) {
        const adminOptions = (options || []).filter(opt => 
          opt.service_id === serviceWithAdminOptions.id && opt.is_admin_only === true
        );

        // 💡 🚀 ここが重要： originalMenuName として元の名前（例：カット・カラー）を保存する
        setPendingSelection({ 
          residentId: res.id, 
          service: serviceWithAdminOptions, 
          adminOptions,
          originalMenuName: res.menu_name 
        });
        setShowSubMenuModal(true);
        return;
      }
    }

    executeStatusUpdate(res.id, nextStatus);
  };

  // 🛠️ 🆕 実際のデータベース更新を実行する共通関数
  const executeStatusUpdate = async (residentId, status, finalMenuName = null) => {
    const updateData = { 
      status: status, 
      updated_at: new Date().toISOString() 
    };

    // 完了時は画面の日付に合わせる
    if (status === 'completed') {
      updateData.completed_at = `${visit.scheduled_date}T12:00:00Z`;
    } else {
      updateData.completed_at = null;
    }

    // 枝メニューから選ばれた場合はメニュー名も更新対象に入れる
    if (finalMenuName) {
      updateData.menu_name = finalMenuName;
    }

    const { error } = await supabase.from('visit_request_residents').update(updateData).eq('id', residentId);
    if (!error) {
      setResidents(prev => prev.map(r => r.id === residentId ? { ...r, ...updateData } : r));
      setShowSubMenuModal(false);
    }
  }; // 👈 executeStatusUpdate の終わり

  // 🆕 ここから復活！！ ==========================================
  // 1. 追加可能な入居者を取得してモーダルを開く
  const openAddModal = async () => {
    if (!visit?.facility_user_id) return;
    const currentMemberIds = residents.map(r => r.member_id);
    const { data: members, error } = await supabase
      .from('members')
      .select('*')
      .eq('facility_user_id', visit.facility_user_id)
      .order('name');

    if (!error) {
      const filtered = members.filter(m => !currentMemberIds.includes(m.id));
      setAvailableMembers(filtered);
      setShowAddModal(true);
    }
  };

  // 2. 選んだ人を今日の施術リストに挿入する
  const handleAddMember = async (member) => {
    setIsAdding(true);
    const targetId = visit.parent_id || visit.id;
    const newResident = {
      visit_request_id: targetId,
      member_id: member.id,
      status: 'pending',
      menu_name: 'カット' 
    };

    const { data, error } = await supabase
      .from('visit_request_residents')
      .insert([newResident])
      .select('*, members(name, room, floor)')
      .single();

    if (!error && data) {
      setResidents([...residents, data]);
      setShowAddModal(false);
    } else {
      console.error("Insert Error:", error);
      alert("追加に失敗しました。");
    }
    setIsAdding(false);
  };
  // 🏢 ここまで復活！！ ==========================================

  // 1. 本日の売上を計算（親の基本料金 ＋ 枝の追加料金を合計）
  const calculateTodayTotal = () => {
    const todayStr = visit?.scheduled_date;
    
    return residents
      .filter(r => r.status === 'completed' && r.completed_at?.startsWith(todayStr))
      .reduce((sum, res) => {
        // 💡 文字列から「親メニュー名」と「枝メニュー名」を分離する（例：カラー（リタッチ） -> カラー と リタッチ）
        const match = res.menu_name?.match(/^(.+?)（(.+?)）$/);
        const parentName = match ? match[1].trim() : res.menu_name?.trim();
        const optionName = match ? match[2].trim() : null;

        // ① 親の基本料金を探す
        const master = services.find(s => s.name?.trim() === parentName);
        const basePrice = Number(master?.price) || 0;

        // ② 枝の追加料金を探す（もしあれば）
        let extraPrice = 0;
        if (optionName && master) {
          const opt = options.find(o => o.service_id === master.id && o.option_name === optionName);
          extraPrice = Number(opt?.additional_price) || 0;
        }

        return sum + basePrice + extraPrice;
      }, 0);
  };

  // 2. 確定ボタンを押した時の処理
  const handleFinalizeSales = () => {
    const total = calculateTodayTotal();
    if (total === 0) {
      alert("今日完了した施術がありません。名簿を「完了」にしてから確定してください。");
      return;
    }
    // 💡 window.confirm は廃止して、自作モーダルを開く！
    setShowFinalizeModal(true);
  };

  // 🚀 🆕 追加：パスワード不要で、モーダルから呼ばれる本当の確定処理
  const executeFinalizeSales = async () => {
    const total = calculateTodayTotal();
    const todayStr = visit?.scheduled_date;

    const targetDateMembers = residents
      .filter(r => r.status === 'completed' && r.completed_at?.startsWith(todayStr))
      .map(r => {
        const match = r.menu_name?.match(/^(.+?)（(.+?)）$/);
        const parentName = match ? match[1].trim() : r.menu_name?.trim();
        const optionName = match ? match[2].trim() : null;
        const master = services.find(s => s.name?.trim() === parentName);
        const basePrice = Number(master?.price) || 0;
        let extraPrice = 0;
        if (optionName && master) {
          const opt = options.find(o => o.service_id === master.id && o.option_name === optionName);
          extraPrice = Number(opt?.additional_price) || 0;
        }
        return { name: r.members?.name, floor: r.members?.floor, menu: r.menu_name, price: basePrice + extraPrice };
      });

    setIsFinalizing(true);
    try {
      let customerId = null;
      const facilityName = visit?.facility_users?.facility_name;
      const { data: existingCust } = await supabase.from('customers').select('id').eq('shop_id', shopId).eq('name', facilityName).maybeSingle();
      if (existingCust) { customerId = existingCust.id; } else {
        const { data: newCust, error: cErr } = await supabase.from('customers').insert([{ shop_id: shopId, name: facilityName, memo: '施設訪問（自動登録）' }]).select().single();
        if (cErr) throw cErr;
        customerId = newCust.id;
      }

      const { error: saleError } = await supabase.from('sales').upsert([{
        shop_id: shopId, visit_request_id: visitId, customer_id: customerId, total_amount: total, sale_date: visit.scheduled_date,
        details: { is_facility: true, residents_count: targetDateMembers.length, members_list: targetDateMembers }
      }], { onConflict: 'visit_request_id' });

      if (saleError) throw saleError;
      await supabase.from('visit_requests').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', visitId);

      // 🚀 🆕 修正：モーダルを閉じてから、感謝のメッセージを出す！
      setShowFinalizeModal(false); 
      showMsg("本日の全データを台帳に記録しました！お疲れ様でした✨");
      
      // メッセージを出す時間を少し待ってから一覧に戻る
      setTimeout(() => navigate(-1), 2000);

    } catch (err) {
      alert("確定失敗: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  // --- 🆕 追加ここまで ---

  const themeColor = shopData?.theme_color || '#4f46e5';

  if (loading) return <div style={centerStyle}><Loader2 className="animate-spin" /> 読込中...</div>;

  // 🚀 🆕 修正：今日の状況を正確に把握するための計算
  const todayStr = visit?.scheduled_date;

  // ① 全体の累計完了数（前回まで＋今日）
  const totalCumulativeDone = residents.filter(r => r.status === 'completed').length;

  // ② 前日までに終わっている人数
  const pastDoneCount = residents.filter(r => 
    r.status === 'completed' && r.completed_at && !r.completed_at?.startsWith(todayStr)
  ).length;

  // ③ 「今日＋今後」の残り予定総数（55 - 13 = 42）
  const remainingWorkload = residents.length - pastDoneCount;

  // ④ 今日この現場で完了させた人数
  const todayDoneCount = residents.filter(r => 
    r.status === 'completed' && r.completed_at?.startsWith(todayStr)
  ).length;

  // 今日の進捗率（今日の残り分に対して何％終わったか）
  const progress = remainingWorkload > 0 ? (todayDoneCount / remainingWorkload) * 100 : 0;

  return (
    <div style={containerStyle}>
      {/* 🚀 🆕 追加：通知メッセージを画面中央にふわっと出す設定 */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            style={{ 
              position: 'fixed', top: '20px', left: '50%', 
              background: '#10b981', color: '#fff', padding: '15px 30px', 
              borderRadius: '50px', zIndex: 10000, fontWeight: 'bold',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)', pointerEvents: 'none'
            }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
      {/* 固定ヘッダー */}
      <header style={headerStyle}>
        <button onClick={() => navigate(-1)} style={backBtn}>
          <ArrowLeft size={20} /> 戻る
        </button>
        <div style={titleGroup}>
          <div style={facilityLabel}><Building2 size={16} /> 施設訪問・本日のタスク</div>
          <h2 style={facilityName}>{visit?.facility_users?.facility_name} 様</h2>
          <p style={dateText}>{visit?.scheduled_date?.replace(/-/g, '/')} 訪問分</p>
        </div>
      </header>

      {/* 進捗サマリーカード */}
      <div style={statsCard}>
        <div style={statsInfo}>
          <div>
            <span style={statsLabel}>本日の完了状況</span>
            {/* 🚀 🆕 累計を補足として追加 */}
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', marginTop: '2px' }}>
              累計完了：{totalCumulativeDone}名 / 全体：{residents.length}名
            </div>
          </div>
          <span style={statsValue}>
            {todayDoneCount} 
            <small style={{ fontSize: '0.9rem', color: '#94a3b8' }}> / {remainingWorkload} 名</small>
          </span>
        </div>
        <div style={progressBg}>
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${progress}%` }} 
            style={progressBar(themeColor)} 
          />
        </div>
      </div>

      {/* 🆕 売上確定・締めカード */}
      <div style={finalizeCard}>
        <div style={finalizeHeader}>
          <ReceiptText size={18} color="#4f46e5" />
          <span style={finalizeTitle}>本日の計上予定</span>
        </div>
        <div style={finalizeAmount}>
          ¥ {calculateTodayTotal().toLocaleString()}
        </div>
        {/* 🚀 🆕 修正：ここを「todayDoneCount」に変更して「本日完了」に書き換え */}
        <p style={finalizeNote}>※ 本日完了 {todayDoneCount} 名分の合計額</p>
        
        <button 
          onClick={handleFinalizeSales} 
          disabled={isFinalizing || todayDoneCount === 0}
          style={finalizeBtn(isFinalizing || todayDoneCount === 0)}
        >
          {isFinalizing ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
          {isFinalizing ? '処理中...' : '本日のタスクを終了'}
        </button>
      </div>

      {/* 🆕 ここから差し込む！！ ========================================== */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end', padding: '0 5px' }}>
        <button 
          onClick={openAddModal}
          style={{ 
            padding: '10px 18px', background: '#fff', color: '#4f46e5', 
            border: '2px solid #4f46e5', borderRadius: '14px', fontWeight: 'bold', 
            fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.1)'
          }}
        >
          <Plus size={18} strokeWidth={3} /> 追加
        </button>
      </div>
      {/* 🏢 ここまで ====================================================== */}

      {/* 利用者ポチポチリスト */}
      <div style={listContainer}>
        {residents.length === 0 ? (
          <div style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>名簿が登録されていません。</div>
        ) : (() => {
          // ✅ 1. 今開いている「訪問予定日」を取得 (例: "2026-03-19")
          const todayStr = visit?.scheduled_date; 
          
          // ✅ 2. 「本日の施術対象」と「他日程で完了済み」に仕分ける
          // 本日分：未完了の人、または「今日完了させた人」
          const todayResidents = residents.filter(r => 
            r.status !== 'completed' || (r.status === 'completed' && r.completed_at?.startsWith(todayStr))
          );

          // 別日分：ステータスが完了で、かつ「完了日が今日ではない」人
          const pastResidents = residents.filter(r => 
            r.status === 'completed' && r.completed_at && !r.completed_at?.startsWith(todayStr)
          );

          // ✅ 修正：ふりがなと階数をより厳密に比較するロジック
          const sortedTodayResidents = [...todayResidents].sort((a, b) => {
            const memberA = a.members || {};
            const memberB = b.members || {};
            
            // ふりがな(kana)を基準にする
            const kanaA = (memberA.kana || memberA.name || "").trim();
            const kanaB = (memberB.kana || memberB.name || "").trim();

            if (listSortMode === 'floor') {
              // --- 階数順 ---
              const fA = parseInt(String(memberA.floor).replace(/[^0-9]/g, '')) || 999;
              const fB = parseInt(String(memberB.floor).replace(/[^0-9]/g, '')) || 999;
              if (fA !== fB) return fA - fB;
              return kanaA.localeCompare(kanaB, 'ja');
            } else {
              // --- あいうえお順 ---
              return kanaA.localeCompare(kanaB, 'ja');
            }
          });
          // ==================================================================

          return (
            <>
              {/* 🆕 並び替え切り替えボタンの設置 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', justifyContent: 'center' }}>
                <button 
                  onClick={() => setListSortMode('floor')}
                  style={sortTabStyle(listSortMode === 'floor')}
                >
                  階数順
                </button>
                <button 
                  onClick={() => setListSortMode('name')}
                  style={sortTabStyle(listSortMode === 'name')}
                >
                  あいうえお順
                </button>
              </div>
              {/* --- A. 本日の施術リスト（タップ可能・通常デザイン） --- */}
              {(() => {
                let lastLabel = ""; // 🚀 直前のグループ名を一時保存する変数

                return sortedTodayResidents.map((res) => {
                  // 🚀 1. 現在表示すべき見出し（階数 or あいうえお）を決定
                  let currentLabel = "";
                  if (listSortMode === 'floor') {
                    currentLabel = res.members?.floor ? (String(res.members.floor).includes('F') ? res.members.floor : `${res.members.floor}F`) : "階数未設定";
                  } else {
                    currentLabel = getKanaGroup(res.members?.kana);
                  }

                  // 🚀 2. 直前の人とグループが変わったか判定
                  const isNewGroup = currentLabel !== lastLabel;
                  lastLabel = currentLabel;

                  return (
                    <React.Fragment key={res.id}>
                      {/* 🚀 3. グループが変わった瞬間にだけ見出しを表示 */}
                      {isNewGroup && (
                        <div style={groupHeaderStyle}>
                          {currentLabel}
                        </div>
                      )}

                      <motion.div 
                        key={res.id} 
                        onClick={() => handleToggleStatus(res)}
                        whileTap={{ scale: 0.97 }}
                        style={resCard(res.status)}
                      >
                        <div style={resLeft}>
                          {/* 階数表示 */}
                          <div style={{
                            background: '#e0e7ff', color: '#4f46e5', padding: '6px 10px', 
                            borderRadius: '10px', fontSize: '0.8rem', fontWeight: '900', 
                            minWidth: '40px', textAlign: 'center', border: '1px solid #c7d2fe'
                          }}>
                            {res.members?.floor ? (String(res.members.floor).includes('F') ? res.members.floor : `${res.members.floor}F`) : '--'}
                          </div>

                          <div>
  {/* 🚀 🆕 名前と前回日付を横並びにするコンテナ */}
  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
    <div style={resName}>{res.members?.name} 様</div>
    
    {/* 🚀 🆕 前回訪問日をここに移動 */}
    {lastVisits[res.member_id] && (
      <span style={{ 
        fontSize: '0.7rem', color: '#94a3b8', 
        fontWeight: 'normal', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px',
        border: '1px solid #e2e8f0'
      }}>
        前回: {new Date(lastVisits[res.member_id]).getMonth() + 1}月{new Date(lastVisits[res.member_id]).getDate()}日
      </span>
    )}
  </div>
  
  {/* ふりがな（これは名前のすぐ下で見やすく維持） */}
  <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>
    {res.members?.kana || "⚠️ふりがな未登録"}
  </div>
                            
                            {/* メニュー名の表示 */}
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetResident(res);
                                setShowMenuSelector(true);
                              }}
                              style={{
                                marginTop: '8px',
                                padding: '6px 14px',
                                background: res.status === 'completed' ? '#10b981' : '#004e26',
                                color: '#fff',
                                borderRadius: '10px',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                cursor: 'pointer'
                              }}
                            >
                              {res.menu_name}
                              <Edit2 size={12} style={{ opacity: 0.9 }} />
                            </div>
                          </div>
                        </div>

                        <div style={statusBadge(res.status)}>
                          {res.status === 'completed' ? (
                            <div style={{color:'#10b981', display:'flex', alignItems:'center', gap:'4px'}}>
                              <CheckCircle2 size={20} /> <span style={{fontSize:'0.85rem'}}>完了</span>
                            </div>
                          ) : res.status === 'cancelled' ? (
                            <div style={{color:'#ef4444', display:'flex', alignItems:'center', gap:'4px'}}>
                              <XCircle size={20} /> <span style={{fontSize:'0.85rem'}}>中止</span>
                            </div>
                          ) : (
                            <div style={{color:'#cbd5e1', display:'flex', alignItems:'center', gap:'4px'}}>
                              <Clock size={20} /> <span style={{fontSize:'0.85rem'}}>待機</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                });
              })()}

              {/* --- B. 別日完了済みリスト（タップ不可・灰色デザイン） --- */}
              {pastResidents.length > 0 && (
                <div style={{ marginTop: '40px', borderTop: '2px dashed #cbd5e1', paddingTop: '20px' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    🔒 他の日程で完了済み（変更できません）
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pastResidents.map((res) => {
                      // 完了日（2026-03-18等）を見やすく整形
                      const finishDate = res.completed_at ? res.completed_at.split('T')[0].replace(/-/g, '/') : '';
                      return (
                        <div 
                          key={res.id} 
                          style={{ 
                            ...resCard('completed'), 
                            opacity: 0.5, 
                            background: '#f1f5f9', // 灰色背景
                            borderColor: '#cbd5e1',
                            filter: 'grayscale(1)',   // 全てを白黒に
                            cursor: 'not-allowed',  // 禁止マークのカーソル
                            pointerEvents: 'none',   // 物理的にタップを無効化
                            userSelect: 'none'
                          }}
                        >
                          <div style={resLeft}>
                            <div style={{ ...roomTag, background: '#cbd5e1', color: '#64748b' }}>済</div>
                            <div>
                              <div style={{ ...resName, color: '#64748b' }}>{res.members?.name} 様</div>
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{res.menu_name}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', textAlign: 'right' }}>
                            {finishDate}<br />完了済み ✓
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      <footer style={footerStyle}>
        <button onClick={() => navigate(-1)} style={finishBtn}>
          一時中断して戻る
        </button>
      </footer>

      {/* 🆕 ここから差し込む！！ ========================================== */}
      <AnimatePresence>
        {showAddModal && (
          <div 
            style={{ 
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', 
              zIndex: 1000, display: 'flex', alignItems: 'flex-end', 
              backdropFilter: 'blur(4px)' 
            }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
              style={{ 
                background: '#fff', width: '100%', borderTopLeftRadius: '32px', 
                borderTopRightRadius: '32px', padding: '32px 24px', 
                maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 -10px 25px rgba(0,0,0,0.1)'
              }}
            >
              {/* ヘッダー部分 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>追加する方を選択</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>名簿に未登録の方のみ表示されています</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)} 
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <XCircle size={24} color="#94a3b8" />
                </button>
              </div>

              {/* メンバーリスト */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                  onClick={() => setSortMode('name')}
                  style={{ 
                    flex: 1, padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', border: 'none',
                    background: sortMode === 'name' ? '#4f46e5' : '#f1f5f9',
                    color: sortMode === 'name' ? '#fff' : '#64748b', cursor: 'pointer'
                  }}
                >
                  あいうえお順
                </button>
                <button 
                  onClick={() => setSortMode('room')}
                  style={{ 
                    flex: 1, padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', border: 'none',
                    background: sortMode === 'room' ? '#4f46e5' : '#f1f5f9',
                    color: sortMode === 'room' ? '#fff' : '#64748b', cursor: 'pointer'
                  }}
                >
                  階数順
                </button>
              </div>

              {/* メンバーリスト */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '40px' }}>
                {availableMembers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc', borderRadius: '20px' }}>
                    追加可能なメンバーは全員リストに入っています。
                  </div>
                ) : (
                  (() => {
                    let lastLabel = ""; // 🚀 直前のグループ名を記憶する変数

                    // 1. まず、指定されたモードで並び替えを実行
                    const sortedList = [...availableMembers].sort((a, b) => {
                      if (sortMode === 'room') {
                        // 【階数順】
                        const fA = parseInt(String(a.floor).replace(/[^0-9]/g, '')) || 999;
                        const fB = parseInt(String(b.floor).replace(/[^0-9]/g, '')) || 999;
                        if (fA !== fB) return fA - fB;
                        return (a.room || "").localeCompare(b.room || "", undefined, { numeric: true });
                      } else {
                        // 【あいうえお順】🚀 修正：必ず kana（ふりがな）を使って比較する
                        const kanaA = (a.kana || a.name || "").trim();
                        const kanaB = (b.kana || b.name || "").trim();
                        return kanaA.localeCompare(kanaB, 'ja');
                      }
                    });

                    // 2. ループを回して「見出し札」を挟みながら表示
                    return sortedList.map((m) => {
                      // 🚀 現在のラベルを決定（階数 or あ行）
                      let currentLabel = "";
                      if (sortMode === 'room') {
                        currentLabel = m.floor ? (String(m.floor).includes('F') ? m.floor : `${m.floor}F`) : "階数未設定";
                      } else {
                        currentLabel = getKanaGroup(m.kana);
                      }

                      // 🚀 グループが変わったか判定
                      const isNewGroup = currentLabel !== lastLabel;
                      lastLabel = currentLabel;

                      return (
                        <React.Fragment key={m.id}>
                          {/* 🚀 グループ見出しを表示 */}
                          {isNewGroup && (
                            <div style={groupHeaderStyle}>
                              {currentLabel}
                            </div>
                          )}

                          <button 
                            onClick={() => handleAddMember(m)}
                            disabled={isAdding}
                            style={{ 
                              width: '100%', padding: '20px', borderRadius: '20px', 
                              border: '1px solid #e2e8f0', background: '#fff', 
                              textAlign: 'left', display: 'flex', justifyContent: 'space-between', 
                              alignItems: 'center', cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                              marginTop: '4px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <div style={{ background: '#e0e7ff', color: '#4f46e5', width: '45px', height: '45px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.8rem' }}>
                                {m.room}
                              </div>
                              <div>
                                <div style={{ fontWeight: '900', fontSize: '1.1rem', color: '#1e293b' }}>{m.name} 様</div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                  {m.kana ? `${m.kana} / ` : ''}{m.floor ? `${m.floor}階` : '階数未設定'}
                                </div>
                              </div>
                            </div>
                            <div style={{ background: '#4f46e5', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Plus size={20} color="#fff" />
                            </div>
                          </button>
                        </React.Fragment>
                      );
                    });
                  })()
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* 🏢 ここまでが詳細選択（リタッチ等）ポップアップ */}

      {/* 🆕 🚀 ここから追加：全メニュー選択ポップアップ ======================== */}
      <AnimatePresence>
        {showSubMenuModal && pendingSelection && (
          <div 
            style={{ 
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', 
              zIndex: 2000, display: 'flex', alignItems: 'center', 
              justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' 
            }}
            onClick={() => setShowSubMenuModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ 
                background: '#fff', width: '100%', maxWidth: '400px', 
                borderRadius: '32px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' 
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', textAlign: 'center', fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>
                詳細を選択
              </h3>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', marginBottom: '24px' }}>
                「{pendingSelection.service.name}」の内容を選んでください
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingSelection.adminOptions.map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => executeStatusUpdate(
                      pendingSelection.residentId, 
                      'completed', 
                      /* 💡 🚀 ここを修正しました！ service.name ではなく originalMenuName を使う */
                      `${pendingSelection.originalMenuName}（${opt.option_name}）`
                    )}
                    style={{ 
                      padding: '18px', borderRadius: '16px', border: '2px solid #e2e8f0', 
                      background: '#f8fafc', fontSize: '1rem', fontWeight: 'bold', 
                      color: '#1e293b', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <span>{opt.option_name}</span>
                    {opt.additional_price > 0 && <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>+¥{opt.additional_price.toLocaleString()}</span>}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setShowSubMenuModal(false)}
                style={{ width: '100%', marginTop: '16px', padding: '12px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 🆕 ここから追加：全メニュー選択ポップアップ */}
      <AnimatePresence>
        {showMenuSelector && targetResident && (
          <div 
            style={{ 
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', 
              zIndex: 3000, display: 'flex', alignItems: 'flex-end', 
              backdropFilter: 'blur(4px)' 
            }}
            onClick={() => setShowMenuSelector(false)}
          >
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
              style={{ 
                background: '#fff', width: '100%', borderTopLeftRadius: '32px', 
                borderTopRightRadius: '32px', padding: '32px 24px', 
                maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 -10px 25px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>メニューを変更</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  {targetResident.members?.name} 様のメニューを選んでください
                </p>
              </div>

              {/* 施設用メニューの一覧を表示（2列タイル） */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {services.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      // 💡 管理者専用の「枝メニュー」があるか判定
                      const adminOptions = options.filter(opt => opt.service_id === s.id && opt.is_admin_only);
                      
                      if (adminOptions.length > 0) {
                        // 枝があれば詳細選択ポップアップ（リタッチ等）へバトンタッチ
                        setPendingSelection({ 
                          residentId: targetResident.id, 
                          service: s, 
                          adminOptions, 
                          originalMenuName: s.name 
                        });
                        setShowMenuSelector(false);
                        setShowSubMenuModal(true);
                      } else {
                        // 枝がなければこのままメニュー名を更新して終了
                        updateResidentMenu(targetResident.id, s.name);
                        setShowMenuSelector(false);
                      }
                    }}
                    style={{
                      padding: '20px 10px', borderRadius: '18px', border: '1px solid #e2e8f0',
                      background: targetResident.menu_name.includes(s.name) ? `${themeColor}15` : '#f8fafc',
                      color: targetResident.menu_name.includes(s.name) ? themeColor : '#1e293b',
                      fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer'
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setShowMenuSelector(false)} 
                style={{ width: '100%', marginTop: '20px', padding: '15px', background: '#f1f5f9', border: 'none', borderRadius: '15px', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 🆕 ここから「今風」の売上確定確認モーダルを追加 */}
      <AnimatePresence>
        {showFinalizeModal && (
          <div style={overlayStyle} onClick={() => setShowFinalizeModal(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
              style={{ 
                background: '#fff', 
                width: '90%', 
                maxWidth: '400px', 
                borderRadius: '32px', 
                padding: '35px', 
                textAlign: 'center', 
                boxShadow: '0 25px 50px rgba(0,0,0,0.2)' 
              }}
            >
              {/* アイコン部分 */}
              <div style={{ background: '#f5f3ff', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <ReceiptText size={35} color={themeColor} />
              </div>

              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>
                本日の締め処理
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6', marginBottom: '25px' }}>
                {visit?.facility_users?.facility_name} 様<br />
                本日の施術データを確定し、<br />売上台帳へ記録してもよろしいですか？
              </p>

              {/* 金額・人数のサマリーパネル */}
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '5px' }}>
                  計上金額（税込）
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#1e293b' }}>
                  ¥ {calculateTodayTotal().toLocaleString()}
                </div>
                <div style={{ fontSize: '0.8rem', color: themeColor, fontWeight: 'bold', marginTop: '5px' }}>
                  完了: {residents.filter(r => r.status === 'completed').length} 名
                </div>
              </div>

              {/* アクションボタン */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={executeFinalizeSales}
                  disabled={isFinalizing}
                  style={{ 
                    width: '100%', padding: '18px', background: themeColor, color: '#fff', 
                    border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1.1rem', 
                    cursor: 'pointer', boxShadow: `0 8px 20px ${themeColor}44` 
                  }}
                >
                  {isFinalizing ? <Loader2 className="animate-spin" /> : '確定して終了する'}
                </button>
                <button 
                  onClick={() => setShowFinalizeModal(false)}
                  style={{ padding: '12px', background: 'none', border: 'none', color: '#94a3b8', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  まだ修正がある（戻る）
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* 🏢 ここまで ====================================================== */}
    </div>
  );
};

// --- スタイル定義（スマホ・タブレットの現場操作に特化） ---
const containerStyle = { maxWidth: '600px', margin: '0 auto', padding: '15px', paddingBottom: '120px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' };
const headerStyle = { marginBottom: '20px' };
const backBtn = { background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', fontSize: '0.9rem' };
const titleGroup = { padding: '0 5px' };
const facilityLabel = { fontSize: '0.7rem', color: '#4f46e5', fontWeight: '900', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', textTransform: 'uppercase' };
const facilityName = { margin: 0, fontSize: '1.6rem', fontWeight: '900', color: '#1e293b' };
const dateText = { margin: '4px 0 0', fontSize: '0.9rem', color: '#64748b', fontWeight: 'bold' };
const statsCard = { background: '#fff', padding: '20px', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', marginBottom: '25px', border: '1px solid #f1f5f9' };
const statsInfo = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' };
const statsLabel = { fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' };
const statsValue = { fontSize: '1.8rem', fontWeight: '900', color: '#1e293b' };
const progressBg = { height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' };
const progressBar = (color) => ({ height: '100%', background: color });
const listContainer = { display: 'flex', flexDirection: 'column', gap: '12px' };
const resCard = (status) => ({ 
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', borderRadius: '20px', 
  background: status === 'completed' ? '#f0fdf4' : status === 'cancelled' ? '#fff' : '#fff',
  border: `2px solid ${status === 'completed' ? '#10b981' : status === 'cancelled' ? '#ef4444' : '#f1f5f9'}`,
  opacity: status === 'cancelled' ? 0.6 : 1, cursor: 'pointer', transition: '0.2s',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
});
const resLeft = { display: 'flex', alignItems: 'center', gap: '15px' };
const roomTag = { background: '#f1f5f9', padding: '6px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '900', color: '#475569', minWidth: '45px', textAlign: 'center', border: '1px solid #e2e8f0' };
const resName = { fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' };
const resMenu = { fontSize: '0.8rem', color: '#64748b', marginTop: '2px', fontWeight: 'bold' };
const statusBadge = (status) => ({ minWidth: '60px', display: 'flex', justifyContent: 'flex-end' });
const footerStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', zIndex: 100 };
const finishBtn = { width: '100%', maxWidth: '400px', padding: '18px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };
const centerStyle = { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#64748b', background: '#f8fafc' };
const finalizeCard = { background: '#f5f3ff', padding: '24px', borderRadius: '28px', border: '2px solid #ddd6fe', marginBottom: '25px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.1)' };
const finalizeHeader = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' };
const finalizeTitle = { fontSize: '0.8rem', fontWeight: 'bold', color: '#6d28d9', letterSpacing: '0.5px' };
const finalizeAmount = { fontSize: '2.4rem', fontWeight: '900', color: '#1e293b', marginBottom: '5px' };
const finalizeNote = { fontSize: '0.75rem', color: '#7c3aed', marginBottom: '15px', fontWeight: 'bold' };
const finalizeBtn = (disabled) => ({ 
  width: '100%', padding: '18px', background: disabled ? '#cbd5e1' : '#4f46e5', 
  color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', 
  fontSize: '1rem', cursor: disabled ? 'default' : 'pointer', 
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', 
  transition: '0.2s', boxShadow: disabled ? 'none' : '0 10px 20px -5px rgba(79, 70, 229, 0.4)' 
});
const sortTabStyle = (active) => ({
  flex: 1,
  maxWidth: '120px',
  padding: '8px 0',
  borderRadius: '10px',
  fontSize: '0.8rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  border: 'none',
  background: active ? '#4f46e5' : '#e2e8f0',
  color: active ? '#fff' : '#64748b',
  transition: '0.2s'
});

const overlayStyle = { 
  position: 'fixed', 
  inset: 0, 
  background: 'rgba(0,0,0,0.7)', 
  zIndex: 5000, 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  backdropFilter: 'blur(8px)' 
};
export default AdminFacilityVisit_PC;