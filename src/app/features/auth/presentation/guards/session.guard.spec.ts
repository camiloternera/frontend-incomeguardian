import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthSession } from '../../domain/auth-session';
import { provideAuth } from '../../auth.providers';
import { sessionGuard } from './session.guard';

const SESSION: AuthSession = {
  userId: 'user-1',
  email: 'camilo@example.com',
  name: 'Camilo Ternera',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: '2026-12-31T12:00:00Z',
};

function run(url: string) {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url } as RouterStateSnapshot;

  return TestBed.runInInjectionContext(() => sessionGuard(route, state));
}

describe('sessionGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideAuth()] });
  });

  it('lets a stored session through', () => {
    sessionStorage.setItem('income-guardian.session', JSON.stringify(SESSION));

    expect(run('/home')).toBe(true);
  });

  it('sends everyone else to sign in, remembering where they were going', () => {
    const result = run('/home');

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login?returnUrl=%2Fhome');
  });
});
