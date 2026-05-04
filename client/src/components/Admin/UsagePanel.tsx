import { useMemo, useState } from 'react';
import { TrendingUp, Users as UsersIcon, Boxes, Inbox, Loader2 } from 'lucide-react';
import { Button, Input, cn } from '@librechat/client';
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

function rowSubtitle(row: AdminUsageRow, groupBy: AdminUsageGroupBy): string | null {
  if (groupBy === 'user' && row.name) return row.name;
  return null;
}

const BRAND_INPUT_CLS =
  'rounded-[var(--brand-radius-sm)] border border-border-light bg-surface-primary px-2 py-1.5 text-sm text-text-primary focus:border-[var(--molinos-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-primary)]/30';

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
    <div className="flex flex-col gap-5">
      <FiltersCard
        from={from}
        to={to}
        groupBy={groupBy}
        search={search}
        onChange={(patch) => {
          if (patch.from != null) setRange((r) => ({ ...r, from: patch.from as string }));
          if (patch.to != null) setRange((r) => ({ ...r, to: patch.to as string }));
          if (patch.groupBy != null) setGroupBy(patch.groupBy);
          if (patch.search != null) setSearch(patch.search);
          if (patch.from != null || patch.to != null || patch.groupBy != null) setPage(0);
        }}
      />

      {error != null && (
        <div className="rounded-[var(--brand-radius-md)] border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {localize('com_admin_error_load')}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<TrendingUp className="h-4 w-4" />}
          label={localize('com_admin_total_spent')}
          value={formatUsd(data?.totals.spentUsd ?? 0)}
        />
        <Stat
          icon={<UsersIcon className="h-4 w-4" />}
          label={localize('com_admin_unique_users')}
          value={String(data?.totals.uniqueUsers ?? 0)}
        />
        <Stat
          icon={<Boxes className="h-4 w-4" />}
          label={localize('com_admin_unique_models')}
          value={String(data?.totals.uniqueModels ?? 0)}
        />
      </section>

      <section
        className="overflow-hidden rounded-[var(--brand-radius-lg)] border border-border-light bg-surface-primary shadow-[var(--brand-shadow-sm)]"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">{localize('com_admin_col_group')}</th>
                <th className="px-3 py-3 text-right font-medium">{localize('com_admin_col_prompt')}</th>
                <th className="px-3 py-3 text-right font-medium">{localize('com_admin_col_completion')}</th>
                <th className="px-3 py-3 text-right font-medium">{localize('com_admin_col_cache')}</th>
                <th className="px-3 py-3 text-right font-medium">{localize('com_admin_col_total')}</th>
                <th className="px-3 py-3 text-right font-medium">{localize('com_admin_col_spent')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_col_last')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const subtitle = rowSubtitle(row, groupBy);
                return (
                  <tr
                    key={row.groupKey}
                    className={cn(
                      'border-t border-border-light transition-colors',
                      i % 2 === 1 && 'bg-surface-secondary/40',
                      'hover:bg-[rgba(34,64,154,0.06)] dark:hover:bg-[rgba(255,255,255,0.04)]',
                    )}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="font-medium text-text-primary">
                        {rowLabel(row, groupBy)}
                      </div>
                      {subtitle && (
                        <div className="text-xs text-text-tertiary">{subtitle}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-text-secondary">
                      {formatTokens(row.promptTokens)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-text-secondary">
                      {formatTokens(row.completionTokens)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-text-secondary">
                      {row.cacheTokens > 0 ? formatTokens(row.cacheTokens) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium text-text-primary">
                      {formatTokens(row.totalTokens)}
                    </td>
                    <td
                      className="px-3 py-3 text-right font-semibold tabular-nums"
                      style={{ color: 'var(--molinos-blue)' }}
                    >
                      {formatUsd(row.spentUsd)}
                    </td>
                    <td className="px-3 py-3 text-text-tertiary">{shortDate(row.lastAt)}</td>
                  </tr>
                );
              })}
              {!isFetching && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <div className="flex flex-col items-center gap-2 text-text-tertiary">
                      <Inbox className="h-6 w-6" aria-hidden="true" />
                      <span className="text-sm">{localize('com_admin_no_data')}</span>
                    </div>
                  </td>
                </tr>
              )}
              {isFetching && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
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

interface FilterPatch {
  from?: string;
  to?: string;
  groupBy?: AdminUsageGroupBy;
  search?: string;
}

function FiltersCard({
  from,
  to,
  groupBy,
  search,
  onChange,
}: {
  from: string;
  to: string;
  groupBy: AdminUsageGroupBy;
  search: string;
  onChange: (patch: FilterPatch) => void;
}) {
  const localize = useLocalize();
  return (
    <section className="grid gap-3 rounded-[var(--brand-radius-lg)] border border-border-light bg-surface-primary p-4 shadow-[var(--brand-shadow-sm)] md:grid-cols-5">
      <Field label={localize('com_admin_usage_from')}>
        <Input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value })}
          className={BRAND_INPUT_CLS}
        />
      </Field>
      <Field label={localize('com_admin_usage_to')}>
        <Input
          type="date"
          value={to}
          onChange={(e) => onChange({ to: e.target.value })}
          className={BRAND_INPUT_CLS}
        />
      </Field>
      <Field label={localize('com_admin_usage_group_by')}>
        <select
          className={BRAND_INPUT_CLS + ' w-full'}
          value={groupBy}
          onChange={(e) => onChange({ groupBy: e.target.value as AdminUsageGroupBy })}
        >
          <option value="user">{localize('com_admin_usage_group_user')}</option>
          <option value="model">{localize('com_admin_usage_group_model')}</option>
          <option value="user-model">{localize('com_admin_usage_group_user_model')}</option>
        </select>
      </Field>
      <Field label={localize('com_admin_usage_search')} className="md:col-span-2">
        <Input
          type="search"
          placeholder={localize('com_admin_usage_search_placeholder')}
          value={search}
          onChange={(e) => onChange({ search: e.target.value })}
          className={BRAND_INPUT_CLS}
        />
      </Field>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs', className)}>
      <span className="text-text-tertiary">{label}</span>
      {children}
    </label>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--brand-radius-lg)] border border-border-light bg-surface-primary px-4 py-3 shadow-[var(--brand-shadow-sm)] transition-shadow hover:shadow-[var(--brand-shadow-md)]',
        accent && 'border-l-4',
      )}
      style={accent ? { borderLeftColor: 'var(--molinos-blue)' } : undefined}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-text-tertiary">
        <span style={{ color: 'var(--molinos-blue)' }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={accent ? { color: 'var(--molinos-blue)' } : { color: 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}
