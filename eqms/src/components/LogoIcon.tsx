import React from 'react';
import logoImg from '../assets/images/favicon/document-color-32.png';

interface LogoIconProps {
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export const LogoIcon: React.FC<LogoIconProps> = ({
  className = '',
  style,
  alt = 'Logo',
}) => {
  return (
    <img
      src={logoImg}
      alt={alt}
      className={className}
      style={style}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.style.display = 'none';
      }}
    />
  );
};
