export type ReceiptItem = {
  id: string;
  nameBn: string;
  quantity: string;
  /** Display amount, e.g. "৳ ১,২০০" (or "অস্পষ্ট" when unreadable). */
  price: string;
  /** Numeric taka amount, 0 when unreadable. */
  priceBdt?: number;
};

export type ReceiptSummary = {
  id: string;
  totalBdt: number;
  items: ReceiptItem[];
  /** Spoken one-line summary for the ListenButton. */
  summaryBn: string;
  /** True once the farmer has checked / corrected the items. */
  reviewed?: boolean;
  /** Printed total and the item sum disagree — prompt a closer look. */
  totalsMismatch?: boolean;
};

/** What the farmer confirms in the edit-before-save step. */
export type ReceiptReviewItem = {
  nameBn: string;
  quantity: string;
  priceBdt: number;
};
