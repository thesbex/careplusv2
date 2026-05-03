export interface PrestationApi {
  id: string;
  code: string;
  label: string;
  defaultPrice: number;
  active: boolean;
  sortOrder: number;
}

export interface ConsultationPrestationApi {
  id: string;
  consultationId: string;
  prestationId: string;
  prestationCode: string;
  prestationLabel: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes: string | null;
}

export interface AddPrestationPayload {
  prestationId: string;
  unitPrice?: number | null;
  quantity?: number | null;
  notes?: string | null;
}
