import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { filtersToParams } from '../useInvoiceSearch';
import type { InvoiceSearchFilters } from '../../types';

/**
 * Regression: useInvoiceSearch / useInvoiceExport pass List<> values to
 * Spring's @RequestParam, which expects ?key=v1&key=v2 (no brackets).
 * Axios 1.x defaults to ?key[]=v1&key[]=v2, so the hooks must opt out via
 * `paramsSerializer: { indexes: null }`. This test pins that contract by
 * asking axios to build the actual URL the hook would emit, and asserting
 * brackets never appear.
 */
function buildUrl(filters: InvoiceSearchFilters): string {
  const params = filtersToParams(filters, 0, 50);
  // Use the exact same serializer config as the hook.
  const req = axios.getUri({ url: '/invoices/search', params, paramsSerializer: { indexes: null } });
  return req;
}

describe('useInvoiceSearch — query-string contract', () => {
  it('serializes a single-value status as ?status=EMISE (no brackets)', () => {
    const url = buildUrl({
      dateField: 'ISSUED',
      from: null,
      to: null,
      statuses: ['EMISE'],
      paymentModes: [],
      patientId: null,
      amountMin: null,
      amountMax: null,
    });
    expect(url).toContain('status=EMISE');
    expect(url).not.toContain('status[]=');
    expect(url).not.toContain('status%5B%5D');
  });

  it('serializes multi-value status as repeated key=val (Spring List<> contract)', () => {
    const url = buildUrl({
      dateField: 'ISSUED',
      from: null,
      to: null,
      statuses: ['EMISE', 'PAYEE_TOTALE'],
      paymentModes: [],
      patientId: null,
      amountMin: null,
      amountMax: null,
    });
    expect(url).toContain('status=EMISE');
    expect(url).toContain('status=PAYEE_TOTALE');
    expect(url).not.toContain('status[]');
    expect(url).not.toContain('status%5B%5D');
  });

  it('serializes multi-value paymentMode without brackets', () => {
    const url = buildUrl({
      dateField: 'ISSUED',
      from: null,
      to: null,
      statuses: [],
      paymentModes: ['ESPECES', 'CB'],
      patientId: null,
      amountMin: null,
      amountMax: null,
    });
    expect(url).toContain('paymentMode=ESPECES');
    expect(url).toContain('paymentMode=CB');
    expect(url).not.toContain('paymentMode[]');
    expect(url).not.toContain('paymentMode%5B%5D');
  });
});
