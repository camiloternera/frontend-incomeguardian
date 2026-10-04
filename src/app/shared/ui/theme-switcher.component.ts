import { Component, inject } from '@angular/core';
import { ThemeName, ThemeService } from '@core/theme/theme.service';

@Component({
  selector: 'app-theme-switcher',
  host: { class: 'contents' },
  template: `
    <div
      class="flex items-center gap-1.5 self-end rounded-full border border-ig-border/55 bg-ig-surface/60 px-2.5 py-1.5 text-ig-muted sm:self-auto"
      aria-label="Choose visual theme"
      role="group"
    >
      <span class="size-1.5 rounded-full bg-ig-accent" aria-hidden="true"></span>
      <span class="mr-1 text-[11px] tracking-[0.02em]">3 visual modes</span>
      @for (option of themes; track option.id) {
        <button
          class="min-h-6 min-w-6 rounded-xl border border-transparent px-1.5 text-[11px] tracking-[0.02em] text-ig-muted hover:border-ig-border hover:text-ig-text focus-visible:outline-2 focus-visible:outline-ig-accent focus-visible:outline-offset-2"
          [class.border-ig-border]="theme() === option.id"
          [class.text-ig-text]="theme() === option.id"
          [attr.aria-pressed]="theme() === option.id"
          [attr.aria-label]="'Use ' + option.label + ' theme'"
          type="button"
          (click)="setTheme(option.id)"
        >
          {{ option.number }}
        </button>
      }
    </div>
  `,
})
export class ThemeSwitcherComponent {
  private readonly themeService = inject(ThemeService);

  protected readonly themes = this.themeService.themes;
  protected readonly theme = this.themeService.theme;

  protected setTheme(theme: ThemeName): void {
    this.themeService.setTheme(theme);
  }
}
