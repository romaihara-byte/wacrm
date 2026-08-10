import { describe, expect, it } from 'vitest'

import {
  isOriginEnforcementExcluded,
  isSameOriginRequest,
  shouldEnforceSameOrigin,
} from './origin'

const BASE = {
  pathname: '/api/account',
  expectedOrigin: 'https://romeva.com.br',
}

describe('same-origin helper', () => {
  it('allows GET without Origin', () => {
    expect(
      isSameOriginRequest({
        method: 'GET',
        ...BASE,
        originHeader: null,
        refererHeader: null,
      }),
    ).toBe(true)
  })

  it('allows HEAD without Origin', () => {
    expect(
      isSameOriginRequest({
        method: 'HEAD',
        ...BASE,
        originHeader: null,
        refererHeader: null,
      }),
    ).toBe(true)
  })

  it('allows OPTIONS without Origin', () => {
    expect(
      isSameOriginRequest({
        method: 'OPTIONS',
        ...BASE,
        originHeader: null,
        refererHeader: null,
      }),
    ).toBe(true)
  })

  it('allows POST same-origin via Origin header', () => {
    expect(
      isSameOriginRequest({
        method: 'POST',
        ...BASE,
        originHeader: 'https://romeva.com.br',
        refererHeader: null,
      }),
    ).toBe(true)
  })

  it('blocks POST cross-origin via Origin header', () => {
    expect(
      isSameOriginRequest({
        method: 'POST',
        ...BASE,
        originHeader: 'https://evil.example',
        refererHeader: null,
      }),
    ).toBe(false)
  })

  it('blocks POST with Origin null', () => {
    expect(
      isSameOriginRequest({
        method: 'POST',
        ...BASE,
        originHeader: 'null',
        refererHeader: null,
      }),
    ).toBe(false)
  })

  it('allows POST when Origin missing but Referer is same-origin', () => {
    expect(
      isSameOriginRequest({
        method: 'POST',
        ...BASE,
        originHeader: null,
        refererHeader: 'https://romeva.com.br/dashboard',
      }),
    ).toBe(true)
  })

  it('blocks POST when Origin missing and Referer is cross-origin', () => {
    expect(
      isSameOriginRequest({
        method: 'POST',
        ...BASE,
        originHeader: null,
        refererHeader: 'https://evil.example/path',
      }),
    ).toBe(false)
  })

  it('blocks POST when Origin and Referer are both missing', () => {
    expect(
      isSameOriginRequest({
        method: 'POST',
        ...BASE,
        originHeader: null,
        refererHeader: null,
      }),
    ).toBe(false)
  })

  it('blocks lookalike domain attacks', () => {
    expect(
      isSameOriginRequest({
        method: 'POST',
        ...BASE,
        originHeader: 'https://romeva.com.br.attacker.com',
        refererHeader: null,
      }),
    ).toBe(false)
  })

  it('enforces exact localhost origin including port', () => {
    expect(
      isSameOriginRequest({
        method: 'POST',
        pathname: '/api/account',
        expectedOrigin: 'http://localhost:3000',
        originHeader: 'http://localhost:3000',
        refererHeader: null,
      }),
    ).toBe(true)

    expect(
      isSameOriginRequest({
        method: 'POST',
        pathname: '/api/account',
        expectedOrigin: 'http://localhost:3000',
        originHeader: 'http://localhost:3001',
        refererHeader: null,
      }),
    ).toBe(false)
  })
})

describe('origin enforcement exclusions', () => {
  it('excludes webhook, cron, and /api/v1 from enforcement', () => {
    expect(isOriginEnforcementExcluded('/api/whatsapp/webhook')).toBe(true)
    expect(isOriginEnforcementExcluded('/api/automations/cron')).toBe(true)
    expect(isOriginEnforcementExcluded('/api/flows/cron')).toBe(true)
    expect(isOriginEnforcementExcluded('/api/v1/messages')).toBe(true)
  })

  it('enforces mutable browser session API paths', () => {
    expect(shouldEnforceSameOrigin('POST', '/api/account')).toBe(true)
    expect(shouldEnforceSameOrigin('PATCH', '/api/whatsapp/templates/abc')).toBe(
      true,
    )
  })
})
