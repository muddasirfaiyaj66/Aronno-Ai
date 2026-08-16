export type ToolListing = {
  id: string;
  sourceName: string;
  thumbnailUrl: string;
  price?: string;
  externalUrl: string;
};

export type ToolResult = {
  id: string;
  toolNameBn: string;
  toolNameEn: string;
  reasonBn: string;
  listings: ToolListing[];
};

// TODO(nestjs): replace with a real tool-identification vision call
// (photo) or task-to-tool matching call (voice transcript).
export const MOCK_TOOL_RESULTS: ToolResult[] = [
  {
    id: "tool-1",
    toolNameBn: "ব্রাশ কাটার",
    toolNameEn: "Brush Cutter",
    reasonBn:
      "ঘাস ও ছোট ঝোপ হাতে কাটার চেয়ে অনেক কম সময়ে পরিষ্কার করা যায়।",
    listings: [
      {
        id: "tool-1-l1",
        sourceName: "দারাজ",
        thumbnailUrl: "",
        price: "৳ ৪,৫০০",
        externalUrl: "https://example.com/listing/brush-cutter-daraz",
      },
      {
        id: "tool-1-l2",
        sourceName: "স্থানীয় কৃষি দোকান",
        thumbnailUrl: "",
        price: "৳ ৪,২০০",
        externalUrl: "https://example.com/listing/brush-cutter-local",
      },
      {
        id: "tool-1-l3",
        sourceName: "বিক্রয় ডট কম",
        thumbnailUrl: "",
        externalUrl: "https://example.com/listing/brush-cutter-bikroy",
      },
    ],
  },
  {
    id: "tool-2",
    toolNameBn: "হ্যান্ড স্প্রেয়ার",
    toolNameEn: "Hand Sprayer",
    reasonBn: "ছোট জমিতে সঠিক মাত্রায় কীটনাশক স্প্রে করার জন্য উপযুক্ত।",
    listings: [
      {
        id: "tool-2-l1",
        sourceName: "দারাজ",
        thumbnailUrl: "",
        price: "৳ ৬৫০",
        externalUrl: "https://example.com/listing/sprayer-daraz",
      },
      {
        id: "tool-2-l2",
        sourceName: "স্থানীয় কৃষি দোকান",
        thumbnailUrl: "",
        price: "৳ ৫৮০",
        externalUrl: "https://example.com/listing/sprayer-local",
      },
    ],
  },
];

export function getToolResultById(id: string) {
  return MOCK_TOOL_RESULTS.find((result) => result.id === id);
}
