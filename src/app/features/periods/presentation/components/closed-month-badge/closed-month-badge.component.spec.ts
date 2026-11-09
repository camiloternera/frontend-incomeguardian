import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { PeriodError } from '../../../domain/period-error';
import { FakePeriodRepository, provideFakePeriods } from '../../period-repository.fake';
import { ClosedMonthBadgeComponent } from './closed-month-badge.component';

describe('ClosedMonthBadgeComponent', () => {
  let fake: FakePeriodRepository;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakePeriodRepository();
    await TestBed.configureTestingModule({
      imports: [ClosedMonthBadgeComponent, translocoTesting()],
      providers: [provideFakePeriods(fake)],
    }).compileComponents();
  });

  function render(date: string) {
    const fixture = TestBed.createComponent(ClosedMonthBadgeComponent);
    fixture.componentRef.setInput('date', date);
    fixture.detectChanges();

    return { fixture, badge: () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="closed-month-badge"]') };
  }

  it('marks a day of a closed month', () => {
    expect(render('2026-09-30').badge()?.textContent).toContain('Month closed');
  });

  it('takes no space for a day of an open month', () => {
    expect(render('2026-10-01').badge()).toBeNull();
  });

  it('asks for each year only once', () => {
    render('2026-09-30');
    render('2026-08-12');
    const { fixture, badge } = render('2026-10-01');

    fixture.componentRef.setInput('date', '2025-12-31');
    fixture.detectChanges();

    expect(fake.calls).toEqual(['year 2026', 'year 2025']);
    expect(badge()).toBeNull();
  });

  it('does not mark anything when the year cannot be read', () => {
    fake.failWith = new PeriodError('Server down.');

    expect(render('2026-09-30').badge()).toBeNull();
  });

  it('translates the badge into Spanish', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');

    expect(render('2026-09-30').badge()?.textContent).toContain('Mes cerrado');
  });
});
