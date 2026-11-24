import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { provideAuth } from '@features/auth/auth.providers';
import { LogoutUseCase } from '@features/auth/application/logout.use-case';
import { AuthRepository } from '@features/auth/domain/auth.repository';
import { SessionStore } from '@features/auth/domain/session.store';
import { FakePeriodRepository, periodYear, provideFakePeriods } from './period-repository.fake';
import { PeriodWorkspace } from './period-workspace';

@Component({ selector: 'review-period-session', template: '' })
class PeriodSessionProbe {
  readonly workspace = inject(PeriodWorkspace);
  constructor() {
    this.workspace.loadYear(2026);
    this.workspace.loadPending();
  }
}

@Component({ selector: 'review-login', template: '' })
class LoginProbe {}

describe('Period session review', () => {
  it('review B6: reloads route-scoped periods after logging out and in as another user', async () => {
    localStorage.clear();
    sessionStorage.clear();
    const fake = new FakePeriodRepository();
    fake.years[2026] = periodYear(2026, Array(12).fill('closed'));
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideAuth(),
        { provide: AuthRepository, useValue: { logout: () => of(undefined) } },
        provideRouter([
          { path: 'summary', component: PeriodSessionProbe, providers: provideFakePeriods(fake) },
          { path: 'login', component: LoginProbe },
        ]),
      ],
    }).compileComponents();
    const store = TestBed.inject(SessionStore);
    const session = {
      userId: 'A', name: 'User A', email: 'a@example.com',
      accessToken: 'a', refreshToken: 'ra', expiresAt: '2026-12-01T00:00:00Z',
    };
    store.save(session);
    const harness = await RouterTestingHarness.create();
    const first = await harness.navigateByUrl('/summary', PeriodSessionProbe);
    expect(fake.count('year 2026')).toBe(1);
    TestBed.inject(LogoutUseCase).execute().subscribe();
    expect(store.read()).toBeNull();
    await harness.navigateByUrl('/login');
    fake.years[2026] = periodYear(2026, Array(12).fill('pending'));
    store.save({ ...session, userId: 'B', accessToken: 'b' });
    const second = await harness.navigateByUrl('/summary', PeriodSessionProbe);
    await harness.fixture.whenStable();

    // Verify the router lifecycle assumption independently of the desired behavior.
    expect(second).not.toBe(first);
    expect({
      yearRequests: fake.count('year 2026'),
      pendingRequests: fake.count('pending'),
      year: second.workspace.years()[2026],
    }).toEqual({
      yearRequests: 2,
      pendingRequests: 2,
      year: { status: 'ready', data: fake.years[2026] },
    });
  });
});
