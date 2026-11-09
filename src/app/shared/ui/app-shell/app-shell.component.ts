import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideArrowLeftRight,
  LucideChartPie,
  LucideDynamicIcon,
  LucideIcon,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideMenu,
  LucideSlidersHorizontal,
  LucideTag,
  LucideWallet,
  LucideX,
} from '@lucide/angular';
import { CurrentUser } from '@core/session/current-user';
import { ThemeService } from '@core/theme/theme.service';

/** Una entrada de la navegación; sin `route` la sección aún no existe y se marca como próxima. */
interface ShellNavItem {
  key: string;
  icon: LucideIcon;
  route?: string;
}

/** Grupo de entradas con su título. */
interface ShellNavGroup {
  key: string;
  items: ShellNavItem[];
}

/** Ancho desde el que se muestra la barra lateral fija (`lg` de Tailwind). */
const DESKTOP_QUERY = '(min-width: 1024px)';

const GROUPS: ShellNavGroup[] = [
  {
    key: 'money',
    items: [
      { key: 'overview', icon: LucideLayoutDashboard, route: '/home' },
      { key: 'transactions', icon: LucideArrowLeftRight, route: '/transactions' },
      { key: 'budgets', icon: LucideChartPie, route: '/budgets' },
    ],
  },
  {
    key: 'setup',
    items: [
      { key: 'accounts', icon: LucideWallet, route: '/accounts' },
      { key: 'categories', icon: LucideTag, route: '/categories' },
    ],
  },
];

const SETTINGS: ShellNavItem = { key: 'settings', icon: LucideSlidersHorizontal, route: '/settings' };

/**
 * Marco de las vistas privadas: barra lateral fija en desktop y, en mobile,
 * barra superior con un menú que abre la misma navegación en un panel modal.
 */
@Component({
  selector: 'app-shell',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslocoDirective,
    LucideDynamicIcon,
    LucideLogOut,
    LucideMenu,
    LucideX,
  ],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  private readonly currentUser = inject(CurrentUser);
  private readonly router = inject(Router);

  protected readonly theme = inject(ThemeService).theme;
  protected readonly groups = GROUPS;
  protected readonly settings = SETTINGS;

  /** Perfil leído al montar el shell; la sesión no cambia mientras está abierto. */
  protected readonly user = this.currentUser.profile();
  /** Iniciales del nombre para el avatar (máximo dos). */
  protected readonly initials = (this.user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  /** Si el panel de navegación mobile está abierto. */
  protected readonly menuOpen = signal(false);
  /** Mientras el backend revoca la sesión, el botón de salir no se puede pulsar otra vez. */
  protected readonly signingOut = signal(false);

  private readonly drawer = viewChild.required<ElementRef<HTMLDialogElement>>('drawer');
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  constructor() {
    // Al pasar a desktop el panel modal dejaría la página inerte, así que se cierra.
    const desktop = typeof matchMedia === 'function' ? matchMedia(DESKTOP_QUERY) : null;
    const onChange = (event: MediaQueryListEvent) => event.matches && this.closeMenu();
    desktop?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => desktop?.removeEventListener('change', onChange));
  }

  /** Abre el panel de navegación mobile como modal. */
  protected openMenu(): void {
    const dialog = this.drawer().nativeElement;

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    this.menuOpen.set(true);
  }

  /** Cierra el panel; el evento `close` del diálogo termina de sincronizar el estado. */
  protected closeMenu(): void {
    const dialog = this.drawer().nativeElement;

    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      this.onDrawerClosed();
    }
  }

  /** Sincroniza el estado y devuelve el foco al botón que abrió el panel (también tras Escape). */
  protected onDrawerClosed(): void {
    if (!this.menuOpen()) {
      return;
    }

    this.menuOpen.set(false);
    this.menuButton().nativeElement.focus();
  }

  /** Un clic sobre el fondo oscuro llega al propio diálogo: cierra el panel. */
  protected onDrawerClick(event: MouseEvent): void {
    if (event.target === this.drawer().nativeElement) {
      this.closeMenu();
    }
  }

  /** Revoca la sesión de este dispositivo, borra los tokens y vuelve al login. */
  protected signOut(): void {
    if (this.signingOut()) {
      return;
    }

    this.signingOut.set(true);
    this.currentUser.signOut().subscribe({
      complete: () => {
        this.signingOut.set(false);
        this.closeMenu();
        void this.router.navigateByUrl('/login');
      },
    });
  }
}
