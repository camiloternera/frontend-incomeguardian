import { Component, inject, input, output, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { DeleteTransactionUseCase } from '../../../application/transaction-use-cases';
import { Transaction } from '../../../domain/transaction';
import { TransactionError, TransactionErrorCode } from '../../../domain/transaction-error';
import { TransactionWorkspace } from '../../transaction-workspace';

/**
 * Confirmación para eliminar un movimiento, que deja claro que no se puede deshacer. La usan la
 * fila del listado, el detalle y el panel de edición; al eliminar avisa a `TransactionWorkspace`.
 */
@Component({
  selector: 'app-transaction-delete-confirmation',
  imports: [TranslocoDirective],
  host: { class: 'block' },
  template: `
    <div
      *transloco="let t"
      data-testid="delete-confirmation"
      class="flex flex-col gap-3 rounded-lg border border-ig-border bg-ig-surface-raised p-4"
      role="group"
      [attr.aria-labelledby]="'delete-question-' + transaction().id"
    >
      <div class="flex flex-col gap-1">
        <p [id]="'delete-question-' + transaction().id" class="m-0 text-[14px] font-bold">
          {{ t('transactions.delete.question', { name: label() }) }}
        </p>
        <p class="m-0 text-[13px] text-ig-muted">{{ t('transactions.delete.warning') }}</p>
      </div>
      @if (error()) {
        <p data-testid="delete-error" class="m-0 text-[13px] text-ig-text" role="alert">{{ error() }}</p>
      }
      <div class="flex flex-wrap gap-2">
        <button
          data-testid="cancel-delete"
          class="inline-flex min-h-11 items-center justify-center rounded-lg border border-ig-border bg-transparent px-4 text-[14px] text-ig-text hover:bg-ig-surface focus-visible:outline-2 focus-visible:outline-ig-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          [disabled]="isDeleting()"
          (click)="cancelled.emit()"
        >
          {{ t('transactions.delete.cancel') }}
        </button>
        @if (!blocked()) {
          <button
            data-testid="confirm-delete"
            class="inline-flex min-h-11 items-center justify-center rounded-lg border border-ig-text bg-ig-text px-4 text-[14px] font-bold text-ig-canvas focus-visible:outline-2 focus-visible:outline-ig-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            [disabled]="isDeleting()"
            (click)="confirm()"
          >
            {{ isDeleting() ? t('transactions.delete.deleting') : t('transactions.delete.confirm') }}
          </button>
        }
      </div>
    </div>
  `,
})
export class TransactionDeleteConfirmationComponent {
  private readonly deleteTransaction = inject(DeleteTransactionUseCase);
  private readonly workspace = inject(TransactionWorkspace);
  private readonly transloco = inject(TranslocoService);

  readonly transaction = input.required<Transaction>();
  /** Nombre con el que se pregunta: la descripción o el tipo del movimiento. */
  readonly label = input.required<string>();

  /** La persona decidió no eliminarlo. */
  readonly cancelled = output<void>();
  /** El movimiento ya se eliminó. */
  readonly deleted = output<void>();
  /**
   * El backend ya no deja eliminarlo (mes cerrado u otro dispositivo lo borró), con el mensaje.
   * Se emite antes de refrescar el listado, que puede retirar esta confirmación de la pantalla.
   */
  readonly blockedBy = output<string>();

  protected readonly isDeleting = signal(false);
  protected readonly error = signal('');
  /** El backend ya no deja eliminarlo (mes cerrado o movimiento inexistente): no se ofrece reintentar. */
  protected readonly blocked = signal(false);

  protected confirm(): void {
    this.isDeleting.set(true);
    this.error.set('');

    this.deleteTransaction
      .execute(this.transaction().id)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.workspace.removed();
          this.deleted.emit();
        },
        error: (error: unknown) => {
          const code = error instanceof TransactionError ? error.code : null;
          const message = error instanceof TransactionError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
          this.error.set(message);

          // Otro dispositivo pudo cerrar el mes o borrar el movimiento: el listado lo refleja.
          if (code === TransactionErrorCode.PeriodClosed || code === TransactionErrorCode.NotFound) {
            this.blocked.set(true);
            this.blockedBy.emit(message);
            this.workspace.refresh();
          }
        },
      });
  }
}
