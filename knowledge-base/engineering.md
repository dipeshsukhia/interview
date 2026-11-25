## Engineering Practice

### Blameless post-mortem outline?
Template (with an example):
1.  Summary: what happened and the customer impact. Example: 'On 12 March, 18 percent of documents failed for 47 minutes.'
2.  Impact: who and how much (tenants, documents, SLA breach, duration).
3.  Timeline (with timestamps): detection, triage, mitigation, resolution.
4.  Root cause: the technical and contributing factors. Example: a deploy lowered the memory limit so workers were OOMKilled on 300-page PDFs.
5.  Detection: how we found out (alert or a customer) and how it could be faster.
6.  What went well / what went poorly / where we got lucky.
7.  Action items with owners and due dates, categorized as prevent, detect, mitigate. Examples: an alert on OOMKilled restarts, a load test on large PDFs, page-count limit and streaming, a canary stage in the pipeline.
8.  Lessons learned.
What I changed afterwards: emphasize concrete engineering and process changes (an alert, a test, a guardrail, a runbook), the blameless framing (the system allowed the failure, not 'who did it'), and follow-through by tracking action items to completion.

### Using AI coding assistants responsibly; what to check; a wrong generated-code story?
Mindset: the assistant is a fast junior pair-programmer; I remain accountable for every line. I use it for boilerplate, tests, refactors, explanations and exploring options, and I do not paste secrets, customer data or proprietary code into tools that are not approved by the company.
What I check before accepting: (1) I understand every line and can explain it; (2) it matches the requirement and the codebase conventions; (3) edge cases and error handling; (4) security (input validation, injection, authorization, secrets, unsafe deserialization); (5) dependencies are real and appropriate (assistants sometimes invent packages or APIs, which is also a supply-chain risk); (6) performance (N+1 queries, blocking calls in async code); (7) tests: I run them, and I write or review tests independently; (8) linters and type checkers pass; (9) licensing and IP concerns.
Follow-up: tell me about generated code that was wrong and how you caught it (a model story you can adapt): 'An assistant generated an SQS worker that deleted the message at the start of processing, before the work finished. It looked clean and passed the happy-path test. In review I noticed that a crash mid-job would lose the document, because delete-before-processing removes the at-least-once safety net. I added a failure-injection test that kills the worker after receipt, moved the delete to after the result was saved, and made the handler idempotent. Lesson: I now ask assistants to list failure modes and I test those explicitly.' Use your own real example.

### Writing good prompts for a coding assistant; limiting scope; reviewing a large diff?
Good prompts: state the goal and the context (the stack, relevant files, conventions); give constraints (do not change public APIs, keep the style, no new dependencies); give the acceptance criteria and examples of inputs and outputs; ask for a plan first, then implementation in small steps; ask for tests; and specify what not to touch.
Example: 'In app/workers/extract.py add retry with exponential backoff and jitter for LLMRateLimitError only. Do not change the function signatures or any other file except tests/test_extract.py. Max 3 attempts. Add pytest tests using the existing mock_llm fixture. Show me the plan first.'
Keeping it from touching code it should not: narrow the scope in the prompt, work in a feature branch, use tools that restrict file access or require approval for edits, protect critical paths (CODEOWNERS, branch protection), review the diff file by file, and reject unrelated changes outright.
Follow-up: reviewing a large AI-generated diff: do not review it all at once: (1) ask for smaller commits (or split it); (2) read the tests first to understand intended behavior; (3) skim the file list for files that should not have changed; (4) review the risky parts in depth (auth, data access, concurrency, error handling, migrations); (5) run the code, tests and static analysis, and add a quick manual check; (6) use git diff --stat and look for unexpected deletions; (7) ask the assistant to explain tricky sections, and verify rather than trust the explanation.

### A production issue you owned from detection to fix (STAR structure)?
Structure your story (about 2 minutes):
- Situation: context and stakes (the system, the customers, the scale).
- Task: your specific role and ownership (not 'we').
- Action: detection (alert or customer), triage, hypotheses tested, mitigation (rollback or flag), root cause, the fix, and communication.
- Result: measurable outcome (downtime minutes, error rate restored, prevention).
- Learning: what you changed afterward (alerting, test, runbook, design).
Sample you can adapt: 'Our extraction service started returning intermittent 500s. A p95 latency alert fired at 2 a.m. I checked the dashboard: errors correlated with large PDFs and pods restarting with OOMKilled. I rolled back a release that had lowered memory limits as a quick mitigation (error rate returned to normal in 15 minutes), then found the root cause: the new code loaded all pages as images into memory at once. I changed it to a generator that processes pages one at a time with a bounded concurrency, added a load test with 300-page PDFs, and added an alert on OOMKilled restarts. Result: zero recurrences, and memory per job dropped about 70 percent.' Replace with your real details and numbers.

### Working with minimal supervision; a trade-off with incomplete information?
Structure: describe the ambiguity and why you could not wait; how you reduced uncertainty quickly (small experiment, spike, asking one targeted question, checking data); the options and their trade-offs; the decision and the reasoning; how you made it reversible (feature flag, small rollout); how you communicated the assumptions to stakeholders; and the outcome.
Sample: 'We needed to ship extraction for a new document type in two weeks with no labeled data. I could either build a rules-based parser (predictable, brittle) or use an LLM with a schema (flexible, needs evaluation). I created 30 labeled documents in a day, ran a quick bake-off, and chose the LLM approach with validation rules and a human-review fallback for low confidence. I documented the assumption (accuracy target 92 percent) and the plan to revisit after two weeks of production data. We launched on time with 94 percent on critical fields, and the review fallback caught the rest.'
Key signals interviewers look for: ownership, bias to action, timeboxing, explicit assumptions, risk containment, and follow-through.

### Explaining a technical trade-off to a non-technical stakeholder?
Method: start with the decision and the business impact, not the technology; use a simple analogy; give two or three options with cost, time, risk, and user impact; make a recommendation; be honest about uncertainty; and confirm understanding.
Example (accuracy vs cost vs speed): 'We have three ways to read scanned invoices. Option A (a basic OCR tool) is cheapest at about 2 cents per document and is fast, but gets about 88 percent of fields right, so staff must correct more. Option B (a premium AI model on every page) reaches about 96 percent, but costs about 15 cents per document and takes longer. Option C uses the cheap tool first and the premium model only when the system is unsure, giving about 95 percent accuracy at about 4 cents per document. I recommend Option C. The trade-off is slightly more complexity for us, which we can handle. If accuracy matters more than cost for a specific customer, we can switch that customer to B.'
Tips: avoid jargon (say 'backup path' not 'circuit breaker'), use numbers and customer impact, visualize with a simple table, and invite questions.

### Strongest areas, areas to ramp up, and how?
Structure: be honest, specific and evidence-based; show a learning plan with a timeline.
Template: 'My strongest areas are (1) Python backend and API design (FastAPI, async, Pydantic, testing), (2) asynchronous processing on AWS (SQS, S3, DynamoDB, idempotency and failure handling), and (3) production ownership: debugging, monitoring and incident response. I have built [your real example]. Where I would ramp up: [pick honestly, for example 'deep OCR and layout-parsing tuning', 'Terraform and Helm at your scale', 'LLM evaluation at large scale', or 'KEDA and EKS cluster operations'].'
Ramp-up plan: (1) First 2 weeks: read the architecture and runbooks, run the service locally, shadow on-call, and fix a small bug. (2) Weeks 3 to 6: own a small feature or an evaluation improvement end to end, pair with a domain expert, and study the golden dataset and failure categories. (3) By day 90: independently handle on-call and lead a design for an improvement (for example, a cost reduction or a new document type). Use hands-on labs, internal docs, code reviews, and regular feedback.
