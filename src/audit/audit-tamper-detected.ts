export class AuditTamperDetected extends Error
{
    private static readonly Prefix = "audit chain tamper detected for realm ";
    private static readonly SeqLabel = " at seq ";
    private static readonly ErrorName = "AuditTamperDetected";

    public readonly RealmId: string;
    public readonly Seq: number;

    // Message carries identifiers only (realm id + seq), never any Detail value.
    public constructor(realmId: string, seq: number)
    {
        super(AuditTamperDetected.Prefix + realmId + AuditTamperDetected.SeqLabel + String(seq));
        this.name = AuditTamperDetected.ErrorName;
        this.RealmId = realmId;
        this.Seq = seq;
    }
}
