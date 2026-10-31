import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideLock } from '@lucide/angular';
import { Observable, finalize } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import { ThemeService } from '@core/theme/theme.service';
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
import { CategoriesHeaderComponent } from '../../components/categories-header.component';
import { CategoryNoticeState } from '../../category-notice';
import { notBlank } from '../../validators/not-blank.validator';

/** Estado de la vista: listo para editar, cargando, sin categoría o con una categoría predefinida. */
type FormStatus = 'ready' | 'loading' | 'notFound' | 'readOnly';

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

@Component({
  selector: 'app-category-form-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, CategoriesHeaderComponent, LucideLock],
  templateUrl: './category-form-page.component.html',
  styleUrls: ['./category-form-page.component.css'],
})
export class CategoryFormPageComponent {
  private readonly getCategory = inject(GetCategoryUseCase);
  private readonly createCategory = inject(CreateCategoryUseCase);
  private readonly updateCategory = inject(UpdateCategoryUseCase);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly theme = inject(ThemeService).theme;
  protected readonly nameMax = CATEGORY_NAME_MAX_LENGTH;
  protected readonly descriptionMax = CATEGORY_DESCRIPTION_MAX_LENGTH;
  /** Parámetros que interpolan los mensajes de longitud máxima. */
  protected readonly limits = { nameMax: CATEGORY_NAME_MAX_LENGTH, descriptionMax: CATEGORY_DESCRIPTION_MAX_LENGTH };
  protected readonly notFoundCode = CategoryErrorCode.NotFound;

  /** Identificador de la categoría en edición; `null` cuando se crea una nueva. */
  protected readonly categoryId = this.readId();
  protected readonly isEdit = this.categoryId !== null;

  protected readonly status = signal<FormStatus>(this.isEdit ? 'loading' : 'ready');
  protected readonly loadError = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly formError = signal('');

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

    if (this.categoryId !== null) {
      this.load(this.categoryId);
    }
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
    if (this.categoryId !== null) {
      this.load(this.categoryId);
    }
  }

  protected submit(): void {
    this.formError.set('');

    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const draft = this.categoryForm.getRawValue();
    const request: Observable<Category> =
      this.categoryId === null
        ? this.createCategory.execute(draft)
        : this.updateCategory.execute(this.categoryId, draft);

    this.isSubmitting.set(true);
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (category) => {
        const state: CategoryNoticeState = {
          notice: { kind: this.isEdit ? 'updated' : 'created', name: category.name },
        };
        void this.router.navigate(['/categories'], { state });
      },
      error: (error: unknown) => this.handleSubmitError(error),
    });
  }

  private load(id: number): void {
    this.status.set('loading');
    this.loadError.set('');

    this.getCategory.execute(id).subscribe({
      next: (category) => {
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

  private readId(): number | null {
    const raw = inject(ActivatedRoute).snapshot.paramMap.get('id');
    const id = raw === null ? NaN : Number(raw);

    return Number.isInteger(id) ? id : null;
  }

  private messageOf(error: unknown): string {
    return error instanceof CategoryError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
