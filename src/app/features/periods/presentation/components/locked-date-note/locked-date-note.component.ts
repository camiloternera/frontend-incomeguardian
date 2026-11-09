import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, provideTranslocoScope } from '@jsverse/transloco';
import { LucideLock } from '@lucide/angular';
import { LanguageService } from '@core/i18n/language.service';
import { isClosedDate, todayInPeriodZone, yearMonthOf } from '../../../domain/period';
import { capitalized, formatDayMonth, monthName } from '../../period-format';
import { PERIOD_UI } from '../../period-ui';
import { PeriodWorkspace } from '../../period-workspace';

/** Tipo de movimiento que se registra, para nombrarlo en la nota. */
export type LockedDateKind = 'income' | 'expense' | 'transfer';

/**
 * Nota bajo el campo Fecha de un formulario cuando la fecha elegida cae en un mes cerrado. Se valida
 * con los períodos cargados y también con el 409 PERIOD_CLOSED del backend (`markLocked`), por si
 * otro dispositivo cerró el mes. El formulario lee `locked()` para deshabilitar Guardar.
 */
@Component({
  selector: 'app-locked-date-note',
  // Sin caja propia: si no hay nada que mostrar, no suma un hueco al `gap` del contenedor.
  host: { class: 'contents' },
  imports: [TranslocoDirective, LucideLock],
  providers: [provideTranslocoScope('periods')],
  template: `
    @if (locked() && target(); as target) {
      <div
        *transloco="let t"
        data-testid="locked-date-note"
        class="flex flex-col gap-3 rounded-lg border border-ig-border bg-ig-surface p-4"
        role="status"
        [id]="noteId()"
      >
        <div class="flex items-start gap-3">
          <svg lucideLock [size]="18" class="mt-0.5 shrink-0 text-ig-text" aria-hidden="true"></svg>
          <div class="flex min-w-0 flex-col gap-1">
            <p class="m-0 text-[14px] font-bold">
              @if (yearClosed()) {
                {{ t('periods.lockedDate.yearTitle', { year: target.year }) }}
              } @else {
                {{ t('periods.lockedDate.title', { month: monthTitle(target.month), year: target.year }) }}
              }
            </p>
            <p class="m-0 text-[13px] leading-relaxed text-ig-muted">
              {{ t('periods.lockedDate.body', { type: t('periods.lockedDate.type.' + kind()), day: day(), month: monthLabel(target.month) }) }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 pl-[30px]">
          <button data-testid="locked-date-reopen" type="button" [class]="ui.accentOutline" (click)="reopen()">
            {{ t('periods.lockedDate.reopen', { month: monthLabel(target.month) }) }}
          </button>
          <button data-testid="locked-date-today" type="button" [class]="ui.secondary" (click)="useToday.emit(today)">
            {{ t('periods.lockedDate.useToday', { date: todayLabel() }) }}
          </button>
        </div>
      </div>
    }
  `,
})
export class LockedDateNoteComponent {
  private readonly workspace = inject(PeriodWorkspace);
  private readonly locale = inject(LanguageService).language;

  /**
   * Fecha elegida (`yyyy-MM-dd`). No es obligatoria: el formulario consulta `locked()` desde su
   * plantilla, a veces antes de que Angular asigne este input.
   */
  readonly date = input('');
  readonly kind = input<LockedDateKind>('expense');
  /** Id de la nota, para que el campo la enlace con `aria-describedby`. */
  readonly noteId = input('locked-date-note');
  /** Pide al formulario usar la fecha de hoy. */
  readonly useToday = output<string>();

  protected readonly ui = PERIOD_UI;
  protected readonly today = todayInPeriodZone();

  /** Fecha que el backend rechazó con PERIOD_CLOSED aunque los datos locales digan que está abierta. */
  private readonly rejectedDate = signal<string | null>(null);

  protected readonly target = computed(() => yearMonthOf(this.date()));

  private readonly year = computed(() => {
    const target = this.target();
    const entry = target ? this.workspace.years()[target.year] : undefined;

    return entry?.status === 'ready' ? entry.data : null;
  });

  protected readonly yearClosed = computed(() => this.year()?.yearClosed ?? false);

  /** Si la fecha elegida cae en un mes cerrado. */
  readonly locked = computed(() => {
    const date = this.date();
    const year = this.year();

    return this.rejectedDate() === date || (!!date && !!year && isClosedDate(year, date));
  });

  constructor() {
    effect(() => {
      const target = this.target();

      if (target) {
        untracked(() => this.workspace.loadYear(target.year));
      }
    });

    // Tras reabrir o cerrar un período, los datos frescos mandan sobre el rechazo anterior.
    this.workspace.changed$.pipe(takeUntilDestroyed()).subscribe(() => this.rejectedDate.set(null));
  }

  /** El backend rechazó la fecha con PERIOD_CLOSED: se bloquea y se refrescan los períodos. */
  markLocked(date: string): void {
    this.rejectedDate.set(date);
    const target = yearMonthOf(date);

    if (target) {
      this.workspace.loadYear(target.year, true);
    }
  }

  protected monthLabel(month: number): string {
    return monthName(month, this.locale());
  }

  protected monthTitle(month: number): string {
    return capitalized(monthName(month, this.locale()), this.locale());
  }

  protected day(): number {
    return Number(this.date().slice(8, 10));
  }

  protected todayLabel(): string {
    return formatDayMonth(this.today, this.locale());
  }

  protected reopen(): void {
    const target = this.target();

    if (target) {
      this.workspace.openReopen({ year: target.year, month: target.month }, 'form');
    }
  }
}
