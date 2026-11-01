import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideEllipsis, LucidePencil, LucidePlus, LucideSearch, LucideBan } from '@lucide/angular';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PaginationComponent } from '@shared/ui/pagination.component';
import { ListAccountTypesUseCase } from '../../../application/account-type-use-cases';
import { AccountType, matchesAccountType } from '../../../domain/account-type';
import { AccountTypeError } from '../../../domain/account-type-error';
import { AccountTypeWorkspace } from '../../account-type-workspace';

/** Tipos de cuenta por página: caben en pantalla sin tener que desplazarse. */
export const ACCOUNT_TYPE_PAGE_SIZE = 5;

@Component({
  selector: 'app-account-type-list-page',
  imports: [
    DatePipe,
    RouterLink,
    RouterOutlet,
    TranslocoDirective,
    PaginationComponent,
    LucideEllipsis,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideBan,
  ],
  providers: [AccountTypeWorkspace],
  templateUrl: './account-type-list-page.component.html',
  styleUrls: ['./account-type-list-page.component.css'],
})
export class AccountTypeListPageComponent {
  private readonly listAccountTypes = inject(ListAccountTypesUseCase);
  private readonly workspace = inject(AccountTypeWorkspace);
  private readonly transloco = inject(TranslocoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly pageSize = ACCOUNT_TYPE_PAGE_SIZE;
  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;

  protected readonly accountTypes = this.workspace.accountTypes;
  protected readonly notice = this.workspace.notice;
  protected readonly selectedId = this.workspace.selectedId;
  protected readonly loadError = signal('');

  /** Texto de búsqueda por nombre o descripción. */
  protected readonly query = signal('');
  /** Si el panel de crear o editar está abierto (hay una ruta hija activa). */
  protected readonly panelOpen = signal(false);
  /** Fila cuyo menú de acciones está desplegado. */
  protected readonly openMenuId = signal<number | null>(null);

  /** Tipo cuya desactivación espera confirmación en su propia fila. */
  protected readonly pendingDeactivateId = signal<number | null>(null);
  protected readonly isDeactivating = signal(false);
  protected readonly deactivateError = signal('');

  /** Tipos de cuenta que coinciden con la búsqueda. */
  protected readonly visible = computed(() =>
    (this.accountTypes() ?? []).filter((accountType) => matchesAccountType(accountType, this.query())),
  );
  protected readonly total = computed(() => this.accountTypes()?.length ?? 0);
  protected readonly searching = computed(() => this.query().trim() !== '');

  private readonly requestedPage = signal(1);

  /** Página mostrada; si una desactivación deja la página vacía, retrocede a la última que exista. */
  protected readonly page = computed(() => {
    const lastPage = Math.max(1, Math.ceil(this.visible().length / ACCOUNT_TYPE_PAGE_SIZE));

    return Math.min(this.requestedPage(), lastPage);
  });

  protected readonly pageItems = computed(() => {
    const start = (this.page() - 1) * ACCOUNT_TYPE_PAGE_SIZE;

    return this.visible().slice(start, start + ACCOUNT_TYPE_PAGE_SIZE);
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loadError.set('');
    this.listAccountTypes.execute().subscribe({
      next: (accountTypes) => this.accountTypes.set(accountTypes),
      error: (error: unknown) => this.loadError.set(this.messageOf(error)),
    });
  }

  protected search(value: string): void {
    this.query.set(value);
    this.requestedPage.set(1);
  }

  protected goToPage(page: number): void {
    this.requestedPage.set(page);
    this.pendingDeactivateId.set(null);
    this.openMenuId.set(null);
  }

  protected toggleMenu(id: number, event: Event): void {
    // Evita que el clic llegue al documento y cierre el menú en el mismo instante.
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  /** Cierra el menú con Escape y devuelve el foco al botón que lo abrió. */
  protected closeMenu(id: number): void {
    this.openMenuId.set(null);
    this.host.nativeElement.querySelector<HTMLButtonElement>(`#account-type-menu-button-${id}`)?.focus();
  }

  /** Un clic fuera de un menú abierto lo cierra. */
  @HostListener('document:click')
  protected closeMenus(): void {
    this.openMenuId.set(null);
  }

  protected askDeactivate(accountType: AccountType): void {
    this.openMenuId.set(null);
    this.deactivateError.set('');
    this.pendingDeactivateId.set(accountType.id);
  }

  protected cancelDeactivate(): void {
    this.pendingDeactivateId.set(null);
  }

  protected confirmDeactivate(accountType: AccountType): void {
    this.isDeactivating.set(true);
    this.deactivateError.set('');

    this.workspace
      .deactivate(accountType)
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

  private messageOf(error: unknown): string {
    return error instanceof AccountTypeError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
