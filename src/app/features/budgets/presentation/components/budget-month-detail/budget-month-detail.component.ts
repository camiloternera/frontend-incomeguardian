import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ListBudgetMovementsUseCase } from '../../../application/budget-use-cases';
import { BudgetMonth, BudgetMovement, BudgetRow } from '../../../domain/budget';
import { BudgetError } from '../../../domain/budget-error';
import { formatMoney } from '../../budget-format';

/** Gastos de cuentas normales del mes: cargando, listos o con error. */
type MovementsState =
  | { status: 'loading' }
  | { status: 'ready'; movements: BudgetMovement[] }
  | { status: 'error'; message: string };

/** Una línea de «Lo que cuenta este mes»: una cuota con tarjeta o un gasto de una cuenta normal. */
interface SpentLine {
  key: string;
  transactionId: number;
  description: string | null;
  /** Texto de la cuota y la cuenta, ya traducido. */
  meta: string;
  amount: string;
  /** Fecha para ordenar, `YYYY-MM-DD` o instante ISO. */
  sortDate: string;
}

/**
 * Cómo se arma el tope de una categoría en el mes (el recurrente más lo que sumaron las cuotas) y qué
 * gastos cuentan en él: las cuotas con tarjeta que caen en el mes y los gastos de cuentas normales.
 */
@Component({
  selector: 'app-budget-month-detail',
  imports: [DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './budget-month-detail.component.html',
})
export class BudgetMonthDetailComponent {
  private readonly listMovements = inject(ListBudgetMovementsUseCase);
  private readonly transloco = inject(TranslocoService);

  readonly row = input.required<BudgetRow>();
  readonly month = input.required<BudgetMonth>();

  protected readonly locale = inject(LanguageService).language;
  protected readonly movements = signal<MovementsState>({ status: 'loading' });

  /** Desglose del tope cuando lo subieron las cuotas: recurrente, cada cuota y el tope del mes. */
  protected readonly capLines = computed(() => {
    const row = this.row();

    if (row.installmentsRaise <= 0) {
      return null;
    }

    const money = (amount: number) => formatMoney(amount, row.currency, this.locale());

    return {
      recurring: row.recurringAmount === null ? null : money(row.recurringAmount),
      adjustments: row.installments
        .filter((item) => item.budgetAdjustment > 0)
        .map((item) => ({
          key: `${item.transactionId}-${item.number}`,
          label: this.transloco.translate('budgets.detail.capInstallment', {
            number: item.number,
            total: item.installments,
            description: item.description ?? this.transloco.translate('budgets.detail.noDescription'),
          }),
          amount: money(item.budgetAdjustment),
        })),
      total: money(row.budgetAmount),
    };
  });

  /** Cuotas con tarjeta y gastos de cuentas normales, del más reciente al más antiguo. */
  protected readonly spentLines = computed<SpentLine[] | null>(() => {
    const row = this.row();
    const state = this.movements();
    const money = (amount: number) => formatMoney(amount, row.currency, this.locale());

    if (state.status !== 'ready') {
      return null;
    }

    const installments = row.installments.map((item) => ({
      key: `i-${item.transactionId}-${item.number}`,
      transactionId: item.transactionId,
      description: item.description,
      meta: this.transloco.translate(
        item.installments > 1 ? 'budgets.detail.installmentMeta' : 'budgets.detail.singleMeta',
        { number: item.number, total: item.installments, account: item.accountName },
      ),
      amount: money(item.amount),
      sortDate: item.purchaseDate,
    }));
    const movements = state.movements.map((item) => ({
      key: `m-${item.transactionId}`,
      transactionId: item.transactionId,
      description: item.description,
      meta: item.accountName,
      amount: money(item.amount),
      sortDate: item.date,
    }));

    return [...installments, ...movements].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  });

  constructor() {
    // Se vuelve a pedir al cambiar de fila o de mes.
    toObservable(computed(() => ({ row: this.row(), month: this.month() })))
      .pipe(
        switchMap(({ row, month }) =>
          row.categoryType === null
            ? of<MovementsState>({ status: 'ready', movements: [] })
            : this.listMovements.execute(month, { categoryId: row.categoryId, currency: row.currency }, row.categoryType).pipe(
                map((movements): MovementsState => ({ status: 'ready', movements })),
                catchError((error: unknown) =>
                  of<MovementsState>({
                    status: 'error',
                    message: error instanceof BudgetError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY),
                  }),
                ),
                startWith<MovementsState>({ status: 'loading' }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.movements.set(state));
  }

  /** Mes como `YYYY-MM-01` para el `DatePipe` en UTC. */
  protected monthDate(): string {
    const { year, month } = this.month();

    return `${year}-${String(month).padStart(2, '0')}-01`;
  }
}
