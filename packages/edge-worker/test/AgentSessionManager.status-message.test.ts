import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { IActivitySink } from "../src/sinks/IActivitySink";

describe("AgentSessionManager - Status Messages", () => {
	let manager: import("../src/AgentSessionManager.ts").AgentSessionManager;
	let postActivity: ReturnType<typeof mock>;

	beforeEach(async () => {
		const { AgentSessionManager } = await import(
			`../src/AgentSessionManager.ts?status-${Date.now()}`
		);

		postActivity = mock().mockResolvedValue({ activityId: "activity-123" });
		const sink: IActivitySink = {
			id: "test-workspace",
			postActivity,
			createAgentSession: mock().mockResolvedValue("session-123"),
		};

		manager = new AgentSessionManager(sink);
		manager.createLinearAgentSession(
			"test-session-123",
			"issue-123",
			{
				id: "issue-123",
				identifier: "TEST-123",
				title: "Test Issue",
				description: "Test description",
				branchName: "test-branch",
			},
			{ path: "/test/workspace", isGitWorktree: false },
		);
	});

	it("posts compacting status thought", async () => {
		await manager.handleClaudeMessage("test-session-123", {
			type: "system",
			subtype: "status",
			status: "compacting",
			uuid: "00000000-0000-0000-0000-000000000001",
			session_id: "claude-session-123",
		} as import("sylas-claude-runner").SDKStatusMessage);

		expect(
			postActivity.mock.calls.some(
				(call) =>
					call[1]?.type === "thought" &&
					call[1]?.body === "Compacting conversation history…",
			),
		).toBe(true);
	});
});
