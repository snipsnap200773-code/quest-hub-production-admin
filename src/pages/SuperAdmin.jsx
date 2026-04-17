import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// 🆕 INDUSTRY_PRESETS を追加して、大・小カテゴリの階層データを使えるようにします
import { INDUSTRY_PRESETS, INDUSTRY_LABELS, getSubCategories } from '../constants/industryMaster';

// ✅ supabase のインポートはここ1回だけにします
import { supabase } from '../supabaseClient';

import { 
  MapPin, Plus, Trash2, Save, Image as ImageIcon, Bell, Search, 
  Filter, Store, UserCheck, ShieldAlert, Copy, ExternalLink, 
  Edit2, PlusSquare, Settings, List, LayoutDashboard, CheckCircle2, XCircle, Send,
  Building2, LogOut
} from 'lucide-react';

// 🗑️ ここにあった「const INDUSTRY_OPTIONS = [...]」は削除しました
// (今後は INDUSTRY_LABELS を使用します)

function SuperAdmin() {
  // 1. フックと状態管理（ここが抜けていました！）
  const navigate = useNavigate(); 
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [inputPass, setInputPass] = useState(''); // パスワード入力用
  const [loading, setLoading] = useState(true);

  // 環境変数
  const MASTER_PASSWORD = import.meta.env.VITE_SUPER_MASTER_PASSWORD; 
  const DELETE_PASSWORD = import.meta.env.VITE_SUPER_DELETE_PASSWORD;

  // 🚀 🆕 修正：自動ログインループを防止するログアウト処理
  const handleLogout = async () => { // 💡 async を追加
    if (window.confirm("システムからログアウトしますか？")) {
      // 1. Supabaseのセッションを物理的に終了させる
      await supabase.auth.signOut();
      
      // 2. セッションストレージ（バトン）をすべて掃除
      sessionStorage.clear();
      
      // 3. 状態を解除
      setIsAuthorized(false);
      
      // 4. 🚀 重要：URLに印を付けてログイン画面へ
      navigate('/?logout=true', { replace: true });
    }
  };

  // --- その他のState ---
  const [createdShops, setCreatedShops] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('すべて');
  const [facilities, setFacilities] = useState([]);
  const [newFacilityName, setNewFacilityName] = useState('');
  const [newFacilityLoginId, setNewFacilityLoginId] = useState('');
  const [newFacilityPass, setNewFacilityPass] = useState('');
  const [editingFacilityId, setEditingFacilityId] = useState(null);
  const [editFacilityName, setEditFacilityName] = useState('');
  const [editFacilityLoginId, setEditFacilityLoginId] = useState('');
  const [editFacilityPass, setEditFacilityPass] = useState('');
  // ------------------------------

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activeTab, setActiveTab] = useState('list');
  const [isProcessing, setIsProcessing] = useState(false); // 送信中状態

  // --- フォームState ---
  const [newShopName, setNewShopName] = useState('');
  const [newShopKana, setNewShopKana] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerNameKana, setNewOwnerNameKana] = useState('');
  const [newBusinessType, setNewBusinessType] = useState('');
  // 🆕 新規作成時の小カテゴリStateを追加
  const [newSubBusinessType, setNewSubBusinessType] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [editingShopId, setEditingShopId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editKana, setEditKana] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editOwnerNameKana, setEditOwnerNameKana] = useState('');
  const [editBusinessType, setEditBusinessType] = useState('');
  // 🆕 編集時の小カテゴリStateを追加
  const [editSubBusinessType, setEditSubBusinessType] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const [newsList, setNewsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [newNewsDate, setNewNewsDate] = useState('');
  const [newNewsCat, setNewNewsCat] = useState('お知らせ');
  const [newNewsTitle, setNewNewsTitle] = useState('');

  useEffect(() => { 
    if (sessionStorage.getItem('auth_super') === 'true') {
      setIsAuthorized(true);
      fetchAllData();
    } else {
      setLoading(false); // バトンがない場合は、読み込みを終わらせてログイン画面を出す
    }
  }, []);

  const isMobile = windowWidth < 1024;

  useEffect(() => { 
    if (isAuthorized) fetchAllData(); 
  }, [isAuthorized]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchCreatedShops(), fetchPortalContent(), fetchFacilities()]);
    setLoading(false);
  };

  // --- 🆕 施設一覧を取得する関数を追加 ---
  const fetchFacilities = async () => {
    const { data, error } = await supabase
      .from('facility_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setFacilities(data || []);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (inputPass === MASTER_PASSWORD) {
      sessionStorage.setItem('auth_super', 'true');
      setIsAuthorized(true);
      fetchAllData();
    } else {
      alert('パスワードが違います');
    }
  };

  const fetchCreatedShops = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setCreatedShops(data);
  };

  const fetchPortalContent = async () => {
    const { data: news } = await supabase.from('portal_news').select('*').order('publish_date', { ascending: false });
    if (news) setNewsList(news);
    const { data: cats } = await supabase.from('portal_categories').select('*').order('sort_order', { ascending: true });
    if (cats) setCategoriesList(cats);
  };

  const filteredShops = useMemo(() => {
    return createdShops.filter(shop => {
      const matchSearch = (shop.business_name || "").includes(searchTerm) || (shop.owner_name || "").includes(searchTerm) || (shop.phone || "").includes(searchTerm);
      const matchCat = activeCategory === 'すべて' || shop.business_type === activeCategory;
      return matchSearch && matchCat;
    });
  }, [createdShops, searchTerm, activeCategory]);

  const stats = useMemo(() => ({
    total: createdShops.length,
    active: createdShops.filter(s => !s.is_suspended).length,
    suspended: createdShops.filter(s => s.is_suspended).length,
    fullPlan: createdShops.filter(s => s.service_plan === 2).length,
    ledgerPlan: createdShops.filter(s => s.service_plan === 1).length
  }), [createdShops]);

// 🚀 修正後：店舗アカウント発行（全自動版）
  const createNewShop = async () => {
    if (!newShopName || !newShopKana || !newOwnerName || !newEmail) {
      return alert('必須項目を入力してください（メールアドレスも必須です）');
    }
    
    setIsProcessing(true);

    try {
      // 🚀 正しい命令(CREATE_SHOP_FULL)と新規店舗のデータを送ります
      const { data, error } = await supabase.functions.invoke('resend', {
        body: {
          type: 'CREATE_SHOP_FULL',
          shopName: newShopName,
          shopNameKana: newShopKana,
          ownerName: newOwnerName,
          ownerNameKana: newOwnerNameKana,
          email: newEmail,
          phone: newPhone,
          businessType: newBusinessType,
          subBusinessType: newSubBusinessType,
          originUrl: window.location.origin
        }
      });

      if (error) {
        throw new Error(error.message || 'サーバー側での発行に失敗しました');
      }

      alert(`「${newShopName}」の発行が完了しました！\nAuthアカウント作成、DB登録、ウェルカムメール送信が完了しました。`);
      
      setNewShopName(''); setNewShopKana(''); setNewOwnerName(''); setNewOwnerNameKana('');
      setNewEmail(''); setNewPhone('');
      
      fetchCreatedShops(); 
      setActiveTab('list');

    } catch (err) {
      console.error("Creation Error:", err);
      alert('エラーが発生しました: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 🚀 修正後：施設（Hub）を新規発行するロジック（しっかり残しました！）
  const createNewFacility = async () => {
    if (!newFacilityName || !newFacilityLoginId || !newFacilityPass) return alert('全項目入力してください');
    
    setIsProcessing(true);
    const { error } = await supabase.from('facility_users').insert([{
      id: crypto.randomUUID(),
      facility_name: newFacilityName,
      login_id: newFacilityLoginId,
      password: newFacilityPass
    }]);

    if (!error) {
      alert(`施設「${newFacilityName}」を発行しました！`);
      setNewFacilityName(''); setNewFacilityLoginId(''); setNewFacilityPass('');
      fetchFacilities(); 
    } else {
      alert('エラー: ' + error.message);
    }
    setIsProcessing(false);
  };

  // 🚀 🆕 既存店舗の認証アカウントを「今のIDのまま」強制作成する関数
  const repairShopAuth = async (shop) => {
    if (!shop.email_contact || !shop.admin_password) {
      return alert('メールアドレスまたはパスワードが未設定のため復旧できません。');
    }
    if (!window.confirm(`「${shop.business_name}」の認証アカウントを強制復旧しますか？\n現在の店舗IDを維持したまま、Auth(Users)へ登録を行います。`)) return;
    
    setIsProcessing(true);
    try {
      // 🚀 正しい命令(REPAIR_AUTH)と既存の店舗情報を送ります
      const { data, error } = await supabase.functions.invoke('resend', {
        body: {
          type: 'REPAIR_AUTH',
          shopId: shop.id,
          email: shop.email_contact,
          password: shop.admin_password,
          shopName: shop.business_name
        }
      });

      if (error) {
        throw new Error(error.message || '復旧に失敗しました');
      }

      alert(`「${shop.business_name}」の認証復旧が完了しました！\n次回から正常にログイン・通知が可能です。`);
      fetchCreatedShops(); 

    } catch (err) {
      console.error("Repair Error:", err);
      alert('エラーが発生しました: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };
  // --- 🆕 施設情報を更新するロジック ---
  const updateFacilityInfo = async (id) => {
    const { error } = await supabase
      .from('facility_users')
      .update({ 
        facility_name: editFacilityName, 
        login_id: editFacilityLoginId, 
        password: editFacilityPass 
      })
      .eq('id', id);

    if (!error) { 
      setEditingFacilityId(null); 
      fetchFacilities(); 
      alert('施設情報を更新しました'); 
    } else {
      alert('更新失敗: ' + error.message);
    }
  };

  // --- 🆕 施設を削除するロジック（店舗と同じ削除PWを使用） ---
  const deleteFacility = async (facility) => {
    const input = window.prompt(`施設「${facility.facility_name}」を削除しますか？\n削除パスワードを入力してください：`);
    if (input === DELETE_PASSWORD) {
      const { error } = await supabase.from('facility_users').delete().eq('id', facility.id);
      if (!error) { 
        fetchFacilities(); 
        alert('施設を削除しました'); 
      } else {
        alert('削除失敗: ' + error.message);
      }
    } else if (input !== null) {
      alert('パスワードが違います');
    }
  };

const updateShopInfo = async (id) => {
    setIsProcessing(true); 

    // 1. まずはDB（profiles）を更新
    const { error: dbError } = await supabase.from('profiles').update({ 
      business_name: editName, 
      business_name_kana: editKana, 
      owner_name: editOwnerName, 
      owner_name_kana: editOwnerNameKana, 
      business_type: editBusinessType, 
      sub_business_type: editSubBusinessType,
      email_contact: editEmail,
      phone: editPhone, 
      admin_password: editPassword 
    }).eq('id', id);

    if (dbError) {
      alert('DB更新失敗: ' + dbError.message);
      setIsProcessing(false);
      return;
    }

    // 2. 🚀 Auth（認証）側のパスワードも同期させる
    try {
      // 🚀 正しい命令(UPDATE_PASSWORD)と新しいパスワードを送ります
      const { error } = await supabase.functions.invoke('resend', {
        body: {
          type: 'UPDATE_PASSWORD',
          shopId: id,
          password: editPassword
        }
      });

      if (error) {
        console.warn("Auth sync failed, but DB was updated.");
      }
    } catch (err) {
      console.error("Auth Sync Error:", err);
    }

    // 3. 後処理
    setEditingShopId(null); 
    fetchCreatedShops(); 
    setIsProcessing(false);
    alert('店舗情報および認証パスワードを更新しました');
  };

  const toggleSuspension = async (shop) => {
    const { error } = await supabase.from('profiles').update({ is_suspended: !shop.is_suspended }).eq('id', shop.id);
    if (!error) fetchCreatedShops();
  };

  // ✅ 🆕 差し替え：サービスプラン（1 or 2）を更新する関数
  const updateServicePlan = async (shopId, planValue) => {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        service_plan: parseInt(planValue),
        // 💡 念のため古いカラム(is_management_enabled)も連動させておくと安全です
        is_management_enabled: true 
      })
      .eq('id', shopId);
      
    if (!error) {
      fetchCreatedShops();
      alert('サービスプランを更新しました');
    } else {
      alert('プランの更新に失敗しました：' + error.message);
    }
  };

  const deleteShop = async (shop) => {
    const input = window.prompt(`店舗「${shop.business_name}」を完全に削除しますか？\nログインアカウントも同時に消去されます。\n実行するには削除パスワードを入力してください：`);
    
    if (input === DELETE_PASSWORD) {
      setIsProcessing(true); // 送信中状態にする
      try {
        const { data, error } = await supabase.functions.invoke('resend', {
          body: {
            type: 'DELETE_SHOP_FULL',
            shopId: shop.id
          }
        });

        if (error) throw new Error(error.message);

        alert('店舗と認証アカウントを完全に消去しました。');
        fetchCreatedShops(); // リストを更新
      } catch (err) {
        console.error("Delete Error:", err);
        alert('削除に失敗しました: ' + err.message);
      } finally {
        setIsProcessing(false);
      }
    } else if (input !== null) {
      alert('パスワードが違います');
    }
  };

// 🆕 名前を基準に更新または新規作成するロジックに変更
// 🆕 引数に sortOrder を追加
  const updateCategory = async (name, imgUrl, sortOrder) => {
    const { error } = await supabase
      .from('portal_categories')
      .upsert(
        { 
          name: name, 
          image_url: imgUrl, 
          sort_order: parseInt(sortOrder) || 0 // 🆕 数字として保存
        }, 
        { onConflict: 'name' }
      );
    
    if (error) {
      alert('エラーが発生しました: ' + error.message);
    } else {
      alert(`「${name}」の設定を更新しました`);
      fetchPortalContent(); 
    }
  };    

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('コピーしました');
  };

  // 🚀 ここから修正
  if (loading) return null; // 読み込み中だけ真っ白

  // バトン（認証）がない場合に表示するログイン画面
  if (!isAuthorized && !loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
        <form onSubmit={handleLogin} style={panelStyle}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <ShieldAlert size={40} color="#1e293b" style={{ marginBottom: '10px' }} />
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>QUEST-HUB 管理者認証</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="password" 
              value={inputPass} 
              onChange={(e) => setInputPass(e.target.value)} 
              placeholder="マスターパスワードを入力" 
              style={smallInput} 
              autoFocus
            />
            <button type="submit" style={primaryBtn}>認証して入室</button>
          </div>
        </form>
      </div>
    );
  }
  // 🚀 ここまで修正

  // --- レンダリングパーツ ---
  const renderShopList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', minWidth: 0 }}>
      <div style={panelStyle}>
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', opacity: 0.4 }} />
          <input type="text" placeholder="店舗・代表者・電話で検索" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...smallInput, paddingLeft: '40px' }} />
        </div>
<div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px', WebkitOverflowScrolling: 'touch' }}>
          {/* 🆕 データベースのカテゴリではなく、最新の INDUSTRY_LABELS を表示 */}
          {['すべて', ...INDUSTRY_LABELS].map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)} 
              style={{ 
                padding: '6px 12px', 
                borderRadius: '20px', 
                border: 'none', 
                fontSize: '0.75rem', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                whiteSpace: 'nowrap', 
                background: activeCategory === cat ? '#1e293b' : '#f1f5f9', 
                color: activeCategory === cat ? '#fff' : '#64748b' 
              }}
            >
              {cat}
            </button>
          ))}
        </div>
                      </div>
      {filteredShops.map((shop, index) => (
<ShopCard 
  key={shop.id} 
  shop={shop} 
  index={createdShops.length - createdShops.findIndex(s => s.id === shop.id)} 
  editingShopId={editingShopId} 
  setEditingShopId={setEditingShopId} 
  // 🆕 editSubBusinessType と setter を追加
  editState={{ 
    editName, setEditName, editKana, setEditKana, 
    editOwnerName, setEditOwnerName, editOwnerNameKana, setEditOwnerNameKana, 
    editBusinessType, setEditBusinessType, 
    editSubBusinessType, setEditSubBusinessType,
    editEmail, setEditEmail, editPhone, setEditPhone, 
    editPassword, setEditPassword 
  }} 
  onUpdate={updateShopInfo} 
  onDelete={deleteShop} 
  onToggleSuspension={toggleSuspension} 
  onToggleManagement={updateServicePlan} 
  onCopy={copyToClipboard} 
  categories={categoriesList} 
  onRepairAuth={repairShopAuth}
/>
      ))}
      {filteredShops.length === 0 && <div style={{textAlign:'center', padding:'40px', color:'#999'}}>該当する店舗はありません</div>}
    </div>
  );

  const renderAddShop = () => (
    <div style={panelStyle}>
      <h3 style={panelTitle}><PlusSquare size={18} /> 新規店舗の発行</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} placeholder="代表者名" style={{...smallInput, flex:1}} />
          <input value={newOwnerNameKana} onChange={(e) => setNewOwnerNameKana(e.target.value)} placeholder="かな" style={{...smallInput, flex:1}} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newShopName} onChange={(e) => setNewShopName(e.target.value)} placeholder="店舗名" style={{...smallInput, flex:1}} />
          <input value={newShopKana} onChange={(e) => setNewShopKana(e.target.value)} placeholder="かな" style={{...smallInput, flex:1}} />
        </div>
<select 
          value={newBusinessType} 
          onChange={(e) => {
            setNewBusinessType(e.target.value);
            setNewSubBusinessType(''); // 大カテゴリ変更で小カテゴリをリセット
          }} 
          style={smallInput}
        >
          <option value="">-- 大カテゴリ（業種）を選択 --</option>
          {INDUSTRY_LABELS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {/* 🆕 選択した業種に小カテゴリ（サブカテゴリ）がある場合のみ表示 */}
        {newBusinessType && getSubCategories(newBusinessType).length > 0 && (
          <select 
            value={newSubBusinessType} 
            onChange={(e) => setNewSubBusinessType(e.target.value)} 
            style={{ ...smallInput, border: '2px solid #3b82f6' }} // 目立つように青枠
          >
            <option value="">-- 小カテゴリ（詳細ジャンル）を選択 --</option>
            {getSubCategories(newBusinessType).map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        )}

                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="店主様メールアドレス（必須）" style={smallInput} />
        <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="電話" style={smallInput} />
        
        <button 
          onClick={createNewShop} 
          disabled={isProcessing}
          style={{ ...primaryBtn, background: isProcessing ? '#94a3b8' : '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {isProcessing ? '作成＆メール送信中...' : '発行してリストへ戻る'}
          {!isProcessing && <Send size={18} />}
        </button>
      </div>
    </div>
  );

  const renderPortalSettings = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <div style={panelStyle}>
        <h3 style={panelTitle}><Bell size={18} /> トピック管理</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input value={newNewsDate} onChange={(e) => setNewNewsDate(e.target.value)} placeholder="2026.01.21" style={{...smallInput, flex:1}} />
          <select value={newNewsCat} onChange={(e) => setNewNewsCat(e.target.value)} style={{...smallInput, flex:1}}>
            <option value=""></option>
            <option value="お知らせ">お知らせ</option>
            <option value="重要">重要</option>
            <option value="新機能">新機能</option>
          </select>
        </div>
        <textarea value={newNewsTitle} onChange={(e) => setNewNewsTitle(e.target.value)} placeholder="タイトル内容" style={{...smallInput, height:'60px', marginBottom:'10px'}} />
        <button onClick={addNews} style={{ ...secondaryBtn, width: '100%' }}>お知らせ追加</button>
        <div style={{ marginTop: '15px', maxHeight: '200px', overflowY: 'auto' }}>
          {newsList.map(n => <div key={n.id} style={newsItemStyle}><span>{n.publish_date} {n.title}</span><Trash2 size={14} color="#ef4444" onClick={() => deleteNews(n.id)} style={{cursor:'pointer'}} /></div>)}
        </div>
      </div>
<div style={panelStyle}>
        <h3 style={panelTitle}><ImageIcon size={18} /> カテゴリデザイン（マスター同期）</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 大カテゴリごとにループ */}
          {Object.values(INDUSTRY_PRESETS).map(main => (
            <div key={main.label} style={{ borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Store size={14} /> {main.label} <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>(大カテゴリ)</span>
              </div>
              
              {/* 大カテゴリ自体の画像設定 */}
              <CategoryRow 
                name={main.label} 
                dbData={categoriesList.find(c => c.name === main.label)} 
                onSave={updateCategory} 
              />

              {/* 小カテゴリ（サブカテゴリ）があれば、インデントして表示 */}
              {main.subCategories && main.subCategories.length > 0 && (
                <div style={{ marginLeft: '20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '2px solid #f1f5f9', paddingLeft: '15px' }}>
                  {main.subCategories.map(subName => (
                    <div key={subName}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px' }}>┗ {subName}</div>
                      <CategoryRow 
                        name={subName} 
                        dbData={categoriesList.find(c => c.name === subName)} 
                        onSave={updateCategory} 
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
          </div>
  );

  // --- 🆕 施設管理画面のレンダリングパーツ ---
  const renderFacilityManagement = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* 1. 施設作成フォーム */}
      <div style={panelStyle}>
        <h3 style={panelTitle}><PlusSquare size={18} /> 施設（Hub）の新規発行</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b'}}>施設名</label>
          <input value={newFacilityName} onChange={e => setNewFacilityName(e.target.value)} placeholder="例：マリアの丘" style={smallInput} />
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b'}}>ログインID</label>
              <input value={newFacilityLoginId} onChange={e => setNewFacilityLoginId(e.target.value)} placeholder="半角英数字" style={smallInput} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b'}}>パスワード</label>
              <input value={newFacilityPass} onChange={e => setNewFacilityPass(e.target.value)} placeholder="初期設定PW" style={smallInput} />
            </div>
          </div>

          <button 
            onClick={createNewFacility} 
            disabled={isProcessing}
            style={{ ...primaryBtn, background: '#4f46e5' }}
          >
            {isProcessing ? '発行中...' : 'Hubページを発行する'}
          </button>
        </div>
      </div>

      {/* 2. 発行済み施設リスト */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h3 style={panelTitle}><List size={18} /> 発行済みHub一覧（{facilities.length}件）</h3>
        {facilities.map(f => {
          const isEditing = editingFacilityId === f.id;
          return (
            <div key={f.id} style={panelStyle}>
              {/* ヘッダー：名前とアクションボタン */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                {isEditing ? (
                  <input 
                    value={editFacilityName} 
                    onChange={e => setEditFacilityName(e.target.value)} 
                    style={{ ...smallInput, fontWeight: 'bold' }} 
                    placeholder="施設名" 
                  />
                ) : (
                  <h4 style={{ margin: 0, fontWeight: '900', color: '#1e293b' }}>{f.facility_name}</h4>
                )}
                
                <div style={{ display: 'flex', gap: '12px', marginLeft: '10px' }}>
                  <Edit2 
                    size={16} 
                    color="#64748b" 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => {
                      setEditingFacilityId(f.id);
                      setEditFacilityName(f.facility_name);
                      setEditFacilityLoginId(f.login_id);
                      setEditFacilityPass(f.password);
                    }} 
                  />
                  <Trash2 
                    size={16} 
                    color="#ef4444" 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => deleteFacility(f)} 
                  />
                </div>
              </div>

              {isEditing ? (
                /* 編集モードの入力エリア */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={editFacilityLoginId} onChange={e => setEditFacilityLoginId(e.target.value)} style={smallInput} placeholder="ID" />
                    <input value={editFacilityPass} onChange={e => setEditFacilityPass(e.target.value)} style={smallInput} placeholder="PW" />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => updateFacilityInfo(f.id)} style={{ ...primaryBtn, background: '#10b981', flex: 1, padding: '10px' }}>保存</button>
                    <button onClick={() => setEditingFacilityId(null)} style={{ ...primaryBtn, background: '#94a3b8', flex: 1, padding: '10px' }}>キャンセル</button>
                  </div>
                </div>
              ) : (
                /* 通常表示モード */
                <>
                  <UrlBox 
                    label="Hub URL" 
                    url={`${window.location.origin}/facility-portal/${f.id}/residents`} 
                    onCopy={copyToClipboard} 
                  />
                  <div style={{ marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>ID: <strong>{f.login_id}</strong></span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>PW: <strong>{f.password}</strong></span>
                    </div>
                    <button 
                      onClick={() => window.open(`/facility-portal/${f.id}/residents`, '_blank')}
                      style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      ポータルを開く <ExternalLink size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', paddingBottom: isMobile ? '100px' : '20px', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '10px' : '25px' }}>
        
        {/* --- 🆕 修正：PC/スマホ共通のトップタブ --- */}
        <div style={{ display: 'flex', background: '#fff', padding: '5px', borderRadius: '15px', marginBottom: '25px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
          <button 
            onClick={() => setActiveTab('list')} 
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '12px', background: activeTab === 'list' || activeTab === 'add' ? '#1e293b' : 'transparent', color: activeTab === 'list' || activeTab === 'add' ? '#fff' : '#64748b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Store size={18} /> 業者（店舗）管理
          </button>
          <button 
            onClick={() => setActiveTab('facility')} 
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '12px', background: activeTab === 'facility' ? '#4f46e5' : 'transparent', color: activeTab === 'facility' ? '#fff' : '#64748b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Building2 size={18} /> 施設（Hub）管理
          </button>
          <button 
            onClick={() => setActiveTab('config')} 
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '12px', background: activeTab === 'config' ? '#1e293b' : 'transparent', color: activeTab === 'config' ? '#fff' : '#64748b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Settings size={18} /> 全体設定
          </button>

          {/* 🆕 ログアウトボタンをタブバーの右端に追加 */}
          <button 
            onClick={handleLogout}
            style={logoutCircleBtn}
            title="システムログアウト"
            onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = '#fff'; }}
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* 統計エリア（共通） */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '5px' }}>
          <div style={statsCard}>全店舗: {stats.total}</div>
          <div style={{ ...statsCard, color: '#4f46e5' }}>全施設: {facilities.length}</div>
          <div style={{ ...statsCard, color: '#10b981' }}>公開中: {stats.active}</div>
        </div>

        {/* --- 🆕 メインコンテンツエリア --- */}
        <div>
          {/* A. 店舗管理タブ（一覧と新規登録をグリッドで表示） */}
          {(activeTab === 'list' || activeTab === 'add') && (
            <div style={isMobile ? { width: '100%' } : { display: 'grid', gridTemplateColumns: '350px 1fr', gap: '25px', alignItems: 'start' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                 {renderAddShop()}
               </div>
               <div style={{ minWidth: 0 }}>
                 {renderShopList()}
               </div>
            </div>
          )}

          {/* B. 🆕 施設Hub管理タブ */}
          {activeTab === 'facility' && renderFacilityManagement()}

          {/* C. 全体設定タブ */}
          {activeTab === 'config' && renderPortalSettings()}
        </div>

        {/* スマホ用ボトムナビ（予備として維持） */}
        {isMobile && (
          <div style={bottomNavStyle}>
            <button onClick={() => setActiveTab('list')} style={activeTab === 'list' ? navBtnActive : navBtn}><List size={20} /><span>一覧</span></button>
            <button onClick={() => setActiveTab('facility')} style={activeTab === 'facility' ? navBtnActive : navBtn}><Building2 size={20} /><span>Hub</span></button>
            <button onClick={() => setActiveTab('config')} style={activeTab === 'config' ? navBtnActive : navBtn}><Settings size={20} /><span>設定</span></button>
          </div>
        )}
      </div>
    </div>
  );
}

// 店舗カード（1ミリも省略なし）
function ShopCard({ shop, index, editingShopId, setEditingShopId, editState, onUpdate, onDelete, onToggleSuspension, onToggleManagement, onCopy, categories, onRepairAuth }) {
  const isEditing = editingShopId === shop.id;
  const isSuspended = shop.is_suspended;
  const isMgmtEnabled = shop.is_management_enabled;

  return (
    <div style={{ background: '#fff', padding: '15px', borderRadius: '16px', border: isSuspended ? '2px solid #ef4444' : (isMgmtEnabled ? '2px solid #7c3aed' : '1px solid #e2e8f0'), width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8' }}>No.{index}</span>
          {isMgmtEnabled && <span style={{ fontSize: '0.6rem', background: '#7c3aed', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>管理機能:ON</span>}
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
<Edit2 size={16} color="#64748b" style={{cursor:'pointer'}} onClick={() => {
            setEditingShopId(shop.id);
            editState.setEditName(shop.business_name || "");
            editState.setEditKana(shop.business_name_kana || "");
            editState.setEditOwnerName(shop.owner_name || "");
            editState.setEditOwnerNameKana(shop.owner_name_kana || "");
            editState.setEditBusinessType(shop.business_type || "");
            // 🆕 既存の小カテゴリをセット
            editState.setEditSubBusinessType(shop.sub_business_type || "");
            editState.setEditEmail(shop.email_contact || "");
            editState.setEditPhone(shop.phone || "");
            editState.setEditPassword(shop.admin_password || "");
          }} />
          <Trash2 size={16} color="#ef4444" style={{cursor:'pointer'}} onClick={() => onDelete(shop)} />
        </div>
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input value={editState.editOwnerName} onChange={(e) => editState.setEditOwnerName(e.target.value)} style={smallInput} placeholder="代表名" />
            <input value={editState.editOwnerNameKana} onChange={(e) => editState.setEditOwnerNameKana(e.target.value)} style={smallInput} placeholder="かな" />
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input value={editState.editName} onChange={(e) => editState.setEditName(e.target.value)} style={smallInput} placeholder="店舗名" />
            <input value={editState.editKana} onChange={(e) => editState.setEditKana(e.target.value)} style={smallInput} placeholder="かな" />
          </div>
<select 
  value={editState.editBusinessType} 
  onChange={(e) => {
    editState.setEditBusinessType(e.target.value);
    editState.setEditSubBusinessType(''); // 大カテゴリ変更で小カテゴリをリセット
  }} 
  style={smallInput}
>
  <option value="">-- 業種を選択 --</option>
  {INDUSTRY_LABELS.map(opt => (
    <option key={opt} value={opt}>{opt}</option>
  ))}
</select>

{/* 🆕 編集時も二段目の小カテゴリを表示 */}
{editState.editBusinessType && getSubCategories(editState.editBusinessType).length > 0 && (
  <select 
    value={editState.editSubBusinessType} 
    onChange={(e) => editState.setEditSubBusinessType(e.target.value)} 
    style={{ ...smallInput, border: '1px solid #7c3aed' }} // 管理画面カラーに合わせる
  >
    <option value="">-- 詳細ジャンルを選択 --</option>
    {getSubCategories(editState.editBusinessType).map(sub => (
      <option key={sub} value={sub}>{sub}</option>
    ))}
  </select>
)}          
                    <input value={editState.editEmail} onChange={(e) => editState.setEditEmail(e.target.value)} style={smallInput} placeholder="メールアドレス" />
          <input value={editState.editPhone} onChange={(e) => editState.setEditPhone(e.target.value)} style={smallInput} placeholder="電話番号" />
          <input value={editState.editPassword} onChange={(e) => editState.setEditPassword(e.target.value)} style={smallInput} placeholder="PW" />
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => onUpdate(shop.id)} style={{ ...primaryBtn, background: '#10b981', flex: 1 }}>保存</button>
            <button onClick={() => setEditingShopId(null)} style={{ ...primaryBtn, background: '#94a3b8', flex: 1 }}>閉じる</button>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 'bold', color: '#1e293b' }}>{shop.business_name}</h4>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '5px' }}>{shop.owner_name} / PW: <strong>{shop.admin_password}</strong></div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '15px' }}>業種: {shop.business_type || "未設定"}</div>
          
          {/* ✅ 🆕 プラン選択スイッチへアップグレード */}
          <div style={{ marginBottom: '15px', padding: '12px', background: '#f5f3ff', borderRadius: '12px', border: '1px solid #7c3aed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#7c3aed" />
              <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#7c3aed' }}>
                フル機能開放済み（プラン2）
              </span>
            </div>
            <p style={{ margin: '5px 0 0 24px', fontSize: '0.7rem', color: '#6d28d9', fontWeight: 'bold' }}>
              顧客管理・売上集計・予約サイト掲載がすべて有効です。
            </p>
            
            {/* 💡 もし個別にダウングレードしたい時だけのために、選択肢は一応残しておきます */}
            <select 
              value={shop.service_plan || 2} 
              onChange={(e) => onToggleManagement(shop.id, e.target.value)} 
              style={{ width: '100%', marginTop: '10px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.75rem', cursor: 'pointer', background: '#fff', color: '#1e293b' }}
            >
              <option value={2}>プラン2：フル機能（標準）</option>
              <option value={1}>プラン1：内部管理のみ（Web予約停止）</option>
            </select>
          </div>

          {/* 🚀 🆕 復旧ボタン（Authにいない幽霊店舗用） */}
          <button 
            onClick={() => onRepairAuth(shop)}
            style={{ 
              width: '100%', marginBottom: '15px', padding: '10px', 
              background: '#fef3c7', color: '#92400e', 
              border: '1px solid #f59e0b', borderRadius: '10px', 
              fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <ShieldAlert size={14} /> 認証アカウントを復旧（強制同期）
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <UrlBox label="管理" url={`${window.location.origin}/admin/${shop.id}/dashboard`} onCopy={onCopy} />
            <UrlBox label="予約" url={`${window.location.origin}/shop/${shop.id}/reserve`} onCopy={onCopy} />
          </div>
          <button onClick={() => onToggleSuspension(shop)} style={{ width: '100%', marginTop: '15px', padding: '10px', borderRadius: '10px', border: 'none', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', background: isSuspended ? '#10b981' : '#fee2e2', color: isSuspended ? '#fff' : '#ef4444' }}>
            {isSuspended ? '公開を再開する' : '公開を一時停止する'}
          </button>
        </div>
      )}
    </div>
  );
}

function UrlBox({ label, url, onCopy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#1e293b', minWidth: '30px' }}>{label}</span>
      <input readOnly value={url} style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.65rem', color: '#64748b', minWidth: 0, width: '100%', outline: 'none', textOverflow: 'ellipsis' }} />
      <button onClick={() => onCopy(url)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
        <Copy size={16} color="#2563eb" />
      </button>
    </div>
  );
}


// スタイル定数（完全維持）
const smallInput = { padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', outline: 'none' };
const panelStyle = { background: '#fff', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', boxSizing: 'border-box', width: '100%' };
const panelTitle = { marginTop: 0, fontSize: '1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' };
const primaryBtn = { width: '100%', padding: '14px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor:'pointer' };
const secondaryBtn = { padding: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold', cursor:'pointer' };
const statsCard = { background: '#fff', padding: '10px 18px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
const newsItemStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '10px 0', borderBottom: '1px dashed #eee' };
const bottomNavStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', display: 'flex', justifyContent: 'space-around', padding: '12px 0', borderTop: '1px solid #e2e8f0', boxShadow: '0 -4px 15px rgba(0,0,0,0.05)', zIndex: 9999 };
const navBtn = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#94a3b8', cursor: 'pointer', flex: 1 };
const navBtnActive = { ...navBtn, color: '#e60012' };

// 🆕 ログアウトボタン（丸型で右端に置く用）
const logoutCircleBtn = {
  width: '40px',
  height: '40px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  background: '#fff',
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
  marginLeft: '10px'
};
function CategoryRow({ name, dbData, onSave }) {
  const [imgUrl, setImgUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (dbData) {
      setImgUrl(dbData.image_url || "");
      setSortOrder(dbData.sort_order || 0);
    }
  }, [dbData]);

  return (
    <div style={{ padding: '12px', border: '1px solid #f1f5f9', borderRadius: '12px', background: '#fff', marginBottom: '10px' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>{name}</div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input 
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          placeholder="順"
          style={{ ...smallInput, width: '60px', padding: '8px', fontSize: '0.8rem', textAlign: 'center', border: '2px solid #e2e8f0' }}
        />
        <input 
          value={imgUrl} 
          onChange={(e) => setImgUrl(e.target.value)} 
          placeholder="画像URL" 
          style={{ ...smallInput, flex: 1, fontSize: '0.75rem', padding: '8px' }} 
        />
        <button 
          onClick={() => onSave(name, imgUrl, sortOrder)} 
          style={{ background: '#10b981', border: 'none', borderRadius: '10px', color: '#fff', padding: '10px 15px', cursor:'pointer' }}
        >
          <Save size={18}/>
        </button>
      </div>
    </div>
  );
}

export default SuperAdmin;