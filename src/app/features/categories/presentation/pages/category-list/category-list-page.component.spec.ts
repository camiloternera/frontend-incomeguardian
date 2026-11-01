import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { CategoryError, CategoryErrorCode } from '../../../domain/category-error';
import { FakeCategoryRepository, fakeCategoriesRoutes } from '../../category-repository.fake';

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

  function names(element: HTMLElement, section: 'category-rows' | 'predefined-rows'): string[] {
    return [...element.querySelectorAll(`[data-testid="${section}"] > li`)].map(
      (item) => item.querySelector('a span, p')?.textContent?.trim() ?? '',
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeCategoryRepository();
    fake.categories.push(
      { id: 2, name: 'Alimentación', description: 'Mercado y comidas fuera', isGlobal: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: null },
      { id: 10, name: 'Coworking', description: 'Escritorio y café', isGlobal: false, createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z' },
    );
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter(fakeCategoriesRoutes(fake))
      ],
    }).compileComponents();
  });

  it('shows your categories first and the predefined ones in their own tab', async () => {
    const { harness, element } = await open();

    expect(names(element, 'category-rows')).toEqual(['Coworking', 'Mascotas']);
    expect(element.querySelector('[data-testid="tab-personal"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('[data-testid="tab-predefined"]')?.textContent).toContain('2');

    click(element, 'tab-predefined');
    harness.detectChanges();

    expect(names(element, 'predefined-rows')).toEqual(['Alimentación', 'Vivienda']);
    expect(element.querySelector('[data-testid="category-rows"]')).toBeNull();
  });

  it('offers actions only on your own categories', async () => {
    const { harness, element } = await open();

    expect(element.querySelector('[data-testid="category-9"] a[href="/categories/9/edit"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="menu-9"]')).toBeTruthy();

    click(element, 'tab-predefined');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="category-1"] a, [data-testid="category-1"] button')).toBeNull();
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
        isGlobal: false,
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: null,
      })),
    );
    const { harness, element } = await open();

    expect(names(element, 'category-rows')).toHaveLength(5);
    expect(element.querySelector('[data-testid="pagination"]')?.textContent).toContain('Showing 1–5 of 8');

    click(element, 'pagination-next');
    harness.detectChanges();
    expect(names(element, 'category-rows')).toHaveLength(3);

    click(element, 'tab-predefined');
    harness.detectChanges();
    click(element, 'tab-personal');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="pagination-page-1"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('searches ignoring accents and case, and counts matches per tab', async () => {
    const { harness, element } = await open();
    const search = element.querySelector<HTMLInputElement>('[data-testid="category-search"]')!;

    search.value = 'ALIMENTACION';
    search.dispatchEvent(new Event('input'));
    harness.detectChanges();

    expect(element.querySelector('[data-testid="no-matches"]')?.textContent).toContain('None of your categories match “ALIMENTACION”.');
    expect(element.querySelector('[data-testid="tab-predefined"]')?.textContent).toContain('1');

    click(element, 'tab-predefined');
    harness.detectChanges();
    expect(names(element, 'predefined-rows')).toEqual(['Alimentación']);
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

  it('asks before deleting from the menu and confirms afterwards', async () => {
    const { harness, element } = await open();

    click(element, 'menu-9');
    harness.detectChanges();
    click(element, 'delete-9');
    harness.detectChanges();
    expect(element.querySelector('[data-testid="delete-confirmation"]')?.textContent).toContain('Delete “Mascotas”?');

    click(element, 'confirm-delete');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="category-9"]')).toBeNull();
    expect(element.querySelector('[data-testid="category-notice"]')?.textContent).toContain('You deleted the “Mascotas” category.');
  });

  it('drops a category the backend no longer has', async () => {
    const { harness, element } = await open();
    fake.failWith = new CategoryError('The category was not found.', CategoryErrorCode.NotFound);

    click(element, 'menu-9');
    harness.detectChanges();
    click(element, 'delete-9');
    harness.detectChanges();
    click(element, 'confirm-delete');
    harness.detectChanges();

    expect(element.querySelector('[data-testid="category-9"]')).toBeNull();
    expect(element.querySelector('[data-testid="delete-error"]')?.textContent).toContain('The category was not found.');
  });

  it('shows an empty state when you have none of your own', async () => {
    fake.categories = fake.categories.filter((category) => category.isGlobal);
    const { element } = await open();

    expect(element.querySelector('[data-testid="category-empty"]')?.textContent).toContain('no categories of your own');
  });

  it('shows the load error with a retry', async () => {
    fake.failWith = new CategoryError('Server down.');
    const { harness, element } = await open();

    expect(element.querySelector('[data-testid="load-error"]')?.textContent).toContain('Server down.');

    click(element, 'retry');
    harness.detectChanges();

    expect(names(element, 'category-rows')).toHaveLength(2);
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
    expect(names(element, 'category-rows')).toEqual(['Coworking', 'Mascotas', 'Viajes']);
    expect(element.querySelector('[data-testid="category-notice"]')?.textContent).toContain('You created the “Viajes” category.');
    expect(list).not.toHaveBeenCalled();
  });

  it('translates the view into Spanish', async () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const { element } = await open();

    expect(element.querySelector('h1')?.textContent).toContain('Categorías');
    expect(element.textContent).toContain('Tus categorías');
    expect(element.textContent).toContain('Predefinidas');
    expect(element.textContent).toContain('Nueva categoría');
  });
});
