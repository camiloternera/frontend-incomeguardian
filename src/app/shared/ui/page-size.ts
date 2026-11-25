import { Signal, signal } from '@angular/core';

/** Cantidades de registros por página que se pueden elegir en los listados. */
export const PAGE_SIZE_OPTIONS = [5, 10, 15, 20] as const;

/** Registros por página mientras la persona no elija otra cantidad. */
export const DEFAULT_PAGE_SIZE = 5;

const STORAGE_PREFIX = 'ig.pageSize.';

/** Indica si el valor es una de las cantidades que ofrece el selector. */
export function isPageSize(value: unknown): value is number {
  return (PAGE_SIZE_OPTIONS as readonly unknown[]).includes(value);
}

/**
 * Registros por página de un listado, recordados en el navegador por separado para cada uno
 * (`key`: por ejemplo `'accounts'`). Si el almacenamiento no está disponible (navegación
 * privada) o guarda un valor que ya no se ofrece, se usa la cantidad por defecto.
 */
export class PageSizePreference {
  private readonly storageKey: string;
  private readonly current: ReturnType<typeof signal<number>>;

  /** Cantidad elegida para este listado. */
  readonly size: Signal<number>;

  constructor(key: string, fallback: number = DEFAULT_PAGE_SIZE) {
    this.storageKey = STORAGE_PREFIX + key;
    this.current = signal(this.read(fallback));
    this.size = this.current.asReadonly();
  }

  /** Cambia la cantidad y la recuerda; ignora una que el selector no ofrece. */
  set(size: number): void {
    if (!isPageSize(size)) {
      return;
    }

    this.current.set(size);

    try {
      localStorage.setItem(this.storageKey, String(size));
    } catch {
      // Sin almacenamiento la cantidad se aplica igual, solo que no se recuerda.
    }
  }

  private read(fallback: number): number {
    try {
      const stored = Number(localStorage.getItem(this.storageKey));

      return isPageSize(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  }
}
