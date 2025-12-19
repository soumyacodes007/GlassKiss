import { StreamConfig } from 'motia'
import { z } from 'zod'

export const approvalRequestStreamSchema = z.object({
    id: z.string(),
    requestId: z.string(),
    requester: z.string(),
    resource: z.string(),
    accessLevel: z.string(),
    reason: z.string(),
    riskScore: z.number(),
    status: z.enum(['pending', 'approved', 'rejected']),
    approvers: z.array(z.string()),
    requiredApprovals: z.number(),
    currentApprovals: z.number(),
    timestamp: z.string(),
})

export const config: StreamConfig = {
    name: 'approvalRequest',
    schema: approvalRequestStreamSchema,
    baseConfig: { storageType: 'default' },
}
