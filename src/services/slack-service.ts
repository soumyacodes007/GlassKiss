/**
 * Slack Notification Service
 * Sends real notifications for access requests, approvals, and alerts
 */

import { WebClient } from '@slack/web-api'

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN)
const defaultChannel = process.env.SLACK_CHANNEL_ID || 'general'

export interface ApprovalNotification {
    requestId: string
    requester: string
    resource: string
    accessLevel: string
    reason: string
    riskScore: number
    requiredApprovals: number
    approvers: string[]
}

export interface AlertNotification {
    requestId: string
    sessionId: string
    alertType: 'blocked' | 'anomaly' | 'revoked' | 'zombie'
    details: string
    severity: 'low' | 'medium' | 'high' | 'critical'
}

export class SlackService {
    /**
     * Test Slack connection
     */
    static async testConnection(): Promise<boolean> {
        try {
            const result = await slack.auth.test()
            console.log(`[SLACK] ✅ Connected as: ${result.user}`)
            return true
        } catch (error) {
            console.error('[SLACK] ❌ Connection failed:', error)
            return false
        }
    }

    /**
     * Send approval request notification
     */
    static async sendApprovalRequest(notification: ApprovalNotification): Promise<boolean> {
        try {
            const riskEmoji = notification.riskScore > 70 ? '🔴' :
                notification.riskScore > 40 ? '🟡' : '🟢'

            const riskLevel = notification.riskScore > 70 ? 'HIGH' :
                notification.riskScore > 40 ? 'MEDIUM' : 'LOW'

            await slack.chat.postMessage({
                channel: defaultChannel,
                text: `🔐 Access Request: ${notification.requester} needs ${notification.accessLevel} to ${notification.resource}`,
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: '🔐 Access Request Pending Approval',
                            emoji: true
                        }
                    },
                    {
                        type: 'section',
                        fields: [
                            {
                                type: 'mrkdwn',
                                text: `*Requester:*\n${notification.requester}`
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Resource:*\n${notification.resource}`
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Access Level:*\n${notification.accessLevel}`
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Risk Score:*\n${riskEmoji} ${notification.riskScore}/100 (${riskLevel})`
                            }
                        ]
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Reason:*\n> ${notification.reason}`
                        }
                    },
                    {
                        type: 'section',
                        fields: [
                            {
                                type: 'mrkdwn',
                                text: `*Required Approvals:*\n${notification.requiredApprovals}`
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Designated Approvers:*\n${notification.approvers.join(', ')}`
                            }
                        ]
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: `Request ID: \`${notification.requestId}\``
                            }
                        ]
                    },
                    {
                        type: 'actions',
                        elements: [
                            {
                                type: 'button',
                                text: {
                                    type: 'plain_text',
                                    text: '✅ Approve',
                                    emoji: true
                                },
                                style: 'primary',
                                action_id: `approve_${notification.requestId}`,
                                // When Slack interactivity URL is configured, this button
                                // will POST to /slack/interactivity endpoint
                                // For local dev without ngrok, use the API directly:
                                // curl -X POST http://localhost:3000/slack/interactivity \
                                //   -H "Content-Type: application/json" \
                                //   -d '{"action":"approve","requestId":"xxx","approver":"you"}'
                            },
                            {
                                type: 'button',
                                text: {
                                    type: 'plain_text',
                                    text: '❌ Reject',
                                    emoji: true
                                },
                                style: 'danger',
                                action_id: `reject_${notification.requestId}`,
                            }
                        ]
                    }
                ]
            })

            console.log(`[SLACK] ✅ Sent approval request for ${notification.requestId}`)
            return true
        } catch (error) {
            console.error('[SLACK] ❌ Failed to send approval request:', error)
            return false
        }
    }

    /**
     * Send approval confirmation
     */
    static async sendApprovalConfirmation(
        requestId: string,
        approver: string,
        approved: boolean,
        sessionId?: string
    ): Promise<boolean> {
        try {
            const emoji = approved ? '✅' : '❌'
            const action = approved ? 'APPROVED' : 'REJECTED'

            await slack.chat.postMessage({
                channel: defaultChannel,
                text: `${emoji} Request ${requestId} ${action} by ${approver}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `${emoji} *Request ${action}*\n\nRequest \`${requestId}\` was ${action.toLowerCase()} by *${approver}*`
                        }
                    },
                    ...(approved && sessionId ? [{
                        type: 'context' as const,
                        elements: [{
                            type: 'mrkdwn' as const,
                            text: `Session ID: \`${sessionId}\` | Credentials provisioned`
                        }]
                    }] : [])
                ]
            })

            return true
        } catch (error) {
            console.error('[SLACK] ❌ Failed to send confirmation:', error)
            return false
        }
    }

    /**
     * Send security alert
     */
    static async sendSecurityAlert(alert: AlertNotification): Promise<boolean> {
        try {
            const severityEmoji = {
                low: '🟢',
                medium: '🟡',
                high: '🟠',
                critical: '🔴'
            }[alert.severity]

            const alertTypeEmoji = {
                blocked: '🚫',
                anomaly: '⚠️',
                revoked: '🔒',
                zombie: '🧟'
            }[alert.alertType]

            await slack.chat.postMessage({
                channel: defaultChannel,
                text: `${alertTypeEmoji} Security Alert: ${alert.alertType.toUpperCase()}`,
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: `${alertTypeEmoji} Security Alert: ${alert.alertType.toUpperCase()}`,
                            emoji: true
                        }
                    },
                    {
                        type: 'section',
                        fields: [
                            {
                                type: 'mrkdwn',
                                text: `*Severity:*\n${severityEmoji} ${alert.severity.toUpperCase()}`
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Request ID:*\n\`${alert.requestId}\``
                            }
                        ]
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Details:*\n${alert.details}`
                        }
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: `Session: \`${alert.sessionId}\` | Alert generated at ${new Date().toISOString()}`
                            }
                        ]
                    }
                ]
            })

            console.log(`[SLACK] ✅ Sent security alert: ${alert.alertType}`)
            return true
        } catch (error) {
            console.error('[SLACK] ❌ Failed to send alert:', error)
            return false
        }
    }

    /**
     * Send access revocation notification
     */
    static async sendRevocationNotice(
        requestId: string,
        username: string,
        reason: string,
        wasForced: boolean
    ): Promise<boolean> {
        try {
            const emoji = wasForced ? '🚨' : '⏰'
            const title = wasForced ? 'FORCED ACCESS REVOCATION' : 'Access Expired'

            await slack.chat.postMessage({
                channel: defaultChannel,
                text: `${emoji} ${title}: ${username}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `${emoji} *${title}*\n\nCredentials for \`${username}\` have been revoked.`
                        }
                    },
                    {
                        type: 'section',
                        fields: [
                            {
                                type: 'mrkdwn',
                                text: `*Reason:*\n${reason}`
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Request ID:*\n\`${requestId}\``
                            }
                        ]
                    }
                ]
            })

            return true
        } catch (error) {
            console.error('[SLACK] ❌ Failed to send revocation notice:', error)
            return false
        }
    }
}
