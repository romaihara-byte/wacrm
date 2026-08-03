import { describe, expect, it } from 'vitest'
import { isMissingAiSchemaError } from './schema'

describe('isMissingAiSchemaError', () => {
  it('detects Supabase missing-table errors', () => {
    expect(isMissingAiSchemaError({ code: '42P01', message: "Could not find the table 'public.ai_configs' in the schema cache" })).toBe(true)
  })

  it('detects PostgREST schema cache errors', () => {
    expect(isMissingAiSchemaError({ code: 'PGRST205', message: 'Could not find the relationship ... in the schema cache' })).toBe(true)
  })

  it('ignores unrelated errors', () => {
    expect(isMissingAiSchemaError({ code: '23505', message: 'duplicate key value' })).toBe(false)
  })
})
