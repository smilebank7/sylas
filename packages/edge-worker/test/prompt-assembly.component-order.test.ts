/**
 * Prompt Assembly Tests - Component Order
 *
 * Tests that prompt components are assembled in the correct order.
 */

import { describe, expect, it } from "bun:test";
import { createTestWorker, scenario } from "./prompt-assembly-utils.js";

describe("Prompt Assembly - Component Order", () => {
	it("assembles issue context, full-delegation instructions, then user comment", async () => {
		const worker = createTestWorker();

		const result = await scenario(worker)
			.newSession()
			.assignmentBased()
			.withSession({
				issueId: "id",
				workspace: { path: "/test" },
				metadata: {},
			})
			.withIssue({
				id: "id",
				identifier: "CEE-789",
				title: "Build new feature",
			})
			.withRepository({ id: "repo-1", path: "/test/repo" })
			.withUserComment("Add user authentication")
			.withLabels()
			.expectPromptType("fallback")
			.expectComponents("issue-context", "user-comment")
			.verify();

		const userPrompt = result.userPrompt;
		expect(userPrompt).toContain("CEE-789");
		expect(userPrompt).toContain("Add user authentication");
		expect(
			userPrompt.includes("# Full Delegation") ||
				userPrompt.includes("# Default Template"),
		).toBe(true);
	});
});
