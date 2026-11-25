## AWS

### Asynchronous extraction flow with S3, SQS, DynamoDB and a worker?
Flow, upload to result:

1.  Client calls POST /v1/documents (or requests a pre-signed S3 URL and uploads directly).

2.  API authenticates, validates, writes the file to s3://docs/{tenant}/{job_id}/original.pdf.

3.  API writes a DynamoDB item {tenant_id, job_id, status: QUEUED, created_at, idempotency_key} using a conditional write.

4.  API sends an SQS message {tenant_id, job_id, s3_key} and returns 202 with job_id.

5.  A worker (EKS pod) long-polls SQS, reads the message, atomically moves status to PROCESSING, downloads from S3, runs OCR, LLM and validation, writes result JSON to S3 (result.json), sets status COMPLETED (or FAILED/NEEDS_REVIEW), then deletes the SQS message.

6.  Failures retry; after N attempts the message goes to the DLQ and status becomes FAILED.
- **Follow-up:** how does the client learn the job is done?
- Polling GET /v1/jobs/{id}: simplest, works everywhere; use Retry-After and sensible intervals.
- Webhook: server calls the customer's URL on completion; needs signing (HMAC), retries and an idempotent receiver.
- Events (SNS, EventBridge, WebSocket/SSE) for internal systems or real-time UIs. Offer polling as the baseline and webhooks as the opt-in for scale.

### SQS standard vs FIFO; visibility timeout for a 3-minute job; worker crash?
Standard
- FIFO
- Throughput
- Nearly unlimited
- Limited (higher with batching and high-throughput mode)
- Ordering
- Best effort
- Strict within a message group
- Delivery
- At least once (duplicates possible)
- Exactly-once processing within the dedup window (5 minutes)
- For independent documents, use standard (throughput, simplicity) and make workers idempotent. Use FIFO only when per-key ordering matters (for example, updates to the same document).
- Visibility timeout: after a consumer receives a message, SQS hides it for this period.
- If the consumer does not delete it in time, the message becomes visible again and another worker processes it (duplicate work).
- For a 3-minute job set it above the p99 duration, for example 6 to 10 minutes, or have the worker extend the timeout (heartbeat) with ChangeMessageVisibility while working.
- Too short causes duplicates; too long delays recovery after a crash.
- **Follow-up:** worker crashes mid-job: the message is never deleted, so after the visibility timeout it reappears and another worker takes it.
- Because of that, processing must be idempotent and resumable; status in DynamoDB tells the new worker whether to restart or resume from a checkpoint.
- After maxReceiveCount failures it moves to the DLQ.

### Dead-letter queue?
What: a separate SQS queue that receives messages that failed to process after maxReceiveCount receives (for example 5), configured by a redrive policy. Reasons: poison messages (malformed input), bugs, corrupted or password-protected PDFs, a persistent downstream failure, a validation error that retries cannot fix.
- **Follow-up:** inspect and replay safely: alarm on DLQ depth > 0 (CloudWatch or New Relic).
- Inspect messages, correlate with logs by job_id, and identify the cause.
- Fix the bug or data, then use SQS redrive to source queue (console or API) in small batches, after confirming the worker is idempotent.
- Messages that cannot ever succeed are marked FAILED, the customer is notified, and the message is archived.
- Set DLQ retention longer than the source queue (up to 14 days), and never auto-replay blindly (a poison message will just loop back).

### SQS is at-least-once; making a worker idempotent; DynamoDB conditional writes?
**Approach:** make processing a function of job_id so running it twice produces the same result and no double side effects. Techniques: (1) claim the job with a conditional write; (2) write outputs to deterministic keys (results/{job_id}.json), so a re-run overwrites with the same data; (3) make downstream calls idempotent (idempotency keys); (4) skip if already COMPLETED.
- DynamoDB conditional write:
```python
try:
    table.update_item(
        Key={'tenant_id': t, 'job_id': j},
        UpdateExpression='SET #s = :proc, worker = :w, started_at = :now',
        ConditionExpression='#s = :queued OR (#s = :proc AND lease_expires < :now)',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':queued': 'QUEUED', ':proc': 'PROCESSING',
                                   ':w': worker_id, ':now': now})
except ClientError as e:
    if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
        return  # someone else owns it, or it is already done: ack and skip
    raise
```
- The condition makes the claim atomic: only one worker wins. The lease_expires field lets another worker take over from a crashed one.

### Modeling job status in DynamoDB; keys, access patterns, hot partitions, GSI, TTL?
Start from access patterns: (1) get a job by id for a tenant; (2) list a tenant's recent jobs; (3) find jobs by status (for ops); (4) expire old records.
- Table design:
- Partition key: tenant_id or tenant_id#job_id; sort key: job_id (ULID/UUIDv7, which sorts by time). With PK = tenant_id and SK = job_id, you get GetItem for one job and Query for a tenant's recent jobs, newest first.
- GSI status-created_at: PK = status (or a sharded value such as status#shard), SK = created_at for operational queries like 'all FAILED in the last hour'.
- TTL attribute (expires_at) deletes old items automatically at no write cost; keep metadata for the retention period only.
- Hot partition: one partition key receives disproportionate traffic and hits the per-partition throughput limit (about 1,000 WCU and 3,000 RCU), causing throttling.
- Example: one huge tenant, or a GSI keyed by status=QUEUED where every write lands in one partition.
- Fix: add a shard suffix (QUEUED#0..9), use high-cardinality keys, and spread writes.
- On-demand capacity plus adaptive capacity helps but does not remove poor key design.

### Large files with S3; pre-signed URLs; securing them?
Large uploads: use multipart upload (parts of 5 MB to 5 GB, parallel, retry individual parts, required above 5 GB); boto3's upload_file and TransferConfig handle it. Downloads can use ranged GETs. S3 Transfer Acceleration helps long distances.
- Pre-signed URL: a time-limited URL signed with the signer's credentials that lets a client upload or download one specific object directly, without AWS credentials, and without the bytes going through your API (saves bandwidth and compute).
- url = s3.generate_presigned_post(
- Bucket='docs', Key=f'{tenant}/{job_id}/original.pdf',
- Fields={'Content-Type': 'application/pdf'},
- Conditions=[['content-length-range', 1, 50*1024*1024],
- ['eq', '$Content-Type', 'application/pdf']],
- ExpiresIn=300)
- **Follow-up:** securing them: short expiry (5 to 15 minutes for upload, shorter for downloads); the key is generated server-side and scoped to the tenant (never accept a client-supplied path); enforce content-type and size conditions with a presigned POST; HTTPS only; sign with a role that has least privilege; do not log full URLs (they act as bearer tokens); and after upload, validate by magic bytes and scan for malware before processing (use S3 event or the worker).

### S3 storage classes, lifecycle rules, encryption, retention?
- Storage classes: Standard (hot), Standard-IA / One Zone-IA (infrequent access, retrieval fee), Intelligent-Tiering (automatic when access is unpredictable), Glacier Instant/Flexible/Deep Archive (cheap long-term, slower retrieval).
- Lifecycle rules: originals: Standard for 30 days, then IA, then Glacier after 90 days, delete at the end of the retention period; intermediate artifacts (page images, OCR JSON): expire after 7 to 30 days; abort incomplete multipart uploads after 7 days; expire old versions.
- Encryption: SSE-S3 (AWS-managed keys, free, simplest, no per-tenant control) vs SSE-KMS (customer-managed key: audit trail in CloudTrail, key policies, ability to revoke or rotate, per-tenant keys possible; costs KMS requests, so enable S3 Bucket Keys). For sensitive financial or personal documents use SSE-KMS.
- Retention and deletion: define per contract and law (GDPR, DPDP, HIPAA); S3 Object Lock for WORM needs; support customer deletion requests with verifiable deletion across S3, DynamoDB, logs and backups; block public access and enable versioning and access logging.

### IAM roles, policies, least privilege; EKS worker reading one bucket; IRSA / Pod Identity?
IAM: a role is an identity assumed by a service or workload with temporary credentials (no long-lived keys). A policy is a JSON document of allowed or denied actions on resources. Least privilege means granting only the actions and resources needed.
- {"Version": "2012-10-17",
- "Statement": [{
- "Effect": "Allow",
- "Action": ["s3:GetObject", "s3:PutObject"],
- "Resource": "arn:aws:s3:::docs-prod/*"
- }, {
- "Effect": "Allow",
- "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility"],
- "Resource": "arn:aws:sqs:ap-south-1:123456789012:extract-queue"
- }]}
- EKS worker: do not put access keys in the pod. Create an IAM role with the policy above, and bind it to the Kubernetes service account.
- **Follow-up:** IRSA or Pod Identity: IRSA (IAM Roles for Service Accounts) uses the cluster's OIDC provider: the pod gets a projected service-account token, and the AWS SDK exchanges it through STS AssumeRoleWithWebIdentity for temporary credentials.
- The role's trust policy restricts it to one namespace and service account.
- EKS Pod Identity is the newer, simpler mechanism: an agent on the node provides credentials, and associations are managed through the EKS API without per-cluster OIDC trust setup.
- Both give per-pod, short-lived, auditable credentials instead of node-wide permissions.

### Lambda vs a container worker on EKS?
Choose Lambda for spiky or low volume traffic, short tasks (within the current standard Lambda timeout limit), event-driven glue (S3 event triggers, a webhook sender), minimal operations, and pay-per-use cost. Choose EKS containers for long-running or heavy jobs, large dependencies (OCR and ML libraries beyond the 10 GB image limit, GPU), predictable steady throughput (cheaper per unit at constant load), tight control over concurrency, networking and observability, and workloads that need warm in-memory state.
- Follow-up trade-offs: cold starts add latency for the first request (mitigated by provisioned concurrency, at a cost); standard function timeouts currently cap at 30 minutes; concurrency is limited per account/region (reserve and throttle to protect the LLM rate limit); cost is great at low volume and less efficient at sustained high volume.
- For a 3-minute, CPU-heavy PDF job at 10,000 documents a day, either works; at a million a day, containers with autoscaling usually win on cost.

### Scaling workers by queue depth?
Use the metric 'messages per worker' rather than raw depth: ApproximateNumberOfMessagesVisible / current_replicas, targeting what one worker can drain within your latency goal.
- **Follow-up:** KEDA / HPA with custom metrics: the Horizontal Pod Autoscaler normally scales on CPU or memory, which is meaningless for a worker waiting on I/O.
- KEDA (Kubernetes Event-driven Autoscaling) has an SQS scaler: it reads queue length and scales the deployment (even down to zero), feeding the metric to the HPA.
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
spec:
  scaleTargetRef: {name: extract-worker}
  minReplicaCount: 1
  maxReplicaCount: 50
  triggers:
  - type: aws-sqs-queue
    metadata:
      queueURL: https://sqs.ap-south-1.amazonaws.com/123456789012/extract-queue
      queueLength: '5'      # target messages per replica
      awsRegion: ap-south-1
Guardrails: cap max replicas by the LLM provider rate limit and the downstream DB; graceful shutdown (SIGTERM: finish or release the current message); scale-down stabilization to avoid flapping; cluster autoscaler or Karpenter for nodes.
```

### Partial failures in a multi-step job; retry the whole job or resume?
**Approach:** model the job as a state machine with durable checkpoints: UPLOADED -> OCR_DONE -> LLM_DONE -> VALIDATED -> SAVED. After each step persist its output (for example OCR JSON in S3) and update status in DynamoDB. On retry, load the last checkpoint and continue from there.
- Resume vs restart: resume when steps are expensive (Textract pages, LLM tokens) and outputs are deterministic and stored; restart when the earlier outputs may be invalid (a bug fix in OCR logic) or the job is cheap.
- Classify errors: transient (timeouts, 429, 5xx): retry with backoff; permanent (corrupt file, schema violation after retries): fail fast, do not retry, go to the DLQ or review.
- Make each step idempotent.
- For complex orchestration consider AWS Step Functions, which provide per-step retry policies, catch handlers, timeouts, and visibility out of the box.
- For compensation, make the final 'save' atomic so partial results are never exposed.

### Controlling AWS cost for a document pipeline?
- Textract: the largest line item at scale; use PyMuPDF text extraction for digital PDFs, run Textract only on scanned pages, and request only needed features (tables and forms cost more than plain text); process only relevant pages.
- LLM tokens: shorter prompts, caching, a cheaper model for easy cases, the batch API, de-duplicate by file hash, cap the output length.
- S3: lifecycle policies, delete intermediates, Intelligent-Tiering, abort incomplete multipart uploads, avoid tiny-object overhead.
- Data transfer: keep services in the same region, use VPC endpoints for S3 and DynamoDB (avoids NAT gateway data charges), compress payloads.
- Compute: right-size pods, scale down to a minimum (KEDA), use Spot instances for stateless workers, and Savings Plans for the baseline.
- DynamoDB and SQS: on-demand vs provisioned capacity per pattern; batch SQS operations; TTL cleanup.
- Governance: cost allocation tags per tenant, AWS Budgets and anomaly alerts, and a dashboard of cost per document tracked as a product metric.

### Why run Lambda as a container image instead of a zip?
Container images support up to 10 GB (zip is 250 MB unzipped), so they suit large dependencies like ML libraries, pandas, or custom binaries. They also give you the same image locally and in production, and a standard Docker workflow.

### How do you deploy a container-based Lambda?
1. Write a Dockerfile `FROM public.ecr.aws/lambda/python:3.12` (an AWS base image).
2. Copy your code and set `CMD ["app.handler"]`.
3. Authenticate: `aws ecr get-login-password | docker login --username AWS --password-stdin <acct>.dkr.ecr.<region>.amazonaws.com`
4. Build, tag, and push to ECR.
5. Create or update the function with `--package-type Image --code ImageUri=<ecr-uri>`.

### Does the ECR repo need to be in the same region as the Lambda?
Yes, same region. Cross-account is possible with an ECR repository policy.

### How do you reduce cold starts with container images?
- Use slim base images and multi-stage builds.
- Keep heavy imports lazy or outside the critical path.
- Use provisioned concurrency.
- Lambda caches image layers, so keep frequently changing layers last in the Dockerfile.

### Can you use a non-AWS base image?
Yes, but it must implement the Lambda Runtime API. Add the Runtime Interface Client (RIC), and the Runtime Interface Emulator (RIE) for local testing.

### How do you test locally?
Run the image with RIE, then `curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'`.

### What permissions does Lambda need to pull from ECR?
The deployer needs `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`, and `ecr:BatchCheckLayerAvailability`. Lambda's service principal needs these in the repository policy for cross-account pulls.

### How do you manage image versions and cleanup?
Use immutable tags (git SHA) rather than `latest`, and ECR lifecycle policies to expire old images. Enable image scanning on push (or Inspector enhanced scanning).

### IAM user vs. role?
A user has long-term credentials for a person or app. A role has no permanent credentials. It is assumed temporarily through STS and gives short-lived credentials. Prefer roles for services and cross-account access.

### What are the two policies involved in a role?
- **Trust policy** says who can assume the role (e.g., `lambda.amazonaws.com`).
- **Permission policy** says what the role can do.

### Identity-based vs. resource-based policy?
Identity-based policies attach to a user, group, or role. Resource-based policies attach to the resource (S3 bucket, SQS queue, Lambda) and name a Principal. For cross-account access, both sides generally need to allow it (except where a resource policy directly grants to a role's account in same-account cases).

### How is a policy evaluated?
Explicit Deny always wins. Otherwise there must be an explicit Allow. The default is implicit deny. SCPs and permission boundaries only limit the maximum permissions; they don't grant anything.

### What is a permission boundary?
It's a managed policy that sets the maximum permissions an identity can have. The effective permissions are the intersection of the identity policy and the boundary.

### Give an example of least privilege for Lambda reading one S3 bucket.
```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::my-bucket/input/*"
}
```
Plus `AWSLambdaBasicExecutionRole` for CloudWatch Logs.

### How does cross-account role assumption work?
Account B's role trusts Account A in its trust policy. A principal in Account A needs `sts:AssumeRole` permission on that role's ARN. Use `ExternalId` for third-party access.

### Execution role vs. resource policy for Lambda?
The execution role is what Lambda can do (outbound). The resource policy is who can invoke Lambda (inbound, e.g., S3 or EventBridge).

### S3 consistency model?
Strong read-after-write consistency for all operations (since Dec 2020), including overwrites, deletes, and list.

### How do you secure a bucket?
- Block Public Access (account and bucket level).
- Bucket policy with least privilege and `aws:SecureTransport` enforcement.
- SSE-S3 or SSE-KMS encryption (new objects are encrypted by default).
- VPC endpoints and access points.
- Access logging and CloudTrail data events.

### Versioning vs. replication?
Versioning keeps multiple versions of an object in a bucket, protecting against accidental delete or overwrite. Replication (CRR/SRR) copies objects to another bucket and requires versioning on both.

### What are lifecycle rules?
They transition objects between storage classes or expire them after N days, and can clean up incomplete multipart uploads and old versions.

### How do you upload large files?
Multipart upload is recommended above 100 MB and required above 5 GB (max object 50 TB). Transfer Acceleration helps for long distances.

### How do you trigger processing on upload?
S3 Event Notifications to Lambda, SQS, or SNS, or send events to EventBridge for richer filtering and multiple targets.

### S3 performance?
At least 3,500 PUT and 5,500 GET requests per second per prefix. Spread across prefixes and use multipart and byte-range fetches to parallelize.

### What is EventBridge?
A serverless event bus that routes events from AWS services, custom apps, and SaaS partners to targets based on rules.

### Event bus types?
Default bus (AWS service events), custom buses (your apps), and partner buses (SaaS).

### What is an event pattern?
A JSON filter that matches event content:
```json
{
  "source": ["aws.s3"],
  "detail-type": ["Object Created"],
  "detail": { "bucket": { "name": ["my-bucket"] } }
}
```

### Rules vs. Scheduler?
Rules are for event matching and basic cron or rate schedules. EventBridge Scheduler is the newer service for large-scale one-time and recurring schedules, with time zones and flexible windows.

### How do you handle failed deliveries?
Configure a retry policy (max age and attempts, default up to 24 hours and 185 retries) and a DLQ (SQS) per target.

### EventBridge vs. SNS vs. SQS?
- SNS: simple pub/sub fan-out with limited filtering.
- SQS: queue for decoupling and buffering with consumer pull.
- EventBridge: content-based routing, many sources, schema registry, and transformation.

### What is input transformation?
It reshapes the event before it reaches the target, using an input path and template, so you pass only the fields the target needs.

### Other features worth mentioning?
Archive and replay, Schema Registry, API destinations (call external HTTP APIs), Pipes (source to target with filtering and enrichment), and cross-account and cross-region bus targets.

### Delivery guarantee?
At-least-once, so consumers must be idempotent.

### How does Lambda scale and what are its limits?
It scales by adding execution environments, one concurrent request each. Default account concurrency is 1,000 per region (raisable). Standard Lambda functions can run for up to 30 minutes, memory 128 MB to 10 GB, ephemeral `/tmp` up to 10 GB.

### Reserved vs. provisioned concurrency?
Reserved concurrency guarantees and caps a function's share of account concurrency (no extra cost). Provisioned concurrency keeps environments ready to reduce cold starts (extra cost).

### What causes cold starts and how do you mitigate them?
New environment creation: download code, start runtime, run init code. Mitigate with provisioned concurrency, SnapStart where supported (including current Java, Python, and .NET runtimes), smaller packages, lazy imports, and avoiding VPC-related delays (mostly resolved with Hyperplane ENIs).

### Sync vs. async vs. poll-based invocation?
- Synchronous: API Gateway, ALB (caller waits).
- Asynchronous: S3, EventBridge, SNS (Lambda queues internally, retries twice by default, supports DLQ or on-failure destinations).
- Poll-based (event source mapping): SQS, Kinesis, DynamoDB Streams.

### How do you handle errors in async invocations?
Configure retry attempts (0 to 2), max event age, and an on-failure destination (SQS, SNS, EventBridge, or Lambda) or DLQ.

### How do you manage secrets and config?
Environment variables for non-sensitive config. Secrets Manager or SSM Parameter Store (SecureString) for secrets, cached outside the handler. Use the Parameters and Secrets Lambda extension for caching.

### Lambda in a VPC?
Needed to reach private resources (RDS, ElastiCache). Internet access then requires a NAT Gateway. Use VPC endpoints for AWS services.

### What are layers and extensions?
Layers package shared libraries or dependencies (up to 5 per function, only with zip functions). Extensions run alongside the function for monitoring, secrets, and security tools.

### How do you make Lambda idempotent?
Use an idempotency key stored in DynamoDB with a conditional write. Powertools for AWS Lambda provides an idempotency utility.

### Cost optimization?
Right-size memory (use AWS Lambda Power Tuning), use ARM/Graviton (often cheaper, depending on the workload and region), reduce duration, and batch SQS records.

### How do you configure a DLQ?
Set a **redrive policy** on the source queue:
```json
{"deadLetterTargetArn": "arn:aws:sqs:...:my-dlq", "maxReceiveCount": 5}
```
A FIFO queue needs a FIFO DLQ, and a standard queue needs a standard DLQ.

### How do you reprocess DLQ messages?
Use the **DLQ redrive** feature in the console/API (`StartMessageMoveTask`) to move messages back to the source queue after fixing the bug.

### DLQ retention tip?
Message retention is based on the original enqueue timestamp, so set the DLQ retention longer (e.g., 14 days) than the source queue.

### How does SQS integrate with Lambda?
Through an event source mapping that polls the queue. Configure batch size (up to 10,000 for standard with batching window), and enable `ReportBatchItemFailures` so only failed messages return to the queue instead of the entire batch. A standard SQS event source mapping can scale to 1,250 concurrent function instances by default (use `MaximumConcurrency` to limit).

### Short vs. long polling?
Long polling (`WaitTimeSeconds` up to 20) reduces empty responses and cost. Short polling returns immediately and may miss messages on some servers.

### How do you handle duplicates?
Standard queues can deliver duplicates, so make consumers idempotent. FIFO uses `MessageDeduplicationId` (5-minute dedup window) or content-based dedup.

### Max message size and retention?
1 MiB per message (use the S3 extended client for larger payloads). Retention is 1 minute to 14 days (default 4 days).

### Do you need a DLQ on the Lambda too?
For SQS-triggered Lambda, put the DLQ on the **SQS queue** (redrive policy), not on the Lambda. Lambda's own DLQ and destinations apply only to async invocations.

### Design a pipeline: a file uploaded to S3 gets processed by a containerized Lambda that calls an LLM, with failure handling.
1. The file lands in S3 and emits an `Object Created` event to EventBridge.
2. An EventBridge rule filters on prefix and suffix and sends the event to an SQS queue (buffering and backpressure).
3. The queue has a DLQ with `maxReceiveCount=3` and a CloudWatch alarm on DLQ depth.
4. A container-image Lambda (from ECR) consumes batches with partial batch response.
5. The Lambda's IAM role is least-privilege: S3 read on the prefix, SQS consume, and Bedrock invoke on specific model ARNs.
6. The Lambda calls the LLM through the GenAI gateway (rate limits, guardrails, cost tracking).
7. It writes results to S3 and is idempotent via a DynamoDB key.

**Follow-up:** *Why SQS between EventBridge and Lambda?* It smooths bursts, protects the LLM's rate limits, gives per-message retries, and provides a DLQ for failures.
