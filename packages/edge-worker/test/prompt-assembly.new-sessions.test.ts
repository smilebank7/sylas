import { describe, expect, it } from "bun:test";
import { createTestWorker, scenario } from "./prompt-assembly-utils.js";

describe("Prompt Assembly - New Sessions", () => {
	it("assignment-based (no labels) includes fallback system prompt and full-delegation section", async () => {
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
				identifier: "CEE-123",
				title: "Fix authentication bug",
				description: "Users cannot log in",
			})
			.withRepository({ id: "repo-1", path: "/test/repo" })
			.withUserComment("")
			.withLabels()
			.expectComponents("issue-context")
			.verify();

		expect(result.systemPrompt?.length).toBeGreaterThan(0);
		expect(result.userPrompt).toContain("CEE-123");
		expect(
			result.userPrompt.includes("# Full Delegation") ||
				result.userPrompt.includes("# Default Template"),
		).toBe(true);
	});

	it("assignment-based (with user comment) appends user_comment block", async () => {
		const worker = createTestWorker();

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
				identifier: "CEE-456",
				title: "Implement new feature",
				description: "Add payment processing",
			})
			.withRepository({ id: "repo-2", path: "/test/repo" })
			.withUserComment("Please add Stripe integration")
			.withLabels()
			.expectComponents("issue-context", "user-comment")
			.verify();

		expect(result.systemPrompt?.length).toBeGreaterThan(0);
		expect(result.userPrompt).toContain("<user_comment>");
		expect(result.userPrompt).toContain("Please add Stripe integration");
	});
});
