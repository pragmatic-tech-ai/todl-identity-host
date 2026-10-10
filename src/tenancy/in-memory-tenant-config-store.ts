import type { IdentityConfig, ITenantConfigStore } from "@pragmatic-tech-ai/todl-identity";

export class InMemoryTenantConfigStore implements ITenantConfigStore
{
    private readonly configs = new Map<string, IdentityConfig>();

    public async Get(tenantId: string): Promise<IdentityConfig | null>
    {
        return this.configs.get(tenantId) ?? null;
    }

    public async Save(tenantId: string, config: IdentityConfig): Promise<void>
    {
        this.configs.set(tenantId, config);
    }

    public async List(): Promise<readonly string[]>
    {
        return [...this.configs.keys()];
    }
}
