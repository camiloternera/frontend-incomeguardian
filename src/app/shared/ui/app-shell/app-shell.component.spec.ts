import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { CurrentUser, CurrentUserProfile } from '@core/session/current-user';
import { AppShellComponent } from './app-shell.component';

@Component({ template: '<h1>Contenido</h1>' })
class StubPageComponent {}

/** Usuario falso: guarda si se pidió cerrar la sesión. */
class FakeCurrentUser extends CurrentUser {
  signedOut = false;

  constructor(private readonly user: CurrentUserProfile | null) {
    super();
  }

  profile(): CurrentUserProfile | null {
    return this.signedOut ? null : this.user;
  }

  signOut(): void {
    this.signedOut = true;
  }
}

async function render(url = '/home', user: CurrentUserProfile | null = { name: 'Camila Rojas', email: 'camila@example.com' }) {
  const currentUser = new FakeCurrentUser(user);

  TestBed.configureTestingModule({
    imports: [translocoTesting()],
    providers: [
      { provide: CurrentUser, useValue: currentUser },
      provideRouter([
        { path: 'login', component: StubPageComponent },
        {
          path: '',
          component: AppShellComponent,
          children: [
            { path: 'home', component: StubPageComponent },
            { path: 'accounts', component: StubPageComponent },
          ],
        },
      ]),
    ],
  });

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  const element = harness.routeNativeElement as HTMLElement;

  return { harness, element, currentUser, sidebar: element.querySelector('aside') as HTMLElement };
}

describe('AppShellComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the routed page inside the main landmark', async () => {
    const { element } = await render();

    expect(element.querySelector('main#app-content h1')?.textContent).toContain('Contenido');
  });

  it('groups the sections and marks the ones that are not built yet', async () => {
    const { sidebar } = await render();

    expect(sidebar.querySelectorAll('nav li').length).toBe(8);
    expect(sidebar.querySelectorAll('[data-testid="shell-soon"]').length).toBe(4);
    expect(sidebar.textContent).toContain('Money');
    expect(sidebar.textContent).toContain('Setup');
  });

  it('links to the built sections', async () => {
    const { sidebar } = await render();

    expect(sidebar.querySelector('nav a[href="/home"]')?.textContent).toContain('Overview');
    expect(sidebar.querySelector('a[href="/accounts"]')?.textContent).toContain('Accounts');
    expect(sidebar.querySelector('a[href="/categories"]')?.textContent).toContain('Categories');
    expect(sidebar.querySelector('a[href="/account-types"]')?.textContent).toContain('Account types');
    expect(sidebar.querySelector('a[href="/settings"]')?.textContent).toContain('Settings');
  });

  it('marks the current section', async () => {
    const { sidebar, harness } = await render('/accounts');
    harness.detectChanges();

    const current = sidebar.querySelectorAll('nav [aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].getAttribute('href')).toBe('/accounts');
  });

  it('shows who is signed in', async () => {
    const { sidebar } = await render();

    expect(sidebar.querySelector('[data-testid="shell-user-name"]')?.textContent).toContain('Camila Rojas');
    expect(sidebar.textContent).toContain('camila@example.com');
    expect(sidebar.textContent).toContain('CR');
  });

  it('signs out and returns to the login', async () => {
    const { sidebar, currentUser } = await render();

    (sidebar.querySelector('[data-testid="shell-sign-out"]') as HTMLButtonElement).click();
    await TestBed.inject(Router).navigated;
    await new Promise((resolve) => setTimeout(resolve));

    expect(currentUser.signedOut).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('opens and closes the mobile menu', async () => {
    const { element, harness } = await render();
    const button = element.querySelector('[data-testid="shell-menu-button"]') as HTMLButtonElement;
    const drawer = element.querySelector('[data-testid="shell-drawer"]') as HTMLDialogElement;

    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    harness.detectChanges();
    expect(drawer.open).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    (element.querySelector('[data-testid="shell-close-button"]') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
    expect(drawer.open).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('translates the navigation into Spanish', async () => {
    const { sidebar, harness } = await render();
    TestBed.inject(LanguageService).setLanguage('es-CO');
    harness.detectChanges();

    expect(sidebar.textContent).toContain('Resumen');
    expect(sidebar.textContent).toContain('Tipos de cuenta');
    expect(sidebar.textContent).toContain('Cerrar sesión');
  });
});
