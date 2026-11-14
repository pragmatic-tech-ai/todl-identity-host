import type { AuditCheckpoint } from "./audit-checkpoint.js";
import type { IAuditCheckpointStore } from "./audit-checkpoint-store.js";

export class InMemoryAuditCheckpointStore implements IAuditCheckpointStore
{
    private readonly byRealm = new Map<string, AuditCheckpoint[]>();

    public Latest(realmId: string): Promise<AuditCheckpoint | undefined>
    {
        const arr = this.byRealm.get(realmId);
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
        const arr = this.byRealm.get(checkpoint.RealmId) ?? [];
        arr.push(checkpoint);
        this.byRealm.set(checkpoint.RealmId, arr);
        return Promise.resolve();
    }

    public Realms(): Promise<readonly string[]>
    {
        return Promise.resolve([...this.byRealm.keys()]);
    }
}
