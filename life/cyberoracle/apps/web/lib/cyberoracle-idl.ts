export const cyberoracleIdl = {
  address: "862LYnc3jZJ6bFmjyMjE9NMwehJaAe2Do5UbbEV1kbJU",
  version: "0.1.0",
  name: "cyberoracle",
  instructions: [
    {
      name: "requestOracle",
      accounts: [
        { name: "state", isMut: false, isSigner: false },
        { name: "counter", isMut: true, isSigner: false },
        { name: "request", isMut: true, isSigner: false },
        { name: "payer", isMut: true, isSigner: true },
        { name: "treasury", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [{ name: "promptHash", type: { array: ["u8", 32] } }]
    },
    {
      name: "fulfillOracle",
      accounts: [
        { name: "state", isMut: false, isSigner: false },
        { name: "request", isMut: true, isSigner: false },
        { name: "authority", isMut: false, isSigner: true }
      ],
      args: [
        { name: "resultUri", type: "string" },
        { name: "assetId", type: "publicKey" },
        { name: "collectionMint", type: "publicKey" }
      ]
    }
  ],
  accounts: [
    {
      name: "oracleState",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "treasury", type: "publicKey" },
          { name: "priceLamports", type: "u64" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "userCounter",
      type: {
        kind: "struct",
        fields: [
          { name: "user", type: "publicKey" },
          { name: "nextRequestId", type: "u64" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "oracleRequest",
      type: {
        kind: "struct",
        fields: [
          { name: "user", type: "publicKey" },
          { name: "requestId", type: "u64" },
          { name: "promptHash", type: { array: ["u8", 32] } },
          { name: "resultUri", type: "string" },
          { name: "assetId", type: "publicKey" },
          { name: "collectionMint", type: "publicKey" },
          { name: "fulfilled", type: "bool" },
          { name: "bump", type: "u8" }
        ]
      }
    }
  ]
} as const;
