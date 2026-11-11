import { CurrencyPipe, formatDate } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowDownLeft,
  LucideArrowRightLeft,
  LucideArrowUpRight,
  LucideChevronLeft,
  LucideChevronRight,
  LucidePlus,
} from '@lucide/angular';
import { Subscription, catchError, map, of } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { ClosedMonthBadgeComponent } from '@features/periods';
import { PaginationComponent } from '@shared/ui/pagination.component';
import {
  ListTransactionAccountOptionsUseCase,
  ListTransactionCategoryOptionsUseCase,
  ListTransactionsUseCase,
  SummarizeTransactionsUseCase,
} from '../../../application/transaction-use-cases';
import {
  CurrencySummary,
  TRANSACTION_PAGE_SIZE,
  Transaction,
  TransactionAccountOption,
  TransactionMonth,
  TransactionPage,
  TransactionSummary,
  compareMonths,
  dayOf,
  formatMonthKey,
  groupByDay,
  isCrossCurrency,
  monthOfDay,
  monthRange,
  parseMonth,
  shiftMonth,
} from '../../../domain/transaction';
import { TransactionError } from '../../../domain/transaction-error';
import { moneyDigits } from '@shared/money/money-format';
import { formatMoney } from '../../money-format';
import { TransactionWorkspace } from '../../transaction-workspace';

/** Texto ya resuelto para la fila de un movimiento. */
interface TransactionRow {
  transaction: Transaction;
  /** Moneda del monto principal (la de la cuenta origen, o la destino en un ingreso). */
  currency: string;
  /** En una transferencia entre monedas, lo que llegó y en qué moneda. */
  destination: { amount: number; currency: string } | null;
  /** «Categoría · Cuenta»; en una transferencia, «Origen → Destino». */
  meta: string;
}

/** Filas de un mismo día, con su encabezado ya resuelto. */
interface DayGroup {
  day: string;
  /** «Hoy», «Ayer» o el día de la semana. */
  title: string;
  /** La fecha en letras, en tono secundario. */
  date: string;
  /** Movimientos del día en esta página. */
  count: number;
  rows: TransactionRow[];
}

/** Resumen del mes; los montos ya formateados, una moneda tras otra. */
interface MonthSummary {
  income: string;
  expense: string;
  count: number;
}

/** Resta un día a una fecha `YYYY-MM-DD`. */
function previousDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, date - 1)).toISOString().slice(0, 10);
}

/** Solo la primera letra en mayúscula. */
function capitalized(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/**
 * Movimientos de un mes, agrupados por día y paginados en el servidor, con el resumen de lo que
 * entró y salió y el panel de registro a un lado. El mes viaja en la URL (`?month=YYYY-MM`).
 */
@Component({
  selector: 'app-transaction-list-page',
  imports: [
    CurrencyPipe,
    RouterLink,
    RouterOutlet,
    TranslocoDirective,
    PaginationComponent,
    ClosedMonthBadgeComponent,
    LucideArrowDownLeft,
    LucideArrowRightLeft,
    LucideArrowUpRight,
    LucideChevronLeft,
    LucideChevronRight,
    LucidePlus,
  ],
  providers: [TransactionWorkspace],
  templateUrl: './transaction-list-page.component.html',
  host: { class: 'block' },
})
export class TransactionListPageComponent {
  private readonly listTransactions = inject(ListTransactionsUseCase);
  private readonly summarize = inject(SummarizeTransactionsUseCase);
  private readonly listAccounts = inject(ListTransactionAccountOptionsUseCase);
  private readonly listCategories = inject(ListTransactionCategoryOptionsUseCase);
  private readonly workspace = inject(TransactionWorkspace);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pageSize = TRANSACTION_PAGE_SIZE;
  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;
  protected readonly moneyDigits = moneyDigits;

  protected readonly notice = this.workspace.notice;
  /** Página cargada; `null` mientras se pide. */
  protected readonly result = signal<TransactionPage | null>(null);
  protected readonly loadError = signal('');
  /** Resumen de todo el mes; `null` mientras se pide o si falló. */
  private readonly totals = signal<TransactionSummary | null>(null);
  /** Si el panel de registro está abierto (hay una ruta hija activa). */
  protected readonly panelOpen = signal(false);

  /** Mes en curso en hora de Colombia: no se navega más allá. */
  private readonly today = dayOf(new Date().toISOString());
  protected readonly currentMonth: TransactionMonth = monthOfDay(this.today);
  protected readonly month = signal<TransactionMonth>(this.currentMonth);
  protected readonly isCurrentMonth = computed(() => compareMonths(this.month(), this.currentMonth) === 0);
  /** Primer día del mes, para la pastilla de mes cerrado. */
  protected readonly monthStart = computed(() => `${formatMonthKey(this.month())}-01`);
  private readonly page = signal(1);

  /** Cuentas y categorías solo para poner nombres; si fallan, la lista se muestra sin ellos. */
  private readonly accounts = toSignal(
    this.listAccounts.execute().pipe(catchError(() => of<TransactionAccountOption[]>([]))),
    { initialValue: [] },
  );
  private readonly categoryNames = toSignal(
    this.listCategories.execute().pipe(
      // Las categorías de sistema (como la de pago de tarjeta) se nombran por su código.
      map(
        (categories) =>
          new Map(
            categories.map((category) => [
              category.id,
              category.code ? this.transloco.translate(`transactions.systemCategories.${category.code}`) : category.name,
            ]),
          ),
      ),
      catchError(() => of(new Map<number, string>())),
    ),
    { initialValue: new Map<number, string>() },
  );
  private readonly accountsById = computed(
    () => new Map(this.accounts().map((account) => [account.id, account])),
  );

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** «Noviembre 2026». */
  protected readonly monthLabel = computed(() => {
    const locale = this.locale();

    return capitalized(formatDate(`${this.monthStart()}T12:00:00Z`, 'LLLL y', locale, 'UTC'), locale);
  });

  /** Nombre del mes dentro de una frase: «noviembre» / «November». */
  protected readonly monthName = computed(() =>
    formatDate(`${this.monthStart()}T12:00:00Z`, 'LLLL', this.locale(), 'UTC'),
  );

  protected readonly summary = computed<MonthSummary | null>(() => {
    const totals = this.totals();

    if (!totals) {
      return null;
    }

    return {
      income: this.joinTotals(totals.currencies, 'income'),
      expense: this.joinTotals(totals.currencies, 'expense'),
      count: totals.totalItems,
    };
  });

  protected readonly groups = computed<DayGroup[]>(() => {
    this.lang();
    const locale = this.locale();
    const yesterday = previousDay(this.today);

    return groupByDay(this.result()?.items ?? [], (item) => item.date).map(({ day, items }) => {
      const at = `${day}T12:00:00Z`;
      const relative =
        day === this.today ? 'today' : day === yesterday ? 'yesterday' : null;
      const spanish = locale.startsWith('es');

      return {
        day,
        title: relative
          ? this.transloco.translate(`transactions.list.day.${relative}`)
          : capitalized(formatDate(at, 'EEEE', locale, 'UTC'), locale),
        date: formatDate(
          at,
          relative
            ? spanish ? "EEEE d 'de' MMMM" : 'EEEE, MMMM d'
            : spanish ? "d 'de' MMMM" : 'MMMM d',
          locale,
          'UTC',
        ),
        count: items.length,
        rows: items.map((transaction) => this.toRow(transaction)),
      };
    });
  });

  /** Mensaje de confirmación del último movimiento registrado. */
  protected readonly noticeMessage = computed(() => {
    const transaction = this.notice();
    this.lang();

    if (!transaction) {
      return null;
    }

    const row = this.toRow(transaction);
    const converted = row.destination !== null;
    const amount = converted
      ? formatMoney(row.destination!.amount, row.destination!.currency, this.locale())
      : formatMoney(transaction.amount, row.currency, this.locale());

    return {
      key: `transactions.list.notice.${converted ? 'transferConverted' : transaction.type}`,
      params: { amount },
    };
  });

  private request: Subscription | null = null;
  private totalsRequest: Subscription | null = null;

  constructor() {
    let first = true;

    // Abrir o cerrar el panel también navega: solo se recarga si cambia el mes.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const next = this.readMonth(params.get('month'));

      if (!first && compareMonths(next, this.month()) === 0) {
        return;
      }

      first = false;
      this.month.set(next);
      this.reload();
    });

    // Un movimiento nuevo cambia el resumen y aparece arriba: se vuelve a la primera página.
    this.workspace.saved$.pipe(takeUntilDestroyed()).subscribe(() => this.reload());
  }

  protected previousMonth(): void {
    this.goToMonth(shiftMonth(this.month(), -1));
  }

  protected nextMonth(): void {
    if (!this.isCurrentMonth()) {
      this.goToMonth(shiftMonth(this.month(), 1));
    }
  }

  protected goToCurrentMonth(): void {
    this.goToMonth(this.currentMonth);
  }

  protected goToPage(page: number): void {
    this.load(page);
  }

  protected retry(): void {
    this.load(this.page());
    this.loadTotals();
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  /** «2 movimientos» / «1 movimiento». */
  protected countLabel(count: number): string {
    return count === 1
      ? this.transloco.translate('transactions.list.day.countOne')
      : this.transloco.translate('transactions.list.day.countOther', { count });
  }

  private reload(): void {
    this.load(1);
    this.loadTotals();
  }

  private load(page: number): void {
    this.page.set(page);
    this.result.set(null);
    this.loadError.set('');
    this.request?.unsubscribe();
    this.request = this.listTransactions
      .execute({ page, pageSize: TRANSACTION_PAGE_SIZE, ...monthRange(this.month()) })
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.loadError.set(this.messageOf(error)),
      });
  }

  /** Pide el resumen del mes; si falla, el resumen queda vacío y la lista sigue. */
  private loadTotals(): void {
    this.totals.set(null);
    this.totalsRequest?.unsubscribe();
    this.totalsRequest = this.summarize.execute(monthRange(this.month())).subscribe({
      next: (summary) => this.totals.set(summary),
      error: () => this.totals.set(null),
    });
  }

  /** Cambia el mes en la URL sin cerrar el panel abierto; el mes en curso no se escribe. */
  private goToMonth(month: TransactionMonth): void {
    const value = compareMonths(month, this.currentMonth) === 0 ? null : formatMonthKey(month);
    void this.router.navigate([], { queryParams: { month: value }, queryParamsHandling: 'merge' });
  }

  /** Mes de la URL; uno inválido o futuro cae al mes en curso. */
  private readMonth(value: string | null): TransactionMonth {
    const month = parseMonth(value);

    return month && compareMonths(month, this.currentMonth) <= 0 ? month : this.currentMonth;
  }

  /**
   * Montos de cada moneda separados por « · », pesos primero; las monedas sin movimientos de ese
   * lado no se muestran y, si no hay ninguna, se muestra cero en pesos. Las transferencias no cuentan.
   */
  private joinTotals(currencies: CurrencySummary[], side: 'income' | 'expense'): string {
    const locale = this.locale();
    const parts = [...currencies]
      .filter((item) => item[side] !== 0)
      .sort((a, b) => (a.currency === 'COP' ? -1 : b.currency === 'COP' ? 1 : a.currency.localeCompare(b.currency)))
      .map((item) => formatMoney(item[side], item.currency, locale));

    return parts.length ? parts.join(' · ') : formatMoney(0, 'COP', locale);
  }

  /** Moneda del monto principal: la de la cuenta origen, o la destino en un ingreso. */
  private currencyOf(transaction: Transaction): string {
    const income = transaction.type === 'income';

    return (
      (income ? transaction.toCurrency : transaction.fromCurrency) ??
      this.accountsById().get((income ? transaction.toAccountId : transaction.fromAccountId) ?? -1)?.currency ??
      'COP'
    );
  }

  private toRow(transaction: Transaction): TransactionRow {
    const from = this.accountName(transaction.fromAccountId);
    const to = this.accountName(transaction.toAccountId);
    const currency = this.currencyOf(transaction);
    const toCurrency =
      transaction.toCurrency ?? this.accountsById().get(transaction.toAccountId ?? -1)?.currency;
    const destination =
      transaction.type === 'transfer' &&
      transaction.destinationAmount !== null &&
      toCurrency !== undefined &&
      isCrossCurrency(currency, toCurrency)
        ? { amount: transaction.destinationAmount, currency: toCurrency }
        : null;

    if (transaction.type === 'transfer') {
      return { transaction, currency, destination, meta: this.transloco.translate('transactions.list.route', { from, to }) };
    }

    const category = transaction.categoryId === null ? null : this.categoryNames().get(transaction.categoryId);
    const account = transaction.type === 'income' ? to : from;

    return { transaction, currency, destination, meta: [category, account].filter(Boolean).join(' · ') };
  }

  private accountName(id: number | null): string {
    if (id === null) {
      return '';
    }

    return (
      this.accountsById().get(id)?.name ??
      this.transloco.translate('transactions.list.unknownAccount')
    );
  }

  private messageOf(error: unknown): string {
    return error instanceof TransactionError
      ? error.message
      : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
