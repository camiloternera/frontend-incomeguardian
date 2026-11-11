import { CurrencyPipe, DatePipe, getCurrencySymbol } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideBan, LucideX } from '@lucide/angular';
import { Observable, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { notBlank } from '@shared/forms/not-blank.validator';
import { DatePickerComponent } from '@shared/ui/date-picker/date-picker.component';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';
import {
  CreateAccountUseCase,
  GetAccountUseCase,
  UpdateAccountUseCase,
} from '../../../application/account-use-cases';
import {
  ACCOUNT_BALANCE_MAX_DECIMALS,
  ACCOUNT_BALANCE_MAX_INTEGER_DIGITS,
  ACCOUNT_KINDS,
  ACCOUNT_NAME_MAX_LENGTH,
  Account,
  AccountKind,
  CARD_DAY_MAX,
  CARD_DAY_MIN,
  Currency,
  SELECTABLE_CURRENCIES,
  isSelectableCurrency,
} from '../../../domain/account';
import {
  AccountError,
  AccountErrorCode,
  CREDIT_LIMIT_ERROR_CODES,
  CURRENCY_ERROR_CODES,
  KIND_ERROR_CODES,
  NAME_ERROR_CODES,
  OPENING_DATE_ERROR_CODES,
  PAYMENT_DAY_ERROR_CODES,
  STATEMENT_DAY_ERROR_CODES,
} from '../../../domain/account-error';
import {
  cardDayOf,
  nextStatementDate,
  paymentDueDate,
  statementMonthFor,
} from '../../../domain/credit-card-calendar';
import { cardFieldsValidator } from '../../validators/card-fields';
import { AccountWorkspace } from '../../account-workspace';
import { moneyDigits as balanceDigits } from '@shared/money/money-format';
import { balanceValidator, parseBalance } from '../../validators/balance.validator';
import {
  openingInstant,
  openingNotInFuture,
  toOffsetIso,
  toOpeningParts,
} from '../../validators/opening-date';

/** Estado del panel: listo para editar, cargando, sin cuenta o con una cuenta desactivada. */
type PanelStatus = 'ready' | 'loading' | 'notFound' | 'readOnly';

/** Mensaje a mostrar bajo un campo: clave de traducción y sus parámetros. */
interface FieldMessage {
  key: string;
  params?: Record<string, unknown>;
}

/** Ruta del listado, a la que vuelve el panel al cerrarse. */
const LIST_URL = '/accounts';

/**
 * Panel para crear, editar o consultar una cuenta junto a la lista (en mobile ocupa la pantalla).
 * Vive en una ruta hija del listado y le comunica los cambios mediante `AccountWorkspace`.
 */
@Component({
  selector: 'app-account-panel',
  imports: [
    CurrencyPipe,
    DatePipe,
    DatePickerComponent,
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    SelectComponent,
    LucideBan,
    LucideX,
  ],
  templateUrl: './account-panel.component.html',
})
export class AccountPanelComponent {
  private readonly getAccount = inject(GetAccountUseCase);
  private readonly createAccount = inject(CreateAccountUseCase);
  private readonly updateAccount = inject(UpdateAccountUseCase);
  private readonly workspace = inject(AccountWorkspace);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly listUrl = LIST_URL;
  protected readonly locale = inject(LanguageService).language;
  protected readonly currencies = SELECTABLE_CURRENCIES;
  protected readonly kinds = ACCOUNT_KINDS;
  protected readonly nameMax = ACCOUNT_NAME_MAX_LENGTH;
  protected readonly balanceDigits = balanceDigits;
  protected readonly balanceParams = {
    decimals: ACCOUNT_BALANCE_MAX_DECIMALS,
    digits: ACCOUNT_BALANCE_MAX_INTEGER_DIGITS,
  };
  protected readonly notFoundCode = AccountErrorCode.NotFound;

  /** Cuenta en edición; `null` cuando se crea una nueva. Cambia si se pasa de una fila a otra. */
  protected readonly accountId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.accountId() !== null);
  /** La cuenta tal como llegó del backend, para desactivarla y para el resumen de solo lectura. */
  protected readonly account = signal<Account | null>(null);

  /** Con movimientos la cuenta ya no admite cambiar el nombre, la moneda ni el tipo. */
  protected readonly identityLocked = computed(() => this.account()?.hasTransactions === true);

  protected readonly status = signal<PanelStatus>('ready');
  protected readonly loadError = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly formError = signal('');

  /** Si el pie del panel pide confirmar la desactivación. */
  protected readonly confirmingDeactivate = signal(false);
  protected readonly isDeactivating = signal(false);

  /** Errores que devolvió el backend para cada campo; se limpian al cambiar el campo. */
  protected readonly nameServerError = signal<AccountErrorCode | null>(null);
  protected readonly currencyServerError = signal<AccountErrorCode | null>(null);
  protected readonly openingServerError = signal<AccountErrorCode | null>(null);
  protected readonly kindServerError = signal<AccountErrorCode | null>(null);
  protected readonly balanceServerError = signal<AccountErrorCode | null>(null);
  protected readonly creditLimitServerError = signal<AccountErrorCode | null>(null);
  protected readonly statementDayServerError = signal<AccountErrorCode | null>(null);
  protected readonly paymentDayServerError = signal<AccountErrorCode | null>(null);

  /** Hoy en el navegador: tope del selector de fecha de apertura. Se renueva al abrir el panel. */
  protected readonly today = signal(toOpeningParts(new Date()).day);

  protected readonly accountForm = this.formBuilder.group(
    {
      name: ['', [notBlank, Validators.maxLength(ACCOUNT_NAME_MAX_LENGTH)]],
      kind: this.formBuilder.control<AccountKind>('standard'),
      currency: this.formBuilder.control<Currency>('COP', Validators.required),
      /** En una tarjeta es la deuda, escrita en positivo; se envía en negativo. */
      initialBalance: ['0', balanceValidator],
      /** Cupo opcional de la tarjeta; vacío si no se registra. */
      creditLimit: ['', (control: AbstractControl<string>) => (control.value.trim() ? balanceValidator(control) : null)],
      statementDay: this.formBuilder.control<number | null>(null),
      paymentDay: this.formBuilder.control<number | null>(null),
      openingDay: ['', Validators.required],
      openingTime: ['', Validators.required],
    },
    { validators: [openingNotInFuture, cardFieldsValidator] },
  );

  private readonly formValue = toSignal(this.accountForm.valueChanges, {
    initialValue: this.accountForm.getRawValue(),
  });

  protected readonly nameLength = computed(() => this.formValue().name?.length ?? 0);
  protected readonly currency = computed(() => this.formValue().currency ?? 'COP');

  /** El tipo, leído del control: `formValue` lo omite cuando el control está deshabilitado. */
  private readonly kind = toSignal(this.accountForm.controls.kind.valueChanges, {
    initialValue: this.accountForm.controls.kind.value,
  });
  protected readonly isCard = computed(() => this.kind() === 'credit_card');

  /** Días del 1 al 31 para el corte y el pago; la etiqueta del campo ya dice de qué día se trata. */
  protected readonly dayOptions: SelectOption<number>[] = Array.from(
    { length: CARD_DAY_MAX - CARD_DAY_MIN + 1 },
    (_, index) => ({ value: CARD_DAY_MIN + index, label: String(CARD_DAY_MIN + index) }),
  );

  /**
   * Próximo corte y fecha límite de ESE corte, según los días elegidos (no la del último corte sin
   * pagar). `paysNextMonth` indica que el pago cae en el mes siguiente al corte.
   */
  protected readonly cardPreview = computed(() => {
    const { statementDay, paymentDay } = this.formValue();

    if (!this.isCard() || !statementDay || !paymentDay) {
      return null;
    }

    const today = cardDayOf(new Date());

    return {
      statementDate: nextStatementDate(today, statementDay),
      paymentDueDate: paymentDueDate(statementMonthFor(today, statementDay), statementDay, paymentDay),
      paysNextMonth: paymentDay <= statementDay,
    };
  });

  /** Símbolo de la moneda elegida para el prefijo del saldo; el código se añade solo si el símbolo no lo dice. */
  protected readonly currencySymbol = computed(() =>
    getCurrencySymbol(this.currency(), 'wide', this.locale()),
  );

  constructor() {
    const controls = this.accountForm.controls;
    controls.name.valueChanges.subscribe(() => this.nameServerError.set(null));
    controls.currency.valueChanges.subscribe(() => this.currencyServerError.set(null));
    controls.openingDay.valueChanges.subscribe(() => this.openingServerError.set(null));
    controls.openingTime.valueChanges.subscribe(() => this.openingServerError.set(null));
    controls.kind.valueChanges.subscribe(() => this.kindServerError.set(null));
    controls.initialBalance.valueChanges.subscribe(() => this.balanceServerError.set(null));
    controls.creditLimit.valueChanges.subscribe(() => this.creditLimitServerError.set(null));
    controls.statementDay.valueChanges.subscribe(() => this.statementDayServerError.set(null));
    controls.paymentDay.valueChanges.subscribe(() => this.paymentDayServerError.set(null));

    // Al pasar de editar una fila a otra, Angular reutiliza el panel: se reinicia con cada id.
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => this.open(parseId(params.get('id'))));

    inject(DestroyRef).onDestroy(() => this.workspace.selectedId.set(null));

    // Lleva el foco al título para que el lector de pantalla anuncie el panel recién abierto.
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }

  protected nameError(): FieldMessage | null {
    const control = this.accountForm.controls.name;
    const local = this.showsError(control)
      ? control.hasError('maxlength')
        ? AccountErrorCode.NameMaxLength
        : AccountErrorCode.NameRequired
      : null;
    const code = this.nameServerError() ?? local;

    return code ? this.codeMessage(code) : null;
  }

  protected currencyError(): FieldMessage | null {
    const code =
      this.currencyServerError() ??
      (this.showsError(this.accountForm.controls.currency)
        ? AccountErrorCode.CurrencyRequired
        : null);

    return code ? this.codeMessage(code) : null;
  }

  /** Error de la fecha de apertura: falta el día o la hora, es futura o lo rechazó el backend. */
  protected openingError(): FieldMessage | null {
    const { openingDay, openingTime } = this.accountForm.controls;
    const touched = openingDay.touched || openingTime.touched;
    let local: AccountErrorCode | null = null;

    if (touched && (openingDay.invalid || openingTime.invalid)) {
      local = AccountErrorCode.OpeningDateRequired;
    } else if (touched && this.accountForm.hasError('openingFuture')) {
      local = AccountErrorCode.OpeningDateFuture;
    }

    const code = this.openingServerError() ?? local;

    return code ? this.codeMessage(code) : null;
  }

  protected balanceError(): FieldMessage | null {
    const control = this.accountForm.controls.initialBalance;
    const serverCode = this.balanceServerError();

    if (serverCode) {
      return this.codeMessage(serverCode);
    }

    if (control.touched && control.valid && this.isCard() && this.accountForm.hasError('debtNegative')) {
      return { key: 'accounts.form.card.debtNegative' };
    }

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

  protected kindError(): FieldMessage | null {
    const code = this.kindServerError();

    return code ? this.codeMessage(code) : null;
  }

  protected creditLimitError(): FieldMessage | null {
    const code = this.creditLimitServerError();
    const control = this.accountForm.controls.creditLimit;

    if (code) {
      return this.codeMessage(code);
    }

    if (!control.touched) {
      return null;
    }

    if (!control.valid) {
      return control.hasError('balanceTooLarge')
        ? { key: 'accounts.form.balanceTooLarge', params: this.balanceParams }
        : { key: 'accounts.form.balanceInvalid', params: this.balanceParams };
    }

    return this.accountForm.hasError('creditLimitInvalid')
      ? this.codeMessage(AccountErrorCode.CreditLimitInvalid)
      : null;
  }

  protected statementDayError(): FieldMessage | null {
    const local =
      this.accountForm.controls.statementDay.touched && this.accountForm.hasError('statementDayRequired')
        ? AccountErrorCode.StatementDayRequired
        : null;
    const code = this.statementDayServerError() ?? local;

    return code ? this.codeMessage(code) : null;
  }

  protected paymentDayError(): FieldMessage | null {
    const local =
      this.accountForm.controls.paymentDay.touched && this.accountForm.hasError('paymentDayRequired')
        ? AccountErrorCode.PaymentDayRequired
        : null;
    const code = this.paymentDayServerError() ?? local;

    return code ? this.codeMessage(code) : null;
  }

  protected retry(): void {
    const id = this.accountId();

    if (id !== null) {
      this.load(id);
    }
  }

  /** Escape cierra el panel, salvo que haya cambios sin guardar. */
  protected closeOnEscape(): void {
    if (!this.accountForm.dirty) {
      this.close();
    }
  }

  protected close(): void {
    void this.router.navigateByUrl(LIST_URL);
  }

  protected submit(): void {
    this.formError.set('');

    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }

    const id = this.accountId();
    const value = this.accountForm.getRawValue();
    const isCard = value.kind === 'credit_card';
    const balance = parseBalance(value.initialBalance);
    const limit = value.creditLimit.trim();
    const draft = {
      name: value.name,
      kind: value.kind,
      currency: value.currency,
      // La deuda se escribe en positivo y el backend la guarda en negativo; `|| 0` evita enviar -0.
      initialBalance: isCard ? -balance || 0 : balance,
      // El formulario es válido, así que el día y la hora forman un instante.
      openingDate: toOffsetIso(openingInstant(value.openingDay, value.openingTime)!),
      creditLimit: isCard && limit ? parseBalance(limit) : null,
      statementDay: isCard ? value.statementDay : null,
      paymentDay: isCard ? value.paymentDay : null,
    };
    const request: Observable<Account> =
      id === null ? this.createAccount.execute(draft) : this.updateAccount.execute(id, draft);

    this.isSubmitting.set(true);
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (account) => {
        this.workspace.saved(account, id === null ? 'created' : 'updated');
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
    const account = this.account();

    if (!account) {
      return;
    }

    this.isDeactivating.set(true);
    this.workspace
      .deactivate(account)
      .pipe(finalize(() => this.isDeactivating.set(false)))
      .subscribe({
        next: () => this.close(),
        error: (error: unknown) => {
          this.confirmingDeactivate.set(false);

          if (error instanceof AccountError && error.code === AccountErrorCode.NotFound) {
            this.status.set('notFound');
            return;
          }

          this.formError.set(this.messageOf(error));
        },
      });
  }

  /** Prepara el panel para crear (`null`) o para editar la cuenta indicada. */
  private open(id: number | null): void {
    this.accountId.set(id);
    this.workspace.selectedId.set(id);
    this.account.set(null);
    this.confirmingDeactivate.set(false);
    this.formError.set('');
    this.nameServerError.set(null);
    this.currencyServerError.set(null);
    this.openingServerError.set(null);
    this.kindServerError.set(null);
    this.balanceServerError.set(null);
    this.creditLimitServerError.set(null);
    this.statementDayServerError.set(null);
    this.paymentDayServerError.set(null);

    // Una cuenta nueva abre por defecto ahora mismo.
    const now = toOpeningParts(new Date());
    this.today.set(now.day);
    this.accountForm.reset({
      name: '',
      kind: 'standard',
      currency: 'COP',
      initialBalance: '0',
      creditLimit: '',
      statementDay: null,
      paymentDay: null,
      openingDay: now.day,
      openingTime: now.time,
    });
    this.accountForm.controls.name.enable({ emitEvent: false });
    this.accountForm.controls.currency.enable({ emitEvent: false });
    this.accountForm.controls.kind.enable({ emitEvent: false });

    if (id === null) {
      this.status.set('ready');
      return;
    }

    this.load(id);
  }

  private load(id: number): void {
    this.status.set('loading');
    this.loadError.set('');

    this.getAccount.execute(id).subscribe({
      next: (account) => {
        this.account.set(account);
        const opening = toOpeningParts(new Date(account.openingDate));
        const isCard = account.kind === 'credit_card';
        this.accountForm.reset({
          name: account.name,
          kind: account.kind,
          currency: account.currency,
          // En una tarjeta se edita la deuda en positivo; `|| 0` evita mostrar -0.
          initialBalance: String(isCard ? -account.initialBalance || 0 : account.initialBalance),
          creditLimit: account.creditLimit === null ? '' : String(account.creditLimit),
          statementDay: account.statementDay,
          paymentDay: account.paymentDay,
          openingDay: opening.day,
          openingTime: opening.time,
        });
        // Con movimientos el backend ya no deja cambiar nombre, moneda ni tipo; se envían igual al guardar.
        if (account.hasTransactions) {
          this.accountForm.controls.name.disable({ emitEvent: false });
          this.accountForm.controls.currency.disable({ emitEvent: false });
          this.accountForm.controls.kind.disable({ emitEvent: false });
        }
        // Una cuenta desactivada o en una moneda que ya no se admite (EUR) solo se consulta.
        this.status.set(account.isActive && isSelectableCurrency(account.currency) ? 'ready' : 'readOnly');
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
    } else if (code && CURRENCY_ERROR_CODES.includes(code)) {
      this.currencyServerError.set(code);
    } else if (code && OPENING_DATE_ERROR_CODES.includes(code)) {
      this.openingServerError.set(code);
    } else if (code && KIND_ERROR_CODES.includes(code)) {
      this.kindServerError.set(code);
    } else if (code === AccountErrorCode.CardInitialBalancePositive) {
      this.balanceServerError.set(code);
    } else if (code && CREDIT_LIMIT_ERROR_CODES.includes(code)) {
      this.creditLimitServerError.set(code);
    } else if (code && STATEMENT_DAY_ERROR_CODES.includes(code)) {
      this.statementDayServerError.set(code);
    } else if (code && PAYMENT_DAY_ERROR_CODES.includes(code)) {
      this.paymentDayServerError.set(code);
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

  private messageOf(error: unknown): string {
    return error instanceof AccountError
      ? error.message
      : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}

/** Convierte el parámetro de la ruta en un id entero, o `null` si no hay (crear). */
function parseId(raw: string | null): number | null {
  const id = raw === null ? NaN : Number(raw);

  return Number.isInteger(id) ? id : null;
}
