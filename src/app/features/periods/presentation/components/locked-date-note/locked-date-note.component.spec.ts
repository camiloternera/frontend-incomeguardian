import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { FakePeriodRepository, provideFakePeriods } from '../../period-repository.fake';
import { PeriodWorkspace } from '../../period-workspace';
import { LockedDateKind, LockedDateNoteComponent } from './locked-date-note.component';

/** Formulario mínimo que usa la nota como lo hace el de movimientos. */
@Component({
  imports: [LockedDateNoteComponent],
  template: `<app-locked-date-note noteId="date-note" [date]="date()" [kind]="kind()" (useToday)="picked.set($event)" />`,
})
class HostComponent {
  readonly date = signal('');
  readonly kind = signal<LockedDateKind>('income');
  readonly picked = signal<string | null>(null);
  readonly note = viewChild.required(LockedDateNoteComponent);
}

describe('LockedDateNoteComponent', () => {
  let fake: FakePeriodRepository;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T15:00:00Z'));
    localStorage.clear();
    fake = new FakePeriodRepository();
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [provideFakePeriods(fake)],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  function render(date: string) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.date.set(date);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      host: fixture.componentInstance,
      element,
      note: () => element.querySelector<HTMLElement>('[data-testid="locked-date-note"]'),
      click(testId: string) {
        element.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
        fixture.detectChanges();
      },
    };
  }

  it('says nothing while the date is in an open month', () => {
    const view = render('2026-10-20');

    expect(view.note()).toBeNull();
    expect(view.host.note().locked()).toBe(false);
    expect(fake.calls).toEqual(['year 2026']);
  });

  it('says nothing without a date', () => {
    const view = render('');

    expect(view.note()).toBeNull();
    expect(fake.calls).toEqual([]);
  });

  it('explains that the month is closed and locks the form', () => {
    const view = render('2026-09-15');

    expect(view.host.note().locked()).toBe(true);
    expect(view.note()?.id).toBe('date-note');
    expect(view.note()?.textContent).toContain('September 2026 is closed');
    expect(view.note()?.textContent).toContain('To save this income on September 15, reopen the month.');
    expect(view.note()?.textContent).toContain('Use today, Nov 8');
  });

  it('names the year when the whole year is closed', () => {
    fake.years[2025] = { ...fake.years[2026], year: 2025, yearClosed: true };
    const view = render('2025-03-02');

    expect(view.note()?.textContent).toContain('2025 is closed');
  });

  it('offers to use today instead', () => {
    const view = render('2026-09-15');

    view.click('locked-date-today');

    expect(view.host.picked()).toBe('2026-11-08');
  });

  it('opens the reopen dialog from the form for that month', () => {
    const view = render('2026-09-15');

    expect(view.element.querySelector('[data-testid="locked-date-reopen"]')?.textContent).toContain('Reopen September');
    view.click('locked-date-reopen');

    expect(TestBed.inject(PeriodWorkspace).reopening()).toEqual({ period: { year: 2026, month: 9 }, origin: 'form' });
  });

  it('unlocks once the month is reopened', () => {
    const view = render('2026-09-15');

    TestBed.inject(PeriodWorkspace).reopen({ year: 2026, month: 9 }, { reason: null }, 'form').subscribe();
    view.fixture.detectChanges();

    expect(view.note()).toBeNull();
    expect(view.host.note().locked()).toBe(false);
  });

  it('locks a date the backend rejected and refreshes the year', () => {
    const view = render('2026-10-20');

    view.host.note().markLocked('2026-10-20');
    view.fixture.detectChanges();

    expect(view.host.note().locked()).toBe(true);
    expect(view.note()?.textContent).toContain('October 2026 is closed');
    expect(fake.count('year 2026')).toBe(2);

    // Al cambiar el estado de un período, mandan los datos frescos.
    TestBed.inject(PeriodWorkspace).refresh({ year: 2026, month: 10 });
    view.fixture.detectChanges();

    expect(view.host.note().locked()).toBe(false);
  });

  it('names the kind of transaction and translates into Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const view = render('2026-09-15');
    view.host.kind.set('transfer');
    view.fixture.detectChanges();

    expect(view.note()?.textContent).toContain('Septiembre 2026 está cerrado');
    expect(view.note()?.textContent).toContain('Para guardar este traslado el 15 de septiembre');
  });
});
