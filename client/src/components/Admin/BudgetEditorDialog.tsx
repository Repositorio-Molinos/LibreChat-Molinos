import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  OGDialog,
  OGDialogTemplate,
  cn,
  useToastContext,
} from '@librechat/client';
import type { AdminBudgetSnapshot, AdminUserListItem } from 'librechat-data-provider';
import { useAdminUserBudgetsQuery, useSetUserBudgetMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

const CREDITS_PER_USD = 1_000_000;

function microToUsd(value: number): number {
  return Number((value / CREDITS_PER_USD).toFixed(2));
}

function shortDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'medium' });
}

function spentColor(ratio: number): string {
  if (ratio >= 0.9) return 'var(--molinos-red)';
  if (ratio >= 0.65) return 'var(--molinos-orange)';
  return 'var(--molinos-blue)';
}

interface Props {
  user: AdminUserListItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BudgetEditorDialog({ user, isOpen, onClose }: Props) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const userId = user?.id;
  const { data, isLoading, error } = useAdminUserBudgetsQuery(userId, {
    enabled: isOpen && !!userId,
  });
  const setBudget = useSetUserBudgetMutation();

  const budgets: AdminBudgetSnapshot[] = data?.budgets ?? [];

  return (
    <OGDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <OGDialogTemplate
        className="sm:max-w-2xl"
        title={user ? user.name || user.email || user.id : localize('com_admin_budgets_title')}
        headerClassName="px-6 pt-6 pb-2"
        main={
          <div className="space-y-4 px-6 pb-2">
            {user && (
              <p className="text-xs text-text-tertiary">{user.email}</p>
            )}
            {error != null && (
              <div className="rounded-[var(--brand-radius-md)] border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {localize('com_admin_error_load')}
              </div>
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-text-tertiary">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {localize('com_ui_loading')}
              </div>
            )}
            {!isLoading && budgets.length === 0 && (
              <p className="text-sm text-text-tertiary">{localize('com_admin_no_budgets')}</p>
            )}
            <div className="space-y-3">
              {budgets.map((b) => (
                <BudgetRow
                  key={b.bucket}
                  budget={b}
                  saving={setBudget.isLoading}
                  onSave={async (allocatedUsd, allocChanged, resetSpent) => {
                    if (!userId) return;
                    if (!allocChanged && !resetSpent) return;
                    try {
                      await setBudget.mutateAsync({
                        userId,
                        bucket: b.bucket,
                        payload: {
                          ...(allocChanged ? { allocatedUsd } : {}),
                          ...(resetSpent ? { spentUsd: 0 } : {}),
                        },
                      });
                      showToast({
                        message: localize('com_admin_budget_saved'),
                        status: 'success',
                      });
                    } catch (err) {
                      showToast({
                        message:
                          err instanceof Error ? err.message : localize('com_admin_budget_save_error'),
                        status: 'error',
                      });
                    }
                  }}
                />
              ))}
            </div>
          </div>
        }
        footerClassName="flex justify-end gap-2 px-6 pb-6 pt-2"
        selection={{
          selectHandler: onClose,
          selectClasses:
            'bg-surface-secondary hover:bg-surface-hover text-text-primary border border-border-light',
          selectText: localize('com_ui_close'),
        }}
        showCancelButton={false}
      />
    </OGDialog>
  );
}

function BudgetRow({
  budget,
  saving,
  onSave,
}: {
  budget: AdminBudgetSnapshot;
  saving: boolean;
  onSave: (allocatedUsd: number, allocChanged: boolean, resetSpent: boolean) => void;
}) {
  const localize = useLocalize();
  const [allocatedUsd, setAllocatedUsd] = useState(microToUsd(budget.allocatedCredits));
  const [resetSpent, setResetSpent] = useState(false);

  useEffect(() => {
    setAllocatedUsd(microToUsd(budget.allocatedCredits));
    setResetSpent(false);
  }, [budget.allocatedCredits, budget.bucket]);

  const allocatedUsdSnap = microToUsd(budget.allocatedCredits);
  const spentUsd = microToUsd(budget.spentCredits);
  const remainingUsd = microToUsd(budget.remainingCredits);
  const ratio = allocatedUsdSnap > 0 ? Math.min(spentUsd / allocatedUsdSnap, 1) : 0;
  const barColor = spentColor(ratio);
  const dirty = allocatedUsd !== allocatedUsdSnap || resetSpent;

  return (
    <div className="rounded-[var(--brand-radius-md)] border border-border-light bg-surface-secondary/40 p-4 transition-colors">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-text-primary">
            {budget.label || budget.bucket}
          </div>
          <div className="text-xs text-text-tertiary">
            {localize('com_admin_budget_period_until', { date: shortDate(budget.periodEnd) }) as string}
          </div>
        </div>
        <div className="text-right text-xs tabular-nums">
          <div>
            <span className="font-semibold text-text-primary">${spentUsd.toFixed(2)}</span>
            <span className="text-text-tertiary"> / ${allocatedUsdSnap.toFixed(2)}</span>
          </div>
          <div className="text-text-tertiary">
            {localize('com_admin_budget_remaining')}:{' '}
            <span className="font-medium" style={{ color: barColor }}>
              ${remainingUsd.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-border-light"
        role="progressbar"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${ratio * 100}%`, backgroundColor: barColor }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-text-tertiary">{localize('com_admin_budget_allocated_usd')}</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={Number.isFinite(allocatedUsd) ? allocatedUsd : 0}
            onChange={(e) => setAllocatedUsd(Number(e.target.value))}
            className="rounded-[var(--brand-radius-sm)] border border-border-light bg-surface-primary px-2 py-1.5 text-sm focus:border-[var(--molinos-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-primary)]/30"
          />
        </Label>
        <label className="flex items-center gap-2 pb-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={resetSpent}
            onChange={(e) => setResetSpent(e.target.checked)}
            className="h-4 w-4 rounded border-border-light accent-[var(--molinos-blue)]"
          />
          <span>{localize('com_admin_budget_reset_spent')}</span>
        </label>
        <Button
          size="sm"
          disabled={saving || !dirty || !Number.isFinite(allocatedUsd) || allocatedUsd < 0}
          onClick={() => onSave(allocatedUsd, allocatedUsd !== allocatedUsdSnap, resetSpent)}
          className={cn(
            'gap-1.5 text-white',
            'hover:opacity-90',
          )}
          style={{ backgroundColor: 'var(--molinos-blue)' }}
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {saving ? localize('com_ui_saving') : localize('com_ui_save')}
        </Button>
      </div>
    </div>
  );
}
