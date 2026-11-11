import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { Category } from '../../../domain/category';
import { CategoryError, CategoryErrorCode } from '../../../domain/category-error';
import { FakeCategoryRepository, fakeCategoriesRoutes } from '../../category-repository.fake';

const SYSTEM_CATEGORY: Category = { id: 30, name: 'Pago tarjeta', description: 'Pagos de tus tarjetas', type: 'transfer', isActive: true, hasTransactions: false, code: 'CARD_PAYMENT', createdAt: '2026-10-01T00:00:00Z', updatedAt: null };

describe('CategoryListPageComponent', () => {
  let fake: FakeCategoryRepository;

  async function open(url = '/categories') {
    const harness = await RouterTestingHarness.create(url);
    const element = harness.routeNativeElement as HTMLElement;

    return { harness, element };
  }

  function click(element: HTMLElement, testId: string): void {
    element.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
  }

  function names(element: HTMLElement, section: 'category-rows'): string[] {
    return [...element.querySelectorAll(`[data-testid="${section}"] > li`)].map(
      (item) => item.querySelector('a span, p')?.textContent?.trim() ?? '',
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeCategoryRepository();
    fake.categories.push(
      { id: 2, name: 'Alimentación', description: 'Mercado y comidas fuera', type: 'expense', isActive: true, hasTransactions: false, code: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: null },
      { id: 10, name: 'Coworking', description: 'Escritorio y café', type: 'transfer', isActive: true, hasTransactions: false, code: null, createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z' },
    );
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter(fakeCategoriesRoutes(fake))
      ],
    }).compileComponents();
  });

  it('groups the categories in one tab per transaction type, starting with expenses', async () => {
    const { harness, element } = await open();

    expect(names(element, 'category-rows')).toEqual(['Alimentación', 'Mascotas', 'Vivienda']);
    expect(element.querySelector('[data-testid="tab-expense"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('[data-testid="tab-income"]')?.textContent).toContain('1');
    expect(element.querySelector('[data-testid="tab-transfer"]')?.textContent).toContain('1');

    click(element, 'tab-income');
    harness.detectChanges();
    expect(names(element, 'category-rows')).toEqual(['Salario']);

    click(element, 'tab-transfer');
    harness.detectChanges();
    expect(names(element, 'category-rows')).toEqual(['Coworking']);
  });

  it('lists the deactivated categories in their own tab, ordered by type, and reactivates them', async () => {
    fake.categories.push(
      { id: 11, name: 'Bonos', description: 'Extras', type: 'income', isActive: false, hasTransactions: false, code: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: null },
    );
    const { harness, element } = await open();

    expect(names(element, 'category-rows')).not.toContain('Gimnasio');
    expect(element.querySelector('[data-testid="tab-inactive"]')?.textContent).toContain('2');

    click(element, 'tab-inactive');
    harness.detectChanges();
    expect(names(element, 'category-rows')).toEqual(['Bonos', 'Gimnasio']);
    expect(element.querySelector('[data-testid="type-6"]')?.textContent).toContain('Expense');
    expect(element.querySelector('[data-testid="category-6"] a')?.getAttribute('aria-label')).toBe('View the Gimnasio category');

    click(element, 'menu-6');
    harness.detectChanges();
    expect(element.querySelector('#category-menu-6')?.textContent).not.toContain('Edit');
    click(element, 'activate-6');
    harness.detectChanges();

    expect(names(element, 'category-rows')).toEqual(['Bonos']);
    expect(element.querySelector('[data-testid="category-notice"]')?.textContent).toContain('You reactivated the “Gimnasio” category.');

    click(element, 'tab-expense');
    harness.detectChanges();
    expect(names(element, 'category-rows')).toContain('Gimnasio');
  });

  it('offers edit and deactivate on every active category', async () => {
    const { harness, element } = await open();

    expect(element.querySelector('[data-testid="category-9"] a[href="/categories/9/edit"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="menu-9"]')).toBeTruthy();

    click(element, 'tab-income');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="category-4"] a[href="/categories/4/edit"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="menu-4"]')).toBeTruthy();
  });

  it('puts the create action at the top of the page', async () => {
    const { element } = await open();

    expect(element.querySelector('header [data-testid="new-category"]')?.getAttribute('href')).toBe('/categories/new');
  });

  it('pages five categories at a time and starts over when the tab changes', async () => {
    fake.categories.push(
      ...Array.from({ length: 6 }, (_, index) => ({
        id: 100 + index,
        name: `Propia ${index + 1}`,
        description: 'Generada para el test',
        type: 'expense' as const,
        isActive: true,
        hasTransactions: false,
        code: null,
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: null,
      })),
    );
    const { harness, element } = await open();

    expect(names(element, 'category-rows')).toHaveLength(5);
    expect(element.querySelector('[data-testid="pagination"]')?.textContent).toContain('Showing 1–5 of 9');

    click(element, 'pagination-next');
    harness.detectChanges();
    expect(names(element, 'category-rows')).toHaveLength(4);

    click(element, 'tab-income');
    harness.detectChanges();
    click(element, 'tab-expense');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="pagination-page-1"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('searches ignoring accents and case, and counts matches per tab', async () => {
    const { harness, element } = await open();
    const search = element.querySelector<HTMLInputElement>('[data-testid="category-search"]')!;

    search.value = 'SALARIO';
    search.dispatchEvent(new Event('input'));
    harness.detectChanges();

    expect(element.querySelector('[data-testid="no-matches"]')?.textContent).toContain('No expense category matches “SALARIO”.');
    expect(element.querySelector('[data-testid="tab-income"]')?.textContent).toContain('1');

    search.value = 'ALIMENTACION';
    search.dispatchEvent(new Event('input'));
    harness.detectChanges();
    expect(names(element, 'category-rows')).toEqual(['Alimentación']);
  });

  it('opens the actions menu and closes it with Escape, back on its button', async () => {
    const { harness, element } = await open();
    const button = element.querySelector<HTMLButtonElement>('[data-testid="menu-9"]')!;

    button.click();
    harness.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    element.querySelector('#category-menu-9')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    harness.detectChanges();

    expect(element.querySelector('#category-menu-9')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('asks before deactivating from the menu and moves the category to the deactivated tab', async () => {
    const { harness, element } = await open();

    click(element, 'menu-9');
    harness.detectChanges();
    click(element, 'deactivate-9');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="deactivate-confirmation"]')?.textContent).toContain('Deactivate “Mascotas”?');

    click(element, 'confirm-deactivate');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="category-9"]')).toBeNull();
    expect(element.querySelector('[data-testid="category-notice"]')?.textContent).toContain('You deactivated the “Mascotas” category.');

    click(element, 'tab-inactive');
    harness.detectChanges();
    expect(names(element, 'category-rows')).toEqual(['Gimnasio', 'Mascotas']);
  });

  it('syncs a category the backend had already deactivated and says so', async () => {
    const { harness, element } = await open();
    fake.failWith = new CategoryError('This category was already deactivated.', CategoryErrorCode.AlreadyInactive);

    click(element, 'menu-9');
    harness.detectChanges();
    click(element, 'deactivate-9');
    harness.detectChanges();
    click(element, 'confirm-deactivate');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="category-9"]')).toBeNull();
    expect(element.querySelector('[data-testid="action-error"]')?.textContent).toContain('already deactivated');
  });

  it('drops a category the backend no longer has', async () => {
    const { harness, element } = await open();
    fake.failWith = new CategoryError('The category was not found.', CategoryErrorCode.NotFound);

    click(element, 'menu-9');
    harness.detectChanges();
    click(element, 'deactivate-9');
    harness.detectChanges();
    click(element, 'confirm-deactivate');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="category-9"]')).toBeNull();
    expect(element.querySelector('[data-testid="action-error"]')?.textContent).toContain('The category was not found.');
  });

  it('shows an empty state for a type without categories', async () => {
    fake.categories = fake.categories.filter((category) => category.type !== 'expense');
    const { element } = await open();

    expect(element.querySelector('[data-testid="category-empty"]')?.textContent).toContain('no expense categories yet');
  });

  it('shows an empty state for the deactivated tab', async () => {
    fake.categories = fake.categories.filter((category) => category.isActive);
    const { harness, element } = await open();

    click(element, 'tab-inactive');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="category-empty"]')?.textContent).toContain('no deactivated categories');
  });

  it('shows the load error with a retry', async () => {
    fake.failWith = new CategoryError('Server down.');
    const { harness, element } = await open();

    expect(element.querySelector('[data-testid="load-error"]')?.textContent).toContain('Server down.');

    click(element, 'retry');
    harness.detectChanges();

    expect(names(element, 'category-rows')).toHaveLength(3);
  });

  it('keeps the list beside the panel and marks the row being edited', async () => {
    const { element } = await open('/categories/9/edit');

    expect(element.querySelector('[data-testid="category-panel"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="category-browser"]')?.className).toContain('lg:flex');
    expect(element.querySelector('[data-testid="category-9"] a')?.getAttribute('aria-current')).toBe('true');
    expect(element.querySelector('[data-testid="new-category-mobile"]')).toBeNull();
  });

  it('adds a created category to the list without reloading it', async () => {
    const { harness, element } = await open('/categories/new');
    const list = vi.spyOn(fake, 'list');

    for (const [testId, value] of [['category-name', 'Viajes'], ['category-description', 'Vuelos y hoteles']]) {
      const field = element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(element.querySelector('[data-testid="category-panel"]')).toBeNull();
    expect(names(element, 'category-rows')).toEqual(['Alimentación', 'Mascotas', 'Viajes', 'Vivienda']);
    expect(element.querySelector('[data-testid="category-notice"]')?.textContent).toContain('You created the “Viajes” category.');
    expect(list).not.toHaveBeenCalled();
  });

  it('translates the view into Spanish', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { element } = await open();

    expect(element.querySelector('h1')?.textContent).toContain('Categorías');
    expect(element.textContent).toContain('Ingresos');
    expect(element.textContent).toContain('Gastos');
    expect(element.textContent).toContain('Transferencias');
    expect(element.textContent).toContain('Desactivadas');
    expect(element.textContent).toContain('Nueva categoría');
  });
  describe('a system category', () => {
    beforeEach(() => {
      fake.categories.push(SYSTEM_CATEGORY);
    });

    it('shows its translated name with a system badge', async () => {
      const { harness, element } = await open();
      click(element, 'tab-transfer');
      harness.detectChanges();

      const row = element.querySelector('[data-testid="category-30"]')!;
      expect(row.textContent).toContain('Card payment');
      expect(row.textContent).not.toContain('Pago tarjeta');
      expect(row.querySelector('[data-testid="system-category"]')?.textContent?.trim()).toBe('System');
      expect(row.querySelector('a')?.getAttribute('aria-label')).toContain('Card payment');
      // Una categoría del usuario no lleva el badge.
      expect(element.querySelector('[data-testid="category-10"] [data-testid="system-category"]')).toBeNull();
    });

    it('translates the name and the badge into Spanish', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { harness, element } = await open();
      click(element, 'tab-transfer');
      harness.detectChanges();

      const row = element.querySelector('[data-testid="category-30"]')!;
      expect(row.textContent).toContain('Pago de tarjeta');
      expect(row.querySelector('[data-testid="system-category"]')?.textContent?.trim()).toBe('Del sistema');
    });

    it('finds it by its translated name', async () => {
      const { harness, element } = await open();
      const input = element.querySelector<HTMLInputElement>('[data-testid="category-search"]')!;
      input.value = 'card pay';
      input.dispatchEvent(new Event('input'));
      harness.detectChanges();
      click(element, 'tab-transfer');
      harness.detectChanges();

      expect(element.querySelector('[data-testid="category-30"]')).toBeTruthy();
      expect(element.querySelector('[data-testid="category-10"]')).toBeNull();
    });

    it('finds it by its Spanish name', async () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      const { harness, element } = await open();
      const input = element.querySelector<HTMLInputElement>('[data-testid="category-search"]')!;
      input.value = 'pago de tarjeta';
      input.dispatchEvent(new Event('input'));
      harness.detectChanges();
      click(element, 'tab-transfer');
      harness.detectChanges();

      expect(element.querySelector('[data-testid="category-30"]')).toBeTruthy();
    });

    it('can be edited but not deactivated', async () => {
      const { harness, element } = await open();
      click(element, 'tab-transfer');
      harness.detectChanges();

      expect(element.querySelector('[data-testid="category-30"] a[href="/categories/30/edit"]')).toBeTruthy();
      click(element, 'menu-30');
      harness.detectChanges();

      expect(element.querySelector('#category-menu-30')).toBeTruthy();
      expect(element.querySelector('[data-testid="deactivate-30"]')).toBeNull();

      click(element, 'menu-10');
      harness.detectChanges();
      expect(element.querySelector('[data-testid="deactivate-10"]')).toBeTruthy();
    });
  });
});
