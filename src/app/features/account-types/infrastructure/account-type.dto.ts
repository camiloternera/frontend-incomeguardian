/** Formas exactas en que las envía el backend. Nunca salen de esta capa. */
export interface AccountTypeDto {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface AccountTypeRequestDto {
  name: string;
  description: string;
}
