export type RequestLog = { requestId: string; actorId?: string; workspaceId?: string; jobId?: string; durationMs: number; errorCode?: string };
export function safeRequestLog(input: RequestLog): RequestLog { return { ...input }; }
