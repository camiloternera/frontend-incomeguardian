import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideBan, LucideEye, LucidePencil, LucidePlus, LucideSearch } from '@lucide/angular';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PaginationComponent } from '@shared/ui/pagination.component';
import { DeactivateAccountUseCase, ListAccountsUseCase } from '../../../application/account-use-cases';
import { Account, matchesAccount } from '../../../domain/account';
import { AccountError, AccountErrorCode } from '../../../domain/account-error';
import { AccountNotice, AccountNoticeState } from '../../account-notice';
import { balanceDigits } from '../../balance-format';

/** Filtros del listado: las cuentas en uso o las que ya se desactivaron. */
export type AccountFilter = 'active' | 'inactive';

const FILTERS: readonly AccountFilter[] = ['active', 'inactive'];

/** Cuentas por página, igual que en categorías y tipos de cuenta. */
export const ACCOUNT_PAGE_SIZE = 8;

@Component({
  selector: 'app-account-list-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    TranslocoDirective,
    PaginationComponent,
    LucideBan,
    LucideEye,
    LucidePencil,
    LucidePlus,
    LucideSearch,
  ],
  templateUrl: './account-list-page.component.html',
  styleUrls: ['./account-list-page.component.css'],
})
export class AccountListPageComponent {
  private readonly listAccounts = inject(ListAccountsUseCase);
  private readonly deactivateAccount = inject(DeactivateAccountUseCase);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;
  protected readonly filters = FILTERS;
  protected readonly balanceDigits = balanceDigits;
  private readonly listTop = viewChild<ElementRef<HTMLElement>>('listTop');

  /** `null` mientras se cargan las cuentas por primera vez. */
  protected readonly accounts = signal<Account[] | null>(null);
  protected readonly loadError = signal('');
  protected readonly filter = signal<AccountFilter>('active');
  protected readonly query = signal('');

  /** Cuenta cuya desactivación espera confirmación en su propia fila. */
  protected readonly pendingDeactivateId = signal<number | null>(null);
  protected readonly isDeactivating = signal(false);
  protected readonly deactivateError = signal('');

  /** Aviso de la última acción completada, llegue desde el formulario o desde esta vista. */
  protected readonly notice = signal<AccountNotice | null>(
    (this.router.currentNavigation()?.extras.state as AccountNoticeState | undefined)?.notice ?? null,
  );

  /** Cuentas del filtro elegido, antes de aplicar la búsqueda. */
  private readonly inFilter = computed(() => {
    const active = this.filter() === 'active';

    return (this.accounts() ?? []).filter((account) => account.isActive === active);
  });

  protected readonly visible = computed(() => {
    const query = this.query();

    return this.inFilter().filter((account) => matchesAccount(account, query));
  });

  protected readonly filterTotal = computed(() => this.inFilter().length);

  protected readonly pageSize = ACCOUNT_PAGE_SIZE;
  private readonly requestedPage = signal(1);

  /** Página mostrada; si una desactivación deja la página vacía, retrocede a la última que exista. */
  protected readonly page = computed(() => {
    const lastPage = Math.max(1, Math.ceil(this.visible().length / ACCOUNT_PAGE_SIZE));

    return Math.min(this.requestedPage(), lastPage);
  });

  protected readonly pageItems = computed(() => {
    const start = (this.page() - 1) * ACCOUNT_PAGE_SIZE;

    return this.visible().slice(start, start + ACCOUNT_PAGE_SIZE);
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loadError.set('');
    this.listAccounts.execute().subscribe({
      next: (accounts) => this.accounts.set(accounts),
      error: (error: unknown) => this.loadError.set(this.messageOf(error)),
    });
  }

  protected countFor(filter: AccountFilter): number {
    const active = filter === 'active';

    return (this.accounts() ?? []).filter((account) => account.isActive === active).length;
  }

  protected setFilter(filter: AccountFilter): void {
    this.filter.set(filter);
    this.resetPosition();
  }

  protected search(query: string): void {
    this.query.set(query);
    this.resetPosition();
  }

  /** Cambia de página y lleva la vista al inicio de la lista para leer el nuevo bloque desde arriba. */
  protected goToPage(page: number): void {
    this.requestedPage.set(page);
    this.pendingDeactivateId.set(null);
    // `scrollIntoView` no existe en todos los entornos (jsdom en los tests), por eso la llamada opcional.
    this.listTop()?.nativeElement.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  protected askDeactivate(account: Account): void {
    this.deactivateError.set('');
    this.pendingDeactivateId.set(account.id);
  }

  protected cancelDeactivate(): void {
    this.pendingDeactivateId.set(null);
  }

  protected confirmDeactivate(account: Account): void {
    this.isDeactivating.set(true);
    this.deactivateError.set('');

    this.deactivateAccount
      .execute(account.id)
      .pipe(finalize(() => this.isDeactivating.set(false)))
      .subscribe({
        next: () => {
          // La cuenta pasa al filtro de desactivadas en vez de desaparecer.
          this.accounts.update((accounts) => accounts?.map((item) => (item.id === account.id ? { ...item, isActive: false } : item)) ?? null);
          this.pendingDeactivateId.set(null);
          this.notice.set({ kind: 'deactivated', name: account.name });
        },
        error: (error: unknown) => {
          // Si ya no existe, otra sesión la eliminó: se retira de la lista igualmente.
          if (error instanceof AccountError && error.code === AccountErrorCode.NotFound) {
            this.accounts.update((accounts) => accounts?.filter((item) => item.id !== account.id) ?? null);
            this.pendingDeactivateId.set(null);
          }

          this.deactivateError.set(this.messageOf(error));
        },
      });
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  private resetPosition(): void {
    this.requestedPage.set(1);
    this.pendingDeactivateId.set(null);
  }

  private messageOf(error: unknown): string {
    return error instanceof AccountError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
