import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from './i18n.testing';
import { LanguageService, languageFromBrowser } from './language.service';

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
  });

  it('maps any Spanish browser locale to es-CO and the rest to en-US', () => {
    expect(languageFromBrowser('es')).toBe('es-CO');
    expect(languageFromBrowser('es-MX')).toBe('es-CO');
    expect(languageFromBrowser('en-GB')).toBe('en-US');
    expect(languageFromBrowser('fr-FR')).toBe('en-US');
    expect(languageFromBrowser(undefined)).toBe('en-US');
  });

  it('prefers the stored language over the browser one', () => {
    localStorage.setItem('income-guardian.language', 'es-CO');

    expect(TestBed.inject(LanguageService).language()).toBe('es-CO');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('es-CO');
  });

  it('ignores a stored value that is not a supported language', () => {
    localStorage.setItem('income-guardian.language', 'fr-FR');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('es-CO');

    expect(TestBed.inject(LanguageService).language()).toBe('es-CO');
  });

  it('applies, announces and remembers a new language', () => {
    const service = TestBed.inject(LanguageService);

    service.setLanguage('es-CO');
    TestBed.tick();

    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('es-CO');
    expect(document.documentElement.lang).toBe('es-CO');
    expect(localStorage.getItem('income-guardian.language')).toBe('es-CO');
  });
});
