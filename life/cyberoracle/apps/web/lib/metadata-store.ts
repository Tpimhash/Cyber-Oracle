type StoredMetadata = Record<string, unknown>;

const store =
  (globalThis as { __cyberoracleMetadataStore?: Map<string, StoredMetadata> })
    .__cyberoracleMetadataStore ?? new Map<string, StoredMetadata>();

if (
  !(globalThis as { __cyberoracleMetadataStore?: Map<string, StoredMetadata> })
    .__cyberoracleMetadataStore
) {
  (globalThis as { __cyberoracleMetadataStore?: Map<string, StoredMetadata> })
    .__cyberoracleMetadataStore = store;
}

export const metadataStore = store;

export const putMetadata = (metadata: StoredMetadata) => {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  metadataStore.set(id, metadata);
  return id;
};

export const getMetadata = (id: string) => metadataStore.get(id);
