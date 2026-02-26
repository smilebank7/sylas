import { writeFileSync } from "node:fs";
import { LinearClient } from "@linear/sdk";
import Fastify, { type FastifyInstance } from "fastify";
import type { EdgeConfig } from "sylas-core";
import { openUrl } from "../utils/openUrl.js";

export interface OAuthTokens {
	accessToken: string;
	refreshToken?: string;
}

export interface WorkspaceInfo {
	id: string;
	name: string;
}

export class AuthFlowService {
	private server: FastifyInstance | null = null;
	private callbackPort = parseInt(process.env.SYLAS_SERVER_PORT || "3456", 10);

	getCallbackPort(): number {
		return this.callbackPort;
	}

	async waitForCallback(clientId: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const baseUrl = process.env.SYLAS_BASE_URL;
			if (!baseUrl) {
				reject(new Error("SYLAS_BASE_URL environment variable is required"));
				return;
			}

			const redirectUri = `${baseUrl}/callback`;
			const oauthUrl = `https://linear.app/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=write,app:assignable,app:mentionable&actor=app`;

			this.server = Fastify({ logger: false });

			this.server.get("/callback", async (request, reply) => {
				const query = request.query as { code?: string; error?: string };
				const code = query.code;
				const error = query.error;

				if (error) {
					reply
						.type("text/html; charset=utf-8")
						.code(400)
						.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: system-ui; padding: 40px; text-align: center;">
<h2>Authorization failed</h2>
<p>${error}</p>
</body></html>`);
					reject(new Error(`OAuth error: ${error}`));
					return;
				}

				if (code) {
					reply
						.type("text/html; charset=utf-8")
						.code(200)
						.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: system-ui; padding: 40px; text-align: center;">
<h2>Sylas authorized successfully</h2>
<p>You can close this window and return to the terminal.</p>
</body></html>`);
					resolve(code);
					return;
				}

				reply
					.type("text/html; charset=utf-8")
					.code(400)
					.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: system-ui; padding: 40px; text-align: center;">
<h2>Missing authorization code</h2>
</body></html>`);
				reject(new Error("Missing authorization code"));
			});

			this.server
				.listen({ port: this.callbackPort, host: "0.0.0.0" })
				.then(() => {
					console.log(
						`Waiting for authorization on port ${this.callbackPort}...`,
					);
					console.log();
					console.log("Opening browser for Linear authorization...");
					console.log();
					console.log("If browser doesn't open, visit:");
					console.log(oauthUrl);
					console.log();

					openUrl(oauthUrl).catch(() => {
						console.log("Could not open browser automatically.");
					});
				})
				.catch((err) => {
					reject(new Error(`Server error: ${err.message}`));
				});
		});
	}

	async exchangeCodeForTokens(
		code: string,
		clientId: string,
		clientSecret: string,
	): Promise<OAuthTokens> {
		const baseUrl = process.env.SYLAS_BASE_URL;
		if (!baseUrl) {
			throw new Error("SYLAS_BASE_URL environment variable is required");
		}

		const redirectUri = `${baseUrl}/callback`;

		const response = await fetch("https://api.linear.app/oauth/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				code,
				redirect_uri: redirectUri,
				client_id: clientId,
				client_secret: clientSecret,
				grant_type: "authorization_code",
			}).toString(),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Token exchange failed: ${errorText}`);
		}

		const data = (await response.json()) as {
			access_token: string;
			refresh_token?: string;
		};

		if (!data.access_token || !data.access_token.startsWith("lin_oauth_")) {
			throw new Error("Invalid access token received");
		}

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
		};
	}

	async fetchWorkspaceInfo(accessToken: string): Promise<WorkspaceInfo> {
		const linearClient = new LinearClient({ accessToken });
		const viewer = await linearClient.viewer;
		const organization = await viewer.organization;

		if (!organization?.id) {
			throw new Error("Failed to get workspace info from Linear");
		}

		return { id: organization.id, name: organization.name || organization.id };
	}

	overwriteRepoConfigTokens(
		config: EdgeConfig,
		configPath: string,
		tokens: OAuthTokens,
		workspace: WorkspaceInfo,
	): void {
		for (const repo of config.repositories) {
			if (
				repo.linearWorkspaceId === workspace.id ||
				!repo.linearWorkspaceId ||
				repo.linearWorkspaceId === ""
			) {
				repo.linearToken = tokens.accessToken;
				repo.linearRefreshToken = tokens.refreshToken;
				repo.linearWorkspaceId = workspace.id;
				repo.linearWorkspaceName = workspace.name;
			}
		}

		writeFileSync(configPath, JSON.stringify(config, null, "\t"), "utf-8");
	}

	async cleanup(): Promise<void> {
		if (this.server) {
			await this.server.close();
			this.server = null;
		}
	}
}
