import React, { useEffect, useState } from 'react';
// 🆕 修正：ドットを2つから4つに増やして、正しい階層のクライアントを読み込みます
import { supabase } from '../../supabaseClient';
import { Sparkles, Trophy, Swords, PlusCircle } from 'lucide-react'; 

// 🥚 卵表示コンポーネント
const EggSection = ({ eggs, onHatch }) => (
  <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '15px' }}>
    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
      <span>🥚 孵化を待つ卵 ({eggs.length})</span>
      {eggs.length > 0 && <span style={{ fontSize: '0.6rem', background: '#fff', color: '#07aadb', padding: '2px 8px', borderRadius: '10px' }}>育成中</span>}
    </div>
    {eggs.length > 0 ? (
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
        {eggs.map(egg => (
          <div key={egg.id} onClick={() => onHatch(egg.id)} style={{ cursor: 'pointer', background: '#fff', padding: '10px', borderRadius: '12px', textAlign: 'center', minWidth: '95px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            {/* 🆕 アニメーションを適用 */}
            <div style={{ fontSize: '1.6rem', marginBottom: '4px', animation: 'egg-bounce 2s infinite ease-in-out' }}>🥚</div>
            <div style={{ color: '#333', fontSize: '0.65rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{egg.item_name}</div>
          </div>
        ))}
      </div>
    ) : (
      <div style={{ textAlign: 'center', padding: '10px', color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', border: '1px dashed rgba(255,255,255,0.3)', borderRadius: '8px' }}>
        まだ卵を持っていません
      </div>
    )}
  </div>
);

// 🦖 モンスター表示コンポーネント
const MonsterSection = ({ monsters }) => (
  <div style={{ marginTop: '15px', background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '15px' }}>
    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px' }}>✨ 一緒に歩む仲間 ({monsters.length})</div>
    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
      {monsters.map(m => (
        <div key={m.id} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.5))' }}>🦖</div>
          <div style={{ fontSize: '0.6rem', fontWeight: 'bold', marginTop: '4px' }}>{m.item_name}</div>
        </div>
      ))}
    </div>
  </div>
);

export default function GameQuestHub({ userId }) {
  const [eggs, setEggs] = useState([]);
  const [monsters, setMonsters] = useState([]);

  const fetchGameData = async () => {
    if (!userId) return;
    // 🆕 ステータスごとにフィルターして取得 [cite: 2025-12-01]
    const { data } = await supabase.from('user_items').select('*').eq('user_id', userId).eq('item_type', 'egg');
    if (data) {
      setEggs(data.filter(i => i.status === 'unhatched'));
      setMonsters(data.filter(i => i.status === 'hatched'));
    }
  };

  useEffect(() => { fetchGameData(); }, [userId]);

  const handleHatch = async (id) => {
    if (!window.confirm("この卵を孵化させますか？")) return;
    // 🆕 以前解決したセキュリティ対策（userIdの指定）を含めた更新ロジック [cite: 2025-12-01]
    const { error } = await supabase
      .from('user_items')
      .update({ status: 'hatched', hatched_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) {
      alert("パカッ！ 中から何かが飛び出しました！");
      fetchGameData(); // データを再取得して表示を更新
    } else {
      alert("孵化に失敗しました: " + error.message);
    }
  };

  // 🆕 テスト用の「卵ゲット」機能もハブ内に内蔵しておくと便利です [cite: 2026-03-01]
  const handleAddTestEgg = async () => {
    const { error } = await supabase.from('user_items').insert([{
      user_id: userId,
      item_type: 'egg',
      item_name: 'はじまりの卵',
      status: 'unhatched',
      quantity: 1,
      metadata: { rarity: 'common' }
    }]);
    if (!error) fetchGameData();
  };

  return (
    <div className="game-quest-hub" style={{ color: '#fff' }}>
      <EggSection eggs={eggs} onHatch={handleHatch} />
      <MonsterSection monsters={monsters} />
      
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button onClick={handleAddTestEgg} style={{ flex: 1, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px', borderRadius: '8px', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <PlusCircle size={14} /> 卵を拾う(テスト)
        </button>
        <button style={{ flex: 1, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px', borderRadius: '8px', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <Trophy size={14} /> 図鑑
        </button>
      </div>

      {/* 🆕 卵のアニメーションCSSをここに封じ込めます [cite: 2026-03-01] */}
      <style>{`
        @keyframes egg-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px) rotate(3deg); }
        }
      `}</style>
    </div>
  );
}