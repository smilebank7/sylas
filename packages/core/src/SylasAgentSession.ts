/**
 * Agent Session types for Linear Agent Sessions integration
 * These types represent the core data structures for tracking agent sessions in Linear
 */

import type {
	IAgentRunner,
	SDKAssistantMessageError,
} from "./agent-runner-types.js";
import type {
	AgentSessionStatus,
	AgentSessionType,
} from "./issue-tracker/types.js";

export interface IssueMinimal {
	id: string;
	identifier: string;
	title: string;
	description?: string;
	branchName: string;
}

/**
 * Issue context for sessions attached to a specific issue.
 * Standalone sessions (e.g., direct agent invocation without an issue) will not have this.
 */
export interface IssueContext {
	/** The issue tracker identifier (e.g., "linear", "github") */
	trackerId: string;
	/** The unique issue ID from the tracker */
	issueId: string;
	/** The human-readable issue identifier (e.g., "CYPACK-123") */
	issueIdentifier: string;
}

export interface Workspace {
	path: string;
	isGitWorktree: boolean;
	historyPath?: string;
}

export interface SylasAgentSession {
	/** Unique session identifier (was linearAgentActivitySessionId in v2.0) */
	id: string;
	/** External session ID from the issue tracker (e.g., Linear's AgentSession ID) */
	externalSessionId?: string;
	type: AgentSessionType.CommentThread;
	status: AgentSessionStatus;
	context: AgentSessionType.CommentThread;
	createdAt: number; // e.g. Date.now()
	updatedAt: number; // e.g. Date.now()
	/** Issue context - optional for standalone sessions */
	issueContext?: IssueContext;
	/**
	 * Issue ID - kept for backwards compatibility during transition
	 * @deprecated Use issueContext.issueId instead
	 */
	issueId?: string;
	/** Minimal issue data - optional for standalone sessions */
	issue?: IssueMinimal;
	workspace: Workspace;
	// NOTE: Only one of these will be populated
	claudeSessionId?: string; // Claude-specific session ID (assigned once it initializes)
	/** @deprecated TEMPORARILY DISABLED: runner consolidation v2 */
	geminiSessionId?: string; // Gemini-specific session ID (assigned once it initializes)
	/** @deprecated TEMPORARILY DISABLED: runner consolidation v2 */
	codexSessionId?: string; // Codex-specific session ID (assigned once it initializes)
	/** @deprecated TEMPORARILY DISABLED: runner consolidation v2 */
	cursorSessionId?: string; // Cursor-specific session ID (assigned once it initializes)
	openCodeSessionId?: string; // OpenCode-specific session ID (assigned once it initializes)
	agentRunner?: IAgentRunner;
	metadata?: {
		model?: string;
		tools?: string[];
		permissionMode?: string;
		apiKeySource?: string;
		totalCostUsd?: number;
		usage?: any;
		commentId?: string;
	};
}

export interface SylasAgentSessionEntry {
	claudeSessionId?: string; // originated in this Claude session (if using Claude)
	/** @deprecated TEMPORARILY DISABLED: runner consolidation v2 */
	geminiSessionId?: string; // originated in this Gemini session (if using Gemini)
	/** @deprecated TEMPORARILY DISABLED: runner consolidation v2 */
	codexSessionId?: string; // originated in this Codex session (if using Codex)
	/** @deprecated TEMPORARILY DISABLED: runner consolidation v2 */
	cursorSessionId?: string; // originated in this Cursor session (if using Cursor)
	openCodeSessionId?: string; // originated in this OpenCode session (if using OpenCode)
	linearAgentActivityId?: string; // got assigned this ID in linear, after creation, for this 'agent activity'
	type: "user" | "assistant" | "system" | "result";
	content: string;
	metadata?: {
		toolUseId?: string;
		toolName?: string;
		toolInput?: any;
		parentToolUseId?: string;
		toolResultError?: boolean; // Error status from tool_result blocks
		timestamp: number; // e.g. Date.now()
		durationMs?: number;
		isError?: boolean;
		sdkError?: SDKAssistantMessageError; // SDK error type (e.g., 'rate_limit') from assistant messages
	};
}
