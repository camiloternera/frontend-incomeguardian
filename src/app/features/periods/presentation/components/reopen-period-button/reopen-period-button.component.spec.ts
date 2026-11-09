import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { FakePeriodRepository, provideFakePeriods } from '../../period-repository.fake';
import { PeriodWorkspace } from '../../period-workspace';
import { ReopenPeriodButtonComponent } from './reopen-period-button.component';

describe('ReopenPeriodButtonComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ReopenPeriodButtonComponent, translocoTesting()],
      providers: [provideFakePeriods(new FakePeriodRepository())],
    }).compileComponents();
  });

  it('names the month and opens the reopen dialog for it', () => {
    TestBed.inject(LanguageService).setLanguage('es-CO');
    const fixture = TestBed.createComponent(ReopenPeriodButtonComponent);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('month', 10);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="reopen-period"]')!;

    expect(button.textContent).toContain('Reabrir octubre');

    button.click();

    expect(TestBed.inject(PeriodWorkspace).reopening()).toEqual({ period: { year: 2026, month: 10 }, origin: 'selector' });
  });
});
