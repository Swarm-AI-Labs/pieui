'use client'

/**
 * Optional OpenAI-agent integration entry.
 *
 * These helpers depend on `@openai/agents` (which transitively pulls the OpenAI
 * + MCP SDKs). They are intentionally split out of the main `@swarm.ing/pieui`
 * barrel so that apps which only use the UI primitives never ship the agent
 * stack to the browser. Import from `@swarm.ing/pieui/agent` when you need to
 * expose PieCard methods as OpenAI function tools.
 */
export {
    getMittAgentTools,
    usePieMittAgentTools,
    type MittAgentTool,
    type MittAgentToolDescriptor,
    type MittAgentToolsOptions,
} from '../util/mittAgentTools'
export {
    default as useOpenAIWebRTC,
    type OpenAIEvent,
    type UseOpenAIWebRTCReturn,
} from '../util/useOpenAIWebRTC'
