import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MutationKeys, QueryKeys, dataService } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';
import type {
  AdminSetBudgetRequest,
  AdminSetBudgetResponse,
} from 'librechat-data-provider';

export interface SetUserBudgetVariables {
  userId: string;
  bucket: string;
  payload: AdminSetBudgetRequest;
}

export const useSetUserBudgetMutation = (): UseMutationResult<
  AdminSetBudgetResponse,
  Error,
  SetUserBudgetVariables
> => {
  const queryClient = useQueryClient();
  return useMutation<AdminSetBudgetResponse, Error, SetUserBudgetVariables>({
    mutationKey: [MutationKeys.setAdminUserBudget],
    mutationFn: ({ userId, bucket, payload }) =>
      dataService.setAdminUserBudget(userId, bucket, payload),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries([QueryKeys.adminUserBudgets, vars.userId]);
      queryClient.invalidateQueries([QueryKeys.adminUsage]);
      queryClient.invalidateQueries([QueryKeys.balance]);
    },
  });
};
