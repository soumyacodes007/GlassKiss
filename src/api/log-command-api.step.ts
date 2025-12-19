import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const bodySchema = z.object({
    command: z.string(),
})

const responseSchema = z.object({
    logged: z.boolean(),
    flagged: z.boolean(),
})

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'LogCommandAPI',
    description: 'Logs SQL commands from active sessions',
    flows: ['glasskiss'],
    method: 'POST',
    path: '/session/:sessionId/log',
    bodySchema,
    responseSchema: {
        200: responseSchema,
    },
    emits: ['detect-anomaly'],
}

export const handler: Handlers['LogCommandAPI'] = async (
    req,
    { logger, streams, emit, state }
) => {
    const { sessionId } = req.pathParams
    const { command } = req.body

    // Find the request associated with this session
    const allCredentials = await state.getGroup('credentials')
    const credential = allCredentials.find((c: any) => c.sessionId === sessionId)

    if (!credential) {
        return {
            status: 404,
            body: { error: 'Session not found' },
        } as any
    }

    const requestId = (credential as any).requestId

    // Determine query type
    const queryType = determineQueryType(command)

    // Create log entry in stream
    const logId = randomBytes(8).toString('hex')
    await streams.sessionLog.set(sessionId, logId, {
        id: logId,
        requestId,
        sessionId,
        timestamp: new Date().toISOString(),
        command,
        queryType,
        flagged: false,
    })

    logger.info('Command logged', {
        requestId,
        sessionId,
        queryType,
        command: command.substring(0, 100),
    })

    // Emit to anomaly detector
    await emit({
        topic: 'detect-anomaly',
        data: {
            requestId,
            sessionId,
            command,
            logId,
        },
    })

    return {
        status: 200,
        body: {
            logged: true,
            flagged: false, // Will be updated by detector if needed
        },
    }
}

function determineQueryType(command: string): string {
    const upperCmd = command.trim().toUpperCase()

    if (upperCmd.startsWith('SELECT')) return 'SELECT'
    if (upperCmd.startsWith('INSERT')) return 'INSERT'
    if (upperCmd.startsWith('UPDATE')) return 'UPDATE'
    if (upperCmd.startsWith('DELETE')) return 'DELETE'
    if (upperCmd.startsWith('DROP')) return 'DROP'
    if (upperCmd.startsWith('CREATE')) return 'CREATE'
    if (upperCmd.startsWith('ALTER')) return 'ALTER'
    if (upperCmd.startsWith('TRUNCATE')) return 'TRUNCATE'

    return 'OTHER'
}
