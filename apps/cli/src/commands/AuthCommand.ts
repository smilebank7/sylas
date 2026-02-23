import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSylasAppUrl } from "sylas-cloudflare-tunnel-client";
import { BaseCommand } from "./ICommand.js";

/**
 * Auth command - authenticate with Sylas Pro plan using auth key
 */
export class AuthCommand extends BaseCommand {
	async execute(args: string[]): Promise<void> {
		// Get auth key from command line arguments
		const authKey = args[0];

		if (
			!authKey ||
			typeof authKey !== "string" ||
			authKey.trim().length === 0
		) {
			this.logError("Error: Auth key is required");
			console.log("\nUsage: sylas auth <auth-key>");
			console.log(
				`\nGet your auth key from: ${getSylasAppUrl()}/onboarding/auth-sylas`,
			);
			process.exit(1);
		}

		console.log("\n🔑 Authenticating with Sylas...");
		this.logDivider();

		try {
			// Import ConfigApiClient
			const { ConfigApiClient } = await import(
				"sylas-cloudflare-tunnel-client"
			);

			// Call the config API to get credentials
			console.log("Validating auth key...");
			const configResponse = await ConfigApiClient.getConfig(authKey);

			if (!ConfigApiClient.isValid(configResponse)) {
				this.logError("Authentication failed");
				console.error(configResponse.error || "Invalid response from server");
				console.log("\nPlease verify your auth key is correct.");
				console.log(
					`Get your auth key from: ${getSylasAppUrl()}/onboarding/auth-sylas`,
				);
				process.exit(1);
			}

			this.logSuccess("Authentication successful!");

			// Ensure SYLAS_HOME directory exists
			if (!existsSync(this.app.sylasHome)) {
				mkdirSync(this.app.sylasHome, { recursive: true });
			}

			// Store tokens in ~/.sylas/.env file
			const envPath = resolve(this.app.sylasHome, ".env");
			const envContent = `# Sylas Authentication Credentials
# Generated on ${new Date().toISOString()}
CLOUDFLARE_TOKEN=${configResponse.config!.cloudflareToken}
SYLAS_API_KEY=${configResponse.config!.apiKey}
SYLAS_SETUP_PENDING=true
`;

			writeFileSync(envPath, envContent, "utf-8");
			this.logSuccess(`Credentials saved to ${envPath}`);

			// Reload environment variables to pick up SYLAS_SETUP_PENDING
			const dotenv = await import("dotenv");
			dotenv.config({ path: envPath, override: true });

			console.log("\n✨ Setup complete! Starting Sylas...");
			this.logDivider();
			console.log();

			// Start the edge app with the new configuration
			// Import StartCommand to avoid circular dependency
			const { StartCommand } = await import("./StartCommand.js");
			const startCommand = new StartCommand(this.app);
			await startCommand.execute([]);
		} catch (error) {
			this.logError("Authentication failed:");
			console.error((error as Error).message);
			console.log(
				"\nPlease try again or contact support if the issue persists.",
			);
			process.exit(1);
		}
	}
}
