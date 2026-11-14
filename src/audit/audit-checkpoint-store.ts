import type { AuditCheckpoint } from "./audit-checkpoint.js";

export interface IAuditCheckpointStore
{
    Latest(realmId: string): Promise<AuditCheckpoint | undefined>;
    Append(checkpoint: AuditCheckpoint): Promise<void>;
    Realms(): Promise<readonly string[]>;
}
