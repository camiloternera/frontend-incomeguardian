import { Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { Language, LanguageService } from '@core/i18n/language.service';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslocoDirective],
  host: { class: 'contents' },
  template: `
    <div
      *transloco="let t"
      class="flex items-center gap-1 rounded-full border border-ig-border/55 bg-ig-surface/60 px-2.5 py-1.5 text-ig-muted"
      [attr.aria-label]="t('language.group')"
      role="group"
    >
      @for (option of languages; track option.id) {
        <button
          class="min-h-6 min-w-6 rounded-xl border border-transparent px-1.5 text-[11px] tracking-[0.02em] text-ig-muted hover:border-ig-border hover:text-ig-text focus-visible:outline-2 focus-visible:outline-ig-accent focus-visible:outline-offset-2"
          [class.border-ig-border]="language() === option.id"
          [class.text-ig-text]="language() === option.id"
          [attr.aria-pressed]="language() === option.id"
          [attr.aria-label]="option.name"
          [attr.lang]="option.id"
          type="button"
          (click)="setLanguage(option.id)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class LanguageSwitcherComponent {
  private readonly languageService = inject(LanguageService);

  protected readonly languages = this.languageService.languages;
  protected readonly language = this.languageService.language;

  protected setLanguage(language: Language): void {
    this.languageService.setLanguage(language);
  }
}
