import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { CategoryError, CategoryErrorCode } from '../../../domain/category-error';
import { FakeCategoryRepository, provideFakeCategories } from '../../category-repository.fake';
import { CategoryFormPageComponent } from './category-form-page.component';

describe('CategoryFormPageComponent', () => {
  let fake: FakeCategoryRepository;

  async function setup(id: string | null) {
    localStorage.clear();
    fake = new FakeCategoryRepository();
    await TestBed.configureTestingModule({
      imports: [CategoryFormPageComponent, translocoTesting()],
      providers: [
        provideRouter([]),
        provideFakeCategories(fake),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CategoryFormPageComponent);
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

    type(element, 'category-name', 'x'.repeat(21));
    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain('The name can be up to 20 characters.');
    expect(element.querySelector('[data-testid="description-error"]')?.textContent).toContain('Enter a description');
    expect(fake.lastDraft).toBeNull();
  });

  it('creates a trimmed category and returns to the list with a notice', async () => {
    const { fixture, element } = await setup(null);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    type(element, 'category-name', '  Viajes ');
    type(element, 'category-description', 'Vuelos y hoteles');
    submit(element);
    fixture.detectChanges();

    expect(fake.lastDraft).toEqual({ name: 'Viajes', description: 'Vuelos y hoteles' });
    expect(navigate).toHaveBeenCalledWith(['/categories'], {
      state: { notice: { kind: 'created', name: 'Viajes' } },
    });
  });

  it('shows a taken name beside the name field until it changes', async () => {
    const { fixture, element } = await setup(null);
    fake.failWith = new CategoryError('A category with that name already exists.', CategoryErrorCode.NameAlreadyExists);

    type(element, 'category-name', 'Vivienda');
    type(element, 'category-description', 'Otra');
    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="name-error"]')?.textContent).toContain('A category with that name already exists.');
    expect(element.querySelector('[data-testid="form-error"]')).toBeNull();

    type(element, 'category-name', 'Vivienda 2');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="name-error"]')).toBeNull();
  });

  it('keeps unknown failures at form level', async () => {
    const { fixture, element } = await setup(null);
    fake.failWith = new CategoryError('Something new happened.');

    type(element, 'category-name', 'Viajes');
    type(element, 'category-description', 'Vuelos');
    submit(element);
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="form-error"]')?.textContent).toContain('Something new happened.');
  });

  it('loads the category to edit', async () => {
    const { element } = await setup('9');

    expect(element.querySelector('h1')?.textContent).toContain('Edit category');
    expect(element.querySelector<HTMLInputElement>('[data-testid="category-name"]')?.value).toBe('Mascotas');
  });

  it('refuses to edit a predefined category', async () => {
    const { element } = await setup('1');

    expect(element.querySelector('[data-testid="category-read-only"]')?.textContent).toContain('predefined category');
    expect(element.querySelector('form')).toBeNull();
  });

  it('explains when the category does not exist', async () => {
    const { element } = await setup('404');

    expect(element.querySelector('[data-testid="category-not-found"]')?.textContent).toContain('Category unavailable');
  });
});
