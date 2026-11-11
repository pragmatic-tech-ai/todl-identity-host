import type { IdpDirectorySnapshot, IIdpDirectoryStore } from "@pragmatic-tech-ai/todl-identity";

export class InMemoryIdpDirectoryStore implements IIdpDirectoryStore
{
    private readonly snapshots = new Map<string, IdpDirectorySnapshot>();

    public async Get(tenantId: string): Promise<IdpDirectorySnapshot | null>
    {
        return this.snapshots.get(tenantId) ?? null;
    }

    public async Save(tenantId: string, snapshot: IdpDirectorySnapshot): Promise<void>
    {
        this.snapshots.set(tenantId, snapshot);
    }
}
