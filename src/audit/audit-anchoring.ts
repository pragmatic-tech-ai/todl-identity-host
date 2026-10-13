import type { AuditAnchor } from "./audit-anchor.js";
import type { ChainedAuditRecord } from "./chained-audit-record.js";
import type { HashChainedAuditSink } from "./hash-chained-audit-sink.js";
import type { IAuditCheckpointStore } from "./audit-checkpoint-store.js";

/** Orchestrates anchoring for one sink instance: verifies the live chain against the last signed
 *  checkpoint of every tenant (the union of chain tenants and anchor-store tenants, so a
 *  truncate-to-zero is caught), seeds/flushes the current head on open, and appends a new checkpoint
 *  when due. Holds a per-tenant in-memory high-water mark so Record does not read the store per event. */
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

    public async VerifyAll(chain: HashChainedAuditSink, chainTenants: readonly string[]): Promise<void>
    {
        const tenants = new Set<string>(chainTenants);
        for (const tenant of await this.store.Tenants())
        {
            tenants.add(tenant);
        }
        for (const tenantId of tenants)
        {
            const records = chain.Records(tenantId);
            const checkpoint = await this.store.Latest(tenantId);
            this.anchor.Verify(records, checkpoint);
            let anchored = checkpoint === undefined ? 0 : checkpoint.Sequence;
            if (records.length > anchored)
            {
                const fresh = this.anchor.Build(tenantId, records)!;
                await this.store.Append(fresh);
                anchored = fresh.Sequence;
            }
            this.lastAnchored.set(tenantId, anchored);
        }
    }

    public async CheckpointIfDue(tenantId: string, records: readonly ChainedAuditRecord[]): Promise<void>
    {
        const anchored = this.lastAnchored.get(tenantId) ?? 0;
        if (!this.anchor.DueFrom(records.length, anchored))
        {
            return;
        }
        const fresh = this.anchor.Build(tenantId, records);
        if (fresh !== undefined)
        {
            await this.store.Append(fresh);
            this.lastAnchored.set(tenantId, fresh.Sequence);
        }
    }
}
