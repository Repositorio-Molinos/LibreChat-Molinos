import { useMemo, useState } from 'react';
import { Inbox, Loader2, Settings2 } from 'lucide-react';
import { Button, Input, cn } from '@librechat/client';
import { SystemRoles } from 'librechat-data-provider';
import type { AdminUserListItem } from 'librechat-data-provider';
import { useAdminUsersQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import BudgetEditorDialog from './BudgetEditorDialog';

const PAGE_SIZE = 50;

const BRAND_INPUT_CLS =
  'rounded-[var(--brand-radius-sm)] border border-border-light bg-surface-primary px-2 py-1.5 text-sm text-text-primary focus:border-[var(--molinos-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-primary)]/30';

function shortDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'medium' });
}

function userInitials(u: AdminUserListItem): string {
  const source = u.name || u.username || u.email || '?';
  return source
    .split(/\s+|@|\./)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === SystemRoles.ADMIN;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        isAdmin
          ? 'bg-[var(--molinos-red)]/12 text-[var(--molinos-red)]'
          : 'bg-surface-secondary text-text-secondary',
      )}
    >
      {role}
    </span>
  );
}

function UserAvatar({ u }: { u: AdminUserListItem }) {
  if (u.avatar) {
    return (
      <img
        src={u.avatar}
        alt=""
        className="h-8 w-8 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: 'var(--molinos-blue)' }}
      aria-hidden="true"
    >
      {userInitials(u)}
    </div>
  );
}

export default function UsersPanel() {
  const localize = useLocalize();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminUserListItem | null>(null);

  const { data, isFetching, error } = useAdminUsersQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const filtered = useMemo(() => {
    if (!data?.users) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter((u) =>
      [u.email, u.name, u.username, u.id].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [data?.users, search]);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-end gap-3 rounded-[var(--brand-radius-lg)] border border-border-light bg-surface-primary p-4 shadow-[var(--brand-shadow-sm)]">
        <label className="flex flex-1 flex-col gap-1 text-xs sm:max-w-md">
          <span className="text-text-tertiary">{localize('com_admin_usage_search')}</span>
          <Input
            type="search"
            placeholder={localize('com_admin_users_search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={BRAND_INPUT_CLS}
          />
        </label>
        <span className="rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-text-secondary">
          {localize('com_admin_users_total', { total: data?.total ?? 0 }) as string}
        </span>
      </section>

      {error != null && (
        <div className="rounded-[var(--brand-radius-md)] border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {localize('com_admin_error_load')}
        </div>
      )}

      <section className="overflow-hidden rounded-[var(--brand-radius-lg)] border border-border-light bg-surface-primary shadow-[var(--brand-shadow-sm)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">{localize('com_admin_users_col_name')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_users_col_email')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_users_col_role')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_users_col_provider')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_users_col_created')}</th>
                <th className="px-3 py-3 text-right font-medium">{localize('com_admin_users_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr
                  key={u.id}
                  className={cn(
                    'border-t border-border-light transition-colors',
                    i % 2 === 1 && 'bg-surface-secondary/40',
                    'hover:bg-[rgba(34,64,154,0.06)] dark:hover:bg-[rgba(255,255,255,0.04)]',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar u={u} />
                      <div className="font-medium text-text-primary">
                        {u.name || u.username}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-text-secondary">{u.email}</td>
                  <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-3 py-3 text-text-tertiary">{u.provider}</td>
                  <td className="px-3 py-3 text-text-tertiary">{shortDate(u.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(u)}
                      className="gap-1.5"
                    >
                      <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {localize('com_admin_users_edit_budget')}
                    </Button>
                  </td>
                </tr>
              ))}
              {!isFetching && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="flex flex-col items-center gap-2 text-text-tertiary">
                      <Inbox className="h-6 w-6" aria-hidden="true" />
                      <span className="text-sm">{localize('com_admin_no_data')}</span>
                    </div>
                  </td>
                </tr>
              )}
              {isFetching && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="flex items-center justify-center gap-2 text-text-tertiary">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span className="text-sm">{localize('com_ui_loading')}</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-tertiary">
        <span>
          {localize('com_admin_pagination_info', {
            shown: filtered.length,
            total: data?.total ?? 0,
          }) as string}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isFetching}
          >
            {localize('com_ui_prev')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={
              isFetching ||
              !data ||
              (data.offset + (data.users?.length ?? 0)) >= (data.total ?? 0)
            }
          >
            {localize('com_ui_next')}
          </Button>
        </div>
      </div>

      <BudgetEditorDialog
        user={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
