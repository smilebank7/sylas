import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG_FILENAME, type EdgeConfig } from "sylas-core";
import { AuthFlowService } from "../services/AuthFlowService.js";
import { BaseCommand } from "./ICommand.js";

/**
 * Self-auth command - authenticate with Linear OAuth directly from CLI
 * Handles the complete OAuth flow without requiring EdgeWorker
 */
export class SelfAuthCommand extends BaseCommand {
	private authFlow = new AuthFlowService();

	async execute(_args: string[]): Promise<void> {
		console.log("\nSylas Linear Self-Authentication");
		this.logDivider();

		// Check required environment variables
		const clientId = process.env.LINEAR_CLIENT_ID;
		const clientSecret = process.env.LINEAR_CLIENT_SECRET;
		const baseUrl = process.env.SYLAS_BASE_URL;

		if (!clientId || !clientSecret || !baseUrl) {
			this.logError("Missing required environment variables:");
			if (!clientId) console.log("   - LINEAR_CLIENT_ID");
			if (!clientSecret) console.log("   - LINEAR_CLIENT_SECRET");
			if (!baseUrl) console.log("   - SYLAS_BASE_URL");
			console.log("\nSet these in your shell profile (.zshrc):");
			console.log("  export LINEAR_CLIENT_ID='your-client-id'");
			console.log("  export LINEAR_CLIENT_SECRET='your-client-secret'");
			console.log("  export SYLAS_BASE_URL='https://your-tunnel-domain.com'");
			process.exit(1);
		}

		// Check config file exists
		const configPath = resolve(this.app.sylasHome, DEFAULT_CONFIG_FILENAME);
		let config: EdgeConfig;
		try {
			config = JSON.parse(readFileSync(configPath, "utf-8")) as EdgeConfig;
		} catch {
			this.logError(`Config file not found: ${configPath}`);
			console.log("Run 'sylas' first to create initial configuration.");
			process.exit(1);
		}

		console.log("Configuration:");
		console.log(`   Client ID: ${clientId.substring(0, 20)}...`);
		console.log(`   Base URL: ${baseUrl}`);
		console.log(`   Config: ${configPath}`);
		console.log(`   Callback port: ${this.authFlow.getCallbackPort()}`);
		console.log();

		try {
			// Start temporary server to receive OAuth callback
			const authCode = await this.authFlow.waitForCallback(clientId);

			// Exchange code for tokens
			console.log("Exchanging code for tokens...");
			const tokens = await this.authFlow.exchangeCodeForTokens(
				authCode,
				clientId,
				clientSecret,
			);
			this.logSuccess(
				`Got access token: ${tokens.accessToken.substring(0, 30)}...`,
			);

			// Fetch workspace info
			console.log("Fetching workspace info...");
			const workspace = await this.authFlow.fetchWorkspaceInfo(
				tokens.accessToken,
			);
			this.logSuccess(`Workspace: ${workspace.name} (${workspace.id})`);

			// Update config.json
			console.log("Saving tokens to config.json...");
			this.authFlow.overwriteRepoConfigTokens(
				config,
				configPath,
				tokens,
				workspace,
			);

			const updatedCount = config.repositories.filter(
				(r: EdgeConfig["repositories"][number]) =>
					r.linearWorkspaceId === workspace.id,
			).length;
			this.logSuccess(`Updated ${updatedCount} repository/repositories`);

			console.log();
			this.logSuccess(
				"Authentication complete! Restart sylas to use the new tokens.",
			);
			process.exit(0);
		} catch (error) {
			this.logError(`Authentication failed: ${(error as Error).message}`);
			process.exit(1);
		} finally {
			// One of the key guarantees of finally — it runs regardless of how the try block exits (return, throw, or normal completion).
			await this.authFlow.cleanup();
		}
	}
}
