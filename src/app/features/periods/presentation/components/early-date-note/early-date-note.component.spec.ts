import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { FakePeriodRepository, periodYear, provideFakePeriods } from '../../period-repository.fake';
import { PeriodWorkspace } from '../../period-workspace';
import { EarlyDateNoteComponent } from './early-date-note.component';

/** Formulario mínimo que usa la nota como lo hace el de movimientos. */
@Component({
  imports: [EarlyDateNoteComponent],
  template: `<app-early-date-note noteId="date-early" [date]="date()" />`,
})
class HostComponent {
  readonly date = signal('');
  readonly note = viewChild.required(EarlyDateNoteComponent);
}

describe('EarlyDateNoteComponent', () => {
  let fake: FakePeriodRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakePeriodRepository();
    // La primera cuenta es de mayo de 2026: enero a abril están «sin actividad».
    fake.years[2026] = periodYear(
      2026,
      ['noActivity', 'noActivity', 'noActivity', 'noActivity', 'closed', 'closed', 'closed', 'closed', 'closed', 'pending', 'current'],
      { firstActivity: '2026-05' },
    );
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [provideFakePeriods(fake)],
    }).compileComponents();
  });

  function render(date: string) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.date.set(date);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      host: fixture.componentInstance,
      note: () => element.querySelector<HTMLElement>('[data-testid="early-date-note"]'),
    };
  }

  function workspace(): PeriodWorkspace {
    return TestBed.inject(PeriodWorkspace);
  }

  it('says nothing when the date is on or after the first activity', () => {
    const view = render('2026-05-02');

    expect(view.note()).toBeNull();
    expect(view.host.note().range()).toBeNull();
    expect(fake.calls).toEqual(['year 2026']);
  });

  it('says nothing without a date', () => {
    const view = render('');

    expect(view.note()).toBeNull();
    expect(fake.calls).toEqual([]);
  });

  it('warns that saving opens the one month before the first activity', () => {
    const view = render('2026-04-15');

    const note = view.note();
    expect(note?.id).toBe('date-early');
    expect(note?.getAttribute('role')).toBe('status');
    expect(note?.textContent).toContain('This date is before your first account');
    expect(note?.textContent).toContain('Saving opens April 2026 so you can close it.');
  });

  it('warns that saving opens every month up to the first activity', () => {
    const view = render('2026-02-10');

    expect(view.note()?.textContent).toContain('Saving opens the months from February 2026 to April 2026 so you can close them.');
    expect(view.host.note().range()).toEqual({ from: { year: 2026, month: 2 }, to: { year: 2026, month: 4 } });
  });

  it('asks for the year of the date and follows the date as it changes', () => {
    fake.years[2025] = periodYear(2025, Array(12).fill('noActivity'), { firstActivity: '2026-05' });
    const view = render('2026-06-01');
    expect(view.note()).toBeNull();

    view.host.date.set('2025-12-20');
    view.fixture.detectChanges();

    expect(fake.calls).toEqual(['year 2026', 'year 2025']);
    expect(view.note()?.textContent).toContain('from December 2025 to April 2026');
  });

  it('asks for the year fresh the first time it sees it, even if the view already had it', () => {
    TestBed.inject(PeriodWorkspace).loadYear(2026);
    expect(fake.count('year 2026')).toBe(1);

    const view = render('2026-02-10');

    expect(fake.count('year 2026')).toBe(2);

    view.host.date.set('2026-03-01');
    view.fixture.detectChanges();
    expect(fake.count('year 2026')).toBe(2);

    view.host.date.set('2025-06-01');
    view.fixture.detectChanges();
    view.host.date.set('2026-02-10');
    view.fixture.detectChanges();

    expect(fake.count('year 2025')).toBe(1);
    expect(fake.count('year 2026')).toBe(2);
  });

  it('uses the fresh first activity instead of the one the view had in cache', () => {
    // En caché la primera cuenta era de mayo; otra vista registró un movimiento en febrero.
    TestBed.inject(PeriodWorkspace).loadYear(2026);
    fake.years[2026] = { ...fake.years[2026], firstActivity: '2026-02' };

    const view = render('2026-03-10');

    expect(view.note()).toBeNull();
  });

  it('says nothing while the year of the date has no first activity', () => {
    fake.years[2024] = periodYear(2024, Array(12).fill('noActivity'), { firstActivity: null });
    const view = render('2024-03-01');

    expect(view.note()).toBeNull();
  });

  it('announces the opened months after saving', () => {
    const view = render('2026-02-10');
    const announce = vi.spyOn(workspace(), 'announceOpened');

    view.host.note().announce();

    expect(announce).toHaveBeenCalledWith({ from: { year: 2026, month: 2 }, to: { year: 2026, month: 4 } });
    expect(workspace().opened()).toEqual({ from: { year: 2026, month: 2 }, to: { year: 2026, month: 4 } });
  });

  it('announces nothing when the date opens no months', () => {
    const view = render('2026-10-20');
    const announce = vi.spyOn(workspace(), 'announceOpened');

    view.host.note().announce();

    expect(announce).not.toHaveBeenCalled();
    expect(workspace().opened()).toBeNull();
  });

  it('writes the note in Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const view = render('2026-02-10');

    expect(view.note()?.textContent).toContain('Esta fecha es anterior a tu primera cuenta');
    expect(view.note()?.textContent).toContain('Al guardar se abren los meses de febrero de 2026 a abril de 2026');
  });

  it('writes the one-month note in Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const view = render('2026-04-15');

    expect(view.note()?.textContent).toContain('Al guardar se abre abril de 2026 para que puedas cerrarlo.');
  });
});
