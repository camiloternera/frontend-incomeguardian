/** Límites que aplica el backend a una categoría; el formulario los replica. */
export const CATEGORY_NAME_MAX_LENGTH = 20;
export const CATEGORY_DESCRIPTION_MAX_LENGTH = 500;

export interface Category {
  id: number;
  name: string;
  description: string;
  /** Las categorías globales vienen predefinidas para todos y no se pueden editar ni eliminar. */
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/** Ordena primero las categorías personales y luego las predefinidas, cada grupo alfabéticamente. */
export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort(
    (a, b) => Number(a.isGlobal) - Number(b.isGlobal) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

/** La parte editable de una categoría, usada para crearla y para actualizarla. */
export interface CategoryDraft {
  name: string;
  description: string;
}
