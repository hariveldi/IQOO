import { describe, it, expect } from 'vitest'

describe('Authentication response contract', () => {
  it('accepts the real API envelope used by login/register responses', () => {
    const authResponse: any = {
      success: true,
      data: {
        user: {
          id: 'user_123',
          email: 'demo@example.com',
          name: 'Demo User',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    }

    const payload: any = authResponse?.data ?? authResponse
    const accessToken = payload?.data?.accessToken ?? payload?.accessToken
    const refreshToken = payload?.data?.refreshToken ?? payload?.refreshToken
    const user = payload?.data?.user ?? payload?.user

    expect(accessToken).toBe('access-token')
    expect(refreshToken).toBe('refresh-token')
    expect(user.email).toBe('demo@example.com')
  })

  it('accepts the profile response shape', () => {
    const profileResponse: any = {
      success: true,
      data: {
        user: {
          id: 'user_123',
          email: 'demo@example.com',
          name: 'Demo User',
        },
      },
    }

    const profileUser = profileResponse?.data?.data?.user ?? profileResponse?.data?.user ?? null
    expect(profileUser.email).toBe('demo@example.com')
  })
})
