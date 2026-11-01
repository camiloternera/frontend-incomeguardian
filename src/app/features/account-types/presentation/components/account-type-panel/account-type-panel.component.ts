import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Observable, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { ThemeService } from '@core/theme/theme.service';
import { notBlank } from '@shared/forms/not-blank.validator';
import {
  CreateAccountTypeUseCase,
  GetAccountTypeUseCase,
  UpdateAccountTypeUseCase,
} from '../../../application/account-type-use-cases';
import {
  ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH,
  ACCOUNT_TYPE_NAME_MAX_LENGTH,
  AccountType,
} from '../../../domain/account-type';
import {
  AccountTypeError,
  AccountTypeErrorCode,
  DESCRIPTION_ERROR_CODES,
  NAME_ERROR_CODES,
} from '../../../domain/account-type-error';
import { AccountTypeNoticeState } from '../../account-type-notice';

/** Estado de la vista: listo para editar, cargando o sin tipo de cuenta. */
type FormStatus = 'ready' | 'loading' | 'notFound';

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

@Component({
  selector: 'app-account-type-form-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './account-type-form-page.component.html',
  styleUrls: ['./account-type-form-page.component.css'],
})
export class AccountTypeFormPageComponent {
  private readonly getAccountType = inject(GetAccountTypeUseCase);
  private readonly createAccountType = inject(CreateAccountTypeUseCase);
  private readonly updateAccountType = inject(UpdateAccountTypeUseCase);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly theme = inject(ThemeService).theme;
  protected readonly nameMax = ACCOUNT_TYPE_NAME_MAX_LENGTH;
  protected readonly descriptionMax = ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH;
  /** Parámetros que interpolan los mensajes de longitud máxima. */
  protected readonly limits = { nameMax: ACCOUNT_TYPE_NAME_MAX_LENGTH, descriptionMax: ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH };
  protected readonly notFoundCode = AccountTypeErrorCode.NotFound;

  /** Identificador del tipo en edición; `null` cuando se crea uno nuevo. */
  protected readonly accountTypeId = this.readId();
  protected readonly isEdit = this.accountTypeId !== null;

  protected readonly status = signal<FormStatus>(this.isEdit ? 'loading' : 'ready');
  protected readonly loadError = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly formError = signal('');

  /** Errores que devolvió el backend para cada campo; se limpian al volver a escribir. */
  protected readonly nameServerError = signal<AccountTypeErrorCode | null>(null);
  protected readonly descriptionServerError = signal<AccountTypeErrorCode | null>(null);

  protected readonly accountTypeForm = this.formBuilder.group({
    name: ['', [notBlank, Validators.maxLength(ACCOUNT_TYPE_NAME_MAX_LENGTH)]],
    description: ['', [notBlank, Validators.maxLength(ACCOUNT_TYPE_DESCRIPTION_MAX_LENGTH)]],
  });

  private readonly formValue = toSignal(this.accountTypeForm.valueChanges, {
    initialValue: this.accountTypeForm.getRawValue(),
  });

  protected readonly nameLength = computed(() => this.formValue().name?.length ?? 0);
  protected readonly descriptionLength = computed(() => this.formValue().description?.length ?? 0);

  constructor() {
    this.accountTypeForm.controls.name.valueChanges.subscribe(() => this.nameServerError.set(null));
    this.accountTypeForm.controls.description.valueChanges.subscribe(() => this.descriptionServerError.set(null));

    if (this.accountTypeId !== null) {
      this.load(this.accountTypeId);
    }
  }

  /** Código a mostrar bajo el nombre: primero el del backend, luego el de la validación local. */
  protected nameError(): AccountTypeErrorCode | null {
    return this.nameServerError() ?? this.localError(this.accountTypeForm.controls.name, NAME_CODES);
  }

  /** Código a mostrar bajo la descripción: primero el del backend, luego el de la validación local. */
  protected descriptionError(): AccountTypeErrorCode | null {
    return (
      this.descriptionServerError() ?? this.localError(this.accountTypeForm.controls.description, DESCRIPTION_CODES)
    );
  }

  protected retry(): void {
    if (this.accountTypeId !== null) {
      this.load(this.accountTypeId);
    }
  }

  protected submit(): void {
    this.formError.set('');

    if (this.accountTypeForm.invalid) {
      this.accountTypeForm.markAllAsTouched();
      return;
    }

    const draft = this.accountTypeForm.getRawValue();
    const request: Observable<AccountType> =
      this.accountTypeId === null
        ? this.createAccountType.execute(draft)
        : this.updateAccountType.execute(this.accountTypeId, draft);

    this.isSubmitting.set(true);
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (accountType) => {
        const state: AccountTypeNoticeState = {
          notice: { kind: this.isEdit ? 'updated' : 'created', name: accountType.name },
        };
        void this.router.navigate(['/account-types'], { state });
      },
      error: (error: unknown) => this.handleSubmitError(error),
    });
  }

  private load(id: number): void {
    this.status.set('loading');
    this.loadError.set('');

    this.getAccountType.execute(id).subscribe({
      next: (accountType) => {
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

  private readId(): number | null {
    const raw = inject(ActivatedRoute).snapshot.paramMap.get('id');
    const id = raw === null ? NaN : Number(raw);

    return Number.isInteger(id) ? id : null;
  }

  private messageOf(error: unknown): string {
    return error instanceof AccountTypeError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
