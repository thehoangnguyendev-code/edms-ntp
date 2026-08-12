import React from 'react';
import { cn } from '../utils';

/**
 * Responsive Card Components
 * Optimized for Desktop and Tablet (iPad portrait & landscape)
 */

/**
 * Card component props
 */
export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  hover = false,
  padding = 'md',
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-2 md:p-3',
    md: 'p-4 md:p-5',
    lg: 'p-6 md:p-8',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 shadow-sm',
        paddingClasses[padding],
        // Hover effect
        hover && 'transition-all hover:shadow-md hover:border-slate-200 hover:scale-[1.01]',
        className
      )}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'flex flex-col space-y-2 md:space-y-3',
        'pb-4 md:pb-6 border-b border-slate-200',
        className
      )}
    >
      {children}
    </div>
  );
};

export interface CardTitleProps extends CardProps {
  /** 'default' = page/section heading (text-lg md:text-xl lg:text-2xl). 'sm' = compact card/panel header (text-sm font-semibold), replacing hand-rolled `<h3 className="text-sm font-semibold">` headers. */
  size?: 'default' | 'sm';
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className, size = 'default' }) => {
  return (
    <h3
      className={cn(
        'text-slate-900',
        size === 'sm' ? 'text-sm font-semibold' : 'font-bold text-lg md:text-xl lg:text-2xl',
        className
      )}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<CardProps> = ({ children, className }) => {
  return (
    <p
      className={cn(
        'text-slate-600',
        // Responsive font size
        'text-sm md:text-base',
        className
      )}
    >
      {children}
    </p>
  );
};

export const CardContent: React.FC<CardProps> = ({ children, className, padding = 'md' }) => {
  const paddingClasses = {
    none: '',
    sm: 'pt-3 md:pt-4',
    md: 'pt-4 md:pt-6',
    lg: 'pt-6 md:pt-8',
  };

  return (
    <div className={cn(paddingClasses[padding], className)}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 md:gap-3',
        'pt-4 md:pt-6 border-t border-slate-200',
        // Responsive layout
        'flex-col sm:flex-row',
        className
      )}
    >
      {children}
    </div>
  );
};
