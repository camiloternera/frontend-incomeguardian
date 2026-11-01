import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { AccountTypeError, AccountTypeErrorCode } from '../../../domain/account-type-error';
import { FakeAccountTypeRepository, fakeAccountTypesRoutes } from '../../account-type-repository.fake';

describe('AccountTypePanelComponent', () => {
  let fake: FakeAccountTypeRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeAccountTypeRepository();
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter(fakeAccountTypesRoutes(fake))],
    }).compileComponents();
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create(url);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  function panel(element: HTMLElement): HTMLElement {
    return element.querySelector('[data-testid="account-type-panel"]')!;
  }

  function type(element: HTMLElement, testId: string, value: string): void {
    const field = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-testid="${testId}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
  }

  function submit(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  it('validates both fields locally with the backend copy', async () => {
    const { harness, element } = await open('/account-types/new');

    type(element, 'account-type-name', 'x'.repeat(31));
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain('The name can be up to 30 characters.');
    expect(element.querySelector('[data-testid="description-error"]')?.textContent).toContain('Enter a description');
    expect(fake.lastDraft).toBeNull();
  });

  it('creates a trimmed account type and closes', async () => {
    const { harness, element } = await open('/account-types/new');

    type(element, 'account-type-name', '  Nómina ');
    type(element, 'account-type-description', 'Vuelos y hoteles');
    submit(element);
    await harness.fixture.whenStable();

    expect(fake.lastDraft).toEqual({ name: 'Nómina', description: 'Vuelos y hoteles' });
    expect(TestBed.inject(Router).url).toBe('/account-types');
  });

  it('shows a taken name beside the name field until it changes', async () => {
    const { harness, element } = await open('/account-types/new');
    fake.failWith = new AccountTypeError('You already have an account type with that name.', AccountTypeErrorCode.NameAlreadyExists);

    type(element, 'account-type-name', 'Ahorros');
    type(element, 'account-type-description', 'Otra');
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain('You already have an account type with that name.');
    expect(element.querySelector('[data-testid="form-error"]')).toBeNull();

    type(element, 'account-type-name', 'Ahorros 2');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="name-error"]')).toBeNull();
  });

  it('keeps unknown failures at form level', async () => {
    const { harness, element } = await open('/account-types/new');
    fake.failWith = new AccountTypeError('Something new happened.');

    type(element, 'account-type-name', 'Viajes');
    type(element, 'account-type-description', 'Vuelos');
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="form-error"]')?.textContent).toContain('Something new happened.');
  });

  it('loads the account type to edit and focuses the panel title', async () => {
    const { element } = await open('/account-types/1/edit');

    expect(panel(element).querySelector('h2')?.textContent).toContain('Edit account type');
    expect(element.querySelector<HTMLInputElement>('[data-testid="account-type-name"]')?.value).toBe('Ahorros');
    expect(document.activeElement?.id).toBe('account-type-panel-title');
  });

  it('switches to another account type without closing', async () => {
    fake.accountTypes.push({ id: 10, name: 'Nequi', description: 'Billetera digital', createdAt: '2026-10-02T00:00:00Z', updatedAt: null });
    const { harness, element } = await open('/account-types/1/edit');

    await harness.navigateByUrl('/account-types/10/edit');

    expect(element.querySelector<HTMLInputElement>('[data-testid="account-type-name"]')?.value).toBe('Nequi');
  });

  it('deactivates from the panel after confirming', async () => {
    const { harness, element } = await open('/account-types/1/edit');

    element.querySelector<HTMLButtonElement>('[data-testid="panel-deactivate"]')!.click();
    harness.detectChanges();
    expect(element.querySelector('[data-testid="panel-deactivate-confirmation"]')?.textContent).toContain('Deactivate “Ahorros”?');

    element.querySelector<HTMLButtonElement>('[data-testid="panel-confirm-deactivate"]')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/account-types');
    expect(element.querySelector('[data-testid="account-type-1"]')).toBeNull();
    expect(element.querySelector('[data-testid="account-type-notice"]')?.textContent).toContain('You deactivated the “Ahorros” account type.');
  });

  it('closes with Escape only while nothing has changed', async () => {
    const { harness, element } = await open('/account-types/1/edit');
    const escape = () => panel(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    type(element, 'account-type-name', 'Ahorros 2');
    escape();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/account-types/1/edit');

    await harness.navigateByUrl('/account-types/new');
    escape();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/account-types');
  });

  it('explains when the account type does not exist', async () => {
    const { element } = await open('/account-types/404/edit');

    expect(panel(element).querySelector('h2')?.textContent).toContain('Account type unavailable');
    expect(element.querySelector('[data-testid="account-type-not-found"]')).toBeTruthy();
  });
});
