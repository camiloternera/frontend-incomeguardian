import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft } from '@lucide/angular';

/** Barra superior de las vistas privadas fuera del resumen: marca y regreso al resumen. */
@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, TranslocoDirective, LucideArrowLeft],
  host: { class: 'block' },
  template: `
    <header *transloco="let t" class="flex flex-wrap items-center gap-4">
      <a
        class="flex items-center gap-2.5 rounded-lg text-ig-text no-underline focus-visible:outline-2 focus-visible:outline-ig-accent focus-visible:outline-offset-2"
        routerLink="/home"
        [attr.aria-label]="t('brand.home')"
      >
        <span class="grid size-6 shrink-0 place-items-center rounded-md bg-ig-accent text-[11px] font-extrabold text-ig-on-accent">IG</span>
        <span class="text-[13px] font-bold tracking-[-0.01em]">{{ t('brand.name') }}</span>
      </a>

      <a
        class="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-[13px] text-ig-muted no-underline hover:text-ig-text focus-visible:outline-2 focus-visible:outline-ig-accent focus-visible:outline-offset-2"
        routerLink="/home"
      >
        <svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>
        {{ t('common.backToOverview') }}
      </a>
    </header>
  `,
})
export class AppTopBarComponent {}
