import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { MonthRange, monthsBetween } from '../../../domain/period';
import { PeriodError } from '../../../domain/period-error';
import { capitalized, monthName, monthYear } from '../../period-format';
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

    @if (opened(); as opened) {
      @if (openedStatus(); as status) {
      <div
        *transloco="let t"
        data-testid="period-opened"
        class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-[560px] flex-col gap-3 rounded-lg border border-ig-border bg-ig-surface p-4 text-ig-text shadow-[0_8px_24px_rgb(0_0_0/0.24)] sm:flex-row sm:items-center"
        role="status"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          @let one = openedCount() === 1;
          <!-- Con el cierre automático encendido, el backend los cierra en cuanto se consultan. -->
          @if (status === 'closed') {
            <p class="m-0 text-[14px] font-bold">
              @if (one) {
                {{ t('periods.opened.autoClosedOne', { month: title(opened.from) }) }}
              } @else {
                {{ t('periods.opened.autoClosedMany', { from: label(opened.from), to: label(opened.to) }) }}
              }
            </p>
            <p class="m-0 text-[13px] text-ig-muted">{{ t('periods.opened.autoClosedBody') }}</p>
          } @else if (one) {
            <p class="m-0 text-[14px] font-bold">{{ t('periods.opened.titleOne', { month: label(opened.from) }) }}</p>
            <p class="m-0 text-[13px] text-ig-muted">{{ t('periods.opened.bodyOne') }}</p>
          } @else {
            <p class="m-0 text-[14px] font-bold">
              {{ t('periods.opened.titleMany', { count: openedCount(), from: label(opened.from), to: label(opened.to) }) }}
            </p>
            <p class="m-0 text-[13px] text-ig-muted">{{ t('periods.opened.bodyMany') }}</p>
          }
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          @if (status === 'closed') {
            <button data-testid="period-opened-ok" type="button" [class]="ui.primary" (click)="dismissOpened()">
              {{ t('periods.opened.ok') }}
            </button>
          } @else {
            <button data-testid="period-opened-later" type="button" [class]="ui.secondary" (click)="dismissOpened()">
              {{ t('periods.opened.later') }}
            </button>
            <button data-testid="period-opened-close" type="button" [class]="ui.primary" (click)="closeOpened(opened)">
              {{ t(one ? 'periods.opened.closeOne' : 'periods.opened.closeMany') }}
            </button>
          }
        </div>
      </div>
      }
    }

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
  protected readonly opened = computed(() => this.workspace.opened());
  protected readonly openedCount = computed(() => {
    const opened = this.opened();

    return opened ? monthsBetween(opened.from, opened.to) : 0;
  });

  /**
   * Estado del último mes abierto, ya consultado de nuevo: `pending` (se ofrece cerrarlos) o `closed`
   * (el cierre automático los cerró). Mientras llegan los datos frescos el mes sigue `noActivity` y el
   * aviso espera.
   */
  protected readonly openedStatus = computed(() => {
    const opened = this.opened();
    const entry = opened ? this.workspace.years()[opened.to.year] : undefined;
    const status = entry?.status === 'ready' ? entry.data.months[opened!.to.month - 1]?.status : undefined;

    return status === 'pending' || status === 'closed' ? status : null;
  });
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

  protected label(period: { year: number; month: number }): string {
    return monthYear(period.year, period.month, this.locale());
  }

  /** Igual que `label`, con mayúscula inicial para abrir una frase. */
  protected title(period: { year: number; month: number }): string {
    return capitalized(this.label(period), this.locale());
  }

  protected dismissOpened(): void {
    this.workspace.opened.set(null);
  }

  /** Abre el panel de cierre del último mes abierto: el cierre en cascada cierra también los anteriores. */
  protected closeOpened(opened: MonthRange): void {
    this.workspace.opened.set(null);
    this.workspace.openClose({ year: opened.to.year, month: opened.to.month });
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
