import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { IActivitySink } from "../src/sinks/IActivitySink";

describe("AgentSessionManager - GitHub Session", () => {
	let manager: import("../src/AgentSessionManager.ts").AgentSessionManager;
	let postActivity: ReturnType<typeof mock>;

	beforeEach(async () => {
		const { AgentSessionManager } = await import(
			`../src/AgentSessionManager.ts?github-${Date.now()}`
		);

		postActivity = mock().mockResolvedValue({ activityId: "activity-123" });
		const sink: IActivitySink = {
			id: "test-workspace",
			postActivity,
			createAgentSession: mock().mockResolvedValue("session-123"),
		};

		manager = new AgentSessionManager(sink);
	});

	it("skips activity posting for github sessions", async () => {
		manager.createLinearAgentSession(
			"github-session-123",
			"issue-456",
			{
				id: "issue-456",
				identifier: "GH-42",
				title: "GitHub Issue",
				description: "A GitHub issue",
				branchName: "fix/gh-42",
			},
			{ path: "/test/workspace", isGitWorktree: false },
			"github",
		);

		await manager.handleClaudeMessage("github-session-123", {
			type: "assistant",
			message: {
				id: "msg-1",
				type: "message",
				role: "assistant",
				content: [{ type: "text", text: "Hi" }],
				model: "claude",
				stop_reason: "end_turn",
				stop_sequence: null,
				usage: { input_tokens: 1, output_tokens: 1 },
			},
			parent_tool_use_id: null,
			uuid: "00000000-0000-0000-0000-000000000001",
			session_id: "claude-session-1",
		} as unknown as import("sylas-claude-runner").SDKAssistantMessage);

		expect(postActivity).not.toHaveBeenCalled();
	});
});
