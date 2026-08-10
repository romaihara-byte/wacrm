import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { supabaseAdminMock, resumePendingExecutionMock } = vi.hoisted(() => ({
  supabaseAdminMock: vi.fn(),
  resumePendingExecutionMock: vi.fn(),
}))

vi.mock('@/lib/automations/admin-client', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

vi.mock('@/lib/automations/engine', () => ({
  resumePendingExecution: resumePendingExecutionMock,
}))

import { GET } from './route'

function makeAdminWithNoDueRows() {
  const terminal = Promise.resolve({ data: [], error: null })

  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.lte = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.limit = vi.fn(() => terminal)

  return {
    from: vi.fn(() => builder),
  }
}

describe('GET /api/automations/cron auth hardening', () => {
  const ORIGINAL_SECRET = process.env.AUTOMATION_CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AUTOMATION_CRON_SECRET
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.AUTOMATION_CRON_SECRET
    } else {
      process.env.AUTOMATION_CRON_SECRET = ORIGINAL_SECRET
    }
  })

  it('returns 503 when AUTOMATION_CRON_SECRET is not configured', async () => {
    const res = await GET(new Request('http://localhost/api/automations/cron'))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toBe('cron not configured')
    expect(supabaseAdminMock).not.toHaveBeenCalled()
  })

  it('returns 401 when x-cron-secret header is missing', async () => {
    process.env.AUTOMATION_CRON_SECRET = 'test-secret'

    const res = await GET(new Request('http://localhost/api/automations/cron'))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
    expect(String(body.error)).not.toContain('test-secret')
    expect(supabaseAdminMock).not.toHaveBeenCalled()
  })

  it('returns 401 when secret is incorrect with same length', async () => {
    process.env.AUTOMATION_CRON_SECRET = 'abcd1234'

    const res = await GET(
      new Request('http://localhost/api/automations/cron', {
        headers: { 'x-cron-secret': 'wxyz5678' },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
    expect(supabaseAdminMock).not.toHaveBeenCalled()
  })

  it('returns 401 when secret is incorrect with different length', async () => {
    process.env.AUTOMATION_CRON_SECRET = 'very-long-secret'

    await expect(
      GET(
        new Request('http://localhost/api/automations/cron', {
          headers: { 'x-cron-secret': 'short' },
        }),
      ),
    ).resolves.toMatchObject({ status: 401 })

    expect(supabaseAdminMock).not.toHaveBeenCalled()
  })

  it('passes auth and continues normal execution when secret is correct', async () => {
    process.env.AUTOMATION_CRON_SECRET = 'safe-secret'
    const admin = makeAdminWithNoDueRows()
    supabaseAdminMock.mockReturnValue(admin)

    const res = await GET(
      new Request('http://localhost/api/automations/cron', {
        headers: { 'x-cron-secret': 'safe-secret' },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ processed: 0 })
    expect(supabaseAdminMock).toHaveBeenCalledTimes(1)
    expect(admin.from).toHaveBeenCalledWith('automation_pending_executions')
    expect(resumePendingExecutionMock).not.toHaveBeenCalled()
  })
})
