/** Formas exactas en que las envía el backend. Nunca salen de esta capa. */
export interface CategoryDto {
  id: number;
  name: string;
  description: string;
  /** 1 Ingreso, 2 Gasto, 3 Transferencia. */
  transactionTypeId: number;
  transactionTypeName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/** Cuerpo de `POST /api/v1/categories`. */
export interface CreateCategoryRequestDto {
  name: string;
  description: string;
  transactionTypeId: number;
}

/** Cuerpo de `PUT /api/v1/categories/{id}`: el tipo no es editable. */
export interface UpdateCategoryRequestDto {
  name: string;
  description: string;
}
