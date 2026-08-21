import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const SubscriptionContext = createContext();

export const SubscriptionProvider = () => {
  const { shopId } = useParams();
  
  const [subscription, setSubscription] = useState({
    status: 'inactive',
    planId: 'free',
    loading: true,
  });

  useEffect(() => {
    if (!shopId) {
      setSubscription(prev => ({ ...prev, loading: false }));
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          // 👇 修正1：is_tester カラムも一緒に取得する（後でSupabase側に追加してください）
          .select('subscription_status, subscription_plan, is_tester') 
          // 👇 🌟 修正2：ここを 'shop_id' から 'id' に変更！
          .eq('id', shopId) 
          .single();

        if (error) throw error;

        // 👇 修正3：テスター権限が true なら強制的に全開放（guild扱い）にする
        if (data.is_tester) {
          setSubscription({
            status: 'active',
            planId: 'guild', // ギルドプランと同等の全権限を付与
            loading: false,
          });
        } else {
          // 通常の店舗の処理
          setSubscription({
            status: data.subscription_status || 'inactive',
            planId: data.subscription_plan || 'free',
            loading: false,
          });
        }
      } catch (error) {
        console.error('契約情報の取得エラー:', error);
        setSubscription(prev => ({ ...prev, loading: false }));
      }
    };

    fetchSubscription();
  }, [shopId]);

  return (
    <SubscriptionContext.Provider value={subscription}>
      <Outlet />
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);