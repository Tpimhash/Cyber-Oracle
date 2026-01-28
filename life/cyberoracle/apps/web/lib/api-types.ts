export type MintCnftRequest = {
  user: string;
  requestId: string | number;
  promptHash: number[];
  resultUri: string;
  metadataUri: string;
  name?: string;
};

export type MintCnftResponse = {
  ok: boolean;
  assetId?: string;
  signature?: string;
  error?: string;
};

export type OracleRequest = {
  user: string;
  requestId: string | number;
  prompt: string;
  name?: string;
  locale?: string;
};

export type OracleResponse = {
  ok: boolean;
  oracleText?: string;
  promptHash?: number[];
  resultUri?: string;
  metadataUri?: string;
  assetId?: string;
  signature?: string;
  error?: string;
};
