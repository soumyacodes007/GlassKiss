import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { SlackService } from '../services/slack-service'

const inputSchema = z.object({
    requestId: z.string(),
    requester: z.string(),
    riskScore: z.number(),
    resource: z.string(),
    accessLevel: z.string(),
    reason: z.string(),
    requiredApprovals: z.number(),
})

export const config: EventConfig = {
    type: 'event',
    name: 'RequestApproval',
    description:
        'Creates approval request in stream and sends Slack notification',
    flows: ['glasskiss'],
    subscribes: ['request-approval'],
    emits: [],
    input: inputSchema,
}

export const handler: Handlers['RequestApproval'] = async (
    input,
    { logger, streams }
) => {
    const {
        requestId,
        requester,
        riskScore,
        resource,
        accessLevel,
        reason,
        requiredApprovals,
    } = input

    logger.info('Creating approval request', {
        requestId,
        riskScore,
        requiredApprovals,
    })

    // Determine approvers based on risk
    const approvers =
        riskScore > 70
            ? ['tech_lead_1', 'vp_engineering_1']
            : riskScore > 40
                ? ['tech_lead_1']
                : ['senior_dev_1']

    // Create approval request in stream
    const approvalId = randomBytes(8).toString('hex')
    await streams.approvalRequest.set('approvals', approvalId, {
        id: approvalId,
        requestId,
        requester,
        resource,
        accessLevel,
        reason,
        riskScore,
        status: 'pending',
        approvers,
        requiredApprovals,
        currentApprovals: 0,
        timestamp: new Date().toISOString(),
    })

    logger.info('Approval request created in stream', {
        approvalId,
        requestId,
        approvers,
    })

    // Send real Slack notification
    try {
        await SlackService.sendApprovalRequest({
            requestId,
            requester,
            resource,
            accessLevel,
            reason,
            riskScore,
            requiredApprovals,
            approvers,
        })
        logger.info('Slack notification sent', { requestId })
    } catch (error) {
        logger.warn('Failed to send Slack notification', { requestId, error })
    }
}

