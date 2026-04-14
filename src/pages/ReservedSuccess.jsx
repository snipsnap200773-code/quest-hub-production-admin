import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Home, Calendar, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const ReservedSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { shopName, startTime } = location.state || {};

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ background: '#fff', width: '100%', maxWidth: '450px', borderRadius: '32px', padding: '40px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
      >
        <div style={{ display: 'inline-flex', background: '#dcfce7', color: '#22c55e', padding: '20px', borderRadius: '50%', marginBottom: '24px' }}>
          <CheckCircle2 size={48} />
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}>
          予約完了しました
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '32px' }}>
          ご予約ありがとうございます。<br/>当日のお越しを心よりお待ちしております。
        </p>

        {/* 予約概要カード */}
        <div style={{ background: '#f1f5f9', borderRadius: '20px', padding: '20px', textAlign: 'left', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Sparkles size={18} color="#07aadb" />
            <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{shopName || '店舗'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '0.85rem' }}>
            <Calendar size={18} />
            <span>{startTime || '予約日時'} 〜</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={() => navigate('/')}
            style={{ width: '100%', padding: '16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Home size={18} /> ホームに戻る
          </button>
          
          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            ※予約の変更・キャンセルはマイページから行えます
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ReservedSuccess;