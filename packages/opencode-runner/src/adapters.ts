/**
 * OpenCode Event Adapters
 *
 * Converts OpenCode SSE events to SDKMessage format for compatibility
 * with the Cyrus infrastructure. Follows the adapter pattern used in gemini-runner.
 *
 * @packageDocumentation
 */

import crypto from "node:crypto";
import type {
	AssistantMessage,
	Event,
	EventMessagePartUpdated,
	EventMessageUpdated,
	EventSessionError,
	EventSessionIdle,
	EventSessionStatus,
	Part,
	TextPart,
	ToolPart,
	ToolStateCompleted,
	ToolStateError,
	UserMessage,
} from "@opencode-ai/sdk";
import type {
	SDKAssistantMessage,
	SDKMessage,
	SDKResultMessage,
	SDKUserMessage,
} from "cyrus-core";

// ============================================================================
// Types
// ============================================================================

/**
 * Accumulated message state for building complete messages from parts.
 */
export interface AccumulatedMessage {
	messageId: string;
	sessionId: string;
	role: "user" | "assistant";
	contentBlocks: Array<{
		type: "text" | "tool_use" | "tool_result";
		id?: string;
		text?: string;
		name?: string;
		input?: Record<string, unknown>;
		tool_use_id?: string;
		content?: string;
		is_error?: boolean;
	}>;
	tokenMetrics?: {
		inputTokens: number;
		outputTokens: number;
	};
}

/**
 * OpenCode event that we process - a subset of all Event types.
 */
export type ProcessableEvent =
	| EventMessagePartUpdated
	| EventMessageUpdated
	| EventSessionIdle
	| EventSessionError
	| EventSessionStatus;

// ============================================================================
// CLI Event Types (from `opencode run --format json`)
// ============================================================================

/**
 * CLI events are structurally different from SDK SSE events:
 *   SDK:  { type: "message.part.updated", properties: { part: {...} } }
 *   CLI:  { type: "text", sessionID: "ses_...", timestamp: 123, ... }
 *
 * The CLI outputs newline-delimited JSON with these event types:
 *   step_start, text, tool_use, step_finish
 */

interface CLIEventBase {
	type: string;
	timestamp: number;
	sessionID: string;
}

export interface CLIStepStartEvent extends CLIEventBase {
	type: "step_start";
	part?: {
		id?: string;
		sessionID?: string;
		messageID?: string;
	};
}

export interface CLITextEvent extends CLIEventBase {
	type: "text";
	content?: string;
	part?: {
		id?: string;
		sessionID?: string;
		messageID?: string;
		type?: string;
		text?: string;
	};
}

export interface CLIToolUseEvent extends CLIEventBase {
	type: "tool_use";
	part?: {
		id?: string;
		sessionID?: string;
		messageID?: string;
		type?: string;
		tool?: string;
		callID?: string;
		state?: {
			status?: string;
			input?: Record<string, unknown>;
			output?: string;
			error?: string;
		};
	};
}

export interface CLIStepFinishEvent extends CLIEventBase {
	type: "step_finish";
	part?: {
		id?: string;
		sessionID?: string;
		messageID?: string;
	};
}

export type CLIEvent =
	| CLIStepStartEvent
	| CLITextEvent
	| CLIToolUseEvent
	| CLIStepFinishEvent;

// ============================================================================
// CLI Event Type Guards
// ============================================================================

export function isCLIEvent(event: unknown): event is CLIEvent {
	if (typeof event !== "object" || event === null) return false;
	const e = event as Record<string, unknown>;
	return (
		typeof e.sessionID === "string" &&
		typeof e.type === "string" &&
		!(e.type as string).includes(".")
	);
}

export function isCLIStepStart(event: CLIEvent): event is CLIStepStartEvent {
	return event.type === "step_start";
}

export function isCLIText(event: CLIEvent): event is CLITextEvent {
	return event.type === "text";
}

export function isCLIToolUse(event: CLIEvent): event is CLIToolUseEvent {
	return event.type === "tool_use";
}

export function isCLIStepFinish(event: CLIEvent): event is CLIStepFinishEvent {
	return event.type === "step_finish";
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a minimal BetaMessage for assistant responses.
 *
 * Since we're adapting from OpenCode to Claude SDK format, we create
 * a minimal valid BetaMessage structure with placeholder values for fields
 * that OpenCode doesn't provide (stop_reason, usage, etc.).
 */
function createBetaMessage(
	content: string | Array<Record<string, unknown>>,
	messageId: string = crypto.randomUUID(),
): SDKAssistantMessage["message"] {
	// Convert string to content blocks, or use array directly
	const contentBlocks = (typeof content === "string"
		? [{ type: "text", text: content }]
		: content) as unknown as SDKAssistantMessage["message"]["content"];

	return {
		id: messageId,
		type: "message" as const,
		role: "assistant" as const,
		content: contentBlocks,
		model: "opencode" as const,
		stop_reason: null,
		stop_sequence: null,
		usage: {
			input_tokens: 0,
			output_tokens: 0,
			cache_creation_input_tokens: 0,
			cache_read_input_tokens: 0,
			cache_creation: null,
			server_tool_use: null,
			service_tier: null,
			inference_geo: "",
			iterations: [],
		},
		container: null,
		context_management: null,
	};
}

/**
 * Create token usage object from OpenCode token metrics.
 */
function createUsage(tokens?: {
	input: number;
	output: number;
	reasoning?: number;
	cache?: { read: number; write: number };
}): SDKResultMessage["usage"] {
	return {
		input_tokens: tokens?.input || 0,
		output_tokens: tokens?.output || 0,
		cache_creation_input_tokens: tokens?.cache?.write || 0,
		cache_read_input_tokens: tokens?.cache?.read || 0,
		cache_creation: {
			ephemeral_1h_input_tokens: 0,
			ephemeral_5m_input_tokens: 0,
		},
		server_tool_use: {
			web_fetch_requests: 0,
			web_search_requests: 0,
		},
		service_tier: "standard" as const,
		inference_geo: "",
		iterations: [],
	};
}

// ============================================================================
// Event Type Guards
// ============================================================================

/**
 * Check if event is a message part update.
 */
export function isMessagePartUpdated(
	event: Event,
): event is EventMessagePartUpdated {
	return event.type === "message.part.updated";
}

/**
 * Check if event is a message update.
 */
export function isMessageUpdated(event: Event): event is EventMessageUpdated {
	return event.type === "message.updated";
}

/**
 * Check if event is a session idle event.
 */
export function isSessionIdle(event: Event): event is EventSessionIdle {
	return event.type === "session.idle";
}

/**
 * Check if event is a session error event.
 */
export function isSessionError(event: Event): event is EventSessionError {
	return event.type === "session.error";
}

/**
 * Check if event is a session status event.
 */
export function isSessionStatus(event: Event): event is EventSessionStatus {
	return event.type === "session.status";
}

/**
 * Check if a part is a text part.
 */
export function isTextPart(part: Part): part is TextPart {
	return part.type === "text";
}

/**
 * Check if a part is a tool part.
 */
export function isToolPart(part: Part): part is ToolPart {
	return part.type === "tool";
}

/**
 * Check if tool state is completed.
 */
export function isToolStateCompleted(
	state: ToolPart["state"],
): state is ToolStateCompleted {
	return state.status === "completed";
}

/**
 * Check if tool state is error.
 */
export function isToolStateError(
	state: ToolPart["state"],
): state is ToolStateError {
	return state.status === "error";
}

// ============================================================================
// Part Conversion Functions
// ============================================================================

/**
 * Convert an OpenCode TextPart to SDK text content block.
 */
export function textPartToContentBlock(part: TextPart): {
	type: "text";
	text: string;
} {
	return {
		type: "text",
		text: part.text,
	};
}

/**
 * Convert an OpenCode ToolPart to SDK tool_use content block.
 *
 * Note: Only tool parts in "running" or later states have meaningful data.
 * "pending" state may have incomplete input (raw JSON string).
 */
export function toolPartToToolUseBlock(part: ToolPart): {
	type: "tool_use";
	id: string;
	name: string;
	input: Record<string, unknown>;
} {
	return {
		type: "tool_use",
		id: part.callID,
		name: part.tool,
		input: part.state.input || {},
	};
}

/**
 * Convert a completed ToolPart to SDK tool_result content block.
 *
 * This is used when we need to emit the tool result as a user message.
 */
export function toolPartToToolResultBlock(part: ToolPart): {
	type: "tool_result";
	tool_use_id: string;
	content: string;
	is_error: boolean;
} {
	if (isToolStateCompleted(part.state)) {
		return {
			type: "tool_result",
			tool_use_id: part.callID,
			content: part.state.output,
			is_error: false,
		};
	} else if (isToolStateError(part.state)) {
		return {
			type: "tool_result",
			tool_use_id: part.callID,
			content: part.state.error,
			is_error: true,
		};
	}
	// For pending/running states, return empty result
	return {
		type: "tool_result",
		tool_use_id: part.callID,
		content: "",
		is_error: false,
	};
}

// ============================================================================
// Message Conversion Functions
// ============================================================================

/**
 * Convert an OpenCode message part update event to SDK message.
 *
 * This handles individual part updates as they stream in.
 * The caller is responsible for accumulating parts into complete messages.
 *
 * @param event - The message.part.updated event
 * @param sessionId - Current session ID
 * @returns SDKMessage or null if part type doesn't map to a message
 */
export function partEventToSDKMessage(
	event: EventMessagePartUpdated,
	sessionId: string | null,
): SDKMessage | null {
	const part = event.properties.part;
	const delta = event.properties.delta;

	if (isTextPart(part)) {
		// Text part - emit as assistant message
		const text = delta !== undefined ? delta : part.text;

		const assistantMessage: SDKAssistantMessage = {
			type: "assistant",
			message: createBetaMessage([{ type: "text", text }], part.messageID),
			parent_tool_use_id: null,
			uuid: crypto.randomUUID(),
			session_id: sessionId || "pending",
		};
		return assistantMessage;
	}

	if (isToolPart(part)) {
		// Tool part - handle based on state
		if (part.state.status === "running") {
			// Tool invocation - emit as assistant message with tool_use
			const assistantMessage: SDKAssistantMessage = {
				type: "assistant",
				message: createBetaMessage(
					[toolPartToToolUseBlock(part)],
					part.messageID,
				),
				parent_tool_use_id: null,
				uuid: crypto.randomUUID(),
				session_id: sessionId || "pending",
			};
			return assistantMessage;
		}

		if (part.state.status === "completed" || part.state.status === "error") {
			// Tool result - emit as user message with tool_result
			const toolResultMessage: SDKUserMessage = {
				type: "user",
				message: {
					role: "user",
					content: [toolPartToToolResultBlock(part)],
				},
				parent_tool_use_id: null,
				session_id: sessionId || "pending",
			};
			return toolResultMessage;
		}
	}

	// Other part types (file, snapshot, patch, etc.) - not mapped
	return null;
}

/**
 * Convert an OpenCode message update event to SDK message.
 *
 * This handles complete message updates (not individual parts).
 *
 * @param event - The message.updated event
 * @param sessionId - Current session ID
 * @returns SDKMessage or null
 */
export function messageEventToSDKMessage(
	event: EventMessageUpdated,
	sessionId: string | null,
): SDKMessage | null {
	const message = event.properties.info;

	if (message.role === "user") {
		// User message - rarely needed but included for completeness
		const userMsg = message as UserMessage;
		const userMessage: SDKUserMessage = {
			type: "user",
			message: {
				role: "user",
				content: userMsg.summary?.title || "User message",
			},
			parent_tool_use_id: null,
			session_id: sessionId || "pending",
		};
		return userMessage;
	}

	// Assistant message - this is typically the completion signal
	// We use this to check for completion state via time.completed
	return null;
}

/**
 * Synthesize an SDKResultMessage from completion state.
 *
 * OpenCode doesn't have a dedicated result message - we synthesize from:
 * - AssistantMessage.finish === "stop"
 * - AssistantMessage.time.completed set
 * - session.idle event
 *
 * @param sessionId - Current session ID
 * @param lastAssistantMessage - Last assistant message for content extraction
 * @param assistantInfo - Optional AssistantMessage info for token metrics
 * @returns SDKResultMessage
 */
export function synthesizeResultMessage(
	sessionId: string | null,
	lastAssistantMessage?: SDKAssistantMessage | null,
	assistantInfo?: AssistantMessage | null,
): SDKResultMessage {
	// Extract result content from last assistant message
	let resultContent = "Session completed successfully";
	if (lastAssistantMessage?.message?.content) {
		const content = lastAssistantMessage.message.content;
		if (Array.isArray(content) && content.length > 0) {
			const textBlock = content.find((block) => block.type === "text");
			if (textBlock && "text" in textBlock) {
				resultContent = textBlock.text;
			}
		}
	}

	// Calculate duration if we have timing info
	let durationMs = 0;
	if (assistantInfo?.time?.created && assistantInfo?.time?.completed) {
		durationMs = assistantInfo.time.completed - assistantInfo.time.created;
	}

	return {
		type: "result",
		subtype: "success",
		duration_ms: durationMs,
		duration_api_ms: 0,
		is_error: false,
		num_turns: 0, // OpenCode doesn't track this directly
		result: resultContent,
		stop_reason: "end_turn",
		total_cost_usd: assistantInfo?.cost || 0,
		usage: createUsage(assistantInfo?.tokens),
		modelUsage: {},
		permission_denials: [],
		uuid: crypto.randomUUID(),
		session_id: sessionId || "pending",
	};
}

/**
 * Convert a session error event to SDKResultMessage.
 *
 * @param event - The session.error event
 * @param sessionId - Current session ID
 * @returns SDKResultMessage with error info
 */
export function errorEventToSDKMessage(
	event: EventSessionError,
	sessionId: string | null,
): SDKResultMessage {
	const error = event.properties.error;

	// Format error message based on error type
	let errorMessage = "Unknown error";
	if (error) {
		// Extract message from error data if available
		const errorData = error.data as { message?: string; statusCode?: number };
		errorMessage = errorData?.message || error.name;
		if (errorData?.statusCode !== undefined) {
			errorMessage += ` (status: ${errorData.statusCode})`;
		}
	}

	return {
		type: "result",
		subtype: "error_during_execution",
		duration_ms: 0,
		duration_api_ms: 0,
		is_error: true,
		num_turns: 0,
		errors: [errorMessage],
		stop_reason: null,
		total_cost_usd: 0,
		usage: createUsage(),
		modelUsage: {},
		permission_denials: [],
		uuid: crypto.randomUUID(),
		session_id: sessionId || "pending",
	};
}

// ============================================================================
// CLI Event Conversion Functions
// ============================================================================

function cliTextToSDKMessage(
	event: CLITextEvent,
	sessionId: string | null,
): SDKAssistantMessage | null {
	const text = event.content || event.part?.text || "";
	if (!text) return null;

	return {
		type: "assistant",
		message: createBetaMessage(
			[{ type: "text", text }],
			event.part?.messageID || crypto.randomUUID(),
		),
		parent_tool_use_id: null,
		uuid: crypto.randomUUID(),
		session_id: sessionId || "pending",
	};
}

function cliToolUseToSDKMessage(
	event: CLIToolUseEvent,
	sessionId: string | null,
): SDKMessage | null {
	const part = event.part;
	if (!part) return null;

	const status = part.state?.status || "running";
	const toolId = part.callID || part.id || crypto.randomUUID();

	if (status === "running" || status === "pending") {
		const assistantMessage: SDKAssistantMessage = {
			type: "assistant",
			message: createBetaMessage(
				[
					{
						type: "tool_use",
						id: toolId,
						name: part.tool || "unknown_tool",
						input: part.state?.input || {},
					},
				],
				part.messageID || crypto.randomUUID(),
			),
			parent_tool_use_id: null,
			uuid: crypto.randomUUID(),
			session_id: sessionId || "pending",
		};
		return assistantMessage;
	}

	if (status === "completed" || status === "error") {
		const toolResultMessage: SDKUserMessage = {
			type: "user",
			message: {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: toolId,
						content:
							status === "completed"
								? part.state?.output || ""
								: part.state?.error || "Tool error",
						is_error: status === "error",
					},
				],
			},
			parent_tool_use_id: null,
			session_id: sessionId || "pending",
		};
		return toolResultMessage;
	}

	return null;
}

// ============================================================================
// Main Adapter Function
// ============================================================================

/**
 * Convert an OpenCode event to cyrus-core SDKMessage format.
 *
 * This adapter maps OpenCode's SSE events to the cyrus-core SDKMessage format,
 * allowing OpenCodeRunner to implement the IAgentRunner interface.
 *
 * NOTE: This adapter is stateless for most events. For complete message
 * accumulation, the caller (OpenCodeRunner) should track parts and build
 * complete messages.
 *
 * @param event - OpenCode SSE event
 * @param sessionId - Current session ID (may be null initially)
 * @param lastAssistantMessage - Last assistant message for result coercion (optional)
 * @param lastAssistantInfo - Last assistant message info for metrics (optional)
 * @returns SDKMessage or null if event type doesn't map to a message
 */
export function openCodeEventToSDKMessage(
	event: Event,
	sessionId: string | null,
	lastAssistantMessage?: SDKAssistantMessage | null,
	lastAssistantInfo?: AssistantMessage | null,
): SDKMessage | null {
	// CLI format: events from `opencode run --format json`
	// Detected by root-level sessionID + non-dotted type string
	if (isCLIEvent(event as unknown)) {
		const cliEvent = event as unknown as CLIEvent;

		if (isCLIText(cliEvent)) {
			return cliTextToSDKMessage(cliEvent, sessionId);
		}
		if (isCLIToolUse(cliEvent)) {
			return cliToolUseToSDKMessage(cliEvent, sessionId);
		}
		// step_start / step_finish: no SDK message needed
		// Result is synthesized at process exit in OpenCodeRunner
		return null;
	}

	// SDK SSE format: events from OpenCode SDK server
	if (isMessagePartUpdated(event)) {
		return partEventToSDKMessage(event, sessionId);
	}

	if (isMessageUpdated(event)) {
		const message = event.properties.info;
		if (message.role === "assistant") {
			const assistantMsg = message as AssistantMessage;
			if (assistantMsg.finish === "stop" && assistantMsg.time?.completed) {
				// Defer result to session.idle
			}
		}
		return messageEventToSDKMessage(event, sessionId);
	}

	if (isSessionIdle(event)) {
		return synthesizeResultMessage(
			sessionId,
			lastAssistantMessage,
			lastAssistantInfo,
		);
	}

	if (isSessionError(event)) {
		return errorEventToSDKMessage(event, sessionId);
	}

	return null;
}

/**
 * Extract session ID from an OpenCode event.
 *
 * @param event - OpenCode event
 * @returns Session ID if available, null otherwise
 */
export function extractSessionId(event: Event): string | null {
	// CLI format: all CLI events have sessionID at root level
	const anyEvent = event as unknown as Record<string, unknown>;
	if (typeof anyEvent.sessionID === "string" && anyEvent.sessionID) {
		return anyEvent.sessionID;
	}

	// SDK SSE format
	if (isMessagePartUpdated(event)) {
		return event.properties.part.sessionID;
	}
	if (isMessageUpdated(event)) {
		return event.properties.info.sessionID;
	}
	if (isSessionIdle(event)) {
		return event.properties.sessionID;
	}
	if (isSessionError(event)) {
		return event.properties.sessionID || null;
	}
	if (isSessionStatus(event)) {
		return event.properties.sessionID;
	}
	return null;
}

/**
 * Create a Cyrus Core SDK UserMessage from a plain string prompt.
 *
 * Helper function to create properly formatted SDKUserMessage objects
 * for sending to OpenCode.
 *
 * @param content - The prompt text
 * @param sessionId - Current session ID (may be null for initial message)
 * @returns Formatted SDKUserMessage
 */
export function createUserMessage(
	content: string,
	sessionId: string | null,
): SDKUserMessage {
	return {
		type: "user",
		message: {
			role: "user",
			content: content,
		},
		parent_tool_use_id: null,
		session_id: sessionId || "pending",
	};
}
