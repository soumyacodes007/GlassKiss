/**
 * AI Service using Groq
 * Provides intelligent analysis for risk assessment and scope extraction
 */

import OpenAI from 'openai'

// Lazy initialization to avoid errors when env isn't loaded
let groq: OpenAI | null = null

function getGroqClient(): OpenAI {
    if (!groq) {
        groq = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1',
        })
    }
    return groq
}

// Using the model specified by user
const MODEL = 'openai/gpt-oss-120b'

export interface RiskAnalysisResult {
    riskScore: number
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    factors: string[]
    recommendation: string
    requiredApprovals: number
}

export interface ScopeExtractionResult {
    tables: string[]
    entities: { type: string; id: string }[]
    operations: string[]
    maxRows: number
    summary: string
}

export class AIService {
    /**
     * Test AI connection
     */
    static async testConnection(): Promise<boolean> {
        try {
            const response = await getGroqClient().chat.completions.create({
                model: MODEL,
                messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
                max_tokens: 10,
            })
            console.log(`[AI] ✅ Connected to Groq: ${response.choices[0].message.content}`)
            return true
        } catch (error) {
            console.error('[AI] ❌ Connection failed:', error)
            return false
        }
    }

    /**
     * Analyze access request risk using AI
     */
    static async analyzeRisk(
        reason: string,
        resource: string,
        accessLevel: string,
        requester: string
    ): Promise<RiskAnalysisResult> {
        try {
            const prompt = `You are a security analyst evaluating a database access request.

REQUEST DETAILS:
- Requester: ${requester}
- Resource: ${resource}
- Access Level: ${accessLevel}
- Reason: "${reason}"

Analyze this request and provide a JSON response with:
1. riskScore: 0-100 (higher = more risky)
2. riskLevel: "low" | "medium" | "high" | "critical"
3. factors: Array of risk factors identified
4. recommendation: Brief recommendation
5. requiredApprovals: 1 for low/medium, 2 for high/critical

Risk factors to consider:
- No ticket/issue reference (+30)
- Vague reason < 20 chars (+25)
- Emergency/urgent keywords (+15)
- Production resource (+20)
- READ_WRITE access (+15)
- New/unknown requester (+20)
- Unusual time of request (+10)

Respond ONLY with valid JSON, no markdown.`

            const response = await getGroqClient().chat.completions.create({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 500,
                temperature: 0.1,
            })

            const content = response.choices[0].message.content || '{}'
            const result = JSON.parse(content.replace(/```json\n?|\n?```/g, ''))

            console.log(`[AI] ✅ Risk analysis: ${result.riskScore}/100 (${result.riskLevel})`)
            return result as RiskAnalysisResult
        } catch (error) {
            console.error('[AI] ❌ Risk analysis failed, using fallback:', error)
            // Fallback to rule-based analysis
            return this.fallbackRiskAnalysis(reason, resource, accessLevel)
        }
    }

    /**
     * Extract scope from reason using AI
     */
    static async extractScope(
        reason: string,
        resource: string,
        accessLevel: string
    ): Promise<ScopeExtractionResult> {
        try {
            const prompt = `You are a database access policy engine. Extract structured scope from this access request.

REQUEST:
- Reason: "${reason}"
- Resource: ${resource}
- Access Level: ${accessLevel}

Extract and return JSON with:
1. tables: Array of database tables mentioned or implied (e.g., ["users", "billing"])
2. entities: Array of specific entities like {type: "user", id: "123"}
3. operations: Array of SQL operations needed (SELECT, INSERT, UPDATE, DELETE)
4. maxRows: Maximum rows that should be affected (1 for specific ID, 10 for small batch, 100 for larger)
5. summary: One-line scope description

Common mappings:
- "user #123" or "customer 123" → tables: ["users"], entities: [{type: "user", id: "123"}]
- "billing issue" → tables: ["billing", "invoices"]
- "order #456" → tables: ["orders"], entities: [{type: "order", id: "456"}]
- "fix" or "update" → operations include UPDATE
- "view" or "check" → operations include SELECT only

Respond ONLY with valid JSON, no markdown.`

            const response = await getGroqClient().chat.completions.create({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 500,
                temperature: 0.1,
            })

            const content = response.choices[0].message.content || '{}'
            const result = JSON.parse(content.replace(/```json\n?|\n?```/g, ''))

            console.log(`[AI] ✅ Scope extracted: ${result.summary}`)
            return result as ScopeExtractionResult
        } catch (error) {
            console.error('[AI] ❌ Scope extraction failed, using fallback:', error)
            return this.fallbackScopeExtraction(reason, accessLevel)
        }
    }

    /**
     * Generate audit report summary using AI
     */
    static async generateAuditSummary(
        requesterId: string,
        resource: string,
        commands: string[],
        flaggedCommands: number,
        duration: number,
        revokeReason?: string
    ): Promise<string> {
        try {
            const prompt = `Generate a brief compliance audit summary for this database access session:

SESSION DETAILS:
- User: ${requesterId}
- Resource: ${resource}
- Duration: ${duration} minutes
- Total Commands: ${commands.length}
- Flagged Commands: ${flaggedCommands}
- Revocation Reason: ${revokeReason || 'Timer expired (normal)'}

COMMANDS EXECUTED:
${commands.slice(0, 20).map((c, i) => `${i + 1}. ${c.substring(0, 100)}`).join('\n')}
${commands.length > 20 ? `... and ${commands.length - 20} more` : ''}

Generate a 2-3 sentence professional audit summary. Be concise.`

            const response = await getGroqClient().chat.completions.create({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200,
                temperature: 0.3,
            })

            const summary = response.choices[0].message.content || 'Audit summary unavailable.'
            console.log(`[AI] ✅ Audit summary generated`)
            return summary
        } catch (error) {
            console.error('[AI] ❌ Audit summary failed:', error)
            return `User ${requesterId} accessed ${resource} for ${duration} minutes. Executed ${commands.length} commands with ${flaggedCommands} flagged.`
        }
    }

    // Fallback methods when AI is unavailable
    private static fallbackRiskAnalysis(
        reason: string,
        resource: string,
        accessLevel: string
    ): RiskAnalysisResult {
        let score = 0
        const factors: string[] = []

        if (!/(?:jira|ticket|issue|bug|#)\s*#?\d+/i.test(reason)) {
            score += 30
            factors.push('No ticket reference')
        }
        if (reason.length < 20) {
            score += 25
            factors.push('Vague reason')
        }
        if (/urgent|emergency|critical|asap/i.test(reason)) {
            score += 15
            factors.push('Emergency keywords')
        }
        if (resource.includes('prod')) {
            score += 20
            factors.push('Production resource')
        }
        if (accessLevel === 'READ_WRITE') {
            score += 15
            factors.push('Write access')
        }

        const riskLevel = score > 70 ? 'critical' : score > 50 ? 'high' : score > 30 ? 'medium' : 'low'

        return {
            riskScore: Math.min(100, score),
            riskLevel,
            factors,
            recommendation: score > 50 ? 'Requires additional review' : 'Standard approval process',
            requiredApprovals: score > 70 ? 2 : 1,
        }
    }

    private static fallbackScopeExtraction(
        reason: string,
        accessLevel: string
    ): ScopeExtractionResult {
        const tables: string[] = []
        const entities: { type: string; id: string }[] = []

        // Extract tables
        if (/user|customer|account/i.test(reason)) tables.push('users')
        if (/billing|invoice|payment/i.test(reason)) tables.push('billing')
        if (/order|transaction/i.test(reason)) tables.push('orders')
        if (tables.length === 0) tables.push('users')

        // Extract entity IDs
        const idMatch = reason.match(/#(\d+)/)
        if (idMatch) {
            entities.push({ type: 'entity', id: idMatch[1] })
        }

        // Determine operations
        const operations = ['SELECT']
        if (accessLevel === 'READ_WRITE') {
            if (/fix|update|modify|change/i.test(reason)) operations.push('UPDATE')
            if (/add|create|insert/i.test(reason)) operations.push('INSERT')
        }

        return {
            tables,
            entities,
            operations,
            maxRows: entities.length > 0 ? 1 : 10,
            summary: `Access to ${tables.join(', ')} for ${operations.join('/')} operations`,
        }
    }
}
