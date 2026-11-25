## API Security

### JWT authentication and API scopes?
How it works: the client authenticates with an identity provider (Cognito, Auth0, Okta) and receives a signed JWT (header.payload.signature) containing claims: iss, sub, aud, exp, scope, and custom claims such as tenant_id. The API verifies the signature with the provider's public key (JWKS) and checks claims; no database lookup is needed. Scopes (for example documents:read, documents:write) express permissions; endpoints require specific scopes.
Follow-up: validate on every request: (1) signature with the right algorithm (allow-list RS256/ES256; reject none); (2) exp and nbf (with small clock skew); (3) iss equals the expected issuer; (4) aud equals this API; (5) required scope for this endpoint; (6) take tenant_id from the token, never from the request body.
Common mistakes: accepting alg: none or letting the token choose the algorithm; not checking aud or iss; long-lived access tokens with no rotation; storing tokens in localStorage; putting sensitive data in the payload (it is only base64, not encrypted); no JWKS caching or key rotation handling; trusting a decoded but unverified token.

### Tenant isolation; enforcing in storage, queries, queues, caches; testing it?
Principle: tenant identity comes from the verified token, flows through every layer, and is enforced in depth (not only in application code).
- Storage (S3): per-tenant prefix s3://docs/{tenant_id}/...; the application never accepts a client-supplied key; IAM or session policies scoped to the prefix; optionally per-tenant KMS keys for strong isolation.
- Database: tenant_id in every key (DynamoDB partition key) and every query; for SQL, enforce with row-level security or a mandatory tenant filter in a repository layer; high-security tenants can get a separate table, schema or account.
- Queues: include tenant_id in the message and verify it against the job record; consider separate queues for large tenants to prevent noisy neighbors (and per-tenant concurrency limits).
- Caches: prefix keys with tenant_id; never cache responses without the tenant in the key.
- Return 404, not 403, for another tenant's resource so existence is not leaked.
Follow-up: test that tenant A cannot read tenant B's document: automated authorization tests: create documents as A and B, then attempt every read, list, download and delete endpoint with A's token against B's ids (expect 404); try path tampering and ID guessing; test with the pre-signed URL and cache paths; run these in CI for every endpoint; add a contract test that fails if a new repository method lacks a tenant parameter; and run periodic penetration testing and log audits.

### OWASP API risks for a document upload API?
- Broken object-level authorization (BOLA): always check that the job or document belongs to the caller's tenant.
- Broken authentication: correct JWT validation, short-lived tokens.
- Unrestricted resource consumption: limits on file size, page count, request rate (429), concurrent jobs per tenant, and processing time.
- Security misconfiguration: private buckets, no verbose errors, CORS correct, TLS.
- Unrestricted access to sensitive business flows: quotas to prevent abuse of expensive extraction.
- SSRF: do not fetch user-supplied URLs without an allow-list.
- Improper inventory management: version your APIs and retire old ones.
Follow-up: upload-specific: file type spoofing: check magic bytes, not the extension or the header; allow-list types. Zip bombs (and DOCX, which is a zip; PDF decompression bombs): cap the decompressed size, page count, image dimensions, and the time limit; process in a sandbox with CPU and memory limits. Malware scanning: ClamAV or a managed scanner before processing; quarantine bucket. Path traversal: never use the client filename for storage paths; generate server-side IDs; sanitize names for display. Size limits at the gateway and in the app. Also strip active content (PDF JavaScript, DOCX macros), and run converters (LibreOffice) in an isolated, network-less container.

### Avoiding sensitive data in logs and traces?
- Do not log payloads by default: log IDs, sizes, durations and statuses.
- Structured logging with allow-lists of fields rather than dumping objects or request bodies.
- Redaction: a logging filter and the observability agent's scrubbing rules mask patterns (card numbers, national IDs, emails, tokens, Authorization headers); mark Pydantic fields as SecretStr so they print masked.
- Tracing: do not put document text in span attributes; truncate or hash values.
- Sampling: sample debug-level logs and traces to reduce exposure and cost, but keep 100 percent of errors (with redacted context).
- Retention and access: short retention (for example 14 to 30 days), role-based access to logs, encryption, and audit access.
- Debug mode with payloads only in non-production with synthetic data, or time-boxed and approved with auto-expiry.
- Test it: unit tests with fake PII asserting it never appears in captured logs, and periodic log scans for patterns.
