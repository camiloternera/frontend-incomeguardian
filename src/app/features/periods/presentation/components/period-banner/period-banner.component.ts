import { Component, computed, inject } from '@angular/core';
import { TranslocoDirective, provideTranslocoScope } from '@jsverse/transloco';
import { LucideLock } from '@lucide/angular';
import { LanguageService } from '@core/i18n/language.service';
import { capitalized, monthName } from '../../period-format';
import { PERIOD_UI } from '../../period-ui';
import { PeriodWorkspace } from '../../period-workspace';

/**
 * Franja del Resumen que propone cerrar el mes que terminó y sigue abierto. No aparece mientras se
 * consulta, si la consulta falla, si el usuario desactivó el aviso o si lo pospuso con «Más tarde».
 */
@Component({
  selector: 'app-period-banner',
  // Sin caja propia: si no hay nada que mostrar, no suma un hueco al `gap` del contenedor.
  host: { class: 'contents' },
  imports: [TranslocoDirective, LucideLock],
  providers: [provideTranslocoScope('periods')],
  template: `
    @if (pending(); as pending) {
      <section
        *transloco="let t"
        data-testid="period-banner"
        class="flex flex-col gap-4 rounded-lg border border-ig-border bg-ig-surface p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
        aria-labelledby="period-banner-title"
      >
        <div class="flex min-w-0 flex-1 items-start gap-4">
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-ig-accent/15 text-ig-accent-text" aria-hidden="true">
            <svg lucideLock [size]="18"></svg>
          </span>
          <div class="flex min-w-0 flex-col gap-1">
            <h2 id="period-banner-title" class="m-0 text-[16px] font-bold">
              {{ t('periods.banner.title', { month: capitalized(month(pending.month)) }) }}
            </h2>
            <p class="m-0 max-w-[640px] text-[14px] leading-relaxed text-ig-muted">
              {{ t('periods.banner.body', { month: month(pending.month) }) }}
            </p>
          </div>
        </div>
        <div class="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
          <button data-testid="period-banner-later" type="button" [class]="ui.secondary" (click)="later()">
            {{ t('periods.banner.later') }}
          </button>
          <button data-testid="period-banner-review" type="button" [class]="ui.primary" (click)="review()">
            {{ t('periods.banner.review') }}
          </button>
        </div>
      </section>
    }
  `,
})
export class PeriodBannerComponent {
  private readonly workspace = inject(PeriodWorkspace);
  private readonly locale = inject(LanguageService).language;

  protected readonly ui = PERIOD_UI;

  protected readonly pending = computed(() => {
    const pending = this.workspace.pending();

    return pending && !this.workspace.isSnoozed(pending) ? pending : null;
  });

  constructor() {
    this.workspace.loadPending();
  }

  protected month(month: number): string {
    return monthName(month, this.locale());
  }

  protected capitalized(text: string): string {
    return capitalized(text, this.locale());
  }

  protected later(): void {
    const pending = this.pending();

    if (pending) {
      this.workspace.snooze(pending);
    }
  }

  protected review(): void {
    const pending = this.pending();

    if (pending) {
      this.workspace.openClose({ year: pending.year, month: pending.month });
    }
  }
}
