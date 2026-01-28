import type {
  MintCnftRequest,
  MintCnftResponse,
  OracleRequest,
  OracleResponse
} from "./api-types";

const postJson = async <T>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return (await res.json()) as T;
};

export const requestOracle = async (
  payload: OracleRequest
): Promise<OracleResponse> => postJson<OracleResponse>("/api/oracle", payload);

export const mintCnft = async (
  payload: MintCnftRequest
): Promise<MintCnftResponse> => postJson<MintCnftResponse>("/api/mint", payload);
