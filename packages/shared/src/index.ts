// ---- Idea Types ----

export type IdeaStatus = 'captured' | 'chatting' | 'building' | 'done';

export interface IdeaMeta {
  id: string;
  slug: string;
  title: string;
  status: IdeaStatus;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Idea extends IdeaMeta {
  content?: string; // idea.md content
}

// ---- Claude Stream Messages ----

export interface ClaudeSystemInit {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools: string[];
  model: string;
}

export interface ClaudeAssistantText {
  type: 'assistant';
  subtype: 'text';
  text: string;
}

export interface ClaudeToolUse {
  type: 'assistant';
  subtype: 'tool_use';
  tool_use_id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeToolResult {
  type: 'tool_result';
  subtype: 'result';
  tool_use_id: string;
  content: string;
}

export interface ClaudeResult {
  type: 'result';
  subtype: 'success' | 'error';
  result?: string;
  error?: string;
  session_id: string;
  cost_usd: number;
  duration_ms: number;
  turns: number;
}

export type ClaudeStreamMessage =
  | ClaudeSystemInit
  | ClaudeAssistantText
  | ClaudeToolUse
  | ClaudeToolResult
  | ClaudeResult;

// ---- WebSocket Protocol ----

// Client → Server
export interface WsChatMessage {
  type: 'chat';
  ideaId: string;
  message: string;
}

export interface WsBuildMessage {
  type: 'build';
  ideaId: string;
  instructions: string;
}

export interface WsCancelMessage {
  type: 'cancel';
  ideaId: string;
}

export type WsClientMessage = WsChatMessage | WsBuildMessage | WsCancelMessage;

// Server → Client
export interface WsClaudeSystemMessage {
  type: 'claude:system';
  ideaId: string;
  sessionId: string;
  model: string;
}

export interface WsClaudeTextMessage {
  type: 'claude:text';
  ideaId: string;
  text: string;
}

export interface WsClaudeToolUseMessage {
  type: 'claude:tool_use';
  ideaId: string;
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
}

export interface WsClaudeToolResultMessage {
  type: 'claude:tool_result';
  ideaId: string;
  toolUseId: string;
  content: string;
}

export interface WsClaudeResultMessage {
  type: 'claude:result';
  ideaId: string;
  result?: string;
  error?: string;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  turns: number;
}

export interface WsClaudeErrorMessage {
  type: 'claude:error';
  ideaId: string;
  error: string;
}

export type WsServerMessage =
  | WsClaudeSystemMessage
  | WsClaudeTextMessage
  | WsClaudeToolUseMessage
  | WsClaudeToolResultMessage
  | WsClaudeResultMessage
  | WsClaudeErrorMessage;

// ---- API Responses ----

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface AuthCheckResponse {
  authenticated: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  ssh: boolean;
  uptime: number;
}
