import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { AccountTypeError, AccountTypeErrorCode } from '../../../domain/account-type-error';
import { FakeAccountTypeRepository, provideFakeAccountTypes } from '../../account-type-repository.fake';
import { AccountTypeFormPageComponent } from './account-type-form-page.component';

describe('AccountTypeFormPageComponent', () => {
  let fake: FakeAccountTypeRepository;

  async function setup(id: string | null) {
    localStorage.clear();
    fake = new FakeAccountTypeRepository();
    await TestBed.configureTestingModule({
      imports: [AccountTypeFormPageComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        provideFakeAccountTypes(fake),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AccountTypeFormPageComponent);
    fixture.detectChanges();

    return { fixture, element: fixture.nativeElement as HTMLElement };
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
    const { fixture, element } = await setup(null);

    type(element, 'account-type-name', 'x'.repeat(31));
    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain('The name can be up to 30 characters.');
    expect(element.querySelector('[data-testid="description-error"]')?.textContent).toContain('Enter a description');
    expect(fake.lastDraft).toBeNull();
  });

  it('accepts a 30-character name such as a long card name', async () => {
    const { fixture, element } = await setup(null);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    type(element, 'account-type-name', 'x'.repeat(30));
    type(element, 'account-type-description', 'Cupo rotativo');
    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')).toBeNull();
    expect(fake.lastDraft?.name).toHaveLength(30);
  });

  it('creates a trimmed account type and returns to the list with a notice', async () => {
    const { fixture, element } = await setup(null);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    type(element, 'account-type-name', '  Billetera digital ');
    type(element, 'account-type-description', ' Nequi y Daviplata ');
    submit(element);
    fixture.detectChanges();

    expect(fake.lastDraft).toEqual({ name: 'Billetera digital', description: 'Nequi y Daviplata' });
    expect(navigate).toHaveBeenCalledWith(['/account-types'], {
      state: { notice: { kind: 'created', name: 'Billetera digital' } },
    });
  });

  it('shows a taken name beside the name field until it changes', async () => {
    const { fixture, element } = await setup(null);
    fake.failWith = new AccountTypeError('You already have an account type with that name.', AccountTypeErrorCode.NameAlreadyExists);

    type(element, 'account-type-name', 'Ahorros');
    type(element, 'account-type-description', 'Otra');
    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain('You already have an account type with that name.');
    expect(element.querySelector('[data-testid="form-error"]')).toBeNull();

    type(element, 'account-type-name', 'Ahorros 2');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="name-error"]')).toBeNull();
  });

  it('keeps unknown failures at form level', async () => {
    const { fixture, element } = await setup(null);
    fake.failWith = new AccountTypeError('Something new happened.');

    type(element, 'account-type-name', 'Ahorros');
    type(element, 'account-type-description', 'Banco');
    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="form-error"]')?.textContent).toContain('Something new happened.');
  });

  it('loads the account type to edit and saves the changes', async () => {
    const { fixture, element } = await setup('3');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    expect(element.querySelector('h1')?.textContent).toContain('Edit account type');
    expect(element.querySelector<HTMLInputElement>('[data-testid="account-type-name"]')?.value).toBe('Tarjeta de crédito');

    type(element, 'account-type-description', 'Visa y Mastercard');
    submit(element);
    fixture.detectChanges();

    expect(fake.lastDraft).toEqual({ name: 'Tarjeta de crédito', description: 'Visa y Mastercard' });
    expect(navigate).toHaveBeenCalledWith(['/account-types'], {
      state: { notice: { kind: 'updated', name: 'Tarjeta de crédito' } },
    });
  });

  it('explains when the account type does not exist', async () => {
    const { element } = await setup('404');

    expect(element.querySelector('[data-testid="account-type-not-found"]')?.textContent).toContain('Account type unavailable');
    expect(element.querySelector('form')).toBeNull();
  });

  it('translates the view into Spanish', async () => {
    const { fixture, element } = await setup(null);
    TestBed.inject(LanguageService).setLanguage('es-CO');
    TestBed.tick();
    fixture.detectChanges();

    expect(element.querySelector('h1')?.textContent).toContain('Nuevo tipo de cuenta');
    expect(element.querySelector('[data-testid="account-type-submit"]')?.textContent).toContain('Crear tipo');
  });
});
