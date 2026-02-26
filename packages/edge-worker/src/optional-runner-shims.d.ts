/**
 * Type shims for optional peer-dependency runner packages.
 *
 * In CI (or any environment) where these packages haven't been built yet,
 * TypeScript cannot resolve their type declarations during edge-worker
 * compilation. These ambient module declarations let the dynamic imports
 * in RunnerRegistry.ts compile without errors.
 *
 * At runtime the real packages are resolved through workspace links.
 */

declare module "sylas-gemini-runner" {
	export const GeminiRunner: any;
	export const SimpleGeminiRunner: any;
}

declare module "sylas-simple-agent-runner" {
	export const SimpleClaudeRunner: any;
}

declare module "sylas-cursor-runner" {
	export const CursorRunner: any;
}

declare module "sylas-opencode-runner" {
	export const OpenCodeRunner: any;
}

declare module "sylas-claude-runner" {
	export const ClaudeRunner: any;
}

declare module "sylas-codex-runner" {
	export const CodexRunner: any;
}
