/**
 * Error mapper utility for converting database/API errors to user-friendly messages.
 * This prevents exposing internal schema details like table names, column names, and constraints.
 * 
 * SECURITY: Always use mapErrorToUserMessage() for user-facing error notifications.
 * Use logError() for developer debugging in logs.
 */

// PostgreSQL/Supabase error codes mapped to user-friendly French messages
const ERROR_CODE_MAP: Record<string, string> = {
  // PostgreSQL constraint violations
  '23505': 'Cette valeur existe déjà dans le système',
  '23503': 'Impossible de supprimer car des données liées existent',
  '23502': 'Certains champs requis sont manquants',
  '23514': 'Les données saisies ne respectent pas les contraintes',
  '23000': 'Une erreur de contrainte est survenue',
  
  // PostgREST errors
  'PGRST116': 'Aucune donnée trouvée',
  'PGRST204': 'Aucun résultat pour cette requête',
  'PGRST301': 'Accès non autorisé',
  
  // Authentication errors
  'invalid_grant': 'Email ou mot de passe incorrect',
  'user_not_found': 'Utilisateur non trouvé',
  'email_not_confirmed': 'Veuillez confirmer votre adresse email',
  'invalid_credentials': 'Email ou mot de passe incorrect',
  
  // Network/connection errors
  'NETWORK_ERROR': 'Erreur de connexion. Vérifiez votre connexion internet.',
  'TIMEOUT': 'La requête a pris trop de temps. Veuillez réessayer.',
};

// Message patterns to match and sanitize
const MESSAGE_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /duplicate key/i, message: 'Cette valeur existe déjà dans le système' },
  { pattern: /violates foreign key/i, message: 'Impossible car des données liées existent' },
  { pattern: /violates not-null/i, message: 'Certains champs requis sont manquants' },
  { pattern: /Invalid login credentials/i, message: 'Email ou mot de passe incorrect' },
  { pattern: /already registered/i, message: 'Cet email est déjà utilisé' },
  { pattern: /rate limit/i, message: 'Trop de tentatives. Veuillez patienter.' },
  { pattern: /network/i, message: 'Erreur de connexion réseau' },
];

/**
 * Maps an error to a user-friendly message that doesn't expose internal details.
 * 
 * @param error - The error object from Supabase or other sources
 * @returns A sanitized, user-friendly error message in French
 */
export function mapErrorToUserMessage(error: unknown): string {
  const defaultMessage = 'Une erreur est survenue. Veuillez réessayer.';
  
  if (!error) {
    return defaultMessage;
  }

  // Handle error objects
  if (typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    
    // Check for error code first (most reliable)
    const code = errorObj.code || errorObj.error_code;
    if (typeof code === 'string' && ERROR_CODE_MAP[code]) {
      return ERROR_CODE_MAP[code];
    }
    
    // Check error message against patterns
    const message = errorObj.message || errorObj.error_description || errorObj.msg;
    if (typeof message === 'string') {
      // Check against known patterns
      for (const { pattern, message: userMessage } of MESSAGE_PATTERNS) {
        if (pattern.test(message)) {
          return userMessage;
        }
      }
    }
  }

  // For string errors, check against patterns
  if (typeof error === 'string') {
    for (const { pattern, message: userMessage } of MESSAGE_PATTERNS) {
      if (pattern.test(error)) {
        return userMessage;
      }
    }
  }
  
  return defaultMessage;
}

/**
 * Checks if an error is a Zod validation error (has .issues property)
 */
export function isValidationError(error: unknown): error is { issues: Array<{ message: string }> } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray((error as { issues: unknown }).issues)
  );
}
