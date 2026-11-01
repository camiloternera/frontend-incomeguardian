import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideBan, LucideX } from '@lucide/angular';
import { Observable, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { notBlank } from '@shared/forms/not-blank.validator';
import {
  CreateAccountTypeUseCase,
  GetAccountTypeUseCase,
  UpdateAccountTypeUseCase,
} from '../../../application/account-type-use-cases';
import { ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH, ACCOUNT_TYPE_NAME_MAX_LENGTH, AccountType } from '../../../domain/account-type';
import {
  AccountTypeError,
  AccountTypeErrorCode,
  DESCRIPTION_ERROR_CODES,
  NAME_ERROR_CODES,
} from '../../../domain/account-type-error';
import { AccountTypeWorkspace } from '../../account-type-workspace';

/** Estado del panel: listo para editar, cargando o sin tipo de cuenta. */
type PanelStatus = 'ready' | 'loading' | 'notFound';

/** Códigos de error que pinta cada campo, según la validación del navegador o la respuesta del backend. */
interface FieldErrorCodes {
  required: AccountTypeErrorCode;
  maxLength: AccountTypeErrorCode;
}

const NAME_CODES: FieldErrorCodes = {
  required: AccountTypeErrorCode.NameRequired,
  maxLength: AccountTypeErrorCode.NameMaxLength,
};

const DESCRIPTION_CODES: FieldErrorCodes = {
  required: AccountTypeErrorCode.DescriptionRequired,
  maxLength: AccountTypeErrorCode.DescriptionMaxLength,
};

/** Ruta del listado, a la que vuelve el panel al cerrarse. */
const LIST_URL = '/account-types';

/**
 * Panel para crear o editar un tipo de cuenta junto a la lista (en mobile ocupa la pantalla).
 * Vive en una ruta hija del listado y le comunica los cambios mediante `AccountTypeWorkspace`.
 */
@Component({
  selector: 'app-account-type-panel',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, LucideBan, LucideX],
  templateUrl: './account-type-panel.component.html',
})
export class AccountTypePanelComponent {
  private readonly getAccountType = inject(GetAccountTypeUseCase);
  private readonly createAccountType = inject(CreateAccountTypeUseCase);
  private readonly updateAccountType = inject(UpdateAccountTypeUseCase);
  private readonly workspace = inject(AccountTypeWorkspace);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly listUrl = LIST_URL;
  protected readonly nameMax = ACCOUNT_TYPE_NAME_MAX_LENGTH;
  protected readonly descriptionMax = ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH;
  /** Parámetros que interpolan los mensajes de longitud máxima. */
  protected readonly limits = { nameMax: ACCOUNT_TYPE_NAME_MAX_LENGTH, descriptionMax: ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH };
  protected readonly notFoundCode = AccountTypeErrorCode.NotFound;

  /** Tipo de cuenta en edición; `null` cuando se crea uno nuevo. Cambia si se pasa de una fila a otra. */
  protected readonly accountTypeId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.accountTypeId() !== null);
  /** El tipo de cuenta tal como llegó del backend, para desactivarlo con su nombre. */
  private readonly loaded = signal<AccountType | null>(null);

  protected readonly status = signal<PanelStatus>('ready');
  protected readonly loadError = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly formError = signal('');

  /** Si el pie del panel pide confirmar la eliminación. */
  protected readonly confirmingDeactivate = signal(false);
  protected readonly isDeactivating = signal(false);

  /** Errores que devolvió el backend para cada campo; se limpian al volver a escribir. */
  protected readonly nameServerError = signal<AccountTypeErrorCode | null>(null);
  protected readonly descriptionServerError = signal<AccountTypeErrorCode | null>(null);

  protected readonly accountTypeForm = this.formBuilder.group({
    name: ['', [notBlank, Validators.maxLength(ACCOUNT_TYPE_NAME_MAX_LENGTH)]],
    description: ['', [notBlank, Validators.maxLength(ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH)]],
  });

  private readonly formValue = toSignal(this.accountTypeForm.valueChanges, { initialValue: this.accountTypeForm.getRawValue() });

  protected readonly nameLength = computed(() => this.formValue().name?.length ?? 0);
  protected readonly descriptionLength = computed(() => this.formValue().description?.length ?? 0);

  constructor() {
    this.accountTypeForm.controls.name.valueChanges.subscribe(() => this.nameServerError.set(null));
    this.accountTypeForm.controls.description.valueChanges.subscribe(() => this.descriptionServerError.set(null));

    // Al pasar de editar una fila a otra, Angular reutiliza el panel: se reinicia con cada id.
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => this.open(parseId(params.get('id'))));

    inject(DestroyRef).onDestroy(() => this.workspace.selectedId.set(null));

    // Lleva el foco al título para que el lector de pantalla anuncie el panel recién abierto.
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }

  /** Código a mostrar bajo el nombre: primero el del backend, luego el de la validación local. */
  protected nameError(): AccountTypeErrorCode | null {
    return this.nameServerError() ?? this.localError(this.accountTypeForm.controls.name, NAME_CODES);
  }

  /** Código a mostrar bajo la descripción: primero el del backend, luego el de la validación local. */
  protected descriptionError(): AccountTypeErrorCode | null {
    return this.descriptionServerError() ?? this.localError(this.accountTypeForm.controls.description, DESCRIPTION_CODES);
  }

  protected retry(): void {
    const id = this.accountTypeId();

    if (id !== null) {
      this.load(id);
    }
  }

  /** Escape cierra el panel, salvo que haya cambios sin guardar. */
  protected closeOnEscape(): void {
    if (!this.accountTypeForm.dirty) {
      this.close();
    }
  }

  protected close(): void {
    void this.router.navigateByUrl(LIST_URL);
  }

  protected submit(): void {
    this.formError.set('');

    if (this.accountTypeForm.invalid) {
      this.accountTypeForm.markAllAsTouched();
      return;
    }

    const id = this.accountTypeId();
    const draft = this.accountTypeForm.getRawValue();
    const request: Observable<AccountType> =
      id === null ? this.createAccountType.execute(draft) : this.updateAccountType.execute(id, draft);

    this.isSubmitting.set(true);
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (accountType) => {
        this.workspace.saved(accountType, id === null ? 'created' : 'updated');
        this.close();
      },
      error: (error: unknown) => this.handleSubmitError(error),
    });
  }

  protected askDeactivate(): void {
    this.formError.set('');
    this.confirmingDeactivate.set(true);
  }

  protected cancelDeactivate(): void {
    this.confirmingDeactivate.set(false);
  }

  protected confirmDeactivate(): void {
    const accountType = this.loaded();

    if (!accountType) {
      return;
    }

    this.isDeactivating.set(true);
    this.workspace
      .deactivate(accountType)
      .pipe(finalize(() => this.isDeactivating.set(false)))
      .subscribe({
        next: () => this.close(),
        error: (error: unknown) => {
          this.confirmingDeactivate.set(false);

          if (error instanceof AccountTypeError && error.code === AccountTypeErrorCode.NotFound) {
            this.status.set('notFound');
            return;
          }

          this.formError.set(this.messageOf(error));
        },
      });
  }

  /** Prepara el panel para crear (`null`) o para editar el tipo de cuenta indicado. */
  private open(id: number | null): void {
    this.accountTypeId.set(id);
    this.workspace.selectedId.set(id);
    this.loaded.set(null);
    this.confirmingDeactivate.set(false);
    this.formError.set('');
    this.accountTypeForm.reset({ name: '', description: '' });

    if (id === null) {
      this.status.set('ready');
      return;
    }

    this.load(id);
  }

  private load(id: number): void {
    this.status.set('loading');
    this.loadError.set('');

    this.getAccountType.execute(id).subscribe({
      next: (accountType) => {
        this.loaded.set(accountType);
        this.accountTypeForm.reset({ name: accountType.name, description: accountType.description });
        this.status.set('ready');
      },
      error: (error: unknown) => {
        if (error instanceof AccountTypeError && error.code === AccountTypeErrorCode.NotFound) {
          this.status.set('notFound');
          return;
        }

        this.loadError.set(this.messageOf(error));
      },
    });
  }

  /** Ubica el error del backend junto a su campo; si no pertenece a ninguno, lo muestra en el formulario. */
  private handleSubmitError(error: unknown): void {
    const code = error instanceof AccountTypeError ? error.code : null;

    if (code && NAME_ERROR_CODES.includes(code)) {
      this.nameServerError.set(code);
    } else if (code && DESCRIPTION_ERROR_CODES.includes(code)) {
      this.descriptionServerError.set(code);
    } else if (code === AccountTypeErrorCode.NotFound) {
      this.status.set('notFound');
    } else {
      this.formError.set(this.messageOf(error));
    }
  }

  private localError(control: AbstractControl, codes: FieldErrorCodes): AccountTypeErrorCode | null {
    if (!control.touched || control.valid) {
      return null;
    }

    return control.hasError('maxlength') ? codes.maxLength : codes.required;
  }

  private messageOf(error: unknown): string {
    return error instanceof AccountTypeError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}

/** Convierte el parámetro de la ruta en un id entero, o `null` si no hay (crear). */
function parseId(raw: string | null): number | null {
  const id = raw === null ? NaN : Number(raw);

  return Number.isInteger(id) ? id : null;
}
