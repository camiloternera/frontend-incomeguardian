import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { TranslocoDirective, provideTranslocoScope } from '@jsverse/transloco';
import { LucideCalendarPlus } from '@lucide/angular';
import { LanguageService } from '@core/i18n/language.service';
import { monthsBetween, openedRange, yearMonthOf } from '../../../domain/period';
import { monthYear } from '../../period-format';
import { PeriodWorkspace } from '../../period-workspace';

/**
 * Nota bajo el campo Fecha cuando la fecha elegida es anterior a la primera cuenta: esos meses están
 * «sin actividad» y, al guardar, se abren para poder cerrarlos. No bloquea Guardar. Tras guardar, el
 * formulario llama a `announce()` para que la capa de períodos ofrezca cerrarlos.
 */
@Component({
  selector: 'app-early-date-note',
  // Sin caja propia: si no hay nada que mostrar, no suma un hueco al `gap` del contenedor.
  host: { class: 'contents' },
  imports: [TranslocoDirective, LucideCalendarPlus],
  providers: [provideTranslocoScope('periods')],
  template: `
    @if (range(); as range) {
      <div
        *transloco="let t"
        data-testid="early-date-note"
        class="flex items-start gap-3 rounded-lg border border-ig-border bg-ig-surface p-4"
        role="status"
        [id]="noteId()"
      >
        <svg lucideCalendarPlus [size]="18" class="mt-0.5 shrink-0 text-ig-accent-text" aria-hidden="true"></svg>
        <div class="flex min-w-0 flex-col gap-1">
          <p class="m-0 text-[14px] font-bold">{{ t('periods.earlyDate.title') }}</p>
          <p class="m-0 text-[13px] leading-relaxed text-ig-muted">
            @if (count() === 1) {
              {{ t('periods.earlyDate.bodyOne', { month: label(range.from) }) }}
            } @else {
              {{ t('periods.earlyDate.bodyMany', { from: label(range.from), to: label(range.to) }) }}
            }
          </p>
        </div>
      </div>
    }
  `,
})
export class EarlyDateNoteComponent {
  private readonly workspace = inject(PeriodWorkspace);
  private readonly locale = inject(LanguageService).language;

  /** Fecha elegida (`yyyy-MM-dd`). */
  readonly date = input('');
  /** Id de la nota, para que el campo la enlace con `aria-describedby`. */
  readonly noteId = input('early-date-note');

  private readonly target = computed(() => yearMonthOf(this.date()));

  /** Primer mes con cuentas (`yyyy-MM`), según el año de la fecha elegida. */
  private readonly firstActivity = computed(() => {
    const target = this.target();
    const entry = target ? this.workspace.years()[target.year] : undefined;

    return entry?.status === 'ready' ? entry.data.firstActivity : null;
  });

  /** Meses que se abren al guardar, o null si la fecha no es anterior a la primera cuenta. */
  readonly range = computed(() => {
    const target = this.target();

    return target ? openedRange(target, this.firstActivity()) : null;
  });

  protected readonly count = computed(() => {
    const range = this.range();

    return range ? monthsBetween(range.from, range.to) : 0;
  });

  constructor() {
    // La primera vez que se ve un año se pide fresco: el período pudo cambiar en otro dispositivo.
    const refreshed = new Set<number>();
    effect(() => {
      const target = this.target();

      if (target) {
        const force = !refreshed.has(target.year);
        refreshed.add(target.year);
        untracked(() => this.workspace.loadYear(target.year, force));
      }
    });
  }

  /** Tras guardar: refresca los períodos y ofrece cerrar los meses que se abrieron. */
  announce(): void {
    const range = this.range();

    if (range) {
      this.workspace.announceOpened(range);
    }
  }

  protected label(period: { year: number; month: number }): string {
    return monthYear(period.year, period.month, this.locale());
  }
}
