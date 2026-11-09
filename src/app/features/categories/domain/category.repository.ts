import { Observable } from 'rxjs';
import { Category, CategoryDraft, NewCategoryDraft } from './category';

/**
 * Puerto: cómo llega el dominio de categorías al backend. Se implementa en infrastructure.
 * Todo fallo llega como `CategoryError`.
 */
export abstract class CategoryRepository {
  /** Las categorías activas del usuario, de todos los tipos. */
  abstract list(): Observable<Category[]>;

  /** Una categoría del usuario por su identificador. */
  abstract get(id: number): Observable<Category>;

  /** Crea una categoría del tipo indicado. */
  abstract create(draft: NewCategoryDraft): Observable<Category>;

  /** Actualiza nombre y descripción; el tipo no se puede cambiar. */
  abstract update(id: number, draft: CategoryDraft): Observable<Category>;

  /** El backend desactiva la categoría; deja de aparecer en `list`. */
  abstract remove(id: number): Observable<void>;
}
