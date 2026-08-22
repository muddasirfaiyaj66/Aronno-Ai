export type ReceiptItem = {
  id: string;
  nameBn: string;
  quantity: string;
  price: string;
};

export type ReceiptSummary = {
  id: string;
  totalBdt: number;
  items: ReceiptItem[];
  /** Spoken one-line summary for the ListenButton. */
  summaryBn: string;
};
