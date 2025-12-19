import { StreamConfig } from 'motia'
import { z } from 'zod'

export const auditReportStreamSchema = z.object({
    id: z.string(),
    requestId: z.string(),
    requester: z.string(),
    resource: z.string(),
    accessLevel: z.string(),
    approvers: z.array(z.string()),
    riskScore: z.number(),
    startTime: z.string(),
    endTime: z.string(),
    totalCommands: z.number(),
    summary: z.string(),
    flaggedCommands: z.number(),
    status: z.string(),
    revokeReason: z.string().optional(),
})

export const config: StreamConfig = {
    name: 'auditReport',
    schema: auditReportStreamSchema,
    baseConfig: { storageType: 'default' },
}
