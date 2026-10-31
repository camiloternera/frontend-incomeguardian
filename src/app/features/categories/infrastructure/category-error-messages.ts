import { CATEGORY_DESCRIPTION_MAX_LENGTH, CATEGORY_NAME_MAX_LENGTH } from '../domain/category';
import { CategoryErrorCode } from '../domain/category-error';

/** Cada código conocido del backend para categorías, asociado a su clave de traducción. */
export const CATEGORY_ERROR_KEYS: Record<string, string> = Object.fromEntries(
  Object.values(CategoryErrorCode).map((code) => [code, `categories.errors.${code}`]),
);

/** Valores que interpolan los mensajes de longitud, para que el texto no fije los límites a mano. */
export const CATEGORY_ERROR_PARAMS = {
  nameMax: CATEGORY_NAME_MAX_LENGTH,
  descriptionMax: CATEGORY_DESCRIPTION_MAX_LENGTH,
};
