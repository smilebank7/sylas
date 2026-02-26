import { describe, expect, it } from "bun:test";
import { createTestWorker, scenario } from "./prompt-assembly-utils.js";

describe("Prompt Assembly - System Prompt Behavior", () => {
	it("uses shared instructions when no labels match", async () => {
		const worker = createTestWorker();
		const result = await scenario(worker)
			.newSession()
			.assignmentBased()
			.withSession({
				issueId: "id-1",
				workspace: { path: "/test" },
				metadata: {},
			})
			.withIssue({
				id: "id-1",
				identifier: "CEE-1000",
				title: "Task without system prompt",
				description: "Example task",
			})
			.withRepository({ id: "repo-1", path: "/test/repo" })
			.withUserComment("")
			.withLabels()
			.expectComponents("issue-context")
			.verify();

		expect(result.systemPrompt?.length).toBeGreaterThan(0);
	});

	it("uses builder system prompt when builder labels match", async () => {
		const repository = {
			id: "repo-builder",
			name: "Test Repo",
			repositoryPath: "/test/repo",
			baseBranch: "main",
			linearWorkspaceId: "workspace-1",
			workspaceBaseDir: "/test/workspace",
			linearToken: "test-token",
			labelPrompts: {
				builder: ["feature", "enhancement"],
			},
		};

		const worker = createTestWorker([repository]);
		const result = await scenario(worker)
			.newSession()
			.assignmentBased()
			.withSession({
				issueId: "id-2",
				workspace: { path: "/test" },
				metadata: {},
			})
			.withIssue({
				id: "id-2",
				identifier: "CEE-2000",
				title: "Builder prompt",
				description: "Task",
			})
			.withRepository(repository)
			.withUserComment("Build the payment integration")
			.withLabels("feature")
			.expectComponents("issue-context", "user-comment")
			.verify();

		expect(result.systemPrompt?.length).toBeGreaterThan(0);
	});

	it("uses orchestrator system prompt for Orchestrator labels", async () => {
		const repository = {
			id: "repo-orchestrator",
			name: "Test Repo",
			repositoryPath: "/test/repo",
			baseBranch: "main",
			linearWorkspaceId: "workspace-1",
			workspaceBaseDir: "/test/workspace",
			linearToken: "test-token",
		};

		const worker = createTestWorker([repository]);
		const result = await scenario(worker)
			.newSession()
			.assignmentBased()
			.withSession({
				issueId: "id-3",
				workspace: { path: "/test" },
				metadata: {},
			})
			.withIssue({
				id: "id-3",
				identifier: "CEE-3000",
				title: "Orchestrator prompt",
				description: "Task",
			})
			.withRepository(repository)
			.withUserComment("Orchestrate this task")
			.withLabels("Orchestrator")
			.expectComponents("issue-context", "user-comment")
			.verify();

		expect(result.systemPrompt?.length).toBeGreaterThan(0);
	});
});
