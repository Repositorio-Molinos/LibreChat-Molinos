import { useMemo, useState } from 'react';
import { Button, Input } from '@librechat/client';
import type { AdminUsageGroupBy, AdminUsageRow } from 'librechat-data-provider';
import { useAdminUsageQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';

const PAGE_SIZE = 50;

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: isoDateOnly(from), to: isoDateOnly(to) };
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0.00';
  return `$${value.toFixed(value < 1 ? 4 : 2)}`;
}

function formatTokens(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('es-AR').format(Math.round(value));
}

function shortDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function rowLabel(row: AdminUsageRow, groupBy: AdminUsageGroupBy): string {
  if (groupBy === 'model') return row.model ?? '—';
  if (groupBy === 'user') return row.email ?? row.userId ?? '—';
  return `${row.email ?? row.userId ?? '—'} · ${row.model ?? '—'}`;
}

export default function UsagePanel() {
  const localize = useLocalize();
  const [{ from, to }, setRange] = useState(defaultRange);
  const [groupBy, setGroupBy] = useState<AdminUsageGroupBy>('user');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const params = useMemo(
    () => ({
      from: new Date(`${from}T00:00:00.000Z`).toISOString(),
      to: new Date(`${to}T23:59:59.999Z`).toISOString(),
      groupBy,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [from, to, groupBy, page],
  );

  const { data, isFetching, error } = useAdminUsageQuery(params);

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter((r) => {
      const haystack = [r.email, r.name, r.userId, r.model].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [data?.rows, search]);

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 rounded-lg border border-border-light bg-surface-secondary p-4 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">{localize('com_admin_usage_from')}</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setRange((r) => ({ ...r, from: e.target.value }));
              setPage(0);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">{localize('com_admin_usage_to')}</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setRange((r) => ({ ...r, to: e.target.value }));
              setPage(0);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-tertiary">{localize('com_admin_usage_group_by')}</span>
          <select
            className="rounded-md border border-border-light bg-surface-primary px-2 py-1.5 text-sm"
            value={groupBy}
            onChange={(e) => {
              setGroupBy(e.target.value as AdminUsageGroupBy);
              setPage(0);
            }}
          >
            <option value="user">{localize('com_admin_usage_group_user')}</option>
            <option value="model">{localize('com_admin_usage_group_model')}</option>
            <option value="user-model">{localize('com_admin_usage_group_user_model')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs md:col-span-2">
          <span className="text-text-tertiary">{localize('com_admin_usage_search')}</span>
          <Input
            type="search"
            placeholder={localize('com_admin_usage_search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </section>

      {error != null && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {localize('com_admin_error_load')}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={localize('com_admin_total_spent')} value={formatUsd(data?.totals.spentUsd ?? 0)} />
        <Stat label={localize('com_admin_unique_users')} value={String(data?.totals.uniqueUsers ?? 0)} />
        <Stat label={localize('com_admin_unique_models')} value={String(data?.totals.uniqueModels ?? 0)} />
      </section>

      <section className="overflow-x-auto rounded-lg border border-border-light">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-secondary text-left text-xs uppercase text-text-tertiary">
            <tr>
              <th className="px-3 py-2">{localize('com_admin_col_group')}</th>
              <th className="px-3 py-2 text-right">{localize('com_admin_col_prompt')}</th>
              <th className="px-3 py-2 text-right">{localize('com_admin_col_completion')}</th>
              <th className="px-3 py-2 text-right">{localize('com_admin_col_cache')}</th>
              <th className="px-3 py-2 text-right">{localize('com_admin_col_total')}</th>
              <th className="px-3 py-2 text-right">{localize('com_admin_col_spent')}</th>
              <th className="px-3 py-2">{localize('com_admin_col_last')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.groupKey} className="border-t border-border-light hover:bg-surface-hover">
                <td className="px-3 py-2 font-medium text-text-primary">
                  {rowLabel(row, groupBy)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTokens(row.promptTokens)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTokens(row.completionTokens)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTokens(row.cacheTokens)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatTokens(row.totalTokens)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatUsd(row.spentUsd)}</td>
                <td className="px-3 py-2 text-text-tertiary">{shortDate(row.lastAt)}</td>
              </tr>
            ))}
            {!isFetching && filteredRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-text-tertiary">
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
            shown: filteredRows.length,
            total: data?.groupCount ?? 0,
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
              (data.offset + (data.rows?.length ?? 0)) >= (data.groupCount ?? 0)
            }
          >
            {localize('com_ui_next')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-light bg-surface-secondary px-4 py-3">
      <div className="text-xs uppercase text-text-tertiary">{label}</div>
      <div className="mt-1 text-xl font-semibold text-text-primary tabular-nums">{value}</div>
    </div>
  );
}
