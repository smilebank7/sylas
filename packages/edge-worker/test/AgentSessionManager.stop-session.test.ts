import { beforeEach, describe, expect, it, mock } from "bun:test";
import { AgentSessionStatus } from "sylas-core";
import type { IActivitySink } from "../src/sinks/IActivitySink";

describe("AgentSessionManager stop-session behavior", () => {
	let manager: import("../src/AgentSessionManager.ts").AgentSessionManager;
	let postActivity: ReturnType<typeof mock>;

	beforeEach(async () => {
		const { AgentSessionManager } = await import(
			`../src/AgentSessionManager.ts?stop-${Date.now()}`
		);

		postActivity = mock().mockResolvedValue({ activityId: "activity-1" });
		const sink: IActivitySink = {
			id: "test-workspace",
			postActivity,
			createAgentSession: mock().mockResolvedValue("session-1"),
		};

		manager = new AgentSessionManager(sink);
		manager.createLinearAgentSession(
			"test-session-stop",
			"issue-stop",
			{
				id: "issue-stop",
				identifier: "TEST-STOP",
				title: "Stop Session Test",
				description: "test",
				branchName: "test-stop",
			},
			{ path: "/tmp/workspace", isGitWorktree: false },
		);
	});

	it("marks session as error when stop was requested", async () => {
		manager.requestSessionStop("test-session-stop");

		await manager.completeSession("test-session-stop", {
			type: "result",
			subtype: "success",
			duration_ms: 1,
			duration_api_ms: 1,
			is_error: false,
			num_turns: 1,
			result: "Stopped run",
			stop_reason: null,
			total_cost_usd: 0,
			usage: {
				input_tokens: 1,
				output_tokens: 1,
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0,
				cache_creation: null,
			},
			modelUsage: {},
			permission_denials: [],
			uuid: "result-1",
			session_id: "sdk-session",
		} as unknown as import("sylas-claude-runner").SDKResultMessage);

		expect(manager.getSession("test-session-stop")?.status).toBe(
			AgentSessionStatus.Error,
		);
	});
});
