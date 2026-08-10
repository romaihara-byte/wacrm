import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({
  embedTexts: vi.fn(),
  adminRpc: vi.fn(),
}))
vi.mock('./embeddings', () => ({
  embedTexts: h.embedTexts,
  toVectorLiteral: (v: number[]) => `[${v.join(',')}]`,
}))
vi.mock('./admin-client', () => ({
  supabaseAdmin: () => makeAdminDb(),
}))

import { retrieveKnowledge, ingestDocument } from './knowledge'
import { retrieveKnowledgeService } from './knowledge'

interface FakeState {
  semantic: { id: string; content: string }[]
  fts: { id: string; content: string }[]
  chunkCount: number
  rpcCalls: string[]
  rpcArgs: Array<{ name: string; args: Record<string, unknown> }>
  adminRpcCalls: string[]
  adminRpcArgs: Array<{ name: string; args: Record<string, unknown> }>
  inserted: Record<string, unknown>[] | null
  deletedFor: string | null
}

function makeDb() {
  const state: FakeState = {
    semantic: [],
    fts: [],
    chunkCount: 5, // account has a non-empty KB by default
    rpcCalls: [],
    rpcArgs: [],
    adminRpcCalls: [],
    adminRpcArgs: [],
    inserted: null,
    deletedFor: null,
  }
  activeState = state
  h.adminRpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    state.adminRpcCalls.push(name)
    state.adminRpcArgs.push({ name, args })
    if (name === 'match_ai_knowledge_semantic')
      return Promise.resolve({ data: state.semantic, error: null })
    if (name === 'match_ai_knowledge_fts')
      return Promise.resolve({ data: state.fts, error: null })
    if (name === 'match_ai_knowledge_semantic_service')
      return Promise.resolve({ data: state.semantic, error: null })
    if (name === 'match_ai_knowledge_fts_service')
      return Promise.resolve({ data: state.fts, error: null })
    return Promise.resolve({ data: null, error: null })
  })
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push(name)
      state.rpcArgs.push({ name, args })
      if (name === 'match_ai_knowledge_semantic')
        return Promise.resolve({ data: state.semantic, error: null })
      if (name === 'match_ai_knowledge_fts')
        return Promise.resolve({ data: state.fts, error: null })
      return Promise.resolve({ data: null, error: null })
    },
    from: () => ({
      // retrieveKnowledge's empty-KB count guard.
      select: () => ({
        eq: () => Promise.resolve({ count: state.chunkCount, error: null }),
      }),
      delete: () => ({
        eq: (_col: string, val: string) => {
          state.deletedFor = val
          return Promise.resolve({ error: null })
        },
      }),
      insert: (rows: Record<string, unknown>[]) => {
        state.inserted = rows
        return Promise.resolve({ error: null })
      },
    }),
  }
  return { db: db as unknown as SupabaseClient, state }
}

function makeAdminDb() {
  const state = activeState
  if (!state) throw new Error('admin client requested without active fake state')
  return {
    rpc: (name: string, args: Record<string, unknown>) => h.adminRpc(name, args),
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: state.chunkCount, error: null }),
      }),
    }),
  }
}

let activeState: FakeState | null = null

beforeEach(() => {
  h.embedTexts.mockReset()
  h.adminRpc.mockReset()
  activeState = null
  h.embedTexts.mockImplementation(async (_key: string, inputs: string[]) =>
    inputs.map((_, i) => [i, i]),
  )
})

describe('retrieveKnowledge', () => {
  it('returns [] for an empty query without touching the DB', async () => {
    const { db, state } = makeDb()
    expect(await retrieveKnowledge(db, 'acct', { embeddingsApiKey: null }, '  ')).toEqual([])
    expect(state.rpcCalls).toEqual([])
  })

  it('short-circuits (no embed, no RPC) when the KB is empty', async () => {
    const { db, state } = makeDb()
    state.chunkCount = 0
    const out = await retrieveKnowledge(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'q')
    expect(out).toEqual([])
    expect(h.embedTexts).not.toHaveBeenCalled()
    expect(state.rpcCalls).toEqual([])
  })

  it('uses lexical FTS only when there is no embeddings key', async () => {
    const { db, state } = makeDb()
    state.fts = [{ id: 'f1', content: 'F1' }]
    const out = await retrieveKnowledge(db, 'acct', { embeddingsApiKey: null }, 'q')
    expect(out).toEqual(['F1'])
    expect(state.rpcCalls).toEqual(['match_ai_knowledge_fts'])
    expect(state.adminRpcCalls).toEqual([])
    expect(h.embedTexts).not.toHaveBeenCalled()
  })

  it('uses semantic search when an embeddings key is present', async () => {
    const { db, state } = makeDb()
    state.semantic = [
      { id: 's1', content: 'S1' },
      { id: 's2', content: 'S2' },
      { id: 's3', content: 'S3' },
    ]
    const out = await retrieveKnowledge(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'q', 3)
    expect(out).toEqual(['S1', 'S2', 'S3'])
    expect(h.embedTexts).toHaveBeenCalledTimes(1)
    // Enough semantic hits → no FTS top-up.
    expect(state.rpcCalls).toEqual(['match_ai_knowledge_semantic'])
    expect(state.adminRpcCalls).toEqual([])
  })

  it('tops up with FTS and dedupes when semantic is short', async () => {
    const { db, state } = makeDb()
    state.semantic = [
      { id: 's1', content: 'S1' },
      { id: 's2', content: 'S2' },
    ]
    state.fts = [
      { id: 's2', content: 'S2-dup' }, // dedup by id
      { id: 'f1', content: 'F1' },
    ]
    const out = await retrieveKnowledge(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'q', 3)
    expect(out).toEqual(['S1', 'S2', 'F1'])
    expect(state.rpcCalls).toEqual([
      'match_ai_knowledge_semantic',
      'match_ai_knowledge_fts',
    ])
    expect(state.adminRpcCalls).toEqual([])
  })

  it('runs the user retrieval RPCs only on the caller client', async () => {
    const { db, state } = makeDb()
    state.fts = [{ id: 'f1', content: 'F1' }]
    await retrieveKnowledge(db, 'acct', { embeddingsApiKey: null }, 'q')
    expect(state.rpcCalls).toEqual(['match_ai_knowledge_fts'])
    expect(state.adminRpcCalls).toEqual([])
  })
})

describe('retrieveKnowledgeService', () => {
  it('uses the service-only FTS RPC on the admin client', async () => {
    const { state } = makeDb()
    state.fts = [{ id: 'f1', content: 'F1' }]
    const out = await retrieveKnowledgeService('acct', { embeddingsApiKey: null }, 'q')
    expect(out).toEqual(['F1'])
    expect(state.rpcCalls).toEqual([])
    expect(state.adminRpcCalls).toEqual(['match_ai_knowledge_fts_service'])
  })

  it('uses the service-only semantic RPC on the admin client', async () => {
    const { state } = makeDb()
    state.semantic = [{ id: 's1', content: 'S1' }]
    const out = await retrieveKnowledgeService('acct', { embeddingsApiKey: 'sk-x' }, 'q', 1)
    expect(out).toEqual(['S1'])
    expect(state.rpcCalls).toEqual([])
    expect(state.adminRpcCalls).toEqual(['match_ai_knowledge_semantic_service'])
  })

  it('passes account-scoped args only to the service RPCs', async () => {
    const { state } = makeDb()
    state.fts = [{ id: 'f1', content: 'F1' }]
    await retrieveKnowledgeService('acct-service', { embeddingsApiKey: null }, 'q', 7)
    expect(state.rpcCalls).toEqual([])
    expect(state.adminRpcArgs).toEqual([
      {
        name: 'match_ai_knowledge_fts_service',
        args: {
          p_account_id: 'acct-service',
          p_query: 'q',
          p_match_count: 7,
        },
      },
    ])
  })
})

describe('ingestDocument', () => {
  it('embeds chunks when a key is present', async () => {
    const { db, state } = makeDb()
    await ingestDocument(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'doc-1', 'hello world')
    expect(h.embedTexts).toHaveBeenCalledTimes(1)
    expect(state.deletedFor).toBe('doc-1')
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted![0].embedding).toBe('[0,0]') // literal from mocked embed
    expect(state.inserted![0].account_id).toBe('acct')
  })

  it('stores chunks without embeddings when there is no key', async () => {
    const { db, state } = makeDb()
    await ingestDocument(db, 'acct', { embeddingsApiKey: null }, 'doc-1', 'hello world')
    expect(h.embedTexts).not.toHaveBeenCalled()
    expect(state.inserted![0].embedding).toBeNull()
  })

  it('deletes existing chunks and inserts nothing for empty content', async () => {
    const { db, state } = makeDb()
    await ingestDocument(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'doc-1', '   ')
    expect(state.deletedFor).toBe('doc-1')
    expect(state.inserted).toBeNull()
    expect(h.embedTexts).not.toHaveBeenCalled()
  })

  it('still stores lexical chunks when embedding fails, then rethrows', async () => {
    const { db, state } = makeDb()
    h.embedTexts.mockRejectedValueOnce(new Error('rate limited'))
    await expect(
      ingestDocument(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'doc-1', 'hello world'),
    ).rejects.toThrow('rate limited')
    // Chunks were inserted (lexical search works) despite the embed failure…
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted![0].embedding).toBeNull()
  })
})
