import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideBan, LucideRotateCcw, LucideX } from '@lucide/angular';
import { Observable, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { notBlank } from '@shared/forms/not-blank.validator';
import {
  CreateCategoryUseCase,
  GetCategoryUseCase,
  UpdateCategoryUseCase,
} from '../../../application/category-use-cases';
import {
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  CATEGORY_TYPES,
  Category,
  CategoryType,
  isCategoryType,
} from '../../../domain/category';
import {
  CategoryError,
  CategoryErrorCode,
  DESCRIPTION_ERROR_CODES,
  NAME_ERROR_CODES,
  TYPE_ERROR_CODES,
} from '../../../domain/category-error';
import { CategoryWorkspace } from '../../category-workspace';

/** Estado del panel: listo para editar, cargando, sin categoría o con una categoría desactivada. */
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
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, LucideBan, LucideRotateCcw, LucideX],
  templateUrl: './category-panel.component.html',
})
export class CategoryPanelComponent {
  private readonly getCategory = inject(GetCategoryUseCase);
  private readonly createCategory = inject(CreateCategoryUseCase);
  private readonly updateCategory = inject(UpdateCategoryUseCase);
  private readonly workspace = inject(CategoryWorkspace);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly listUrl = LIST_URL;
  protected readonly nameMax = CATEGORY_NAME_MAX_LENGTH;
  protected readonly descriptionMax = CATEGORY_DESCRIPTION_MAX_LENGTH;
  /** Parámetros que interpolan los mensajes de longitud máxima. */
  protected readonly limits = { nameMax: CATEGORY_NAME_MAX_LENGTH, descriptionMax: CATEGORY_DESCRIPTION_MAX_LENGTH };
  protected readonly notFoundCode = CategoryErrorCode.NotFound;
  protected readonly types = CATEGORY_TYPES;

  /** Categoría en edición; `null` cuando se crea una nueva. Cambia si se pasa de una fila a otra. */
  protected readonly categoryId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.categoryId() !== null);
  /** La categoría tal como llegó del backend, para desactivarla o reactivarla y para el resumen de solo lectura. */
  protected readonly loaded = signal<Category | null>(null);

  protected readonly status = signal<PanelStatus>('ready');
  protected readonly loadError = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly formError = signal('');

  /** Si el pie del panel pide confirmar la desactivación. */
  protected readonly confirmingDeactivate = signal(false);
  /** Mientras se desactiva o se reactiva la categoría. */
  protected readonly isChangingStatus = signal(false);

  /** Errores que devolvió el backend para cada campo; se limpian al volver a escribir. */
  protected readonly nameServerError = signal<CategoryErrorCode | null>(null);
  protected readonly descriptionServerError = signal<CategoryErrorCode | null>(null);
  protected readonly typeServerError = signal<CategoryErrorCode | null>(null);

  protected readonly categoryForm = this.formBuilder.group({
    /** Solo se elige al crear; en edición se muestra pero el backend no permite cambiarlo. */
    type: this.formBuilder.control<CategoryType>('expense'),
    name: ['', [notBlank, Validators.maxLength(CATEGORY_NAME_MAX_LENGTH)]],
    description: ['', [notBlank, Validators.maxLength(CATEGORY_DESCRIPTION_MAX_LENGTH)]],
  });

  private readonly formValue = toSignal(this.categoryForm.valueChanges, { initialValue: this.categoryForm.getRawValue() });

  protected readonly nameLength = computed(() => this.formValue().name?.length ?? 0);
  protected readonly descriptionLength = computed(() => this.formValue().description?.length ?? 0);

  constructor() {
    this.categoryForm.controls.name.valueChanges.subscribe(() => this.nameServerError.set(null));
    this.categoryForm.controls.description.valueChanges.subscribe(() => this.descriptionServerError.set(null));
    this.categoryForm.controls.type.valueChanges.subscribe(() => this.typeServerError.set(null));

    // Al pasar de editar una fila a otra, Angular reutiliza el panel: se reinicia con cada id.
    this.route.paramMap
      .pipe(takeUntilDestroyed())
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
    const { name, description, type } = this.categoryForm.getRawValue();
    const request: Observable<Category> =
      id === null
        ? this.createCategory.execute({ name, description, type })
        : this.updateCategory.execute(id, { name, description });

    this.isSubmitting.set(true);
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (category) => {
        this.workspace.saved(category, id === null ? 'created' : 'updated');
        this.close();
      },
      error: (error: unknown) => this.handleSubmitError(error),
    });
  }

  protected askDeactivate(): void {
    this.formError.set('');
    this.confirmingDeactivate.set(true);
  }

  protected cancelDeactivate(): void {
    this.confirmingDeactivate.set(false);
  }

  protected confirmDeactivate(): void {
    const category = this.loaded();

    if (category) {
      this.changeStatus(this.workspace.deactivate(category));
    }
  }

  protected activate(): void {
    const category = this.loaded();

    if (category) {
      this.formError.set('');
      this.changeStatus(this.workspace.activate(category));
    }
  }

  /** Desactiva o reactiva y vuelve al listado, donde la categoría ya aparece en su nueva pestaña. */
  private changeStatus(request: Observable<Category>): void {
    this.isChangingStatus.set(true);
    request.pipe(finalize(() => this.isChangingStatus.set(false))).subscribe({
      next: () => this.close(),
      error: (error: unknown) => {
        this.confirmingDeactivate.set(false);

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
    this.confirmingDeactivate.set(false);
    this.formError.set('');
    this.typeServerError.set(null);
    this.categoryForm.reset({ name: '', description: '', type: this.initialType() });
    this.categoryForm.controls.type.enable({ emitEvent: false });

    if (id === null) {
      this.status.set('ready');
      return;
    }

    this.categoryForm.controls.type.disable({ emitEvent: false });

    this.load(id);
  }

  private load(id: number): void {
    this.status.set('loading');
    this.loadError.set('');

    this.getCategory.execute(id).subscribe({
      next: (category) => {
        this.loaded.set(category);
        this.categoryForm.reset({ name: category.name, description: category.description, type: category.type });
        // El backend solo edita categorías activas: una desactivada se consulta y se puede reactivar.
        this.status.set(category.isActive ? 'ready' : 'readOnly');
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
    } else if (code && TYPE_ERROR_CODES.includes(code)) {
      this.typeServerError.set(code);
    } else if (code === CategoryErrorCode.NotFound) {
      this.status.set('notFound');
    } else {
      this.formError.set(this.messageOf(error));
    }
  }

  /**
   * Tipo que se propone al crear: el de `?type=` (por ejemplo, al venir desde un movimiento),
   * que además muestra esa pestaña, o el de la pestaña visible.
   */
  private initialType(): CategoryType {
    const requested = this.route.snapshot.queryParamMap.get('type');

    if (isCategoryType(requested)) {
      this.workspace.tab.set(requested);
      return requested;
    }

    return this.workspace.proposedType();
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
