// src/components/ScrollToTop.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // ページ遷移（URLの変化）を検知して一番上へスクロール
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;