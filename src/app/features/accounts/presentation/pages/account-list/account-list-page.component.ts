import { CurrencyPipe } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideBan, LucideEllipsis, LucidePencil, LucidePlus, LucideSearch } from '@lucide/angular';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PaginationComponent } from '@shared/ui/pagination.component';
import { ListAccountsUseCase } from '../../../application/account-use-cases';
import { Account, isSelectableCurrency, matchesAccount, totalsByCurrency } from '../../../domain/account';
import { AccountError } from '../../../domain/account-error';
import { AccountWorkspace } from '../../account-workspace';
import { moneyDigits as balanceDigits } from '@shared/money/money-format';

/** Pestañas del listado: las cuentas en uso o las que ya se desactivaron. */
export type AccountTab = 'active' | 'inactive';

const TABS: readonly AccountTab[] = ['active', 'inactive'];

/** Cuentas por página: caben en pantalla sin tener que desplazarse. */
export const ACCOUNT_PAGE_SIZE = 5;

@Component({
  selector: 'app-account-list-page',
  imports: [
    CurrencyPipe,
    RouterLink,
    RouterOutlet,
    TranslocoDirective,
    PaginationComponent,
    LucideBan,
    LucideEllipsis,
    LucidePencil,
    LucidePlus,
    LucideSearch,
  ],
  providers: [AccountWorkspace],
  templateUrl: './account-list-page.component.html',
  host: { class: 'block' },
})
export class AccountListPageComponent {
  private readonly listAccounts = inject(ListAccountsUseCase);
  private readonly workspace = inject(AccountWorkspace);
  private readonly transloco = inject(TranslocoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly pageSize = ACCOUNT_PAGE_SIZE;
  protected readonly tabs = TABS;
  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;
  protected readonly balanceDigits = balanceDigits;
  /** Misma regla que el panel: solo se edita una cuenta activa en una moneda admitida. */
  protected readonly isEditable = (account: Account): boolean =>
    account.isActive && isSelectableCurrency(account.currency);

  protected readonly accounts = this.workspace.accounts;
  protected readonly notice = this.workspace.notice;
  protected readonly selectedId = this.workspace.selectedId;
  protected readonly loadError = signal('');

  /** Texto de búsqueda por nombre o tipo de cuenta. */
  protected readonly query = signal('');
  protected readonly tab = signal<AccountTab>('active');
  /** Si el panel de crear o editar está abierto (hay una ruta hija activa). */
  protected readonly panelOpen = signal(false);
  /** Fila cuyo menú de acciones está desplegado. */
  protected readonly openMenuId = signal<number | null>(null);

  /** Cuenta cuya desactivación espera confirmación en su propia fila. */
  protected readonly pendingDeactivateId = signal<number | null>(null);
  protected readonly isDeactivating = signal(false);
  protected readonly deactivateError = signal('');

  /** Saldos de las cuentas activas por moneda; no dependen de la pestaña ni de la búsqueda. */
  protected readonly totals = computed(() => totalsByCurrency(this.accounts() ?? []));

  private readonly matching = computed(() =>
    (this.accounts() ?? []).filter((account) => matchesAccount(account, this.query())),
  );
  /** Coincidencias de la búsqueda en cada pestaña, para el contador de la pestaña. */
  protected readonly counts = computed(() => {
    const active = this.matching().filter((account) => account.isActive).length;

    return { active, inactive: this.matching().length - active };
  });
  /** Cuentas de la pestaña elegida que coinciden con la búsqueda. */
  protected readonly visible = computed(() => {
    const active = this.tab() === 'active';

    return this.matching().filter((account) => account.isActive === active);
  });
  protected readonly searching = computed(() => this.query().trim() !== '');

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

  protected search(value: string): void {
    this.query.set(value);
    this.resetPosition();
  }

  protected selectTab(tab: AccountTab): void {
    this.tab.set(tab);
    this.resetPosition();
  }

  protected goToPage(page: number): void {
    this.requestedPage.set(page);
    this.pendingDeactivateId.set(null);
    this.openMenuId.set(null);
  }

  /** Iniciales del nombre de la cuenta, para el monograma de la fila. */
  protected initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2);

    return letters.toUpperCase();
  }

  protected toggleMenu(id: number, event: Event): void {
    // Evita que el clic llegue al documento y cierre el menú en el mismo instante.
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  /** Cierra el menú con Escape y devuelve el foco al botón que lo abrió. */
  protected closeMenu(id: number): void {
    this.openMenuId.set(null);
    this.host.nativeElement.querySelector<HTMLButtonElement>(`#account-menu-button-${id}`)?.focus();
  }

  /** Un clic fuera de un menú abierto lo cierra. */
  @HostListener('document:click')
  protected closeMenus(): void {
    this.openMenuId.set(null);
  }

  protected askDeactivate(account: Account): void {
    this.openMenuId.set(null);
    this.deactivateError.set('');
    this.pendingDeactivateId.set(account.id);
  }

  protected cancelDeactivate(): void {
    this.pendingDeactivateId.set(null);
  }

  protected confirmDeactivate(account: Account): void {
    this.isDeactivating.set(true);
    this.deactivateError.set('');

    this.workspace
      .deactivate(account)
      .pipe(
        finalize(() => {
          this.isDeactivating.set(false);
          this.pendingDeactivateId.set(null);
        }),
      )
      .subscribe({ error: (error: unknown) => this.deactivateError.set(this.messageOf(error)) });
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  private resetPosition(): void {
    this.requestedPage.set(1);
    this.pendingDeactivateId.set(null);
    this.openMenuId.set(null);
  }

  private messageOf(error: unknown): string {
    return error instanceof AccountError
      ? error.message
      : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
