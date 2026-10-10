import type { ITenantResolver, Tenant } from "@pragmatic-tech-ai/todl-identity";

export class SingleTenantResolver implements ITenantResolver
{
    private readonly tenant: Tenant;

    public constructor(tenant: Tenant)
    {
        this.tenant = tenant;
    }

    public async Resolve(_hint: string): Promise<Tenant | null>
    {
        return this.tenant;
    }
}
