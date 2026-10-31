/** Formas exactas en que las envía el backend. Nunca salen de esta capa. */
export interface AccountDto {
  id: number;
  name: string;
  accountType: { id: number; name: string };
  initialBalance: number;
  /** Siempre null por ahora: el backend aún no calcula el saldo actual. */
  currentBalance: number | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface AccountRequestDto {
  name: string;
  accountTypeId: number;
  initialBalance: number;
  currency: string;
}

/** Lo que este dominio lee de `GET /api/v1/account-types`; ignora el resto de campos. */
export interface AccountTypeOptionDto {
  id: number;
  name: string;
}
