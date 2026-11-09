import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LucideCircleCheck, LucideLoaderCircle, LucideLock, LucideX } from '@lucide/angular';
import { Subscription, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ReviewPeriodUseCase } from '../../../application/period-use-cases';
import { PeriodRef, PeriodReview, lastDayOf, openMonths } from '../../../domain/period';
import { PeriodError } from '../../../domain/period-error';
import { capitalized, formatAmount, formatRate, monthName, monthShort } from '../../period-format';
import { PERIOD_UI } from '../../period-ui';
import { PeriodWorkspace } from '../../period-workspace';

/** Estado de la revisión que se muestra antes de cerrar. */
type ReviewState =
  | { status: 'loading' }
  | { status: 'ready'; review: PeriodReview }
  | { status: 'error'; message: string };

/**
 * Panel lateral de 480px para revisar y cerrar un mes o un año (en mobile ocupa la pantalla). Se
 * abre cuando `PeriodWorkspace.closing` tiene un período y se cierra al vaciarlo. Usa un `<dialog>`
 * modal para atrapar el foco y cerrar con Escape.
 */
@Component({
  selector: 'app-close-panel',
  // El diálogo vive en la capa superior; el host no debe ocupar lugar en el contenedor.
  host: { class: 'contents' },
  imports: [RouterLink, TranslocoDirective, LucideCircleCheck, LucideLoaderCircle, LucideLock, LucideX],
  providers: [provideTranslocoScope('periods')],
  templateUrl: './close-panel.component.html',
})
export class ClosePanelComponent {
  private readonly workspace = inject(PeriodWorkspace);
  private readonly reviewPeriod = inject(ReviewPeriodUseCase);
  private readonly transloco = inject(TranslocoService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly ui = PERIOD_UI;
  protected readonly locale = inject(LanguageService).language;

  protected readonly period = this.workspace.closing;
  protected readonly state = signal<ReviewState>({ status: 'loading' });
  protected readonly isSubmitting = signal(false);
  protected readonly isUndoing = signal(false);
  protected readonly submitError = signal('');
  /** Período que se acaba de cerrar; reemplaza la revisión por la confirmación. */
  protected readonly done = signal<PeriodRef | null>(null);

  protected readonly review = computed(() => {
    const state = this.state();

    return state.status === 'ready' ? state.review : null;
  });

  /** Meses del año que siguen abiertos y que el cierre anual también cerrará. */
  protected readonly openMonths = computed(() => {
    const year = this.review()?.yearState;

    return year ? openMonths(year) : [];
  });

  private request: Subscription | null = null;

  constructor() {
    // Depende también del diálogo para no abrirlo antes de que exista en la vista.
    effect(() => {
      const period = this.period();
      const dialog = this.dialog()?.nativeElement;

      if (dialog) {
        untracked(() => (period ? this.open(period, dialog) : this.hide(dialog)));
      }
    });
  }

  protected monthLabel(month: number): string {
    return monthName(month, this.locale());
  }

  protected monthTitle(month: number): string {
    return capitalized(monthName(month, this.locale()), this.locale());
  }

  protected short(month: number): string {
    return monthShort(month, this.locale());
  }

  protected amount(value: number, currency: string): string {
    return formatAmount(value, currency, this.locale());
  }

  protected rate(value: number): string {
    return formatRate(value, this.locale());
  }

  /** «31 de octubre» / «October 31». */
  protected lastDay(period: PeriodRef): string {
    const date = lastDayOf(period.year, period.month ?? 12);
    const day = Number(date.slice(8));
    const month = monthName(period.month ?? 12, this.locale());

    return this.locale().startsWith('es') ? `${day} de ${month}` : `${capitalized(month, this.locale())} ${day}`;
  }

  protected retry(): void {
    const period = this.period();

    if (period) {
      this.load(period);
    }
  }

  protected confirm(): void {
    const period = this.period();

    if (!period || !this.review() || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set('');
    this.workspace
      .close(period)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.done.set(period);
          queueMicrotask(() => this.heading()?.nativeElement.focus());
        },
        error: (error: unknown) => this.submitError.set(this.messageOf(error)),
      });
  }

  /** «Deshacer»: reabre en el acto, sin diálogo, y vuelve a la revisión. */
  protected undo(): void {
    const period = this.done();

    if (!period || this.isUndoing()) {
      return;
    }

    this.isUndoing.set(true);
    this.submitError.set('');
    this.workspace
      .reopen(period, { recloseMode: 'manual', reason: null }, null)
      .pipe(finalize(() => this.isUndoing.set(false)))
      .subscribe({
        next: () => {
          this.done.set(null);
          this.load(period);
        },
        error: (error: unknown) => this.submitError.set(this.messageOf(error)),
      });
  }

  /** Cierra el panel; el evento `close` del diálogo termina de sincronizar el estado. */
  protected dismiss(): void {
    this.workspace.closing.set(null);
  }

  /** Escape o el velo cierran el diálogo por su cuenta: se refleja en el estado compartido. */
  protected onDialogClosed(): void {
    if (this.period()) {
      this.workspace.closing.set(null);
    }
  }

  /** Un clic en el velo (fuera del panel) lo cierra. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.dismiss();
    }
  }

  private open(period: PeriodRef, dialog: HTMLDialogElement): void {
    this.done.set(null);
    this.submitError.set('');
    this.load(period);

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    queueMicrotask(() => this.heading()?.nativeElement.focus());
  }

  private hide(dialog: HTMLDialogElement): void {
    this.request?.unsubscribe();

    if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }

  private load(period: PeriodRef): void {
    this.request?.unsubscribe();
    this.state.set({ status: 'loading' });
    this.request = this.reviewPeriod.execute(period).subscribe({
      next: (review) => this.state.set({ status: 'ready', review }),
      error: (error: unknown) => this.state.set({ status: 'error', message: this.messageOf(error) }),
    });
  }

  private messageOf(error: unknown): string {
    return error instanceof PeriodError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
