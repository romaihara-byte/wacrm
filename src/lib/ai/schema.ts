type SupabaseErrorLike = {
  code?: string
  message?: string | null
}

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205', 'PGRST200'])

export function isMissingAiSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as SupabaseErrorLike
  const code = maybeError.code?.toUpperCase() ?? ''
  const message = maybeError.message?.toLowerCase() ?? ''

  if (MISSING_TABLE_CODES.has(code)) return true

  return (
    message.includes('could not find the table') ||
    message.includes('schema cache') ||
    message.includes('relation') && message.includes('does not exist')
  )
}
