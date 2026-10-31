import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PreferencesError } from '../../../domain/preferences-error';
import { FakePreferencesRepository, provideFakeSettings } from '../../preferences-repository.fake';
import { SettingsPageComponent } from './settings-page.component';

describe('SettingsPageComponent', () => {
  let fake: FakePreferencesRepository;

  function render() {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();

    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function choose(element: HTMLElement, testId: string): void {
    element.querySelector<HTMLInputElement>(`[data-testid="${testId}"] input`)!.click();
  }

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakePreferencesRepository();
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent, translocoTesting()],
      providers: [provideRouter([]), provideFakeSettings(fake)],
    }).compileComponents();
  });

  it('applies the preferences stored in the account', () => {
    const { element } = render();

    expect(TestBed.inject(ThemeService).theme()).toBe('noir');
    expect(TestBed.inject(LanguageService).language()).toBe('en-US');
    expect(element.querySelector<HTMLInputElement>('[data-testid="theme-noir"] input')!.checked).toBe(true);
  });

  it('saves a new theme and confirms it', () => {
    const { fixture, element } = render();

    choose(element, 'theme-paper');
    fixture.detectChanges();

    expect(fake.saved).toEqual([{ theme: 'paper', language: 'en-US' }]);
    expect(TestBed.inject(ThemeService).theme()).toBe('paper');
    expect(element.querySelector('[data-testid="settings-page"]')!.getAttribute('data-theme')).toBe('paper');
    expect(element.querySelector('[data-testid="save-status"]')?.textContent).toContain('Saved to your account');
  });

  it('switches the whole view to the chosen language', () => {
    const { fixture, element } = render();

    choose(element, 'language-es-CO');
    TestBed.tick();
    fixture.detectChanges();

    expect(fake.saved).toEqual([{ theme: 'noir', language: 'es-CO' }]);
    expect(element.querySelector('h1')?.textContent).toContain('Ajustes');
    expect(element.querySelector('[data-testid="save-status"]')?.textContent).toContain('Guardado en tu cuenta');
  });

  it('goes back to the previous theme when saving fails', () => {
    const { fixture, element } = render();
    fake.failWith = new PreferencesError('Could not save.');

    choose(element, 'theme-forest');
    fixture.detectChanges();

    expect(TestBed.inject(ThemeService).theme()).toBe('noir');
    expect(element.querySelector<HTMLInputElement>('[data-testid="theme-noir"] input')!.checked).toBe(true);
    expect(element.querySelector('[data-testid="save-error"]')?.textContent).toContain('Could not save.');
  });

  it('offers a retry when the account preferences cannot be read', () => {
    fake.failWith = new PreferencesError('Server down.');
    const { fixture, element } = render();

    expect(element.querySelector('[data-testid="load-error"]')?.textContent).toContain('Server down.');

    element.querySelector<HTMLButtonElement>('[data-testid="load-error"] + button')!.click();
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="load-error"]')).toBeNull();
    expect(TestBed.inject(ThemeService).theme()).toBe('noir');
  });
});
