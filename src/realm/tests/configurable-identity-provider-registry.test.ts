import { test } from "node:test";
import assert from "node:assert/strict";
import { DelegationDepth, IdentityConfig, Realm, RealmKind } from "@pragmatic-tech-ai/todl-identity";
import { FakeIdentityProviderPack } from "@pragmatic-tech-ai/todl-identity/testing";
import { InMemoryRealmConfigStore } from "../in-memory-realm-config-store.js";
import { ConfigurableIdentityProviderRegistry } from "../configurable-identity-provider-registry.js";

class Fixture
{
    public static readonly PackA = "packA";
    public static Realm(id: string): Realm { return new Realm(id, RealmKind.Saas, id); }
    public static Config(packId: string): IdentityConfig { return new IdentityConfig(packId, DelegationDepth.AuthnDirectory, new Map(), new Map(), new Map()); }
}

test("PackFor resolves the pack named by the realm's config", async () =>
{
    const configs = new InMemoryRealmConfigStore();
    await configs.Save("t1", Fixture.Config(Fixture.PackA));
    const pack = FakeIdentityProviderPack.Default();
    const registry = new ConfigurableIdentityProviderRegistry(configs, new Map([[Fixture.PackA, pack]]));
    assert.equal(await registry.PackFor(Fixture.Realm("t1")), pack);
});

test("PackFor THROWS for an unconfigured realm (deny-by-default, no fallback)", async () =>
{
    const registry = new ConfigurableIdentityProviderRegistry(new InMemoryRealmConfigStore(), new Map());
    await assert.rejects(() => registry.PackFor(Fixture.Realm("ghost")));
});

test("PackFor THROWS when the config names an unregistered PackId", async () =>
{
    const configs = new InMemoryRealmConfigStore();
    await configs.Save("t1", Fixture.Config("unregistered"));
    const registry = new ConfigurableIdentityProviderRegistry(configs, new Map());
    await assert.rejects(() => registry.PackFor(Fixture.Realm("t1")));
});

test("SingleRealm resolves the one pack for the self-hosted realm", async () =>
{
    const realm = new Realm("solo", RealmKind.SelfHosted, "Solo");
    const pack = FakeIdentityProviderPack.Default();
    const registry = await ConfigurableIdentityProviderRegistry.SingleRealm(realm, Fixture.Config(Fixture.PackA), pack);
    assert.equal(await registry.PackFor(realm), pack);
});
