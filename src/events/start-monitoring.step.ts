import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'

const inputSchema = z.object({
    requestId: z.string(),
    sessionId: z.string(),
})

export const config: EventConfig = {
    type: 'event',
    name: 'StartMonitoring',
    description: 'Initializes session monitoring',
    flows: ['glasskiss'],
    subscribes: ['start-monitoring'],
    emits: [],
    input: inputSchema,
}

export const handler: Handlers['StartMonitoring'] = async (
    input,
    { logger, state }
) => {
    const { requestId, sessionId } = input

    logger.info('Starting session monitoring', { requestId, sessionId })

    // Initialize monitoring metadata in state
    await state.set('monitoring', requestId, {
        requestId,
        sessionId,
        startedAt: new Date().toISOString(),
        commandCount: 0,
        flaggedCount: 0,
    })

    logger.info('Session monitoring initialized', { requestId, sessionId })
    // Note: Actual command logging happens via log-command-api.step.ts
}
