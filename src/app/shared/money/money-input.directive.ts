import { getLocaleNumberSymbol, NumberSymbol } from '@angular/common';
import { Directive, effect, ElementRef, forwardRef, inject, input, untracked } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LanguageService } from '@core/i18n/language.service';

/** Separadores de número de un idioma. */
interface Separators {
  decimal: string;
  group: string;
}

/**
 * Campo de dinero que muestra los separadores de miles del idioma mientras se escribe
 * (`1.500.000,5` en es-CO, `1,500,000.5` en en-US) y entrega al formulario el número en texto
 * canónico: sin miles, con punto decimal y signo opcional (`-1500000.5`), o `''` si está vacío.
 *
 * Uso: `<input appMoneyInput formControlName="amount" [maxDecimals]="2" [allowNegative]="false" />`.
 */
@Directive({
  selector: 'input[appMoneyInput]',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInputDirective), multi: true }],
  host: {
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
})
export class MoneyInputDirective implements ControlValueAccessor {
  /** Decimales que se dejan escribir; los demás se descartan. */
  readonly maxDecimals = input(2);
  /** Si se admite un signo menos al inicio (por ejemplo, una cuenta sobregirada). */
  readonly allowNegative = input(false);

  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly language = inject(LanguageService).language;

  /** Último valor canónico, para volver a dibujarlo si cambia el idioma. */
  private canonical = '';
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    // Con el panel abierto, un cambio de idioma vuelve a dibujar el número con sus separadores.
    effect(() => {
      const separators = separatorsOf(this.language());
      untracked(() => (this.element.value = display(this.canonical, separators)));
    });
  }

  writeValue(value: unknown): void {
    this.canonical = value === null || value === undefined ? '' : String(value);
    this.element.value = display(this.canonical, separatorsOf(this.language()));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.element.disabled = disabled;
  }

  /** Limpia y reagrupa lo escrito sin mover el cursor de la cifra en la que estaba. */
  protected onInput(): void {
    const separators = separatorsOf(this.language());
    const raw = this.element.value;
    const caret = this.element.selectionStart ?? raw.length;
    const significantBefore = countSignificant(raw.slice(0, caret), separators.decimal);

    const { canonical, view } = clean(raw, separators, this.maxDecimals(), this.allowNegative());
    this.element.value = view;

    const position = positionAfter(view, significantBefore, separators.decimal);
    this.element.setSelectionRange(position, position);

    if (canonical !== this.canonical) {
      this.canonical = canonical;
      this.onChange(canonical);
    }
  }
}

function separatorsOf(locale: string): Separators {
  return {
    decimal: getLocaleNumberSymbol(locale, NumberSymbol.Decimal),
    group: getLocaleNumberSymbol(locale, NumberSymbol.Group),
  };
}

/** Cifras, signo y separador decimal: lo que cuenta para ubicar el cursor (no los separadores de miles). */
function countSignificant(text: string, decimal: string): number {
  let count = 0;

  for (const char of text) {
    if (/\d/.test(char) || char === '-' || char === decimal) {
      count++;
    }
  }

  return count;
}

/** Posición del texto formateado justo después de `significant` caracteres significativos. */
function positionAfter(view: string, significant: number, decimal: string): number {
  if (significant === 0) {
    return 0;
  }

  let seen = 0;

  for (let index = 0; index < view.length; index++) {
    const char = view[index];

    if (/\d/.test(char) || char === '-' || char === decimal) {
      seen++;

      if (seen === significant) {
        return index + 1;
      }
    }
  }

  return view.length;
}

/**
 * Lo escrito llevado a texto canónico y a texto visible. Se ignoran los separadores de miles (se
 * vuelven a poner) y cualquier otro carácter; se conserva un separador decimal recién escrito.
 */
function clean(
  raw: string,
  separators: Separators,
  maxDecimals: number,
  allowNegative: boolean,
): { canonical: string; view: string } {
  const negative = allowNegative && raw.trimStart().startsWith('-');
  let integer = '';
  let decimals = '';
  let hasDecimal = false;

  for (const char of raw) {
    if (/\d/.test(char)) {
      if (hasDecimal) {
        decimals += char;
      } else {
        integer += char;
      }
    } else if (char === separators.decimal && !hasDecimal && maxDecimals > 0) {
      hasDecimal = true;
    }
  }

  decimals = decimals.slice(0, maxDecimals);
  // Sin ceros a la izquierda, salvo el que precede a los decimales («0,5»).
  integer = integer.replace(/^0+(?=\d)/, '');

  if (hasDecimal && !integer) {
    integer = '0';
  }

  const sign = negative ? '-' : '';
  // Un «-» solo todavía no es un número: para el formulario el campo sigue vacío.
  const canonical = integer ? `${sign}${integer}${decimals ? `.${decimals}` : ''}` : '';
  const view = `${sign}${group(integer, separators.group)}${hasDecimal ? `${separators.decimal}${decimals}` : ''}`;

  return { canonical, view };
}

/** Número canónico (`-1234.5`) con los separadores del idioma (`-1.234,5`). */
function display(canonical: string, separators: Separators): string {
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(canonical.trim());

  if (!match) {
    return canonical;
  }

  const [, sign, integer, decimals] = match;

  return `${sign}${group(integer, separators.group)}${decimals !== undefined ? `${separators.decimal}${decimals}` : ''}`;
}

/** Parte entera con separadores cada tres cifras. */
function group(integer: string, separator: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
