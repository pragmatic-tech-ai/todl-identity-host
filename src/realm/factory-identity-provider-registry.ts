import type { IIdentityProviderPack, IIdentityProviderRegistry, IdentityConfig, IRealmConfigStore, Realm } from "@pragmatic-tech-ai/todl-identity";

export interface IIdentityProviderPackFactory
{
    Build(realm: Realm, config: IdentityConfig): Promise<IIdentityProviderPack>;
}

/** Resolves a realm's identity pack by reading its stored IdentityConfig and building through an injected
 *  factory, caching one pack per realm id. Unlike the eager PackId->instance registry, two realms that share
 *  a PackId but differ in settings each get their own pack. */
export class FactoryIdentityProviderRegistry implements IIdentityProviderRegistry
{
    private static readonly UnconfiguredRealmError = "No identity configuration for realm: ";

    private readonly cache = new Map<string, Promise<IIdentityProviderPack>>();

    public constructor(
        private readonly configs: IRealmConfigStore,
        private readonly factory: IIdentityProviderPackFactory)
    {
    }

    public PackFor(realm: Realm): Promise<IIdentityProviderPack>
    {
        const cached = this.cache.get(realm.Id);
        if (cached !== undefined)
        {
            return cached;
        }
        const built = this.Build(realm);
        this.cache.set(realm.Id, built);
        built.catch(() => this.cache.delete(realm.Id));
        return built;
    }

    private async Build(realm: Realm): Promise<IIdentityProviderPack>
    {
        const config = await this.configs.Get(realm.Id);
        if (config === null)
        {
            throw new Error(FactoryIdentityProviderRegistry.UnconfiguredRealmError + realm.Id);
        }
        return this.factory.Build(realm, config);
    }
}
