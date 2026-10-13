import { test } from "node:test";
import assert from "node:assert/strict";
import { DelegationDepth, IdentityConfig, Principal, PrincipalKind, Tenant, TenantKind } from "@pragmatic-tech-ai/todl-identity";
import type { IIdentityProviderPack } from "@pragmatic-tech-ai/todl-identity";
import { FakeIdentityProviderPack } from "@pragmatic-tech-ai/todl-identity/testing";
import { InMemoryTenantConfigStore } from "../in-memory-tenant-config-store.js";
import { FactoryIdentityProviderRegistry } from "../factory-identity-provider-registry.js";
import type { IIdentityProviderPackFactory } from "../factory-identity-provider-registry.js";

class CountingFactory implements IIdentityProviderPackFactory
{
    private static readonly PrincipalId = "u1";
    private static readonly PrincipalTenantId = "t1";

    public Calls = 0;
    public async Build(_tenant: Tenant, _config: IdentityConfig): Promise<IIdentityProviderPack>
    {
        this.Calls += 1;
        return new FakeIdentityProviderPack(DelegationDepth.FullAuthz, new Principal(CountingFactory.PrincipalId, CountingFactory.PrincipalTenantId, PrincipalKind.User, new Map(), []));
    }
}

class Configs
{
    public static For(packId: string): IdentityConfig
    {
        return new IdentityConfig(packId, DelegationDepth.FullAuthz, new Map(), new Map(), new Map());
    }
}

test("PackFor builds via the factory and caches per tenant", async () =>
{
    const store = new InMemoryTenantConfigStore();
    const t1 = new Tenant("t1", TenantKind.Saas, "One");
    await store.Save(t1.Id, Configs.For("entra"));
    const factory = new CountingFactory();
    const registry = new FactoryIdentityProviderRegistry(store, factory);
    const a = await registry.PackFor(t1);
    const b = await registry.PackFor(t1);
    assert.equal(a, b);
    assert.equal(factory.Calls, 1);
});

test("two tenants sharing a PackId resolve to distinct packs", async () =>
{
    const store = new InMemoryTenantConfigStore();
    const t1 = new Tenant("t1", TenantKind.Saas, "One");
    const t2 = new Tenant("t2", TenantKind.Saas, "Two");
    await store.Save(t1.Id, Configs.For("entra"));
    await store.Save(t2.Id, Configs.For("entra"));
    const factory = new CountingFactory();
    const registry = new FactoryIdentityProviderRegistry(store, factory);
    const p1 = await registry.PackFor(t1);
    const p2 = await registry.PackFor(t2);
    assert.notEqual(p1, p2);
    assert.equal(factory.Calls, 2);
});

test("an unconfigured tenant fails closed", async () =>
{
    const store = new InMemoryTenantConfigStore();
    const registry = new FactoryIdentityProviderRegistry(store, new CountingFactory());
    await assert.rejects(() => registry.PackFor(new Tenant("missing", TenantKind.Saas, "X")), /No identity configuration for tenant: missing/);
});
