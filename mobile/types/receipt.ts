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

// TODO(nestjs): replace with a real receipt-OCR call.
export const MOCK_RECEIPT_SUMMARIES: ReceiptSummary[] = [
  {
    id: "receipt-1",
    totalBdt: 3200,
    items: [
      { id: "receipt-1-i1", nameBn: "ইউরিয়া সার", quantity: "২ ব্যাগ", price: "৳ ২,০০০" },
      { id: "receipt-1-i2", nameBn: "কীটনাশক", quantity: "১ বোতল", price: "৳ ৮০০" },
      { id: "receipt-1-i3", nameBn: "বীজ", quantity: "৫ কেজি", price: "৳ ৪০০" },
    ],
    summaryBn: "মোট ৩,২০০ টাকা খরচ হয়েছে, যার মধ্যে সার ২,০০০ টাকা।",
  },
  {
    id: "receipt-2",
    totalBdt: 1450,
    items: [
      { id: "receipt-2-i1", nameBn: "জৈব সার", quantity: "১ বস্তা", price: "৳ ৯৫০" },
      { id: "receipt-2-i2", nameBn: "গ্লাভস", quantity: "১ জোড়া", price: "৳ ৫০" },
      { id: "receipt-2-i3", nameBn: "কাস্তে", quantity: "১টি", price: "৳ ৪৫০" },
    ],
    summaryBn: "মোট ১,৪৫০ টাকা খরচ হয়েছে, যার মধ্যে জৈব সার ৯৫০ টাকা।",
  },
];

export function getReceiptSummaryById(id: string) {
  return MOCK_RECEIPT_SUMMARIES.find((summary) => summary.id === id);
}
