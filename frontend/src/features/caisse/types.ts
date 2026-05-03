import type { PaymentMode } from '../facturation/types';

export interface CaisseModeAmountApi {
  mode: PaymentMode;
  amount: number;
  count: number;
}

export interface CaisseSummaryApi {
  date: string;
  total: number;
  count: number;
  byMode: CaisseModeAmountApi[];
  invoicesIssuedTotal: number;
  invoicesIssuedCount: number;
}
