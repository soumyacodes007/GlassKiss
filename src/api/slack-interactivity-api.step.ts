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

    // Get approval state
    const allApprovals = await state.getGroup('approval-status')
    const approvalState = allApprovals.find((a: any) => a.requestId === requestId)

    if (!approvalState) {
        return {
            status: 200,
            body: {
                response_type: 'ephemeral',
                text: `❌ Approval record for \`${requestId}\` not found.`,
            },
        }
    }

    if (action === 'approve') {
        // Check if approver is authorized
        if (!approvalState.approvers?.includes(approver)) {
            // For Slack users, allow if they have the word "lead" or "senior" in their name
            const isAuthorized =
                approver.toLowerCase().includes('lead') ||
                approver.toLowerCase().includes('senior') ||
                approver.toLowerCase().includes('vp') ||
                approvalState.approvers?.includes(approver)

            if (!isAuthorized) {
                logger.warn('Unauthorized approver from Slack', { approver, requiredApprovers: approvalState.approvers })
                return {
                    status: 200,
                    body: {
                        response_type: 'ephemeral',
                        text: `⚠️ You are not authorized to approve this request.\nRequired approvers: ${approvalState.approvers?.join(', ')}`,
                    },
                }
            }
        }

        // Update approval status
        const newApprovals = (approvalState.currentApprovals || 0) + 1
        await state.set('approval-status', requestId, {
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
        // Update states for rejection
        await state.set('approval-status', requestId, {
            ...approvalState,
            status: 'rejected',
        })

        await state.set('access-requests', requestId, {
            ...requestState,
            status: 'rejected',
        })

        // Update stream
        const approvalEntry = (await streams.approvalRequest.list('approvals')).find(
            (a: any) => a.requestId === requestId
        )
        if (approvalEntry) {
            await streams.approvalRequest.set('approvals', approvalEntry.id, {
                ...approvalEntry,
                status: 'rejected',
            })
        }

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
