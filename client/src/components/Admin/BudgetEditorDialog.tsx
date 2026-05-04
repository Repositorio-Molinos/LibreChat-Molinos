import { useEffect, useState } from 'react';
import { Button, Input, Label, OGDialog, OGDialogTemplate, useToastContext } from '@librechat/client';
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

interface Props {
  user: AdminUserListItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BudgetEditorDialog({ user, isOpen, onClose }: Props) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const userId = user?.id;
  const { data, isLoading, error } = useAdminUserBudgetsQuery(userId, { enabled: isOpen && !!userId });
  const setBudget = useSetUserBudgetMutation();

  const budgets: AdminBudgetSnapshot[] = data?.budgets ?? [];

  return (
    <OGDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <OGDialogTemplate
        className="sm:max-w-2xl"
        title={user ? `${user.name || user.email || user.id}` : localize('com_admin_budgets_title')}
        headerClassName="px-6 pt-6 pb-2"
        main={
          <div className="space-y-4 px-6 pb-2">
            {user && (
              <p className="text-xs text-text-tertiary">{user.email}</p>
            )}
            {error != null && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {localize('com_admin_error_load')}
              </div>
            )}
            {isLoading && <p className="text-sm text-text-tertiary">{localize('com_ui_loading')}</p>}
            {!isLoading && budgets.length === 0 && (
              <p className="text-sm text-text-tertiary">{localize('com_admin_no_budgets')}</p>
            )}
            <div className="space-y-3">
              {budgets.map((b) => (
                <BudgetRow
                  key={b.bucket}
                  budget={b}
                  saving={setBudget.isLoading}
                  onSave={async (allocatedUsd, resetSpent) => {
                    if (!userId) return;
                    try {
                      await setBudget.mutateAsync({
                        userId,
                        bucket: b.bucket,
                        payload: {
                          allocatedUsd,
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
          selectClasses: 'bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600',
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
  onSave: (allocatedUsd: number, resetSpent: boolean) => void;
}) {
  const localize = useLocalize();
  const [allocatedUsd, setAllocatedUsd] = useState(microToUsd(budget.allocatedCredits));
  const [resetSpent, setResetSpent] = useState(false);

  useEffect(() => {
    setAllocatedUsd(microToUsd(budget.allocatedCredits));
    setResetSpent(false);
  }, [budget.allocatedCredits, budget.bucket]);

  const spentUsd = microToUsd(budget.spentCredits);
  const remainingUsd = microToUsd(budget.remainingCredits);

  return (
    <div className="rounded-lg border border-border-light p-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm font-semibold text-text-primary">
            {budget.label || budget.bucket}
          </div>
          <div className="text-xs text-text-tertiary">
            {localize('com_admin_budget_period_until', { date: shortDate(budget.periodEnd) }) as string}
          </div>
        </div>
        <div className="text-right text-xs text-text-tertiary tabular-nums">
          <div>
            <span className="font-semibold text-text-primary">${spentUsd.toFixed(2)}</span> /{' '}
            ${microToUsd(budget.allocatedCredits).toFixed(2)}
          </div>
          <div>
            {localize('com_admin_budget_remaining')}: ${remainingUsd.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <Label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-text-tertiary">{localize('com_admin_budget_allocated_usd')}</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={Number.isFinite(allocatedUsd) ? allocatedUsd : 0}
            onChange={(e) => setAllocatedUsd(Number(e.target.value))}
            className="w-full"
          />
        </Label>
        <Label className="flex items-center gap-2 pb-2 text-xs">
          <input
            type="checkbox"
            checked={resetSpent}
            onChange={(e) => setResetSpent(e.target.checked)}
          />
          <span>{localize('com_admin_budget_reset_spent')}</span>
        </Label>
        <Button
          variant="default"
          size="sm"
          disabled={saving || !Number.isFinite(allocatedUsd) || allocatedUsd < 0}
          onClick={() => onSave(allocatedUsd, resetSpent)}
        >
          {saving ? localize('com_ui_saving') : localize('com_ui_save')}
        </Button>
      </div>
    </div>
  );
}
