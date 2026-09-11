# SIPONGI internal endpoint contract

## Discovery status

Live discovery is not yet validated. On 11 September 2026, `sipongi.menlhk.go.id` returned `ERR_NAME_NOT_RESOLVED` from the available browser and build environment. No authentication or access-control bypass was attempted.

The worker therefore keeps the endpoint and query field names server-side and configurable. Before production activation, inspect the portal's own hotspot request in browser developer tools and update the environment values if its query names differ.

## Expected request

Default request shape:

```text
GET ${SIPONGI_ENDPOINT}?date=YYYY-MM-DD&page=1&per_page=1000
Accept: application/json
Authorization: ${SIPONGI_AUTHORIZATION} (optional, only when access is authorized)
```

The date is the current calendar day in `Asia/Jakarta`. Pagination stops at `pagination.last_page` with a hard safety limit of 100 pages.

## Expected response

```json
{
  "data": [
    {
      "id": "hotspot-id",
      "latitude": -2.14,
      "longitude": 113.91,
      "acquired_at": "2026-09-11T01:15:00+07:00",
      "confidence": "tinggi",
      "kabupaten": "Palangka Raya",
      "provinsi": "Kalimantan Tengah"
    }
  ],
  "pagination": { "page": 1, "last_page": 1 }
}
```

The checked-in fixture at `apps/api/src/providers/fixtures/sipongi.json` is the executable contract. If the observed portal response differs, update the adapter and fixture together, watch the contract test fail, then implement the new mapping.

Accepted confidence labels are `high`/`tinggi`, `nominal`/`medium`/`sedang`; low-confidence records are intentionally discarded.

## Production gate

Do not mark the SIPONGI source operational until:

1. The exact endpoint, query names, pagination, and response body are captured from an authorized public session.
2. The fixture matches that response with credentials and personal information removed.
3. `npm run test -w @nerv-geo/api` passes against the revised contract.
4. Attribution requirements and request frequency are confirmed with KLHK.
