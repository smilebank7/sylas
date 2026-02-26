import { describe, expect, it } from "bun:test";
import { createTestWorker, scenario } from "./prompt-assembly-utils.js";

describe("Prompt Assembly - Routing Context", () => {
	it("single-repo orchestrator prompts include repository and comment context", async () => {
		const repository = {
			id: "repo-single-123",
			name: "Single Repo",
			repositoryPath: "/test/single-repo",
			workspaceBaseDir: "/test/workspace",
			linearWorkspaceId: "ws-1",
			linearToken: "token-1",
			baseBranch: "main",
		};

		const worker = createTestWorker([repository]);
		const result = await scenario(worker)
			.newSession()
			.assignmentBased()
			.withSession({
				issueId: "issue-123",
				workspace: { path: "/test" },
				metadata: {},
			})
			.withIssue({
				id: "issue-123",
				identifier: "BACK-100",
				title: "Single repo orchestration",
				description: "Test issue",
			})
			.withRepository(repository)
			.withUserComment("Orchestrate this task")
			.withLabels("Orchestrator")
			.expectComponents("issue-context", "user-comment")
			.verify();

		expect(
			result.userPrompt.includes("Repository: Single Repo") ||
				result.userPrompt.includes("<repository>Single Repo</repository>"),
		).toBe(true);
		expect(
			result.userPrompt.includes("Issue: BACK-100") ||
				result.userPrompt.includes("<identifier>BACK-100</identifier>"),
		).toBe(true);
		expect(result.userPrompt).toContain("<user_comment>");
	});

	it("multi-repo orchestrator prompts still include current repository context", async () => {
		const frontendRepo = {
			id: "repo-frontend-123",
			name: "Frontend App",
			repositoryPath: "/test/frontend",
			workspaceBaseDir: "/test/workspace",
			linearWorkspaceId: "ws-2",
			linearToken: "token-2",
			baseBranch: "main",
		};

		const backendRepo = {
			id: "repo-backend-456",
			name: "Backend API",
			repositoryPath: "/test/backend",
			workspaceBaseDir: "/test/workspace",
			linearWorkspaceId: "ws-2",
			linearToken: "token-3",
			baseBranch: "main",
		};

		const worker = createTestWorker([frontendRepo, backendRepo]);
		const result = await scenario(worker)
			.newSession()
			.assignmentBased()
			.withSession({
				issueId: "issue-456",
				workspace: { path: "/test" },
				metadata: {},
			})
			.withIssue({
				id: "issue-456",
				identifier: "FE-200",
				title: "Cross-repo feature",
				description: "Add feature spanning frontend and backend",
			})
			.withRepository(frontendRepo)
			.withUserComment("Orchestrate this cross-repo feature")
			.withLabels("Orchestrator")
			.expectComponents("issue-context", "user-comment")
			.verify();

		expect(
			result.userPrompt.includes("Repository: Frontend App") ||
				result.userPrompt.includes("<repository>Frontend App</repository>"),
		).toBe(true);
		expect(
			result.userPrompt.includes("Issue: FE-200") ||
				result.userPrompt.includes("<identifier>FE-200</identifier>"),
		).toBe(true);
		expect(result.userPrompt).toContain("<user_comment>");
	});
});
