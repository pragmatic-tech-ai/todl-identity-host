import type { IdentityConfig, IRealmConfigStore } from "@pragmatic-tech-ai/todl-identity";

export class InMemoryRealmConfigStore implements IRealmConfigStore
{
    private readonly configs = new Map<string, IdentityConfig>();

    public async Get(realmId: string): Promise<IdentityConfig | null>
    {
        return this.configs.get(realmId) ?? null;
    }

    public async Save(realmId: string, config: IdentityConfig): Promise<void>
    {
        this.configs.set(realmId, config);
    }

    public async List(): Promise<readonly string[]>
    {
        return [...this.configs.keys()];
    }
}
