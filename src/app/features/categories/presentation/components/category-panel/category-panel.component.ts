import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideLock, LucideTrash2, LucideX } from '@lucide/angular';
import { Observable, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { notBlank } from '@shared/forms/not-blank.validator';
import {
  CreateCategoryUseCase,
  GetCategoryUseCase,
  UpdateCategoryUseCase,
} from '../../../application/category-use-cases';
import { CATEGORY_DESCRIPTION_MAX_LENGTH, CATEGORY_NAME_MAX_LENGTH, Category } from '../../../domain/category';
import {
  CategoryError,
  CategoryErrorCode,
  DESCRIPTION_ERROR_CODES,
  NAME_ERROR_CODES,
} from '../../../domain/category-error';
import { CategoryWorkspace } from '../../category-workspace';

/** Estado del panel: listo para editar, cargando, sin categoría o con una categoría predefinida. */
type PanelStatus = 'ready' | 'loading' | 'notFound' | 'readOnly';

/** Códigos de error que pinta cada campo, según la validación del navegador o la respuesta del backend. */
interface FieldErrorCodes {
  required: CategoryErrorCode;
  maxLength: CategoryErrorCode;
}

const NAME_CODES: FieldErrorCodes = {
  required: CategoryErrorCode.NameRequired,
  maxLength: CategoryErrorCode.NameMaxLength,
};

const DESCRIPTION_CODES: FieldErrorCodes = {
  required: CategoryErrorCode.DescriptionRequired,
  maxLength: CategoryErrorCode.DescriptionMaxLength,
};

/** Ruta del listado, a la que vuelve el panel al cerrarse. */
const LIST_URL = '/categories';

/**
 * Panel para crear o editar una categoría junto a la lista (en mobile ocupa la pantalla).
 * Vive en una ruta hija del listado y le comunica los cambios mediante `CategoryWorkspace`.
 */
@Component({
  selector: 'app-category-panel',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, LucideLock, LucideTrash2, LucideX],
  templateUrl: './category-panel.component.html',
})
export class CategoryPanelComponent {
  private readonly getCategory = inject(GetCategoryUseCase);
  private readonly createCategory = inject(CreateCategoryUseCase);
  private readonly updateCategory = inject(UpdateCategoryUseCase);
  private readonly workspace = inject(CategoryWorkspace);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly listUrl = LIST_URL;
  protected readonly nameMax = CATEGORY_NAME_MAX_LENGTH;
  protected readonly descriptionMax = CATEGORY_DESCRIPTION_MAX_LENGTH;
  /** Parámetros que interpolan los mensajes de longitud máxima. */
  protected readonly limits = { nameMax: CATEGORY_NAME_MAX_LENGTH, descriptionMax: CATEGORY_DESCRIPTION_MAX_LENGTH };
  protected readonly notFoundCode = CategoryErrorCode.NotFound;

  /** Categoría en edición; `null` cuando se crea una nueva. Cambia si se pasa de una fila a otra. */
  protected readonly categoryId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.categoryId() !== null);
  /** La categoría tal como llegó del backend, para eliminarla con su nombre. */
  private readonly loaded = signal<Category | null>(null);

  protected readonly status = signal<PanelStatus>('ready');
  protected readonly loadError = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly formError = signal('');

  /** Si el pie del panel pide confirmar la eliminación. */
  protected readonly confirmingDelete = signal(false);
  protected readonly isDeleting = signal(false);

  /** Errores que devolvió el backend para cada campo; se limpian al volver a escribir. */
  protected readonly nameServerError = signal<CategoryErrorCode | null>(null);
  protected readonly descriptionServerError = signal<CategoryErrorCode | null>(null);

  protected readonly categoryForm = this.formBuilder.group({
    name: ['', [notBlank, Validators.maxLength(CATEGORY_NAME_MAX_LENGTH)]],
    description: ['', [notBlank, Validators.maxLength(CATEGORY_DESCRIPTION_MAX_LENGTH)]],
  });

  private readonly formValue = toSignal(this.categoryForm.valueChanges, { initialValue: this.categoryForm.getRawValue() });

  protected readonly nameLength = computed(() => this.formValue().name?.length ?? 0);
  protected readonly descriptionLength = computed(() => this.formValue().description?.length ?? 0);

  constructor() {
    this.categoryForm.controls.name.valueChanges.subscribe(() => this.nameServerError.set(null));
    this.categoryForm.controls.description.valueChanges.subscribe(() => this.descriptionServerError.set(null));

    // Al pasar de editar una fila a otra, Angular reutiliza el panel: se reinicia con cada id.
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => this.open(parseId(params.get('id'))));

    inject(DestroyRef).onDestroy(() => this.workspace.selectedId.set(null));

    // Lleva el foco al título para que el lector de pantalla anuncie el panel recién abierto.
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }

  /** Código a mostrar bajo el nombre: primero el del backend, luego el de la validación local. */
  protected nameError(): CategoryErrorCode | null {
    return this.nameServerError() ?? this.localError(this.categoryForm.controls.name, NAME_CODES);
  }

  /** Código a mostrar bajo la descripción: primero el del backend, luego el de la validación local. */
  protected descriptionError(): CategoryErrorCode | null {
    return this.descriptionServerError() ?? this.localError(this.categoryForm.controls.description, DESCRIPTION_CODES);
  }

  protected retry(): void {
    const id = this.categoryId();

    if (id !== null) {
      this.load(id);
    }
  }

  /** Escape cierra el panel, salvo que haya cambios sin guardar. */
  protected closeOnEscape(): void {
    if (!this.categoryForm.dirty) {
      this.close();
    }
  }

  protected close(): void {
    void this.router.navigateByUrl(LIST_URL);
  }

  protected submit(): void {
    this.formError.set('');

    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const id = this.categoryId();
    const draft = this.categoryForm.getRawValue();
    const request: Observable<Category> =
      id === null ? this.createCategory.execute(draft) : this.updateCategory.execute(id, draft);

    this.isSubmitting.set(true);
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (category) => {
        this.workspace.saved(category, id === null ? 'created' : 'updated');
        this.close();
      },
      error: (error: unknown) => this.handleSubmitError(error),
    });
  }

  protected askDelete(): void {
    this.formError.set('');
    this.confirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  protected confirmDelete(): void {
    const category = this.loaded();

    if (!category) {
      return;
    }

    this.isDeleting.set(true);
    this.workspace
      .remove(category)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => this.close(),
        error: (error: unknown) => {
          this.confirmingDelete.set(false);

          if (error instanceof CategoryError && error.code === CategoryErrorCode.NotFound) {
            this.status.set('notFound');
            return;
          }

          this.formError.set(this.messageOf(error));
        },
      });
  }

  /** Prepara el panel para crear (`null`) o para editar la categoría indicada. */
  private open(id: number | null): void {
    this.categoryId.set(id);
    this.workspace.selectedId.set(id);
    this.loaded.set(null);
    this.confirmingDelete.set(false);
    this.formError.set('');
    this.categoryForm.reset({ name: '', description: '' });

    if (id === null) {
      this.status.set('ready');
      return;
    }

    this.load(id);
  }

  private load(id: number): void {
    this.status.set('loading');
    this.loadError.set('');

    this.getCategory.execute(id).subscribe({
      next: (category) => {
        this.loaded.set(category);
        this.categoryForm.reset({ name: category.name, description: category.description });
        // Las categorías predefinidas solo se pueden consultar; el backend rechaza su edición.
        this.status.set(category.isGlobal ? 'readOnly' : 'ready');
      },
      error: (error: unknown) => {
        if (error instanceof CategoryError && error.code === CategoryErrorCode.NotFound) {
          this.status.set('notFound');
          return;
        }

        this.loadError.set(this.messageOf(error));
      },
    });
  }

  /** Ubica el error del backend junto a su campo; si no pertenece a ninguno, lo muestra en el formulario. */
  private handleSubmitError(error: unknown): void {
    const code = error instanceof CategoryError ? error.code : null;

    if (code && NAME_ERROR_CODES.includes(code)) {
      this.nameServerError.set(code);
    } else if (code && DESCRIPTION_ERROR_CODES.includes(code)) {
      this.descriptionServerError.set(code);
    } else if (code === CategoryErrorCode.NotFound) {
      this.status.set('notFound');
    } else {
      this.formError.set(this.messageOf(error));
    }
  }

  private localError(control: AbstractControl, codes: FieldErrorCodes): CategoryErrorCode | null {
    if (!control.touched || control.valid) {
      return null;
    }

    return control.hasError('maxlength') ? codes.maxLength : codes.required;
  }

  private messageOf(error: unknown): string {
    return error instanceof CategoryError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}

/** Convierte el parámetro de la ruta en un id entero, o `null` si no hay (crear). */
function parseId(raw: string | null): number | null {
  const id = raw === null ? NaN : Number(raw);

  return Number.isInteger(id) ? id : null;
}
