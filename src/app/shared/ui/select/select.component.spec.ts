import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { SelectComponent, SelectOption } from './select.component';

const FEW: SelectOption<number>[] = [
  { value: 1, label: 'Ahorros' },
  { value: 2, label: 'Billetera digital' },
  { value: 3, label: 'Tarjeta de crédito' },
];

const MANY: SelectOption<number>[] = [
  ...FEW,
  { value: 4, label: 'Cuenta corriente' },
  { value: 5, label: 'Cuenta en el exterior' },
  { value: 6, label: 'Efectivo' },
  { value: 7, label: 'Inversiones' },
];

@Component({
  imports: [ReactiveFormsModule, SelectComponent],
  template: `
    <app-select
      inputId="type"
      placeholder="Elige un tipo"
      [options]="options()"
      [formControl]="control"
    >
      <a selectFooter data-testid="footer" href="/new">Crear</a>
    </app-select>
  `,
})
class HostComponent {
  readonly options = signal<SelectOption<number>[]>(FEW);
  readonly control = new FormControl<number | null>(null);
}

describe('SelectComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  const trigger = () => element.querySelector<HTMLButtonElement>('[data-testid="select-trigger"]')!;
  const options = () => [...element.querySelectorAll<HTMLElement>('[role="option"]')];
  const popover = () => element.querySelector('[data-testid="select-popover"]');

  function key(target: Element, name: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    fixture.detectChanges();
  }

  async function render(list = FEW, value: number | null = null) {
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.options.set(list);
    fixture.componentInstance.control.setValue(value);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  function open(): void {
    trigger().click();
    fixture.detectChanges();
  }

  it('shows the placeholder, then the chosen label, and writes the value to the form', async () => {
    await render();
    expect(trigger().textContent).toContain('Elige un tipo');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    options()[2].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe(3);
    expect(trigger().textContent).toContain('Tarjeta de crédito');
    expect(popover()).toBeNull();
  });

  it('marks the selected option and keeps the footer below the list', async () => {
    await render(FEW, 2);
    open();

    expect(options()[1].getAttribute('aria-selected')).toBe('true');
    expect(options()[0].getAttribute('aria-selected')).toBe('false');
    expect(popover()?.querySelector('[data-testid="footer"]')).toBeTruthy();
  });

  it('only offers search and scrolling when there are more than five options', async () => {
    await render();
    open();
    expect(element.querySelector('[data-testid="select-search"]')).toBeNull();

    fixture.componentInstance.options.set(MANY);
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="select-search"]')).toBeTruthy();
    expect(element.querySelector<HTMLElement>('[role="listbox"]')!.style.maxHeight).toBe('228px');
  });

  it('filters ignoring accents and says when nothing matches', async () => {
    await render(MANY);
    open();
    const search = element.querySelector<HTMLInputElement>('[data-testid="select-search"]')!;

    search.value = 'credito';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(options().map((option) => option.textContent!.trim())).toEqual(['Tarjeta de crédito']);

    key(search, 'Enter');
    expect(fixture.componentInstance.control.value).toBe(3);

    open();
    const again = element.querySelector<HTMLInputElement>('[data-testid="select-search"]')!;
    again.value = 'nómina';
    again.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="select-empty"]')?.textContent).toContain('nómina');
  });

  it('moves with the arrow keys, jumps by letter and chooses with Enter', async () => {
    await render();
    key(trigger(), 'ArrowDown');
    const listbox = element.querySelector('[role="listbox"]')!;
    expect(listbox.getAttribute('aria-activedescendant')).toBe('type-option-0');

    key(listbox, 'ArrowDown');
    expect(listbox.getAttribute('aria-activedescendant')).toBe('type-option-1');

    key(listbox, 't');
    expect(listbox.getAttribute('aria-activedescendant')).toBe('type-option-2');

    key(listbox, 'Enter');
    expect(fixture.componentInstance.control.value).toBe(3);
  });

  it('closes with Escape without letting it reach the container', async () => {
    await render();
    const reached = vi.fn();
    element.addEventListener('keydown', reached);
    open();

    key(element.querySelector('[role="listbox"]')!, 'Escape');

    expect(popover()).toBeNull();
    expect(reached).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes when clicking outside', async () => {
    await render();
    open();

    document.body.click();
    fixture.detectChanges();

    expect(popover()).toBeNull();
  });

  it('does not open while the control is disabled', async () => {
    await render();
    fixture.componentInstance.control.disable();
    fixture.detectChanges();

    open();

    expect(trigger().disabled).toBe(true);
    expect(popover()).toBeNull();
  });
});
