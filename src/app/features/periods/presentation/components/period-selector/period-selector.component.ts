import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { TranslocoDirective, provideTranslocoScope } from '@jsverse/transloco';
import { LucideChevronDown, LucideChevronLeft, LucideChevronRight, LucideLock, LucideX } from '@lucide/angular';
import { LanguageService } from '@core/i18n/language.service';
import {
  PeriodMonth,
  PeriodYear,
  daysBetween,
  defaultMonthOf,
  lastDayOf,
  todayInPeriodZone,
  yearMonthOf,
} from '../../../domain/period';
import { capitalized, formatDay, formatInstant, monthName, monthShort } from '../../period-format';
import { PERIOD_UI } from '../../period-ui';
import { PeriodWorkspace } from '../../period-workspace';

/** Texto traducible: clave y parámetros. */
interface Copy {
  key: string;
  params?: Record<string, unknown>;
}

/** Acción que ofrece la fila de detalle del mes elegido. */
type MonthAction = 'close' | 'reopen' | null;

/** Acción de la fila del año. */
type YearAction = 'close' | 'closeDisabled' | 'reopen' | null;

let nextId = 0;

/**
 * Botón del mes del encabezado que abre los períodos del año: popover en desktop y hoja inferior en
 * mobile. Es el único lugar desde donde se cierran y reabren meses y años. Elegir un mes no navega:
 * solo muestra su estado y su acción.
 */
@Component({
  selector: 'app-period-selector',
  imports: [TranslocoDirective, LucideChevronDown, LucideChevronLeft, LucideChevronRight, LucideLock, LucideX],
  providers: [provideTranslocoScope('periods')],
  templateUrl: './period-selector.component.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class PeriodSelectorComponent {
  private readonly workspace = inject(PeriodWorkspace);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popover = viewChild<ElementRef<HTMLElement>>('popover');

  protected readonly ui = PERIOD_UI;
  protected readonly locale = inject(LanguageService).language;
  protected readonly dialogId = `period-selector-${nextId++}`;
  protected readonly today = todayInPeriodZone();
  protected readonly currentYear = yearMonthOf(this.today)!.year;
  protected readonly currentMonth = yearMonthOf(this.today)!.month;

  protected readonly isOpen = signal(false);
  protected readonly year = signal(this.currentYear);
  protected readonly selectedMonth = signal(this.currentMonth);

  protected readonly entry = computed(() => this.workspace.years()[this.year()] ?? { status: 'loading' as const });
  protected readonly data = computed(() => {
    const entry = this.entry();

    return entry.status === 'ready' ? entry.data : null;
  });

  /** Mes pendiente pospuesto con «Más tarde»: se recuerda con una pastilla junto al botón. */
  protected readonly snoozedPending = computed(() => {
    const pending = this.workspace.pending();

    return pending && this.workspace.isSnoozed(pending) ? pending : null;
  });

  protected readonly selected = computed(() => this.data()?.months[this.selectedMonth() - 1] ?? null);

  protected readonly canGoBack = computed(() => {
    const first = this.data()?.firstActivity;

    return !!first && this.year() > Number(first.slice(0, 4));
  });
  protected readonly canGoForward = computed(() => this.year() < this.currentYear);

  protected readonly yearAction = computed<YearAction>(() => {
    const data = this.data();

    if (!data) {
      return null;
    }

    if (data.yearClosed) {
      return data.canReopenYear ? 'reopen' : null;
    }

    return data.canCloseYear ? 'close' : 'closeDisabled';
  });

  constructor() {
    this.workspace.loadYear(this.currentYear);
    this.workspace.loadPending();

    // Al cambiar de año (o al llegar sus datos) se elige el mes que más conviene revisar.
    let positioned: number | null = null;
    effect(() => {
      const data = this.data();

      if (data && positioned !== data.year) {
        positioned = data.year;
        this.selectedMonth.set(defaultMonthOf(data, this.today));
      }
    });
  }

  protected currentLabel(): string {
    return capitalized(`${monthName(this.currentMonth, this.locale())} ${this.currentYear}`, this.locale());
  }

  protected short(month: number): string {
    return monthShort(month, this.locale());
  }

  protected long(month: number): string {
    return capitalized(monthName(month, this.locale()), this.locale());
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.year.set(this.currentYear);
      this.workspace.loadYear(this.currentYear, true);
      this.isOpen.set(true);
      queueMicrotask(() => this.popover()?.nativeElement.focus());
    }
  }

  /** Cierra el selector y devuelve el foco al botón del mes. */
  protected close(): void {
    this.isOpen.set(false);
    this.trigger()?.nativeElement.focus();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  protected shiftYear(delta: number): void {
    const year = this.year() + delta;
    this.year.set(year);
    this.workspace.loadYear(year);
  }

  protected retry(): void {
    this.workspace.loadYear(this.year(), true);
  }

  protected choose(month: PeriodMonth): void {
    if (month.status !== 'future') {
      this.selectedMonth.set(month.month);
    }
  }

  protected monthAction(month: PeriodMonth): MonthAction {
    if (month.status === 'pending' && month.canClose) {
      return 'close';
    }

    return month.status === 'closed' && month.canReopen ? 'reopen' : null;
  }

  protected closeMonth(month: PeriodMonth): void {
    this.isOpen.set(false);
    this.workspace.openClose({ year: this.year(), month: month.month });
  }

  protected reopenMonth(month: PeriodMonth): void {
    this.isOpen.set(false);
    this.workspace.openReopen({ year: this.year(), month: month.month });
  }

  protected closeYear(): void {
    this.isOpen.set(false);
    this.workspace.openClose({ year: this.year(), month: null });
  }

  protected reopenYear(): void {
    this.isOpen.set(false);
    this.workspace.openReopen({ year: this.year(), month: null });
  }

  protected openSnoozed(): void {
    const pending = this.snoozedPending();

    if (pending) {
      this.workspace.openClose({ year: pending.year, month: pending.month });
    }
  }

  /** Estado del mes para el lector de pantalla y la fila de detalle. */
  protected detail(month: PeriodMonth, year: PeriodYear): Copy {
    const locale = this.locale();

    switch (month.status) {
      case 'closed': {
        const date = month.closedAt ? formatInstant(month.closedAt, locale) : '';

        if (year.yearClosed && month.closedAt && month.closedAt === year.yearClosedAt) {
          return { key: 'periods.detail.closedWithYear', params: { date } };
        }

        return { key: month.closedAutomatically ? 'periods.detail.closedAuto' : 'periods.detail.closed', params: { date } };
      }
      case 'pending':
      case 'current': {
        if (month.reopenedAt) {
          return month.recloseMode === 'auto' && month.recloseAt
            ? { key: 'periods.detail.reopenedAuto', params: { date: formatInstant(month.recloseAt, locale) } }
            : { key: 'periods.detail.reopenedManual' };
        }

        if (month.status === 'current') {
          return { key: 'periods.detail.current' };
        }

        const days = Math.max(1, daysBetween(lastDayOf(year.year, month.month), this.today));

        return days === 1 ? { key: 'periods.detail.pendingOne' } : { key: 'periods.detail.pending', params: { days } };
      }
      case 'future':
        return { key: 'periods.detail.future' };
      case 'noActivity':
        return { key: 'periods.detail.noActivity' };
    }
  }

  /** Línea extra del detalle: cuándo se cierra solo o por qué aún no se puede cerrar. */
  protected detailHint(month: PeriodMonth): Copy | null {
    if (month.status !== 'pending' || month.reopenedAt) {
      return null;
    }

    if (!month.canClose) {
      return { key: 'periods.detail.previousOpen' };
    }

    return month.autoCloseOn
      ? { key: 'periods.detail.autoCloseOn', params: { date: formatDay(month.autoCloseOn, this.locale()) } }
      : null;
  }

  protected yearHint(year: PeriodYear): Copy {
    if (year.yearClosed) {
      return { key: 'periods.yearHint.closed', params: { date: year.yearClosedAt ? formatInstant(year.yearClosedAt, this.locale()) : '' } };
    }

    if (year.canCloseYear) {
      return { key: 'periods.yearHint.ready' };
    }

    return year.year >= this.currentYear ? { key: 'periods.yearHint.open' } : { key: 'periods.yearHint.previousOpen' };
  }

  /** Clases de cada botón de mes según su estado y si es el elegido. */
  protected monthClass(month: PeriodMonth): string {
    const base = `relative flex min-h-12 items-center justify-between gap-1 rounded-lg border px-3 text-[14px] sm:min-h-11 ${this.ui.focus}`;

    if (month.month === this.selectedMonth() && month.status !== 'future') {
      return `${base} border-ig-accent bg-ig-accent/15 font-bold text-ig-text`;
    }

    switch (month.status) {
      case 'closed':
        return `${base} border-ig-border bg-ig-surface text-ig-muted hover:border-ig-muted`;
      case 'pending':
        return `${base} border-ig-border bg-transparent font-medium text-ig-text hover:border-ig-muted`;
      case 'future':
        return `${base} cursor-not-allowed border-ig-border bg-transparent text-ig-muted opacity-60`;
      case 'noActivity':
        return `${base} border-transparent bg-transparent text-ig-muted hover:border-ig-border`;
      default:
        return `${base} border-ig-border bg-transparent text-ig-text hover:border-ig-muted`;
    }
  }
}
