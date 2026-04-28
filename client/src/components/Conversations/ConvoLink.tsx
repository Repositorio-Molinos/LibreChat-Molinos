import React from 'react';
import { cn } from '~/utils';

interface ConvoLinkProps {
  isActiveConvo: boolean;
  isPopoverActive: boolean;
  title: string | null;
  onRename: () => void;
  isSmallScreen: boolean;
  localize: (key: any, options?: any) => string;
  children: React.ReactNode;
  timestamp?: string;
}

const ConvoLink: React.FC<ConvoLinkProps> = ({
  isActiveConvo,
  isPopoverActive,
  title,
  onRename,
  isSmallScreen,
  localize,
  children,
  timestamp,
}) => {
  return (
    <div
      className={cn('flex grow items-center gap-2 overflow-hidden rounded-lg px-2')}
      title={title ?? undefined}
      aria-current={isActiveConvo ? 'page' : undefined}
      style={{ width: '100%' }}
    >
      {children}
      <div
        className="relative flex flex-1 grow flex-col overflow-hidden"
        onDoubleClick={(e) => {
          if (isSmallScreen) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          onRename();
        }}
        aria-label={title || localize('com_ui_untitled')}
      >
        <span
          className="overflow-hidden whitespace-nowrap"
          style={{ textOverflow: 'ellipsis' }}
        >
          {title || localize('com_ui_untitled')}
        </span>
        {timestamp ? <span data-brand-convo-time>{timestamp}</span> : null}
      </div>
      <div
        className={cn(
          'pointer-events-none absolute bottom-0.5 right-0.5 top-0.5 w-20 rounded-r-md bg-gradient-to-l',
          isActiveConvo || isPopoverActive
            ? 'from-surface-active-alt'
            : 'from-surface-primary-alt from-0% to-transparent group-hover:from-surface-active-alt group-hover:from-40%',
        )}
        aria-hidden="true"
      />
    </div>
  );
};

export default ConvoLink;
