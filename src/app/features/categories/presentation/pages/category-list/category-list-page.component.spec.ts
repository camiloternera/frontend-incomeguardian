import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { CategoryError, CategoryErrorCode } from '../../../domain/category-error';
import { FakeCategoryRepository, provideFakeCategories } from '../../category-repository.fake';
import { CategoryListPageComponent } from './category-list-page.component';

describe('CategoryListPageComponent', () => {
  let fake: FakeCategoryRepository;

  function render() {
    const fixture = TestBed.createComponent(CategoryListPageComponent);
    fixture.detectChanges();

    return fixture;
  }

  function click(element: HTMLElement, testId: string): void {
    element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
  }

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeCategoryRepository();
    await TestBed.configureTestingModule({
      imports: [CategoryListPageComponent, translocoTesting()],
      providers: [provideRouter([]), provideFakeCategories(fake)],
    }).compileComponents();
  });

  it('lists personal categories before the predefined ones', () => {
    const element = render().nativeElement as HTMLElement;
    const names = [...element.querySelectorAll('[data-testid="category-rows"] h2')].map((h2) => h2.textContent?.trim());

    expect(names).toEqual(['Mascotas', 'Vivienda']);
  });

  it('offers edit and delete only on personal categories', () => {
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="category-9"] a[href="/9/edit"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="delete-9"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="category-1"] a')).toBeNull();
    expect(element.querySelector('[data-testid="delete-1"]')).toBeNull();
  });

  it('filters by kind and shows an empty state', () => {
    fake.categories = fake.categories.filter((category) => category.isGlobal);
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    click(element, 'filter-personal');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="category-empty"]')?.textContent).toContain('no categories of your own');
  });

  it('asks before deleting and confirms afterwards', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    click(element, 'delete-9');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="delete-confirmation"]')?.textContent).toContain('Delete “Mascotas”?');

    click(element, 'confirm-delete');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="category-9"]')).toBeNull();
    expect(element.querySelector('[data-testid="category-notice"]')?.textContent).toContain('You deleted the “Mascotas” category.');
  });

  it('drops a category the backend no longer has', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    fake.failWith = new CategoryError('The category was not found.', CategoryErrorCode.NotFound);

    click(element, 'delete-9');
    fixture.detectChanges();
    click(element, 'confirm-delete');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="category-9"]')).toBeNull();
    expect(element.querySelector('[data-testid="delete-error"]')?.textContent).toContain('The category was not found.');
  });

  it('shows the load error with a retry', () => {
    fake.failWith = new CategoryError('Server down.');
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="load-error"]')?.textContent).toContain('Server down.');

    element.querySelector<HTMLButtonElement>('[data-testid="load-error"] + button')!.click();
    fixture.detectChanges();

    expect(element.querySelectorAll('[data-testid="category-rows"] li').length).toBe(2);
  });

  describe('pagination', () => {
    beforeEach(() => {
      // 1 predefinida + 11 personales = 12 categorías, dos páginas de 8.
      fake.categories = [
        ...fake.categories.filter((category) => category.isGlobal),
        ...Array.from({ length: 11 }, (_, index) => ({
          id: 100 + index,
          name: `Propia ${String(index + 1).padStart(2, '0')}`,
          description: 'Generada para el test',
          isGlobal: false,
          createdAt: '2026-10-20T00:00:00Z',
          updatedAt: null,
        })),
      ];
    });

    function rows(element: HTMLElement): number {
      return element.querySelectorAll('[data-testid="category-rows"] > li').length;
    }

    it('shows one page at a time with its range', () => {
      const fixture = render();
      const element = fixture.nativeElement as HTMLElement;

      expect(rows(element)).toBe(8);
      expect(element.querySelector('[data-testid="pagination"]')?.textContent).toContain('Showing 1–8 of 12');

      click(element, 'pagination-next');
      fixture.detectChanges();

      expect(rows(element)).toBe(4);
      expect(element.querySelector('[data-testid="pagination"]')?.textContent).toContain('Showing 9–12 of 12');
      expect(element.querySelector('[data-testid="pagination-page-2"]')?.getAttribute('aria-current')).toBe('page');
    });

    it('goes back to the first page when the filter changes', () => {
      const fixture = render();
      const element = fixture.nativeElement as HTMLElement;

      click(element, 'pagination-page-2');
      fixture.detectChanges();
      click(element, 'filter-personal');
      fixture.detectChanges();

      expect(element.querySelector('[data-testid="pagination-page-1"]')?.getAttribute('aria-current')).toBe('page');
    });

    it('steps back when deleting empties the last page', () => {
      // Solo personales: la fila que queda sola en la página 2 debe poder eliminarse.
      fake.categories = fake.categories.filter((category) => !category.isGlobal).slice(0, 9);
      const fixture = render();
      const element = fixture.nativeElement as HTMLElement;

      click(element, 'pagination-next');
      fixture.detectChanges();
      expect(rows(element)).toBe(1);

      const lastId = element.querySelector('[data-testid="category-rows"] > li')!.getAttribute('data-testid')!.replace('category-', '');
      click(element, `delete-${lastId}`);
      fixture.detectChanges();
      click(element, 'confirm-delete');
      fixture.detectChanges();

      expect(rows(element)).toBe(8);
      expect(element.querySelector('[data-testid="pagination"]')).toBeNull();
    });

    it('hides the bar when everything fits on one page', () => {
      fake.categories = fake.categories.slice(0, 8);
      const element = render().nativeElement as HTMLElement;

      expect(element.querySelector('[data-testid="pagination"]')).toBeNull();
    });
  });

  it('translates the view into Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Categorías');
    expect(element.textContent).toContain('Predefinida');
    expect(element.textContent).toContain('Nueva categoría');
  });
});
