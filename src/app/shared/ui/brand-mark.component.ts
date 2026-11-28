import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Símbolo de Income Guardian: un escudo con tres barras apiladas de menor a
 * mayor (ingresos que se acumulan y quedan protegidos).
 *
 * El escudo usa el acento legible del tema y las barras el color del canvas,
 * así se adapta solo a Forest, Paper y Noir. Es decorativo: el nombre de la
 * marca lo aporta el texto o el `aria-label` del enlace que lo contiene.
 */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      aria-hidden="true"
      data-testid="brand-mark"
      [attr.width]="size()"
      [attr.height]="size()"
    >
      <path
        class="fill-ig-accent-text"
        d="M32 4C40 9 48 11 56 11V30C56 45 46 55 32 60C18 55 8 45 8 30V11C16 11 24 9 32 4Z"
      />
      <rect class="fill-ig-canvas" x="24" y="18" width="16" height="6" rx="3" />
      <rect class="fill-ig-canvas" x="21" y="28" width="22" height="6" rx="3" />
      <rect class="fill-ig-canvas" x="18" y="38" width="28" height="6" rx="3" />
    </svg>
  `,
})
export class BrandMarkComponent {
  /** Lado del símbolo en píxeles. */
  readonly size = input(32);
}
