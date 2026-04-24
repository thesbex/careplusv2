export type InvoiceStatus =
  | 'BROUILLON'
  | 'EMISE'
  | 'PAYEE_PARTIELLE'
  | 'PAYEE_TOTALE'
  | 'ANNULEE';

export type PaymentMode = 'ESPECES' | 'CHEQUE' | 'CB' | 'VIREMENT' | 'TIERS_PAYANT';

export interface InvoiceLineApi {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PaymentApi {
  id: string;
  amount: number;
  mode: PaymentMode;
  reference: string | null;
  paidAt: string;
}

export interface InvoiceApi {
  id: string;
  patientId: string;
  consultationId: string | null;
  status: InvoiceStatus;
  number: string | null;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  lines: InvoiceLineApi[];
  payments: PaymentApi[];
  mutuelleInsuranceName: string | null;
  issuedAt: string | null;
  createdAt: string;
}

export interface InvoiceLineDraft {
  description: string;
  quantity: number;
  unitPrice: number;
}

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  BROUILLON: 'Brouillon',
  EMISE: 'Émise',
  PAYEE_PARTIELLE: 'Payée partielle',
  PAYEE_TOTALE: 'Payée',
  ANNULEE: 'Annulée',
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  CB: 'Carte bancaire',
  VIREMENT: 'Virement',
  TIERS_PAYANT: 'Tiers payant',
};
