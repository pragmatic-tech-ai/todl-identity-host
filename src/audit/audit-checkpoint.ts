export class AuditCheckpoint
{
    public constructor(
        public readonly TenantId: string,
        public readonly Sequence: number,
        public readonly HeadHash: string,
        public readonly At: string,
        public readonly Signature: string)
    {
    }
}
