
export type Payer = '桓' | '妍' | '平分';

export interface ReceiptItem {
  id: string;
  name: string;
  amount: number;
  payer: Payer;
}

export interface CalculationResult {
  huanTotal: number;
  yanTotal: number;
  total: number;
}

export interface SettlementRecord {
  id: string;
  date: string; // Format: YYYY-MM-DD
  huanTotal: number;
  yanTotal: number;
  grandTotal: number;
  itemCount: number;
  items: ReceiptItem[]; // Added to store details for history viewing
}
