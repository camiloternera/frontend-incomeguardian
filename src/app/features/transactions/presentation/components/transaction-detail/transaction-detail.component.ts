import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';
import { catchError, of } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ClosedMonthBadgeComponent, PeriodOverlaysComponent } from '@features/periods';
import {
  GetTransactionUseCase,
  ListTransactionAccountOptionsUseCase,
  ListTransactionCategoryOptionsUseCase,
} from '../../../application/transaction-use-cases';
import {
  InstallmentScheduleItem,
  Transaction,
  TransactionAccountOption,
  TransactionCategoryOption,
  dayOf,
} from '../../../domain/transaction';
import { TransactionError, TransactionErrorCode } from '../../../domain/transaction-error';
import { formatMoney } from '../../money-format';
import { injectTransactionsTranslations } from '../../transactions-translations';

/** Estado del detalle: cargando, listo, error al cargar o movimiento inexistente. */
type DetailStatus = 'loading' | 'ready' | 'error' | 'notFound';

/**
 * Estado de una cuota respecto al próximo corte de la tarjeta: ya facturada en un extracto
 * anterior, en el extracto que está abierto, o pendiente de un corte futuro.
 */
export type InstallmentState = 'billed' | 'current' | 'pending';

/** Una fila del plan de cuotas con su estado. */
interface ScheduleRow {
  item: InstallmentScheduleItem;
  state: InstallmentState;
}

/** Ruta del listado, a la que vuelve el detalle al cerrarse. */
const LIST_URL = '/transactions';

/** Estado de una cuota según la fecha de corte del extracto abierto de la tarjeta. */
export function installmentState(item: InstallmentScheduleItem, nextStatementDate: string | null): InstallmentState {
  if (nextStatementDate === null) {
    return 'pending';
  }

  if (item.statementDate < nextStatementDate) {
    return 'billed';
  }

  return item.statementDate === nextStatementDate ? 'current' : 'pending';
}

/**
 * Detalle de un movimiento con su plan de cuotas: qué cuota se facturó, cuál está en el extracto
 * abierto y cuánto falta. Vive en la ruta hija `:id` del listado.
 */
@Component({
  selector: 'app-transaction-detail',
  imports: [DatePipe, DecimalPipe, RouterLink, TranslocoDirective, LucideX, ClosedMonthBadgeComponent, PeriodOverlaysComponent],
  templateUrl: './transaction-detail.component.html',
})
export class TransactionDetailComponent {
  private readonly getTransaction = inject(GetTransactionUseCase);
  private readonly transloco = inject(TranslocoService);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly listUrl = LIST_URL;
  protected readonly locale = inject(LanguageService).language;

  protected readonly status = signal<DetailStatus>('loading');
  protected readonly loadError = signal('');
  protected readonly transaction = signal<Transaction | null>(null);
  private transactionId: number | null = null;

  private readonly accounts = toSignal(
    inject(ListTransactionAccountOptionsUseCase)
      .execute()
      .pipe(catchError(() => of<TransactionAccountOption[]>([]))),
    { initialValue: [] },
  );
  private readonly translations = injectTransactionsTranslations();
  private readonly categoryOptions = toSignal(
    inject(ListTransactionCategoryOptionsUseCase)
      .execute()
      .pipe(catchError(() => of<TransactionCategoryOption[]>([]))),
    { initialValue: [] },
  );
  /** Nombre de cada categoría; las del sistema se nombran por su código cuando el scope ya cargó. */
  private readonly categoryNames = computed(() => {
    const ready = this.translations() !== null;

    return new Map(
      this.categoryOptions().map((category) => [
        category.id,
        category.code && ready ? this.transloco.translate(`transactions.systemCategories.${category.code}`) : category.name,
      ]),
    );
  });

  /** Cuenta de la que salió el gasto (la tarjeta, en una compra a cuotas). */
  protected readonly account = computed(() => {
    const id = this.transaction()?.fromAccountId ?? this.transaction()?.toAccountId ?? null;

    return id === null ? null : (this.accounts().find((account) => account.id === id) ?? null);
  });

  protected readonly categoryName = computed(() => {
    const id = this.transaction()?.categoryId;

    return id == null ? null : (this.categoryNames().get(id) ?? null);
  });

  /** Moneda del monto: la de la cuenta origen, o la del movimiento si la cuenta ya no está. */
  protected readonly currency = computed(
    () => this.transaction()?.fromCurrency ?? this.account()?.currency ?? 'COP',
  );

  protected readonly rows = computed<ScheduleRow[]>(() => {
    const next = this.account()?.nextStatementDate ?? null;

    return (this.transaction()?.schedule ?? []).map((item) => ({ item, state: installmentState(item, next) }));
  });

  /** Totales del plan: interés, total a pagar y lo que queda después del extracto abierto. */
  protected readonly totals = computed(() => {
    const rows = this.rows();
    const remaining = rows.filter((row) => row.state === 'pending');

    return {
      interest: rows.reduce((sum, row) => sum + row.item.interest, 0),
      total: rows.reduce((sum, row) => sum + row.item.amount, 0),
      remainingCount: remaining.length,
      remainingAmount: remaining.reduce((sum, row) => sum + row.item.amount, 0),
    };
  });

  /** La cuota del extracto abierto, para enlazar a ese extracto. */
  protected readonly currentRow = computed(() => this.rows().find((row) => row.state === 'current') ?? null);

  /** El presupuesto se abre en el mes de la cuota del extracto abierto, o en el de la primera cuota. */
  protected readonly budgetQuery = computed(() => {
    const item = this.currentRow()?.item ?? this.transaction()?.schedule[0];

    return item ? { month: monthKey(item) } : {};
  });

  /** Si la compra se hizo después del corte de su mes, la primera cuota cae en el mes siguiente. */
  protected readonly firstAfterCut = computed(() => {
    const transaction = this.transaction();
    const first = transaction?.schedule[0];

    if (!transaction || !first) {
      return null;
    }

    const purchaseMonth = dayOf(transaction.date).slice(0, 7);

    return purchaseMonth !== monthKey(first) ? first : null;
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.transactionId = Number(params.get('id'));
        this.load();
      });

    // Lleva el foco al título para que el lector de pantalla anuncie el panel recién abierto.
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }

  protected load(): void {
    const id = this.transactionId;

    if (id === null || !Number.isInteger(id)) {
      this.status.set('notFound');
      return;
    }

    this.status.set('loading');
    this.loadError.set('');
    this.getTransaction.execute(id).subscribe({
      next: (transaction) => {
        this.transaction.set(transaction);
        this.status.set('ready');
      },
      error: (error: unknown) => {
        if (error instanceof TransactionError && error.code === TransactionErrorCode.NotFound) {
          this.status.set('notFound');
          return;
        }

        this.loadError.set(
          error instanceof TransactionError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY),
        );
        this.status.set('error');
      },
    });
  }

  protected money(amount: number): string {
    return formatMoney(amount, this.currency(), this.locale());
  }

  /** Mes `{year, month}` como `YYYY-MM-01`, para el `DatePipe` en UTC. */
  protected monthDate(month: { year: number; month: number }): string {
    return `${monthKey(month)}-01`;
  }

  protected monthKey(month: { year: number; month: number }): string {
    return monthKey(month);
  }
}

function monthKey({ year, month }: { year: number; month: number }): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
