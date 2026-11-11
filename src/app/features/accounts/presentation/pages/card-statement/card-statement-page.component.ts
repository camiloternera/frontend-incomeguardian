import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { combineLatest, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { dayPattern, longDayPattern, shortDayPattern } from '@shared/dates/date-patterns';
import { moneyDigits } from '@shared/money/money-format';
import { GetAccountUseCase, GetCardStatementUseCase } from '../../../application/account-use-cases';
import { Account, isCreditCard } from '../../../domain/account';
import { AccountError, AccountErrorCode } from '../../../domain/account-error';
import { CardStatement, canPayStatement } from '../../../domain/card-statement';
import { CardMonth } from '../../../domain/credit-card-calendar';

/** Estado de la vista: cargando, listo, error al cargar o cuenta que no es una tarjeta (o no existe). */
type PageStatus = 'loading' | 'ready' | 'error' | 'notFound';

/** Ruta del listado de cuentas. */
const LIST_URL = '/accounts';

/**
 * Extracto mensual de una tarjeta: lo que cobra el corte, lo abonado y lo que falta, con flechas
 * para recorrer los extractos. El mes va en `?month=YYYY-MM`; sin él, el del próximo corte.
 */
@Component({
  selector: 'app-card-statement-page',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective, LucideChevronLeft, LucideChevronRight],
  templateUrl: './card-statement-page.component.html',
  host: { class: 'block' },
})
export class CardStatementPageComponent {
  private readonly getAccount = inject(GetAccountUseCase);
  private readonly getStatement = inject(GetCardStatementUseCase);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly listUrl = LIST_URL;
  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;
  protected readonly moneyDigits = moneyDigits;
  /** Patrones de fecha del idioma activo: corto, con año y dentro de una frase. */
  protected readonly shortDay = computed(() => shortDayPattern(this.locale()));
  protected readonly day = computed(() => dayPattern(this.locale()));
  protected readonly longDay = computed(() => longDayPattern(this.locale()));

  protected readonly status = signal<PageStatus>('loading');
  protected readonly loadError = signal('');
  protected readonly account = signal<Account | null>(null);
  protected readonly statement = signal<CardStatement | null>(null);
  /** Mientras llega otro mes, se conserva el extracto anterior en pantalla. */
  protected readonly isChangingMonth = signal(false);

  private accountId: number | null = null;
  private requestedMonth: CardMonth | undefined;

  protected readonly canPay = computed(() => {
    const statement = this.statement();

    return !!statement && canPayStatement(statement) && this.account()?.isActive === true;
  });

  /** Parámetros del enlace «Pagar» al formulario de transferencia. */
  protected readonly payQuery = computed(() => {
    const statement = this.statement();

    return statement
      ? { payCard: statement.accountId, statement: monthKey(statement.month), due: statement.balanceDue }
      : null;
  });

  constructor() {
    const route = inject(ActivatedRoute);

    combineLatest([route.paramMap, route.queryParamMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([params, query]) => {
        const id = Number(params.get('id'));
        const month = parseMonthKey(query.get('month'));

        if (!Number.isInteger(id)) {
          this.status.set('notFound');
          return;
        }

        const sameAccount = id === this.accountId;
        this.accountId = id;
        this.requestedMonth = month ?? undefined;

        if (sameAccount && this.account()) {
          this.loadStatement();
        } else {
          this.load();
        }
      });
  }

  /** Carga la tarjeta y su extracto; si la cuenta no es una tarjeta se trata como no encontrada. */
  protected load(): void {
    const id = this.accountId;

    if (id === null) {
      return;
    }

    this.status.set('loading');
    this.loadError.set('');
    this.statement.set(null);

    this.getAccount.execute(id).subscribe({
      next: (account) => {
        if (!isCreditCard(account)) {
          this.status.set('notFound');
          return;
        }

        this.account.set(account);
        this.loadStatement();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Va al extracto de otro mes; la URL guarda el mes para poder volver a él. */
  protected goTo(month: CardMonth | null): void {
    if (!month) {
      return;
    }

    void this.router.navigate([], { queryParams: { month: monthKey(month) }, replaceUrl: true });
  }

  /** Nombre del mes de corte, por ejemplo «noviembre de 2026». */
  protected monthDate(month: CardMonth): string {
    return monthDate(month);
  }

  private loadStatement(): void {
    const id = this.accountId;

    if (id === null) {
      return;
    }

    const changing = this.statement() !== null;
    this.isChangingMonth.set(changing);

    if (!changing) {
      this.status.set('loading');
    }

    this.getStatement
      .execute(id, this.requestedMonth)
      .pipe(finalize(() => this.isChangingMonth.set(false)))
      .subscribe({
        next: (statement) => {
          this.statement.set(statement);
          this.status.set('ready');
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private fail(error: unknown): void {
    if (
      error instanceof AccountError &&
      (error.code === AccountErrorCode.NotFound || error.code === AccountErrorCode.NotCreditCard)
    ) {
      this.status.set('notFound');
      return;
    }

    this.loadError.set(
      error instanceof AccountError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY),
    );
    this.status.set('error');
  }
}

/** El mes como `YYYY-MM`. */
function monthKey({ year, month }: CardMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Primer día del mes, `YYYY-MM-01`, para formatearlo con el `DatePipe` en UTC. */
function monthDate({ year, month }: CardMonth): string {
  return `${monthKey({ year, month })}-01`;
}

/** Lee un mes `YYYY-MM`; null si no tiene esa forma. */
function parseMonthKey(value: string | null): CardMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  const month = match ? Number(match[2]) : 0;

  return match && month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}
