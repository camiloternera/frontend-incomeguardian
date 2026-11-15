import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { DatePickerComponent } from './date-picker.component';

@Component({
  imports: [ReactiveFormsModule, DatePickerComponent],
  template: `
    <label for="date">Fecha</label>
    <app-date-picker inputId="date" [formControl]="control" [today]="today" [max]="max()" />
    <button type="button" data-testid="outside">Fuera</button>
  `,
})
class HostComponent {
  readonly control = new FormControl<string | null>('2026-11-03');
  readonly today = '2026-11-03';
  readonly max = signal<string | null>('2026-11-03');
}

describe('DatePickerComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('es-CO');
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const query = <E extends HTMLElement = HTMLElement>(testId: string) =>
    element.querySelector<E>(`[data-testid="${testId}"]`);
  const trigger = () => query<HTMLButtonElement>('date-picker-trigger')!;
  const day = (date: string) => element.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
  const popover = () => query('date-picker-popover');

  function open(): void {
    trigger().click();
    fixture.detectChanges();
  }

  function key(target: Element, value: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
    fixture.detectChanges();
  }

  it('shows the value relative to today in the trigger', () => {
    expect(trigger().textContent).toContain('Hoy,');
    expect(trigger().textContent).toContain('2026');

    fixture.componentInstance.control.setValue('2026-11-02');
    fixture.detectChanges();
    expect(trigger().textContent).toContain('Ayer,');

    fixture.componentInstance.control.setValue(null);
    fixture.detectChanges();
    expect(trigger().textContent).toContain('Elige una fecha');
  });

  it('opens on the month of the value, marks today and the selection, and blocks future days', () => {
    fixture.componentInstance.control.setValue('2026-11-02');
    fixture.detectChanges();
    open();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(element.textContent).toContain('noviembre de 2026');
    // Seis semanas que empiezan el domingo 1 de noviembre.
    expect(element.querySelectorAll('[data-testid="date-picker-day"]').length).toBe(42);
    expect(
      element.querySelector('[data-testid="date-picker-day"]')?.getAttribute('data-date'),
    ).toBe('2026-11-01');
    expect(day('2026-11-02')?.getAttribute('aria-pressed')).toBe('true');
    expect(day('2026-11-03')?.getAttribute('aria-current')).toBe('date');
    expect(day('2026-11-04')?.disabled).toBe(true);
    expect(query<HTMLButtonElement>('date-picker-next')!.disabled).toBe(true);
  });

  it('chooses a day, writes YYYY-MM-DD and closes', () => {
    open();
    query('date-picker-previous')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('octubre de 2026');

    day('2026-10-15')!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('2026-10-15');
    expect(fixture.componentInstance.control.touched).toBe(true);
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('offers today, yesterday and a week ago as shortcuts', () => {
    open();
    expect(query('date-picker-shortcut-today')?.getAttribute('aria-pressed')).toBe('true');

    query('date-picker-shortcut-lastWeek')!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('2026-10-27');
  });

  it('jumps to a month from the month view, without future months', () => {
    open();
    query('date-picker-view')!.click();
    fixture.detectChanges();

    const months = [
      ...element.querySelectorAll<HTMLButtonElement>('[data-testid="date-picker-month"]'),
    ];
    expect(months.length).toBe(12);
    expect(months[11].disabled).toBe(true);
    expect(query<HTMLButtonElement>('date-picker-next')!.disabled).toBe(true);

    query('date-picker-previous')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('2025');
    element.querySelector<HTMLButtonElement>('[data-date="2025-03-01"]')!.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('marzo de 2025');
    expect(day('2025-03-15')).toBeTruthy();
  });

  it('moves with the keyboard, stops at the max date and chooses with Enter', async () => {
    open();
    await fixture.whenStable();
    const grid = element.querySelector('[role="grid"]')!;

    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-03');
    key(grid, 'ArrowRight');
    // Mañana es futuro: el foco se queda en hoy.
    expect(element.querySelector('[data-active-day="true"]')?.getAttribute('data-date')).toBe(
      '2026-11-03',
    );

    key(grid, 'ArrowUp');
    key(grid, 'ArrowLeft');
    expect(element.querySelector('[data-active-day="true"]')?.getAttribute('data-date')).toBe(
      '2026-10-26',
    );
    expect(element.textContent).toContain('octubre de 2026');

    key(grid, 'PageUp');
    key(grid, 'Enter');
    expect(fixture.componentInstance.control.value).toBe('2026-09-26');
  });

  it('closes with Escape and when clicking outside', () => {
    open();
    key(popover()!, 'Escape');
    expect(popover()).toBeNull();
    expect(fixture.componentInstance.control.value).toBe('2026-11-03');

    open();
    query('outside')!.click();
    fixture.detectChanges();
    expect(popover()).toBeNull();
  });

  describe('focus leaving the calendar', () => {
    afterEach(() => vi.useRealTimers());

    const host = () => element.querySelector<HTMLElement>('app-date-picker')!;

    function focusOut(target: Element, relatedTarget: EventTarget | null): void {
      target.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }));
      fixture.detectChanges();
    }

    it('stays open on the days of the chosen month when the month button leaves the DOM', () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      open();
      query('date-picker-view')!.click();
      fixture.detectChanges();
      const march = element.querySelector<HTMLButtonElement>('[data-date="2026-03-01"]')!;
      march.focus();

      march.click();
      // Como en Chrome: el botón del mes pierde el foco sin destino antes de que el render enfoque
      // el día activo. `blur()` dispara ese `focusout` con `relatedTarget` null.
      march.blur();
      expect(host().contains(document.activeElement)).toBe(false);
      fixture.detectChanges();
      expect(popover()).not.toBeNull();

      vi.runAllTimers();
      fixture.detectChanges();

      expect(popover()).not.toBeNull();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      expect(element.textContent).toContain('marzo de 2026');
      expect(day('2026-03-15')).toBeTruthy();
      const active = element.querySelector<HTMLElement>('[data-active-day="true"]');
      expect(active?.getAttribute('data-date')).toBe('2026-03-01');
      expect(document.activeElement).toBe(active);
    });

    it('closes at once when the focus goes to an element outside', () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      open();

      focusOut(day('2026-11-03')!, query('outside'));

      // Sin avanzar el reloj: con destino conocido no espera ningún timeout.
      expect(popover()).toBeNull();
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('stays open when the focus moves to another element of the calendar', () => {
      open();

      focusOut(day('2026-11-03')!, query('date-picker-previous'));

      expect(popover()).not.toBeNull();
    });

    it('closes after the render when the focus is lost with no target and ends outside', () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      open();
      expect(host().contains(document.activeElement)).toBe(true);

      // `blur()` dispara el `focusout` sin destino y deja el foco en el body, fuera del calendario.
      (document.activeElement as HTMLElement).blur();
      fixture.detectChanges();

      // Aún no: espera al render por si el foco vuelve a un día del calendario.
      expect(popover()).not.toBeNull();
      expect(host().contains(document.activeElement)).toBe(false);

      vi.runAllTimers();
      fixture.detectChanges();

      expect(popover()).toBeNull();
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('allows any date when there is no max', () => {
    fixture.componentInstance.max.set(null);
    fixture.detectChanges();
    open();

    expect(day('2026-11-20')?.disabled).toBe(false);
    expect(query<HTMLButtonElement>('date-picker-next')!.disabled).toBe(false);
  });
});
