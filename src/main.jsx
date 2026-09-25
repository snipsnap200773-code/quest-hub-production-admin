import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// ⚠️ 2026/09/25【BR②】：新しいバージョンの通知と Service Worker の登録を担当する
import PwaUpdateBanner from './components/PwaUpdateBanner.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PwaUpdateBanner />
    <App />
  </StrictMode>,
)