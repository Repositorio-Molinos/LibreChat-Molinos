import type { InfiniteData } from '@tanstack/react-query';
import type * as p from '../accessPermissions';
import type * as a from '../types/agents';
import type * as s from '../schemas';
import type * as t from '../types';

export type Conversation = {
  id: string;
  createdAt: number;
  participants: string[];
  lastMessage: string;
  conversations: s.TConversation[];
};

export type ConversationListParams = {
  cursor?: string;
  isArchived?: boolean;
  sortBy?: 'title' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
  tags?: string[];
  search?: string;
};

export type MinimalConversation = Pick<
  s.TConversation,
  'conversationId' | 'endpoint' | 'title' | 'createdAt' | 'updatedAt' | 'user'
>;

export type ConversationListResponse = {
  conversations: MinimalConversation[];
  nextCursor: string | null;
};

export type ConversationData = InfiniteData<ConversationListResponse>;
export type ConversationUpdater = (
  data: ConversationData,
  conversation: s.TConversation,
) => ConversationData;

/* Messages */
export type MessagesListParams = {
  cursor?: string | null;
  sortBy?: 'endpoint' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
  pageSize?: number;
  conversationId?: string;
  messageId?: string;
  search?: string;
};

export type MessagesListResponse = {
  messages: s.TMessage[];
  nextCursor: string | null;
};

/* Shared Links */
export type SharedMessagesResponse = Omit<s.TSharedLink, 'messages'> & {
  messages: s.TMessage[];
};

export interface SharedLinksListParams {
  pageSize: number;
  isPublic: boolean;
  sortBy: 'title' | 'createdAt';
  sortDirection: 'asc' | 'desc';
  search?: string;
  cursor?: string;
}

export type SharedLinkItem = {
  shareId: string;
  title: string;
  isPublic: boolean;
  createdAt: Date;
  conversationId: string;
};

export interface SharedLinksResponse {
  links: SharedLinkItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface SharedLinkQueryData {
  pages: SharedLinksResponse[];
  pageParams: (string | null)[];
}

export type AllPromptGroupsFilterRequest = {
  category: string;
  pageNumber: string;
  pageSize: string | number;
  before?: string | null;
  after?: string | null;
  order?: 'asc' | 'desc';
  name?: string;
  author?: string;
};

export type AllPromptGroupsResponse = t.TPromptGroup[];

export type ConversationTagsResponse = s.TConversationTag[];

/* MCP Types */
export type MCPTool = {
  name: string;
  pluginKey: string;
  description: string;
};

export type MCPServer = {
  name: string;
  icon: string;
  authenticated: boolean;
  authConfig: s.TPluginAuthConfig[];
  tools: MCPTool[];
};

export type MCPServersResponse = {
  servers: Record<string, MCPServer>;
};

export type VerifyToolAuthParams = { toolId: string };
export type VerifyToolAuthResponse = {
  authenticated: boolean;
  message?: string | s.AuthType;
  authTypes?: [string, s.AuthType][];
};

export type GetToolCallParams = { conversationId: string };
export type ToolCallResults = a.ToolCallResult[];

/* Memories */
export type TUserMemory = {
  key: string;
  value: string;
  updated_at: string;
  tokenCount?: number;
};

export type MemoriesResponse = {
  memories: TUserMemory[];
  totalTokens: number;
  tokenLimit: number | null;
  usagePercentage: number | null;
};

export type PrincipalSearchParams = {
  q: string;
  limit?: number;
  types?: Array<p.PrincipalType.USER | p.PrincipalType.GROUP | p.PrincipalType.ROLE>;
};

export type PrincipalSearchResponse = {
  query: string;
  limit: number;
  types?: Array<p.PrincipalType.USER | p.PrincipalType.GROUP | p.PrincipalType.ROLE>;
  results: p.TPrincipalSearchResult[];
  count: number;
  sources: {
    local: number;
    entra: number;
  };
};

export type AccessRole = {
  accessRoleId: p.AccessRoleIds;
  name: string;
  description: string;
  permBits: number;
};

export type AccessRolesResponse = AccessRole[];

export type ListRolesResponse = {
  roles: Array<{ _id?: string; name: string; description?: string }>;
  total: number;
  limit: number;
  offset?: number;
};

export interface MCPServerStatus {
  requiresOAuth: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface MCPConnectionStatusResponse {
  success: boolean;
  connectionStatus: Record<string, MCPServerStatus>;
}

export interface MCPServerConnectionStatusResponse {
  success: boolean;
  serverName: string;
  requiresOAuth: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface MCPAuthValuesResponse {
  success: boolean;
  serverName: string;
  authValueFlags: Record<string, boolean>;
}

/**
 * User Favorites — pinned agents, models, and model specs.
 * Exactly one variant should be set per entry; exclusivity is enforced
 * server-side in FavoritesController. Shape is loose for state-update ergonomics.
 */
export type TUserFavorite = {
  agentId?: string;
  model?: string;
  endpoint?: string;
  spec?: string;
};

/* SharePoint Graph API Token */
export type GraphTokenParams = {
  scopes: string;
};

export type GraphTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

/* ---------------- Admin (Molinos) ---------------- */

export interface AdminUsersParams {
  limit?: number;
  offset?: number;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  role: string;
  provider: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUsersResponse {
  users: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export type AdminUsageGroupBy = 'user' | 'model' | 'user-model';

export interface AdminUsageParams {
  from?: string;
  to?: string;
  groupBy?: AdminUsageGroupBy;
  userId?: string;
  model?: string;
  limit?: number;
  offset?: number;
}

export interface AdminUsageRow {
  groupKey: string;
  userId?: string;
  email?: string;
  name?: string;
  model?: string;
  promptTokens: number;
  completionTokens: number;
  cacheTokens: number;
  totalTokens: number;
  spentMicroUsd: number;
  spentUsd: number;
  txCount: number;
  firstAt?: string;
  lastAt?: string;
}

export interface AdminUsageResponse {
  from: string;
  to: string;
  groupBy: AdminUsageGroupBy;
  rows: AdminUsageRow[];
  groupCount: number;
  totals: {
    spentMicroUsd: number;
    spentUsd: number;
    txCount: number;
    uniqueUsers: number;
    uniqueModels: number;
  };
  limit: number;
  offset: number;
}

export interface AdminBudgetSnapshot {
  bucket: string;
  label?: string;
  match?: string[];
  allocatedCredits: number;
  spentCredits: number;
  remainingCredits: number;
  periodStart: string;
  periodEnd: string;
  periodMs: number;
}

export interface AdminUserBudgetsResponse {
  userId: string;
  budgets: AdminBudgetSnapshot[];
}

export interface AdminSetBudgetRequest {
  allocatedUsd?: number;
  allocatedCredits?: number;
  spentUsd?: number;
  spentCredits?: number;
}

export interface AdminSetBudgetResponse {
  userId: string;
  bucket: string;
  budget: AdminBudgetSnapshot;
}

export type AdminAuditAction =
  | 'budget.set_allocation'
  | 'budget.reset_spent'
  | 'budget.set_both';

export interface AdminAuditParams {
  from?: string;
  to?: string;
  actorId?: string;
  targetUserId?: string;
  action?: AdminAuditAction;
  limit?: number;
  offset?: number;
}

export interface AdminAuditRow {
  id: string;
  action: AdminAuditAction;
  actor: { id: string; email?: string; role?: string };
  target: { type: 'user'; id: string; email?: string };
  resource: { type: 'modelBudget'; key: string };
  before?: { allocatedCredits?: number; spentCredits?: number } | null;
  after?: { allocatedCredits?: number; spentCredits?: number } | null;
  context?: { ip?: string; userAgent?: string } | null;
  createdAt?: string;
}

export interface AdminAuditResponse {
  from: string;
  to: string;
  rows: AdminAuditRow[];
  total: number;
  limit: number;
  offset: number;
}
