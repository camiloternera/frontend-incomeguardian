import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Observable, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { notBlank } from '@shared/forms/not-blank.validator';
import {
  CreateAccountUseCase,
  GetAccountUseCase,
  ListAccountTypeOptionsUseCase,
  UpdateAccountUseCase,
} from '../../../application/account-use-cases';
import {
  ACCOUNT_BALANCE_MAX_DECIMALS,
  ACCOUNT_BALANCE_MAX_INTEGER_DIGITS,
  ACCOUNT_NAME_MAX_LENGTH,
  Account,
  AccountTypeOption,
  CURRENCIES,
  Currency,
} from '../../../domain/account';
import {
  AccountError,
  AccountErrorCode,
  CURRENCY_ERROR_CODES,
  NAME_ERROR_CODES,
  TYPE_ERROR_CODES,
} from '../../../domain/account-error';
import { AccountNoticeState } from '../../account-notice';
import { balanceDigits } from '../../balance-format';
import { balanceValidator, parseBalance } from '../../validators/balance.validator';

/** Estado de la vista: listo para editar, cargando, sin cuenta o con una cuenta desactivada. */
type FormStatus = 'ready' | 'loading' | 'notFound' | 'readOnly';

/** Estado del selector de tipos de cuenta, que se carga aparte de la cuenta. */
type TypeOptionsStatus = 'loading' | 'ready' | 'error';

/** Mensaje a mostrar bajo un campo: clave de traducción y sus parámetros. */
interface FieldMessage {
  key: string;
  params?: Record<string, unknown>;
}

@Component({
  selector: 'app-account-form-page',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './account-form-page.component.html',
  styleUrls: ['./account-form-page.component.css'],
})
export class AccountFormPageComponent {
  private readonly getAccount = inject(GetAccountUseCase);
  private readonly createAccount = inject(CreateAccountUseCase);
  private readonly updateAccount = inject(UpdateAccountUseCase);
  private readonly listTypeOptions = inject(ListAccountTypeOptionsUseCase);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly theme = inject(ThemeService).theme;
  protected readonly locale = inject(LanguageService).language;
  protected readonly currencies = CURRENCIES;
  protected readonly nameMax = ACCOUNT_NAME_MAX_LENGTH;
  protected readonly balanceDigits = balanceDigits;
  protected readonly balanceParams = { decimals: ACCOUNT_BALANCE_MAX_DECIMALS, digits: ACCOUNT_BALANCE_MAX_INTEGER_DIGITS };
  protected readonly notFoundCode = AccountErrorCode.NotFound;

  /** Identificador de la cuenta en edición; `null` cuando se crea una nueva. */
  protected readonly accountId = this.readId();
  protected readonly isEdit = this.accountId !== null;

  protected readonly status = signal<FormStatus>(this.isEdit ? 'loading' : 'ready');
  protected readonly loadError = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly formError = signal('');
  /** Cuenta cargada, para el resumen de solo lectura de una cuenta desactivada. */
  protected readonly account = signal<Account | null>(null);

  protected readonly typeOptionsStatus = signal<TypeOptionsStatus>('loading');
  private readonly loadedTypeOptions = signal<AccountTypeOption[]>([]);

  /**
   * Tipos para el selector. Al editar se agrega el tipo actual aunque ya no esté activo, para que
   * el selector no quede vacío; si se guarda así, el backend responde ACCOUNT_TYPE_INVALID.
   */
  protected readonly typeOptions = computed(() => {
    const options = this.loadedTypeOptions();
    const current = this.account()?.accountType;

    return current && !options.some((option) => option.id === current.id) ? [current, ...options] : options;
  });

  /** Errores que devolvió el backend para cada campo; se limpian al cambiar el campo. */
  protected readonly nameServerError = signal<AccountErrorCode | null>(null);
  protected readonly typeServerError = signal<AccountErrorCode | null>(null);
  protected readonly currencyServerError = signal<AccountErrorCode | null>(null);

  protected readonly accountForm = this.formBuilder.group({
    name: ['', [notBlank, Validators.maxLength(ACCOUNT_NAME_MAX_LENGTH)]],
    accountTypeId: this.formBuilder.control<number | null>(null, Validators.required),
    currency: this.formBuilder.control<Currency>('COP', Validators.required),
    initialBalance: ['0', balanceValidator],
  });

  private readonly formValue = toSignal(this.accountForm.valueChanges, { initialValue: this.accountForm.getRawValue() });

  protected readonly nameLength = computed(() => this.formValue().name?.length ?? 0);

  constructor() {
    const controls = this.accountForm.controls;
    controls.name.valueChanges.subscribe(() => this.nameServerError.set(null));
    controls.accountTypeId.valueChanges.subscribe(() => this.typeServerError.set(null));
    controls.currency.valueChanges.subscribe(() => this.currencyServerError.set(null));

    this.loadTypeOptions();

    if (this.accountId !== null) {
      this.load(this.accountId);
    }
  }

  protected nameError(): FieldMessage | null {
    const control = this.accountForm.controls.name;
    const code = this.nameServerError() ?? (this.showsError(control) ? (control.hasError('maxlength') ? AccountErrorCode.NameMaxLength : AccountErrorCode.NameRequired) : null);

    return code ? this.codeMessage(code) : null;
  }

  protected typeError(): FieldMessage | null {
    const code = this.typeServerError();

    if (code) {
      return this.codeMessage(code);
    }

    return this.showsError(this.accountForm.controls.accountTypeId) ? { key: 'accounts.form.typeRequired' } : null;
  }

  protected currencyError(): FieldMessage | null {
    const code = this.currencyServerError() ?? (this.showsError(this.accountForm.controls.currency) ? AccountErrorCode.CurrencyRequired : null);

    return code ? this.codeMessage(code) : null;
  }

  protected balanceError(): FieldMessage | null {
    const control = this.accountForm.controls.initialBalance;

    if (!this.showsError(control)) {
      return null;
    }

    if (control.hasError('balanceTooLarge')) {
      return { key: 'accounts.form.balanceTooLarge', params: this.balanceParams };
    }

    return control.hasError('balanceInvalid')
      ? { key: 'accounts.form.balanceInvalid', params: this.balanceParams }
      : { key: 'accounts.form.balanceRequired' };
  }

  protected retry(): void {
    if (this.accountId !== null) {
      this.load(this.accountId);
    }
  }

  protected loadTypeOptions(): void {
    this.typeOptionsStatus.set('loading');
    this.listTypeOptions.execute().subscribe({
      next: (options) => {
        this.loadedTypeOptions.set(options);
        this.typeOptionsStatus.set('ready');
      },
      error: () => this.typeOptionsStatus.set('error'),
    });
  }

  protected submit(): void {
    this.formError.set('');

    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }

    const value = this.accountForm.getRawValue();
    const draft = {
      name: value.name,
      accountTypeId: value.accountTypeId!,
      currency: value.currency,
      initialBalance: parseBalance(value.initialBalance),
    };
    const request: Observable<Account> =
      this.accountId === null ? this.createAccount.execute(draft) : this.updateAccount.execute(this.accountId, draft);

    this.isSubmitting.set(true);
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (account) => {
        const state: AccountNoticeState = { notice: { kind: this.isEdit ? 'updated' : 'created', name: account.name } };
        void this.router.navigate(['/accounts'], { state });
      },
      error: (error: unknown) => this.handleSubmitError(error),
    });
  }

  private load(id: number): void {
    this.status.set('loading');
    this.loadError.set('');

    this.getAccount.execute(id).subscribe({
      next: (account) => {
        this.account.set(account);
        this.accountForm.reset({
          name: account.name,
          accountTypeId: account.accountType.id,
          currency: account.currency,
          initialBalance: String(account.initialBalance),
        });
        // Una cuenta desactivada solo se consulta; el backend no permite editarla.
        this.status.set(account.isActive ? 'ready' : 'readOnly');
      },
      error: (error: unknown) => {
        if (error instanceof AccountError && error.code === AccountErrorCode.NotFound) {
          this.status.set('notFound');
          return;
        }

        this.loadError.set(this.messageOf(error));
      },
    });
  }

  /** Ubica el error del backend junto a su campo; si no pertenece a ninguno, lo muestra en el formulario. */
  private handleSubmitError(error: unknown): void {
    const code = error instanceof AccountError ? error.code : null;

    if (code && NAME_ERROR_CODES.includes(code)) {
      this.nameServerError.set(code);
    } else if (code && TYPE_ERROR_CODES.includes(code)) {
      this.typeServerError.set(code);
      // El tipo elegido dejó de estar disponible: se recargan las opciones.
      this.loadTypeOptions();
    } else if (code && CURRENCY_ERROR_CODES.includes(code)) {
      this.currencyServerError.set(code);
    } else if (code === AccountErrorCode.NotFound) {
      this.status.set('notFound');
    } else {
      this.formError.set(this.messageOf(error));
    }
  }

  private codeMessage(code: AccountErrorCode): FieldMessage {
    return { key: `accounts.errors.${code}`, params: { nameMax: ACCOUNT_NAME_MAX_LENGTH } };
  }

  private showsError(control: { touched: boolean; valid: boolean }): boolean {
    return control.touched && !control.valid;
  }

  private readId(): number | null {
    const raw = inject(ActivatedRoute).snapshot.paramMap.get('id');
    const id = raw === null ? NaN : Number(raw);

    return Number.isInteger(id) ? id : null;
  }

  private messageOf(error: unknown): string {
    return error instanceof AccountError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
