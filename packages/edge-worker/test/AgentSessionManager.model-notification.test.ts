import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { IActivitySink } from "../src/sinks/IActivitySink";

describe("AgentSessionManager - Model Notification", () => {
	let manager: import("../src/AgentSessionManager.ts").AgentSessionManager;
	let sink: IActivitySink;
	let postActivity: ReturnType<typeof mock>;

	beforeEach(async () => {
		const { AgentSessionManager } = await import(
			`../src/AgentSessionManager.ts?model-${Date.now()}`
		);

		postActivity = mock().mockResolvedValue({ activityId: "activity-123" });
		sink = {
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
				title: "Test",
				description: "desc",
				branchName: "test-branch",
			},
			{ path: "/test/workspace", isGitWorktree: false },
		);
	});

	it("posts model thought and updates metadata on init message", async () => {
		const systemMessage = {
			type: "system",
			subtype: "init",
			session_id: "claude-session-123",
			model: "claude-3-sonnet-20240229",
			tools: ["bash"],
			permissionMode: "default",
			apiKeySource: "user",
		};

		await manager.handleClaudeMessage(
			"test-session-123",
			systemMessage as import("sylas-claude-runner").SDKSystemMessage,
		);

		expect(
			postActivity.mock.calls.some(
				(call) =>
					call[1]?.type === "thought" &&
					call[1]?.body === "Using model: claude-3-sonnet-20240229",
			),
		).toBe(true);

		const session = manager.getSession("test-session-123");
		expect(session?.metadata?.model).toBe("claude-3-sonnet-20240229");
		expect(session?.claudeSessionId).toBe("claude-session-123");
	});
});
