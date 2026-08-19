/**
 * Safe error logging utility that prevents sensitive information leakage in production.
 * Only logs full error details in development mode.
 */
export const logError = (context: string, error: unknown): void => {
  if (import.meta.env.DEV) {
    // Full error logging in development for debugging
    console.error(`[DEV] ${context}:`, error);
  } else {
    // Sanitized logging in production - only safe fields
    const safeError = {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
    };
    console.error(`${context}:`, safeError);
  }
};
