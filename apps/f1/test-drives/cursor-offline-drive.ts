import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	EdgeWorkerConfig,
	Issue,
	LinearAgentSessionCreatedWebhook,
	RepositoryConfig,
} from "sylas-core";
import { EdgeWorker } from "sylas-edge-worker";

async function main() {
	process.env.SYLAS_CURSOR_MOCK = "1";

	const sylasHome = await mkdtemp(join(tmpdir(), "sylas-f1-offline-"));
	const workspaceBaseDir = join(sylasHome, "workspaces");
	await mkdir(workspaceBaseDir, { recursive: true });

	const repository: RepositoryConfig = {
		id: "offline-f1-repo",
		name: "Offline F1 Repo",
		repositoryPath: process.cwd(),
		workspaceBaseDir,
		baseBranch: "main",
		linearToken: "offline-token",
		linearWorkspaceId: "offline-workspace",
		isActive: true,
	};

	const config: EdgeWorkerConfig = {
		platform: "cli",
		sylasHome,
		repositories: [repository],
		handlers: {
			createWorkspace: async (issue: Issue) => {
				const path = join(workspaceBaseDir, issue.identifier);
				await mkdir(path, { recursive: true });
				return { path, isGitWorktree: false };
			},
		},
	};

	const worker = new EdgeWorker(config);
	const issueTracker = (worker as any).issueTrackers.get(
		repository.id,
	) as import("sylas-core").CLIIssueTrackerService;

	const issue = await issueTracker.createIssue({
		teamId: "team-default",
		title: "Offline cursor harness proof",
		description:
			"Run cursor via offline drive.\n\n[agent=cursor]\n[model=gpt-5]",
	});

	const fullDevelopment = (worker as any).procedureAnalyzer.getProcedure(
		"full-development",
	);
	if (!fullDevelopment) {
		throw new Error("full-development procedure not available");
	}
	(worker as any).procedureAnalyzer.determineRoutine = async () => ({
		classification: "code",
		procedure: fullDevelopment,
		reasoning: "offline test drive forced procedure",
	});

	const createdSessionPayload = await issueTracker.createAgentSessionOnIssue({
		issueId: issue.id,
	});
	const createdSession = await createdSessionPayload.agentSession;

	const webhook: LinearAgentSessionCreatedWebhook = {
		type: "Issue",
		action: "agentSessionCreated",
		organizationId: repository.linearWorkspaceId,
		agentSession: {
			id: createdSession.id,
			issue: {
				id: issue.id,
				identifier: issue.identifier,
				team: { key: "DEF" },
			},
			comment: { body: "This thread is for an agent session with sylas." },
		},
	};

	await (worker as any).handleAgentSessionCreatedWebhook(webhook, [repository]);

	// Give async post-processing a brief moment to flush activity writes.
	await new Promise((resolve) => setTimeout(resolve, 200));

	const sessions = issueTracker.listAgentSessions({
		issueId: issue.id,
		limit: 1,
	});
	if (sessions.length === 0) {
		throw new Error("No session created by offline drive");
	}
	const session = sessions[0];
	const activities = issueTracker.listAgentActivities(session.id, {
		limit: 50,
	});

	const hasResponse = activities.some(
		(activity) => activity.type === "response",
	);
	if (!hasResponse) {
		throw new Error("No response activity created by cursor session");
	}

	console.log(
		JSON.stringify(
			{
				ok: true,
				issueId: issue.id,
				identifier: issue.identifier,
				sessionId: session.id,
				activityCount: activities.length,
				responseCount: activities.filter((a) => a.type === "response").length,
			},
			null,
			2,
		),
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
