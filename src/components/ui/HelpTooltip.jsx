import React, { useState } from 'react';

const HelpTooltip = ({ text, themeColor, showDown = false }) => {
  const [isVisible, setIsVisible] = useState(false);

  // showDownがtrueなら下へ、falseなら上へ表示する設定
  const positionStyle = showDown 
    ? { top: '140%', bottom: 'auto' } 
    : { bottom: '140%', top: 'auto' };

  const triangleStyle = showDown
    ? { bottom: '100%', borderColor: 'transparent transparent #1e293b transparent' }
    : { top: '100%', borderColor: '#1e293b transparent transparent transparent' };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '8px' }}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        style={{
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '18px', height: '18px', borderRadius: '50%',
          border: `1.5px solid ${isVisible ? themeColor : '#cbd5e1'}`,
          color: isVisible ? themeColor : '#94a3b8',
          backgroundColor: isVisible ? `${themeColor}11` : 'transparent',
          transition: 'all 0.2s ease', flexShrink: 0
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>?</span>
      </div>
      
      {isVisible && (
        <div style={{
          position: 'absolute',
          ...positionStyle, // 👈 ここで上下を切り替え
          left: '50%',
          transform: 'translateX(-50%)',
          width: '220px',
          padding: '12px',
          background: '#1e293b',
          color: '#fff',
          fontSize: '0.75rem',
          borderRadius: '10px',
          zIndex: 9999,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          lineHeight: '1.5',
          pointerEvents: 'none',
          textAlign: 'left'
        }}>
          {text}
          <div style={{
            position: 'absolute',
            left: '50%',
            marginLeft: '-6px',
            borderWidth: '6px',
            borderStyle: 'solid',
            ...triangleStyle // 👈 三角の向きも切り替え
          }} />
        </div>
      )}
    </div>
  );
};

export default HelpTooltip;