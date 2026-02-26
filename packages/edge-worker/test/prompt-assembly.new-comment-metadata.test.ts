import { describe, expect, it } from "bun:test";
import { createTestWorker, scenario } from "./prompt-assembly-utils.js";

describe("Prompt Assembly - New Comment Metadata in Agent Sessions", () => {
	it("includes mention metadata in mention-triggered prompts", async () => {
		const worker = createTestWorker();

		const result = await scenario(worker)
			.newSession()
			.withSession({
				issueId: "issue-1",
				workspace: { path: "/test" },
				metadata: {},
			})
			.withIssue({
				id: "issue-1",
				identifier: "TEST-123",
				title: "Test Issue",
				description: "Test description",
			})
			.withRepository({ id: "repo-1", path: "/test/repo" })
			.withUserComment("Please help with this issue")
			.withCommentAuthor("Alice Smith")
			.withCommentTimestamp("2025-01-27T14:30:00Z")
			.withAgentSession({
				id: "agent-session-1",
				creator: { id: "user-1", name: "Alice Smith" },
				comment: {
					id: "comment-1",
					body: "Please help with this issue",
					userId: "user-1",
					issueId: "issue-1",
				},
				issue: { id: "issue-1", identifier: "TEST-123", title: "Test Issue" },
			})
			.withMentionTriggered(true)
			.withLabels()
			.expectSystemPrompt(undefined)
			.expectPromptType("mention")
			.expectComponents("issue-context")
			.verify();

		expect(result.userPrompt).toContain("<mention_comment>");
		expect(result.userPrompt).toContain("<author>Alice Smith</author>");
		expect(result.userPrompt).toContain("<timestamp>");
	});

	it("includes assignment comment metadata in user_comment block", async () => {
		const worker = createTestWorker();

		const result = await scenario(worker)
			.newSession()
			.assignmentBased()
			.withSession({
				issueId: "issue-2",
				workspace: { path: "/test" },
				metadata: {},
			})
			.withIssue({
				id: "issue-2",
				identifier: "TEST-456",
				title: "Another Test Issue",
				description: "Another test description",
			})
			.withRepository({ id: "repo-2", path: "/test/repo" })
			.withUserComment("This is a new comment on the issue")
			.withCommentAuthor("Bob Jones")
			.withCommentTimestamp("2025-01-27T15:45:00Z")
			.withLabels()
			.expectPromptType("fallback")
			.expectComponents("issue-context", "user-comment")
			.verify();

		expect(result.userPrompt).toContain("<user_comment>");
		expect(result.userPrompt).toContain("<author>Bob Jones</author>");
		expect(result.userPrompt).toContain(
			"<timestamp>2025-01-27T15:45:00Z</timestamp>",
		);
	});

	it("wraps continuation comments in new_comment XML", async () => {
		const worker = createTestWorker();

		await scenario(worker)
			.continuationSession()
			.withUserComment("Follow-up comment")
			.withCommentAuthor("Charlie Brown")
			.withCommentTimestamp("2025-01-27T16:00:00Z")
			.expectUserPrompt(
				`<new_comment>
  <author>Charlie Brown</author>
  <timestamp>2025-01-27T16:00:00Z</timestamp>
  <content>
Follow-up comment
  </content>
</new_comment>`,
			)
			.expectSystemPrompt(undefined)
			.expectPromptType("continuation")
			.expectComponents("user-comment")
			.verify();
	});
});
