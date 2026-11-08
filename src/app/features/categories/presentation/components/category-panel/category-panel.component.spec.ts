import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { CategoryError, CategoryErrorCode } from '../../../domain/category-error';
import { FakeCategoryRepository, fakeCategoriesRoutes } from '../../category-repository.fake';

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
    fake.categories.push({ id: 10, name: 'Coworking', description: 'Escritorio', type: 'expense', createdAt: '2026-10-02T00:00:00Z', updatedAt: null });
    const { harness, element } = await open('/categories/9/edit');

    await harness.navigateByUrl('/categories/10/edit');

    expect(element.querySelector<HTMLInputElement>('[data-testid="category-name"]')?.value).toBe('Coworking');
  });

  it('deletes from the panel after confirming', async () => {
    const { harness, element } = await open('/categories/9/edit');

    element.querySelector<HTMLButtonElement>('[data-testid="panel-delete"]')!.click();
    harness.detectChanges();
    expect(element.querySelector('[data-testid="panel-delete-confirmation"]')?.textContent).toContain('Delete “Mascotas”?');

    element.querySelector<HTMLButtonElement>('[data-testid="panel-confirm-delete"]')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/categories');
    expect(element.querySelector('[data-testid="category-9"]')).toBeNull();
    expect(element.querySelector('[data-testid="category-notice"]')?.textContent).toContain('You deleted the “Mascotas” category.');
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
});
