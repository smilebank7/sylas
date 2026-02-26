import { beforeEach, describe, expect, it, mock } from "bun:test";
import { CodexRunner } from "../../codex-runner/src/CodexRunner.ts";
import type { IActivitySink } from "../src/sinks/IActivitySink";

describe("AgentSessionManager - Codex tool activity mapping", () => {
	let manager: import("../src/AgentSessionManager.ts").AgentSessionManager;
	let postActivity: ReturnType<typeof mock>;

	beforeEach(async () => {
		const { AgentSessionManager } = await import(
			`../src/AgentSessionManager.ts?codex-${Date.now()}`
		);

		postActivity = mock().mockResolvedValue({ activityId: "activity-123" });
		const sink: IActivitySink = {
			id: "test-workspace",
			postActivity,
			createAgentSession: mock().mockResolvedValue("session-123"),
		};

		manager = new AgentSessionManager(sink);
		manager.createLinearAgentSession(
			"test-session-codex",
			"issue-codex",
			{
				id: "issue-codex",
				identifier: "TEST-100",
				title: "Codex activity test",
				description: "",
				branchName: "test-branch",
			},
			{ path: "/Users/connor/code/sylas", isGitWorktree: false },
		);

		const runner = new CodexRunner({
			sylasHome: "/tmp/sylas",
			workingDirectory: "/Users/connor/code/sylas",
		});
		manager.addAgentRunner("test-session-codex", runner);
	});

	it("accepts codex runner attachment without crashing", () => {
		expect(manager.getSession("test-session-codex")?.agentRunner).toBeDefined();
	});
});
