import { StreamConfig } from 'motia'
import { z } from 'zod'

export const sessionLogStreamSchema = z.object({
    id: z.string(),
    requestId: z.string(),
    sessionId: z.string(),
    timestamp: z.string(),
    command: z.string(),
    queryType: z.string(),
    flagged: z.boolean(),
    flagReason: z.string().optional(),
})

export const config: StreamConfig = {
    name: 'sessionLog',
    schema: sessionLogStreamSchema,
    baseConfig: { storageType: 'default' },
}
