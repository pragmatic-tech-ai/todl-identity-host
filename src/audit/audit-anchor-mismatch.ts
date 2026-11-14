import { AuditTamperDetected } from "./audit-tamper-detected.js";
import type { AuditAnchorReason } from "./audit-anchor-reason.js";

export class AuditAnchorMismatch extends AuditTamperDetected
{
    private static readonly MismatchName = "AuditAnchorMismatch";
    private static readonly ReasonLabel = " reason ";

    public readonly Reason: AuditAnchorReason;

    // Message carries identifiers + reason only (realm id, seq, reason) - never a secret value or audit Detail.
    public constructor(realmId: string, seq: number, reason: AuditAnchorReason)
    {
        super(realmId, seq);
        this.name = AuditAnchorMismatch.MismatchName;
        this.message = this.message + AuditAnchorMismatch.ReasonLabel + reason;
        this.Reason = reason;
    }
}
