import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft } from '@lucide/angular';
import { LanguageSwitcherComponent } from '@shared/ui/language-switcher.component';
import { ThemeSwitcherComponent } from '@shared/ui/theme-switcher.component';

/** Barra superior compartida por las vistas de categorías: marca, regreso al resumen y preferencias. */
@Component({
  selector: 'app-categories-header',
  imports: [RouterLink, TranslocoDirective, LanguageSwitcherComponent, ThemeSwitcherComponent, LucideArrowLeft],
  host: { class: 'block' },
  template: `
    <header *transloco="let t" class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div class="flex flex-wrap items-center gap-4">
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
          {{ t('categories.header.backToOverview') }}
        </a>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
        <app-language-switcher />
        <app-theme-switcher />
      </div>
    </header>
  `,
})
export class CategoriesHeaderComponent {}
