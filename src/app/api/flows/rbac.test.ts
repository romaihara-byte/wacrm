import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  adminFrom: vi.fn(),
  validateFlowForActivation: vi.fn(() => []),
  flowEqCalls: [] as Array<[string, unknown]>,
}))

vi.mock('@/lib/auth/account', () => ({
  requireRole: h.requireRole,
  toErrorResponse: (err: unknown) => {
    const status =
      typeof err === 'object' && err && 'status' in err
        ? Number((err as { status: number }).status)
        : 500
    const msg =
      typeof err === 'object' && err && 'message' in err
        ? String((err as { message: string }).message)
        : 'Internal server error'
    return Response.json({ error: msg }, { status })
  },
}))

vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: () => ({
    from: h.adminFrom,
  }),
}))

vi.mock('@/lib/flows/validate', () => ({
  validateFlowForActivation: h.validateFlowForActivation,
}))

vi.mock('@/lib/flows/templates', () => ({
  getFlowTemplate: vi.fn(() => null),
}))

import { GET as listFlows, POST as createFlow } from './route'
import { PUT as updateFlow, DELETE as deleteFlow } from './[id]/route'
import { POST as activateFlow } from './[id]/activate/route'

function forbidden(message = 'forbidden') {
  return { status: 403, message }
}

function unauthorized(message = 'Unauthorized') {
  return { status: 401, message }
}

function makeSupabaseForFlowExists(exists: boolean) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: unknown) => {
          if (table === 'flows' && col === 'account_id') {
            h.flowEqCalls.push([col, val])
          }
          return {
            eq: () => ({
              maybeSingle: async () => ({
                data: exists ? { id: 'flow-1' } : null,
                error: null,
              }),
            }),
            maybeSingle: async () => ({
              data: exists ? { id: 'flow-1' } : null,
              error: null,
            }),
            order: async () => ({ data: [], error: null }),
          }
        },
        order: async () => ({ data: [], error: null }),
      }),
    }),
  }
}

function makeAdminBuilder() {
  const chain = {
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn((col: string, val: unknown) => {
      if (col === 'account_id') h.flowEqCalls.push([col, val])
      return chain
    }),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: { id: 'flow-1' }, error: null })),
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'flow-1' }], error: null }),
  }
  return chain
}

beforeEach(() => {
  h.requireRole.mockReset()
  h.adminFrom.mockReset()
  h.validateFlowForActivation.mockReset()
  h.validateFlowForActivation.mockReturnValue([])
  h.flowEqCalls.length = 0
  h.adminFrom.mockImplementation(() => makeAdminBuilder())
})

describe('flows RBAC', () => {
  it('allows viewer read on GET /api/flows', async () => {
    h.requireRole.mockResolvedValueOnce({
      accountId: 'acct-1',
      supabase: {
        from: () => ({
          select: () => ({
            order: async () => ({ data: [{ id: 'f-1' }], error: null }),
          }),
        }),
      },
    })

    const res = await listFlows()
    expect(res.status).toBe(200)
    expect(h.requireRole).toHaveBeenCalledWith('viewer')
  })

  it('blocks viewer write on POST /api/flows', async () => {
    h.requireRole.mockRejectedValueOnce(forbidden())

    const res = await createFlow(
      new Request('http://localhost/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Flow 1' }),
      }),
    )

    expect(res.status).toBe(403)
    expect(h.requireRole).toHaveBeenCalledWith('agent')
  })

  it('returns 401 on POST /api/flows without session', async () => {
    h.requireRole.mockRejectedValueOnce(unauthorized())

    const res = await createFlow(
      new Request('http://localhost/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Flow 1' }),
      }),
    )

    expect(res.status).toBe(401)
    expect(h.requireRole).toHaveBeenCalledWith('agent')
  })

  it('blocks cross-account update with 404 and never mutates', async () => {
    h.requireRole.mockResolvedValueOnce({
      accountId: 'acct-a',
      supabase: makeSupabaseForFlowExists(false),
    })

    const res = await updateFlow(
      new Request('http://localhost/api/flows/flow-b', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'patched' }),
      }),
      { params: Promise.resolve({ id: 'flow-b' }) },
    )

    expect(res.status).toBe(404)
    expect(h.requireRole).toHaveBeenCalledWith('agent')
  })

  it('scopes flow delete by account_id', async () => {
    h.requireRole.mockResolvedValueOnce({
      accountId: 'acct-a',
      supabase: makeSupabaseForFlowExists(true),
    })

    const res = await deleteFlow(
      new Request('http://localhost/api/flows/flow-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'flow-1' }) },
    )

    expect(res.status).toBe(200)
    expect(h.flowEqCalls.some(([k, v]) => k === 'account_id' && v === 'acct-a')).toBe(true)
  })

  it('blocks viewer activate/deactivate on POST /api/flows/[id]/activate', async () => {
    h.requireRole.mockRejectedValueOnce(forbidden())

    const res = await activateFlow(
      new Request('http://localhost/api/flows/flow-1/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      }),
      { params: Promise.resolve({ id: 'flow-1' }) },
    )

    expect(res.status).toBe(403)
    expect(h.requireRole).toHaveBeenCalledWith('agent')
  })
})
