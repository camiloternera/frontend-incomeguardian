import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Ícono de ojo para alternar la visibilidad de una contraseña.
 *
 * Reproduce en SVG inline los íconos `eye` y `eye-off` de Lucide para que las
 * vistas de autenticación, que se cargan en el bundle inicial, no arrastren el
 * chunk compartido de `@lucide/angular` (~88 kB) con todos los íconos de la app.
 */
@Component({
  selector: 'app-password-visibility-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.data-icon]="visible() ? 'eye-off' : 'eye'"
    >
      @if (visible()) {
        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
        <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
        <path d="m2 2 20 20" />
      } @else {
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      }
    </svg>
  `,
})
export class PasswordVisibilityIconComponent {
  /** `true` cuando la contraseña está visible: se muestra el ojo tachado para ocultarla. */
  readonly visible = input.required<boolean>();

  /** Lado del ícono en píxeles. */
  readonly size = input(18);
}
