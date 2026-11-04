import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideCalendar,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
} from '@lucide/angular';
import { LanguageService } from '@core/i18n/language.service';
import {
  CalendarDate,
  addDays,
  addMonths,
  clampDate,
  formatCalendarDate,
  monthGrid,
  monthOf,
  monthStart,
  parseCalendarDate,
  startOfMonth,
  startOfWeek,
  toCalendarDate,
  yearOf,
} from './calendar-date';

/** Vista del calendario: los días de un mes o los meses de un año. */
type CalendarView = 'days' | 'months';

/** Un día de la cuadrícula con todo lo que la plantilla necesita para pintarlo. */
interface CalendarDay {
  date: CalendarDate;
  day: number;
  /** Nombre completo de la fecha para lectores de pantalla. */
  label: string;
  outside: boolean;
  disabled: boolean;
  selected: boolean;
  today: boolean;
}

/** Un mes de la vista de meses. */
interface CalendarMonth {
  date: CalendarDate;
  label: string;
  disabled: boolean;
  selected: boolean;
  current: boolean;
}

/** Atajo a una fecha cercana a hoy. */
interface CalendarShortcut {
  key: 'today' | 'yesterday' | 'lastWeek';
  date: CalendarDate;
}

let nextId = 0;

/**
 * Selector de fecha con el calendario dibujado con el tema, en lugar del nativo del navegador.
 * Se usa como cualquier control de formulario (`formControlName`) y guarda `YYYY-MM-DD`.
 * Ofrece atajos (hoy, ayer, hace 7 días), una vista de meses y navegación con el teclado;
 * los días fuera de `[min, max]` se ven pero no se pueden elegir. En mobile se abre como hoja inferior.
 */
@Component({
  selector: 'app-date-picker',
  imports: [
    TranslocoDirective,
    LucideCalendar,
    LucideChevronDown,
    LucideChevronLeft,
    LucideChevronRight,
  ],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePickerComponent), multi: true },
  ],
  host: {
    class: 'relative block',
    '(focusout)': 'onFocusOut($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './date-picker.component.html',
})
export class DatePickerComponent implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly locale = inject(LanguageService).language;

  /** Hoy, en la zona horaria que decide qué fecha es futura; por defecto, la del navegador. */
  readonly today = input<CalendarDate>(localToday());
  /** Fecha más temprana elegible (`YYYY-MM-DD`). */
  readonly min = input<CalendarDate | null>(null);
  /** Fecha más tardía elegible (`YYYY-MM-DD`). */
  readonly max = input<CalendarDate | null>(null);
  /** `id` del botón, para que un `<label for>` lo nombre. */
  readonly inputId = input(`app-date-picker-${nextId++}`);
  readonly invalid = input(false);
  /** Ids de las ayudas o errores que describen el campo. */
  readonly describedBy = input<string | null>(null);

  protected readonly dialogId = computed(() => `${this.inputId()}-calendar`);
  protected readonly titleId = computed(() => `${this.inputId()}-calendar-title`);

  protected readonly value = signal<CalendarDate | null>(null);
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);
  protected readonly view = signal<CalendarView>('days');
  /** Primer día del mes que se está mostrando. */
  protected readonly visibleMonth = signal<CalendarDate>(startOfMonth(localToday()));
  /** Día que recibe el foco del teclado dentro de la cuadrícula. */
  protected readonly activeDate = signal<CalendarDate>(localToday());

  /** Texto del botón: la fecha corta, o `null` si no hay una fecha válida. */
  protected readonly formattedValue = computed(() => {
    const value = this.value();

    return value && parseCalendarDate(value)
      ? formatCalendarDate(value, this.locale(), {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;
  });

  /** Clave de la etiqueta relativa ("Hoy, …", "Ayer, …") o `null` para la fecha sola. */
  protected readonly relativeKey = computed(() => {
    const value = this.value();

    if (value === this.today()) {
      return 'datePicker.relativeToday';
    }

    return value === addDays(this.today(), -1) ? 'datePicker.relativeYesterday' : null;
  });

  protected readonly monthLabel = computed(() =>
    formatCalendarDate(this.visibleMonth(), this.locale(), { month: 'long', year: 'numeric' }),
  );

  protected readonly yearLabel = computed(() => String(yearOf(this.visibleMonth())));

  protected readonly weekdays = computed(() =>
    monthGrid(this.visibleMonth())
      .slice(0, 7)
      .map((date) => ({
        short: formatCalendarDate(date, this.locale(), { weekday: 'short' }),
        long: formatCalendarDate(date, this.locale(), { weekday: 'long' }),
      })),
  );

  protected readonly days = computed<CalendarDay[]>(() => {
    const month = monthOf(this.visibleMonth());
    const locale = this.locale();

    return monthGrid(this.visibleMonth()).map((date) => ({
      date,
      day: parseCalendarDate(date)!.getUTCDate(),
      label: formatCalendarDate(date, locale, { dateStyle: 'full' }),
      outside: monthOf(date) !== month,
      disabled: !this.isSelectable(date),
      selected: date === this.value(),
      today: date === this.today(),
    }));
  });

  /** Las seis filas de la cuadrícula, para que cada semana sea una fila de la tabla. */
  protected readonly weeks = computed(() => {
    const days = this.days();

    return Array.from({ length: days.length / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7));
  });

  protected readonly months = computed<CalendarMonth[]>(() => {
    const year = yearOf(this.visibleMonth());
    const value = this.value();

    return Array.from({ length: 12 }, (_, month) => {
      const date = monthStart(year, month);

      return {
        date,
        label: formatCalendarDate(date, this.locale(), { month: 'short' }),
        disabled: !this.monthHasSelectableDays(date),
        selected: !!value && value.slice(0, 7) === date.slice(0, 7),
        current: this.today().slice(0, 7) === date.slice(0, 7),
      };
    });
  });

  protected readonly shortcuts = computed<CalendarShortcut[]>(() => {
    const today = this.today();
    const shortcuts: CalendarShortcut[] = [
      { key: 'today', date: today },
      { key: 'yesterday', date: addDays(today, -1) },
      { key: 'lastWeek', date: addDays(today, -7) },
    ];

    return shortcuts.filter((shortcut) => this.isSelectable(shortcut.date));
  });

  /** Si se puede ir al mes (o año) anterior sin quedar fuera del rango. */
  protected readonly canGoBack = computed(() => {
    const min = this.min();

    if (!min) {
      return true;
    }

    return this.view() === 'days'
      ? this.visibleMonth() > startOfMonth(min)
      : yearOf(this.visibleMonth()) > yearOf(min);
  });

  /** Si se puede ir al mes (o año) siguiente sin quedar fuera del rango. */
  protected readonly canGoForward = computed(() => {
    const max = this.max();

    if (!max) {
      return true;
    }

    return this.view() === 'days'
      ? addMonths(this.visibleMonth(), 1) <= max
      : yearOf(this.visibleMonth()) < yearOf(max);
  });

  private onChange: (value: CalendarDate | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: CalendarDate | null): void {
    this.value.set(value || null);
  }

  registerOnChange(fn: (value: CalendarDate | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled.set(disabled);
    this.close(false);
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close(true);
    } else {
      this.open();
    }
  }

  /** Con el calendario cerrado, la flecha abajo o arriba lo abre. */
  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open();
    }
  }

  protected choose(date: CalendarDate): void {
    if (!this.isSelectable(date)) {
      return;
    }

    this.value.set(date);
    this.onChange(date);
    this.onTouched();
    this.close(true);
  }

  /** Cambia entre la vista de días y la de meses. */
  protected toggleView(): void {
    this.view.update((view) => (view === 'days' ? 'months' : 'days'));
  }

  protected chooseMonth(month: CalendarMonth): void {
    if (month.disabled) {
      return;
    }

    this.visibleMonth.set(month.date);
    this.activeDate.set(this.firstSelectableIn(month.date));
    this.view.set('days');
    this.focusActiveDay();
  }

  /** Va al mes anterior (`-1`) o siguiente (`1`); en la vista de meses, al año. */
  protected step(direction: -1 | 1): void {
    if (direction < 0 ? !this.canGoBack() : !this.canGoForward()) {
      return;
    }

    const months = this.view() === 'days' ? direction : direction * 12;
    const target = addMonths(this.visibleMonth(), months);
    this.visibleMonth.set(target);

    if (this.view() === 'days') {
      this.activeDate.set(this.firstSelectableIn(target));
    }
  }

  /**
   * Flechas (día y semana), Inicio/Fin (semana), RePág/AvPág (mes) e Intro/Espacio (elegir) sobre
   * la cuadrícula. El foco nunca cae en un día fuera del rango.
   */
  protected onGridKeydown(event: KeyboardEvent): void {
    const active = this.activeDate();
    let target: CalendarDate;

    switch (event.key) {
      case 'ArrowLeft':
        target = addDays(active, -1);
        break;
      case 'ArrowRight':
        target = addDays(active, 1);
        break;
      case 'ArrowUp':
        target = addDays(active, -7);
        break;
      case 'ArrowDown':
        target = addDays(active, 7);
        break;
      case 'Home':
        target = startOfWeek(active);
        break;
      case 'End':
        target = addDays(startOfWeek(active), 6);
        break;
      case 'PageUp':
        target = sameDayIn(active, -1);
        break;
      case 'PageDown':
        target = sameDayIn(active, 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.choose(active);
        return;
      default:
        return;
    }

    event.preventDefault();
    this.moveActive(clampDate(target, this.min(), this.max()));
  }

  /** Escape cierra el calendario sin que llegue al panel que lo contiene. */
  protected onEscape(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.close(true);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;

    if (next && this.host.nativeElement.contains(next)) {
      return;
    }

    this.onTouched();
    this.close(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  /** El fondo de la hoja inferior (mobile) cierra el calendario. */
  protected onScrimClick(): void {
    this.close(true);
  }

  private open(): void {
    if (this.isDisabled()) {
      return;
    }

    const value = this.value();
    const start = clampDate(
      value && parseCalendarDate(value) ? value : this.today(),
      this.min(),
      this.max(),
    );
    this.activeDate.set(start);
    this.visibleMonth.set(startOfMonth(start));
    this.view.set('days');
    this.isOpen.set(true);
    this.focusActiveDay();
  }

  /** Cierra el calendario; `refocus` devuelve el foco al botón (al elegir o con Escape). */
  private close(refocus: boolean): void {
    if (!this.isOpen()) {
      return;
    }

    this.isOpen.set(false);

    if (refocus) {
      this.host.nativeElement
        .querySelector<HTMLButtonElement>('[data-date-picker-trigger]')
        ?.focus();
    }
  }

  private moveActive(date: CalendarDate): void {
    this.activeDate.set(date);

    if (startOfMonth(date) !== this.visibleMonth()) {
      this.visibleMonth.set(startOfMonth(date));
    }

    this.focusActiveDay();
  }

  /** Tras pintar la cuadrícula, el foco va al día activo. */
  private focusActiveDay(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLButtonElement>('[data-active-day="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }

  private isSelectable(date: CalendarDate): boolean {
    const min = this.min();
    const max = this.max();

    return (!min || date >= min) && (!max || date <= max);
  }

  private monthHasSelectableDays(first: CalendarDate): boolean {
    const last = addDays(addMonths(first, 1), -1);
    const min = this.min();
    const max = this.max();

    return (!min || last >= min) && (!max || first <= max);
  }

  /** El día elegido si está en ese mes; si no, hoy si está en ese mes; si no, el primer día elegible. */
  private firstSelectableIn(month: CalendarDate): CalendarDate {
    const value = this.value();

    if (value && startOfMonth(value) === month && this.isSelectable(value)) {
      return value;
    }

    if (startOfMonth(this.today()) === month && this.isSelectable(this.today())) {
      return this.today();
    }

    return clampDate(month, this.min(), this.max());
  }
}

/** Hoy en la zona horaria del navegador, como `YYYY-MM-DD`. */
function localToday(): CalendarDate {
  const now = new Date();

  return toCalendarDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** El mismo día del mes anterior o siguiente, acotado al último día de ese mes. */
function sameDayIn(date: CalendarDate, months: number): CalendarDate {
  const first = addMonths(date, months);
  const last = addDays(addMonths(first, 1), -1);
  const day = String(
    Math.min(parseCalendarDate(date)!.getUTCDate(), parseCalendarDate(last)!.getUTCDate()),
  ).padStart(2, '0');

  return `${first.slice(0, 7)}-${day}`;
}
