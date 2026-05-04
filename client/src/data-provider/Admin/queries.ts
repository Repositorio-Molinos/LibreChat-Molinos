import { useRecoilValue } from 'recoil';
import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type {
  AdminUsageParams,
  AdminUsageResponse,
  AdminUsersParams,
  AdminUsersResponse,
  AdminUserBudgetsResponse,
} from 'librechat-data-provider';
import store from '~/store';

export const useAdminUsageQuery = (
  params: AdminUsageParams = {},
  config?: UseQueryOptions<AdminUsageResponse>,
): QueryObserverResult<AdminUsageResponse> => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<AdminUsageResponse>(
    [QueryKeys.adminUsage, params],
    () => dataService.getAdminUsage(params),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      keepPreviousData: true,
      ...config,
      enabled: (config?.enabled ?? true) === true && queriesEnabled,
    },
  );
};

export const useAdminUsersQuery = (
  params: AdminUsersParams = {},
  config?: UseQueryOptions<AdminUsersResponse>,
): QueryObserverResult<AdminUsersResponse> => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<AdminUsersResponse>(
    [QueryKeys.adminUsers, params],
    () => dataService.getAdminUsersList(params),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      keepPreviousData: true,
      ...config,
      enabled: (config?.enabled ?? true) === true && queriesEnabled,
    },
  );
};

export const useAdminUserBudgetsQuery = (
  userId: string | undefined,
  config?: UseQueryOptions<AdminUserBudgetsResponse>,
): QueryObserverResult<AdminUserBudgetsResponse> => {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<AdminUserBudgetsResponse>(
    [QueryKeys.adminUserBudgets, userId],
    () => dataService.getAdminUserBudgets(userId as string),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      ...config,
      enabled: (config?.enabled ?? true) === true && queriesEnabled && !!userId,
    },
  );
};
