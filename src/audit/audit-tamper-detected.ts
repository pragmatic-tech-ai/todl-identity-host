export class AuditTamperDetected extends Error
{
    private static readonly Prefix = "audit chain tamper detected for tenant ";
    private static readonly SeqLabel = " at seq ";
    private static readonly ErrorName = "AuditTamperDetected";

    public readonly TenantId: string;
    public readonly Seq: number;

    // Message carries identifiers only (tenant id + seq), never any Detail value.
    public constructor(tenantId: string, seq: number)
    {
        super(AuditTamperDetected.Prefix + tenantId + AuditTamperDetected.SeqLabel + String(seq));
        this.name = AuditTamperDetected.ErrorName;
        this.TenantId = tenantId;
        this.Seq = seq;
    }
}
