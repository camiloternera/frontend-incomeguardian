import { DatePipe, formatDate } from '@angular/common';
import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleAlert, LucideLock, LucidePlus, LucideX } from '@lucide/angular';
import {
  Observable,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  merge,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { LanguageService } from '@core/i18n/language.service';
import { dayPattern, shortDayPattern } from '@shared/dates/date-patterns';
import { LockedDateNoteComponent, PeriodOverlaysComponent, ReopenPeriodButtonComponent } from '@features/periods';
import { DatePickerComponent } from '@shared/ui/date-picker/date-picker.component';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';
import {
  CreateTransactionUseCase,
  GetExchangeRateUseCase,
  ListTransactionAccountOptionsUseCase,
  ListTransactionCategoryOptionsUseCase,
  PreviewInstallmentsUseCase,
} from '../../../application/transaction-use-cases';
import {
  CARD_PAYMENT_CATEGORY_CODE,
  ExchangeRate,
  INSTALLMENTS_MAX,
  INSTALLMENTS_MIN,
  INSTALLMENT_CHOICES,
  INTEREST_RATE_MAX,
  INTEREST_RATE_MIN,
  InstallmentPreview,
  InstallmentPreviewRequest,
  TransactionMonth,
  TRANSACTION_AMOUNT_MAX_DECIMALS,
  TRANSACTION_AMOUNT_MAX_INTEGER_DIGITS,
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_TIME_ZONE,
  TransactionAccountOption,
  TransactionCategoryOption,
  TransactionCurrency,
  TransactionDraft,
  TransactionType,
  categoryAppliesTo,
  isCrossCurrency,
  isTransactionType,
  isUsableAccount,
  parseMonth,
  previewDestinationAmount,
  roundAwayFromZero,
} from '../../../domain/transaction';
import {
  ACCOUNT_ERROR_CODES,
  AMOUNT_ERROR_CODES,
  CATEGORY_ERROR_CODES,
  DESCRIPTION_ERROR_CODES,
  INSTALLMENT_ERROR_CODES,
  RATE_ERROR_CODES,
  TransactionError,
  TransactionErrorCode,
} from '../../../domain/transaction-error';
import { currencySymbol, formatMoney } from '../../money-format';
import { TransactionWorkspace } from '../../transaction-workspace';
import { injectTransactionsTranslations } from '../../transactions-translations';
import { amountValidator, parseAmount } from '../../validators/amount.validator';

/** Estado de una lista de opciones que se carga aparte del formulario. */
type OptionsStatus = 'loading' | 'ready' | 'error';

/**
 * Estado de la TRM de una transferencia entre monedas. Cada estado recuerda la fecha que se
 * consultó, para no mostrar ni usar la TRM de otra fecha mientras llega la nueva.
 */
type RateState =
  | { status: 'idle' }
  | { status: 'loading'; date: string }
  | { status: 'ready'; date: string; rate: ExchangeRate }
  | { status: 'error'; date: string; message: string };

/** Estado del plan de cuotas que calcula el backend para la compra que se está escribiendo. */
type InstallmentPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; preview: InstallmentPreview }
  | { status: 'error'; message: string };

/** Montos sugeridos al pagar una tarjeta: lo que falta del extracto o toda la deuda. */
type PayPreset = 'statement' | 'all';

/** Pago de tarjeta que se abrió desde un extracto (`?payCard=&statement=&due=`). */
interface CardPayment {
  cardId: number;
  /** Mes del extracto que se paga; null si no se indicó. */
  statement: TransactionMonth | null;
  /** Lo que falta por pagar del extracto, en la moneda de la tarjeta; null si no se indicó. */
  due: number | null;
}

/** Mensaje a mostrar bajo un campo: clave de traducción y sus parámetros. */
interface FieldMessage {
  key: string;
  params?: Record<string, unknown>;
}

/** Ruta del listado, a la que vuelve el panel al cerrarse. */
const LIST_URL = '/transactions';

/** Orden del selector de tipo: el gasto es el movimiento más frecuente. */
const TYPE_ORDER: readonly TransactionType[] = ['expense', 'income', 'transfer'];

/**
 * Panel para registrar un ingreso, un gasto o una transferencia junto a la lista (en mobile ocupa
 * la pantalla). Vive en la ruta hija `new/:type` y avisa al listado mediante `TransactionWorkspace`.
 */
@Component({
  selector: 'app-transaction-panel',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    LucideCircleAlert,
    LucideLock,
    LucidePlus,
    LucideX,
    SelectComponent,
    DatePickerComponent,
    LockedDateNoteComponent,
    PeriodOverlaysComponent,
    ReopenPeriodButtonComponent,
  ],
  templateUrl: './transaction-panel.component.html',
})
export class TransactionPanelComponent {
  private readonly createTransaction = inject(CreateTransactionUseCase);
  private readonly getExchangeRate = inject(GetExchangeRateUseCase);
  private readonly listAccounts = inject(ListTransactionAccountOptionsUseCase);
  private readonly listCategories = inject(ListTransactionCategoryOptionsUseCase);
  private readonly previewInstallments = inject(PreviewInstallmentsUseCase);
  private readonly route = inject(ActivatedRoute);
  private readonly workspace = inject(TransactionWorkspace);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly translations = injectTransactionsTranslations();
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly lockedNote = viewChild(LockedDateNoteComponent);

  protected readonly listUrl = LIST_URL;
  protected readonly typeOrder = TYPE_ORDER;
  protected readonly locale = inject(LanguageService).language;
  /** Patrones de fecha del idioma activo, con el mes en letras. */
  protected readonly shortDay = computed(() => shortDayPattern(this.locale()));
  protected readonly day = computed(() => dayPattern(this.locale()));
  protected readonly descriptionMax = TRANSACTION_DESCRIPTION_MAX_LENGTH;
  protected readonly installmentChoices = INSTALLMENT_CHOICES;
  protected readonly installmentLimits = { min: INSTALLMENTS_MIN, max: INSTALLMENTS_MAX };
  protected readonly rateLimits = { min: INTEREST_RATE_MIN, max: INTEREST_RATE_MAX };
  protected readonly amountParams = {
    decimals: TRANSACTION_AMOUNT_MAX_DECIMALS,
    digits: TRANSACTION_AMOUNT_MAX_INTEGER_DIGITS,
  };

  /** Límite del selector de fecha: el backend no tiene TRM para fechas futuras. */
  protected readonly today = todayInputDate();

  /** Tipo de movimiento que se registra; lo dicta la ruta. */
  protected readonly type = signal<TransactionType>('expense');

  protected readonly isSubmitting = signal(false);
  protected readonly formError = signal('');

  protected readonly accountsStatus = signal<OptionsStatus>('loading');
  private readonly accounts = signal<TransactionAccountOption[]>([]);
  protected readonly categoriesStatus = signal<OptionsStatus>('loading');
  protected readonly categories = signal<TransactionCategoryOption[]>([]);
  /** Último resultado de la consulta de la TRM; `rateState` lo cruza con la fecha vigente. */
  private readonly rateResult = signal<RateState>({ status: 'idle' });

  /** Errores que devolvió el backend para cada campo; se limpian al cambiar el campo. */
  protected readonly amountServerError = signal<TransactionErrorCode | null>(null);
  protected readonly accountServerError = signal<TransactionErrorCode | null>(null);
  protected readonly categoryServerError = signal<TransactionErrorCode | null>(null);
  protected readonly descriptionServerError = signal<TransactionErrorCode | null>(null);
  protected readonly installmentsServerError = signal<TransactionErrorCode | null>(null);
  /** Mes cerrado de una cuota (distinto del de la fecha) que impidió guardar la compra. */
  protected readonly closedInstallmentMonth = signal<TransactionMonth | null>(null);

  /** Pago de tarjeta abierto desde un extracto; null en un movimiento normal. */
  protected readonly cardPayment = signal<CardPayment | null>(null);
  /** Monto sugerido elegido; se suelta en cuanto la persona escribe otro monto. */
  protected readonly payPreset = signal<PayPreset | null>(null);
  /** Texto que puso el monto sugerido, para saber si la persona lo cambió después. */
  private presetText: string | null = null;

  protected readonly form = this.formBuilder.group({
    amount: ['', amountValidator],
    description: ['', Validators.maxLength(TRANSACTION_DESCRIPTION_MAX_LENGTH)],
    /** Todo movimiento lleva categoría de su mismo tipo. */
    categoryId: this.formBuilder.control<number | null>(null, Validators.required),
    /** Cuenta de un ingreso (a la que entra) o de un gasto (de la que sale). */
    accountId: this.formBuilder.control<number | null>(null),
    fromAccountId: this.formBuilder.control<number | null>(null),
    toAccountId: this.formBuilder.control<number | null>(null),
    date: [todayInputDate(), [Validators.required, notInFuture]],
    /** Cuotas de un gasto con tarjeta; 1 en cualquier otro caso. */
    installments: this.formBuilder.control(1),
    /** «Otra»: número de cuotas escrito a mano. */
    customInstallments: ['', customInstallmentsValidator],
    /** Si la compra a cuotas cobra interés. */
    withInterest: this.formBuilder.control(false),
    /** Tasa efectiva anual (%) cuando hay interés. */
    interestRate: ['', interestRateValidator],
  });

  protected readonly formValue = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Solo se pueden elegir cuentas activas en una moneda soportada; las demás no se ofrecen. */
  private readonly usableAccounts = computed(() => this.accounts().filter(isUsableAccount));
  protected readonly accountOptions = computed<SelectOption<number>[]>(() =>
    this.usableAccounts().map(toAccountOption),
  );
  protected readonly hasUsableAccounts = computed(() => this.usableAccounts().length > 0);

  /** Cuenta que define la moneda del monto: la del ingreso o gasto, o el origen de la transferencia. */
  protected readonly account = computed(() => {
    const value = this.formValue();
    const id = this.type() === 'transfer' ? value.fromAccountId : value.accountId;

    return this.findAccount(id);
  });
  protected readonly destination = computed(() =>
    this.type() === 'transfer' ? this.findAccount(this.formValue().toAccountId) : null,
  );
  /** Cuentas de las que puede salir una transferencia; al pagar una tarjeta, todas menos esa tarjeta. */
  protected readonly sourceOptions = computed<SelectOption<number>[]>(() => {
    const cardId = this.cardPayment()?.cardId;

    return this.usableAccounts()
      .filter((account) => account.id !== cardId)
      .map(toAccountOption);
  });
  /** Cuentas a las que puede llegar la transferencia: todas las utilizables menos el origen. */
  protected readonly destinationOptions = computed<SelectOption<number>[]>(() =>
    this.usableAccounts()
      .filter((account) => account.id !== this.formValue().fromAccountId)
      .map(toAccountOption),
  );

  /** Saldo actual de la cuenta elegida, ya formateado; `null` si no se conoce. */
  protected readonly balanceText = computed(() => this.balanceOf(this.account()));
  /** Saldo actual de la cuenta destino de la transferencia. */
  protected readonly destinationBalanceText = computed(() => this.balanceOf(this.destination()));

  /** No hay categorías activas del tipo: no se puede guardar hasta crear una. */
  protected readonly missingCategories = computed(
    () => this.categoriesStatus() === 'ready' && this.categories().length === 0,
  );

  /** Opciones del selector de categoría: solo las activas del tipo, sin opción vacía. */
  protected readonly categoryOptions = computed<SelectOption<number>[]>(() => {
    // Las categorías de sistema se nombran por su código, en el idioma activo, cuando el scope ya cargó.
    const ready = this.translations() !== null;

    return this.categories().map((category) => ({
      value: category.id,
      label: category.code && ready
        ? this.transloco.translate(`transactions.systemCategories.${category.code}`)
        : category.name,
    }));
  });

  /** Mensaje del fallo de la TRM, si lo hay. */
  protected readonly rateMessage = computed(() => {
    const state = this.rateState();

    return state.status === 'error' ? state.message : '';
  });

  protected readonly currency = computed(() => this.account()?.currency ?? 'COP');
  protected readonly symbol = computed(() => currencySymbol(this.currency(), this.locale()));
  protected readonly descriptionLength = computed(() => this.formValue().description.length);

  /** Si la transferencia cambia de moneda y el monto que llega se calcula con la TRM. */
  protected readonly crossCurrency = computed(() => {
    const from = this.account();
    const to = this.destination();

    return this.type() === 'transfer' && !!from && !!to && isCrossCurrency(from.currency, to.currency);
  });

  /** Fecha para la que se consulta la TRM; `null` cuando no hace falta o la fecha no es válida. */
  private readonly rateDate = computed(() => {
    const date = this.formValue().date;

    return this.crossCurrency() && date && date <= todayInputDate() ? date : null;
  });

  /**
   * Estado de la TRM para la fecha elegida. Si el resultado guardado es de otra fecha, la nueva
   * consulta aún no llegó: se trata como cargando y no se permite transferir con la TRM anterior.
   */
  protected readonly rateState = computed<RateState>(() => {
    const date = this.rateDate();
    const result = this.rateResult();

    if (date === null) {
      return { status: 'idle' };
    }

    return result.status !== 'idle' && result.date === date ? result : { status: 'loading', date };
  });
  private readonly rateRetries = new Subject<void>();

  /** Monto escrito, si es válido. */
  private readonly amount = computed(() => {
    const value = parseAmount(this.formValue().amount);

    return Number.isFinite(value) && value > 0 ? value : null;
  });

  /** Lo que llega a la cuenta destino de una transferencia entre monedas, sin formato. */
  private readonly previewAmount = computed(() => {
    const state = this.rateState();
    const from = this.account();
    const to = this.destination();
    const amount = this.amount();

    if (state.status !== 'ready' || !this.crossCurrency() || !from || !to || amount === null) {
      return null;
    }

    return previewDestinationAmount(
      amount,
      from.currency as TransactionCurrency,
      to.currency as TransactionCurrency,
      state.rate.rate,
    );
  });

  /** Vista previa de lo que llega a la cuenta destino, ya formateada. */
  protected readonly preview = computed(() => {
    const state = this.rateState();
    const from = this.account();
    const to = this.destination();
    const amount = this.amount();

    if (state.status !== 'ready' || !this.crossCurrency() || !from || !to || amount === null) {
      return null;
    }

    const value = previewDestinationAmount(
      amount,
      from.currency as TransactionCurrency,
      to.currency as TransactionCurrency,
      state.rate.rate,
    );

    return formatMoney(value, to.currency, this.locale());
  });

  /** Datos de la TRM para la lista de definición: vigencia, valor y fórmula aplicada. */
  protected readonly rateDetails = computed(() => {
    const state = this.rateState();
    const from = this.account();

    if (state.status !== 'ready' || !from) {
      return null;
    }

    const locale = this.locale();
    const { rate, validFrom, validTo } = state.rate;
    const amount = this.amount();

    return {
      validity: {
        from: formatDate(validFrom, 'mediumDate', locale),
        to: formatDate(validTo, 'mediumDate', locale),
      },
      rate: formatMoney(rate, 'COP', locale),
      formula:
        amount === null
          ? null
          : {
              key: `transactions.form.rate.${from.currency === 'COP' ? 'formulaDivide' : 'formulaMultiply'}`,
              params: { amount: formatMoney(amount, from.currency, locale), rate: formatMoney(rate, 'COP', locale) },
            },
    };
  });

  /** Si la fecha elegida cae en un mes cerrado: no se puede guardar hasta reabrirlo o cambiarla. */
  protected readonly dateLocked = computed(() => this.lockedNote()?.locked() ?? false);

  /**
   * Sin TRM no se puede calcular ni crear una transferencia entre monedas, y no se guarda un
   * movimiento con fecha en un mes cerrado.
   */
  protected readonly canSubmit = computed(
    () =>
      !this.isSubmitting() &&
      !this.dateLocked() &&
      (!this.crossCurrency() || this.rateState().status === 'ready') &&
      (!this.isCardExpense() || this.interestRate() !== undefined),
  );

  /** Un gasto con tarjeta: puede ser a cuotas y muestra el cupo que queda. */
  protected readonly isCardExpense = computed(() => this.type() === 'expense' && this.account()?.isCreditCard === true);

  /** Tasa escrita, si aplica y es válida; null sin interés. `undefined` si falta o no es válida. */
  private readonly interestRate = computed<number | null | undefined>(() => {
    const value = this.formValue();

    if (!value.withInterest || value.installments <= 1) {
      return null;
    }

    const rate = parseAmount(value.interestRate);

    return value.interestRate.trim() && Number.isFinite(rate) && this.form.controls.interestRate.valid ? rate : undefined;
  });

  /** Lo que se le pide al backend para calcular el plan; null si aún falta algún dato válido. */
  private readonly previewRequest = computed<InstallmentPreviewRequest | null>(() => {
    const account = this.account();
    const amount = this.amount();
    const value = this.formValue();
    const rate = this.interestRate();

    if (!this.isCardExpense() || !account || amount === null || !value.date || value.date > todayInputDate()) {
      return null;
    }

    if (rate === undefined || value.installments < INSTALLMENTS_MIN || value.installments > INSTALLMENTS_MAX) {
      return null;
    }

    return {
      fromAccountId: account.id,
      amount,
      date: toUtcIso(value.date),
      installments: value.installments,
      annualInterestRate: rate,
      categoryId: value.categoryId,
    };
  });

  protected readonly installmentPreview = signal<InstallmentPreviewState>({ status: 'idle' });

  /** Nombre de la categoría elegida, para el aviso de los topes que subirán. */
  protected readonly categoryName = computed(() => {
    const id = this.formValue().categoryId;

    return this.categoryOptions().find((option) => option.value === id)?.label ?? null;
  });

  /** Cupo disponible de la tarjeta antes y después de la compra (la compra baja todo el capital). */
  protected readonly creditAfterPurchase = computed(() => {
    const account = this.account();
    const amount = this.amount();

    if (!this.isCardExpense() || !account || account.availableCredit === null) {
      return null;
    }

    const after = amount === null ? null : account.availableCredit - amount;

    return {
      name: account.name,
      before: formatMoney(account.availableCredit, account.currency, this.locale()),
      after: after === null ? null : formatMoney(after, account.currency, this.locale()),
      over: after !== null && after < 0,
    };
  });

  /** Filtros del listado que el panel conserva al cerrarse. */
  private readonly queryParams = toSignal(this.route.queryParams, { initialValue: {} as Record<string, unknown> });

  /** Las pestañas de tipo conservan los filtros del listado, pero no los datos de un pago de tarjeta. */
  protected readonly typeTabQuery = computed(() => (this.cardPayment() ? {} : this.queryParams()));

  /** Al cerrar, un pago de tarjeta vuelve a su extracto; cualquier otro movimiento, al listado. */
  protected readonly closeLink = computed(() => {
    const payment = this.cardPayment();

    return payment ? ['/accounts', payment.cardId, 'statement'] : [LIST_URL];
  });
  protected readonly closeQuery = computed(() => {
    const payment = this.cardPayment();

    if (!payment) {
      return this.queryParams();
    }

    return payment.statement ? { month: `${payment.statement.year}-${String(payment.statement.month).padStart(2, '0')}` } : {};
  });

  /** La tarjeta que se paga, si el panel se abrió desde un extracto. */
  protected readonly payingCard = computed(() => {
    const payment = this.cardPayment();

    return payment ? this.findAccount(payment.cardId) : null;
  });

  /** Deuda total de la tarjeta que se paga, en positivo y en su moneda. */
  private readonly cardDebt = computed(() => {
    const card = this.payingCard();

    return card?.currentBalance != null && card.currentBalance < 0 ? -card.currentBalance : 0;
  });

  /** Montos sugeridos, en la moneda de la tarjeta; solo los que tienen algo por pagar. */
  protected readonly payPresets = computed(() => {
    const card = this.payingCard();
    const due = this.cardPayment()?.due ?? null;

    if (!card || this.type() !== 'transfer') {
      return [];
    }

    const presets: { id: PayPreset; amount: number }[] = [];

    if (due !== null && due > 0) {
      presets.push({ id: 'statement', amount: due });
    }
    if (this.cardDebt() > 0) {
      presets.push({ id: 'all', amount: this.cardDebt() });
    }

    return presets.map((preset) => ({ ...preset, text: formatMoney(preset.amount, card.currency, this.locale()) }));
  });

  /**
   * Monto sugerido convertido a la moneda de la cuenta origen, que es la que se escribe. Entre monedas
   * usa la TRM de la fecha del pago, la misma con la que el backend calcula lo que llega a la tarjeta.
   */
  private readonly presetSourceAmount = computed<number | null>(() => {
    const preset = this.payPresets().find((item) => item.id === this.payPreset());
    const from = this.account();
    const card = this.payingCard();

    if (!preset || !from || !card) {
      return null;
    }

    if (from.currency === card.currency) {
      return preset.amount;
    }

    const state = this.rateState();

    if (state.status !== 'ready') {
      return null;
    }

    return roundAwayFromZero(card.currency === 'USD' ? preset.amount * state.rate.rate : preset.amount / state.rate.rate);
  });

  /** Cómo quedan la cuenta origen y la deuda de la tarjeta después del pago. */
  protected readonly paymentOutcome = computed(() => {
    const from = this.account();
    const card = this.payingCard();
    const amount = this.amount();

    if (!from || !card || amount === null || this.formValue().toAccountId !== card.id) {
      return null;
    }

    const locale = this.locale();
    const arriving = from.currency === card.currency ? amount : this.previewAmount();

    return {
      fromName: from.name,
      fromAfter: from.currentBalance == null ? null : formatMoney(from.currentBalance - amount, from.currency, locale),
      cardName: card.name,
      debtAfter: arriving === null ? null : formatMoney(Math.max(0, this.cardDebt() - arriving), card.currency, locale),
    };
  });

  private categoriesRequest: Subscription | null = null;

  constructor() {
    const controls = this.form.controls;
    controls.amount.valueChanges.subscribe(() => this.amountServerError.set(null));
    controls.description.valueChanges.subscribe(() => this.descriptionServerError.set(null));
    controls.categoryId.valueChanges.subscribe(() => this.categoryServerError.set(null));
    controls.accountId.valueChanges.subscribe(() => this.accountServerError.set(null));
    controls.toAccountId.valueChanges.subscribe(() => this.accountServerError.set(null));
    controls.fromAccountId.valueChanges.subscribe((fromId) => {
      this.accountServerError.set(null);

      // El destino no puede ser el mismo origen.
      if (fromId !== null && controls.toAccountId.value === fromId) {
        controls.toAccountId.setValue(null);
      }
    });

    controls.installments.valueChanges.subscribe(() => this.installmentsServerError.set(null));
    controls.interestRate.valueChanges.subscribe(() => this.installmentsServerError.set(null));
    controls.date.valueChanges.subscribe(() => this.closedInstallmentMonth.set(null));
    controls.accountId.valueChanges.subscribe(() => this.closedInstallmentMonth.set(null));
    controls.installments.valueChanges.subscribe(() => this.closedInstallmentMonth.set(null));
    controls.customInstallments.valueChanges.subscribe((text) => {
      const value = Number(text.trim());

      if (text.trim() && Number.isInteger(value) && value >= INSTALLMENTS_MIN && value <= INSTALLMENTS_MAX) {
        controls.installments.setValue(value);
      }
    });
    // Si la persona cambia el monto sugerido, la sugerencia deja de estar elegida.
    controls.amount.valueChanges.subscribe((text) => {
      if (this.presetText !== null && text !== this.presetText) {
        this.payPreset.set(null);
        this.presetText = null;
      }
    });

    this.loadAccounts();

    // El plan de cuotas lo calcula el backend; se pide cuando los datos dejan de cambiar.
    toObservable(this.previewRequest)
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap((request) => (request === null ? of<InstallmentPreviewState>({ status: 'idle' }) : this.fetchPreview(request))),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.installmentPreview.set(state));

    // Al elegir un monto sugerido se escribe en el campo, ya convertido si hace falta la TRM.
    effect(() => {
      const amount = this.presetSourceAmount();

      if (amount === null) {
        return;
      }

      untracked(() => {
        const text = String(amount);
        this.presetText = text;
        controls.amount.setValue(text);
        controls.amount.markAsDirty();
      });
    });

    // Se pide la TRM al cambiar la fecha o el par de monedas, y al reintentar.
    merge(toObservable(this.rateDate), this.rateRetries.pipe(map(() => this.rateDate())))
      .pipe(
        switchMap((date) => (date === null ? of<RateState>({ status: 'idle' }) : this.fetchRate(date))),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.rateResult.set(state));

    // Al cambiar de tipo con el selector, Angular reutiliza el panel: se adapta con cada parámetro.
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const type = params.get('type');
        this.open(isTransactionType(type) ? type : 'expense');
      });

    // Un pago de tarjeta llega desde el extracto con la tarjeta, el mes y lo que falta por pagar.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => this.openCardPayment(query));

    // Lleva el foco al título para que el lector de pantalla anuncie el panel recién abierto.
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }

  protected amountError(): FieldMessage | null {
    const server = this.amountServerError();

    if (server) {
      return this.codeMessage(server);
    }

    const control = this.form.controls.amount;

    if (!this.showsError(control)) {
      return null;
    }

    if (control.hasError('amountTooLarge')) {
      return { key: 'transactions.form.amountTooLarge', params: this.amountParams };
    }

    if (control.hasError('amountInvalid')) {
      return { key: 'transactions.form.amountInvalid', params: this.amountParams };
    }

    return control.hasError('amountNotPositive')
      ? { key: 'transactions.form.amountPositive' }
      : { key: 'transactions.form.amountRequired' };
  }

  /** Error de la cuenta de un ingreso o gasto. */
  protected accountError(): FieldMessage | null {
    const server = this.accountServerError();

    if (server) {
      return this.codeMessage(server);
    }

    return this.showsError(this.form.controls.accountId)
      ? { key: `transactions.form.accountRequired.${this.type()}` }
      : null;
  }

  protected fromError(): FieldMessage | null {
    return this.showsError(this.form.controls.fromAccountId) ? { key: 'transactions.form.fromRequired' } : null;
  }

  /** Error del destino de una transferencia; los errores de cuenta del backend se muestran aquí. */
  protected toError(): FieldMessage | null {
    const server = this.accountServerError();

    if (server) {
      return this.codeMessage(server);
    }

    return this.showsError(this.form.controls.toAccountId) ? { key: 'transactions.form.toRequired' } : null;
  }

  protected descriptionError(): FieldMessage | null {
    const code =
      this.descriptionServerError() ??
      (this.showsError(this.form.controls.description) ? TransactionErrorCode.DescriptionMaxLength : null);

    return code ? this.codeMessage(code) : null;
  }

  protected categoryError(): FieldMessage | null {
    const code = this.categoryServerError();

    if (code) {
      return this.codeMessage(code);
    }

    if (!this.showsError(this.form.controls.categoryId)) {
      return null;
    }

    return this.missingCategories()
      ? { key: `transactions.form.noCategoriesRequired.${this.type()}` }
      : { key: `transactions.form.categoryRequired.${this.type()}` };
  }

  protected installmentsError(): FieldMessage | null {
    const server = this.installmentsServerError();

    if (server) {
      return this.codeMessage(server);
    }

    const control = this.form.controls.customInstallments;

    return control.touched && control.invalid
      ? { key: 'transactions.form.installments.outOfRange', params: this.installmentLimits }
      : null;
  }

  protected interestRateError(): FieldMessage | null {
    const control = this.form.controls.interestRate;
    const value = this.formValue();

    if (!value.withInterest || value.installments <= 1 || !control.touched) {
      return null;
    }

    if (!value.interestRate.trim()) {
      return { key: 'transactions.form.installments.rateRequired' };
    }

    return control.invalid ? { key: 'transactions.form.installments.rateInvalid', params: this.rateLimits } : null;
  }

  /** Elige un número de cuotas de las opciones rápidas. */
  protected chooseInstallments(count: number): void {
    this.form.controls.customInstallments.setValue('', { emitEvent: false });
    this.form.controls.customInstallments.markAsUntouched();
    this.form.controls.installments.setValue(count);
  }

  protected setInterest(withInterest: boolean): void {
    this.form.controls.withInterest.setValue(withInterest);
  }

  protected choosePreset(preset: PayPreset): void {
    this.payPreset.set(preset);
  }

  /** Mes `{year, month}` como fecha `YYYY-MM-01` para formatearlo con el pipe en UTC. */
  protected monthDate(month: { year: number; month: number }): string {
    return `${month.year}-${String(month.month).padStart(2, '0')}-01`;
  }

  /** Monto en la moneda de la cuenta elegida, ya formateado. */
  protected money(amount: number, currency = this.currency()): string {
    return formatMoney(amount, currency, this.locale());
  }

  protected dateError(): FieldMessage | null {
    const control = this.form.controls.date;

    if (!this.showsError(control)) {
      return null;
    }

    return control.hasError('future') ? { key: 'transactions.form.dateFuture' } : { key: 'transactions.form.dateRequired' };
  }

  /**
   * Ayuda con el saldo de una cuenta, ya formateado; `null` si no se conoce. En una tarjeta el saldo
   * negativo es deuda, así que se muestra lo que se debe (o el saldo a favor) en positivo.
   */
  private balanceOf(account: TransactionAccountOption | null): { key: string; amount: string } | null {
    if (account?.currentBalance == null) {
      return null;
    }

    const balance = account.currentBalance;
    const money = (value: number) => formatMoney(value, account.currency, this.locale());

    if (!account.isCreditCard) {
      return { key: 'transactions.form.balance', amount: money(balance) };
    }

    return balance > 0
      ? { key: 'transactions.form.cardCredit', amount: money(balance) }
      : { key: 'transactions.form.cardDebt', amount: money(-balance) };
  }

  protected loadAccounts(): void {
    // Al recargar tras un error del backend, el formulario sigue visible con las cuentas anteriores.
    if (this.accountsStatus() !== 'ready') {
      this.accountsStatus.set('loading');
    }

    this.listAccounts.execute().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.accountsStatus.set('ready');
      },
      error: () => this.accountsStatus.set('error'),
    });
  }

  protected loadCategories(): void {
    const type = this.type();
    this.categoriesRequest?.unsubscribe();
    this.categoriesStatus.set('loading');
    this.categoriesRequest = this.listCategories.execute(type).subscribe({
      next: (categories) => {
        // El backend ya filtra por tipo; se comprueba aquí también para no ofrecer una categoría
        // que luego rechace con TRANSACTION_CATEGORY_TYPE_MISMATCH. Las desactivadas no se ofrecen.
        this.categories.set(categories.filter((category) => category.isActive && categoryAppliesTo(category, type)));
        this.categoriesStatus.set('ready');
        this.preselectCardPaymentCategory();
      },
      error: () => this.categoriesStatus.set('error'),
    });
  }

  /** «Usar hoy» de la nota de fecha cerrada. */
  protected useToday(date: string): void {
    this.form.controls.date.setValue(date);
    this.form.controls.date.markAsDirty();
  }

  protected retryRate(): void {
    this.rateRetries.next();
  }

  /** Escape cierra el panel, salvo que haya cambios sin guardar. */
  protected closeOnEscape(): void {
    if (!this.form.dirty) {
      this.close();
    }
  }

  protected close(): void {
    void this.router.navigate(this.closeLink(), { queryParams: this.closeQuery() });
  }

  protected submit(): void {
    this.formError.set('');

    if (this.form.invalid || (this.isCardExpense() && this.interestRate() === undefined)) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.canSubmit()) {
      return;
    }

    this.isSubmitting.set(true);
    this.createTransaction
      .execute(this.draft())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (transaction) => {
          this.workspace.saved(transaction);
          this.close();
        },
        error: (error: unknown) => this.handleSubmitError(error),
      });
  }

  /** Arma el borrador del tipo elegido con los valores del formulario. */
  private draft(): TransactionDraft {
    const value = this.form.getRawValue();
    const base = {
      amount: parseAmount(value.amount),
      date: toUtcIso(value.date),
      description: value.description,
    };

    switch (this.type()) {
      case 'income':
        return { ...base, type: 'income', categoryId: value.categoryId, toAccountId: value.accountId! };
      case 'expense': {
        const installments = this.isCardExpense() ? value.installments : 1;

        return {
          ...base,
          type: 'expense',
          categoryId: value.categoryId,
          fromAccountId: value.accountId!,
          installments,
          annualInterestRate: installments > 1 ? (this.interestRate() ?? null) : null,
        };
      }
      case 'transfer':
        return {
          ...base,
          type: 'transfer',
          categoryId: value.categoryId,
          fromAccountId: value.fromAccountId!,
          toAccountId: value.toAccountId!,
        };
    }
  }

  /**
   * Adapta el formulario al tipo indicado. Se conservan monto, descripción y fecha; la cuenta
   * pasa de un tipo a otro y la categoría se reinicia porque cambia la lista.
   */
  private open(type: TransactionType): void {
    const previous = this.type();
    const controls = this.form.controls;
    this.type.set(type);
    this.formError.set('');
    this.amountServerError.set(null);
    this.accountServerError.set(null);
    this.categoryServerError.set(null);
    this.descriptionServerError.set(null);
    this.installmentsServerError.set(null);
    this.closedInstallmentMonth.set(null);
    controls.categoryId.setValue(null);

    if (previous !== 'transfer' && type === 'transfer' && controls.fromAccountId.value === null) {
      controls.fromAccountId.setValue(controls.accountId.value);
    } else if (previous === 'transfer' && type !== 'transfer' && controls.accountId.value === null) {
      controls.accountId.setValue(controls.fromAccountId.value);
    }

    const transfer = type === 'transfer';
    setRequired(controls.accountId, !transfer);
    setRequired(controls.fromAccountId, transfer);
    setRequired(controls.toAccountId, transfer);
    // Al cambiar de tipo la categoría vuelve a estar vacía: no se acusa el error hasta volver a enviar.
    controls.categoryId.markAsUntouched();

    this.loadCategories();
  }

  private fetchPreview(request: InstallmentPreviewRequest): Observable<InstallmentPreviewState> {
    return this.previewInstallments.execute(request).pipe(
      map((preview): InstallmentPreviewState => ({ status: 'ready', preview })),
      catchError((error: unknown) => of<InstallmentPreviewState>({ status: 'error', message: this.messageOf(error) })),
      startWith<InstallmentPreviewState>({ status: 'loading' }),
    );
  }

  /** Lee el pago de tarjeta de la URL y llena destino, monto sugerido y descripción. */
  private openCardPayment(query: { get(name: string): string | null }): void {
    const cardId = Number(query.get('payCard'));

    if (!query.get('payCard') || !Number.isInteger(cardId)) {
      this.cardPayment.set(null);
      return;
    }

    const due = Number(query.get('due'));
    const statement = parseMonth(query.get('statement'));
    const controls = this.form.controls;

    this.cardPayment.set({ cardId, statement, due: query.get('due') && Number.isFinite(due) ? due : null });
    controls.toAccountId.setValue(cardId);

    if (!controls.description.value && statement) {
      const month = formatDate(this.monthDate(statement), 'MMMM y', this.locale(), 'UTC');
      controls.description.setValue(this.transloco.translate('transactions.form.pay.description', { month }));
    }

    this.payPreset.set(statement && query.get('due') ? 'statement' : 'all');
    this.preselectCardPaymentCategory();
  }

  /** En un pago de tarjeta, elige la categoría de sistema de pago de tarjeta si existe y no hay otra elegida. */
  private preselectCardPaymentCategory(): void {
    const control = this.form.controls.categoryId;

    if (!this.cardPayment() || this.type() !== 'transfer' || control.value !== null) {
      return;
    }

    const category = this.categories().find((item) => item.code === CARD_PAYMENT_CATEGORY_CODE);

    if (category) {
      control.setValue(category.id);
    }
  }

  private fetchRate(date: string): Observable<RateState> {
    return this.getExchangeRate.execute(date).pipe(
      map((rate): RateState => ({ status: 'ready', date, rate })),
      catchError((error: unknown) => of<RateState>({ status: 'error', date, message: this.messageOf(error) })),
      startWith<RateState>({ status: 'loading', date }),
    );
  }

  /** Ubica el error del backend junto a su campo; si no pertenece a ninguno, lo muestra en el formulario. */
  private handleSubmitError(error: unknown): void {
    const code = error instanceof TransactionError ? error.code : null;

    if (code === TransactionErrorCode.PeriodClosed) {
      const closed = error instanceof TransactionError ? error.closedMonth : null;
      const dateMonth = this.form.controls.date.value.slice(0, 7);

      if (closed && `${closed.year}-${String(closed.month).padStart(2, '0')}` !== dateMonth) {
        // La fecha está abierta, pero una cuota cae en un mes cerrado.
        this.closedInstallmentMonth.set(closed);
      } else {
        // Otro dispositivo pudo cerrar el mes: la nota de la fecha lo explica y ofrece reabrirlo.
        this.lockedNote()?.markLocked(this.form.controls.date.value);
      }
    } else if (code && INSTALLMENT_ERROR_CODES.includes(code)) {
      this.installmentsServerError.set(code);
    } else if (code && AMOUNT_ERROR_CODES.includes(code)) {
      this.amountServerError.set(code);
    } else if (code && ACCOUNT_ERROR_CODES.includes(code)) {
      this.accountServerError.set(code);
      // La cuenta pudo cambiar (desactivada o borrada): se recargan las opciones.
      this.loadAccounts();
    } else if (code && CATEGORY_ERROR_CODES.includes(code)) {
      this.categoryServerError.set(code);
      this.loadCategories();
    } else if (code && DESCRIPTION_ERROR_CODES.includes(code)) {
      this.descriptionServerError.set(code);
    } else if (code && RATE_ERROR_CODES.includes(code)) {
      const date = this.rateDate();
      if (date !== null) {
        this.rateResult.set({ status: 'error', date, message: this.messageOf(error) });
      } else {
        this.formError.set(this.messageOf(error));
      }
    } else {
      this.formError.set(this.messageOf(error));
    }
  }

  private findAccount(id: number | null): TransactionAccountOption | null {
    return id === null ? null : (this.accounts().find((account) => account.id === id) ?? null);
  }

  private codeMessage(code: TransactionErrorCode): FieldMessage {
    return { key: `transactions.errors.${code}`, params: { descriptionMax: TRANSACTION_DESCRIPTION_MAX_LENGTH } };
  }

  private showsError(control: { touched: boolean; valid: boolean }): boolean {
    return control.touched && !control.valid;
  }

  private messageOf(error: unknown): string {
    return error instanceof TransactionError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}

/** Opción del selector de cuentas: el nombre con su moneda, para distinguir COP de USD. */
function toAccountOption(account: TransactionAccountOption): SelectOption<number> {
  return { value: account.id, label: `${account.name} · ${account.currency}` };
}

/** Activa o quita el requisito de un control sin tocar su valor. */
function setRequired(control: AbstractControl, required: boolean): void {
  const validator: ValidatorFn = Validators.required;

  if (required) {
    control.addValidators(validator);
  } else {
    control.removeValidators(validator);
  }

  control.updateValueAndValidity({ emitEvent: false });
}

/** «Otra» cantidad de cuotas: vacía, o un entero entre el mínimo y el máximo del backend. */
function customInstallmentsValidator(control: AbstractControl<string>): ValidationErrors | null {
  const text = control.value.trim();
  const value = Number(text);

  return !text || (Number.isInteger(value) && value >= INSTALLMENTS_MIN && value <= INSTALLMENTS_MAX)
    ? null
    : { installmentsOutOfRange: true };
}

/** Tasa EA: vacía (la exige la vista solo con interés), o un número entre 0 y 200 con hasta 2 decimales. */
function interestRateValidator(control: AbstractControl<string>): ValidationErrors | null {
  const text = control.value.trim();

  if (!text) {
    return null;
  }

  const value = parseAmount(text);

  return /^\d+(?:[.,]\d{1,2})?$/.test(text) && value >= INTEREST_RATE_MIN && value <= INTEREST_RATE_MAX
    ? null
    : { rateInvalid: true };
}

/** Rechaza fechas posteriores a hoy: el backend no tiene TRM para ellas. */
function notInFuture(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && control.value > todayInputDate() ? { future: true } : null;
}

/**
 * Hoy en hora de Colombia, con el formato `YYYY-MM-DD` del `<input type="date">`. El backend decide
 * la TRM y qué es una fecha futura en esa zona, así que el límite del formulario usa la misma.
 */
function todayInputDate(): string {
  // `en-CA` formatea las fechas como `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TRANSACTION_TIME_ZONE }).format(new Date());
}

/**
 * Convierte la fecha elegida (`YYYY-MM-DD`) en ISO 8601 UTC con `Z`. Se toma el mediodía local
 * para que el día no cambie al pasar a UTC en ninguna zona horaria habitual.
 */
function toUtcIso(date: string): string {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day, 12).toISOString();
}
