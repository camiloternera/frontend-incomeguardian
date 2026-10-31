import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Category, CategoryDraft, sortCategories } from '../domain/category';
import { CategoryRepository } from '../domain/category.repository';

function trimmed(draft: CategoryDraft): CategoryDraft {
  return { name: draft.name.trim(), description: draft.description.trim() };
}

@Injectable()
export class ListCategoriesUseCase {
  private readonly repository = inject(CategoryRepository);

  execute(): Observable<Category[]> {
    return this.repository.list().pipe(map(sortCategories));
  }
}

@Injectable()
export class GetCategoryUseCase {
  private readonly repository = inject(CategoryRepository);

  execute(id: number): Observable<Category> {
    return this.repository.get(id);
  }
}

@Injectable()
export class CreateCategoryUseCase {
  private readonly repository = inject(CategoryRepository);

  execute(draft: CategoryDraft): Observable<Category> {
    return this.repository.create(trimmed(draft));
  }
}

@Injectable()
export class UpdateCategoryUseCase {
  private readonly repository = inject(CategoryRepository);

  execute(id: number, draft: CategoryDraft): Observable<Category> {
    return this.repository.update(id, trimmed(draft));
  }
}

@Injectable()
export class DeleteCategoryUseCase {
  private readonly repository = inject(CategoryRepository);

  execute(id: number): Observable<void> {
    return this.repository.remove(id);
  }
}
