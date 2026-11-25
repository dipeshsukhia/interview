## MySQL

### What is a JOIN in MySQL, and what are its common types?
- **INNER JOIN** — only rows with matches in both tables.
- **LEFT JOIN** — all rows from the left table, matched rows from the right (NULL where no match).
- **RIGHT JOIN** — mirror of LEFT JOIN.
- **FULL OUTER JOIN** — all rows from both sides (MySQL doesn't support this directly — emulated via `LEFT JOIN UNION RIGHT JOIN`).
- **CROSS JOIN** — Cartesian product, every row of A with every row of B.
- **SELF JOIN** — a table joined to itself, e.g., finding employees and their managers in the same `employees` table.

### How do you optimize a MySQL query?
`EXPLAIN` the query first to see the execution plan — check for full table scans (`type: ALL`), missing index usage, large `rows examined`. Then: add appropriate indexes matching `WHERE`/`JOIN`/`ORDER BY` columns, avoid `SELECT *` (fetch only needed columns), avoid functions on indexed columns in `WHERE` (`WHERE YEAR(created_at) = 2024` can't use an index on `created_at`; rewrite as a range instead), check if a composite index's column order matches the query, and check the slow query log for the actual patterns hitting production rather than guessing.

### What index types are commonly used in MySQL?
An index is a data structure (typically a B-Tree, or hash for MEMORY tables) that speeds up lookups at the cost of extra storage and slower writes (every insert/update/delete has to update the index too).
- **Primary index** — on the primary key.
- **Unique index** — enforces uniqueness.
- **Composite (multi-column) index** — covers multiple columns; column order matters — a composite index on `(a, b)` helps queries filtering on `a` alone or `a AND b`, but not `b` alone.
- **Full-text index** — for `MATCH() AGAINST()` text search.
- **Covering index** — an index that contains every column a query needs, so MySQL never touches the actual table row.

### What is indexing, and why is it important?
An index is a data structure (typically a B-Tree, or hash for MEMORY tables) that speeds up lookups at the cost of extra storage and slower writes (every insert/update/delete has to update the index too).
- **Primary index** — on the primary key.
- **Unique index** — enforces uniqueness.
- **Composite (multi-column) index** — covers multiple columns; column order matters — a composite index on `(a, b)` helps queries filtering on `a` alone or `a AND b`, but not `b` alone.
- **Full-text index** — for `MATCH() AGAINST()` text search.
- **Covering index** — an index that contains every column a query needs, so MySQL never touches the actual table row.

### How does a stored procedure differ from a function in MySQL?
A stored procedure is invoked with `CALL` and can return result sets or use `OUT` parameters; it is often used for a sequence of database operations. A stored function returns a value and can be used in expressions, subject to restrictions on side effects and statements. Use either when it meaningfully centralizes database logic; do not move logic into the database automatically.

Procedures are called explicitly and may perform multiple statements or return result sets; functions are embedded in expressions and return a scalar value.

- Privilege, replication, determinism, and binary logging rules can also influence which is appropriate.
- Keep database routines version-controlled and deploy them through the same migration process as schema changes.

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
`CHAR(n)` is fixed-length — always stores `n` bytes/chars, padded with spaces, slightly faster for fixed-size data (e.g., country codes). `VARCHAR(n)` is variable-length — stores only the actual content plus 1-2 bytes for length, better for data that varies in size (names, emails).

### What is database normalization, and why is it useful?
The process of structuring tables to reduce data redundancy and avoid update anomalies.
- **1NF** — atomic columns, no repeating groups (e.g., don't store `phone1, phone2, phone3` — use a separate table).
- **2NF** — 1NF + every non-key column depends on the *whole* primary key (relevant for composite keys — no partial dependency).
- **3NF** — 2NF + no transitive dependency (a non-key column shouldn't depend on another non-key column).
In practice, most production schemas target 3NF, then deliberately denormalize specific tables for read performance where justified (e.g., a cached `orders_count` on a `users` table).

### What storage engines does MySQL provide?
InnoDB is the default general-purpose engine and supports transactions, row-level locking, and foreign keys. MyISAM is a legacy non-transactional engine without foreign keys. Other engines such as MEMORY, NDB, or MyRocks may be available depending on the distribution and installation. Check the server’s supported engines before relying on one.

Engine choice affects transaction support, locking, crash recovery, indexing features, and operational behavior.

- InnoDB is the default for most application data.
- Engines may differ by MySQL distribution and version, so inspect what the target server supports and test operational tasks such as backup, restore, and replication for that engine.

```sql
CREATE TABLE transactional_orders (
  id BIGINT PRIMARY KEY,
  total DECIMAL(10, 2) NOT NULL
) ENGINE=InnoDB;

SHOW ENGINES;
```

### How do you back up and restore a MySQL database?
For a logical backup, `mysqldump` can export schema and data; restore it with the `mysql` client. For a consistent InnoDB snapshot, use `--single-transaction`, and coordinate with writes or other engines as needed. Larger systems may use physical backups and binary logs for point-in-time recovery. Test restores regularly and protect backup credentials and files.


A backup is useful only if it can be restored within the required recovery time and data-loss objectives.

- Encrypt backups, restrict access, monitor completion, and retain copies outside the primary server or region.
- Coordinate schema changes and transactional consistency, then rehearse restores on an isolated environment.

```bash
mysqldump --single-transaction -u app_user -p app_db > app_db.sql
mysql -u app_user -p app_db < app_db.sql
```

### What is a transaction in MySQL?
A transaction is a group of operations executed as a single atomic unit.
- **Atomicity** — all operations succeed or none do.
- **Consistency** — the DB moves from one valid state to another, respecting constraints.
- **Isolation** — concurrent transactions don't interfere with each other's intermediate state.
- **Durability** — once committed, changes survive a crash.

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT; -- or ROLLBACK on failure
```

### How can you find and handle duplicate records?
```sql
SELECT email, COUNT(*) AS cnt
FROM users
GROUP BY email
HAVING COUNT(*) > 1;
```

### What causes MySQL performance problems, and how do you address them?
Typical causes include full table scans, missing or poorly ordered indexes, expensive sorts, oversized result sets, lock contention, and insufficient memory or I/O capacity. Inspect slow-query logs and execution plans, improve the query or index, and measure again under realistic load. Check connections and contention before changing server settings.

Application patterns such as N+1 queries or fetching whole result sets can create load even when each individual SQL statement looks simple.

- Correlate slow-query logs with traffic and wait events, then address the highest-impact issue first.
- Increasing memory or connection limits without diagnosis can worsen contention or cause resource exhaustion.

```sql
EXPLAIN
SELECT * FROM orders
WHERE customer_id = 42 AND status = 'paid';

CREATE INDEX idx_orders_customer_status
  ON orders (customer_id, status);
```

### What are foreign keys and referential integrity?
Primary key — uniquely identifies each row, cannot be NULL, one per table (can be composite). Foreign key — a column referencing a primary/unique key in another table, enforcing referential integrity. Unique key — enforces uniqueness like a primary key but allows NULLs (MySQL allows multiple NULLs in a unique column) and a table can have several.

### What are the ACID properties?
A transaction is a group of operations executed as a single atomic unit.
- **Atomicity** — all operations succeed or none do.
- **Consistency** — the DB moves from one valid state to another, respecting constraints.
- **Isolation** — concurrent transactions don't interfere with each other's intermediate state.
- **Durability** — once committed, changes survive a crash.

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT; -- or ROLLBACK on failure
```

### How do you implement full-text search in MySQL?
Create a `FULLTEXT` index on supported text columns and query it with `MATCH ... AGAINST`. MySQL supports natural-language and Boolean search modes. Check token-size, stopword, language, and engine behavior for your version, and use a dedicated search service if the relevance or scale requirements exceed what the database search provides.


Full-text search tokenizes text and ranks matches differently from a substring `LIKE` search; it does not necessarily match short terms or every language equally.

- Keep the indexed columns and search expression aligned, and test results with real content.
- A search engine may be preferable for stemming, typo tolerance, faceting, or complex relevance tuning.

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
InnoDB — supports transactions (ACID), foreign keys, row-level locking, crash recovery; the default in modern MySQL and what you should use for almost everything. MyISAM — no transactions, table-level locking (worse for concurrent writes), no foreign keys, but historically faster for read-heavy, write-rarely workloads and full-text search (though InnoDB supports full-text now too). In practice, default to InnoDB unless you have a very specific legacy reason not to.

### What are triggers, and how do you create one?
- **Stored procedure** — a saved, callable block of SQL logic (`CALL my_procedure()`), can take parameters, useful for encapsulating complex multi-statement logic in the DB layer (though in a Laravel app I'd generally keep business logic in the application, not the DB, unless there's a specific performance/atomicity reason).
- **Trigger** — code that runs automatically on `INSERT`/`UPDATE`/`DELETE` against a table (`BEFORE`/`AFTER`). Useful for audit logging or enforcing invariants at the DB level, but can be a debugging headache since the logic is invisible from application code.
- **View** — a saved, named query that behaves like a virtual table (`CREATE VIEW active_users AS SELECT * FROM users WHERE status = 'active'`) — good for simplifying repeated complex joins/reporting queries.

### What is table partitioning in MySQL?
Partitioning divides one logical table into smaller physical partitions based on a key or range, while queries still address the table normally. It can help manage large time-based datasets and enable partition pruning when predicates match the partition key. It is not a substitute for good indexes, and MySQL imposes constraints on partitioned tables, including unique-key requirements.

Partitioning is most useful when queries filter on the partition key or operations can drop/archive entire partitions.

- It does not distribute one table automatically across servers and may complicate keys, foreign keys, and maintenance.
- Test partition pruning with `EXPLAIN` and compare against ordinary indexes before partitioning.

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

Replication is commonly asynchronous, so replicas may serve stale reads and can lag under heavy writes or network interruptions.

- Do not assume a replica is a current backup or that promoting it is automatic.
- Applications need a defined read-after-write strategy, monitoring, and tested failover and rejoin procedures.

```text
Example flow: `source server (binary log) → replica (relay log) → replica data`. Configure source and replica with unique server IDs, then monitor replication status and lag with the commands supported by your MySQL version.
```

### How do you handle deadlocks in MySQL?
Two transactions each hold a lock the other needs, so both wait forever. MySQL/InnoDB detects this automatically and kills one transaction (rolls it back) with an error. Application-side, you catch that specific error and retry the transaction — Laravel's `DB::transaction($callback, $attempts)` accepts a retry count for exactly this reason. Reducing deadlock likelihood: always acquire locks/update rows in a consistent order across your codebase, keep transactions short, and index columns used in `WHERE` clauses of locking queries so you're not locking more rows than necessary.

### How do you query the second-highest salary?
```sql
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```
Or the more general "Nth highest" using window functions (MySQL 8+):
```sql
SELECT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
  FROM employees
) ranked
WHERE rnk = 2;
```

### How do you count students in each grade?
Group rows by grade and count each group. If grades with zero students should also appear, start from a separate grades table and use a `LEFT JOIN`.


If a grade has no students, a query starting from the students table cannot return it.

- Drive the query from a grades table and left join students, placing filters on the joined table in the join condition so the left join does not turn into an inner join.
- Count a non-null student key rather than `COUNT(*)` in that case.

```sql
SELECT grade, COUNT(*) AS student_count
FROM students
GROUP BY grade;
```

### What are transaction isolation levels in MySQL?
`READ UNCOMMITTED` (dirty reads possible) → `READ COMMITTED` (no dirty reads, but non-repeatable reads possible) → `REPEATABLE READ` (MySQL/InnoDB's default — no dirty or non-repeatable reads, but phantom rows possible in theory, though InnoDB's gap locking largely prevents this too) → `SERIALIZABLE` (fully isolated, effectively serial execution, most locking/slowest).

### How do you find the top three salaries in each department?
```sql
SELECT name, department_id, salary
FROM (
  SELECT name, department_id, salary,
         ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn
  FROM employees
) ranked
WHERE rn <= 3;
```

### How do you calculate a running total in MySQL?
```sql
SELECT customer_id, order_date, total,
       SUM(total) OVER (PARTITION BY customer_id ORDER BY order_date) AS running_total
FROM orders;
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

### How do DELETE, TRUNCATE, and DROP differ?
- `DELETE FROM table WHERE ...` — removes rows (optionally filtered), logged row-by-row, can be rolled back in a transaction, triggers fire, auto-increment counter is untouched.
- `TRUNCATE TABLE table` — removes *all* rows, faster (deallocates and recreates the table internally), resets auto-increment, cannot be rolled back on most storage engines (though InnoDB in a transaction can partially handle it depending on version), doesn't fire row-level triggers.
- `DROP TABLE table` — removes the entire table structure and data permanently.

### How do WHERE and HAVING differ?
`WHERE` filters rows *before* grouping/aggregation. `HAVING` filters *after* `GROUP BY`, so it's used to filter on aggregate results (`COUNT`, `SUM`, etc.) which `WHERE` can't reference.

```sql
SELECT department, COUNT(*) AS emp_count
FROM employees
WHERE status = 'active'
GROUP BY department
HAVING COUNT(*) > 5;
```

### How do primary, foreign, and unique keys differ?
Primary key — uniquely identifies each row, cannot be NULL, one per table (can be composite). Foreign key — a column referencing a primary/unique key in another table, enforcing referential integrity. Unique key — enforces uniqueness like a primary key but allows NULLs (MySQL allows multiple NULLs in a unique column) and a table can have several.

### What are clustered and secondary indexes in InnoDB?
A clustered index determines the physical order data is stored in the table — in InnoDB, the primary key *is* the clustered index, so the table's actual rows are stored in primary-key order. A non-clustered (secondary) index is a separate structure that stores the indexed column(s) plus a pointer back to the primary key, requiring an extra lookup ("bookmark lookup") to fetch the full row.

### What is the difference between a procedure, trigger, and view?
- **Stored procedure** — a saved, callable block of SQL logic (`CALL my_procedure()`), can take parameters, useful for encapsulating complex multi-statement logic in the DB layer (though in a Laravel app I'd generally keep business logic in the application, not the DB, unless there's a specific performance/atomicity reason).
- **Trigger** — code that runs automatically on `INSERT`/`UPDATE`/`DELETE` against a table (`BEFORE`/`AFTER`). Useful for audit logging or enforcing invariants at the DB level, but can be a debugging headache since the logic is invisible from application code.
- **View** — a saved, named query that behaves like a virtual table (`CREATE VIEW active_users AS SELECT * FROM users WHERE status = 'active'`) — good for simplifying repeated complex joins/reporting queries.

### How do UNION and UNION ALL differ?
`UNION` combines result sets and removes duplicate rows (implicit `DISTINCT`, extra cost). `UNION ALL` keeps duplicates and is faster since it skips the dedup step — use it whenever you know there won't be duplicates or don't care.

### How do you delete duplicate users while keeping the earliest row?
```sql
DELETE u1 FROM users u1
INNER JOIN users u2
  ON u1.email = u2.email AND u1.id > u2.id;
```

### How do you find employees who earn more than their manager?
```sql
SELECT e.name AS employee, e.salary, m.name AS manager, m.salary AS manager_salary
FROM employees e
JOIN employees m ON e.manager_id = m.id
WHERE e.salary > m.salary;
```

### How do you find the latest order for each customer?
```sql
SELECT o.*
FROM orders o
JOIN (
  SELECT customer_id, MAX(order_date) AS max_date
  FROM orders
  GROUP BY customer_id
) latest ON o.customer_id = latest.customer_id AND o.order_date = latest.max_date;
```

### How do you find missing IDs in a sequence?
```sql
SELECT (t1.id + 1) AS gap_start
FROM employees t1
LEFT JOIN employees t2 ON t1.id + 1 = t2.id
WHERE t2.id IS NULL
ORDER BY t1.id;
```

### Get department-wise employee count, sorted descending.
```sql
SELECT d.name AS department, COUNT(e.id) AS employee_count
FROM departments d
LEFT JOIN employees e ON e.department_id = d.id
GROUP BY d.id, d.name
ORDER BY employee_count DESC;
```

### Find customers who placed orders in every month of 2024 (a "gaps and islands" style question).
```sql
SELECT customer_id
FROM orders
WHERE YEAR(order_date) = 2024
GROUP BY customer_id
HAVING COUNT(DISTINCT MONTH(order_date)) = 12;
```

### Find employees with no assigned department (LEFT JOIN with NULL check).
```sql
SELECT e.*
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
WHERE d.id IS NULL;
```

### Pagination — get rows 21–30 (page 3, 10 per page).
```sql
SELECT * FROM employees ORDER BY id LIMIT 10 OFFSET 20;
```
Note for interviews: `OFFSET` gets progressively slower on large tables since MySQL still scans and discards the skipped rows. For deep pagination, "keyset pagination" is the better answer:
```sql
SELECT * FROM employees WHERE id > 20 ORDER BY id LIMIT 10;
```

### Update a column based on a join (raise salary 10% for a specific department).
```sql
UPDATE employees e
JOIN departments d ON e.department_id = d.id
SET e.salary = e.salary * 1.10
WHERE d.name = 'Engineering';
```

### Database index; when it hurts; N+1?
Index: a separate sorted structure (usually a B-tree) that lets the database find rows without scanning the table. Speeds up WHERE, JOIN, and ORDER BY on indexed columns.
When it hurts: every insert, update and delete must also update each index (slower writes); indexes consume disk and memory; low-selectivity columns (like a boolean) rarely help; too many indexes confuse the planner and bloat storage.
N+1: one query loads N parent rows, then N more queries load each child. Example: list 100 jobs, then query documents for each job in a loop = 101 queries. Fix with a join, selectinload/joinedload in SQLAlchemy, or a single WHERE job_id IN (...) query.
Follow-up: find a slow query in production: enable pg_stat_statements or the slow query log, look at APM traces (New Relic shows DB time per transaction), run EXPLAIN (ANALYZE, BUFFERS) on the offender, check for sequential scans and missing indexes, then add the index or rewrite the query and verify with before/after timings.
