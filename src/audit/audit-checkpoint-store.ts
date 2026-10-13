import type { AuditCheckpoint } from "./audit-checkpoint.js";

export interface IAuditCheckpointStore
{
    Latest(tenantId: string): Promise<AuditCheckpoint | undefined>;
    Append(checkpoint: AuditCheckpoint): Promise<void>;
    Tenants(): Promise<readonly string[]>;
}
