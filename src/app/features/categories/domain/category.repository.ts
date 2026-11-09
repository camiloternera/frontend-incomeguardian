import { Observable } from 'rxjs';
import { Category, CategoryDraft, NewCategoryDraft } from './category';

/**
 * Puerto: cómo llega el dominio de categorías al backend. Se implementa en infrastructure.
 * Todo fallo llega como `CategoryError`.
 */
export abstract class CategoryRepository {
  /** Las categorías del usuario de todos los tipos, activas y desactivadas. */
  abstract list(): Observable<Category[]>;

  /** Una categoría del usuario por su identificador, aunque esté desactivada. */
  abstract get(id: number): Observable<Category>;

  /** Crea una categoría del tipo indicado. */
  abstract create(draft: NewCategoryDraft): Observable<Category>;

  /** Actualiza nombre y descripción; el tipo no se puede cambiar. */
  abstract update(id: number, draft: CategoryDraft): Observable<Category>;

  /** Desactiva una categoría activa y la devuelve con `isActive` en false. */
  abstract deactivate(id: number): Observable<Category>;

  /** Reactiva una categoría desactivada y la devuelve con `isActive` en true. */
  abstract activate(id: number): Observable<Category>;
}
