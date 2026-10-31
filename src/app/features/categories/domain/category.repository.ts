import { Observable } from 'rxjs';
import { Category, CategoryDraft } from './category';

/**
 * Puerto: cómo llega el dominio de categorías al backend. Se implementa en infrastructure.
 * Todo fallo llega como `CategoryError`.
 */
export abstract class CategoryRepository {
  /** Categorías globales más las categorías propias activas del usuario. */
  abstract list(): Observable<Category[]>;

  /** Una categoría visible para el usuario por su identificador. */
  abstract get(id: number): Observable<Category>;

  /** Crea una categoría personal. */
  abstract create(draft: CategoryDraft): Observable<Category>;

  /** Actualiza una categoría personal activa. */
  abstract update(id: number, draft: CategoryDraft): Observable<Category>;

  /** El backend desactiva la categoría; deja de aparecer en `list`. */
  abstract remove(id: number): Observable<void>;
}
