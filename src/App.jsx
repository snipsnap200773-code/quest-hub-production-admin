import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

// --- 🛡️ 運営・管理系 ---
import SuperAdmin from './pages/SuperAdmin';
import AdminDashboard from './pages/AdminDashboard';
import AdminManagement from './pages/AdminManagement';
import AdminReservations from './pages/AdminReservations';
import AdminTimeline from './pages/AdminTimeline';
import AdminFacilityVisit_PC from './pages/AdminFacilityVisit_PC';

// --- ⚙️ 店舗設定 ---
import BasicSettings from './pages/admin/settings/BasicSettings';
import MenuSettings from './pages/admin/settings/MenuSettings';
import BookingFormSettings from './pages/admin/settings/BookingFormSettings'; // 👈 🆕 これを追加
import ScheduleSettings from './pages/admin/settings/ScheduleSettings';
import LineSettings from './pages/admin/settings/LineSettings';
import GeneralSettings from './pages/admin/settings/GeneralSettings';
import EmailSettings from './pages/admin/settings/EmailSettings';
import StaffSettings from './pages/admin/settings/StaffSettings';
import FormCustomizer from './pages/admin/settings/FormCustomizer';
import BookingDetailsSettings from './pages/admin/settings/BookingDetailsSettings';
import BookingScheduleSettings from './pages/admin/settings/BookingScheduleSettings'; 
import CheckoutSettings from './pages/admin/settings/CheckoutSettings'; // 👈 🆕 これを追加
import TodayTasks from './pages/admin/settings/TodayTasks';
import ShareLinks from './pages/admin/settings/ShareLinks';
import BillingSettings from './pages/admin/settings/BillingSettings';

// --- ✨ ガイド ---
import BasicSettingsGuide from './pages/admin/settings/BasicSettingsGuide';
import MenuSettingsGuide from './pages/admin/settings/MenuSettingsGuide';
import ScheduleSettingsGuide from './pages/admin/settings/ScheduleSettingsGuide';

// --- 🏢 施設・ポータル ---
import FacilityManagement from './pages/admin/FacilityManagement';
import FacilityLogin from './pages/facility/FacilityLogin';
import FacilityPortal from './pages/facility/FacilityPortal';

// --- 🔮 ゲームマスター管理 ---
import GameMasterDashboard from './pages/admin/GameMaster/GameMasterDashboard';

// --- 🛠️ 共通コンポーネント ---
import FacilitySearch from './components/FacilitySearch';
import ShopSearch from './components/ShopSearch';
import ScrollToTop from './components/ScrollToTop';
import InquiryForm from "./components/InquiryForm";
import SettingsPreviewLayout from './components/SettingsPreviewLayout'; // 👈 これを追加
import { SubscriptionProvider } from './context/SubscriptionContext'; // 👈 🌟 🆕 これを追加

// 🚀 🆕 【ねじ込み予約用に必須】ユーザーエリアの画面をインポート
import ReservationForm from './pages/ReservationForm';
import TimeSelectionCalendar from './pages/TimeSelectionCalendar'; 
import ConfirmReservation from './pages/ConfirmReservation';
import ReservedSuccess from './pages/ReservedSuccess';
import ShopDetail from './pages/ShopDetail';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Router>
      <ScrollToTop />

      {!isOnline && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#ef4444', color: 'white', textAlign: 'center', padding: '8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <WifiOff size={16} /> ネットワークが不安定です。一部の機能が制限される可能性があります。
        </div>
      )}

      <Routes>
        {/* 🏠 玄関口 */}
        <Route path="/" element={<FacilityLogin />} />
        
        {/* 🕵️ 三土手さん専用 */}
        <Route path="/super-admin-216-midote-snipsnap-dmaaaahkmm" element={<SuperAdmin />} />

        {/* 🔮 ゲームマスター専用シークレットルート */}
        <Route path="/game-master-secret-dashboard" element={<GameMasterDashboard />} />

        {/* 👇 🌟 🆕 追加：店舗向け（admin/:shopId）の画面を全て SubscriptionProvider で囲む */}
        <Route element={<SubscriptionProvider />}>
          {/* --- 📊 管理エリア --- */}
          <Route path="/admin/:shopId/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/:shopId" element={<AdminDashboard />} />
          <Route path="/admin/:shopId/management" element={<AdminManagement />} />
          <Route path="/admin/:shopId/reservations" element={<AdminReservations />} />
          <Route path="/admin/:shopId/timeline" element={<AdminTimeline />} />
          <Route path="/admin/:shopId/today-tasks" element={<TodayTasks />} />

          {/* --- ⚙️ 設定系 --- */}
          <Route path="/admin/:shopId/settings/staff" element={<StaffSettings />} />

          <Route path="/admin/:shopId/settings/basic" element={
            <SettingsPreviewLayout>
              <BasicSettings />
            </SettingsPreviewLayout>
          } />
          
          <Route path="/admin/:shopId/settings/menu" element={
            <SettingsPreviewLayout>
              <BookingFormSettings />
            </SettingsPreviewLayout>
          } />
          
          <Route path="/admin/:shopId/settings/schedule" element={
            <SettingsPreviewLayout>
              <BookingScheduleSettings />
            </SettingsPreviewLayout>
          } />

          <Route path="/admin/:shopId/settings/checkout" element={
            <SettingsPreviewLayout>
              <CheckoutSettings />
            </SettingsPreviewLayout>
          } />

          <Route path="/admin/:shopId/settings/email" element={<EmailSettings />} />
          <Route path="/admin/:shopId/settings/line" element={<LineSettings />} />
          
          <Route path="/admin/:shopId/settings/share-links" element={<ShareLinks />} />

          <Route path="/admin/:shopId/settings/billing" element={<BillingSettings />} />

          <Route path="/admin/:shopId/settings/general" element={
            <SettingsPreviewLayout>
              <GeneralSettings />
            </SettingsPreviewLayout>
          } />
          
          <Route path="/admin/:shopId/settings/form" element={
            <SettingsPreviewLayout>
              <BookingDetailsSettings />
            </SettingsPreviewLayout>
          } />

          {/* ガイド */}
          <Route path="/admin/:shopId/settings/basic-guide" element={<BasicSettingsGuide />} />
          <Route path="/admin/:shopId/settings/menu-guide" element={<MenuSettingsGuide />} />
          <Route path="/admin/:shopId/settings/schedule-guide" element={<ScheduleSettingsGuide />} />

          {/* --- 🏢 施設ポータル連携機能（店舗側） --- */}
          <Route path="/admin/:shopId/facilities" element={<FacilityManagement />} />
          <Route path="/admin/:shopId/visit-requests/:visitId" element={<AdminFacilityVisit_PC />} />
          <Route path="/admin/:shopId/facility-search" element={<FacilitySearch />} />
        </Route>
        {/* 👆 ここまでが SubscriptionProvider の適用範囲 */}

        {/* --- 🏢 施設ポータル（施設側：shopIdを持たないルートは外に出す） --- */}
        <Route path="/facility-portal/:facilityId/residents" element={<FacilityPortal />} />
        <Route path="/facility-portal/:facilityId/find-shops" element={<ShopSearch />} />

        {/* 🚀 お問い合わせ */}
        <Route path="/shop/:shopId/inquiry" element={<InquiryForm />} />

        {/* -----------------------------------------------------------
            🆕 【ねじ込み予約用】ユーザー側画面のルートを復活（Adminアプリ内での表示用）
        -------------------------------------------------------------- */}
        {/* 👇 修正：店舗詳細ページを表示するように変更 */}
        <Route path="/shop/:shopId" element={<ShopDetail />} /> 
        <Route path="/shop/:shopId/reserve" element={<ReservationForm />} />
        <Route path="/shop/:shopId/reserve/time" element={<TimeSelectionCalendar />} />
        <Route path="/shop/:shopId/confirm" element={<ConfirmReservation />} />
        <Route path="/reserved-success" element={<ReservedSuccess />} />

        {/* 迷子防止（最後にある必要があります） */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;