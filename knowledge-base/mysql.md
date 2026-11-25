## MySQL

### What is a JOIN in MySQL, and what are its common types?
A `JOIN` combines rows from tables using a related condition. `INNER JOIN` returns matching rows; `LEFT JOIN` keeps every left row and fills unmatched right columns with `NULL`; `RIGHT JOIN` does the reverse. MySQL has no native `FULL OUTER JOIN`, but it can be assembled from a left join and the unmatched rows from a right-side query with `UNION`.


The join condition should express the relationship between rows, usually a primary key and foreign key. A missing or incomplete condition can create a Cartesian product and multiply rows unexpectedly. When checking for the existence of related rows without selecting their columns, `EXISTS` can express intent clearly.

```sql
SELECT customers.name, orders.id
FROM customers
LEFT JOIN orders ON orders.customer_id = customers.id;
```

### How do you optimize a MySQL query?
Start with the actual query plan using `EXPLAIN` (or `EXPLAIN ANALYZE` where available). Add indexes that match selective filters, joins, and ordering; select only needed columns; keep predicates sargable; and avoid unnecessary sorting or duplicate elimination. Measure before and after with representative data—joins are not automatically faster than subqueries.

An index is not automatically beneficial: it adds storage and slows writes, and the optimizer may correctly choose a table scan for small or low-selectivity data. Check actual row estimates and execution timing, then test one change at a time. Query plans should be evaluated using realistic table sizes and representative parameter values.

```sql
EXPLAIN ANALYZE
SELECT id, created_at
FROM orders
WHERE customer_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

### What index types are commonly used in MySQL?
Common index forms include primary-key, unique, regular (non-unique), composite, `FULLTEXT`, and `SPATIAL` indexes. InnoDB organizes table rows around the primary key, so secondary indexes also carry primary-key values. Choose columns and order based on query patterns; every index consumes space and adds write cost.

For a composite index, column order matters: a leading prefix can support some queries, but an index on `(a, b)` generally cannot efficiently serve a predicate on `b` alone. Unique indexes also enforce data integrity. Review existing indexes to prevent redundant overlap, and confirm optimizer use rather than adding every queried column.

```sql
CREATE INDEX idx_orders_customer_date
  ON orders (customer_id, created_at);

CREATE FULLTEXT INDEX idx_articles_text
  ON articles (title, body);
```

### What is indexing, and why is it important?
An index is a data structure that helps MySQL locate rows without scanning the entire table. It can speed up filtering, joins, and sorting, but uses storage and must be maintained on inserts, updates, and deletes. Indexes should match real workload predicates, and unused or redundant indexes should be reviewed.

Indexes are most effective when their leading columns match common equality filters, joins, or range scans. A covering index may satisfy a query without reading full table rows, but wide indexes increase memory and write costs. Use `EXPLAIN` and workload metrics to confirm that an index improves the queries that matter.

```sql
CREATE INDEX idx_users_email ON users (email);

SELECT id, name
FROM users
WHERE email = 'ada@example.com';
```

### How does a stored procedure differ from a function in MySQL?
A stored procedure is invoked with `CALL` and can return result sets or use `OUT` parameters; it is often used for a sequence of database operations. A stored function returns a value and can be used in expressions, subject to restrictions on side effects and statements. Use either when it meaningfully centralizes database logic; do not move logic into the database automatically.

Procedures are called explicitly and may perform multiple statements or return result sets; functions are embedded in expressions and return a scalar value. Privilege, replication, determinism, and binary logging rules can also influence which is appropriate. Keep database routines version-controlled and deploy them through the same migration process as schema changes.

```sql
DELIMITER //
CREATE PROCEDURE find_user(IN user_id BIGINT)
BEGIN
  SELECT id, email FROM users WHERE id = user_id;
END //
DELIMITER ;

CALL find_user(42);
```

### What is the difference between CHAR and VARCHAR?
`CHAR(n)` is fixed-length and is suited to values that are consistently short and fixed in size. `VARCHAR(n)` stores variable-length text up to the declared maximum and is suited to values with varying lengths. Actual storage and limits depend on character set and row format; choose based on the data rather than assuming `CHAR` is always faster.

Both declarations specify character lengths, not byte lengths, and the actual storage depends on the character set. `CHAR` values are padded according to MySQL behavior, while `VARCHAR` stores a length prefix plus the value. Avoid choosing `CHAR` for speed without measurement; compare semantics and maximum row size for the intended data.

```sql
CREATE TABLE country_codes (
  code CHAR(2) NOT NULL,
  display_name VARCHAR(100) NOT NULL
);
```

### What is database normalization, and why is it useful?
Normalization organizes related data to reduce duplication and update anomalies. First normal form uses atomic values; second normal form removes partial dependency on part of a composite key; third normal form removes non-key attributes that depend on other non-key attributes. Normalize first for correctness, and denormalize selectively only after measuring a performance need.

Normalization reduces update anomalies: a customer address should not need to be changed in every order row, for example. Foreign keys and unique constraints help enforce the resulting relationships. Highly normalized schemas may require more joins, but denormalizing should be driven by measured performance needs and kept consistent transactionally.

```sql
CREATE TABLE customers (
  id BIGINT PRIMARY KEY,
  name VARCHAR(200) NOT NULL
);

CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### What storage engines does MySQL provide?
InnoDB is the default general-purpose engine and supports transactions, row-level locking, and foreign keys. MyISAM is a legacy non-transactional engine without foreign keys. Other engines such as MEMORY, NDB, or MyRocks may be available depending on the distribution and installation. Check the server’s supported engines before relying on one.

Engine choice affects transaction support, locking, crash recovery, indexing features, and operational behavior. InnoDB is the default for most application data. Engines may differ by MySQL distribution and version, so inspect what the target server supports and test operational tasks such as backup, restore, and replication for that engine.

```sql
CREATE TABLE transactional_orders (
  id BIGINT PRIMARY KEY,
  total DECIMAL(10, 2) NOT NULL
) ENGINE=InnoDB;

SHOW ENGINES;
```

### How do you back up and restore a MySQL database?
For a logical backup, `mysqldump` can export schema and data; restore it with the `mysql` client. For a consistent InnoDB snapshot, use `--single-transaction`, and coordinate with writes or other engines as needed. Larger systems may use physical backups and binary logs for point-in-time recovery. Test restores regularly and protect backup credentials and files.


A backup is useful only if it can be restored within the required recovery time and data-loss objectives. Encrypt backups, restrict access, monitor completion, and retain copies outside the primary server or region. Coordinate schema changes and transactional consistency, then rehearse restores on an isolated environment.

```bash
mysqldump --single-transaction -u app_user -p app_db > app_db.sql
mysql -u app_user -p app_db < app_db.sql
```

### What is a transaction in MySQL?
A transaction groups operations so they succeed or fail as a unit. With a transactional engine such as InnoDB, start with `START TRANSACTION`, then `COMMIT` to keep changes or `ROLLBACK` to undo them. Keep transactions short and handle errors so locks are not held longer than necessary.


Transactions provide a way to group related changes, but they do not automatically make application workflows safe if errors are ignored. Use an exception-safe pattern that rolls back on failure, and keep the transaction scope narrow. DDL statements may cause implicit commits depending on the statement and server version.

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
UPDATE accounts SET balance = balance + 50 WHERE id = 2;
COMMIT;
```

### How can you find and handle duplicate records?
Define what makes a row a duplicate, then group by those columns to identify repeated values. Prefer preventing future duplicates with a `UNIQUE` constraint. Before removing existing duplicates, back up the data and verify which row should be retained; use a stable primary key to delete only extras.


The definition of duplicate must include the correct key columns and treatment of `NULL`, case, whitespace, and collation. Clean existing data before adding a unique constraint, otherwise constraint creation can fail. When removing duplicates, use a deterministic retention rule such as keeping the smallest ID or most recently verified row.

```sql
SELECT email, COUNT(*) AS copies
FROM users
GROUP BY email
HAVING COUNT(*) > 1;
```

### What causes MySQL performance problems, and how do you address them?
Typical causes include full table scans, missing or poorly ordered indexes, expensive sorts, oversized result sets, lock contention, and insufficient memory or I/O capacity. Inspect slow-query logs and execution plans, improve the query or index, and measure again under realistic load. Check connections and contention before changing server settings.

Application patterns such as N+1 queries or fetching whole result sets can create load even when each individual SQL statement looks simple. Correlate slow-query logs with traffic and wait events, then address the highest-impact issue first. Increasing memory or connection limits without diagnosis can worsen contention or cause resource exhaustion.

```sql
EXPLAIN
SELECT * FROM orders
WHERE customer_id = 42 AND status = 'paid';

CREATE INDEX idx_orders_customer_status
  ON orders (customer_id, status);
```

### What are foreign keys and referential integrity?
A foreign key constrains values in one table to reference a candidate key in another table. Referential integrity prevents orphaned relationships and can define actions such as `CASCADE`, `RESTRICT`, or `SET NULL` for updates and deletes. In MySQL, use a supporting engine such as InnoDB and make the related column types and indexes compatible.

Foreign keys are enforced by InnoDB and require compatible column definitions and suitable indexes. Cascading deletes can be convenient but may remove many rows implicitly, so choose actions that match the domain’s lifecycle. For large migrations, plan how to validate and add constraints without disrupting availability.

```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT
);
```

### What are the ACID properties?
ACID describes transaction guarantees: **Atomicity** means all-or-nothing; **Consistency** preserves defined constraints; **Isolation** controls interactions among concurrent transactions; **Durability** keeps committed data through failures. In MySQL, guarantees depend on the storage engine, transaction settings, and durability configuration.

ACID is a useful way to describe transactional guarantees, but isolation levels trade off concurrency against phenomena such as non-repeatable reads or phantom rows. InnoDB defaults and durability settings should be understood for the workload. Application retry logic must account for serialization failures and deadlocks without duplicating external side effects.

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 25 WHERE id = 1;
UPDATE accounts SET balance = balance + 25 WHERE id = 2;
COMMIT;
```

### How do you implement full-text search in MySQL?
Create a `FULLTEXT` index on supported text columns and query it with `MATCH ... AGAINST`. MySQL supports natural-language and Boolean search modes. Check token-size, stopword, language, and engine behavior for your version, and use a dedicated search service if the relevance or scale requirements exceed what the database search provides.


Full-text search tokenizes text and ranks matches differently from a substring `LIKE` search; it does not necessarily match short terms or every language equally. Keep the indexed columns and search expression aligned, and test results with real content. A search engine may be preferable for stemming, typo tolerance, faceting, or complex relevance tuning.

```sql
CREATE TABLE articles (
  id BIGINT PRIMARY KEY,
  title VARCHAR(255),
  body TEXT,
  FULLTEXT KEY articles_text (title, body)
);

SELECT id, title
FROM articles
WHERE MATCH(title, body) AGAINST ('laravel indexing' IN NATURAL LANGUAGE MODE);
```

### How do InnoDB and MyISAM differ?
InnoDB supports transactions, foreign keys, crash recovery, and row-level locking, making it the normal choice for application tables. MyISAM lacks transactions and foreign keys and uses table-level locking; it is generally legacy for modern transactional workloads. Choose an engine based on required guarantees, not old assumptions about read speed.

InnoDB’s row-level locking is subject to indexes and lock ranges; poorly indexed updates can still lock many rows. MyISAM’s lack of transactions means a multi-step update cannot be rolled back atomically. For most new transactional systems, InnoDB is the practical default, while legacy MyISAM tables should be assessed before migration.

```sql
CREATE TABLE payments (
  id BIGINT PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL
) ENGINE=InnoDB;
```

### What are triggers, and how do you create one?
A trigger is SQL that runs automatically before or after an insert, update, or delete on a table. Triggers can enforce database-side rules or maintain audit data, but they introduce implicit behavior that can be difficult to trace. Keep them small, document them, and consider application-level logic when it is easier to test and maintain.


Triggers execute in the context of a database statement and can make side effects invisible to application code. They are often appropriate for narrow audit or integrity tasks, but complex business workflows are usually easier to test in application services. Document trigger ordering and include them in schema migrations and disaster-recovery procedures.

```sql
CREATE TRIGGER set_created_at
BEFORE INSERT ON articles
FOR EACH ROW
SET NEW.created_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP);
```

### What is table partitioning in MySQL?
Partitioning divides one logical table into smaller physical partitions based on a key or range, while queries still address the table normally. It can help manage large time-based datasets and enable partition pruning when predicates match the partition key. It is not a substitute for good indexes, and MySQL imposes constraints on partitioned tables, including unique-key requirements.

Partitioning is most useful when queries filter on the partition key or operations can drop/archive entire partitions. It does not distribute one table automatically across servers and may complicate keys, foreign keys, and maintenance. Test partition pruning with `EXPLAIN` and compare against ordinary indexes before partitioning.

```sql
CREATE TABLE events (
  id BIGINT NOT NULL,
  occurred_on DATE NOT NULL,
  PRIMARY KEY (id, occurred_on)
)
PARTITION BY RANGE (YEAR(occurred_on)) (
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

### What is MySQL replication?
Replication copies changes from a source server to one or more replicas, commonly through the binary log. It can support read scaling, reporting, and recovery, but asynchronous replication can lag and does not automatically provide safe failover. Monitor lag, configure replication consistently, and use a documented failover process.

Replication is commonly asynchronous, so replicas may serve stale reads and can lag under heavy writes or network interruptions. Do not assume a replica is a current backup or that promoting it is automatic. Applications need a defined read-after-write strategy, monitoring, and tested failover and rejoin procedures.

```text
Example flow: `source server (binary log) → replica (relay log) → replica data`. Configure source and replica with unique server IDs, then monitor replication status and lag with the commands supported by your MySQL version.
```

### How do you handle deadlocks in MySQL?
A deadlock happens when transactions hold locks the others need, creating a cycle. InnoDB detects the cycle and rolls back one transaction. Keep transactions short, access rows in a consistent order, index update predicates, and retry the rolled-back transaction with bounded backoff when the operation is safe to repeat.

A deadlock is a concurrency outcome rather than necessarily a database defect; the victim transaction must be retried from the beginning. Make retries bounded and idempotent, with short randomized backoff where appropriate. Consistent row-lock ordering and selective indexes reduce deadlock probability, but cannot eliminate it under all concurrent workloads.

```sql
START TRANSACTION;
UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 7;
COMMIT;

-- In application code, retry the whole transaction a small, bounded number of times
-- when MySQL reports a deadlock (error 1213).
```

### How do you query the second-highest salary?
If “second highest” means the second distinct salary, use the maximum salary below the overall maximum. This returns `NULL` if fewer than two distinct non-`NULL` salaries exist. Clarify whether the interviewer wants a salary value, one employee row, or all employees tied at that salary; use `DENSE_RANK()` for the last case.


Clarify whether ties count as one distinct salary or whether the second row in sorted order is intended. The shown query returns the second distinct value; `LIMIT` with an offset can produce a different answer when salaries tie. Use window functions such as `DENSE_RANK()` when the result must include all employees at that salary.

```sql
SELECT MAX(salary) AS second_highest_salary
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

### How do you count students in each grade?
Group rows by grade and count each group. If grades with zero students should also appear, start from a separate grades table and use a `LEFT JOIN`.


If a grade has no students, a query starting from the students table cannot return it. Drive the query from a grades table and left join students, placing filters on the joined table in the join condition so the left join does not turn into an inner join. Count a non-null student key rather than `COUNT(*)` in that case.

```sql
SELECT grade, COUNT(*) AS student_count
FROM students
GROUP BY grade;
```

### What are transaction isolation levels in MySQL?
Isolation determines which changes a transaction can observe while other transactions run. InnoDB supports `READ UNCOMMITTED`, `READ COMMITTED`, `REPEATABLE READ`, and `SERIALIZABLE`; its default is `REPEATABLE READ`. Stronger isolation can prevent more anomalies but may increase locking or retries. Explain the actual business invariant first, then choose an isolation level or explicit locking that preserves it. Test concurrent behavior because a single-session query cannot reveal races.

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT balance FROM accounts WHERE id = 7 FOR UPDATE;
-- Perform related writes, then COMMIT or ROLLBACK.
```

### How do you find the top three salaries in each department?
Use `ROW_NUMBER()` when exactly three rows per department are needed, with a stable tiebreaker such as employee ID. Use `DENSE_RANK()` when all employees tied at the third distinct salary should be included. Window functions are available in MySQL 8.0 and later. Filtering the window result requires an outer query because window expressions are evaluated after the `WHERE` clause.

```sql
WITH ranked AS (
  SELECT id, department_id, salary,
         ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC, id) AS rn
  FROM employees
)
SELECT id, department_id, salary FROM ranked WHERE rn <= 3;
```

### How do you calculate a running total in MySQL?
A windowed `SUM()` adds rows in the specified order without collapsing them into one group. Include a unique tiebreaker so rows with the same date produce a deterministic sequence. The explicit `ROWS` frame avoids surprising peer grouping. For an account ledger, partition by account so each account has its own running balance.

```sql
SELECT account_id, posted_at, id, amount,
       SUM(amount) OVER (
         PARTITION BY account_id ORDER BY posted_at, id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_total
FROM ledger_entries;
```

### How do you find consecutive date ranges with gaps and islands?
An island is a run of consecutive dates; a gap separates two runs. One approach assigns `ROW_NUMBER()` to distinct dates and subtracts that sequence from each date. Consecutive dates get the same grouping key. Deduplicate first when several rows can share a date, and decide whether weekends or missing business days should count as gaps.

```sql
WITH days AS (
  SELECT DISTINCT activity_date FROM activity
), numbered AS (
  SELECT activity_date, ROW_NUMBER() OVER (ORDER BY activity_date) AS rn
  FROM days
), islands AS (
  SELECT activity_date, DATE_SUB(activity_date, INTERVAL rn DAY) AS island_key
  FROM numbered
)
SELECT MIN(activity_date) AS start_date, MAX(activity_date) AS end_date
FROM islands GROUP BY island_key ORDER BY start_date;
```

### Why can keyset pagination outperform OFFSET pagination?
`LIMIT ... OFFSET` often makes the database examine and skip earlier rows as the page number grows, and concurrent inserts can shift results between pages. Keyset pagination resumes after the last seen sort key, allowing an index to find the next page efficiently. Use a deterministic order that includes a unique key, and carry both ordered values in the cursor. Keyset pagination is best for next or previous navigation rather than jumping directly to an arbitrary page number.

```sql
CREATE INDEX idx_posts_created_id ON posts (created_at DESC, id DESC);
SELECT id, title, created_at
FROM posts
WHERE created_at < :last_created_at
   OR (created_at = :last_created_at AND id < :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```
