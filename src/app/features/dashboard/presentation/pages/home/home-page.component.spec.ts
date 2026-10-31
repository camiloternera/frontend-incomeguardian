import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { provideAuth } from '@features/auth/auth.providers';
import { HomePageComponent } from './home-page.component';
import { provideDashboard } from '../../../dashboard.providers';

function render() {
  const fixture = TestBed.createComponent(HomePageComponent);
  fixture.detectChanges();

  return fixture;
}

describe('HomePageComponent', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HomePageComponent, translocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAuth(),
        provideDashboard(),
      ],
    }).compileComponents();
  });

  it('shows the four headline numbers', () => {
    const element = render().nativeElement as HTMLElement;

    for (const key of ['balance', 'income', 'expenses', 'savingsRate']) {
      expect(element.querySelector(`[data-testid="kpi-${key}"]`)).toBeTruthy();
    }

    expect(element.querySelector('[data-testid="kpi-savingsRate"]')?.textContent).toContain('30.7');
  });

  it('keeps the accent off a rise in spending', () => {
    const element = render().nativeElement as HTMLElement;
    const tile = element.querySelector('[data-testid="kpi-expenses"]')?.closest('article');
    const income = element.querySelector('[data-testid="kpi-income"]')?.closest('article');

    // Earning more is the welcome direction; spending more is not.
    expect(income?.querySelector('.text-ig-accent-text')).toBeTruthy();
    expect(tile?.querySelector('.text-ig-accent-text')).toBeNull();
  });

  it('lists the recent movements and the category split', () => {
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelectorAll('tbody tr').length).toBe(6);
    expect(element.querySelectorAll('section ul li').length).toBeGreaterThanOrEqual(5);
  });

  it('draws a pair of bars per month', () => {
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelectorAll('app-cash-flow-chart svg rect').length).toBe(12);
  });

  it('marks every section that is not built yet', () => {
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelectorAll('nav li').length).toBe(7);
    expect(element.querySelector('[aria-current="page"]')?.textContent).toContain('Overview');
    expect(element.querySelectorAll('nav li small').length).toBe(5);
  });

  it('links to the categories section', () => {
    const element = render().nativeElement as HTMLElement;
    const link = element.querySelector<HTMLAnchorElement>('nav a[href="/categories"]');

    expect(link?.textContent).toContain('Categories');
  });

  it('translates the view into Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Resumen');
    expect(element.textContent).toContain('Flujo de caja');
    expect(element.textContent).toContain('Vivienda');
  });
});
