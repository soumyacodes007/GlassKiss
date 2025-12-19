/**
 * Risk Analyzer Service
 * Analyzes access requests and calculates risk scores
 */

export interface RiskAnalysisResult {
    riskScore: number
    requiredApprovals: number
    factors: string[]
}

export class RiskAnalyzer {
    /**
     * Analyzes an access request and returns a risk score
     * @param reason - The justification for the access request
     * @param resource - The resource being requested
     * @param accessLevel - READ_ONLY or READ_WRITE
     * @returns Risk score between 0-100
     */
    static analyzeRequest(
        reason: string,
        resource: string,
        accessLevel: string
    ): RiskAnalysisResult {
        let riskScore = 0
        const factors: string[] = []

        // Check for Jira/GitHub issue reference
        const hasTicketReference = /(?:jira|ticket|issue|bug|gh-|#)\s*#?\d+/i.test(
            reason
        )
        if (!hasTicketReference) {
            riskScore += 30
            factors.push('No ticket reference')
        } else {
            factors.push('Has ticket reference')
        }

        // Check reason length and quality
        if (reason.length < 20) {
            riskScore += 25
            factors.push('Vague reason')
        } else if (reason.length > 50) {
            factors.push('Detailed justification')
        }

        // Check for urgent/emergency keywords
        const isUrgent = /(?:urgent|emergency|critical|asap|immediately)/i.test(
            reason
        )
        if (isUrgent) {
            riskScore += 15
            factors.push('Marked as urgent')
        }

        // Resource-based risk
        if (resource.includes('prod')) {
            riskScore += 20
            factors.push('Production resource')
        }

        // Access level risk
        if (accessLevel === 'READ_WRITE') {
            riskScore += 15
            factors.push('Write access requested')
        }

        // Determine required approvals based on risk
        let requiredApprovals = 1
        if (riskScore > 70) {
            requiredApprovals = 2 // High risk requires multi-sig
            factors.push('High risk: requires 2 approvals')
        } else if (riskScore > 40) {
            factors.push('Medium risk: requires 1 approval')
        } else {
            factors.push('Low risk: requires 1 approval')
        }

        return {
            riskScore: Math.min(100, riskScore),
            requiredApprovals,
            factors,
        }
    }
}
