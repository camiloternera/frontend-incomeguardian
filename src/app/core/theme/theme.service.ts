import { Injectable, effect, signal } from '@angular/core';
import { ThemeName, isThemeName } from './theme-name';

export type { ThemeName };

export interface ThemeOption {
  id: ThemeName;
  label: string;
  number: string;
}

const STORAGE_KEY = 'income-guardian.theme';
const DEFAULT_THEME: ThemeName = 'forest';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly themes: readonly ThemeOption[] = [
    { id: 'forest', label: 'Forest', number: '01' },
    { id: 'paper', label: 'Paper', number: '02' },
    { id: 'noir', label: 'Noir', number: '03' },
  ];

  readonly theme = signal<ThemeName>(this.readStoredTheme());

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset['theme'] = theme;

      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Storage can be unavailable in private browsing. The theme still applies.
      }
    });
  }

  setTheme(theme: ThemeName): void {
    this.theme.set(theme);
  }

  private readStoredTheme(): ThemeName {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return isThemeName(stored) ? stored : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  }
}
