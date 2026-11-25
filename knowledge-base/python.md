## Python and FastAPI

### Synchronous vs asynchronous code; when to use async with an LLM API?
Core: Synchronous code blocks the thread until each operation finishes. Asynchronous code (asyncio) runs on one event loop; a coroutine pauses at await and lets other coroutines run while it waits for I/O. It helps with I/O-bound work, not CPU-bound work.
Why for LLM calls: A call to an LLM API spends 2 to 30 seconds waiting on the network. With sync code and a thread per request, you need many threads to handle concurrency. With async, one worker can hold hundreds of in-flight calls with little memory.
import asyncio, httpx

async def extract_page(client, page_text):
    r = await client.post(LLM_URL, json={'prompt': page_text}, timeout=60)
    r.raise_for_status()
    return r.json()

async def extract_document(pages):
    sem = asyncio.Semaphore(5)  # respect provider rate limits
    async with httpx.AsyncClient() as client:
        async def run(p):
            async with sem:
                return await extract_page(client, p)
        return await asyncio.gather(*(run(p) for p in pages))
Follow-up: blocking function inside async def? It freezes the whole event loop. Every other request on that worker stalls, health checks time out, and Kubernetes may restart the pod. Fixes: use an async library (httpx, aioboto3), wrap with asyncio.to_thread(...) or run_in_executor, or declare the endpoint as plain def so FastAPI runs it in a threadpool.

### Threads, processes and asyncio. CPU-heavy PDF parsing vs parallel LLM calls?
Tool
Best for
Limitation
Threads
Blocking I/O with sync libraries (boto3)
GIL limits CPU parallelism
Processes
CPU-bound work (PDF rendering, image preprocessing)
Memory cost, data must be pickled between processes
asyncio
Thousands of concurrent I/O waits
Needs async libraries; one blocking call hurts everyone
Choice: CPU-heavy PDF parsing or OCR preprocessing goes to a process pool (ProcessPoolExecutor) or separate worker pods. Many parallel LLM calls use asyncio with a semaphore.
Follow-up: GIL? The Global Interpreter Lock lets only one thread execute Python bytecode at a time in CPython. It matters for CPU-bound pure Python code in threads: 4 threads do not give 4x speed. It does not matter for I/O (the lock is released while waiting) or for C extensions that release it (PyMuPDF and NumPy often do). Note that Python 3.13 has an experimental free-threaded build, but production code still assumes the GIL.

### Design a FastAPI endpoint for document upload that returns an extraction result?
Design: For documents that take seconds to minutes, do not process inside the request. Accept, validate, store in S3, enqueue, and return a job id.
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends

ALLOWED = {'application/pdf', 'image/png', 'image/jpeg', 'image/tiff',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
MAX_BYTES = 50 * 1024 * 1024

@app.post('/v1/documents', status_code=202)
async def upload(file: UploadFile = File(...), user=Depends(auth)):
    if file.content_type not in ALLOWED:
        raise HTTPException(415, 'Unsupported media type')
    head = await file.read(2048); await file.seek(0)
    if not magic_matches(head, file.content_type):   # do not trust the header
        raise HTTPException(415, 'Content does not match type')
    job_id = await store_and_enqueue(file, user.tenant_id)
    return {'job_id': job_id, 'status': 'QUEUED', 'status_url': f'/v1/jobs/{job_id}'}

@app.get('/v1/jobs/{job_id}')
async def get_job(job_id: str, user=Depends(auth)):
    ...
Status codes:
- 202 vs 200: 202 Accepted when work is async (the normal case); 200 only if the result is returned synchronously for tiny files.
- 400/422: malformed request or schema validation failure.
- 401/403: missing or invalid token / no permission for this tenant.
- 413: file larger than the limit.
- 415: unsupported or spoofed file type.
- 429: rate limit exceeded; include Retry-After.
- 503: queue or storage unavailable; include Retry-After.
- 404 for another tenant's job (do not leak existence).

### What does Pydantic give over dicts? Validating LLM JSON?
Gives: Runtime type validation and coercion, required/optional semantics, constraints (regex, ranges), nested models, clear error messages, JSON Schema generation (useful for structured outputs and OpenAPI), and serialization.
from pydantic import BaseModel, Field, ValidationError
from datetime import date
from decimal import Decimal

class Invoice(BaseModel):
    invoice_number: str
    invoice_date: date | None = None
    total: Decimal = Field(ge=0)
    currency: str = Field(pattern=r'^[A-Z]{3}$')

try:
    inv = Invoice.model_validate_json(llm_text)
except ValidationError as e:
    errors = e.errors()
Follow-up: validation fails, what then? Use a tiered strategy: (1) cheap deterministic repair (strip markdown fences, fix trailing commas, coerce '1,234.50' to Decimal); (2) retry once or twice with the validation error fed back to the model ('field total must be a number; you returned N/A'); (3) reject and route to human review or mark the job FAILED_VALIDATION with the raw output saved for debugging. Never loop forever, and never silently accept invalid data.

### FastAPI dependency injection?
FastAPI resolves function parameters declared with Depends() per request, supports nesting, and handles cleanup with yield.
async def get_db():
    async with SessionLocal() as session:
        yield session            # closed after the request

async def current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    claims = verify_jwt(token)
    return await db.get(User, claims['sub'])

@app.get('/me')
async def me(user=Depends(current_user)):
    return user
Follow-up: overriding in tests:
app.dependency_overrides[current_user] = lambda: User(id='t1', tenant_id='tenantA')
client = TestClient(app)
# ... assertions ...
app.dependency_overrides.clear()
This lets you swap auth, the DB session, or the LLM client for fakes without patching modules.

### Testing code that calls a non-deterministic LLM?
Separate the layers:
- Unit tests (deterministic, run on every commit): mock the LLM client with canned responses. Test prompt construction, parsing, schema validation, retry logic, error handling, and routing. Assert on behavior, for example 'invalid JSON triggers exactly one retry'.
- Contract/property assertions on live responses: output parses against the schema, required fields are present, values are in allowed enums, dates are valid, totals equal the sum of line items, no PII leaked in the output, latency and token limits respected.
- Evaluations (scheduled or pre-release): run a golden dataset and compute per-field accuracy, precision, recall and F1. Compare against a baseline and fail the release if a metric regresses beyond a threshold.
Follow-up: what belongs where? Unit tests prove the code is correct given any model output. Evaluations measure whether the model and prompt are good enough. Never put flaky live-LLM calls in the PR gate; set temperature 0 and a fixed seed where supported, but still treat results as statistical.

### pytest fixtures, parametrization, mocking; when is mocking harmful?
import pytest

@pytest.fixture
def sample_pdf(tmp_path):
    p = tmp_path / 'a.pdf'; p.write_bytes(make_pdf()); return p

@pytest.mark.parametrize('raw,expected', [
    ('1,234.50', Decimal('1234.50')),
    ('$99', Decimal('99')),
    ('', None),
])
def test_parse_amount(raw, expected):
    assert parse_amount(raw) == expected

def test_retry_on_bad_json(mocker):
    llm = mocker.patch('app.llm.call', side_effect=['not json', '{"total": 5}'])
    assert extract('doc').total == 5 and llm.call_count == 2
When mocking is harmful: when the mock encodes your assumption rather than reality, so the test passes while production fails (for example, mocking S3 so a missing permission or wrong key format is never caught); when you mock internals so refactoring breaks tests without any behavior change; and when you over-mock so the test verifies the mocks. Prefer fakes at system boundaries only.
Follow-up: testing an SQS worker without real AWS: use moto (@mock_aws) to create a fake queue, send a message, run one iteration of the worker's process_message function, and assert on DynamoDB/S3 side effects. Alternatively use LocalStack in Docker for integration tests. Keep the polling loop thin and put logic in a pure function so it is easy to test.

### Generators, context managers, decorators in a document service?
- Generators: produce items lazily. Use for streaming pages: def iter_pages(pdf): for p in pdf: yield render(p) so a 300-page PDF never sits in memory all at once.
- Context managers: guarantee cleanup. Use for temp files, DB sessions, locks, and timing: with tempfile.TemporaryDirectory() as d: or a custom @contextmanager that logs job start and end.
- Decorators: cross-cutting behavior. Use for retry with backoff, timing metrics, auth checks, caching, and idempotency guards.
def retry(times=3):
    def deco(fn):
        @functools.wraps(fn)
        async def wrapper(*a, **kw):
            for i in range(times):
                try: return await fn(*a, **kw)
                except TransientError:
                    if i == times - 1: raise
                    await asyncio.sleep(2**i + random.random())
        return wrapper
    return deco
Follow-up: stream a 500 MB file without loading it: read in chunks (for example 8 MB) and write each chunk to S3 using multipart upload, or stream with boto3 upload_fileobj. In FastAPI use UploadFile (spooled to disk) and await file.read(chunk_size) in a loop. For downloads, StreamingResponse with a generator. Better still, let the client upload directly to S3 via a pre-signed URL so the API never touches the bytes.

### Dependencies, virtual environments, type checking?
Practice: one isolated environment per project (uv, venv, or Poetry); pin dependencies with a lock file (uv.lock, poetry.lock) so builds are reproducible; separate runtime and dev dependencies; automated updates (Dependabot/Renovate) plus pip-audit for CVEs; run ruff (lint and format) and mypy or pyright in CI.
Follow-up: what do mypy/pyright catch that tests do not? Whole classes of mistakes on paths no test executes: passing str | None where str is required (the classic None-attribute error), wrong argument types, missing return branches, misspelled attributes, and breaking changes in a function signature across the entire codebase. Tests prove selected inputs work; types prove structural consistency everywhere.

### Idempotency for a REST API that triggers expensive work?
Idea: the same request sent twice (client retry, network timeout) must have the same effect as sending it once, so you never pay twice for OCR and LLM work or create duplicate jobs.
Design: the client sends an Idempotency-Key header. The server stores (tenant_id, key) -> job_id, request_hash, status with a unique constraint (a DynamoDB conditional write or a unique DB index). On the first request, create the job. On a repeat with the same key and same body hash, return the original response. With the same key but a different body, return 409/422.
Idempotency key for an upload: the client generates a UUID per logical upload attempt; alternatively derive a natural key from tenant_id + SHA-256(file bytes) + extraction_profile, which also gives free de-duplication. Expire keys after 24 hours with a TTL.
