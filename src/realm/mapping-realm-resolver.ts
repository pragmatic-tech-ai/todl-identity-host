import type { IRealmResolver, Realm } from "@pragmatic-tech-ai/todl-identity";

export class MappingRealmResolver implements IRealmResolver
{
    private readonly byHint: ReadonlyMap<string, Realm>;

    public constructor(byHint: ReadonlyMap<string, Realm>)
    {
        this.byHint = byHint;
    }

    public async Resolve(hint: string): Promise<Realm | null>
    {
        return this.byHint.get(hint) ?? null;
    }
}
