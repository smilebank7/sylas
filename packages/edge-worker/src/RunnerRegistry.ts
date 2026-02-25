import type { AgentRunnerConfig, IAgentRunner, ILogger } from "sylas-core";
import { createLogger } from "sylas-core";

/**
 * Known runner types and their corresponding npm package names.
 */
export type RunnerKind = "omo" | "omc" | "omx" | "gemini" | "cursor";

const RUNNER_PACKAGES: Record<RunnerKind, string> = {
	omo: "sylas-omo-runner",
	omc: "sylas-omc-runner",
	omx: "sylas-omx-runner",
	gemini: "sylas-gemini-runner",
	cursor: "sylas-cursor-runner",
};

/**
 * Map from package module export name to the class/factory we need.
 * Each runner package exports its runner class as a named export.
 */
const RUNNER_EXPORT_NAMES: Record<RunnerKind, string> = {
	omo: "OmoRunner",
	omc: "OmcRunner",
	omx: "OmxRunner",
	gemini: "GeminiRunner",
	cursor: "CursorRunner",
};

export class RunnerNotInstalledError extends Error {
	public readonly runnerKind: RunnerKind;
	public readonly packageName: string;

	constructor(kind: RunnerKind, cause?: unknown) {
		const pkg = RUNNER_PACKAGES[kind];
		super(
			`Runner "${kind}" is not installed. Install it with: npm install ${pkg}`,
		);
		this.name = "RunnerNotInstalledError";
		this.runnerKind = kind;
		this.packageName = pkg;
		if (cause instanceof Error) {
			this.cause = cause;
		}
	}
}

/**
 * Dynamically import a runner package and instantiate the runner.
 *
 * Uses literal string imports so bundlers can resolve them statically.
 * Falls back to RunnerNotInstalledError when the package is missing.
 */
export async function createRunner(
	kind: RunnerKind,
	config: AgentRunnerConfig,
	logger?: ILogger,
): Promise<IAgentRunner> {
	const log = logger ?? createLogger({ component: "RunnerRegistry" });

	try {
		let mod: any;

		// Use literal string imports for each runner so bundlers can resolve them.
		// Each case uses a direct string literal (not a variable) for compatibility.
		switch (kind) {
			case "omo":
				mod = await import("sylas-omo-runner");
				break;
			case "omc":
				mod = await import("sylas-omc-runner");
				break;
			case "omx":
				mod = await import("sylas-omx-runner");
				break;
			case "gemini":
				mod = await import("sylas-gemini-runner");
				break;
			case "cursor":
				mod = await import("sylas-cursor-runner");
				break;
			default: {
				const _exhaustive: never = kind;
				throw new Error(`Unknown runner kind: ${_exhaustive}`);
			}
		}

		const RunnerClass = mod[RUNNER_EXPORT_NAMES[kind]];
		if (!RunnerClass) {
			throw new Error(
				`Runner package "${RUNNER_PACKAGES[kind]}" does not export "${RUNNER_EXPORT_NAMES[kind]}"`,
			);
		}

		log.debug(`Loaded runner: ${kind} from ${RUNNER_PACKAGES[kind]}`);
		return new RunnerClass(config);
	} catch (error: any) {
		// Check for module-not-found errors (Node and Bun have different codes)
		const message = String(error?.message ?? error);
		if (
			error?.code === "MODULE_NOT_FOUND" ||
			error?.code === "ERR_MODULE_NOT_FOUND" ||
			/Cannot find (package|module)/.test(message) ||
			/No such module/.test(message)
		) {
			throw new RunnerNotInstalledError(kind, error);
		}
		throw error;
	}
}
