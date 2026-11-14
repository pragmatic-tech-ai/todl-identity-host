export interface IAuditCheckpointSigner
{
    Sign(realmId: string, sequence: number, headHash: string, at: string): string;
    Verify(realmId: string, sequence: number, headHash: string, at: string, signature: string): boolean;
}
