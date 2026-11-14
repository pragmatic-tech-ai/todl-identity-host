import type { IdpDirectorySnapshot, IIdpDirectoryStore } from "@pragmatic-tech-ai/todl-identity";

export class InMemoryIdpDirectoryStore implements IIdpDirectoryStore
{
    private readonly snapshots = new Map<string, IdpDirectorySnapshot>();

    public async Get(realmId: string): Promise<IdpDirectorySnapshot | null>
    {
        return this.snapshots.get(realmId) ?? null;
    }

    public async Save(realmId: string, snapshot: IdpDirectorySnapshot): Promise<void>
    {
        this.snapshots.set(realmId, snapshot);
    }
}
