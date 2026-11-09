import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LucideLoaderCircle, LucideLockOpen } from '@lucide/angular';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { PERIOD_REASON_MAX_LENGTH, RecloseMode, todayInPeriodZone } from '../../../domain/period';
import { PeriodError } from '../../../domain/period-error';
import { capitalized, formatDay, monthName } from '../../period-format';
import { PERIOD_UI } from '../../period-ui';
import { PeriodWorkspace } from '../../period-workspace';

/** Día siguiente a `date` (`yyyy-MM-dd`). */
function nextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * Modal para reabrir un mes o un año (en mobile, hoja inferior). Se abre cuando
 * `PeriodWorkspace.reopening` tiene un período. Al confirmar se cierra y el workspace publica el aviso.
 */
@Component({
  selector: 'app-reopen-dialog',
  // El diálogo vive en la capa superior; el host no debe ocupar lugar en el contenedor.
  host: { class: 'contents' },
  imports: [FormsModule, TranslocoDirective, LucideLoaderCircle, LucideLockOpen],
  providers: [provideTranslocoScope('periods')],
  templateUrl: './reopen-dialog.component.html',
})
export class ReopenDialogComponent {
  private readonly workspace = inject(PeriodWorkspace);
  private readonly transloco = inject(TranslocoService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly ui = PERIOD_UI;
  protected readonly locale = inject(LanguageService).language;
  protected readonly reasonMax = PERIOD_REASON_MAX_LENGTH;

  protected readonly target = this.workspace.reopening;
  protected readonly mode = signal<RecloseMode>('auto');
  protected readonly reason = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly error = signal('');

  /** Si el mes que se reabre pertenece a un año cerrado (el año también se reabrirá). */
  protected readonly inClosedYear = computed(() => {
    const target = this.target();

    if (!target || target.period.month === null) {
      return false;
    }

    const entry = this.workspace.years()[target.period.year];

    return entry?.status === 'ready' && entry.data.yearClosed;
  });

  /** Fecha en que se vuelve a cerrar solo: mañana, en hora de Colombia. */
  protected readonly recloseDate = computed(() => formatDay(nextDay(todayInPeriodZone()), this.locale()));

  constructor() {
    effect(() => {
      const target = this.target();
      const dialog = this.dialog()?.nativeElement;

      if (dialog) {
        untracked(() => (target ? this.open(dialog) : this.hide(dialog)));
      }
    });
  }

  protected monthLabel(month: number): string {
    return monthName(month, this.locale());
  }

  protected monthTitle(month: number): string {
    return capitalized(monthName(month, this.locale()), this.locale());
  }

  protected confirm(): void {
    const target = this.target();

    if (!target || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set('');
    this.workspace
      .reopen(target.period, { recloseMode: this.mode(), reason: this.reason() }, target.origin)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => this.workspace.reopening.set(null),
        error: (error: unknown) => this.error.set(this.messageOf(error)),
      });
  }

  protected cancel(): void {
    this.workspace.reopening.set(null);
  }

  protected onDialogClosed(): void {
    if (this.target()) {
      this.workspace.reopening.set(null);
    }
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.cancel();
    }
  }

  private open(dialog: HTMLDialogElement): void {
    this.mode.set('auto');
    this.reason.set('');
    this.error.set('');

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
    if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }

  private messageOf(error: unknown): string {
    return error instanceof PeriodError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
