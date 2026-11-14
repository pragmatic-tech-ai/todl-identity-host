import { AuditCheckpoint } from "./audit-checkpoint.js";
import { AuditAnchorMismatch } from "./audit-anchor-mismatch.js";
import { AuditAnchorReason } from "./audit-anchor-reason.js";
import type { ChainedAuditRecord } from "./chained-audit-record.js";
import type { IAuditCheckpointSigner } from "./audit-checkpoint-signer.js";

export class AuditAnchor
{
    private static readonly BadInterval = "audit anchor interval must be an integer >= 1";

    private readonly signer: IAuditCheckpointSigner;
    private readonly interval: number;
    private readonly now: () => Date;

    public constructor(signer: IAuditCheckpointSigner, interval = 1, now: () => Date = () => new Date())
    {
        if (!Number.isSafeInteger(interval) || interval < 1)
        {
            throw new RangeError(AuditAnchor.BadInterval);
        }
        this.signer = signer;
        this.interval = interval;
        this.now = now;
    }

    public Verify(records: readonly ChainedAuditRecord[], checkpoint: AuditCheckpoint | undefined): void
    {
        if (checkpoint === undefined)
        {
            return;
        }
        if (!this.signer.Verify(checkpoint.RealmId, checkpoint.Sequence, checkpoint.HeadHash, checkpoint.At, checkpoint.Signature))
        {
            throw new AuditAnchorMismatch(checkpoint.RealmId, checkpoint.Sequence, AuditAnchorReason.SignatureInvalid);
        }
        if (records.length < checkpoint.Sequence)
        {
            throw new AuditAnchorMismatch(checkpoint.RealmId, checkpoint.Sequence, AuditAnchorReason.Truncated);
        }
        if (records[checkpoint.Sequence - 1]!.Hash !== checkpoint.HeadHash)
        {
            throw new AuditAnchorMismatch(checkpoint.RealmId, checkpoint.Sequence, AuditAnchorReason.Diverged);
        }
    }

    public Build(realmId: string, records: readonly ChainedAuditRecord[]): AuditCheckpoint | undefined
    {
        if (records.length === 0)
        {
            return undefined;
        }
        const head = records[records.length - 1]!;
        const at = this.now().toISOString();
        const signature = this.signer.Sign(realmId, records.length, head.Hash, at);
        return new AuditCheckpoint(realmId, records.length, head.Hash, at, signature);
    }

    public DueFrom(count: number, anchoredSeq: number): boolean
    {
        return count > anchoredSeq && count - anchoredSeq >= this.interval;
    }
}
