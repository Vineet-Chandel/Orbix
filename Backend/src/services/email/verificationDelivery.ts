/** Never report a production verification code as delivered after a provider failure. */
export function assertProductionDelivery(result: { success: boolean; simulated?: boolean | undefined; sandboxRestricted?: boolean | undefined }): void {
    if (process.env.NODE_ENV === 'production' && (!result.success || result.simulated || result.sandboxRestricted)) {
        const error = new Error('Verification delivery is temporarily unavailable. Please try again later.') as Error & { statusCode: number };
        error.statusCode = 503;
        throw error;
    }
}
