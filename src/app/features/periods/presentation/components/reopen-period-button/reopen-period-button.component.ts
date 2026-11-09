import { Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageService } from '@core/i18n/language.service';
import { monthName } from '../../period-format';
import { PERIOD_UI } from '../../period-ui';
import { PeriodWorkspace } from '../../period-workspace';

/**
 * Enlace «Reabrir {mes}» para las vistas que muestran un mes cerrado en solo lectura. Abre el modal
 * de reapertura de `app-period-overlays`, que la vista debe incluir una vez.
 */
@Component({
  selector: 'app-reopen-period-button',
  imports: [TranslocoDirective],
  providers: [provideTranslocoScope('periods')],
  template: `
    <button *transloco="let t" data-testid="reopen-period" type="button" [class]="ui.link" (click)="open()">
      {{ t('periods.lockedDate.reopen', { month: label() }) }}
    </button>
  `,
})
export class ReopenPeriodButtonComponent {
  private readonly workspace = inject(PeriodWorkspace);
  private readonly locale = inject(LanguageService).language;

  readonly year = input.required<number>();
  /** Mes de 1 a 12. */
  readonly month = input.required<number>();

  protected readonly ui = PERIOD_UI;
  protected readonly label = computed(() => monthName(this.month(), this.locale()));

  protected open(): void {
    this.workspace.openReopen({ year: this.year(), month: this.month() });
  }
}
