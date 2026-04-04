export interface FacturamaRequest {
  Type: string;
  CfdiType: string;
  ExpeditionPlace: string;
  PaymentForm: string;
  PaymentMethod: string;
  Currency: string;
  Issuer: {
    Rfc: string;
    Name: string;
    FiscalRegime: string;
  };
  Receiver: {
    Id?: string;
    Rfc: string;
    Name: string;
    FiscalRegime: string;
    CfdiUse: string;
    TaxZipCode: string;
  };
  Items: FacturamaItem[];
}

export interface FacturamaItem {
  ProductCode: string;
  Description: string;
  UnitCode: string;
  Quantity: number;
  UnitPrice: number;
  Subtotal: number;
  TaxObject: string;
  Taxes: {
    Total: number;
    Name: string;
    Base: number;
    Rate: number;
    IsRetention: boolean;
    Type: string;
  }[];
  Total: number;
}
