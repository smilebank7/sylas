import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";
import { DEFAULT_CONFIG_FILENAME, type EdgeConfig } from "sylas-core";
import { RepoService } from "../services/RepoService.js";
import { BaseCommand } from "./ICommand.js";

/**
 * Self-add-repo command - clones a repo and adds it to config.json
 *
 * Usage:
 *   sylas self-add-repo                      # prompts for everything
 *   sylas self-add-repo <url>                # prompts for workspace if multiple
 *   sylas self-add-repo <url> <workspace>    # no prompts
 */
export class SelfAddRepoCommand extends BaseCommand {
	private rl: readline.Interface | null = null;
	private repoService = new RepoService(this.app.sylasHome);

	private getReadline(): readline.Interface {
		if (!this.rl) {
			this.rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});
		}
		return this.rl;
	}

	private prompt(question: string): Promise<string> {
		return new Promise((resolve) => {
			this.getReadline().question(question, (answer) => resolve(answer.trim()));
		});
	}

	private cleanup(): void {
		if (this.rl) {
			this.rl.close();
			this.rl = null;
		}
	}

	async execute(args: string[]): Promise<void> {
		let url = args[0];
		const workspaceName = args[1];

		try {
			// Load config
			const configPath = resolve(this.app.sylasHome, DEFAULT_CONFIG_FILENAME);
			let config: EdgeConfig;
			try {
				config = JSON.parse(readFileSync(configPath, "utf-8")) as EdgeConfig;
			} catch {
				this.logError(`Config file not found: ${configPath}`);
				process.exit(1);
			}

			if (!config.repositories) {
				config.repositories = [];
			}

			// Get URL if not provided
			if (!url) {
				url = await this.repoService.promptForRepoUrl((question) =>
					this.prompt(question),
				);
			}

			if (!url) {
				throw new Error("URL is required");
			}

			const result = await this.repoService.cloneAndAddRepo({
				url,
				config,
				configPath,
				workspaceName,
				prompt: (question) => this.prompt(question),
			});

			console.log(`\nAdded: ${result.repoName}`);
			console.log(`  ID: ${result.id}`);
			console.log(`  Workspace: ${result.workspace.name}`);
			process.exit(0);
		} catch (error) {
			this.logError((error as Error).message);
			process.exit(1);
		} finally {
			this.cleanup();
		}
	}
}
