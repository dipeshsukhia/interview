## GenAI and LLMs

### Tokens, context window, temperature, top-p. Why do outputs differ?
- Token: the unit a model reads and writes: a word piece, roughly 4 characters or 0.75 words of English. Cost, latency and limits are all measured in tokens.
- Context window: the maximum tokens (input plus output) the model can handle in one request.
- Temperature: scales randomness when sampling the next token. 0 is nearly deterministic; higher values flatten the probability distribution.
- Top-p (nucleus sampling): sample only from the smallest set of tokens whose cumulative probability reaches p (for example 0.9), cutting the unlikely tail.
Why the same prompt differs: the model samples from a probability distribution, so different tokens may be chosen; even at temperature 0, GPU floating-point non-determinism, batching, and silent model updates can change results. For extraction use temperature 0 to 0.2 and validate the output instead of assuming it is identical.
Follow-up: prompt exceeds the context window? The API returns an error, or (with some frameworks) silently truncates, which is worse because you lose the end of the document. Handle it explicitly: count tokens before sending (tiktoken or the provider's counter), chunk the document, extract per chunk or per section, then merge and reconcile; or summarize or retrieve only relevant parts. Reserve room for the output tokens too.

### System vs user prompt; reliable structured JSON; compare approaches?
System prompt: sets role, rules, output format and guardrails; it is the developer's instruction and is given higher priority. User prompt: the task input for this request (here, the document text). Keep untrusted document content in the user turn, clearly delimited, never in the system prompt.
Follow-up: JSON mode vs schema-constrained outputs vs tool calling:
Approach
Guarantee
Notes
Prompt only ('return JSON')
None
Fragile; needs repair and retry
JSON mode
Output is valid JSON
Does not guarantee your fields or types
Schema-constrained output (Structured Outputs)
Output conforms to a JSON Schema
Best for extraction; limited schema features; first call may have extra latency
Tool calling
Model fills arguments for a declared function schema
Works across providers (Claude, OpenAI, Gemini); good when the model also decides which action to take
For extraction I would generate the JSON Schema from the Pydantic model, use schema-constrained output or a single forced tool call, and still validate with Pydantic because a valid shape does not mean valid values (a date in the future, a total that does not match line items).

### Few-shot prompting?
What: include a few input and output examples in the prompt so the model copies the format, tone, and edge-case handling. It helps when instructions alone are ambiguous: unusual date formats, how to treat missing fields, or domain labels.
Example: two examples showing an invoice where tax is absent returning "tax": null, and one where totals use a European format 1.234,50 returning 1234.50.
Follow-up: picking examples without bias: cover diverse document layouts and edge cases rather than near-duplicates; balance classes and ordering (models over-weight the last example and the most common label); include negative or 'not present' examples; keep them short to save tokens; use synthetic or anonymized data; and measure on a held-out set that does not contain the examples. If examples are dynamic, retrieve the nearest ones by embedding similarity per document type.

### Hallucination; three ways to reduce it; detect it automatically?
Definition: the model produces fluent output that is not supported by the input or reality, for example inventing an invoice number that is not on the page.
Three ways to reduce it:
1.  Ground the model: give it the source text and instruct 'use only the document; if absent return null'. Use RAG when knowledge is external.
2.  Constrain outputs: schemas, enums, and null as a first-class answer; lower temperature.
3.  Verify: require evidence (page number and quoted span) for every extracted value, then programmatically check that the quote exists in the OCR text; add business-rule validation (line items sum to total).
Others: human review for low confidence, smaller scoped tasks, better OCR quality.
Follow-up: detect automatically: (a) substring or fuzzy match of each value against the source text; (b) cross-field rules (checksum, totals, date order); (c) self-consistency: run twice or with two models and flag disagreements; (d) an LLM-as-judge for faithfulness (with caveats, see Q19); (e) monitor the null rate and the 'value not found in source' rate in production.

### Designing function (tool) calling; bad arguments; infinite loops?
Design: define small, single-purpose tools with clear names, a precise description (the model reads it), a strict JSON Schema, and enums where possible. The orchestrator code executes the tool, never the model. Return concise, structured results.
tools = [{
  'name': 'lookup_vendor',
  'description': 'Find a vendor record by exact tax id. Returns null if not found.',
  'input_schema': {'type': 'object',
    'properties': {'tax_id': {'type': 'string', 'pattern': '^[0-9]{10}$'}},
    'required': ['tax_id']}
}]
Bad arguments: validate with Pydantic before executing; on failure return a tool error message to the model ('tax_id must be 10 digits') so it can correct itself; limit retries; never execute raw model output as SQL or shell commands; check authorization for the calling tenant on every tool call.
Follow-up: stop infinite loops: hard cap on iterations (for example 8 steps), a token and time budget, detect repeated identical calls (same tool and args twice) and break, give the model an explicit 'finish' action, and log the trace. On hitting the cap, fail gracefully with partial results and route to human review.

### MCP (Model Context Protocol)?
What and why: an open protocol (introduced by Anthropic) that standardizes how AI applications connect to external tools, data and prompts. Before MCP, each app needed custom integrations for each tool (N apps x M tools). With MCP, a tool provider writes one MCP server, and any MCP-capable client (Claude, IDEs, agents) can use it, like USB-C for AI integrations.
Follow-up: MCP tool vs plain function calling: function calling is a model capability: you pass schemas in the API request and your app executes them. MCP is a transport and discovery layer around that: a client connects to an MCP server, discovers its tools, resources and prompts dynamically at runtime, and routes calls to it (local via stdio or remote via HTTP). The model still uses function calling underneath. Trade-offs: MCP adds reuse and ecosystem, but also a security surface (untrusted servers, prompt injection through tool results, permission scoping), so allow-list servers and apply least privilege.

### You changed a prompt; how do you know it is better?
Method: build an evaluation set of representative and edge-case documents with ground-truth labels (golden dataset). Run old and new prompts on the same data with the same model settings. Compare per-field metrics (exact match, F1), null-handling, schema-failure rate, latency and cost. Check by document type (segments), because an overall gain may hide a regression in one segment. Use enough samples and look at confidence intervals; review the diffs manually for the biggest changes. Then shadow or canary in production.
Follow-up: risks of LLM-as-judge: position and verbosity bias (prefers longer or first answers), self-preference (favors outputs from the same model family), inconsistency between runs, inability to verify facts it cannot see, and cost. Mitigations: prefer deterministic comparison against ground truth for extraction; use judges only for fuzzy qualities; use a rubric, temperature 0, randomized order, and calibrate the judge against human-labeled samples.

### Versioning, testing and rolling out prompt changes?
- Version: keep prompts in Git (or a prompt registry like Langfuse) as templates with an id and version; log the prompt version with every request and result.
- Test: unit tests for rendering; golden-set regression evaluation in CI with thresholds; adversarial and prompt-injection cases.
- Roll out: feature flag or config, shadow mode (run the new prompt in parallel and compare without serving), then canary at 5 percent, monitor accuracy proxies, errors and cost, then full rollout, with one-click rollback to the previous version.
Follow-up: who may change a production prompt? Treat a prompt like code: change through a pull request, reviewed by an engineer and a domain owner, passing the evaluation gate, deployed by the pipeline; no editing in a console. Record who, why, and the eval result for audit.

### Provider rate limits, timeouts, slowness and outages?
- Rate limits (429): client-side throttling with a token-bucket or semaphore, respect Retry-After, queue the work (SQS) so bursts are smoothed, and request quota increases.
- Timeouts: set explicit connect and read timeouts, use streaming where it helps perceived latency, and keep per-step and total job deadlines.
- Slow responses: smaller prompts, a faster model tier, and parallelizing independent pages.
- Outages: circuit breaker, fallback to a second provider or model, and buffering jobs in the queue so nothing is lost; surface a 'delayed' status to customers.
Follow-up: retry storms and backoff with jitter: if every client retries immediately after a failure, they hammer the recovering service and prolong the outage. Exponential backoff waits 1s, 2s, 4s, 8s; jitter adds randomness so clients do not retry in lockstep.
delay = min(cap, base * 2**attempt)
sleep(random.uniform(0, delay))   # 'full jitter'
Also cap attempts, retry only transient errors (429, 5xx, timeouts, never 400), and use a retry budget plus circuit breaker.

### Choosing between OpenAI, Gemini and Claude; GenAI gateway?
Compare: task accuracy on your own golden dataset (most important), context length, vision and document capability, structured output support, latency, price per million tokens, rate limits and quotas, data residency and privacy terms (zero data retention, regional endpoints), SDK and tooling maturity, and reliability. Benchmarks are a starting point; always evaluate on your own documents.
Example: Gemini may win on very long documents and cost; Claude may win on careful instruction following and tables; OpenAI may be strongest in ecosystem tooling. Decide with a bake-off: same 200 documents, same schema, measure field F1, p95 latency and cost per document.
Follow-up: GenAI gateway: a single internal service (LiteLLM, a custom proxy, or a cloud gateway) in front of all providers. It provides a unified API, automatic fallback and routing, per-team budgets and rate limits, caching, central logging and redaction, key management, and easy model swaps without changing application code.

### The AI feature is too expensive and too slow; which levers?
1.  Measure first: tokens in and out per step, cost per document, p95 latency per stage.
2.  Shorter inputs: send only relevant pages or regions; strip headers and boilerplate; use text instead of images when OCR is good.
3.  Smaller or cheaper model for easy steps (classification, routing) and a larger model only for hard cases (model cascade).
4.  Prompt caching: place the static system prompt, schema and few-shot examples first so the provider caches that prefix, which cuts cost and latency on repeated calls.
5.  Batching: use the provider's batch API (often about 50 percent cheaper) for non-urgent workloads.
6.  Parallelism: process pages concurrently with a bounded semaphore.
7.  Limit output: concise schema, short field names, max_tokens.
8.  Cache results keyed by file hash to skip duplicates.

### Vision-language model vs OCR text?
VLM: a model that accepts images and text and reasons over both. Sending the page image lets it see layout, tables, checkboxes, stamps, signatures, handwriting and logos that plain OCR text loses or scrambles.
OCR text: cheaper, faster, auditable (you can verify quotes against the text), and has fewer tokens; but loses structure, and OCR errors propagate.
Follow-up: when does each win?
- OCR/text wins for clean digital documents with simple layouts, high volume, and when cost, latency and traceability matter.
- VLM wins for complex layouts, forms with checkboxes, tables with merged cells, handwriting, and poor scans where OCR is unreliable.
- Hybrid is usually best: OCR or parser text plus the page image for hard pages, routed by a quality or layout check.

### Autonomous agent vs deterministic workflow?
Use a deterministic workflow when the steps are known and repeatable, as in document extraction (classify, OCR, extract, validate, save). It is cheaper, faster, testable, auditable and predictable. Use an agent when the path cannot be predefined: open-ended research, investigating a discrepancy across systems, or tasks needing dynamic tool selection. A good pattern is a deterministic pipeline with a small bounded agentic step for hard cases (for example, 'resolve the ambiguous vendor name using up to three lookups').
Follow-up: context and memory in a long-running agent: keep a compact working state (task, plan, key findings) rather than the full transcript; summarize or compact old turns; store long-term facts externally (database or vector store) and retrieve on demand; offload large tool outputs to files and keep only references; checkpoint progress so the agent can resume; and enforce step, token and time budgets.
