import { AuditTamperDetected } from "./audit-tamper-detected.js";
import type { AuditAnchorReason } from "./audit-anchor-reason.js";

export class AuditAnchorMismatch extends AuditTamperDetected
{
    private static readonly ErrorName = "AuditAnchorMismatch";
    private static readonly ReasonLabel = " reason ";

    public readonly Reason: AuditAnchorReason;

    // Message carries identifiers + reason only (tenant id, seq, reason) — never a hash value secret or Detail.
    public constructor(tenantId: string, seq: number, reason: AuditAnchorReason)
    {
        super(tenantId, seq);
        this.name = AuditAnchorMismatch.ErrorName;
        this.message = this.message + AuditAnchorMismatch.ReasonLabel + reason;
        this.Reason = reason;
    }
}
