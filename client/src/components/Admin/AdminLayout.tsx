import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@librechat/client';
import { useLocalize } from '~/hooks';
import AdminGuard from './AdminGuard';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-surface-active-alt text-text-primary'
      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  );

export default function AdminLayout() {
  const localize = useLocalize();
  return (
    <AdminGuard>
      <div className="flex h-full w-full flex-col bg-surface-primary">
        <header className="border-b border-border-light px-6 py-4">
          <h1 className="text-lg font-semibold text-text-primary">
            {localize('com_admin_title')}
          </h1>
          <nav className="mt-3 flex items-center gap-2" aria-label="Admin sections">
            <NavLink to="/admin/usage" className={tabClass}>
              {localize('com_admin_tab_usage')}
            </NavLink>
            <NavLink to="/admin/users" className={tabClass}>
              {localize('com_admin_tab_users')}
            </NavLink>
          </nav>
        </header>
        <main className="flex-1 overflow-auto px-6 py-6">
          <Outlet />
        </main>
      </div>
    </AdminGuard>
  );
}
