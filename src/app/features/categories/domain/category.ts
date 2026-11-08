import { matchesSearch } from '@shared/text/search-text';

/** Límites que aplica el backend a una categoría; el formulario los replica. */
export const CATEGORY_NAME_MAX_LENGTH = 20;
export const CATEGORY_DESCRIPTION_MAX_LENGTH = 500;

/** Tipos de movimiento a los que puede pertenecer una categoría, en el orden en que se muestran. */
export const CATEGORY_TYPES = ['income', 'expense', 'transfer'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

/** Indica si el valor recibido es un tipo de categoría conocido. */
export function isCategoryType(value: unknown): value is CategoryType {
  return typeof value === 'string' && (CATEGORY_TYPES as readonly string[]).includes(value);
}

export interface Category {
  id: number;
  name: string;
  description: string;
  /** Tipo de movimiento en el que se puede usar; se fija al crearla y no se puede cambiar. */
  type: CategoryType;
  createdAt: string;
  updatedAt: string | null;
}

/** Ordena las categorías alfabéticamente por nombre, sin distinguir mayúsculas ni tildes. */
export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** La parte editable de una categoría, usada para actualizarla. */
export interface CategoryDraft {
  name: string;
  description: string;
}

/** Lo necesario para crear una categoría: además de nombre y descripción, su tipo. */
export interface NewCategoryDraft extends CategoryDraft {
  type: CategoryType;
}

/** Indica si la categoría coincide con la búsqueda por nombre o descripción; una búsqueda vacía coincide siempre. */
export function matchesCategory(category: Category, query: string): boolean {
  return matchesSearch(query, category.name, category.description);
}
