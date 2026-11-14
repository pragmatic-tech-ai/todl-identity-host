import type { IIdentityProviderPack, IIdentityProviderRegistry, IdentityConfig, IRealmConfigStore, Realm } from "@pragmatic-tech-ai/todl-identity";
import { InMemoryRealmConfigStore } from "./in-memory-realm-config-store.js";

export class ConfigurableIdentityProviderRegistry implements IIdentityProviderRegistry
{
    private static readonly UnconfiguredRealmError = "No identity configuration for realm: ";
    private static readonly UnregisteredPackError = "Identity pack is not registered: ";

    public constructor(
        private readonly configs: IRealmConfigStore,
        private readonly packsById: ReadonlyMap<string, IIdentityProviderPack>)
    {
    }

    public static async SingleRealm(realm: Realm, config: IdentityConfig, pack: IIdentityProviderPack): Promise<ConfigurableIdentityProviderRegistry>
    {
        const store = new InMemoryRealmConfigStore();
        await store.Save(realm.Id, config);
        return new ConfigurableIdentityProviderRegistry(store, new Map([[config.PackId, pack]]));
    }

    public async PackFor(realm: Realm): Promise<IIdentityProviderPack>
    {
        const config = await this.configs.Get(realm.Id);
        if (config === null)
        {
            throw new Error(ConfigurableIdentityProviderRegistry.UnconfiguredRealmError + realm.Id);
        }
        const pack = this.packsById.get(config.PackId);
        if (pack === undefined)
        {
            throw new Error(ConfigurableIdentityProviderRegistry.UnregisteredPackError + config.PackId);
        }
        return pack;
    }
}
