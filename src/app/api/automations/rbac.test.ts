import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  adminFrom: vi.fn(),
  autoEqCalls: [] as Array<[string, unknown]>,
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

vi.mock('@/lib/automations/admin-client', () => ({
  supabaseAdmin: () => ({
    from: h.adminFrom,
  }),
}))

vi.mock('@/lib/automations/templates', () => ({
  getTemplate: vi.fn(() => null),
}))

vi.mock('@/lib/automations/steps-tree', () => ({
  insertSteps: vi.fn(async () => null),
  replaceSteps: vi.fn(async () => null),
  loadStepsTree: vi.fn(async () => []),
}))

vi.mock('@/lib/automations/validate', () => ({
  validateStepsForActivation: vi.fn(() => []),
  validateTriggerForActivation: vi.fn(() => []),
}))

vi.mock('@/lib/automations/engine', () => ({
  runAutomationsForTrigger: vi.fn(async () => undefined),
}))

import { GET as listAutomations, POST as createAutomation } from './route'
import { PATCH as patchAutomation, DELETE as deleteAutomation } from './[id]/route'
import { POST as duplicateAutomation } from './[id]/duplicate/route'
import { POST as triggerAutomationEngine } from './engine/route'

function forbidden(message = 'forbidden') {
  return { status: 403, message }
}

function unauthorized(message = 'Unauthorized') {
  return { status: 401, message }
}

function makeSupabaseReadAutomation(exists: boolean) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: exists
                ? {
                    id: 'auto-1',
                    is_active: false,
                    trigger_type: 'keyword',
                    trigger_config: {},
                  }
                : null,
              error: null,
            }),
          }),
          maybeSingle: async () => ({
            data: exists
              ? {
                  id: 'auto-1',
                  is_active: false,
                  trigger_type: 'keyword',
                  trigger_config: {},
                }
              : null,
            error: null,
          }),
        }),
        order: async () => ({ data: [{ id: 'auto-1' }], error: null }),
      }),
    }),
  }
}

function makeAdminBuilder() {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn((col: string, val: unknown) => {
      if (col === 'account_id') h.autoEqCalls.push([col, val])
      return chain
    }),
    order: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: { id: 'auto-1' }, error: null })),
    maybeSingle: vi.fn(async () => ({
      data: {
        id: 'auto-1',
        account_id: 'acct-a',
        is_active: false,
        trigger_type: 'keyword',
        trigger_config: {},
      },
      error: null,
    })),
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'auto-1' }], error: null }),
  }
  return chain
}

beforeEach(() => {
  h.requireRole.mockReset()
  h.adminFrom.mockReset()
  h.autoEqCalls.length = 0
  h.adminFrom.mockImplementation(() => makeAdminBuilder())
})

describe('automations RBAC', () => {
  it('allows viewer read on GET /api/automations', async () => {
    h.requireRole.mockResolvedValueOnce({
      accountId: 'acct-a',
      supabase: makeSupabaseReadAutomation(true),
    })

    const res = await listAutomations()
    expect(res.status).toBe(200)
    expect(h.requireRole).toHaveBeenCalledWith('viewer')
  })

  it('blocks viewer write on POST /api/automations', async () => {
    h.requireRole.mockRejectedValueOnce(forbidden())

    const res = await createAutomation(
      new Request('http://localhost/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'A', trigger_type: 'keyword' }),
      }),
    )

    expect(res.status).toBe(403)
    expect(h.requireRole).toHaveBeenCalledWith('agent')
  })

  it('returns 401 on POST /api/automations without session', async () => {
    h.requireRole.mockRejectedValueOnce(unauthorized())

    const res = await createAutomation(
      new Request('http://localhost/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'A', trigger_type: 'keyword' }),
      }),
    )

    expect(res.status).toBe(401)
    expect(h.requireRole).toHaveBeenCalledWith('agent')
  })

  it('blocks cross-account patch with 404', async () => {
    h.requireRole.mockResolvedValueOnce({ accountId: 'acct-a' })
    h.adminFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    }))

    const res = await patchAutomation(
      new Request('http://localhost/api/automations/auto-b', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'patched' }),
      }),
      { params: Promise.resolve({ id: 'auto-b' }) },
    )

    expect(res.status).toBe(404)
    expect(h.requireRole).toHaveBeenCalledWith('agent')
  })

  it('scopes delete by account_id', async () => {
    h.requireRole.mockResolvedValueOnce({ accountId: 'acct-a' })

    const res = await deleteAutomation(
      new Request('http://localhost/api/automations/auto-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'auto-1' }) },
    )

    expect(res.status).toBe(200)
    expect(h.autoEqCalls.some(([k, v]) => k === 'account_id' && v === 'acct-a')).toBe(true)
  })

  it('blocks viewer duplicate and manual trigger execution', async () => {
    h.requireRole.mockRejectedValueOnce(forbidden())
    const dupRes = await duplicateAutomation(
      new Request('http://localhost/api/automations/auto-1/duplicate', { method: 'POST' }),
      { params: Promise.resolve({ id: 'auto-1' }) },
    )
    expect(dupRes.status).toBe(403)

    h.requireRole.mockRejectedValueOnce(forbidden())
    const engineRes = await triggerAutomationEngine(
      new Request('http://localhost/api/automations/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_type: 'manual' }),
      }),
    )
    expect(engineRes.status).toBe(403)
    expect(h.requireRole).toHaveBeenCalledWith('agent')
  })
})
