/** Formas exactas en que las envía el backend. Nunca salen de esta capa. */
export interface AccountDto {
  id: number;
  name: string;
  initialBalance: number;
  /** Siempre null por ahora: el backend aún no calcula el saldo actual. */
  currentBalance: number | null;
  currency: string;
  isActive: boolean;
  /** Fecha y hora de apertura, en UTC. */
  openingDate: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface AccountRequestDto {
  name: string;
  initialBalance: number;
  currency: string;
  openingDate: string;
}
