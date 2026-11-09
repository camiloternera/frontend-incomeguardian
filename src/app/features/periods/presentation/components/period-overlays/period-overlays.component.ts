import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { PeriodError } from '../../../domain/period-error';
import { capitalized, monthName } from '../../period-format';
import { PERIOD_UI } from '../../period-ui';
import { PeriodWorkspace } from '../../period-workspace';
import { ClosePanelComponent } from '../close-panel/close-panel.component';
import { ReopenDialogComponent } from '../reopen-dialog/reopen-dialog.component';

/** Tiempo que el aviso de reapertura queda en pantalla si nadie lo toca. */
const NOTICE_MS = 10_000;

/**
 * Capa del cierre de períodos: el panel de cierre, el modal de reabrir y el aviso que confirma una
 * reapertura. Cada vista que use el selector o la nota de fecha cerrada la incluye una vez.
 */
@Component({
  selector: 'app-period-overlays',
  // Sin caja propia: si no hay nada que mostrar, no suma un hueco al `gap` del contenedor.
  host: { class: 'contents' },
  imports: [TranslocoDirective, LucideX, ClosePanelComponent, ReopenDialogComponent],
  providers: [provideTranslocoScope('periods')],
  template: `
    <app-close-panel />
    <app-reopen-dialog />

    @if (notice(); as notice) {
      <div
        *transloco="let t"
        data-testid="period-notice"
        class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-[560px] flex-col gap-3 rounded-lg border border-ig-border bg-ig-surface p-4 text-ig-text shadow-[0_8px_24px_rgb(0_0_0/0.24)] sm:flex-row sm:items-center"
        role="status"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p class="m-0 text-[14px] font-bold">
            @if (notice.period.month === null) {
              {{ t('periods.reopen.toastYear', { year: notice.period.year }) }}
            } @else {
              {{ t('periods.reopen.toast', { month: monthTitle(notice.period.month), year: notice.period.year }) }}
            }
          </p>
          <p class="m-0 text-[13px] text-ig-muted">
            @if (notice.mode === null) {
              {{ t('periods.reopen.toastYearBody') }}
            } @else {
              {{ t(notice.mode === 'auto' ? 'periods.reopen.toastAuto' : 'periods.reopen.toastManual') }}
            }
          </p>
          @if (error()) {
            <p class="m-0 text-[13px]" role="alert">{{ error() }}</p>
          }
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button data-testid="period-notice-close-again" type="button" [class]="ui.secondary" [disabled]="isClosing()" (click)="closeAgain()">
            {{ t('periods.reopen.closeAgain') }}
          </button>
          @if (notice.origin === 'form') {
            <button data-testid="period-notice-keep-going" type="button" [class]="ui.primary" (click)="dismiss()">
              {{ t('periods.reopen.keepGoing') }}
            </button>
          } @else {
            <button type="button" [class]="ui.icon" [attr.aria-label]="t('periods.actions.dismiss')" (click)="dismiss()">
              <svg lucideX [size]="18" aria-hidden="true"></svg>
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class PeriodOverlaysComponent {
  private readonly workspace = inject(PeriodWorkspace);
  private readonly transloco = inject(TranslocoService);
  private readonly locale = inject(LanguageService).language;

  protected readonly ui = PERIOD_UI;
  protected readonly notice = computed(() => this.workspace.notice());
  protected readonly isClosing = signal(false);
  protected readonly error = signal('');

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Cada aviso nuevo reinicia su temporizador.
    effect(() => {
      const notice = this.workspace.notice();
      clearTimeout(timer);
      this.error.set('');

      if (notice) {
        timer = setTimeout(() => this.dismiss(), NOTICE_MS);
      }
    });

    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  protected monthTitle(month: number): string {
    return capitalized(monthName(month, this.locale()), this.locale());
  }

  protected dismiss(): void {
    this.workspace.notice.set(null);
  }

  /** «Cerrar de nuevo»: cierra el período sin pasar por el panel. */
  protected closeAgain(): void {
    const notice = this.notice();

    if (!notice || this.isClosing()) {
      return;
    }

    this.isClosing.set(true);
    this.workspace.close(notice.period).subscribe({
      next: () => {
        this.isClosing.set(false);
        this.dismiss();
      },
      error: (error: unknown) => {
        this.isClosing.set(false);
        this.error.set(error instanceof PeriodError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY));
      },
    });
  }
}
