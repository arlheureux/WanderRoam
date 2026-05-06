import React from 'react';

export default function VersionBanner({ appVersion }) {
  if (!appVersion.version) return null;
  
  return (
    <span style={{ 
      marginLeft: '12px', 
      fontSize: '0.75rem', 
      color: 'var(--text-light)', 
      background: 'var(--background)', 
      padding: '4px 8px', 
      borderRadius: '4px' 
    }}>
      {appVersion.tag || appVersion.version}
    </span>
  );
}
