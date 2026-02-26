import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	DEFAULT_BASE_BRANCH,
	DEFAULT_WORKTREES_DIR,
	type EdgeConfig,
} from "sylas-core";

export interface WorkspaceCredentials {
	id: string;
	name: string;
	token: string;
	refreshToken?: string;
}

export interface AddRepositoryResult {
	id: string;
	repoName: string;
	repositoryPath: string;
	workspace: WorkspaceCredentials;
}

export type PromptFn = (question: string) => Promise<string>;

interface CloneAndAddRepoInput {
	url: string;
	config: EdgeConfig;
	configPath: string;
	credentials?: WorkspaceCredentials;
	workspaceName?: string;
	prompt?: PromptFn;
}

export class RepoService {
	constructor(private readonly sylasHome: string) {}

	async promptForRepoUrl(prompt: PromptFn): Promise<string> {
		const url = (await prompt("Repository URL: ")).trim();
		if (!url) {
			throw new Error("URL is required");
		}
		return url;
	}

	async cloneAndAddRepo(
		input: CloneAndAddRepoInput,
	): Promise<AddRepositoryResult> {
		const { url, config, configPath, credentials, workspaceName, prompt } =
			input;

		if (!config.repositories) {
			config.repositories = [];
		}

		const repoName = this.extractRepoName(url);
		if (!repoName) {
			throw new Error("Could not extract repo name from URL");
		}

		if (
			config.repositories.some(
				(r: EdgeConfig["repositories"][number]) => r.name === repoName,
			)
		) {
			throw new Error(`Repository '${repoName}' already exists in config`);
		}

		const selectedWorkspace = credentials
			? credentials
			: await this.selectWorkspace(
					this.getWorkspaceCredentials(config),
					workspaceName,
					prompt,
				);

		const repositoryPath = resolve(this.sylasHome, "repos", repoName);

		if (existsSync(repositoryPath)) {
			console.log(`Repository already exists at ${repositoryPath}`);
		} else {
			console.log(`Cloning ${url}...`);
			try {
				execSync(`git clone ${url} ${repositoryPath}`, { stdio: "inherit" });
			} catch {
				throw new Error("Failed to clone repository");
			}
		}

		const id = randomUUID();

		config.repositories.push({
			id,
			name: repoName,
			repositoryPath,
			baseBranch: DEFAULT_BASE_BRANCH,
			workspaceBaseDir: resolve(this.sylasHome, DEFAULT_WORKTREES_DIR),
			linearWorkspaceId: selectedWorkspace.id,
			linearWorkspaceName: selectedWorkspace.name,
			linearToken: selectedWorkspace.token,
			linearRefreshToken: selectedWorkspace.refreshToken,
			isActive: true,
		});

		writeFileSync(configPath, JSON.stringify(config, null, "\t"), "utf-8");

		return {
			id,
			repoName,
			repositoryPath,
			workspace: selectedWorkspace,
		};
	}

	getWorkspaceCredentials(config: EdgeConfig): WorkspaceCredentials[] {
		const workspaces = new Map<string, WorkspaceCredentials>();

		for (const repo of config.repositories || []) {
			if (
				repo.linearWorkspaceId &&
				repo.linearToken &&
				!workspaces.has(repo.linearWorkspaceId)
			) {
				workspaces.set(repo.linearWorkspaceId, {
					id: repo.linearWorkspaceId,
					name: repo.linearWorkspaceName || repo.linearWorkspaceId,
					token: repo.linearToken,
					refreshToken: repo.linearRefreshToken,
				});
			}
		}

		return Array.from(workspaces.values());
	}

	async selectWorkspace(
		workspaces: WorkspaceCredentials[],
		workspaceName?: string,
		prompt?: PromptFn,
	): Promise<WorkspaceCredentials> {
		if (workspaces.length === 0) {
			throw new Error(
				"No Linear credentials found. Run 'sylas self-auth' first.",
			);
		}

		if (workspaces.length === 1) {
			return workspaces[0]!;
		}

		if (workspaceName) {
			const foundWorkspace = workspaces.find((w) => w.name === workspaceName);
			if (!foundWorkspace) {
				throw new Error(`Workspace '${workspaceName}' not found`);
			}
			return foundWorkspace;
		}

		if (!prompt) {
			throw new Error("Workspace selection prompt is required");
		}

		console.log("\nAvailable workspaces:");
		workspaces.forEach((workspace, index) => {
			console.log(`  ${index + 1}. ${workspace.name}`);
		});

		const choice = await prompt(`Select workspace [1-${workspaces.length}]: `);
		const idx = parseInt(choice, 10) - 1;
		if (idx < 0 || idx >= workspaces.length) {
			throw new Error("Invalid selection");
		}

		return workspaces[idx]!;
	}

	private extractRepoName(url: string): string | undefined {
		return url
			.split("/")
			.pop()
			?.replace(/\.git$/, "");
	}
}
