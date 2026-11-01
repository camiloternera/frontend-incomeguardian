import { DatePipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideBan, LucidePencil, LucidePlus, LucideSearch } from '@lucide/angular';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { PaginationComponent } from '@shared/ui/pagination.component';
import { DeactivateAccountTypeUseCase, ListAccountTypesUseCase } from '../../../application/account-type-use-cases';
import { AccountType, matchesAccountType } from '../../../domain/account-type';
import { AccountTypeError, AccountTypeErrorCode } from '../../../domain/account-type-error';
import { AccountTypeNotice, AccountTypeNoticeState } from '../../account-type-notice';

/** Tipos de cuenta por página, igual que en categorías. */
export const ACCOUNT_TYPE_PAGE_SIZE = 8;

@Component({
  selector: 'app-account-type-list-page',
  imports: [
    DatePipe,
    RouterLink,
    TranslocoDirective,
    PaginationComponent,
    LucideBan,
    LucidePencil,
    LucidePlus,
    LucideSearch,
  ],
  templateUrl: './account-type-list-page.component.html',
  styleUrls: ['./account-type-list-page.component.css'],
})
export class AccountTypeListPageComponent {
  private readonly listAccountTypes = inject(ListAccountTypesUseCase);
  private readonly deactivateAccountType = inject(DeactivateAccountTypeUseCase);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;
  private readonly listTop = viewChild<ElementRef<HTMLElement>>('listTop');

  /** `null` mientras se cargan los tipos de cuenta por primera vez. */
  protected readonly accountTypes = signal<AccountType[] | null>(null);
  protected readonly loadError = signal('');
  protected readonly query = signal('');

  /** Tipo cuya desactivación espera confirmación en su propia fila. */
  protected readonly pendingDeactivateId = signal<number | null>(null);
  protected readonly isDeactivating = signal(false);
  protected readonly deactivateError = signal('');

  /** Aviso de la última acción completada, llegue desde el formulario o desde esta vista. */
  protected readonly notice = signal<AccountTypeNotice | null>(
    (this.router.currentNavigation()?.extras.state as AccountTypeNoticeState | undefined)?.notice ?? null,
  );

  protected readonly total = computed(() => this.accountTypes()?.length ?? 0);

  protected readonly visible = computed(() => {
    const query = this.query();

    return (this.accountTypes() ?? []).filter((accountType) => matchesAccountType(accountType, query));
  });

  protected readonly pageSize = ACCOUNT_TYPE_PAGE_SIZE;
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

  protected search(query: string): void {
    this.query.set(query);
    this.requestedPage.set(1);
    this.pendingDeactivateId.set(null);
  }

  /** Cambia de página y lleva la vista al inicio de la lista para leer el nuevo bloque desde arriba. */
  protected goToPage(page: number): void {
    this.requestedPage.set(page);
    this.pendingDeactivateId.set(null);
    // `scrollIntoView` no existe en todos los entornos (jsdom en los tests), por eso la llamada opcional.
    this.listTop()?.nativeElement.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  protected askDeactivate(accountType: AccountType): void {
    this.deactivateError.set('');
    this.pendingDeactivateId.set(accountType.id);
  }

  protected cancelDeactivate(): void {
    this.pendingDeactivateId.set(null);
  }

  protected confirmDeactivate(accountType: AccountType): void {
    this.isDeactivating.set(true);
    this.deactivateError.set('');

    this.deactivateAccountType
      .execute(accountType.id)
      .pipe(finalize(() => this.isDeactivating.set(false)))
      .subscribe({
        next: () => {
          this.removeFromList(accountType.id);
          this.notice.set({ kind: 'deactivated', name: accountType.name });
        },
        error: (error: unknown) => {
          // Si ya no existe, otra pestaña lo desactivó: se retira de la lista igualmente.
          if (error instanceof AccountTypeError && error.code === AccountTypeErrorCode.NotFound) {
            this.removeFromList(accountType.id);
          }

          this.deactivateError.set(this.messageOf(error));
        },
      });
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  private removeFromList(id: number): void {
    this.accountTypes.update((accountTypes) => accountTypes?.filter((accountType) => accountType.id !== id) ?? null);
    this.pendingDeactivateId.set(null);
  }

  private messageOf(error: unknown): string {
    return error instanceof AccountTypeError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
