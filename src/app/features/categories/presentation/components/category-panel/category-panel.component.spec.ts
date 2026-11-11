import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { Category } from '../../../domain/category';
import { CategoryError, CategoryErrorCode } from '../../../domain/category-error';
import { FakeCategoryRepository, fakeCategoriesRoutes } from '../../category-repository.fake';

const SYSTEM_CATEGORY: Category = { id: 30, name: 'Pago tarjeta', description: 'Pagos de tus tarjetas', type: 'transfer', isActive: true, hasTransactions: false, code: 'CARD_PAYMENT', createdAt: '2026-10-01T00:00:00Z', updatedAt: null };

describe('CategoryPanelComponent', () => {
  let fake: FakeCategoryRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeCategoryRepository();
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter(fakeCategoriesRoutes(fake))
      ],
    }).compileComponents();
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create(url);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  function panel(element: HTMLElement): HTMLElement {
    return element.querySelector('[data-testid="category-panel"]')!;
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
    const { harness, element } = await open('/categories/new');

    type(element, 'category-name', 'x'.repeat(21));
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain('The name can be up to 20 characters.');
    expect(element.querySelector('[data-testid="description-error"]')?.textContent).toContain('Enter a description');
    expect(fake.lastDraft).toBeNull();
  });

  it('creates a trimmed category and closes', async () => {
    const { harness, element } = await open('/categories/new');

    type(element, 'category-name', '  Viajes ');
    type(element, 'category-description', 'Vuelos y hoteles');
    submit(element);
    await harness.fixture.whenStable();

    // Sin elegir, propone el tipo de la pestaña visible (gastos).
    expect(fake.lastDraft).toEqual({ name: 'Viajes', description: 'Vuelos y hoteles', type: 'expense' });
    expect(TestBed.inject(Router).url).toBe('/categories');
  });

  it('creates the category with the chosen type and shows its tab', async () => {
    const { harness, element } = await open('/categories/new');

    element.querySelector<HTMLInputElement>('[data-testid="category-type-income"]')!.click();
    type(element, 'category-name', 'Bonos');
    type(element, 'category-description', 'Primas y bonificaciones');
    submit(element);
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(fake.lastDraft).toEqual({ name: 'Bonos', description: 'Primas y bonificaciones', type: 'income' });
    expect(element.querySelector('[data-testid="tab-income"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('proposes the type that comes in the link', async () => {
    const { element } = await open('/categories/new?type=transfer');

    expect(element.querySelector<HTMLInputElement>('[data-testid="category-type-transfer"]')?.checked).toBe(true);
    expect(element.querySelector('[data-testid="tab-transfer"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the type as read-only when editing and does not send it', async () => {
    const { harness, element } = await open('/categories/9/edit');

    expect(element.querySelector('[data-testid="category-type-readonly"]')?.textContent).toContain('Expense');
    expect(element.querySelector('[data-testid="category-type-expense"]')).toBeNull();

    type(element, 'category-name', 'Mascota');
    submit(element);
    await harness.fixture.whenStable();

    expect(fake.lastDraft).toEqual({ name: 'Mascota', description: 'Comida y veterinario' });
  });

  it('shows a type error from the backend beside the type field', async () => {
    const { harness, element } = await open('/categories/new');
    fake.failWith = new CategoryError('Choose the transaction type.', CategoryErrorCode.TransactionTypeRequired);

    type(element, 'category-name', 'Viajes');
    type(element, 'category-description', 'Vuelos');
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="type-error"]')?.textContent).toContain('Choose the transaction type for the category.');
    expect(element.querySelector('[data-testid="form-error"]')).toBeNull();
  });

  it('shows a taken name beside the name field until it changes', async () => {
    const { harness, element } = await open('/categories/new');
    fake.failWith = new CategoryError('A category with that name already exists.', CategoryErrorCode.NameAlreadyExists);

    type(element, 'category-name', 'Vivienda');
    type(element, 'category-description', 'Otra');
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain('A category with that name already exists.');
    expect(element.querySelector('[data-testid="form-error"]')).toBeNull();

    type(element, 'category-name', 'Vivienda 2');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="name-error"]')).toBeNull();
  });

  it('keeps unknown failures at form level', async () => {
    const { harness, element } = await open('/categories/new');
    fake.failWith = new CategoryError('Something new happened.');

    type(element, 'category-name', 'Viajes');
    type(element, 'category-description', 'Vuelos');
    submit(element);
    harness.detectChanges();

    expect(element.querySelector('[data-testid="form-error"]')?.textContent).toContain('Something new happened.');
  });

  it('loads the category to edit and focuses the panel title', async () => {
    const { element } = await open('/categories/9/edit');

    expect(panel(element).querySelector('h2')?.textContent).toContain('Edit category');
    expect(element.querySelector<HTMLInputElement>('[data-testid="category-name"]')?.value).toBe('Mascotas');
    expect(document.activeElement?.id).toBe('category-panel-title');
  });

  it('switches to another category without closing', async () => {
    fake.categories.push({ id: 10, name: 'Coworking', description: 'Escritorio', type: 'expense', isActive: true, hasTransactions: false, code: null, createdAt: '2026-10-02T00:00:00Z', updatedAt: null });
    const { harness, element } = await open('/categories/9/edit');

    await harness.navigateByUrl('/categories/10/edit');

    expect(element.querySelector<HTMLInputElement>('[data-testid="category-name"]')?.value).toBe('Coworking');
  });

  it('deactivates from the panel after confirming', async () => {
    const { harness, element } = await open('/categories/9/edit');

    element.querySelector<HTMLButtonElement>('[data-testid="panel-deactivate"]')!.click();
    harness.detectChanges();
    expect(element.querySelector('[data-testid="panel-deactivate-confirmation"]')?.textContent).toContain('Deactivate “Mascotas”?');

    element.querySelector<HTMLButtonElement>('[data-testid="panel-confirm-deactivate"]')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/categories');
    expect(fake.categories.find((category) => category.id === 9)?.isActive).toBe(false);
    expect(element.querySelector('[data-testid="category-9"]')).toBeNull();
    expect(element.querySelector('[data-testid="category-notice"]')?.textContent).toContain('You deactivated the “Mascotas” category.');
  });

  it('opens a deactivated category read-only and reactivates it', async () => {
    const { harness, element } = await open('/categories/6/edit');

    expect(panel(element).querySelector('h2')?.textContent).toContain('Gimnasio');
    expect(element.querySelector('[data-testid="category-read-only"]')?.textContent).toContain('This category is deactivated');
    expect(panel(element).querySelector('form')).toBeNull();

    element.querySelector<HTMLButtonElement>('[data-testid="panel-activate"]')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/categories');
    expect(fake.categories.find((category) => category.id === 6)?.isActive).toBe(true);
    expect(element.querySelector('[data-testid="category-notice"]')?.textContent).toContain('You reactivated the “Gimnasio” category.');
  });

  it('closes with Escape only while nothing has changed', async () => {
    const { harness, element } = await open('/categories/9/edit');
    const escape = () => panel(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    type(element, 'category-name', 'Mascotas 2');
    escape();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/categories/9/edit');

    await harness.navigateByUrl('/categories/new');
    escape();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/categories');
  });

  it('explains when the category does not exist', async () => {
    const { element } = await open('/categories/404/edit');

    expect(panel(element).querySelector('h2')?.textContent).toContain('Category unavailable');
    expect(element.querySelector('[data-testid="category-not-found"]')).toBeTruthy();
  });

  describe('a category with transactions', () => {
    function nameField(element: HTMLElement): HTMLInputElement {
      return element.querySelector<HTMLInputElement>('[data-testid="category-name"]')!;
    }

    function expectNameEditable(element: HTMLElement): void {
      expect(nameField(element).disabled).toBe(false);
      expect(element.querySelector('[data-testid="name-locked"]')).toBeNull();
      expect(element.querySelector('#category-name-hint')?.textContent).not.toContain('already has transactions');
    }

    it('locks the name, explains why and keeps the description editable', async () => {
      const { element } = await open('/categories/1/edit');

      expect(nameField(element).disabled).toBe(true);
      expect(nameField(element).value).toBe('Vivienda');
      expect(element.querySelector('[data-testid="name-locked"]')?.textContent?.trim()).toBe(
        'This category already has transactions, so its name cannot change.',
      );
      expect(element.querySelector<HTMLTextAreaElement>('[data-testid="category-description"]')!.disabled).toBe(false);
    });

    it('explains the lock in Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = await open('/categories/1/edit');

      expect(element.querySelector('[data-testid="name-locked"]')?.textContent?.trim()).toBe(
        'Esta categoría ya tiene movimientos: su nombre no se puede cambiar.',
      );
    });

    it('sends the same name with the new description', async () => {
      const { harness, element } = await open('/categories/1/edit');

      type(element, 'category-description', 'Arriendo y administración');
      submit(element);
      await harness.fixture.whenStable();

      expect(fake.lastDraft).toEqual({ name: 'Vivienda', description: 'Arriendo y administración' });
      expect(TestBed.inject(Router).url).toBe('/categories');
    });

    it('leaves a category without transactions editable', async () => {
      const { element } = await open('/categories/9/edit');

      expectNameEditable(element);
    });

    it('unlocks the name when switching to a category without transactions', async () => {
      const { harness, element } = await open('/categories/1/edit');

      await harness.navigateByUrl('/categories/9/edit');

      expectNameEditable(element);
      expect(nameField(element).value).toBe('Mascotas');
    });

    it('unlocks the name when creating a category after editing a locked one', async () => {
      const { harness, element } = await open('/categories/1/edit');

      await harness.navigateByUrl('/categories/new');

      expectNameEditable(element);
      expect(nameField(element).value).toBe('');
    });

    it('shows a locked name from the backend beside the name field', async () => {
      const { harness, element } = await open('/categories/9/edit');
      fake.failWith = new CategoryError('The category already has transactions.', CategoryErrorCode.NameLocked);

      type(element, 'category-name', 'Mascota');
      submit(element);
      harness.detectChanges();

      expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain(
        'The category already has transactions, so its name cannot change.',
      );
      expect(element.querySelector('[data-testid="form-error"]')).toBeNull();
    });
  });
  describe('a system category', () => {
    beforeEach(() => {
      fake.categories.push(SYSTEM_CATEGORY);
    });

    it('locks the name, explains why and keeps the description editable', async () => {
      const { element } = await open('/categories/30/edit');

      expect(element.querySelector<HTMLInputElement>('[data-testid="category-name"]')!.disabled).toBe(true);
      expect(element.querySelector('#category-name-hint')?.textContent?.trim()).toBe(
        "This is a system category for card payments: it can't be renamed or deactivated. You can change its description.",
      );
      expect(element.querySelector<HTMLTextAreaElement>('[data-testid="category-description"]')!.disabled).toBe(false);
    });

    it('explains the lock in Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { element } = await open('/categories/30/edit');

      expect(element.querySelector('#category-name-hint')?.textContent?.trim()).toBe(
        'Es una categoría del sistema, para los pagos de tarjeta: no se puede renombrar ni desactivar. Puedes cambiar su descripción.',
      );
    });

    it('does not offer to deactivate it', async () => {
      const { element } = await open('/categories/30/edit');

      expect(element.querySelector('[data-testid="panel-deactivate"]')).toBeNull();
    });

    it('saves the new description with the same name', async () => {
      const { harness, element } = await open('/categories/30/edit');

      type(element, 'category-description', 'Abonos a las tarjetas');
      submit(element);
      await harness.fixture.whenStable();

      expect(fake.lastDraft).toEqual({ name: 'Pago tarjeta', description: 'Abonos a las tarjetas' });
    });

    it('shows CATEGORY_SYSTEM_LOCKED from the backend', async () => {
      const { harness, element } = await open('/categories/30/edit');
      fake.failWith = new CategoryError(
        "This is a system category: it can't be renamed, deactivated or deleted.",
        CategoryErrorCode.SystemLocked,
      );

      type(element, 'category-description', 'Otra');
      submit(element);
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(panel(element).textContent).toContain("This is a system category: it can't be renamed, deactivated or deleted.");
    });

    it('unlocks the name when switching to a user category', async () => {
      const { harness, element } = await open('/categories/30/edit');

      await harness.navigateByUrl('/categories/9/edit');

      expect(element.querySelector<HTMLInputElement>('[data-testid="category-name"]')!.disabled).toBe(false);
      expect(element.querySelector('[data-testid="panel-deactivate"]')).toBeTruthy();
    });
  });
});
