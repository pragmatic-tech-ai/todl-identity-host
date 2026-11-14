import type { AuditAnchor } from "./audit-anchor.js";
import type { ChainedAuditRecord } from "./chained-audit-record.js";
import type { HashChainedAuditSink } from "./hash-chained-audit-sink.js";
import type { IAuditCheckpointStore } from "./audit-checkpoint-store.js";

/** Orchestrates anchoring for one sink instance: verifies the live chain against the last signed
 *  checkpoint of every realm (the union of chain realms and anchor-store realms, so a
 *  truncate-to-zero is caught), seeds/flushes the current head on open, and appends a new checkpoint
 *  when due. Holds a per-realm in-memory high-water mark so Record does not read the store per event. */
export class AuditAnchoring
{
    private readonly anchor: AuditAnchor;
    private readonly store: IAuditCheckpointStore;
    private readonly lastAnchored = new Map<string, number>();

    public constructor(anchor: AuditAnchor, store: IAuditCheckpointStore)
    {
        this.anchor = anchor;
        this.store = store;
    }

    public async VerifyAll(chain: HashChainedAuditSink, chainRealms: readonly string[]): Promise<void>
    {
        const realms = new Set<string>(chainRealms);
        for (const realm of await this.store.Realms())
        {
            realms.add(realm);
        }
        for (const realmId of realms)
        {
            const records = chain.Records(realmId);
            const checkpoint = await this.store.Latest(realmId);
            this.anchor.Verify(records, checkpoint);
            let anchored = checkpoint === undefined ? 0 : checkpoint.Sequence;
            if (records.length > anchored)
            {
                const fresh = this.anchor.Build(realmId, records)!;
                await this.store.Append(fresh);
                anchored = fresh.Sequence;
            }
            this.lastAnchored.set(realmId, anchored);
        }
    }

    public async CheckpointIfDue(realmId: string, records: readonly ChainedAuditRecord[]): Promise<void>
    {
        const anchored = this.lastAnchored.get(realmId) ?? 0;
        if (!this.anchor.DueFrom(records.length, anchored))
        {
            return;
        }
        const fresh = this.anchor.Build(realmId, records);
        if (fresh !== undefined)
        {
            await this.store.Append(fresh);
            this.lastAnchored.set(realmId, fresh.Sequence);
        }
    }
}
