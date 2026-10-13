import type { AuditCheckpoint } from "./audit-checkpoint.js";
import type { IAuditCheckpointStore } from "./audit-checkpoint-store.js";

export class InMemoryAuditCheckpointStore implements IAuditCheckpointStore
{
    private readonly byTenant = new Map<string, AuditCheckpoint[]>();

    public Latest(tenantId: string): Promise<AuditCheckpoint | undefined>
    {
        const arr = this.byTenant.get(tenantId);
        if (arr === undefined || arr.length === 0)
        {
            return Promise.resolve(undefined);
        }
        let best = arr[0]!;
        for (const cp of arr)
        {
            if (cp.Sequence > best.Sequence)
            {
                best = cp;
            }
        }
        return Promise.resolve(best);
    }

    public Append(checkpoint: AuditCheckpoint): Promise<void>
    {
        const arr = this.byTenant.get(checkpoint.TenantId) ?? [];
        arr.push(checkpoint);
        this.byTenant.set(checkpoint.TenantId, arr);
        return Promise.resolve();
    }

    public Tenants(): Promise<readonly string[]>
    {
        return Promise.resolve([...this.byTenant.keys()]);
    }
}
