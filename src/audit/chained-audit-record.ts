import type { AuditEvent } from "@pragmatic-tech-ai/todl-identity";

export class ChainedAuditRecord
{
    public constructor(
        public readonly Event: AuditEvent,
        public readonly Sequence: number,
        public readonly PrevHash: string,
        public readonly Hash: string)
    {
    }
}
