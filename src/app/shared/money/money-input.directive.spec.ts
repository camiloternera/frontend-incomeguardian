import '@core/i18n/locale-data';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { translocoTesting } from '@core/i18n/i18n.testing';
import { LanguageService } from '@core/i18n/language.service';
import { MoneyInputDirective } from './money-input.directive';

@Component({
  imports: [ReactiveFormsModule, MoneyInputDirective],
  template: `<input appMoneyInput [formControl]="control" [maxDecimals]="decimals()" [allowNegative]="negative()" />`,
})
class HostComponent {
  readonly control = new FormControl<string | null>('');
  readonly decimals = signal(2);
  readonly negative = signal(false);
}

describe('MoneyInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let input: HTMLInputElement;
  let control: FormControl<string | null>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en-US');
  });

  function render(setup: (host: HostComponent) => void = () => undefined): void {
    fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
    control = fixture.componentInstance.control;
  }

  /** Simula lo que deja el navegador tras una pulsación: el texto y dónde queda el cursor. */
  function typeRaw(value: string, caret = value.length): void {
    input.value = value;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input'));
  }

  describe('grouping', () => {
    it('groups the thousands with commas in English and hands over canonical text', () => {
      render();

      typeRaw('1500000.5');

      expect(input.value).toBe('1,500,000.5');
      expect(control.value).toBe('1500000.5');
    });

    it('groups with dots and uses the comma as decimal in Spanish', () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      render();

      typeRaw('1500000,5');

      expect(input.value).toBe('1.500.000,5');
      expect(control.value).toBe('1500000.5');
    });

    it('only takes the separator of the language as decimal and regroups the rest', () => {
      render();

      // En en-US la coma es de miles: se descarta y se vuelve a agrupar.
      typeRaw('12,3456');

      expect(input.value).toBe('123,456');
      expect(control.value).toBe('123456');
    });

    it('takes a pasted Spanish number with its thousands and decimals', () => {
      TestBed.inject(LanguageService).setLanguage('es-CO');
      render();

      typeRaw('1.234.567,89');

      expect(input.value).toBe('1.234.567,89');
      expect(control.value).toBe('1234567.89');
    });

    it('drops any other character, leading zeros and keeps a just-typed decimal separator', () => {
      render();

      typeRaw('abc12');
      expect(control.value).toBe('12');

      typeRaw('007');
      expect(input.value).toBe('7');

      typeRaw('.5');
      expect(input.value).toBe('0.5');
      expect(control.value).toBe('0.5');

      typeRaw('12.');
      expect(input.value).toBe('12.');
      expect(control.value).toBe('12');
    });
  });

  describe('decimals', () => {
    it('cuts the decimals beyond the maximum', () => {
      render();

      typeRaw('10.999');

      expect(input.value).toBe('10.99');
      expect(control.value).toBe('10.99');
    });

    it('allows up to three decimals when asked to', () => {
      render((host) => host.decimals.set(3));

      typeRaw('10.12345');

      expect(control.value).toBe('10.123');
    });
  });

  describe('sign', () => {
    it('ignores a minus sign unless negatives are allowed', () => {
      render();

      typeRaw('-1250.5');

      expect(input.value).toBe('1,250.5');
      expect(control.value).toBe('1250.5');
    });

    it('keeps a leading minus sign when negatives are allowed', () => {
      render((host) => host.negative.set(true));

      typeRaw('-1250.5');

      expect(input.value).toBe('-1,250.5');
      expect(control.value).toBe('-1250.5');
    });

    it('leaves the control empty while only a minus sign is typed', () => {
      render((host) => host.negative.set(true));

      typeRaw('-');

      expect(input.value).toBe('-');
      expect(control.value).toBe('');
    });
  });

  describe('caret', () => {
    it('keeps the caret after the digit typed in the middle, even when the groups move', () => {
      render();
      typeRaw('150000');
      expect(input.value).toBe('150,000');

      // Se escribe «2» tras «150»: el navegador deja «1502,000» con el cursor después del 2.
      typeRaw('1502,000', 4);

      expect(input.value).toBe('1,502,000');
      expect(input.selectionStart).toBe(5);
      expect(input.selectionEnd).toBe(5);
    });

    it('keeps the caret in place after deleting a digit', () => {
      render();
      typeRaw('1500');
      expect(input.value).toBe('1,500');

      // Se borra el «5»: queda «1,00» con el cursor tras la coma.
      typeRaw('1,00', 2);

      expect(input.value).toBe('100');
      expect(input.selectionStart).toBe(1);
    });

    it('puts the caret at the start when nothing significant is before it', () => {
      render();

      typeRaw('1500', 0);

      expect(input.selectionStart).toBe(0);
    });
  });

  describe('form control', () => {
    it('does not notify the form when the number did not change', () => {
      render();
      typeRaw('1500');
      const changes: (string | null)[] = [];
      control.valueChanges.subscribe((value) => changes.push(value));

      // Escribir otra coma de miles no cambia el número.
      typeRaw('1,,500');

      expect(input.value).toBe('1,500');
      expect(changes).toEqual([]);
    });

    it('shows a written value with the separators of the language', () => {
      render();

      control.setValue('150000');
      expect(input.value).toBe('150,000');

      control.setValue('-1250.5');
      expect(input.value).toBe('-1,250.5');

      control.setValue(null);
      expect(input.value).toBe('');
    });

    it('marks the control as touched on blur', () => {
      render();

      input.dispatchEvent(new Event('blur'));

      expect(control.touched).toBe(true);
    });

    it('disables and enables the field with the control', () => {
      render();

      control.disable();
      expect(input.disabled).toBe(true);

      control.enable();
      expect(input.disabled).toBe(false);
    });

    it('redraws the number when the language changes', () => {
      render();
      control.setValue('1500000.5');
      expect(input.value).toBe('1,500,000.5');

      TestBed.inject(LanguageService).setLanguage('es-CO');
      fixture.detectChanges();

      expect(input.value).toBe('1.500.000,5');
      expect(control.value).toBe('1500000.5');
    });

    it('redraws the last typed number too when the language changes', () => {
      render();
      typeRaw('2500.75');

      TestBed.inject(LanguageService).setLanguage('es-CO');
      fixture.detectChanges();

      expect(input.value).toBe('2.500,75');
    });
  });
});
