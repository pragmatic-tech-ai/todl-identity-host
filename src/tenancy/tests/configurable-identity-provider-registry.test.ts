import { test } from "node:test";
import assert from "node:assert/strict";
import { DelegationDepth, IdentityConfig, Tenant, TenantKind } from "@pragmatic-tech-ai/todl-identity";
import { FakeIdentityProviderPack } from "@pragmatic-tech-ai/todl-identity/testing";
import { InMemoryTenantConfigStore } from "../in-memory-tenant-config-store.js";
import { ConfigurableIdentityProviderRegistry } from "../configurable-identity-provider-registry.js";

class Fixture
{
    public static readonly PackA = "packA";
    public static Tenant(id: string): Tenant { return new Tenant(id, TenantKind.Saas, id); }
    public static Config(packId: string): IdentityConfig { return new IdentityConfig(packId, DelegationDepth.AuthnDirectory, new Map(), new Map(), new Map()); }
}

test("PackFor resolves the pack named by the tenant's config", async () =>
{
    const configs = new InMemoryTenantConfigStore();
    await configs.Save("t1", Fixture.Config(Fixture.PackA));
    const pack = FakeIdentityProviderPack.Default();
    const registry = new ConfigurableIdentityProviderRegistry(configs, new Map([[Fixture.PackA, pack]]));
    assert.equal(await registry.PackFor(Fixture.Tenant("t1")), pack);
});

test("PackFor THROWS for an unconfigured tenant (deny-by-default, no fallback)", async () =>
{
    const registry = new ConfigurableIdentityProviderRegistry(new InMemoryTenantConfigStore(), new Map());
    await assert.rejects(() => registry.PackFor(Fixture.Tenant("ghost")));
});

test("PackFor THROWS when the config names an unregistered PackId", async () =>
{
    const configs = new InMemoryTenantConfigStore();
    await configs.Save("t1", Fixture.Config("unregistered"));
    const registry = new ConfigurableIdentityProviderRegistry(configs, new Map());
    await assert.rejects(() => registry.PackFor(Fixture.Tenant("t1")));
});

test("SingleTenant resolves the one pack for the self-hosted tenant", async () =>
{
    const tenant = new Tenant("solo", TenantKind.SelfHosted, "Solo");
    const pack = FakeIdentityProviderPack.Default();
    const registry = await ConfigurableIdentityProviderRegistry.SingleTenant(tenant, Fixture.Config(Fixture.PackA), pack);
    assert.equal(await registry.PackFor(tenant), pack);
});
