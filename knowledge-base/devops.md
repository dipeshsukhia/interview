## DevOps and Observability

### Terraform: state, plan vs apply, modules, remote state?
What: infrastructure as code: you declare desired infrastructure in HCL and Terraform creates, updates or deletes resources to match, with a reviewable history in Git.
- State: a file mapping your config to real resources (IDs, attributes). It may contain secrets, so protect it.
- Plan vs apply: plan shows what would change (a diff) with no changes made; apply executes it. In CI, save the plan and apply exactly that plan after approval.
- Modules: reusable, parameterized building blocks (a VPC module, an SQS-with-DLQ module) with inputs and outputs, versioned.
- Remote state: store state in S3 with versioning and encryption, with a DynamoDB table (or S3 native locking in newer versions) for locking.
Follow-up: two people apply at once? State locking blocks the second apply (it fails with a lock error), preventing corruption. Never force-unlock without confirming that no one is applying. Better: apply only through the CI pipeline.
Drift detection: drift is when real infrastructure differs from state/code (for example, someone edited a security group in the console). Run scheduled terraform plan -detailed-exitcode in CI to alert on differences, restrict console write access, then either import/update the code or revert the manual change.

### Helm vs plain Kubernetes YAML?
Helm is the package manager for Kubernetes: a chart is a templated bundle of manifests (Deployment, Service, ConfigMap, HPA) plus default values.yaml. Benefits over raw YAML: templating (no copy-paste per environment), versioned and reusable releases, helm upgrade --install, easy rollback (helm rollback), dependency management, and hooks.
Follow-up: values files and environments: keep one chart and one values file per environment:
values.yaml          # defaults
values-dev.yaml      # replicas: 1, small resources, debug logging
values-staging.yaml
values-prod.yaml     # replicas: 4, HPA on, larger limits, prod IAM role ARN
helm upgrade --install extract ./chart -f values.yaml -f values-prod.yaml --set image.tag=$GIT_SHA. Secrets are not committed; use External Secrets Operator, AWS Secrets Manager or sealed secrets. Use helm template and helm lint in CI to validate rendering.

### Pods, deployments, services, ConfigMaps, Secrets; what is special about EKS; liveness vs readiness?
- Pod: the smallest unit; one or more containers sharing network and storage. Ephemeral.
- Deployment: declares the desired number of identical pods; handles rolling updates and self-healing through ReplicaSets.
- Service: a stable virtual IP and DNS name that load-balances across pods (ClusterIP, LoadBalancer).
- ConfigMap: non-sensitive configuration injected as environment variables or files.
- Secret: sensitive values (base64-encoded, not encrypted by default; enable envelope encryption with KMS and restrict RBAC, or use External Secrets).
EKS specifics: AWS runs and manages the control plane (HA across AZs); you manage nodes (managed node groups, Karpenter, or Fargate). Integrates with IAM (IRSA/Pod Identity, access entries), the VPC CNI (pods get VPC IPs), ALB ingress via the AWS Load Balancer Controller, EBS/EFS storage, and CloudWatch.
Follow-up: liveness vs readiness: liveness asks 'is the process stuck or dead?': failure makes Kubernetes restart the container. Readiness asks 'can it serve traffic now?': failure removes the pod from Service endpoints but does not restart it (useful during warm-up or when a dependency is down). A startup probe protects slow-starting apps. Do not make the liveness probe depend on external services (an outage would cause a restart loop).

### CI/CD pipeline; secrets handling; committed key?
Typical pipeline: commit and PR, then lint and type checks, unit tests, dependency and secret scanning (SAST), build the Docker image, scan the image, push to ECR tagged with the Git SHA, deploy to dev automatically, run integration tests and the evaluation gate, promote to staging, approval, deploy to production (canary or rolling), smoke tests, and automatic rollback on failure.
Secrets: never in code, images or logs. Store in AWS Secrets Manager or SSM Parameter Store, inject at runtime (External Secrets, or the app reads with an IAM role), use CI platform secrets or OIDC federation to AWS instead of long-lived keys, rotate regularly, scope narrowly, and add secret scanning (gitleaks, pre-commit hooks, GitHub push protection).
Follow-up: you committed a key, what do you do? (1) Revoke or rotate it immediately; deleting the commit does not help because it stays in history and may have been cloned or scraped. (2) Check the provider's audit logs (CloudTrail) for any use of the key. (3) Remove it from history (git filter-repo/BFG) as a hygiene step only after rotation. (4) Notify the security team according to policy. (5) Add prevention: pre-commit scanning and push protection. (6) Write a short blameless note.

### Rolling, blue-green or canary; rollback vs fix forward?
- Rolling: replace pods gradually; the default; simple; both versions run briefly, so changes must be backward compatible.
- Blue-green: run a full new environment (green) next to the old (blue) and switch traffic at once; instant rollback by switching back; costs double capacity and needs care with database migrations.
- Canary: send a small percentage (1, 5, then 25 percent) to the new version, compare metrics against the baseline, and increase gradually (Argo Rollouts, Flagger, or weighted ALB target groups). Best for risky changes, including model or prompt changes.
Follow-up: rollback or fix forward? Roll back when impact is high, the cause is unclear, or the fix is not trivial: restoring service comes first. Fix forward when the issue is small and well understood, the fix is a one-line change that can be deployed quickly, or rollback is unsafe (an irreversible database migration, or data already written in a new format). Design for rollback: backward-compatible migrations (expand, migrate, contract), and feature flags to switch off a feature without a deploy.

### Pod in CrashLoopBackOff or OOMKilled?
Investigate in order:
1.  kubectl get pod and kubectl describe pod: look at Last State (reason OOMKilled, exit code 137, or an application exit code such as 1), events (image pull errors, failed probes, scheduling).
2.  kubectl logs <pod> --previous to see the crashed container's last output.
3.  Check the recent change: new image, config or secret change, or a dependency change (kubectl rollout history).
4.  Check probes: an overly aggressive liveness probe can kill a healthy but slow-starting app.
5.  Check resource metrics (kubectl top, Prometheus/New Relic): memory climbing steadily means a leak; a sudden spike on large files means loading whole documents into memory.
6.  Reproduce locally with the same image and environment variables.
Follow-up: requests and limits: requests are what the scheduler reserves; limits are the ceiling. Exceeding the memory limit gives OOMKilled; exceeding the CPU limit causes throttling (not a kill). Set the memory request equal to the limit for predictable behavior (Guaranteed or Burstable QoS), size from observed p95 or p99 usage plus headroom, and fix the root cause as well (stream files in chunks, limit concurrent pages per pod, process pool size). Raising the limit alone only hides a leak.

### Intermittent 500s in production: the first 30 minutes?
0 to 5 minutes (assess and communicate): check the alert and the dashboard: error rate, which endpoints, since when, which tenants. Is it ongoing? Declare an incident if customer impact is real, and post a status note. Check what changed: deployments, config or feature flag changes, traffic spikes, provider status pages (AWS, LLM provider).
5 to 15 minutes (localize): open metrics (the RED signals: rate, errors, duration; saturation of CPU, memory, DB connections, queue depth) to see the pattern: all pods or one, one AZ, one dependency. Open traces of failed requests to find which span errors or is slow (DB, S3, LLM call). Open logs filtered by trace_id or error level and look at the stack traces and the exception grouping.
15 to 30 minutes (mitigate): if a deployment correlates, roll back. If a dependency is failing, enable the fallback or circuit breaker, scale up, or shed load. If one bad pod, restart or cordon it. Confirm recovery in metrics. Then find the root cause calmly, write the post-mortem.
Intermittent often means: connection pool exhaustion, one bad replica, timeouts to a flaky dependency, a retry storm, memory pressure, or a specific input that triggers a bug.

### Logs, metrics, traces; New Relic dashboard for an extraction service; alerts?
- Logs: discrete events with detail (what happened). Structured JSON with job_id, tenant_id, trace_id.
- Metrics: numeric time series (how much, how often): cheap to store and ideal for alerting and trends.
- Traces: one request's path across services and steps with timings (where the time went).
New Relic dashboard for an extraction service:
- API: request rate, error rate, latency p50/p95/p99 per endpoint.
- Queue: SQS depth, age of oldest message, DLQ count.
- Workers: jobs started, completed, failed per minute; job duration by stage (OCR, LLM, validation); pod CPU, memory and restarts.
- AI: LLM latency, token usage, cost per document, retry and 429 rates, schema-validation failure rate, null rate per field, human-review rate.
- Dependencies: Textract and S3 errors, DynamoDB throttles.
Alerts: page on customer-impacting symptoms: error rate over threshold, p95 latency SLO burn, oldest message age above the SLA, DLQ growing, zero jobs completed for N minutes. Ticket or Slack only for non-urgent: a single pod restart, a slightly elevated null rate, cost drift, disk at 70 percent. Alert on symptoms, not every cause, to avoid alert fatigue.

### What to log and trace for an LLM application; debugging one bad answer; Langfuse?
Log and trace per LLM call: trace and job ids, model name and version, prompt template version, parameters (temperature, max tokens), input and output token counts, latency, cost, finish reason, retries, the validation outcome, and (subject to privacy controls) the redacted prompt and response or a pointer to them stored securely with a short retention. Also user feedback and review corrections.
Follow-up: finding the cause of a single bad answer: take the job_id from the report; pull its trace; check each stage: was the OCR text correct (compare with the image)? Which chunk or page was sent? Which prompt and model version? What exactly was the raw model output and did validation change it? Was the evidence in the source? Then replay that input against the same and a newer prompt in a notebook. Classify the cause (OCR, prompt, model, schema, data) and add the document to the golden set.
Langfuse (LLM observability): captures nested traces of each LLM call and tool step, shows prompts, outputs, tokens, costs and latency, supports prompt versioning, user feedback scores, datasets and evaluation runs, and lets you inspect a single trace by session. It complements APM (New Relic) which sees infrastructure but not the prompt content.

### SLOs for a non-deterministic AI system; drift; AI-specific incidents?
SLOs: combine classic reliability and quality objectives. Examples: availability 99.9 percent of API requests succeed; latency: 95 percent of documents complete within 2 minutes; quality: field F1 for critical fields at or above 95 percent on a rolling sample; schema-valid output at or above 99.5 percent; human-review rate under 10 percent. Quality SLIs come from a continuously sampled and labeled slice of production traffic, human corrections, and a nightly run on the golden set.
Follow-up: drift and AI incidents: drift types: input drift (new layouts, vendors, scan quality), model drift (a provider silently updates), and schema or business drift. Detect with dashboards on null rate, confidence distribution, review-rate and correction-rate changes, and the golden-set canary run on a schedule. Response to a model-update accuracy drop: confirm with the golden set; roll back to a pinned previous model version or switch to a fallback provider; communicate to affected customers; re-process affected documents; add the failures to the regression set; work with the provider; and update the runbook.
