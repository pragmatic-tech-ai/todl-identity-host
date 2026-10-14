import type { Grant, IRoleGrantStore, Tenant } from "@pragmatic-tech-ai/todl-identity";

class CacheEntry
{
    public constructor(
        public readonly Subject: string,
        public readonly Grants: readonly Grant[],
        public readonly ExpiresAtMs: number)
    {
    }
}

/**
 * Short-TTL grant cache over a backing store. Saves write through and invalidate the
 * affected subject so a grant change or revocation is never masked by a stale entry.
 */
export class CachingRoleGrantStore implements IRoleGrantStore
{
    private static readonly KeySeparator = "\u0000";

    private readonly cache = new Map<string, CacheEntry>();
    private generation = 0;

    public constructor(
        private readonly backing: IRoleGrantStore,
        private readonly ttlMs: number,
        private readonly now: () => Date = () => new Date())
    {
    }

    public async GrantsFor(subject: string, tenant: Tenant): Promise<readonly Grant[]>
    {
        const key = CachingRoleGrantStore.KeyOf(tenant.Id, subject);
        const nowMs = this.now().getTime();
        const hit = this.cache.get(key);
        if (hit !== undefined && nowMs < hit.ExpiresAtMs)
        {
            return hit.Grants;
        }
        const gen = this.generation;
        const grants = await this.backing.GrantsFor(subject, tenant);
        if (this.generation === gen)
        {
            this.cache.set(key, new CacheEntry(subject, grants, nowMs + this.ttlMs));
        }
        return grants;
    }

    public async Save(grant: Grant): Promise<void>
    {
        await this.backing.Save(grant);
        this.Invalidate(grant.Subject);
    }

    public async Revoke(grant: Grant): Promise<void>
    {
        await this.backing.Revoke(grant);
        this.Invalidate(grant.Subject);
    }

    public Invalidate(subject: string): void
    {
        this.generation += 1;
        for (const [key, entry] of [...this.cache])
        {
            if (entry.Subject === subject)
            {
                this.cache.delete(key);
            }
        }
    }

    public Clear(): void
    {
        this.generation += 1;
        this.cache.clear();
    }

    private static KeyOf(tenantId: string, subject: string): string
    {
        return tenantId + CachingRoleGrantStore.KeySeparator + subject;
    }
}
