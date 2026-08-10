const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const EXCLUDED_API_PATHS = new Set([
  '/api/whatsapp/webhook',
  '/api/automations/cron',
  '/api/flows/cron',
])

const EXCLUDED_API_PREFIXES = ['/api/v1']

export interface SameOriginCheckInput {
  method: string
  pathname: string
  expectedOrigin: string
  originHeader: string | null
  refererHeader: string | null
}

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase())
}

export function isOriginEnforcementExcluded(pathname: string): boolean {
  if (EXCLUDED_API_PATHS.has(pathname)) return true
  return EXCLUDED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function shouldEnforceSameOrigin(method: string, pathname: string): boolean {
  if (isSafeMethod(method)) return false
  if (!pathname.startsWith('/api/')) return false
  if (isOriginEnforcementExcluded(pathname)) return false
  return true
}

function parseOrigin(value: string): string | null {
  if (value === 'null') return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function isSameOriginRequest(input: SameOriginCheckInput): boolean {
  if (!shouldEnforceSameOrigin(input.method, input.pathname)) {
    return true
  }

  const headerOrigin = input.originHeader
  if (headerOrigin) {
    const parsedOrigin = parseOrigin(headerOrigin)
    return parsedOrigin !== null && parsedOrigin === input.expectedOrigin
  }

  const headerReferer = input.refererHeader
  if (headerReferer) {
    const parsedRefererOrigin = parseOrigin(headerReferer)
    return (
      parsedRefererOrigin !== null && parsedRefererOrigin === input.expectedOrigin
    )
  }

  return false
}
