import { z } from 'zod'

// Access Request Schema
export const accessRequestSchema = z.object({
  requester: z.string().min(1, 'Requester is required'),
  resource: z.string().min(1, 'Resource is required'),
  accessLevel: z.enum(['READ_ONLY', 'READ_WRITE']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  duration: z.number().min(1).max(60, 'Duration must be between 1-60 minutes'),
})

export type AccessRequest = z.infer<typeof accessRequestSchema>

// Access State Schema
export const accessStateSchema = z.object({
  id: z.string(),
  requester: z.string(),
  resource: z.string(),
  accessLevel: z.enum(['READ_ONLY', 'READ_WRITE']),
  reason: z.string(),
  duration: z.number(),
  riskScore: z.number(),
  status: z.enum([
    'pending_risk',
    'pending_approval',
    'approved',
    'rejected',
    'active',
    'revoked',
  ]),
  approvers: z.array(z.string()),
  requiredApprovals: z.number(),
  createdAt: z.string(),
  approvedAt: z.string().optional(),
  revokedAt: z.string().optional(),
  revokeReason: z
    .enum(['timer_expired', 'forced', 'anomaly_detected', 'manual'])
    .optional(),
})

export type AccessState = z.infer<typeof accessStateSchema>

// Credentials Schema
export const credentialsSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  username: z.string(),
  password: z.string(),
  resource: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  sessionId: z.string(),
})

export type Credentials = z.infer<typeof credentialsSchema>

// Session Log Schema
export const sessionLogSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  sessionId: z.string(),
  timestamp: z.string(),
  command: z.string(),
  queryType: z.string(),
  flagged: z.boolean(),
  flagReason: z.string().optional(),
})

export type SessionLog = z.infer<typeof sessionLogSchema>

// Audit Report Schema
export const auditReportSchema = z.object({
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

export type AuditReport = z.infer<typeof auditReportSchema>

// Approval Request Schema
export const approvalRequestSchema = z.object({
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

export type ApprovalRequest = z.infer<typeof approvalRequestSchema>

// Risk Analysis Input
export const riskAnalysisInputSchema = z.object({
  requestId: z.string(),
  reason: z.string(),
  resource: z.string(),
  accessLevel: z.string(),
})

export type RiskAnalysisInput = z.infer<typeof riskAnalysisInputSchema>
