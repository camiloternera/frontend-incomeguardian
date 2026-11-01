import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCheck, LucideChevronDown, LucideSearch } from '@lucide/angular';
import { matchesSearch, normalizeSearchText } from '@shared/text/search-text';

/** Opción del selector: el valor que guarda el formulario y el texto que ve la persona. */
export interface SelectOption<T> {
  value: T;
  label: string;
}

/** Filas visibles antes de desplazar la lista; a partir de ahí también aparece la búsqueda. */
export const SELECT_VISIBLE_OPTIONS = 5;

/** Tiempo en que las letras tecleadas se acumulan para saltar a una opción. */
const TYPEAHEAD_RESET_MS = 600;

let nextId = 0;

/**
 * Selector con la lista dibujada con el tema, en lugar de la nativa del sistema operativo.
 * Se usa como cualquier control de formulario (`formControlName`). Con más de
 * `SELECT_VISIBLE_OPTIONS` opciones la lista se desplaza y ofrece búsqueda. El contenido con el
 * atributo `selectFooter` (por ejemplo, un enlace para crear una opción) queda fijo bajo la lista.
 */
@Component({
  selector: 'app-select',
  imports: [TranslocoDirective, LucideCheck, LucideChevronDown, LucideSearch],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true },
  ],
  host: {
    class: 'relative block',
    '(focusout)': 'onFocusOut($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './select.component.html',
})
export class SelectComponent<T> implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly options = input.required<readonly SelectOption<T>[]>();
  /** Texto del botón cuando no hay nada elegido. */
  readonly placeholder = input('');
  /** `id` del botón, para que un `<label for>` lo nombre. */
  readonly inputId = input(`app-select-${nextId++}`);
  readonly invalid = input(false);
  /** Ids de las ayudas o errores que describen el campo. */
  readonly describedBy = input<string | null>(null);

  protected readonly listId = computed(() => `${this.inputId()}-list`);
  protected readonly maxListHeight = `${SELECT_VISIBLE_OPTIONS * 44 + (SELECT_VISIBLE_OPTIONS - 1) * 2}px`;

  protected readonly value = signal<T | null>(null);
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);
  protected readonly query = signal('');
  /** Posición, dentro de las opciones filtradas, de la opción resaltada con el teclado o el ratón. */
  protected readonly activeIndex = signal(-1);

  protected readonly searchable = computed(() => this.options().length > SELECT_VISIBLE_OPTIONS);
  protected readonly filtered = computed(() =>
    this.options().filter((option) => matchesSearch(this.query(), option.label)),
  );
  protected readonly selected = computed(
    () => this.options().find((option) => option.value === this.value()) ?? null,
  );
  protected readonly activeId = computed(() =>
    this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null,
  );

  private typeahead = '';
  private typeaheadTimer: ReturnType<typeof setTimeout> | undefined;
  private onChange: (value: T | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: T | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled.set(disabled);
    this.close(false);
  }

  protected optionId(index: number): string {
    return `${this.inputId()}-option-${index}`;
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close(true);
    } else {
      this.open();
    }
  }

  /** Flechas, Inicio/Fin, Intro y letras sobre la lista o la búsqueda. */
  protected onListKeydown(event: KeyboardEvent): void {
    const last = this.filtered().length - 1;

    switch (event.key) {
      case 'ArrowDown':
        this.moveActive(Math.min(this.activeIndex() + 1, last));
        break;
      case 'ArrowUp':
        this.moveActive(Math.max(this.activeIndex() - 1, 0));
        break;
      case 'Home':
        this.moveActive(0);
        break;
      case 'End':
        this.moveActive(last);
        break;
      case 'Enter':
        if (this.activeIndex() >= 0) {
          this.choose(this.filtered()[this.activeIndex()]);
        }
        break;
      case ' ':
        // En la búsqueda el espacio se escribe; en la lista elige.
        if (this.searchable()) {
          return;
        }
        if (this.activeIndex() >= 0) {
          this.choose(this.filtered()[this.activeIndex()]);
        }
        break;
      default:
        if (
          !this.searchable() &&
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          this.jumpTo(event.key);
          break;
        }
        return;
    }

    event.preventDefault();
  }

  /** Escape en cualquier punto de la lista abierta la cierra sin que llegue al panel que la contiene. */
  protected onEscape(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.close(true);
  }

  /** Con la lista cerrada, la flecha abajo o arriba la abre. */
  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open();
    }
  }

  protected search(query: string): void {
    this.query.set(query);
    this.activeIndex.set(this.filtered().length ? 0 : -1);
  }

  protected choose(option: SelectOption<T>): void {
    this.value.set(option.value);
    this.onChange(option.value);
    this.close(true);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;

    if (next && this.host.nativeElement.contains(next)) {
      return;
    }

    this.onTouched();
    this.close(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  private open(): void {
    if (this.isDisabled()) {
      return;
    }

    this.query.set('');
    const selectedIndex = this.options().findIndex((option) => option.value === this.value());
    this.activeIndex.set(selectedIndex >= 0 ? selectedIndex : 0);
    this.isOpen.set(true);

    // Tras pintar la lista, el foco va a la búsqueda o a la lista y la opción elegida queda a la vista.
    afterNextRender(
      () => {
        const target = this.searchable() ? '[data-select-search]' : '[role="listbox"]';
        this.find(target)?.focus();
        this.scrollActiveIntoView();
      },
      { injector: this.injector },
    );
  }

  /** Cierra la lista; `refocus` devuelve el foco al botón (al elegir o con Escape). */
  private close(refocus: boolean): void {
    if (!this.isOpen()) {
      return;
    }

    this.isOpen.set(false);
    this.activeIndex.set(-1);

    if (refocus) {
      this.find<HTMLButtonElement>('[data-select-trigger]')?.focus();
    }
  }

  private moveActive(index: number): void {
    if (index < 0) {
      return;
    }

    this.activeIndex.set(index);
    afterNextRender(() => this.scrollActiveIntoView(), { injector: this.injector });
  }

  /** Salta a la primera opción que empieza por las letras tecleadas seguidas. */
  private jumpTo(key: string): void {
    clearTimeout(this.typeaheadTimer);
    this.typeahead += normalizeSearchText(key);
    this.typeaheadTimer = setTimeout(() => (this.typeahead = ''), TYPEAHEAD_RESET_MS);

    const index = this.filtered().findIndex((option) =>
      normalizeSearchText(option.label).startsWith(this.typeahead),
    );

    if (index >= 0) {
      this.moveActive(index);
    }
  }

  private scrollActiveIntoView(): void {
    const id = this.activeId();
    // `scrollIntoView` no existe en jsdom, por eso la llamada opcional.
    (id ? this.find(`#${id}`) : null)?.scrollIntoView?.({ block: 'nearest' });
  }

  private find<E extends HTMLElement = HTMLElement>(selector: string): E | null {
    return this.host.nativeElement.querySelector<E>(selector);
  }
}
