export interface IAuditCheckpointSigner
{
    Sign(tenantId: string, sequence: number, headHash: string, at: string): string;
    Verify(tenantId: string, sequence: number, headHash: string, at: string, signature: string): boolean;
}
