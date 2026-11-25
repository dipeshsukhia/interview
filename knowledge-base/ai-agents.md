## AI Agents

### Explain the ReAct pattern. How does it differ from a plain LLM call or a fixed chain?
ReAct alternates reasoning, tool calls, and observations until it has enough evidence to respond. A plain call answers once; a fixed chain follows predetermined steps.

### How do you stop an agent from looping forever?
Cap model steps, elapsed time, and repeated identical tool calls. Return a bounded fallback or handoff when the budget is exhausted.

**Preparation points:** max iterations, recursion limits, loop detection, timeouts, fallback to escalation.

### What happens when a tool returns an error or malformed output?
Validate the error as data, decide whether it is transient, retry within a small budget, and return a clear failure or escalation if recovery fails.

**Preparation points:** feed the error back to the model, retry with backoff, cap retries, escalate.

### When would you pick a ReAct agent over a deterministic workflow?
Choose ReAct when the next step depends on discoveries made during the task. Use a deterministic workflow when the sequence is known and repeatability matters.

### What are nodes, edges, conditional edges, and state in LangGraph?
Nodes perform steps, edges connect them, conditional edges choose a next node, and state carries the data shared between steps. Keep state typed and explicit.

### Why use a graph instead of one big prompt with tools?
A graph makes branching, retries, checkpoints, and human pauses visible and testable. One large prompt hides control flow inside model behavior.

### How do you design state so it stays debuggable as the graph grows?
Keep state small, typed, and versioned. Store authoritative facts separately from conversational summaries and define how concurrent node updates merge.

### Your graph is thousands of lines. How would you keep it maintainable?
Split large graphs into subgraphs and focused node modules. Name state transitions, document invariants, and test each node and routing rule independently.

### How do you unit test a single node or a routing condition?
Call the node with a minimal fixture state and mocked dependencies, then assert its state update. Test routing with edge-case states without invoking a live model.

### Why route model calls through a gateway instead of calling the provider directly?
A gateway centralizes provider authentication, quotas, logging, privacy controls, model routing, and cost attribution. Applications then use one controlled integration point.

### How would you add fallback models or retries at the gateway level?
Retry only transient errors with capped exponential backoff and jitter. Route to a fallback model only if its schema, quality, privacy, and cost meet the task's requirements.

### How do you handle provider outages and rate-limit errors (429s)?
Respect Retry-After for 429s, queue excess work, and use a circuit breaker during outages. Surface delayed status rather than multiplying retries across services.

### How does function calling work under the hood?
The model emits a structured tool name and arguments; trusted application code validates and executes it, then returns the result to the model. The model never directly runs privileged code.

### Why bind only a subset of tools to the model?
Expose only tools needed for the current task and user. This reduces token use, wrong selections, and the attack surface.

**Preparation points:** fewer wrong choices, lower token cost, tighter security.

### What makes a good tool description and schema?
Describe when the tool should be used, provide a narrow typed schema, and state important side effects. Validate arguments in code even when the model claims compliance.

### What is a tool policy check, and what bug does validating prompts against registered schemas prevent?
A policy check compares the requested tool, arguments, and user permissions against an allowlist. It prevents prompts or model output from invoking an unregistered or unauthorized operation.

### How do you handle parallel tool calls?
Run independent calls concurrently with bounded concurrency; serialize calls that share mutable state. Preserve call IDs and match each result to the originating request.

### What problem does MCP solve? How is it different from a normal REST API or plain function calling?
MCP standardizes discovery and invocation of tools, resources, and prompts across clients. A REST API is an application interface; function calling is a model behavior that an MCP client can bridge to.

### Compare the MCP transports: stdio vs. streamable HTTP/SSE. Why HTTP for a server-side product?
Stdio suits a local client launching a server process. Streamable HTTP supports remote services, central authentication, and shared deployment; older SSE transport patterns may still appear in integrations.

### What are the three MCP primitives?
MCP exposes tools for actions, resources for readable context, and prompts for reusable workflows. A client discovers only what the server makes available.

### How do you secure an MCP server?
Authenticate callers, authorize every tool separately, validate inputs, and limit output. Treat tool descriptions and results as untrusted content that can contain prompt injection.

### Why would an agent use tool search instead of loading every tool definition?
Search or select tool definitions when the catalog is large so the model sees only relevant schemas. Enforce a server-side allowlist after discovery.

**Preparation points:** token cost, accuracy drops with many tools.

### How do you enforce that the model can only call allowed tools, even if it hallucinates a tool name?
Check every call against a trusted registry and the current user's rights; reject unknown names even if the model writes a plausible schema.

### Why does "exact invocation" matter after discovery?
Discovery identifies a particular callable capability. Execute that exact registered tool and validated arguments, not a similarly named or model-invented replacement.

### What are the ways to get reliable JSON from an LLM?
Prefer provider structured output or tool-call schemas, then validate with a local schema such as Pydantic. Handle refusals, partial output, and schema failures explicitly.

### What do you do when validation fails?
Return validation errors for a bounded repair attempt, then use a safe fallback or human review. Never silently accept malformed data for consequential actions.

### Why use specialist structured calls (intent, emergency classification) instead of one big prompt?
Use small, typed calls for high-stakes decisions so each classification has its own schema, tests, and threshold. A large prompt can hide which decision failed.

### Why split prompts into modules chosen by application state?
Select prompt modules based on workflow state so the model receives only relevant policy and context. Keep the final instruction hierarchy clear and inspect the assembled prompt.

### How do you version and test prompts?
Store prompts in version control, evaluate them on fixed cases, and record prompt versions with traces. Roll out through a flag with rollback available.

### What are the risks of dynamically assembled prompts?
Dynamic assembly can omit required constraints, introduce conflicting instructions, or exceed token budgets. Validate required modules and order before calling the model.

### Walk me through a RAG pipeline end to end.
Ingest and clean documents, chunk them, embed and index them, retrieve candidates, optionally rerank, then generate an answer grounded in cited evidence.

### Why treat retrieved documents as untrusted context?
Retrieved text is data from an untrusted source. Delimit it and never let instructions within it override the application's rules or permissions.

**Preparation points:** indirect prompt injection. Delimit them and never let them override system instructions.

### How do you pick chunk size and overlap? How do you evaluate retrieval quality?
Choose chunks that preserve semantic units and evaluate on real questions. Measure retrieval recall and ranking quality separately from answer faithfulness.

### Hybrid search (BM25 + vectors) vs. vector-only. When does each win?
Keyword search excels at exact terms and identifiers; vectors help with semantic paraphrases. Hybrid retrieval often combines both, followed by reranking.

### What does "scoped" retrieval mean, and why do it?
Filter retrieval by tenant and access rights before ranking or generation. A relevant document is still unusable if the current user may not read it.

**Preparation points:** tenant or property isolation, access control.

### What are the risks of letting an agent fetch arbitrary URLs?
Arbitrary fetching can reach internal services, leak data through URLs, or inject hostile instructions. Restrict schemes and destinations, resolve DNS safely, and sandbox parsing.

### How do you limit the size and cost of fetched content before it enters the context?
Apply byte, page, time, and token limits. Extract relevant sections, strip boilerplate, and summarize large results before placing them in model context.

### What's the difference between conversation memory and workflow state? Why keep them separate?
Memory summarizes prior conversation and may be incomplete; workflow state records authoritative facts and pending actions. A write must use durable state, not a fuzzy summary.

### Why store intake and draft state in Redis, and why version it?
Redis can hold short-lived intake and draft state with TTLs and atomic version checks. Versioning detects concurrent edits and supports recovery after worker restarts.

### Short-term vs. long-term memory in agents. What are the trade-offs?
Short-term memory supports the current session; long-term memory retrieves durable preferences or facts. Both need retention, provenance, and correction rules to avoid stale context.

### How would you handle two messages from the same user arriving at the same time?
Serialize messages per conversation or use optimistic version checks. Recompute from the latest state when a write loses the race rather than overwriting another turn.

### Which agent actions should require human confirmation, and how do you decide?
Require confirmation for external writes, payments, sensitive disclosures, or irreversible steps according to risk. Show the exact action and arguments before approval.

### How do you implement a pause-and-resume flow?
Persist a checkpoint and pending action ID, pause execution, then resume from the checkpoint after an authenticated decision. Expire stale approvals.

**Preparation points:** checkpointing, interrupts, persisted pending action.

### How do you make sure the confirmation applies to the exact action shown to the user and not a changed one?
Hash the canonical tool name, arguments, target, and state version shown to the user. Execute only if the approval refers to that exact hash and has not expired.

### Explain direct vs. indirect prompt injection with examples.
Direct injection appears in a user's prompt; indirect injection arrives through retrieved pages, files, or tool output. Treat both as data unless authorized by trusted code.

### Describe defense in depth for an agent.
Combine input controls, scope checks, least-privilege tools, validation, confirmation for writes, and output checks. No one layer is a complete boundary.

### Why can't you rely on the system prompt alone for security?
A prompt is guidance to a probabilistic model, not an authorization system. Enforce permissions and action constraints in deterministic application code.

### Why does an emergency triage step run before anything else in the maintenance flow?
Run urgent safety triage before ordinary routing so an emergency cannot be delayed by retrieval, drafting, or tool exploration. Escalate under the product's defined policy.

### How do you detect that an answer isn't supported by tool results?
Require claims to cite tool evidence and verify key values against returned records. Use rule checks first and a calibrated judge only where deterministic checks are insufficient.

### What do you do when the guard fails?
Regenerate once with the missing evidence, fall back to a safe response, or hand off. Record the failure so evaluation data captures it.

**Preparation points:** regenerate, fall back to a safe template, escalate.

### What are the cost and latency implications of an output guard?
An output guard adds another model call or rule pass, increasing latency and cost. Reserve expensive checks for high-risk paths and measure prevented failures.

### How do you avoid creating a work order twice when a request is retried?
Use a stable idempotency key and atomic claim before dispatching. Record the external write result and reconcile retries through the same key.

**Preparation points:** idempotency keys, dispatch claims/fences, the outbox pattern.

### What do you do when a write times out and you don't know whether it succeeded?
Do not issue a second write blindly. Query the downstream system by idempotency key or business identifier, then retry only if the original action is absent.

### Explain "at-most-once" vs. "at-least-once" delivery in agent write actions.
At-most-once delivery can lose work; at-least-once delivery can duplicate work. For writes, combine durable retries with idempotency and reconciliation.

### When should an agent escalate to a human or another agent?
Escalate when confidence is low, permissions are insufficient, policy requires approval, or retries are exhausted. Include enough context for the next actor to continue.

### What context must a handoff carry?
Carry the goal, relevant facts and evidence, completed actions, pending decisions, and reason for handoff. Avoid dumping the entire transcript or unnecessary private data.

### Compare handoff patterns: supervisor, swarm, and agent-as-tool.
A supervisor routes work centrally, a swarm lets peers hand off, and agent-as-tool keeps a specialist behind a controlled call. Choose by control and audit needs.

### How do you evaluate an agent versus a normal LLM app?
Evaluate final task success plus tool selection, argument correctness, safety gates, retries, and trajectory. A plausible final answer can hide a failed action path.

### What is LLM-as-judge, and what are its biases and limits?
An LLM judge scores outputs against a rubric but may favor verbosity, position, or its own model family. Calibrate with human labels and deterministic checks.

### What are "must-pass" tests, and how do you use them in CI?
Must-pass cases protect critical invariants such as tenant isolation or approval before a write. Fail CI on any regression in those cases, regardless of aggregate score.

### How do you test multi-turn behavior with non-deterministic outputs?
Use scripted multi-turn fixtures and simulated users, assert state transitions and tool calls, and repeat stochastic cases. Keep hard safety checks deterministic.

### What do you capture in an LLM trace?
Trace request and user-safe IDs, prompt and model versions, tool calls, state transitions, latency, tokens, cost, and errors. Redact or restrict sensitive payloads.

### How does OpenTelemetry fit with LLM tools like Langfuse?
OpenTelemetry carries distributed trace context across services; Langfuse can add model and prompt detail to those spans. Correlate them with one trace ID.

### How would you debug a bad answer a user reported last week?
Find the trace, reconstruct model version, prompt, retrieved evidence, state, and tool responses, then replay in an isolated environment. Classify the root cause before changing prompts.

### What are the privacy concerns with logging prompts?
Prompts can contain personal data, secrets, or proprietary documents. Redact by default, restrict access, set retention limits, and avoid logging raw tool results when unnecessary.

### Compare ReAct, Plan-and-Execute, Reflection/Reflexion, and Tree-of-Thought. When would you use each?
ReAct chooses steps iteratively; Plan-and-Execute separates planning from execution; Reflection critiques a draft; Tree-of-Thought explores branches. Use added complexity only when evaluations show a gain.

### What are the failure modes of agents?
Common failures include loops, wrong tools, context loss, compounded mistakes, and excessive autonomy. Bound steps, validate every action, checkpoint, and measure failure modes.

### Single agent vs. multi-agent systems. When is multi-agent worth the complexity?
Use one agent until specialists or parallel tasks measurably improve accuracy or throughput. Multi-agent systems add coordination, cost, and harder debugging.

### Explain orchestration patterns: supervisor, hierarchical, router, parallel fan-out/fan-in.
A supervisor delegates centrally; a router chooses a specialist; hierarchy nests supervisors; fan-out/fan-in runs independent work and merges results. Define ownership of shared state.

### What is the Agent-to-Agent (A2A) protocol, and how does it differ from MCP?
A2A supports communication and task exchange between agents. MCP exposes tools and context to a client; the protocols address different integration boundaries.

### What does "agent autonomy level" mean, and how do you decide how much to give?
Autonomy ranges from suggesting an action to executing it without review. Increase it only for reversible, well-evaluated actions with clear permissions and recovery.

### What happens when the context window fills up? How do you manage it?
Trim irrelevant turns, summarize old context, and store large outputs externally. Reserve space for current evidence and the model's response.

**Preparation points:** summarization, trimming, scratchpads, offloading to external memory.

### What is context rot, and what is the "lost in the middle" problem?
Context rot is reduced use of relevant facts in long contexts; lost-in-the-middle describes weaker attention to middle content. Retrieve and position important evidence deliberately.

### Explain prompt caching. How does it change how you order prompt content?
A stable prompt prefix can be reused by provider caching; place durable instructions and schemas first, then dynamic state and user input later. Measure cache savings.

### How do you decide what goes in the system prompt, the user message, and tool results?
System instructions hold trusted policy and format; user messages carry the request; tool results carry untrusted evidence. Do not promote retrieved instructions to system authority.

### What are embeddings, and how do you choose an embedding model?
Embeddings map text to vectors for semantic similarity. Choose a model by retrieval quality on your corpus, language coverage, dimensional cost, and deployment constraints.

### Compare vector databases (pgvector, Pinecone, Qdrant, OpenSearch). What drives the choice?
Choose pgvector for simpler Postgres integration, or a dedicated vector engine when scale or search features justify it. Compare filtering, operations, latency, and cost on your workload.

### What do rerankers do, and why add one? What are query rewriting, HyDE, and multi-query retrieval?
Rerankers reorder retrieved candidates with a stronger relevance model. Query rewriting, HyDE, and multi-query retrieval broaden recall but add latency and evaluation complexity.

### Compare RAG, fine-tuning, and long context. When is each right?
RAG retrieves changing knowledge, fine-tuning changes model behavior or style, and long context sends more source material directly. Choose from accuracy, freshness, cost, and latency tests.

### What is Agentic RAG, and how does it differ from classic RAG?
Agentic RAG lets a controller decide when and how to retrieve, inspect results, and refine queries. Classic RAG follows a fixed retrieval step.

### Explain tokens, temperature, top-p, and max tokens. What settings suit tool-calling agents?
Tokens determine limits and cost; temperature and top-p control sampling; max tokens caps output. Tool calls usually benefit from low randomness and strict schemas.

### What is the difference between a base model and an instruction-tuned model?
A base model predicts text from pretraining; an instruction-tuned model is optimized to follow requests and conversational constraints. Tool agents generally need instruction-following behavior.

### What is constrained decoding / structured outputs?
Constrained decoding limits token choices to a schema or grammar. Still validate semantics, authorization, and whether the output is supported by evidence.

### What are reasoning models, and how do they change agent design?
Reasoning models can spend more compute on difficult decisions, increasing latency and cost. Use them selectively and constrain tool budgets and output verification.

### Fine-tuning, LoRA, and distillation: when are they worth it?
Fine-tune for repeatable domain behavior with enough examples; LoRA reduces adaptation cost; distillation transfers behavior to a cheaper model. Evaluate against prompt and retrieval baselines first.

### How do you reduce latency in an agent?
Reduce loops and serial calls, parallelize independent tools, stream useful output, cache stable work, and route easy steps to cheaper models. Measure p95 latency.

### How do you control cost?
Budget tokens and tool calls per task, cache reusable prefixes and results, and route by task difficulty. Track cost per successful task rather than only cost per call.

### Model routing and fallback: use a cheap model for intent classification and a stronger one for reasoning. How do you decide?
Use a cheaper model for simple, measurable classification and a stronger one when confidence is low or reasoning is complex. Validate fallback quality against the same schema.

### How do you deploy and scale a stateless agent service?
Keep service processes stateless, persist state and checkpoints externally, and scale on queue depth or concurrency. Bound provider calls to protect quotas.

### Streaming responses (SSE/WebSockets) with tool calls mid-stream: what's tricky?
Stream only committed text; tool calls may pause or revise the answer. Carry trace IDs and handle reconnects, cancellation, and partial output safely.

### Rate limiting, circuit breakers, and retries with exponential backoff and jitter.
Rate limit at the user and provider boundary, retry transient failures with jitter and caps, and open a circuit breaker during sustained outages. Avoid retry storms.

### Checkpointing and durable execution (LangGraph checkpointers, Temporal): when are they needed?
Use checkpoints when work spans long calls, human approvals, or failures that must resume. Durable execution records progress so retries do not repeat completed writes.

### Explain the "lethal trifecta": private data, untrusted content, and external communication together.
Private data plus untrusted content plus external communication creates a path for exfiltration. Separate these capabilities and gate any outbound action.

### What is the principle of least privilege for agent tools? How do you implement per-user authorization so the agent can't act beyond the user's rights?
Give each tool only the permissions the current user has, enforce them in the tool service, and scope data access per tenant. Never trust the model to self-police.

### Sandboxing code execution by agents.
Run agent code in an isolated environment with resource, network, filesystem, and time limits. Treat generated code as untrusted and require review for privileged effects.

### PII handling, data residency, and audit logs.
Minimize collected personal data, honor residency requirements, encrypt stores, and log who did what without retaining raw sensitive prompts unnecessarily.

### Jailbreaks vs. prompt injection, and red-teaming an agent.
A jailbreak tries to alter the model's behavior directly; prompt injection hides instructions in lower-trust content. Test both with adversarial inputs and enforce boundaries in code.

### How do you build an evaluation dataset from production traces?
Sample real traces, remove private data, label expected outcomes and failure categories, and hold out representative cases for regression evaluation.

### Offline vs. online evaluation, A/B testing, and shadow mode.
Offline evals use fixed cases before release; shadow mode compares new behavior without serving it; online A/B tests measure live outcomes with guardrails.

### Detecting regressions when the model provider updates a model version.
Pin model versions when possible, run regression suites before switching, and monitor post-deploy quality by task segment. Keep rollback ready.

### Metrics: task success rate, tool-call accuracy, groundedness, escalation rate, cost per task.
Track task success, tool-call correctness, grounding, escalation, latency, and cost per task. Segment metrics so improvements do not hide critical failures.

### Compare LangGraph, LangChain, LlamaIndex, CrewAI, AutoGen, the OpenAI Agents SDK, and the Claude Agent SDK. When would you skip a framework?
Choose a framework for needed orchestration, retrieval, or observability features, not popularity. A small explicit loop can be easier to audit than a large framework.

### What is AgentCore (runtime, gateway, memory), and what does a managed agent platform give you?
AgentCore offers managed runtime, gateway, and memory capabilities that can reduce infrastructure work. Evaluate isolation, integration, cost, and portability for your deployment.

### Design a customer-support agent that can look up orders, issue refunds, and escalate to humans. Cover tools, state, guardrails, confirmation, and evaluation.
Define order lookup as read-only, refund as a permission-checked write, and escalation as a durable handoff. Require exact refund confirmation, an idempotency key, and tests for denied and repeated actions.

### Design a RAG chatbot for 1M documents with per-tenant access control.
Index documents with tenant and access metadata, filter before retrieval, then rerank and answer with citations. Measure retrieval recall, permission leaks, and answer faithfulness at realistic scale.

### Design a multi-agent system for code review or incident response.
Assign clear roles for analysis, evidence collection, and final decision. Use one orchestrator for shared state and approval of actions; compare the result with a simpler single-agent baseline.

### Design an evaluation and observability platform for a team shipping many agents.
Collect traces and labeled outcomes across teams, then run versioned offline evaluations and production monitoring. Separate hard safety gates from graded quality scores and track cost per successful task.

### How would you make the maintenance agent safe to run at 10x traffic?
Keep request handlers stateless, move workflow state to durable storage, and scale workers by queue depth. Enforce tenant isolation, bounded tool concurrency, idempotency, and provider quotas.

### Implement a minimal ReAct loop without any framework: call the model, parse tool calls, execute, append results, stop on a final answer or max steps.
Create a bounded loop that sends messages and tool schemas to the model, validates each requested tool, executes it, appends the result, and exits on a final answer or step limit.


```python
def run_agent(messages, model, tools, max_steps=8):
    for _ in range(max_steps):
        reply = model.complete(messages, tools=tools.schemas())
        if not reply.tool_calls:
            return reply.text
        messages.append(reply)
        for call in reply.tool_calls:
            tool = tools.authorized(call.name)
            args = tool.schema.validate(call.arguments)
            result = tool.invoke(args)
            messages.append({"tool_call_id": call.id, "result": result})
    raise RuntimeError("Agent step limit reached")
```
### Write a tool-call wrapper with schema validation, timeout, retries, and idempotency keys.
Validate the tool name and arguments against a registry, check user authorization, set a timeout, and retry only safe transient failures. Bind writes to an idempotency key.

### Implement a simple guardrail that blocks prompt injection in retrieved documents.
Treat retrieved text as untrusted data, delimit it, and reject instructions that ask to change policy or call tools. Use deterministic authorization checks because text filtering alone can be bypassed.

### Build a small LangGraph with a router node, a tool node, and a human-approval interrupt.
Represent route choice and tool execution as nodes with typed state. Add a persisted checkpoint and interrupt before a write, then resume only after approval for the exact pending action.

### Write an eval harness that runs test conversations and asserts on the tool-call trajectory.
Run scripted conversations with fixed tool fixtures and assert the chosen tools, arguments, order, final state, and safety decisions. Use repeated runs for stochastic quality thresholds.

### Tell me about a time an agent behaved unexpectedly in production. How did you find and fix it?
Use a real incident: state the symptom, the trace or tool call that exposed it, the fix, and the measurable prevention added afterward. Avoid inventing an experience.

### What was your hardest trade-off between autonomy and safety?
Describe a specific decision where autonomy saved time but created risk. Explain the confirmation or scope limit chosen, the alternatives, and how outcomes were measured.

### How did you convince stakeholders to add human confirmation or evaluation gates?
Explain the user impact in plain terms, show a concrete failure case, and quantify the cost of a confirmation gate against avoided errors. Invite review of the proposed threshold.
