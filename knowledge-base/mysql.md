## MySQL

### What is a JOIN in MySQL, and what are its common types?
A `JOIN` combines rows from tables using a related condition. `INNER JOIN` returns matching rows; `LEFT JOIN` keeps every left row and fills unmatched right columns with `NULL`; `RIGHT JOIN` does the reverse. MySQL has no native `FULL OUTER JOIN`, but it can be assembled from a left join and the unmatched rows from a right-side query with `UNION`.

```sql
SELECT customers.name, orders.id
FROM customers
LEFT JOIN orders ON orders.customer_id = customers.id;
```

### How do you optimize a MySQL query?
Start with the actual query plan using `EXPLAIN` (or `EXPLAIN ANALYZE` where available). Add indexes that match selective filters, joins, and ordering; select only needed columns; keep predicates sargable; and avoid unnecessary sorting or duplicate elimination. Measure before and after with representative data—joins are not automatically faster than subqueries.

### What index types are commonly used in MySQL?
Common index forms include primary-key, unique, regular (non-unique), composite, `FULLTEXT`, and `SPATIAL` indexes. InnoDB organizes table rows around the primary key, so secondary indexes also carry primary-key values. Choose columns and order based on query patterns; every index consumes space and adds write cost.

### What is indexing, and why is it important?
An index is a data structure that helps MySQL locate rows without scanning the entire table. It can speed up filtering, joins, and sorting, but uses storage and must be maintained on inserts, updates, and deletes. Indexes should match real workload predicates, and unused or redundant indexes should be reviewed.

### How does a stored procedure differ from a function in MySQL?
A stored procedure is invoked with `CALL` and can return result sets or use `OUT` parameters; it is often used for a sequence of database operations. A stored function returns a value and can be used in expressions, subject to restrictions on side effects and statements. Use either when it meaningfully centralizes database logic; do not move logic into the database automatically.

### What is the difference between CHAR and VARCHAR?
`CHAR(n)` is fixed-length and is suited to values that are consistently short and fixed in size. `VARCHAR(n)` stores variable-length text up to the declared maximum and is suited to values with varying lengths. Actual storage and limits depend on character set and row format; choose based on the data rather than assuming `CHAR` is always faster.

### What is database normalization, and why is it useful?
Normalization organizes related data to reduce duplication and update anomalies. First normal form uses atomic values; second normal form removes partial dependency on part of a composite key; third normal form removes non-key attributes that depend on other non-key attributes. Normalize first for correctness, and denormalize selectively only after measuring a performance need.

### What storage engines does MySQL provide?
InnoDB is the default general-purpose engine and supports transactions, row-level locking, and foreign keys. MyISAM is a legacy non-transactional engine without foreign keys. Other engines such as MEMORY, NDB, or MyRocks may be available depending on the distribution and installation. Check the server’s supported engines before relying on one.

### How do you back up and restore a MySQL database?
For a logical backup, `mysqldump` can export schema and data; restore it with the `mysql` client. For a consistent InnoDB snapshot, use `--single-transaction`, and coordinate with writes or other engines as needed. Larger systems may use physical backups and binary logs for point-in-time recovery. Test restores regularly and protect backup credentials and files.

```bash
mysqldump --single-transaction -u app_user -p app_db > app_db.sql
mysql -u app_user -p app_db < app_db.sql
```

### What is a transaction in MySQL?
A transaction groups operations so they succeed or fail as a unit. With a transactional engine such as InnoDB, start with `START TRANSACTION`, then `COMMIT` to keep changes or `ROLLBACK` to undo them. Keep transactions short and handle errors so locks are not held longer than necessary.

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
UPDATE accounts SET balance = balance + 50 WHERE id = 2;
COMMIT;
```

### How can you find and handle duplicate records?
Define what makes a row a duplicate, then group by those columns to identify repeated values. Prefer preventing future duplicates with a `UNIQUE` constraint. Before removing existing duplicates, back up the data and verify which row should be retained; use a stable primary key to delete only extras.

```sql
SELECT email, COUNT(*) AS copies
FROM users
GROUP BY email
HAVING COUNT(*) > 1;
```

### What causes MySQL performance problems, and how do you address them?
Typical causes include full table scans, missing or poorly ordered indexes, expensive sorts, oversized result sets, lock contention, and insufficient memory or I/O capacity. Inspect slow-query logs and execution plans, improve the query or index, and measure again under realistic load. Check connections and contention before changing server settings.

### What are foreign keys and referential integrity?
A foreign key constrains values in one table to reference a candidate key in another table. Referential integrity prevents orphaned relationships and can define actions such as `CASCADE`, `RESTRICT`, or `SET NULL` for updates and deletes. In MySQL, use a supporting engine such as InnoDB and make the related column types and indexes compatible.

### What are the ACID properties?
ACID describes transaction guarantees: **Atomicity** means all-or-nothing; **Consistency** preserves defined constraints; **Isolation** controls interactions among concurrent transactions; **Durability** keeps committed data through failures. In MySQL, guarantees depend on the storage engine, transaction settings, and durability configuration.

### How do you implement full-text search in MySQL?
Create a `FULLTEXT` index on supported text columns and query it with `MATCH ... AGAINST`. MySQL supports natural-language and Boolean search modes. Check token-size, stopword, language, and engine behavior for your version, and use a dedicated search service if the relevance or scale requirements exceed what the database search provides.

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

### What are triggers, and how do you create one?
A trigger is SQL that runs automatically before or after an insert, update, or delete on a table. Triggers can enforce database-side rules or maintain audit data, but they introduce implicit behavior that can be difficult to trace. Keep them small, document them, and consider application-level logic when it is easier to test and maintain.

```sql
CREATE TRIGGER set_created_at
BEFORE INSERT ON articles
FOR EACH ROW
SET NEW.created_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP);
```

### What is table partitioning in MySQL?
Partitioning divides one logical table into smaller physical partitions based on a key or range, while queries still address the table normally. It can help manage large time-based datasets and enable partition pruning when predicates match the partition key. It is not a substitute for good indexes, and MySQL imposes constraints on partitioned tables, including unique-key requirements.

### What is MySQL replication?
Replication copies changes from a source server to one or more replicas, commonly through the binary log. It can support read scaling, reporting, and recovery, but asynchronous replication can lag and does not automatically provide safe failover. Monitor lag, configure replication consistently, and use a documented failover process.

### How do you handle deadlocks in MySQL?
A deadlock happens when transactions hold locks the others need, creating a cycle. InnoDB detects the cycle and rolls back one transaction. Keep transactions short, access rows in a consistent order, index update predicates, and retry the rolled-back transaction with bounded backoff when the operation is safe to repeat.

### How do you query the second-highest salary?
If “second highest” means the second distinct salary, use the maximum salary below the overall maximum. This returns `NULL` if fewer than two distinct non-`NULL` salaries exist. To retrieve employees tied at that salary, use `DENSE_RANK` instead.

```sql
SELECT MAX(salary) AS second_highest_salary
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

### How do you count students in each grade?
Group rows by grade and count each group. If grades with zero students should also appear, start from a separate grades table and use a `LEFT JOIN`.

```sql
SELECT grade, COUNT(*) AS student_count
FROM students
GROUP BY grade;
```
