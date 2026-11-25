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
Choose Lambda for spiky or low volume traffic, short tasks (under 15 minutes), event-driven glue (S3 event triggers, a webhook sender), minimal operations, and pay-per-use cost. Choose EKS containers for long-running or heavy jobs, large dependencies (OCR and ML libraries beyond the 10 GB image limit, GPU), predictable steady throughput (cheaper per unit at constant load), tight control over concurrency, networking and observability, and workloads that need warm in-memory state.
- Follow-up trade-offs: cold starts add latency for the first request (mitigated by provisioned concurrency, at a cost); timeouts cap at 15 minutes; concurrency is limited per account/region (reserve and throttle to protect the LLM rate limit); cost is great at low volume and less efficient at sustained high volume.
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
