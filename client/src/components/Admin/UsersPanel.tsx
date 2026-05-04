import { useMemo, useState } from 'react';
import { Button, Input } from '@librechat/client';
import type { AdminUserListItem } from 'librechat-data-provider';
import { useAdminUsersQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import BudgetEditorDialog from './BudgetEditorDialog';

const PAGE_SIZE = 50;

function shortDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'medium' });
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
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border-light bg-surface-secondary p-4">
        <label className="flex flex-1 flex-col gap-1 text-xs sm:max-w-md">
          <span className="text-text-tertiary">{localize('com_admin_usage_search')}</span>
          <Input
            type="search"
            placeholder={localize('com_admin_users_search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="text-xs text-text-tertiary">
          {localize('com_admin_users_total', { total: data?.total ?? 0 }) as string}
        </span>
      </section>

      {error != null && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {localize('com_admin_error_load')}
        </div>
      )}

      <section className="overflow-x-auto rounded-lg border border-border-light">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-secondary text-left text-xs uppercase text-text-tertiary">
            <tr>
              <th className="px-3 py-2">{localize('com_admin_users_col_name')}</th>
              <th className="px-3 py-2">{localize('com_admin_users_col_email')}</th>
              <th className="px-3 py-2">{localize('com_admin_users_col_role')}</th>
              <th className="px-3 py-2">{localize('com_admin_users_col_provider')}</th>
              <th className="px-3 py-2">{localize('com_admin_users_col_created')}</th>
              <th className="px-3 py-2 text-right">{localize('com_admin_users_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-border-light hover:bg-surface-hover">
                <td className="px-3 py-2 font-medium text-text-primary">{u.name || u.username}</td>
                <td className="px-3 py-2 text-text-secondary">{u.email}</td>
                <td className="px-3 py-2 text-text-tertiary">{u.role}</td>
                <td className="px-3 py-2 text-text-tertiary">{u.provider}</td>
                <td className="px-3 py-2 text-text-tertiary">{shortDate(u.createdAt)}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelected(u)}>
                    {localize('com_admin_users_edit_budget')}
                  </Button>
                </td>
              </tr>
            ))}
            {!isFetching && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-text-tertiary">
                  {localize('com_admin_no_data')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between text-xs text-text-tertiary">
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
