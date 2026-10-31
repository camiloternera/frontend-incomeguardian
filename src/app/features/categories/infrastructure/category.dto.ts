/** Formas exactas en que las envía el backend. Nunca salen de esta capa. */
export interface CategoryDto {
  id: number;
  name: string;
  description: string;
  isGlobal: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface CategoryRequestDto {
  name: string;
  description: string;
}
