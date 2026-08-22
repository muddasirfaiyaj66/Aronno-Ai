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
