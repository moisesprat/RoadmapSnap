import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, createApiClient, isoToLiteDate } from './client'

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws ApiError when fetch returns a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      })
    )

    // Client validates JWT shape (three segments) before fetch; use a dummy JWT-shaped string.
    const client = createApiClient(() => Promise.resolve('header.payload.signature'))

    await expect(client.getWorkspaces()).rejects.toThrow(ApiError)
    await expect(client.getWorkspaces()).rejects.toMatchObject({
      status: 403,
      message: 'Forbidden',
    })
  })
})

describe('isoToLiteDate', () => {
  it.each([
    ['2026-03-31', '31/03/2026'],
    ['2024-02-29', '29/02/2024'],
    ['2026-12-31', '31/12/2026'],
    [null, ''],
    [undefined, ''],
    ['', ''],
  ])('maps %s to %s', (input, expected) => {
    expect(isoToLiteDate(input)).toBe(expected)
  })

  it('returns non-ISO strings unchanged so unexpected values stay visible', () => {
    expect(isoToLiteDate('31/03/2026')).toBe('31/03/2026')
    expect(isoToLiteDate('garbage')).toBe('garbage')
  })
})

describe('getWorkspaceProjects', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('converts ISO milestone strings to Lite DD/MM/YYYY and null to an empty string', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          workspace: { id: 'w1', name: 'WS', slug: 'ws' },
          projects: [
            {
              id: 'p1',
              name: 'Project',
              milestones: { START: '2026-03-31', END: null },
            },
          ],
        }),
      })
    )

    const client = createApiClient(() => Promise.resolve('header.payload.signature'))
    const result = await client.getWorkspaceProjects('w1')

    expect(result.projects[0].milestones).toEqual({ START: '31/03/2026', END: '' })
  })
})
