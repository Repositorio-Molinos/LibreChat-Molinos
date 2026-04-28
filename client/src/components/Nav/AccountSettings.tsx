import { useState, memo, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import * as Menu from '@ariakit/react/menu';
import { FileText, LogOut } from 'lucide-react';
import { LinkIcon, GearIcon, DropdownMenuSeparator, Avatar } from '@librechat/client';
import { MyFilesModal } from '~/components/Chat/Input/Files/MyFilesModal';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import store from '~/store';
import Settings from './Settings';

function AccountSettings({ collapsed = false }: { collapsed?: boolean }) {
  const localize = useLocalize();
  const { user, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const accountSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const activeConversation = useRecoilValue(store.conversationByIndex(0));
  const activeModel = (activeConversation?.model ?? '').toLowerCase();
  const activeBudgets = (balanceQuery.data?.modelBudgets ?? []).filter((b) => {
    if (!activeModel) return false;
    return (b.match ?? []).some((p) => p && activeModel.includes(p.toLowerCase()));
  });

  return (
    <Menu.MenuProvider>
      <Menu.MenuButton
        ref={accountSettingsButtonRef}
        aria-label={localize('com_nav_account_settings')}
        data-testid="nav-user"
        className={
          collapsed
            ? 'flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-active-alt aria-[expanded=true]:bg-surface-active-alt'
            : 'mt-text-sm flex h-auto w-full items-center gap-2 rounded-xl p-2 text-sm transition-all duration-200 ease-in-out hover:bg-surface-active-alt aria-[expanded=true]:bg-surface-active-alt'
        }
      >
        <div
          className={collapsed ? 'size-8 flex-shrink-0' : '-ml-0.9 -mt-0.8 h-8 w-8 flex-shrink-0'}
        >
          <div className="relative flex">
            <Avatar user={user} size={collapsed ? 32 : 32} />
          </div>
        </div>
        {!collapsed && (
          <div
            className="mt-2 grow overflow-hidden text-ellipsis whitespace-nowrap text-left text-text-primary"
            style={{ marginTop: '0', marginLeft: '0' }}
          >
            {user?.name ?? user?.username ?? localize('com_nav_user')}
          </div>
        )}
      </Menu.MenuButton>
      <Menu.Menu
        portal
        className="account-settings-popover popover-ui z-[125] w-[min(92vw,320px)] rounded-lg"
        placement={collapsed ? 'right-end' : undefined}
        style={{
          transformOrigin: collapsed ? 'left bottom' : 'bottom',
          translate: collapsed ? '4px 0' : '0 -4px',
        }}
      >
        <div className="flex items-center gap-3 px-3 py-3" role="note">
          <div className="h-10 w-10 flex-shrink-0">
            <Avatar user={user} size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-text-primary">
              {user?.name ?? user?.username ?? localize('com_nav_user')}
            </div>
            <div className="truncate text-xs text-text-tertiary">{user?.email ?? ''}</div>
          </div>
        </div>
        {activeBudgets.length > 0 ? (
          activeBudgets.map((b) => {
            const remainingUsd = (b.remainingCredits ?? 0) / 1_000_000;
            const allocatedUsd = (b.allocatedCredits ?? 0) / 1_000_000;
            return (
              <div
                key={b.bucket}
                className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                role="note"
              >
                <span className="truncate text-text-tertiary">Saldo restante</span>
                <span
                  className="tabular-nums font-bold"
                  style={{ color: 'var(--molinos-blue)' }}
                >
                  ${remainingUsd.toFixed(2)} / ${allocatedUsd.toFixed(2)}
                </span>
              </div>
            );
          })
        ) : startupConfig?.balance?.enabled === true && balanceQuery.data != null ? (
          <div
            className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
            role="note"
          >
            <span className="truncate text-text-tertiary">
              {localize('com_nav_balance')}
            </span>
            <span className="tabular-nums text-text-primary">
              {new Intl.NumberFormat().format(Math.round(balanceQuery.data.tokenCredits))}
            </span>
          </div>
        ) : null}
        <DropdownMenuSeparator />
        <Menu.MenuItem onClick={() => setShowFiles(true)} className="select-item text-sm">
          <FileText className="icon-md" aria-hidden="true" />
          {localize('com_nav_my_files')}
        </Menu.MenuItem>
        {startupConfig?.helpAndFaqURL !== '/' && (
          <Menu.MenuItem
            onClick={() => window.open(startupConfig?.helpAndFaqURL, '_blank')}
            className="select-item text-sm"
          >
            <LinkIcon aria-hidden="true" />
            {localize('com_nav_help_faq')}
          </Menu.MenuItem>
        )}
        <Menu.MenuItem onClick={() => setShowSettings(true)} className="select-item text-sm">
          <GearIcon className="icon-md" aria-hidden="true" />
          {localize('com_nav_settings')}
        </Menu.MenuItem>
        <DropdownMenuSeparator />
        <Menu.MenuItem
          onClick={() => logout()}
          className="select-item text-sm"
          style={{ color: 'var(--molinos-red)' }}
        >
          <LogOut className="icon-md" aria-hidden="true" style={{ color: 'var(--molinos-red)' }} />
          {localize('com_nav_log_out')}
        </Menu.MenuItem>
      </Menu.Menu>
      {showFiles && (
        <MyFilesModal
          open={showFiles}
          onOpenChange={setShowFiles}
          triggerRef={accountSettingsButtonRef}
        />
      )}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </Menu.MenuProvider>
  );
}

export default memo(AccountSettings);
