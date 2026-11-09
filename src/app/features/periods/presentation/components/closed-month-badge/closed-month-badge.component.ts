import { Component, computed, effect, inject, input } from '@angular/core';
import { TranslocoDirective, provideTranslocoScope } from '@jsverse/transloco';
import { LucideLock } from '@lucide/angular';
import { isClosedDate, yearMonthOf } from '../../../domain/period';
import { PeriodWorkspace } from '../../period-workspace';

/** Pastilla «Mes cerrado» junto a un día de un mes cerrado; no ocupa espacio si el mes está abierto. */
@Component({
  selector: 'app-closed-month-badge',
  imports: [TranslocoDirective, LucideLock],
  providers: [provideTranslocoScope('periods')],
  template: `
    @if (closed()) {
      <span
        *transloco="let t"
        data-testid="closed-month-badge"
        class="inline-flex items-center gap-1 rounded-full border border-ig-border bg-ig-surface px-2 py-0.5 text-[12px] font-medium text-ig-muted"
      >
        <svg lucideLock [size]="12" aria-hidden="true"></svg>
        {{ t('periods.list.closedMonth') }}
      </span>
    }
  `,
})
export class ClosedMonthBadgeComponent {
  private readonly workspace = inject(PeriodWorkspace);

  /** Fecha del día (`yyyy-MM-dd`). */
  readonly date = input.required<string>();

  protected readonly closed = computed(() => {
    const year = yearMonthOf(this.date())?.year;
    const entry = year === undefined ? undefined : this.workspace.years()[year];

    return entry?.status === 'ready' && isClosedDate(entry.data, this.date());
  });

  constructor() {
    effect(() => {
      const year = yearMonthOf(this.date())?.year;

      if (year !== undefined) {
        this.workspace.loadYear(year);
      }
    });
  }
}
