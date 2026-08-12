import React from 'react';
import { createPortal } from 'react-dom';
import { DashLoading } from 'respinner';
import { cn } from '../utils';

interface LoadingProps {
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl';
  color?: string;
  fullPage?: boolean;
  text?: string;
  className?: string;
}

const sizeMap = {
  xs: { size: 20, textSize: 'text-xs' },
  sm: { size: 24, textSize: 'text-sm' },
  default: { size: 32, textSize: 'text-sm' },
  lg: { size: 40, textSize: 'text-base' },
  xl: { size: 48, textSize: 'text-lg' },
};

export const Loading: React.FC<LoadingProps> = ({
  size = 'default',
  color = '#059669',
  fullPage = false,
  text,
  className,
}) => {
  const sizeConfig = sizeMap[size];

  const loadingContent = (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <DashLoading color={color} size={sizeConfig.size} />
      {text && (
        <span className={cn('text-slate-600 font-medium', sizeConfig.textSize)}>
          {text}
        </span>
      )}
    </div>
  );

  if (fullPage) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
        {loadingContent}
      </div>,
      document.body
    );
  }

  return loadingContent;
};

export const InlineLoading: React.FC<Omit<LoadingProps, 'fullPage' | 'text'>> = (props) => (
  <Loading {...props} size={props.size || 'xs'} />
);

export const FullPageLoading: React.FC<Omit<LoadingProps, 'fullPage'>> = (props) => (
  <Loading {...props} fullPage text={props.text || 'Loading...'} />
);

const buttonLoadingSizeMap = {
  xs: { spinner: 16, text: 'text-xs' },
  sm: { spinner: 18, text: 'text-sm' },
  default: { spinner: 20, text: 'text-sm' },
  lg: { spinner: 24, text: 'text-base' },
} as const;

export const ButtonLoading: React.FC<{ text?: string; light?: boolean; size?: keyof typeof buttonLoadingSizeMap }> = ({
  text = 'Loading...',
  light = false,
  size = 'default',
}) => {
  const config = buttonLoadingSizeMap[size];

  return (
    <div className="flex items-center justify-center gap-2">
      <DashLoading color={light ? '#ffffff' : '#059669'} size={config.spinner} />
      <span className={config.text}>{text}</span>
    </div>
  );
};

export const SectionLoading: React.FC<{
  text?: string;
  minHeight?: string;
  className?: string;
}> = ({ text = 'Loading...', minHeight = '200px', className }) => (
  <div className={cn("flex flex-col items-center justify-center w-full", className)} style={{ minHeight }}>
    <Loading text={text} size="default" />
  </div>
);
