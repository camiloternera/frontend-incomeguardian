import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';
import {
  GetPeriodHistoryUseCase,
  GetPeriodSettingsUseCase,
  SavePeriodSettingsUseCase,
} from '../../../application/period-use-cases';
import { AUTO_CLOSE_DAYS, PeriodClosingSettings, PeriodLog } from '../../../domain/period';
import { PeriodError } from '../../../domain/period-error';
import { formatInstant, monthName } from '../../period-format';
import { PERIOD_UI } from '../../period-ui';

type LoadState<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };

/** Interruptores de la sección, en el orden en que se muestran. */
type SwitchKey = 'autoCloseEnabled' | 'closeYearWithDecember' | 'remindOnMonthEnd';

interface SwitchRow {
  key: SwitchKey;
  label: string;
  hint: string;
}

const SWITCHES: readonly SwitchRow[] = [
  { key: 'autoCloseEnabled', label: 'periods.settings.auto', hint: 'periods.settings.autoHint' },
  { key: 'closeYearWithDecember', label: 'periods.settings.year', hint: 'periods.settings.yearHint' },
  { key: 'remindOnMonthEnd', label: 'periods.settings.remind', hint: 'periods.settings.remindHint' },
];

/**
 * Sección «Cierre de períodos» dentro de Ajustes: preferencias de cierre automático y aviso, y el
 * historial de cierres y reaperturas. Cada cambio se guarda en el acto (optimista) y se revierte si falla.
 */
@Component({
  selector: 'app-period-settings',
  imports: [FormsModule, TranslocoDirective, SelectComponent],
  providers: [provideTranslocoScope('periods')],
  templateUrl: './period-settings.component.html',
})
export class PeriodSettingsComponent {
  private readonly getSettings = inject(GetPeriodSettingsUseCase);
  private readonly saveSettings = inject(SavePeriodSettingsUseCase);
  private readonly getHistory = inject(GetPeriodHistoryUseCase);
  private readonly transloco = inject(TranslocoService);

  protected readonly ui = PERIOD_UI;
  protected readonly locale = inject(LanguageService).language;
  protected readonly switches = SWITCHES;

  protected readonly settings = signal<LoadState<PeriodClosingSettings>>({ status: 'loading' });
  protected readonly history = signal<LoadState<PeriodLog[]>>({ status: 'loading' });
  protected readonly saveError = signal('');
  protected readonly isSaving = signal(false);

  protected readonly current = computed(() => {
    const state = this.settings();

    return state.status === 'ready' ? state.data : null;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.settings.set({ status: 'loading' });
    this.getSettings.execute().subscribe({
      next: (data) => this.settings.set({ status: 'ready', data }),
      error: (error: unknown) => this.settings.set({ status: 'error', message: this.messageOf(error) }),
    });
    this.loadHistory();
  }

  private dayOptionsCache: { key: string; options: SelectOption<number>[] } | null = null;

  /** Opciones del día de cierre; se reutiliza el arreglo mientras no cambie el idioma. */
  protected dayOptions(t: (key: string, params?: Record<string, unknown>) => string): SelectOption<number>[] {
    const options = AUTO_CLOSE_DAYS.map((day) => ({ value: day, label: t('periods.settings.dayOption', { day }) }));
    const key = options.map((option) => option.label).join('|');

    if (this.dayOptionsCache?.key !== key) {
      this.dayOptionsCache = { key, options };
    }

    return this.dayOptionsCache.options;
  }

  protected toggle(key: SwitchKey): void {
    const current = this.current();

    if (current) {
      this.save({ ...current, [key]: !current[key] });
    }
  }

  protected chooseDay(day: number | null): void {
    const current = this.current();

    if (current && day !== null && day !== current.autoCloseDay) {
      this.save({ ...current, autoCloseDay: day });
    }
  }

  /** Texto de una fila del historial. */
  protected logText(log: PeriodLog): string {
    const locale = this.locale();
    // El mes va en minúscula a mitad de frase en español; en inglés ya llega con mayúscula.
    const params = { year: log.year, month: log.month === null ? '' : monthName(log.month, locale) };
    const scope = log.month === null ? 'Year' : 'Month';

    if (log.action === 'reopen') {
      return this.transloco.translate(`periods.history.reopened${scope}`, params);
    }

    return this.transloco.translate(`periods.history.${log.automatic ? 'autoClosed' : 'closed'}${scope}`, params);
  }

  /** Nota de una fila: el motivo de la reapertura, o «automático» si lo cerró el sistema. */
  protected logNote(log: PeriodLog): string | null {
    if (log.action === 'reopen') {
      return log.reason;
    }

    return log.automatic ? this.transloco.translate('periods.history.automatic') : null;
  }

  protected logDate(log: PeriodLog): string {
    return formatInstant(log.createdAt, this.locale());
  }

  private loadHistory(): void {
    this.history.set({ status: 'loading' });
    this.getHistory.execute().subscribe({
      next: (data) => this.history.set({ status: 'ready', data }),
      error: (error: unknown) => this.history.set({ status: 'error', message: this.messageOf(error) }),
    });
  }

  private save(next: PeriodClosingSettings): void {
    const previous = this.current();

    if (!previous || this.isSaving()) {
      return;
    }

    this.settings.set({ status: 'ready', data: next });
    this.saveError.set('');
    this.isSaving.set(true);
    this.saveSettings.execute(next).subscribe({
      next: (data) => {
        this.isSaving.set(false);
        this.settings.set({ status: 'ready', data });
        // Al guardar, el backend puede cerrar en el acto los meses que ya vencieron.
        this.loadHistory();
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.settings.set({ status: 'ready', data: previous });
        this.saveError.set(this.messageOf(error));
      },
    });
  }

  private messageOf(error: unknown): string {
    return error instanceof PeriodError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
