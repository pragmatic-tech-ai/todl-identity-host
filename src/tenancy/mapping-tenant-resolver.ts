import type { ITenantResolver, Tenant } from "@pragmatic-tech-ai/todl-identity";

export class MappingTenantResolver implements ITenantResolver
{
    private readonly byHint: ReadonlyMap<string, Tenant>;

    public constructor(byHint: ReadonlyMap<string, Tenant>)
    {
        this.byHint = byHint;
    }

    public async Resolve(hint: string): Promise<Tenant | null>
    {
        return this.byHint.get(hint) ?? null;
    }
}
