import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { AccountTypeError, AccountTypeErrorCode } from '../../../domain/account-type-error';
import { FakeAccountTypeRepository, provideFakeAccountTypes } from '../../account-type-repository.fake';
import { AccountTypeListPageComponent } from './account-type-list-page.component';

describe('AccountTypeListPageComponent', () => {
  let fake: FakeAccountTypeRepository;

  function render() {
    const fixture = TestBed.createComponent(AccountTypeListPageComponent);
    fixture.detectChanges();

    return fixture;
  }

  function click(element: HTMLElement, testId: string): void {
    element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
  }

  function search(element: HTMLElement, value: string): void {
    const input = element.querySelector<HTMLInputElement>('[data-testid="account-type-search"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function names(element: HTMLElement): (string | undefined)[] {
    return [...element.querySelectorAll('[data-testid="account-type-rows"] h2')].map((h2) => h2.textContent?.trim());
  }

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeAccountTypeRepository();
    await TestBed.configureTestingModule({
      imports: [AccountTypeListPageComponent, translocoTesting()],
      providers: [provideRouter([]), provideFakeAccountTypes(fake)],
    }).compileComponents();
  });

  it('lists the account types alphabetically with edit and deactivate actions', () => {
    const element = render().nativeElement as HTMLElement;

    expect(names(element)).toEqual(['Ahorros', 'Tarjeta de crédito']);
    expect(element.querySelector('[data-testid="account-type-3"] a[href="/3/edit"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="deactivate-3"]')).toBeTruthy();
  });

  it('searches by name or description ignoring accents', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    search(element, 'credito');
    fixture.detectChanges();
    expect(names(element)).toEqual(['Tarjeta de crédito']);
    expect(element.querySelector('[data-testid="search-count"]')?.textContent).toContain('1 of 2');

    search(element, 'banco');
    fixture.detectChanges();
    expect(names(element)).toEqual(['Ahorros']);
  });

  it('offers to clear a search without results', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    search(element, 'cripto');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="account-type-empty"]')?.textContent).toContain('No type matches “cripto”');

    element.querySelector<HTMLButtonElement>('[data-testid="account-type-empty"] button')!.click();
    fixture.detectChanges();
    expect(names(element)).toHaveLength(2);
  });

  it('invites to create the first type when there are none', () => {
    fake.accountTypes = [];
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="account-type-empty"]')?.textContent).toContain('No account types yet');
    expect(element.querySelector('[data-testid="account-type-search"]')).toBeNull();
  });

  it('asks before deactivating and confirms afterwards', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    click(element, 'deactivate-3');
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="deactivate-confirmation"]')?.textContent).toContain(
      'accounts that already have it keep it',
    );

    click(element, 'confirm-deactivate');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="account-type-3"]')).toBeNull();
    expect(element.querySelector('[data-testid="account-type-notice"]')?.textContent).toContain(
      'You deactivated the “Tarjeta de crédito” account type.',
    );
  });

  it('drops a type the backend no longer has', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    fake.failWith = new AccountTypeError('The account type was not found.', AccountTypeErrorCode.NotFound);

    click(element, 'deactivate-3');
    fixture.detectChanges();
    click(element, 'confirm-deactivate');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="account-type-3"]')).toBeNull();
    expect(element.querySelector('[data-testid="deactivate-error"]')?.textContent).toContain('The account type was not found.');
  });

  it('shows the load error with a retry', () => {
    fake.failWith = new AccountTypeError('Server down.');
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="load-error"]')?.textContent).toContain('Server down.');

    element.querySelector<HTMLButtonElement>('[data-testid="load-error"] + button')!.click();
    fixture.detectChanges();

    expect(names(element)).toHaveLength(2);
  });

  describe('pagination', () => {
    beforeEach(() => {
      fake.accountTypes = Array.from({ length: 11 }, (_, index) => ({
        id: 100 + index,
        name: `Tipo ${String(index + 1).padStart(2, '0')}`,
        description: index === 10 ? 'El último' : 'Generado para el test',
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: null,
      }));
    });

    function rows(element: HTMLElement): number {
      return element.querySelectorAll('[data-testid="account-type-rows"] > li').length;
    }

    it('shows one page at a time', () => {
      const fixture = render();
      const element = fixture.nativeElement as HTMLElement;

      expect(rows(element)).toBe(8);
      expect(element.querySelector('[data-testid="pagination"]')?.textContent).toContain('Showing 1–8 of 11');

      click(element, 'pagination-next');
      fixture.detectChanges();

      expect(rows(element)).toBe(3);
    });

    it('goes back to the first page when searching', () => {
      const fixture = render();
      const element = fixture.nativeElement as HTMLElement;

      click(element, 'pagination-page-2');
      fixture.detectChanges();
      search(element, 'último');
      fixture.detectChanges();

      expect(names(element)).toEqual(['Tipo 11']);
      expect(element.querySelector('[data-testid="pagination"]')).toBeNull();
    });

    it('steps back when deactivating empties the last page', () => {
      fake.accountTypes = fake.accountTypes.slice(0, 9);
      const fixture = render();
      const element = fixture.nativeElement as HTMLElement;

      click(element, 'pagination-next');
      fixture.detectChanges();
      expect(rows(element)).toBe(1);

      click(element, 'deactivate-108');
      fixture.detectChanges();
      click(element, 'confirm-deactivate');
      fixture.detectChanges();

      expect(rows(element)).toBe(8);
      expect(element.querySelector('[data-testid="pagination"]')).toBeNull();
    });
  });

  it('translates the view into Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Tipos de cuenta');
    expect(element.textContent).toContain('Nuevo tipo');
    expect(element.textContent).toContain('Desactivar');
  });
});
