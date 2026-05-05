import { useMemo, useState } from 'react';
import { Inbox, Loader2 } from 'lucide-react';
import { Button, Input, cn } from '@librechat/client';
import type {
  AdminAuditAction,
  AdminAuditRow,
} from 'librechat-data-provider';
import { useAdminAuditQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';

const PAGE_SIZE = 50;
const CREDITS_PER_USD = 1_000_000;

const BRAND_INPUT_CLS =
  'rounded-[var(--brand-radius-sm)] border border-border-light bg-surface-primary px-2 py-1.5 text-sm text-text-primary focus:border-[var(--molinos-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-primary)]/30';

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: isoDateOnly(from), to: isoDateOnly(to) };
}

function shortDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function microToUsdLabel(micro?: number): string {
  if (typeof micro !== 'number' || !Number.isFinite(micro)) return '—';
  return `$${(micro / CREDITS_PER_USD).toFixed(2)}`;
}

function ActionBadge({ action }: { action: AdminAuditAction }) {
  const localize = useLocalize();
  const map: Record<AdminAuditAction, { label: string; color: string }> = {
    'budget.set_allocation': {
      label: localize('com_admin_audit_action_set_allocation'),
      color: 'var(--molinos-blue)',
    },
    'budget.reset_spent': {
      label: localize('com_admin_audit_action_reset_spent'),
      color: 'var(--molinos-orange)',
    },
    'budget.set_both': {
      label: localize('com_admin_audit_action_set_both'),
      color: 'var(--molinos-blue-dark)',
    },
  };
  const { label, color } = map[action] ?? {
    label: action,
    color: 'var(--molinos-neutral-500)',
  };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

function ChangeCell({ row }: { row: AdminAuditRow }) {
  const before = row.before;
  const after = row.after;

  const allocChanged =
    before?.allocatedCredits !== undefined &&
    after?.allocatedCredits !== undefined &&
    before.allocatedCredits !== after.allocatedCredits;
  const spentChanged =
    before?.spentCredits !== undefined &&
    after?.spentCredits !== undefined &&
    before.spentCredits !== after.spentCredits;

  if (!before && !after) return <span className="text-text-tertiary">—</span>;

  return (
    <div className="space-y-0.5 text-xs tabular-nums">
      {(allocChanged || (after?.allocatedCredits !== undefined && !before)) && (
        <div>
          <span className="text-text-tertiary">alloc:</span>{' '}
          <span className="text-text-tertiary">{microToUsdLabel(before?.allocatedCredits)}</span>{' '}
          <span className="text-text-tertiary">→</span>{' '}
          <span style={{ color: 'var(--molinos-blue)' }} className="font-semibold">
            {microToUsdLabel(after?.allocatedCredits)}
          </span>
        </div>
      )}
      {(spentChanged || (after?.spentCredits === 0 && (before?.spentCredits ?? 0) > 0)) && (
        <div>
          <span className="text-text-tertiary">spent:</span>{' '}
          <span className="text-text-tertiary">{microToUsdLabel(before?.spentCredits)}</span>{' '}
          <span className="text-text-tertiary">→</span>{' '}
          <span style={{ color: 'var(--molinos-orange)' }} className="font-semibold">
            {microToUsdLabel(after?.spentCredits)}
          </span>
        </div>
      )}
    </div>
  );
}

export default function AuditPanel() {
  const localize = useLocalize();
  const [{ from, to }, setRange] = useState(defaultRange);
  const [actionFilter, setActionFilter] = useState<AdminAuditAction | ''>('');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const params = useMemo(
    () => ({
      from: new Date(`${from}T00:00:00.000Z`).toISOString(),
      to: new Date(`${to}T23:59:59.999Z`).toISOString(),
      ...(actionFilter ? { action: actionFilter } : {}),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [from, to, actionFilter, page],
  );

  const { data, isFetching, error } = useAdminAuditQuery(params);

  const filtered = useMemo(() => {
    if (!data?.rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter((r) => {
      const haystack = [
        r.actor.email,
        r.target.email,
        r.resource.key,
        r.action,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data?.rows, search]);

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 rounded-[var(--brand-radius-lg)] border border-border-light bg-surface-primary p-4 shadow-[var(--brand-shadow-sm)] md:grid-cols-5">
        <Field label={localize('com_admin_usage_from')}>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setRange((r) => ({ ...r, from: e.target.value }));
              setPage(0);
            }}
            className={BRAND_INPUT_CLS}
          />
        </Field>
        <Field label={localize('com_admin_usage_to')}>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setRange((r) => ({ ...r, to: e.target.value }));
              setPage(0);
            }}
            className={BRAND_INPUT_CLS}
          />
        </Field>
        <Field label={localize('com_admin_audit_filter_action')}>
          <select
            className={BRAND_INPUT_CLS + ' w-full'}
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value as AdminAuditAction | '');
              setPage(0);
            }}
          >
            <option value="">{localize('com_admin_audit_filter_action_any')}</option>
            <option value="budget.set_allocation">
              {localize('com_admin_audit_action_set_allocation')}
            </option>
            <option value="budget.reset_spent">
              {localize('com_admin_audit_action_reset_spent')}
            </option>
            <option value="budget.set_both">
              {localize('com_admin_audit_action_set_both')}
            </option>
          </select>
        </Field>
        <Field label={localize('com_admin_usage_search')} className="md:col-span-2">
          <Input
            type="search"
            placeholder={localize('com_admin_audit_search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={BRAND_INPUT_CLS}
          />
        </Field>
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
                <th className="px-4 py-3 font-medium">{localize('com_admin_audit_col_when')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_audit_col_actor')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_audit_col_action')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_audit_col_target')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_audit_col_bucket')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_audit_col_change')}</th>
                <th className="px-3 py-3 font-medium">{localize('com_admin_audit_col_ip')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t border-border-light transition-colors',
                    i % 2 === 1 && 'bg-surface-secondary/40',
                    'hover:bg-[rgba(34,64,154,0.06)] dark:hover:bg-[rgba(255,255,255,0.04)]',
                  )}
                >
                  <td className="px-4 py-3 text-text-tertiary tabular-nums">
                    {shortDate(row.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-text-primary">{row.actor.email ?? row.actor.id}</div>
                    {row.actor.role && (
                      <div className="text-xs text-text-tertiary">{row.actor.role}</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <ActionBadge action={row.action} />
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {row.target.email ?? row.target.id}
                  </td>
                  <td className="px-3 py-3 text-text-tertiary">{row.resource.key}</td>
                  <td className="px-3 py-3">
                    <ChangeCell row={row} />
                  </td>
                  <td className="px-3 py-3 text-xs text-text-tertiary tabular-nums">
                    {row.context?.ip ?? '—'}
                  </td>
                </tr>
              ))}
              {!isFetching && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <div className="flex flex-col items-center gap-2 text-text-tertiary">
                      <Inbox className="h-6 w-6" aria-hidden="true" />
                      <span className="text-sm">{localize('com_admin_no_data')}</span>
                    </div>
                  </td>
                </tr>
              )}
              {isFetching && filtered.length === 0 && (
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
              data.offset + (data.rows?.length ?? 0) >= (data.total ?? 0)
            }
          >
            {localize('com_ui_next')}
          </Button>
        </div>
      </div>
    </div>
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
