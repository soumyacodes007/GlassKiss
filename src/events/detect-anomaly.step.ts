import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'

const inputSchema = z.object({
    requestId: z.string(),
    sessionId: z.string(),
    command: z.string(),
    logId: z.string(),
})

// Dangerous SQL patterns
const DANGEROUS_PATTERNS = [
    {
        name: 'DROP without confirmation',
        regex: /^DROP\s+(TABLE|DATABASE|SCHEMA)/i,
    },
    {
        name: 'TRUNCATE without confirmation',
        regex: /^TRUNCATE\s+TABLE/i,
    },
    {
        name: 'DELETE without WHERE clause',
        regex: /^DELETE\s+FROM\s+\w+\s*(?!WHERE)/i,
    },
    {
        name: 'UPDATE without WHERE clause',
        regex: /^UPDATE\s+\w+\s+SET\s+.*?(?!WHERE)/i,
    },
]

export const config: EventConfig = {
    type: 'event',
    name: 'DetectAnomaly',
    description: 'Analyzes SQL commands for dangerous patterns',
    flows: ['glasskiss'],
    subscribes: ['detect-anomaly'],
    emits: [
        {
            topic: 'force-revoke',
            label: 'Dangerous command detected',
            conditional: true,
        },
    ],
    input: inputSchema,
}

export const handler: Handlers['DetectAnomaly'] = async (
    input,
    { logger, streams, emit }
) => {
    const { requestId, sessionId, command, logId } = input

    // Check command against dangerous patterns
    let flagged = false
    let flagReason: string | undefined

    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.regex.test(command.trim())) {
            flagged = true
            flagReason = pattern.name
            break
        }
    }

    if (flagged) {
        logger.warn('Dangerous command detected!', {
            requestId,
            sessionId,
            command,
            flagReason,
        })

        // Update the log entry in stream
        const logEntry = await streams.sessionLog.get(sessionId, logId)
        if (logEntry) {
            await streams.sessionLog.set(sessionId, logId, {
                ...logEntry,
                flagged: true,
                flagReason,
            })
        }

        // Emit force-revoke event
        await emit({
            topic: 'force-revoke',
            data: {
                requestId,
                reason: 'anomaly_detected',
                details: `Dangerous command: ${flagReason}`,
            },
        })

        logger.error('Force revoke triggered', { requestId, flagReason })
    } else {
        logger.info('Command passed anomaly check', {
            requestId,
            command: command.substring(0, 50),
        })
    }
}
