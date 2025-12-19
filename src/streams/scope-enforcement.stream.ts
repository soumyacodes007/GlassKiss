import { StreamConfig } from 'motia'
import { z } from 'zod'

export const scopeEnforcementStreamSchema = z.object({
    id: z.string(),
    sessionId: z.string(),
    requestId: z.string(),
    timestamp: z.string(),
    command: z.string(),
    decision: z.enum(['allowed', 'blocked']),
    reason: z.string().optional(),
    violationType: z.enum(['scope', 'blast_radius', 'operation', 'table', 'row_limit']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
})

export const config: StreamConfig = {
    name: 'scopeEnforcement',
    schema: scopeEnforcementStreamSchema,
    baseConfig: { storageType: 'default' },
}
