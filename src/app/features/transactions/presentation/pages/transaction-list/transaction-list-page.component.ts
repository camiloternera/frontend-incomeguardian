import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowDownLeft,
  LucideArrowRightLeft,
  LucideArrowUpRight,
  LucidePlus,
} from '@lucide/angular';
import { Subscription, catchError, map, of } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PaginationComponent } from '@shared/ui/pagination.component';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';
import {
  ListTransactionAccountOptionsUseCase,
  ListTransactionCategoryOptionsUseCase,
  ListTransactionsUseCase,
} from '../../../application/transaction-use-cases';
import {
  TRANSACTION_PAGE_SIZE,
  TRANSACTION_TYPES,
  Transaction,
  TransactionAccountOption,
  TransactionPage,
  TransactionQuery,
  TransactionType,
  isCrossCurrency,
  isTransactionType,
} from '../../../domain/transaction';
import { TransactionError } from '../../../domain/transaction-error';
import { moneyDigits } from '@shared/money/money-format';
import { formatMoney } from '../../money-format';
import { TransactionWorkspace } from '../../transaction-workspace';

/** Pestañas del listado: todos los movimientos o los de un tipo. */
export type TransactionTab = 'all' | TransactionType;

const TABS: readonly TransactionTab[] = ['all', ...TRANSACTION_TYPES];

/** Filtros que viajan en la URL (`?type=` y `?account=`). */
interface ListFilters {
  type: TransactionType | null;
  accountId: number | null;
}

/** Texto ya resuelto para la fila de un movimiento. */
interface TransactionRow {
  transaction: Transaction;
  /** Moneda del monto principal (la de la cuenta origen, o la destino en un ingreso). */
  currency: string;
  /** En una transferencia entre monedas, lo que llegó y en qué moneda. */
  destination: { amount: number; currency: string } | null;
  /** Categoría y cuenta(s) separadas por « · »; en una transferencia, «Origen → Destino». */
  meta: string;
}

/** Listado paginado en el servidor de los movimientos del usuario, con el panel de registro a un lado. */
@Component({
  selector: 'app-transaction-list-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    RouterOutlet,
    TranslocoDirective,
    PaginationComponent,
    SelectComponent,
    LucideArrowDownLeft,
    LucideArrowRightLeft,
    LucideArrowUpRight,
    LucidePlus,
  ],
  providers: [TransactionWorkspace],
  templateUrl: './transaction-list-page.component.html',
  host: { class: 'block' },
})
export class TransactionListPageComponent {
  private readonly listTransactions = inject(ListTransactionsUseCase);
  private readonly listAccounts = inject(ListTransactionAccountOptionsUseCase);
  private readonly listCategories = inject(ListTransactionCategoryOptionsUseCase);
  private readonly workspace = inject(TransactionWorkspace);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pageSize = TRANSACTION_PAGE_SIZE;
  protected readonly tabs = TABS;
  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;
  protected readonly moneyDigits = moneyDigits;

  protected readonly notice = this.workspace.notice;
  /** Página cargada; `null` mientras se pide. */
  protected readonly result = signal<TransactionPage | null>(null);
  protected readonly loadError = signal('');
  /** Si el panel de registro está abierto (hay una ruta hija activa). */
  protected readonly panelOpen = signal(false);

  protected readonly filters = signal<ListFilters>({ type: null, accountId: null });
  protected readonly tab = computed<TransactionTab>(() => this.filters().type ?? 'all');
  private readonly page = signal(1);

  /** Filtro por cuenta; `null` significa todas las cuentas. */
  protected readonly accountFilter = new FormControl<number | null>(null);

  /** Cuentas y categorías solo para poner nombres; si fallan, la lista se muestra sin ellos. */
  private readonly accounts = toSignal(
    this.listAccounts.execute().pipe(catchError(() => of<TransactionAccountOption[]>([]))),
    { initialValue: [] },
  );
  private readonly categoryNames = toSignal(
    this.listCategories.execute().pipe(
      map((categories) => new Map(categories.map((category) => [category.id, category.name]))),
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

  /** Opciones del filtro por cuenta, con «Todas las cuentas» primero. */
  protected readonly accountOptions = computed<SelectOption<number | null>[]>(() => {
    this.lang();

    return [
      { value: null, label: this.transloco.translate('transactions.list.filter.allAccounts') },
      ...this.accounts().map((account) => ({ value: account.id, label: account.name })),
    ];
  });

  protected readonly rows = computed<TransactionRow[]>(() => {
    this.lang();

    return (this.result()?.items ?? []).map((transaction) => this.toRow(transaction));
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

  constructor() {
    let first = true;

    // Abrir o cerrar el panel también navega: solo se recarga si cambian los filtros.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const next = readFilters(params);
      const current = this.filters();

      if (!first && next.type === current.type && next.accountId === current.accountId) {
        return;
      }

      first = false;
      this.filters.set(next);
      this.accountFilter.setValue(next.accountId, { emitEvent: false });
      this.load(1);
    });

    this.accountFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((accountId) => this.updateQuery({ account: accountId ?? null }));

    // Un movimiento nuevo aparece arriba: se vuelve a la primera página.
    this.workspace.saved$.pipe(takeUntilDestroyed()).subscribe(() => this.load(1));
  }

  protected selectTab(tab: TransactionTab): void {
    this.updateQuery({ type: tab === 'all' ? null : tab });
  }

  protected goToPage(page: number): void {
    this.load(page);
  }

  protected retry(): void {
    this.load(this.page());
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  private load(page: number): void {
    const { type, accountId } = this.filters();
    const query: TransactionQuery = { page, pageSize: TRANSACTION_PAGE_SIZE };

    if (type) {
      query.type = type;
    }

    if (accountId !== null) {
      query.accountId = accountId;
    }

    this.page.set(page);
    this.result.set(null);
    this.loadError.set('');
    this.request?.unsubscribe();
    this.request = this.listTransactions.execute(query).subscribe({
      next: (result) => this.result.set(result),
      error: (error: unknown) => this.loadError.set(this.messageOf(error)),
    });
  }

  /** Cambia los filtros en la URL sin cerrar el panel abierto. */
  private updateQuery(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  private toRow(transaction: Transaction): TransactionRow {
    const from = this.accountName(transaction.fromAccountId);
    const to = this.accountName(transaction.toAccountId);
    const currency =
      (transaction.type === 'income' ? transaction.toCurrency : transaction.fromCurrency) ??
      this.accountsById().get(
        (transaction.type === 'income' ? transaction.toAccountId : transaction.fromAccountId) ?? -1,
      )?.currency ??
      'COP';
    const toCurrency =
      transaction.toCurrency ?? this.accountsById().get(transaction.toAccountId ?? -1)?.currency;
    const destination =
      transaction.type === 'transfer' &&
      transaction.destinationAmount !== null &&
      toCurrency !== undefined &&
      isCrossCurrency(currency, toCurrency)
        ? { amount: transaction.destinationAmount, currency: toCurrency }
        : null;

    let accounts = '';

    if (transaction.type === 'income') {
      accounts = to;
    } else if (transaction.type === 'expense') {
      accounts = from;
    } else {
      accounts = this.transloco.translate('transactions.list.route', { from, to });
    }

    return {
      transaction,
      currency,
      destination,
      meta: [transaction.categoryId === null ? null : this.categoryNames().get(transaction.categoryId), accounts]
        .filter(Boolean)
        .join(' · '),
    };
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

/** Lee los filtros de la URL; los valores desconocidos se ignoran. */
function readFilters(params: ParamMap): ListFilters {
  const type = params.get('type');
  const account = Number(params.get('account'));

  return {
    type: isTransactionType(type) ? type : null,
    accountId: params.has('account') && Number.isInteger(account) && account > 0 ? account : null,
  };
}
