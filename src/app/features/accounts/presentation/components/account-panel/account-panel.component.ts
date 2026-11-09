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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideBan, LucideX } from '@lucide/angular';
import { Observable, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { notBlank } from '@shared/forms/not-blank.validator';
import { DatePickerComponent } from '@shared/ui/date-picker/date-picker.component';
import {
  CreateAccountUseCase,
  GetAccountUseCase,
  UpdateAccountUseCase,
} from '../../../application/account-use-cases';
import {
  ACCOUNT_BALANCE_MAX_DECIMALS,
  ACCOUNT_BALANCE_MAX_INTEGER_DIGITS,
  ACCOUNT_NAME_MAX_LENGTH,
  Account,
  Currency,
  SELECTABLE_CURRENCIES,
  isSelectableCurrency,
} from '../../../domain/account';
import {
  AccountError,
  AccountErrorCode,
  CURRENCY_ERROR_CODES,
  NAME_ERROR_CODES,
  OPENING_DATE_ERROR_CODES,
} from '../../../domain/account-error';
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

  /** Hoy en el navegador: tope del selector de fecha de apertura. Se renueva al abrir el panel. */
  protected readonly today = signal(toOpeningParts(new Date()).day);

  protected readonly accountForm = this.formBuilder.group(
    {
      name: ['', [notBlank, Validators.maxLength(ACCOUNT_NAME_MAX_LENGTH)]],
      currency: this.formBuilder.control<Currency>('COP', Validators.required),
      initialBalance: ['0', balanceValidator],
      openingDay: ['', Validators.required],
      openingTime: ['', Validators.required],
    },
    { validators: openingNotInFuture },
  );

  private readonly formValue = toSignal(this.accountForm.valueChanges, {
    initialValue: this.accountForm.getRawValue(),
  });

  protected readonly nameLength = computed(() => this.formValue().name?.length ?? 0);
  protected readonly currency = computed(() => this.formValue().currency ?? 'COP');

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
    const draft = {
      name: value.name,
      currency: value.currency,
      initialBalance: parseBalance(value.initialBalance),
      // El formulario es válido, así que el día y la hora forman un instante.
      openingDate: toOffsetIso(openingInstant(value.openingDay, value.openingTime)!),
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

    // Una cuenta nueva abre por defecto ahora mismo.
    const now = toOpeningParts(new Date());
    this.today.set(now.day);
    this.accountForm.reset({
      name: '',
      currency: 'COP',
      initialBalance: '0',
      openingDay: now.day,
      openingTime: now.time,
    });

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
        this.accountForm.reset({
          name: account.name,
          currency: account.currency,
          initialBalance: String(account.initialBalance),
          openingDay: opening.day,
          openingTime: opening.time,
        });
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
