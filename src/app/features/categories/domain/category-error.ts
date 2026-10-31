/**
 * Códigos de negocio que envía el backend para categorías, escritos tal cual los envía.
 * Comparar contra estas constantes en lugar de escribir los textos a mano.
 */
export const CategoryErrorCode = {
  NameRequired: 'CATEGORY_NAME_REQUIRED',
  NameMaxLength: 'CATEGORY_NAME_MAX_LENGTH',
  NameAlreadyExists: 'CATEGORY_NAME_ALREADY_EXISTS',
  DescriptionRequired: 'CATEGORY_DESCRIPTION_REQUIRED',
  DescriptionMaxLength: 'CATEGORY_DESCRIPTION_MAX_LENGTH',
  NotFound: 'CATEGORY_NOT_FOUND',
} as const;

export type CategoryErrorCode = (typeof CategoryErrorCode)[keyof typeof CategoryErrorCode];

const KNOWN_CODES: readonly string[] = Object.values(CategoryErrorCode);

/** Indica si el código recibido es uno de los que conoce este dominio. */
export function isCategoryErrorCode(code: string | undefined): code is CategoryErrorCode {
  return code !== undefined && KNOWN_CODES.includes(code);
}

/** Códigos que pertenecen a un campo del formulario, para mostrarlos junto a él. */
export const NAME_ERROR_CODES: readonly CategoryErrorCode[] = [
  CategoryErrorCode.NameRequired,
  CategoryErrorCode.NameMaxLength,
  CategoryErrorCode.NameAlreadyExists,
];

export const DESCRIPTION_ERROR_CODES: readonly CategoryErrorCode[] = [
  CategoryErrorCode.DescriptionRequired,
  CategoryErrorCode.DescriptionMaxLength,
];

/**
 * Fallo de negocio del flujo de categorías, que ya trae el texto a mostrar.
 * `code` es null cuando el backend envió algo que este dominio no conoce.
 */
export class CategoryError extends Error {
  constructor(
    message: string,
    readonly code: CategoryErrorCode | null = null,
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}
