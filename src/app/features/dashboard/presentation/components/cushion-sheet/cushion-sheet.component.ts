import { formatNumber } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCheck, LucideMinus, LucidePlus, LucideX } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { LanguageService } from '@core/i18n/language.service';
import { formatMoney } from '@shared/money/money-format';
import { GetCushionCandidatesUseCase, SaveCushionUseCase } from '../../../application/cushion-use-cases';
import {
  CUSHION_GOAL_DEFAULT,
  CUSHION_GOAL_MAX,
  CUSHION_GOAL_MIN,
  Cushion,
  CushionCandidate,
  clampGoal,
  previewSelection,
  sortCurrencies,
} from '../../../domain/cushion';
import { DashboardError } from '../../../domain/dashboard-error';

type CandidatesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; candidates: CushionCandidate[] };

/**
 * Hoja para elegir las cuentas del colchón y su meta. Es un `<dialog>` modal: centrado en pantallas anchas y
 * desde abajo en mobile; Escape, el velo y «Cancelar» la cierran sin guardar.
 */
@Component({
  selector: 'app-cushion-sheet',
  imports: [TranslocoDirective, LucideCheck, LucideMinus, LucidePlus, LucideX],
  templateUrl: './cushion-sheet.component.html',
})
export class CushionSheetComponent {
  private readonly getCandidates = inject(GetCushionCandidatesUseCase);
  private readonly saveCushion = inject(SaveCushionUseCase);
  private readonly languageService = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /** Si la hoja está abierta. */
  readonly open = input(false);
  /** El colchón actual: da la meta inicial y el gasto promedio de cada moneda para el resumen en vivo. */
  readonly cushion = input<Cushion | null>(null);

  /** Se cerró sin guardar. */
  readonly closed = output<void>();
  /** Se guardó; la página vuelve a pedir el colchón. */
  readonly saved = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly min = CUSHION_GOAL_MIN;
  protected readonly max = CUSHION_GOAL_MAX;
  protected readonly locale = this.languageService.language;

  protected readonly state = signal<CandidatesState>({ status: 'loading' });
  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  protected readonly goal = signal(CUSHION_GOAL_DEFAULT);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  /** Primera vez: el usuario aún no tiene cuentas marcadas. */
  protected readonly firstTime = computed(() => !this.cushion()?.hasCushionAccounts);

  protected readonly candidates = computed(() => {
    const state = this.state();

    return state.status === 'ready' ? sortCurrencies(state.candidates) : [];
  });

  protected readonly preview = computed(() => {
    const averages = Object.fromEntries((this.cushion()?.currencies ?? []).map((row) => [row.currency, row.averageMonthlySpent]));

    return previewSelection(this.candidates(), this.selected(), averages, this.goal());
  });

  private request?: Subscription;

  constructor() {
    effect(() => {
      const open = this.open();
      const dialog = this.dialog()?.nativeElement;

      if (dialog) {
        untracked(() => (open ? this.show(dialog) : this.hide(dialog)));
      }
    });
  }

  protected toggle(id: number): void {
    this.selected.update((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  protected step(delta: number): void {
    this.goal.update((goal) => clampGoal(goal + delta));
  }

  protected loadCandidates(): void {
    this.request?.unsubscribe();
    this.state.set({ status: 'loading' });
    this.request = this.getCandidates.execute().subscribe({
      next: (candidates) => {
        this.state.set({ status: 'ready', candidates });
        this.selected.set(new Set(candidates.filter((candidate) => candidate.isCushion).map((candidate) => candidate.id)));
      },
      error: (error: unknown) => this.state.set({ status: 'error', message: this.messageOf(error) }),
    });
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.saveError.set('');
    // Solo se envían cuentas que la hoja ofrece; el backend desmarca las demás activas.
    const ids = this.candidates()
      .filter((candidate) => this.selected().has(candidate.id))
      .map((candidate) => candidate.id);

    this.saveCushion.execute(ids, this.goal()).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.saveError.set(this.messageOf(error));
      },
    });
  }

  protected dismiss(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  /** Escape cierra el diálogo por su cuenta: se refleja en la página. */
  protected onDialogClosed(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }

  /** Escape mientras guarda no debe cerrar la hoja a medias. */
  protected onCancel(event: Event): void {
    if (this.saving()) {
      event.preventDefault();
    }
  }

  /** Un clic en el velo (fuera de la hoja) la cierra. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.dismiss();
    }
  }

  protected money(value: number, currency: string): string {
    const hasCents = currency !== 'COP' && !Number.isInteger(value);

    return formatMoney(value, currency, this.locale(), hasCents ? '1.2-2' : '1.0-0').replace(/^-/, '−');
  }

  protected goalText(months: number): string {
    return months === 1
      ? this.transloco.translate('dashboard.home.cushionSheet.goalValueOne')
      : this.transloco.translate('dashboard.home.cushionSheet.goalValue', { count: months });
  }

  /** «2,4 meses» con un decimal. */
  protected monthsText(months: number): string {
    return this.transloco.translate('dashboard.home.cushion.months', { months: formatNumber(months, this.locale(), '1.1-1') });
  }

  protected currencyName(currency: string): string {
    const key = `dashboard.home.cushion.currencyName.${currency}`;
    const name = this.transloco.translate(key);

    return name === key ? currency : name;
  }

  private show(dialog: HTMLDialogElement): void {
    this.goal.set(clampGoal(this.cushion()?.goalMonths ?? CUSHION_GOAL_DEFAULT));
    this.saveError.set('');
    this.saving.set(false);
    this.loadCandidates();

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    queueMicrotask(() => this.heading()?.nativeElement.focus());
  }

  private hide(dialog: HTMLDialogElement): void {
    this.request?.unsubscribe();

    if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }

  private messageOf(error: unknown): string {
    return error instanceof DashboardError ? error.message : this.transloco.translate('errors.generic');
  }
}
