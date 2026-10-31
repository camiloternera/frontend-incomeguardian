import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { PaginationComponent } from './pagination.component';

function render(page: number, totalItems: number, pageSize = 10) {
  const fixture = TestBed.createComponent(PaginationComponent);
  fixture.componentRef.setInput('page', page);
  fixture.componentRef.setInput('totalItems', totalItems);
  fixture.componentRef.setInput('pageSize', pageSize);
  fixture.detectChanges();

  return fixture;
}

function labels(element: HTMLElement): string[] {
  return [...element.querySelectorAll('li')].map((li) => li.textContent!.trim()).filter(Boolean);
}

describe('PaginationComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PaginationComponent, translocoTesting()] }).compileComponents();
  });

  it('abbreviates distant pages around the current one', () => {
    const element = render(5, 100).nativeElement as HTMLElement;

    expect(labels(element)).toEqual(['1', '…', '4', '5', '6', '…', '10']);
  });

  it('disables previous on the first page and next on the last', () => {
    const fixture = render(1, 30);
    const element = fixture.nativeElement as HTMLElement;
    const button = (id: string) => element.querySelector<HTMLButtonElement>(`[data-testid="pagination-${id}"]`)!;

    expect(button('previous').disabled).toBe(true);
    expect(button('next').disabled).toBe(false);

    fixture.componentRef.setInput('page', 3);
    fixture.detectChanges();

    expect(button('previous').disabled).toBe(false);
    expect(button('next').disabled).toBe(true);
  });

  it('emits the chosen page', () => {
    const fixture = render(2, 30);
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page) => emitted.push(page));
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('[data-testid="pagination-next"]')!.click();
    element.querySelector<HTMLButtonElement>('[data-testid="pagination-page-1"]')!.click();
    element.querySelector<HTMLButtonElement>('[data-testid="pagination-page-2"]')!.click();

    expect(emitted).toEqual([3, 1]);
    expect(element.querySelector<HTMLButtonElement>('[data-testid="pagination-next"]')!.disabled).toBe(false);
  });

  it('renders nothing for a single page', () => {
    const element = render(1, 10).nativeElement as HTMLElement;

    expect(element.querySelector('nav')).toBeNull();
  });
});
