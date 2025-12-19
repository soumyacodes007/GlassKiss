import { CronConfig, Handlers } from 'motia'
import { CredentialManager } from '../services/credential-manager'

export const config: CronConfig = {
    type: 'cron',
    name: 'CheckActiveCredentials',
    description:
        'Daily zombie defense: checks for expired credentials that still exist',
    cron: '0 2 * * *', // Run daily at 2 AM
    emits: [],
    flows: ['glasskiss'],
}

export const handler: Handlers['CheckActiveCredentials'] = async ({
    logger,
    state,
}) => {
    logger.info('Running zombie credential defense check')

    // Get all credential records
    const allCredentials = await state.getGroup('credentials')

    if (allCredentials.length === 0) {
        logger.info('No active credentials found')
        return
    }

    logger.info(`Checking ${allCredentials.length} credential records`)

    let zombieCount = 0
    const now = new Date()

    for (const credential of allCredentials) {
        const cred = credential as any
        const expiresAt = new Date(cred.expiresAt)

        // Check if credential is expired
        if (now > expiresAt) {
            logger.warn('Expired credential found in state!', {
                requestId: cred.requestId,
                username: cred.username,
                expiresAt: cred.expiresAt,
            })

            // Check if user still exists in database
            const stillExists = await CredentialManager.checkUserExists(
                cred.username
            )

            if (stillExists) {
                logger.error('ZOMBIE CREDENTIAL DETECTED!', {
                    requestId: cred.requestId,
                    username: cred.username,
                })

                // Force revoke
                await CredentialManager.revokeCredentials(
                    cred.username,
                    cred.resource
                )

                zombieCount++

                // In production: alert security team, page on-call
                logger.error('SECURITY ALERT: Zombie credential force-revoked', {
                    username: cred.username,
                })
            }

            // Clean up state
            await state.delete('credentials', cred.requestId)
        }
    }

    logger.info('Zombie defense check complete', {
        checked: allCredentials.length,
        zombiesFound: zombieCount,
    })
}
