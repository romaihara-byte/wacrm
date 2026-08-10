import { describe, expect, it } from 'vitest'

import { getSecurityHeadersForEnv } from '../../../next.config'

function findHeader(
  headers: Array<{ key: string; value: string }>,
  key: string,
): string | undefined {
  return headers.find((h) => h.key === key)?.value
}

describe('CSP config by environment', () => {
  it('uses Report-Only in development with unsafe-eval', () => {
    const headers = getSecurityHeadersForEnv('development')
    const reportOnly = findHeader(headers, 'Content-Security-Policy-Report-Only')
    const enforce = findHeader(headers, 'Content-Security-Policy')

    expect(reportOnly).toBeDefined()
    expect(reportOnly).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
    expect(enforce).toBeUndefined()
  })

  it('uses enforce header in production and drops unsafe-eval', () => {
    const headers = getSecurityHeadersForEnv('production')
    const enforce = findHeader(headers, 'Content-Security-Policy')
    const reportOnly = findHeader(headers, 'Content-Security-Policy-Report-Only')

    expect(enforce).toBeDefined()
    expect(enforce).toContain("script-src 'self' 'unsafe-inline'")
    expect(enforce).not.toContain("'unsafe-eval'")
    expect(reportOnly).toBeUndefined()
  })

  it("keeps core production hardening directives", () => {
    const headers = getSecurityHeadersForEnv('production')
    const enforce = findHeader(headers, 'Content-Security-Policy')

    expect(enforce).toContain("frame-ancestors 'none'")
    expect(enforce).toContain("base-uri 'self'")
    expect(enforce).toContain("form-action 'self'")
    expect(enforce).toContain("object-src 'none'")
    expect(enforce).toContain(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    )
  })
})
