import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { DatePickerComponent } from '@shared/ui/date-picker/date-picker.component';
import {
  EMPTY_TRANSACTION_FILTERS,
  TransactionFiltersComponent,
  TransactionFilterValues,
} from './transaction-filters.component';

describe('Transaction filters review regressions', () => {
  let fixture: ComponentFixture<TransactionFiltersComponent>;
  let emissions: TransactionFilterValues[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionFiltersComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(TransactionFiltersComponent);
    fixture.componentRef.setInput('value', { ...EMPTY_TRANSACTION_FILTERS });
    fixture.componentRef.setInput('categories', []);
    fixture.componentRef.setInput('accounts', []);
    fixture.componentRef.setInput('today', '2026-11-24');
    fixture.componentRef.setInput('allCategoriesLabel', 'All categories');
    fixture.componentRef.setInput('allAccountsLabel', 'All accounts');
    emissions = [];
    fixture.componentInstance.filtersChange.subscribe((value) => {
      emissions.push(value);
      // Reproduce the parent applying the emitted filters back to the input.
      fixture.componentRef.setInput('value', { ...value });
    });
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  function search(text: string): void {
    const input = fixture.nativeElement.querySelector(
      '[data-testid="transaction-filter-search"]',
    ) as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function clear(): void {
    const button = fixture.nativeElement.querySelector(
      '[data-testid="transaction-filters-clear"]',
    ) as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
  }

  function picker(id: 'from' | 'to'): DatePickerComponent {
    return fixture.debugElement.query(
      By.css(`[data-testid="transaction-filter-${id}"]`),
    ).componentInstance;
  }

  it('applies the same search again after clearing it', async () => {
    // RxJS debounce uses intervals; keep Angular's render scheduler on real timers.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    search('mercado');
    await vi.advanceTimersByTimeAsync(301);
    await fixture.whenStable();
    expect(emissions.map((value) => value.search)).toEqual(['mercado']);

    clear();
    await fixture.whenStable();
    expect(emissions.map((value) => value.search)).toEqual(['mercado', '']);

    search('mercado');
    await vi.advanceTimersByTimeAsync(301);
    await fixture.whenStable();
    expect(emissions.map((value) => value.search)).toEqual(['mercado', '', 'mercado']);
  });

  it('sets both calendar bounds when applied filters arrive from the URL', async () => {
    fixture.componentRef.setInput('value', {
      ...EMPTY_TRANSACTION_FILTERS,
      from: '2026-11-10',
      to: '2026-11-20',
    });
    await fixture.whenStable();

    expect({ min: picker('to').min(), max: picker('from').max() }).toEqual({
      min: '2026-11-10',
      max: '2026-11-20',
    });
  });

  it('does not reapply a pending search after clearing', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    fixture.componentRef.setInput('value', { ...EMPTY_TRANSACTION_FILTERS, categoryId: 1 });
    await fixture.whenStable();
    search('mercado');
    clear();
    await fixture.whenStable();
    await vi.advanceTimersByTimeAsync(301);
    await fixture.whenStable();

    expect(emissions).toEqual([EMPTY_TRANSACTION_FILTERS]);
  });

  it('can repeat a search after navigation replaces the applied filters', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    search('mercado');
    await vi.advanceTimersByTimeAsync(301);
    await fixture.whenStable();
    fixture.componentRef.setInput('value', { ...EMPTY_TRANSACTION_FILTERS });
    await fixture.whenStable();
    search('mercado');
    await vi.advanceTimersByTimeAsync(301);
    await fixture.whenStable();

    expect(emissions.map((value) => value.search)).toEqual(['mercado', 'mercado']);
  });

  it('removes both calendar bounds when the selected range is cleared', async () => {
    const form = fixture.debugElement.query(By.directive(FormGroupDirective))
      .injector.get(FormGroupDirective).form;
    form.get('from')!.setValue('2026-11-10');
    await fixture.whenStable();
    form.get('to')!.setValue('2026-11-20');
    await fixture.whenStable();
    expect({ min: picker('to').min(), max: picker('from').max() }).toEqual({
      min: '2026-11-10',
      max: '2026-11-20',
    });

    clear();
    await fixture.whenStable();
    expect(form.getRawValue()).toEqual(EMPTY_TRANSACTION_FILTERS);
    expect({ min: picker('to').min(), max: picker('from').max() }).toEqual({
      min: null,
      max: '2026-11-24',
    });
  });
});
