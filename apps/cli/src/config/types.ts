import type { EdgeConfig } from "sylas-core";

/**
 * Linear credentials obtained from OAuth flow
 */
export interface LinearCredentials {
	linearToken: string;
	linearWorkspaceId: string;
	linearWorkspaceName: string;
}

/**
 * Workspace information for issue processing
 */
export interface Workspace {
	path: string;
	isGitWorktree: boolean;
}

/**
 * Re-export EdgeConfig from sylas-core for convenience
 */
export type { EdgeConfig };
