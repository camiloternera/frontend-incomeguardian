import { formatNumber } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCheck, LucideShield } from '@lucide/angular';
import { LanguageService } from '@core/i18n/language.service';
import { formatMoney } from '@shared/money/money-format';
import { Cushion, CushionCurrency, CushionState, cushionState, cushionSurplus } from '../../../domain/cushion';

/** Texto que reemplaza un monto cuando el usuario decide ocultarlos. */
const MASK = '•••••';

/** Estado de carga del colchón que maneja la página. */
export type CushionLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; cushion: Cushion };

/** Una moneda lista para pintar. */
interface CushionRow {
  currency: string;
  state: CushionState;
  row: CushionCurrency;
  /** Relleno de la barra hacia la meta, de 0 a 1. */
  fill: number;
}

/**
 * Tarjeta «Tu colchón» del Resumen: cuántos meses de gasto cubren los ahorros de las cuentas marcadas, por moneda.
 * No convierte ni suma monedas. «Ajustar» y «Elegir cuentas» emiten `configure` para abrir la hoja.
 */
@Component({
  selector: 'app-cushion-card',
  imports: [TranslocoDirective, LucideShield, LucideCheck],
  templateUrl: './cushion-card.component.html',
})
export class CushionCardComponent {
  private readonly languageService = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  readonly load = input.required<CushionLoad>();
  readonly amountsHidden = input(false);

  readonly configure = output<void>();
  readonly retry = output<void>();

  protected readonly locale = this.languageService.language;

  protected readonly cushion = computed(() => {
    const load = this.load();

    return load.status === 'ready' ? load.cushion : null;
  });

  protected readonly rows = computed<CushionRow[]>(() => {
    const cushion = this.cushion();

    if (!cushion?.hasCushionAccounts) {
      return [];
    }

    return cushion.currencies.map((row) => ({
      currency: row.currency,
      state: cushionState(row),
      row,
      fill: row.monthsCovered === null || cushion.goalMonths <= 0 ? 0 : Math.min(1, Math.max(0, row.monthsCovered / cushion.goalMonths)),
    }));
  });

  /** Con varias monedas cada fila lleva su etiqueta y una cifra más pequeña. */
  protected readonly multi = computed(() => this.rows().length > 1);

  /** Nombres de las cuentas marcadas para el pie de la tarjeta. */
  protected readonly accountNames = computed(() =>
    (this.cushion()?.currencies ?? []).flatMap((row) => row.accounts.map((account) => account.name)).join(', '),
  );

  /** Segmentos de la barra: uno por mes de la meta. */
  protected readonly segments = computed(() => Array.from({ length: this.cushion()?.goalMonths ?? 0 }, (_, index) => index));

  protected money(value: number, currency: string): string {
    if (this.amountsHidden()) {
      return MASK;
    }

    const hasCents = currency !== 'COP' && !Number.isInteger(value);

    return formatMoney(value, currency, this.locale(), hasCents ? '1.2-2' : '1.0-0').replace(/^-/, '−');
  }

  /** Meses con un decimal: «2,4». */
  protected months(value: number | null): string {
    return formatNumber(value ?? 0, this.locale(), '1.1-1');
  }

  /** «los últimos 5 meses» o «el último mes». */
  protected period(row: CushionCurrency): string {
    return row.monthsUsed === 1
      ? this.transloco.translate('dashboard.home.cushion.periodOne')
      : this.transloco.translate('dashboard.home.cushion.periodMany', { count: row.monthsUsed });
  }

  protected currencyName(currency: string): string {
    const key = `dashboard.home.cushion.currencyName.${currency}`;
    const name = this.transloco.translate(key);

    return name === key ? currency : name;
  }

  protected currencyLabel(currency: string): string {
    const key = `dashboard.home.cushion.currencyLabel.${currency}`;
    const label = this.transloco.translate(key);

    return label === key ? currency : label;
  }

  /** Relleno de un segmento (un mes de la meta), de 0 a 1. */
  protected segmentFill(fill: number, segment: number): number {
    // Redondeado a milésimas para que 2,4 de 6 dé 40 % y no 39,999…
    return Math.round(Math.min(1, Math.max(0, fill * this.segments().length - segment)) * 1000) / 1000;
  }

  protected surplus(row: CushionCurrency): number {
    return cushionSurplus(row);
  }
}
