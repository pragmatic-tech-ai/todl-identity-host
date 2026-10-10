import { test } from "node:test";
import assert from "node:assert/strict";
import { Grant, ResourceRef, ResourceKind, Role, Tenant, TenantKind } from "@pragmatic-tech-ai/todl-identity";
import { CachingRoleGrantStore } from "../caching-role-grant-store.js";
import type { IRoleGrantStore } from "@pragmatic-tech-ai/todl-identity";

class SpyGrantStore implements IRoleGrantStore
{
    public Calls = 0;
    private readonly grants: Grant[] = [];
    public async GrantsFor(subject: string, tenant: Tenant): Promise<readonly Grant[]>
    {
        this.Calls += 1;
        return this.grants.filter((g) => g.Subject === subject && g.Resource.TenantId === tenant.Id);
    }
    public async Save(grant: Grant): Promise<void> { this.grants.push(grant); }
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
    public async Save(grant: Grant): Promise<void> { this.grants.push(grant); }
}

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
