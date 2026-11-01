import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { AccountTypeError, AccountTypeErrorCode } from '../../../domain/account-type-error';
import { FakeAccountTypeRepository, fakeAccountTypesRoutes } from '../../account-type-repository.fake';

describe('AccountTypeListPageComponent', () => {
  let fake: FakeAccountTypeRepository;

  async function open(url = '/account-types') {
    const harness = await RouterTestingHarness.create(url);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  function click(element: HTMLElement, testId: string): void {
    element.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
  }

  function names(element: HTMLElement): string[] {
    return [...element.querySelectorAll('[data-testid="account-type-rows"] > li')].map(
      (item) => item.querySelector('a span')?.textContent?.trim() ?? '',
    );
  }

  function search(element: HTMLElement, value: string): void {
    const input = element.querySelector<HTMLInputElement>('[data-testid="account-type-search"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeAccountTypeRepository();
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideRouter(fakeAccountTypesRoutes(fake))],
    }).compileComponents();
  });

  it('lists the account types alphabetically with their actions', async () => {
    const { element } = await open();

    expect(names(element)).toEqual(['Ahorros', 'Tarjeta de crédito']);
    expect(element.querySelector('[data-testid="account-type-1"] a[href="/account-types/1/edit"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="menu-1"]')).toBeTruthy();
  });

  it('puts the create action at the top of the page', async () => {
    const { element } = await open();

    expect(element.querySelector('header [data-testid="new-account-type"]')?.getAttribute('href')).toBe('/account-types/new');
  });

  it('searches ignoring accents and case', async () => {
    const { harness, element } = await open();

    search(element, 'CREDITO');
    harness.detectChanges();
    expect(names(element)).toEqual(['Tarjeta de crédito']);

    search(element, 'nómina');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="no-matches"]')?.textContent).toContain('nómina');
  });

  it('pages five account types at a time', async () => {
    fake.accountTypes.push(
      ...Array.from({ length: 5 }, (_, index) => ({
        id: 100 + index,
        name: `Tipo ${index + 1}`,
        description: 'Generado para el test',
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: null,
      })),
    );
    const { harness, element } = await open();

    expect(names(element)).toHaveLength(5);
    expect(element.querySelector('[data-testid="pagination"]')?.textContent).toContain('Showing 1–5 of 7');

    click(element, 'pagination-next');
    harness.detectChanges();
    expect(names(element)).toHaveLength(2);
  });

  it('asks before deactivating from the menu and confirms afterwards', async () => {
    const { harness, element } = await open();

    click(element, 'menu-1');
    harness.detectChanges();
    click(element, 'deactivate-1');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="deactivate-confirmation"]')?.textContent).toContain('Ahorros');

    click(element, 'confirm-deactivate');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="account-type-1"]')).toBeNull();
    expect(element.querySelector('[data-testid="account-type-notice"]')?.textContent).toContain('Ahorros');
  });

  it('drops an account type the backend no longer has', async () => {
    const { harness, element } = await open();
    fake.failWith = new AccountTypeError('The account type was not found.', AccountTypeErrorCode.NotFound);

    click(element, 'menu-1');
    harness.detectChanges();
    click(element, 'deactivate-1');
    harness.detectChanges();
    click(element, 'confirm-deactivate');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="account-type-1"]')).toBeNull();
    expect(element.querySelector('[data-testid="deactivate-error"]')?.textContent).toContain('The account type was not found.');
  });

  it('shows an empty state when there are none', async () => {
    fake.accountTypes = [];
    const { element } = await open();

    expect(element.querySelector('[data-testid="account-type-empty"]')).toBeTruthy();
  });

  it('shows the load error with a retry', async () => {
    fake.failWith = new AccountTypeError('Server down.');
    const { harness, element } = await open();

    expect(element.querySelector('[data-testid="load-error"]')?.textContent).toContain('Server down.');

    click(element, 'retry');
    harness.detectChanges();

    expect(names(element)).toHaveLength(2);
  });

  it('keeps the list beside the panel and marks the row being edited', async () => {
    const { element } = await open('/account-types/1/edit');

    expect(element.querySelector('[data-testid="account-type-panel"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="account-type-1"] a')?.getAttribute('aria-current')).toBe('true');
  });

  it('translates the view into Spanish', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { element } = await open();

    expect(element.querySelector('h1')?.textContent).toContain('Tipos de cuenta');
    expect(element.textContent).toContain('Nuevo tipo');
  });
});
