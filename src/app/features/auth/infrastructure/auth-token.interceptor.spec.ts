import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@env/environment';
import { provideAuth } from '../auth.providers';
import { SessionStore } from '../domain/session.store';
import { authTokenInterceptor } from './auth-token.interceptor';

const API = `${environment.apiUrl}/api/v1/categories`;

const SESSION = {
  userId: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: '2026-12-01T00:00:00Z',
};

describe('authTokenInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let store: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAuth(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
  });

  it('sends the access token to the API', () => {
    store.save(SESSION);
    http.get(API).subscribe();

    expect(controller.expectOne(API).request.headers.get('Authorization')).toBe('Bearer access-token');
  });

  it('leaves requests alone without a session or outside the API', () => {
    http.get(API).subscribe();
    expect(controller.expectOne(API).request.headers.has('Authorization')).toBe(false);

    store.save(SESSION);
    http.get('https://example.com/data').subscribe();
    expect(controller.expectOne('https://example.com/data').request.headers.has('Authorization')).toBe(false);
  });

  it('drops the session and goes to login on a 401', () => {
    store.save(SESSION);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    http.get(API).subscribe({ error: () => undefined });
    controller.expectOne(API).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(store.read()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.objectContaining({ queryParams: expect.any(Object) }));
  });
});
