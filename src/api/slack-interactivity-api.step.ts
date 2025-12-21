/**
 * Slack Interactivity API
 * Handles button clicks from Slack approval messages
 * This endpoint receives POST requests from Slack when users click buttons
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { SlackService } from '../services/slack-service'

// Slack sends URL-encoded payload, but we'll parse it
const bodySchema = z.object({
    payload: z.string().optional(),
    // Direct JSON payload for testing
    action: z.enum(['approve', 'reject']).optional(),
    requestId: z.string().optional(),
    approver: z.string().optional(),
})

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'SlackInteractivityAPI',
    description: 'Handles interactive button clicks from Slack',
    flows: ['glasskiss'],
    method: 'POST',
    path: '/slack/interactivity',
    bodySchema,
    emits: ['provision-credentials'],
}

export const handler: Handlers['SlackInteractivityAPI'] = async (
    req,
    { logger, state, streams, emit }
) => {
    logger.info('Slack interactivity request received')

    let action: string
    let requestId: string
    let approver: string

    // Parse Slack payload (URL-encoded JSON string)
    if (req.body.payload) {
        try {
            const payload = JSON.parse(req.body.payload)

            // Extract action from button click
            const actionData = payload.actions?.[0]
            const actionId = actionData?.action_id || ''

            // action_id format: "approve_<requestId>" or "reject_<requestId>"
            if (actionId.startsWith('approve_')) {
                action = 'approve'
                requestId = actionId.replace('approve_', '')
            } else if (actionId.startsWith('reject_')) {
                action = 'reject'
                requestId = actionId.replace('reject_', '')
            } else {
                return {
                    status: 400,
                    body: { error: 'Unknown action' },
                } as any
            }

            // Get approver from Slack user
            approver = payload.user?.username || payload.user?.name || 'slack_user'

            logger.info('Slack interaction parsed', { action, requestId, approver })
        } catch (error) {
            logger.error('Failed to parse Slack payload', { error })
            return {
                status: 400,
                body: { error: 'Invalid payload' },
            } as any
        }
    } else if (req.body.action && req.body.requestId) {
        // Direct API call for testing
        action = req.body.action
        requestId = req.body.requestId
        approver = req.body.approver || 'api_user'
    } else {
        return {
            status: 400,
            body: { error: 'Missing payload or action' },
        } as any
    }

    // Get request state
    const requestState = await state.get('access-requests', requestId)
    if (!requestState) {
        logger.warn('Request not found', { requestId })
        return {
            status: 200,
            body: {
                response_type: 'ephemeral',
                text: `❌ Request \`${requestId}\` not found or already processed.`,
            },
        }
    }

    // Get approval state from STREAM (not state!)
    const allApprovals = await streams.approvalRequest.getGroup('approvals')
    const approvalState = allApprovals.find((a: any) => a.requestId === requestId)

    if (!approvalState) {
        logger.warn('Approval state not found', { requestId })
        return {
            status: 200,
            body: {
                response_type: 'ephemeral',
                text: `❌ Approval record for \`${requestId}\` not found.`,
            },
        }
    }

    logger.info('Found approval state', { requestId, approvalState })

    if (action === 'approve') {
        // For hackathon demo: allow any Slack user to approve
        // In production, you would check against approvalState.approvers
        logger.info('Approver authorized for demo', { approver, requiredApprovers: approvalState.approvers })

        // Update approval status in STREAM
        const newApprovals = (approvalState.currentApprovals || 0) + 1
        await streams.approvalRequest.set('approvals', approvalState.id, {
            ...approvalState,
            currentApprovals: newApprovals,
            status: newApprovals >= approvalState.requiredApprovals ? 'approved' : 'pending',
        })

        // Update request status
        await state.set('access-requests', requestId, {
            ...requestState,
            status: newApprovals >= approvalState.requiredApprovals ? 'approved' : 'pending_approval',
        })

        // If all approvals received, provision credentials
        if (newApprovals >= approvalState.requiredApprovals) {
            logger.info('All approvals received via Slack, provisioning credentials', { requestId })

            await emit({
                topic: 'provision-credentials',
                data: {
                    requestId,
                    requester: requestState.requester,
                    resource: requestState.resource,
                    accessLevel: requestState.accessLevel,
                    duration: requestState.duration,
                    reason: requestState.reason,
                },
            })

            // Send Slack confirmation
            try {
                await SlackService.sendApprovalConfirmation(requestId, approver, true)
            } catch (e) {
                // Ignore Slack errors
            }

            return {
                status: 200,
                body: {
                    response_type: 'in_channel',
                    text: `✅ Request \`${requestId}\` **APPROVED** by *${approver}*!\n🔑 Credentials are being provisioned...`,
                },
            }
        }

        return {
            status: 200,
            body: {
                response_type: 'in_channel',
                text: `✅ Approval recorded by *${approver}*.\n📊 Progress: ${newApprovals}/${approvalState.requiredApprovals} approvals`,
            },
        }
    } else if (action === 'reject') {
        // Update approval status in stream
        await streams.approvalRequest.set('approvals', approvalState.id, {
            ...approvalState,
            status: 'rejected',
        })

        // Update request state
        await state.set('access-requests', requestId, {
            ...requestState,
            status: 'rejected',
        })

        // Send Slack confirmation
        try {
            await SlackService.sendApprovalConfirmation(requestId, approver, false)
        } catch (e) {
            // Ignore Slack errors
        }

        logger.info('Request rejected via Slack', { requestId, approver })

        return {
            status: 200,
            body: {
                response_type: 'in_channel',
                text: `❌ Request \`${requestId}\` **REJECTED** by *${approver}*.`,
            },
        }
    }

    return {
        status: 400,
        body: { error: 'Invalid action' },
    } as any
}
