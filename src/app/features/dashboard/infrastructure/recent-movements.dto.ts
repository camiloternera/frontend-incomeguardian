/** Un ítem de `GET /api/v1/dashboard/recent`. */
export interface RecentMovementDto {
  id: number;
  type: string;
  /** Instante ISO 8601 en UTC. */
  date: string;
  description: string | null;
  amount: number;
  currency: string;
  categoryName: string | null;
  isCardPayment: boolean | null;
  /** 1 si no es una compra a cuotas. */
  installmentCount: number | null;
  fromAccountName: string | null;
  toAccountName: string | null;
  destinationAmount: number | null;
  destinationCurrency: string | null;
}
