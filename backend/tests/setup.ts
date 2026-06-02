import { vi } from 'vitest';

/**
 * Global test setup: make authService.verifyAccessToken accept test token
 * patterns so tests don't need the removed Supabase fallback path.
 *
 * Test tokens end in `.token` (e.g. valid.token, admin.token, hr.token, emp.token)
 * or start with "valid" (e.g. valid.staff.token).
 * These are distinct from real JWTs (3 base64url segments) and from deliberately
 * bad tokens used to test 401 behaviour (bad.token.here, sometoken).
 *
 * The returned user ID `user-1` matches the ID most test suites historically
 * expected from the Supabase mock (data: { user: { id: "user-1" } }).
 */
vi.mock('../src/modules/auth/auth.service.js', async (importOriginal) => {
  const mod = await importOriginal<{ authService: Record<string, unknown> }>();
  return {
    authService: {
      ...mod.authService,
      verifyAccessToken: vi.fn((token: string) => {
        if (typeof token === 'string' && (token.endsWith('.token') || token.startsWith('valid'))) {
          return { id: 'user-1', email: 'test@mascallnet.com' };
        }
        return null;
      }),
    },
  };
});
