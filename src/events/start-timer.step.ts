import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'

const inputSchema = z.object({
    requestId: z.string(),
    duration: z.number(),
})

export const config: EventConfig = {
    type: 'event',
    name: 'StartTimer',
    description: 'Starts durable timer for automatic access expiration',
    flows: ['glasskiss'],
    subscribes: ['start-timer'],
    emits: ['revoke-access'],
    input: inputSchema,
}

export const handler: Handlers['StartTimer'] = async (
    input,
    { logger, emit }
) => {
    const { requestId, duration } = input

    logger.info('Starting access timer', {
        requestId,
        durationMinutes: duration,
    })

    // Sleep for the duration (in milliseconds)
    // Note: Motia's event infrastructure handles durability
    const durationMs = duration * 60 * 1000

    logger.info('Timer sleeping...', {
        requestId,
        wakeAt: new Date(Date.now() + durationMs).toISOString(),
    })

    // Use setTimeout wrapped in a Promise for the demo
    // In production Motia, you might have a dedicated timer/sleep primitive
    await new Promise((resolve) => setTimeout(resolve, durationMs))

    logger.info('Timer expired, triggering revocation', { requestId })

    // Emit revoke event
    await emit({
        topic: 'revoke-access',
        data: {
            requestId,
            reason: 'timer_expired',
        },
    })
}
