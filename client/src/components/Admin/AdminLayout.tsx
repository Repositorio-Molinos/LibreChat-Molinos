import { NavLink, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@librechat/client';
import { BrandLogo } from '~/brand';
import { useLocalize } from '~/hooks';
import AdminGuard from './AdminGuard';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150',
    isActive
      ? 'bg-[var(--molinos-blue)] text-white shadow-[var(--brand-shadow-sm)]'
      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  );

export default function AdminLayout() {
  const localize = useLocalize();
  return (
    <AdminGuard>
      <div className="flex h-full w-full flex-col bg-surface-primary">
        <header className="border-b border-border-light bg-surface-primary px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-9 w-9 rounded-[var(--brand-radius-md)]" />
              <div>
                <h1
                  className="text-lg font-semibold leading-tight"
                  style={{ color: 'var(--molinos-blue)' }}
                >
                  {localize('com_admin_title')}
                </h1>
                <p className="text-xs text-text-tertiary">{localize('com_admin_subtitle')}</p>
              </div>
            </div>
            <NavLink
              to="/c/new"
              className="inline-flex items-center gap-1.5 rounded-full border border-border-light px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {localize('com_admin_back_to_chat')}
            </NavLink>
          </div>
          <nav
            className="mt-5 inline-flex items-center gap-1 rounded-full border border-border-light bg-surface-secondary p-1"
            aria-label="Admin sections"
          >
            <NavLink to="/admin/usage" className={tabClass}>
              {localize('com_admin_tab_usage')}
            </NavLink>
            <NavLink to="/admin/users" className={tabClass}>
              {localize('com_admin_tab_users')}
            </NavLink>
          </nav>
        </header>
        <main className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
