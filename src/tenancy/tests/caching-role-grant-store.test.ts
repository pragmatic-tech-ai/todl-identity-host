import { test } from "node:test";
import assert from "node:assert/strict";
import { Grant, ResourceRef, ResourceKind, Role, Tenant, TenantKind } from "@pragmatic-tech-ai/todl-identity";
import { CachingRoleGrantStore } from "../caching-role-grant-store.js";
import type { IRoleGrantStore } from "@pragmatic-tech-ai/todl-identity";

class SpyGrantStore implements IRoleGrantStore
{
    public Calls = 0;
    public OnCalls = 0;
    private readonly grants: Grant[] = [];
    public async GrantsFor(subject: string, tenant: Tenant): Promise<readonly Grant[]>
    {
        this.Calls += 1;
        return this.grants.filter((g) => g.Subject === subject && g.Resource.TenantId === tenant.Id);
    }
    public async GrantsOn(resource: ResourceRef): Promise<readonly Grant[]>
    {
        this.OnCalls += 1;
        return this.grants.filter((g) => g.Resource.Kind === resource.Kind && g.Resource.TenantId === resource.TenantId && g.Resource.Path.length === resource.Path.length && g.Resource.Path.every((p, i) => p === resource.Path[i]));
    }
    public async Save(grant: Grant): Promise<void> { this.grants.push(grant); }
    public async Revoke(grant: Grant): Promise<void>
    {
        // Match the full tuple, exactly as the real stores do, so the spy can never over-match.
        const index = this.grants.findIndex((g) => g.Subject === grant.Subject && g.Role === grant.Role && g.Resource.Kind === grant.Resource.Kind && g.Resource.TenantId === grant.Resource.TenantId && g.Resource.Path.length === grant.Resource.Path.length && g.Resource.Path.every((p, i) => p === grant.Resource.Path[i]));
        if (index >= 0)
        {
            this.grants.splice(index, 1);
        }
    }
}

class Clock
{
    public Ms = 1000;
    public Now = (): Date => new Date(this.Ms);
}

class Fixture
{
    public static Tenant(id = "t1"): Tenant { return new Tenant(id, TenantKind.Saas, id); }
    public static Grant(subject: string, role = Role.Viewer, tenantId = "t1"): Grant
    {
        return new Grant(subject, role, new ResourceRef(ResourceKind.Tenant, tenantId, []));
    }
}

test("cache hit avoids a second backing call", async () =>
{
    const spy = new SpyGrantStore();
    await spy.Save(Fixture.Grant("u1"));
    const store = new CachingRoleGrantStore(spy, 1000, new Clock().Now);
    const first = await store.GrantsFor("u1", Fixture.Tenant());
    const second = await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(spy.Calls, 1);
    assert.equal(first.length, 1);
    assert.equal(second.length, 1);
});

test("TTL expiry refetches", async () =>
{
    const spy = new SpyGrantStore();
    const clock = new Clock();
    const store = new CachingRoleGrantStore(spy, 1000, clock.Now);
    await store.GrantsFor("u1", Fixture.Tenant());
    clock.Ms += 1001;
    await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(spy.Calls, 2);
});

test("Save writes through and invalidates so the change is immediately visible", async () =>
{
    const spy = new SpyGrantStore();
    const store = new CachingRoleGrantStore(spy, 1000, new Clock().Now);
    const before = await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(before.length, 0);
    await store.Save(Fixture.Grant("u1", Role.Admin));
    const after = await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(after.length, 1);
    assert.equal(after[0]!.Role, Role.Admin);
});

test("Invalidate drops only that subject", async () =>
{
    const spy = new SpyGrantStore();
    const store = new CachingRoleGrantStore(spy, 1000, new Clock().Now);
    await store.GrantsFor("u1", Fixture.Tenant());
    await store.GrantsFor("u2", Fixture.Tenant());
    assert.equal(spy.Calls, 2);
    store.Invalidate("u1");
    await store.GrantsFor("u2", Fixture.Tenant());
    assert.equal(spy.Calls, 2);
    await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(spy.Calls, 3);
});

test("Invalidate drops the subject across tenants", async () =>
{
    const spy = new SpyGrantStore();
    const store = new CachingRoleGrantStore(spy, 1000, new Clock().Now);
    await store.GrantsFor("u1", Fixture.Tenant("t1"));
    await store.GrantsFor("u1", Fixture.Tenant("t2"));
    store.Invalidate("u1");
    await store.GrantsFor("u1", Fixture.Tenant("t1"));
    await store.GrantsFor("u1", Fixture.Tenant("t2"));
    assert.equal(spy.Calls, 4);
});

test("per-(tenant,subject) keys do not collide", async () =>
{
    const spy = new SpyGrantStore();
    await spy.Save(Fixture.Grant("u1", Role.Viewer, "t1"));
    await spy.Save(Fixture.Grant("u1", Role.Owner, "t2"));
    const store = new CachingRoleGrantStore(spy, 1000, new Clock().Now);
    const a = await store.GrantsFor("u1", Fixture.Tenant("t1"));
    const b = await store.GrantsFor("u1", Fixture.Tenant("t2"));
    assert.equal(a[0]!.Role, Role.Viewer);
    assert.equal(b[0]!.Role, Role.Owner);
    await store.GrantsFor("u1", Fixture.Tenant("t1"));
    await store.GrantsFor("u1", Fixture.Tenant("t2"));
    assert.equal(spy.Calls, 2);
});

test("TTL boundary: exactly ttlMs refetches", async () =>
{
    const spy = new SpyGrantStore();
    const clock = new Clock();
    const store = new CachingRoleGrantStore(spy, 1000, clock.Now);
    await store.GrantsFor("u1", Fixture.Tenant());
    clock.Ms += 1000;
    await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(spy.Calls, 2);
});

test("TTL boundary: ttlMs - 1 is still a cache hit", async () =>
{
    const spy = new SpyGrantStore();
    const clock = new Clock();
    const store = new CachingRoleGrantStore(spy, 1000, clock.Now);
    await store.GrantsFor("u1", Fixture.Tenant());
    clock.Ms += 999;
    await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(spy.Calls, 1);
});

class DeferredGrantStore implements IRoleGrantStore
{
    public Calls = 0;
    public Release: (() => void) | undefined;
    private readonly grants: Grant[] = [];
    public async GrantsFor(subject: string, _tenant: Tenant): Promise<readonly Grant[]>
    {
        this.Calls += 1;
        const snapshot = this.grants.filter((g) => g.Subject === subject);
        if (this.Calls === 1)
        {
            await new Promise<void>((resolve) => { this.Release = resolve; });
        }
        return snapshot;
    }
    public async GrantsOn(_resource: ResourceRef): Promise<readonly Grant[]> { return this.grants; }
    public async Save(grant: Grant): Promise<void> { this.grants.push(grant); }
    public async Revoke(_grant: Grant): Promise<void> { }
}

test("Revoke writes through to backing and invalidates the subject cache", async () =>
{
    const spy = new SpyGrantStore();
    await spy.Save(Fixture.Grant("u1", Role.Admin));
    const store = new CachingRoleGrantStore(spy, 1000, new Clock().Now);
    const before = await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(before.length, 1);
    await store.Revoke(Fixture.Grant("u1", Role.Admin));
    const after = await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(spy.Calls, 2);
    assert.equal(after.length, 0);
});

test("in-flight fetch overtaken by Save does not cache the stale list", async () =>
{
    const backing = new DeferredGrantStore();
    const store = new CachingRoleGrantStore(backing, 1000, new Clock().Now);
    const inFlight = store.GrantsFor("u1", Fixture.Tenant());
    await store.Save(Fixture.Grant("u1", Role.Admin));
    backing.Release!();
    const stale = await inFlight;
    assert.equal(stale.length, 0);
    const fresh = await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(backing.Calls, 2);
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0]!.Role, Role.Admin);
});

test("GrantsOn delegates to the backing store every time, uncached", async () =>
{
    const spy = new SpyGrantStore();
    await spy.Save(Fixture.Grant("u1", Role.Admin));
    const store = new CachingRoleGrantStore(spy, 1000, new Clock().Now);
    const root = new ResourceRef(ResourceKind.Tenant, "t1", []);
    const first = await store.GrantsOn(root);
    const second = await store.GrantsOn(root);
    assert.equal(spy.OnCalls, 2);
    assert.equal(first.length, 1);
    assert.equal(second.length, 1);
    await store.Revoke(Fixture.Grant("u1", Role.Admin));
    assert.equal((await store.GrantsOn(root)).length, 0);
});

test("GrantsOn does not read or populate the subject cache", async () =>
{
    const spy = new SpyGrantStore();
    const store = new CachingRoleGrantStore(spy, 1000, new Clock().Now);
    await store.GrantsOn(new ResourceRef(ResourceKind.Tenant, "t1", []));
    assert.equal(spy.Calls, 0);
    await store.GrantsFor("u1", Fixture.Tenant());
    await store.GrantsOn(new ResourceRef(ResourceKind.Tenant, "t1", []));
    await store.GrantsFor("u1", Fixture.Tenant());
    assert.equal(spy.Calls, 1);
});
