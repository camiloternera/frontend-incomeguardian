import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { acceptLanguageInterceptor } from './accept-language.interceptor';
import { translocoTesting } from './i18n.testing';
import { LanguageService } from './language.service';

describe('acceptLanguageInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClient(withInterceptors([acceptLanguageInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('sends the active culture to the API', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');

    http.get('https://localhost:7151/api/v1/User').subscribe();

    expect(controller.expectOne('https://localhost:7151/api/v1/User').request.headers.get('Accept-Language')).toBe('es-CO');
  });

  it('leaves requests to other hosts alone', () => {
    http.get('/i18n/en-US.json').subscribe();

    expect(controller.expectOne('/i18n/en-US.json').request.headers.has('Accept-Language')).toBe(false);
  });
});
