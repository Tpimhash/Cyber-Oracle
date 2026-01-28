# API

## POST /api/mint

Request body:

```json
{
  "user": "<wallet pubkey>",
  "requestId": 0,
  "promptHash": [32 bytes],
  "resultUri": "https://.../result.json",
  "metadataUri": "https://.../metadata.json",
  "name": "CyberOracle"
}
```

Response:

```json
{
  "ok": true,
  "assetId": "<cnft asset id>",
  "signature": "<tx sig>"
}
```

## POST /api/oracle

Request body:

```json
{
  "user": "<wallet pubkey>",
  "requestId": 0,
  "prompt": "Ask the oracle...",
  "name": "CyberOracle",
  "locale": "zh"
}
```

Response:

```json
{
  "ok": true,
  "oracleText": "...",
  "promptHash": [32 bytes],
  "resultUri": "https://.../metadata.json",
  "metadataUri": "https://.../metadata.json",
  "assetId": "<cnft asset id>",
  "signature": "<tx sig>"
}
```

## Frontend helpers

See `apps/web/lib/api.ts` for typed client helpers.
