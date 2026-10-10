import type { IIdentityProviderPack, IIdentityProviderRegistry, IdentityConfig, ITenantConfigStore, Tenant } from "@pragmatic-tech-ai/todl-identity";
import { InMemoryTenantConfigStore } from "./in-memory-tenant-config-store.js";

export class ConfigurableIdentityProviderRegistry implements IIdentityProviderRegistry
{
    private static readonly UnconfiguredTenantError = "No identity configuration for tenant: ";
    private static readonly UnregisteredPackError = "Identity pack is not registered: ";

    public constructor(
        private readonly configs: ITenantConfigStore,
        private readonly packsById: ReadonlyMap<string, IIdentityProviderPack>)
    {
    }

    public static async SingleTenant(tenant: Tenant, config: IdentityConfig, pack: IIdentityProviderPack): Promise<ConfigurableIdentityProviderRegistry>
    {
        const store = new InMemoryTenantConfigStore();
        await store.Save(tenant.Id, config);
        return new ConfigurableIdentityProviderRegistry(store, new Map([[config.PackId, pack]]));
    }

    public async PackFor(tenant: Tenant): Promise<IIdentityProviderPack>
    {
        const config = await this.configs.Get(tenant.Id);
        if (config === null)
        {
            throw new Error(ConfigurableIdentityProviderRegistry.UnconfiguredTenantError + tenant.Id);
        }
        const pack = this.packsById.get(config.PackId);
        if (pack === undefined)
        {
            throw new Error(ConfigurableIdentityProviderRegistry.UnregisteredPackError + config.PackId);
        }
        return pack;
    }
}
