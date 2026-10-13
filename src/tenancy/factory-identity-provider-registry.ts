import type { IIdentityProviderPack, IIdentityProviderRegistry, IdentityConfig, ITenantConfigStore, Tenant } from "@pragmatic-tech-ai/todl-identity";

export interface IIdentityProviderPackFactory
{
    Build(tenant: Tenant, config: IdentityConfig): Promise<IIdentityProviderPack>;
}

/** Resolves a tenant's identity pack by reading its stored IdentityConfig and building through an injected
 *  factory, caching one pack per tenant id. Unlike the eager PackId->instance registry, two tenants that share
 *  a PackId but differ in settings each get their own pack. */
export class FactoryIdentityProviderRegistry implements IIdentityProviderRegistry
{
    private static readonly UnconfiguredTenantError = "No identity configuration for tenant: ";

    private readonly cache = new Map<string, IIdentityProviderPack>();

    public constructor(
        private readonly configs: ITenantConfigStore,
        private readonly factory: IIdentityProviderPackFactory)
    {
    }

    public async PackFor(tenant: Tenant): Promise<IIdentityProviderPack>
    {
        const cached = this.cache.get(tenant.Id);
        if (cached !== undefined)
        {
            return cached;
        }
        const config = await this.configs.Get(tenant.Id);
        if (config === null)
        {
            throw new Error(FactoryIdentityProviderRegistry.UnconfiguredTenantError + tenant.Id);
        }
        const pack = await this.factory.Build(tenant, config);
        this.cache.set(tenant.Id, pack);
        return pack;
    }
}
