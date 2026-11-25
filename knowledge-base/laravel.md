## Laravel

### Walk through what happens from the moment a request hits `public/index.php` to the response being sent.
`index.php` loads the Composer autoloader, bootstraps the app via `bootstrap/app.php` (creates the Application container), resolves an HTTP Kernel from the container, and calls `$kernel->handle($request)`. The kernel runs bootstrappers (load env, config, register facades, register providers, boot providers), then sends the request through the global middleware stack, dispatches it to the router, which matches a route, runs route-level middleware, resolves the controller via the container (dependency injection), executes it, and returns a `Response`. The kernel then sends the response and runs `terminate()` on terminable middleware.

### Explain the difference between the Service Container and Service Providers.
The container is a dependency injection tool — it resolves classes and their dependencies automatically, and lets you bind interfaces to concrete implementations (`bind`, `singleton`, `instance`). Service Providers are the *place* where you configure the container — they have `register()` (only bind things, no dependencies resolved yet) and `boot()` (safe to use bound services since all providers are registered by then).

### When would you use `bind` vs `singleton` vs `scoped`?
`bind` — new instance every resolution (e.g., stateless value objects). `singleton` — one instance per application lifecycle (e.g., a service that maintains state or is expensive to construct, like a payment gateway client). `scoped` — like singleton but resets per request in long-running processes (Octane), important so you don't leak state between requests.

### What's the difference between Facades and Dependency Injection? When do you prefer one over the other?
Facades are static proxies to objects resolved from the container — convenient, testable via `Facade::shouldReceive()`, but they hide dependencies and can encourage tight coupling if overused. I prefer constructor/method injection in service classes for explicitness and testability, and reserve facades for quick usage in controllers or config-driven bootstrapping.

### How do you solve the N+1 query problem, and how do you catch it before it ships?
Eager load with `with()`, `load()`, or `loadMissing()`. To catch it in dev, use `Model::preventLazyLoading()` in `AppServiceProvider::boot()` (throws in local/testing), or tools like Laravel Debugbar / Telescope to inspect query counts. In CI, I've written tests that assert query count doesn't exceed a threshold using `DB::listen()`.

### Explain the difference between `with()`, `load()`, `withCount()`, and `loadCount()`.
`with()` eager loads on a fresh query. `load()` lazy-loads a relation on an already-fetched model/collection. `withCount()` adds a `{relation}_count` attribute via a subquery at query time. `loadCount()` does the same but after the fact on already-loaded models.

### How do database transactions work in Laravel, and what are the pitfalls?
`DB::transaction(fn () => ...)` wraps in BEGIN/COMMIT with auto-rollback on exception; deadlocks can trigger automatic retries via the second argument (attempts). Pitfalls: nested transactions use savepoints depending on driver, transactions don't protect against race conditions without row locking (`lockForUpdate()`, `sharedLock()`), and long transactions holding locks can cause contention under load. I've also had to be careful with queued jobs dispatched *inside* a transaction — they should fire after commit (`afterCommit` config or `DB::transaction` + `ShouldQueueAfterCommit`), otherwise a worker can pick up a job referencing a row that isn't committed yet.

### Explain multi-tenancy strategies you've implemented and their trade-offs.
Three common approaches: (1) single database with a `tenant_id` column + global scope — simplest, cheapest, but risk of data leakage if scope is forgotten; (2) database-per-tenant — strong isolation, easier compliance, but harder migrations/maintenance at scale; (3) schema-per-tenant (Postgres) — middle ground. In my ERP/SMS systems I used approach (1) with a global scope applied via a trait + middleware that resolves tenant from the authenticated user/subdomain, and I always paired it with policy-level checks as defense in depth, not just the scope.

### What's the difference between `chunk()`, `chunkById()`, `cursor()`, and `lazy()`?
`chunk()` — paginated queries, but reordering/deleting rows mid-loop can skip records. `chunkById()` — safer for that because it orders and filters by a unique id boundary. `cursor()` — uses a PHP generator with a single query, low memory, but keeps the DB connection open ⇒ not ideal for huge write-heavy loops. `lazy()` — combines chunking with the generator interface, good default for "loop over millions of rows."

### How do you design indexes for a Laravel app under real production load?
Look at actual query patterns from Telescope/slow query log rather than guessing. Composite indexes matching WHERE + ORDER BY column order, covering indexes for read-heavy endpoints, and being deliberate about foreign key indexes (Laravel doesn't always add them). I also watch for indexes that hurt write-heavy tables (e.g., high-frequency `machine_logs` in the ERP system) and consider partitioning or archiving old rows instead of over-indexing.

### Explain how the queue system works end to end (dispatch → processing → completion).
`dispatch()` serializes the job (via `SerializesModels`, storing model IDs not full objects) and pushes it onto a driver (Redis/database/SQS). A worker (`queue:work`) polls, pops the job, deserializes it, and calls `handle()`. On success it's deleted from the queue; on failure it's released for retry (respecting `$tries`, `backoff()`) or sent to `failed_jobs` after exhausting attempts, triggering `failed()` if defined.

### How do you ensure a job is idempotent?
Design `handle()` so running it twice has the same effect as once — e.g., use `updateOrCreate` instead of `create`, check state before acting ("has this invoice already been marked paid?"), or use unique job middleware (`ShouldBeUnique` / `WithoutOverlapping`) to prevent duplicate dispatch in the first place. Idempotency matters because queue drivers guarantee at-least-once delivery, not exactly-once.

### Jobs vs Events vs Listeners — when do you use which?
Events are for "something happened" — decoupled, can have multiple listeners, some sync some queued. Jobs are for "do this specific unit of work," typically dispatched directly when you know exactly what needs to happen next. I use events when multiple unrelated parts of the system need to react to the same trigger (e.g., `OrderShipped` triggering an email, an inventory update, and an analytics ping via separate listeners), and jobs when it's a single, well-defined async task.

### How do you handle a queue worker that's stuck or a job that's failing silently in production?
Check `failed_jobs` table / Horizon dashboard, use `queue:retry`, and instrument jobs with logging at start/end plus a timeout (`$timeout` property or `--timeout` flag) so a hung job gets killed and retried rather than blocking a worker forever. I've also added Horizon alerting on queue wait time to catch backlog before it becomes an outage.

### What's `ShouldBeUnique` vs `WithoutOverlapping` middleware?
`ShouldBeUnique` prevents the *same* job (by a unique key) from being queued again while one is already on the queue/processing. `WithoutOverlapping` (job middleware) prevents concurrent *execution* of jobs sharing a key, releasing the second one back with a delay instead of dropping it.

### How do you version your APIs?
URI versioning (`/api/v1/...`) for simplicity and cache-friendliness, or header-based versioning when clients need more flexibility. I keep versioned controllers thin and share logic through services/DTOs so v1 and v2 aren't duplicating business logic.

### How do you handle API resource transformation — API Resources vs manual arrays vs DTOs?
API Resources (`JsonResource`) for consistent, testable output shaping with conditional attributes (`whenLoaded`, `when`). For complex domains I add a DTO/data-transfer layer between the service and resource so the resource isn't reaching into raw Eloquent internals. Avoids leaking DB structure directly into API contracts.

### How do you approach rate limiting and throttling?
`throttle` middleware backed by Redis for accuracy across multiple app servers, tiered limits per authenticated client/plan using `Limit::perMinute()->by($user->id)` in `RateLimiter::for()`, and returning proper `429` + `Retry-After` headers.

### How do you design for backward compatibility when changing a response shape?
Additive changes only within a version (new optional fields), never rename/remove without a version bump; use API Resources so shape changes are centralized; contract tests against consumer expectations where possible.

### Sanctum vs Passport vs custom token auth — how do you choose?
Sanctum for SPA/mobile apps needing simple token or cookie-based auth within your own ecosystem — lightweight, no OAuth overhead. Passport when you need full OAuth2 (third-party integrations, "Login with X" style, scopes/grants). I've used Sanctum for internal mobile apps (NativePHP) talking to a Laravel backend I control.

### How do you implement RBAC in Laravel — package vs custom?
Depends on complexity. For straightforward role/permission needs I've built custom pivot-table-based RBAC (roles, permissions, role_permission, model_has_roles) wrapped in Gate/Policy checks — full control, no package overhead. For more complex needs I'd reach for Spatie's permission package. I always back authorization with Policies (`can()`, `@can` in Blade, `authorize()` in controllers/FormRequests) rather than scattering `if` checks.

### Explain mass assignment vulnerabilities and how Laravel protects against them.
If you `Model::create($request->all())` without `$fillable`/`$guarded`, an attacker can inject unexpected fields (e.g., `is_admin=1`) into the request and have them written to the DB. Laravel's `$fillable` whitelist (or `$guarded` blacklist) prevents unlisted attributes from being mass-assigned. I always use `$fillable` explicitly and validate via FormRequests rather than relying on guarded-everything-except.

### How do you prevent SQL injection when you must write raw queries?
Parameter binding — `DB::select('... where id = ?', [$id])` or named bindings — never string-interpolate user input into raw SQL, including in `whereRaw`/`orderByRaw`.

### How do you secure a multi-tenant app against cross-tenant data leakage?
Global scopes tied to the authenticated tenant, policy checks as a second layer, tests that specifically try to access another tenant's resource and assert 403/404, and avoiding any query that touches tenant-scoped tables without going through the model (raw queries bypass global scopes).

### How do you structure your test suite (unit vs feature vs browser)?
Feature tests dominate — they hit routes through the full HTTP stack (middleware, validation, auth) and give the most confidence per line of test code. Unit tests for isolated business logic (services, calculators, value objects) where mocking dependencies makes sense. Browser/Dusk tests sparingly, for critical user flows only, since they're slow and brittle.

### How do you test jobs, events, and mail without actually sending/processing them?
`Queue::fake()`, `Event::fake()`, `Mail::fake()`, `Bus::fake()` — then assert with `Queue::assertPushed(SomeJob::class, function ($job) { ... })` etc. This tests that the *dispatch* happened correctly without executing side effects, and I test the job's `handle()` logic separately in its own unit/feature test.

### How do you handle test database setup — `RefreshDatabase` vs transactions vs separate test DB?
`RefreshDatabase` trait (migrates once, wraps each test in a transaction that rolls back) for most feature tests — fast and isolated. For very large suites I've used `DatabaseTruncation` selectively or an in-memory SQLite DB when the app doesn't rely on MySQL-specific features, to speed up CI.

### How do you avoid flaky tests around time-dependent logic?
`Carbon::setTestNow()` / `$this->travel()` / `$this->freezeTime()` to control "now" deterministically instead of relying on real clock timing.

### The app is slow under load — walk me through how you'd diagnose it.
Start with data: APM (New Relic, Blackfire) or Telescope in staging to see slow requests, N+1s, slow queries. Check DB — slow query log, missing indexes, lock contention. Check queue backlog if async work is involved. Check for blocking I/O in the request cycle (external API calls that should be queued instead). Then look at infra — PHP-FPM worker count vs concurrency, opcache enabled, whether Octane/Swoole is viable for the workload. I fix in order of impact, not the first thing I notice.

### How would you use Laravel Octane, and what changes about how you write code?
Octane (via Swoole/RoadRunner) keeps the app booted in memory across requests instead of bootstrapping fresh each time — big throughput gains. The catch: singletons and static state persist between requests, so anything that used to be "reset automatically each request" (e.g., a service accumulating state, or a container binding holding a stale DB connection/user) can leak across requests. You need to be deliberate with `scoped()` bindings and avoid storing per-request state in long-lived singletons.

### How do you approach caching — what layers, what invalidation strategy?
Query result caching (`Cache::remember`) for expensive/rarely-changing reads, config/route caching in production (`config:cache`, `route:cache`), and HTTP-level caching (ETags/CDN) for public content. For invalidation I prefer cache tags (Redis) scoped to the entity so I can flush precisely on write, rather than time-based TTL alone which risks staleness or premature eviction.

### How do you scale a Laravel app horizontally — what has to change?
Sessions and cache move to Redis (not file/array driver), queue driver to Redis/SQS instead of database (to avoid it becoming a bottleneck), uploaded files to S3-compatible storage instead of local disk, and `APP_KEY`/config consistent across all instances. Anything writing to local disk or relying on in-memory state per server breaks in a multi-server setup — that's usually the first thing to audit.

### Tell me about a production bug you had to debug under pressure. Walk through your process.
*(Answer with a real story — interviewers want your methodology, not a perfect story.)* Structure: (1) how you detected/confirmed it (logs, error tracking, user reports), (2) how you reproduced or isolated it (staging, feature flag, reading the actual query/queue payload), (3) the root cause, (4) the fix, (5) what you added afterward to prevent recurrence (test, monitoring, alert). Example shape from a hyperlocal delivery system: an intermittent race condition where two workers picked up the same delivery-assignment job — root cause was missing `WithoutOverlapping` middleware — fixed it, added a unique constraint at the DB level as a second line of defense, and added a Horizon alert for job retries spiking.

### How do you use Laravel's logging effectively in production?
Structured logging with context (`Log::error('message', ['order_id' => $id, ...])`) rather than string concatenation, separate channels for different concerns (`stack` combining `single` + external service like Sentry), and log levels used meaningfully so `error` actually means "needs attention" rather than being noise.

### What relationship types does Eloquent support, and when do you use each?
#### One to One
One row relates to exactly one row elsewhere. E.g., `User` has one `Profile`.
```php
class User extends Model {
    public function profile(): HasOne {
        return $this->hasOne(Profile::class);
    }
}
class Profile extends Model {
    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
// Usage
$user->profile;          // get
$user->profile()->create([...]); // create related
```

#### One to Many
One row relates to many rows elsewhere. E.g., `Department` has many `Employees`.
```php
class Department extends Model {
    public function employees(): HasMany {
        return $this->hasMany(Employee::class);
    }
}
class Employee extends Model {
    public function department(): BelongsTo {
        return $this->belongsTo(Department::class);
    }
}
```

#### Many to Many
Both sides can relate to many of the other, via a pivot table. E.g., `User` has many `Roles`, `Role` has many `Users`.
```php
class User extends Model {
    public function roles(): BelongsToMany {
        return $this->belongsToMany(Role::class); // uses role_user pivot table by convention
    }
}
// pivot table extra columns
$user->roles()->attach($roleId, ['assigned_at' => now()]);
$user->roles; // access pivot data via $role->pivot->assigned_at
```
Use `->using(RoleUser::class)` with a custom Pivot model when the pivot needs its own behavior/relationships, not just extra columns.

#### Has Many Through
Access a distant relation through an intermediate one, without loading the middle model directly. E.g., `Country` → `Users` → `Posts`; get all posts for a country.
```php
class Country extends Model {
    public function posts(): HasManyThrough {
        return $this->hasManyThrough(Post::class, User::class);
    }
}
```

#### Has One Through
Same idea, but the end result is a single related row. E.g., a `Mechanic` → `Car` → `Owner`.
```php
class Mechanic extends Model {
    public function carOwner(): HasOneThrough {
        return $this->hasOneThrough(Owner::class, Car::class);
    }
}
```

#### Polymorphic Relationships (Morph)

**One to One (Morph One)** — one model can belong to more than one other model type, via a shared table with `*_type` and `*_id` columns. E.g., `Image` can belong to either a `User` or a `Product`.
```php
class Image extends Model {
    public function imageable(): MorphTo {
        return $this->morphTo();
    }
}
class User extends Model {
    public function image(): MorphOne {
        return $this->morphOne(Image::class, 'imageable');
    }
}
class Product extends Model {
    public function image(): MorphOne {
        return $this->morphOne(Image::class, 'imageable');
    }
}
// images table: id, imageable_id, imageable_type, path
```

**One to Many (Morph Many)** — e.g., both `Post` and `Video` can have many `Comments`.
```php
class Comment extends Model {
    public function commentable(): MorphTo {
        return $this->morphTo();
    }
}
class Post extends Model {
    public function comments(): MorphMany {
        return $this->morphMany(Comment::class, 'commentable');
    }
}
class Video extends Model {
    public function comments(): MorphMany {
        return $this->morphMany(Comment::class, 'commentable');
    }
}
```

**Many to Many (Morph To Many)** — e.g., both `Post` and `Video` can be `Tag`ged, and a `Tag` can belong to many of both.
```php
class Post extends Model {
    public function tags(): MorphToMany {
        return $this->morphToMany(Tag::class, 'taggable');
    }
}
class Tag extends Model {
    public function posts(): MorphedByMany {
        return $this->morphedByMany(Post::class, 'taggable');
    }
    public function videos(): MorphedByMany {
        return $this->morphedByMany(Video::class, 'taggable');
    }
}
```

### How do you customize polymorphic type names instead of using the full class name?
By default `*_type` stores the fully-qualified class name (`App\Models\Post`), which is brittle if you rename/move a model. Use a morph map:
```php
// In AppServiceProvider::boot()
Relation::enforceMorphMap([
    'post' => \App\Models\Post::class,
    'video' => \App\Models\Video::class,
]);
```

### Real-world example from your own work?
In the ERP system, `Attachment` (documents/photos) is polymorphic — attachable to `PurchaseOrder`, `MachineLog`, or `ProductionBatch`. In the SMS, `Notification` or `Comment` type models could follow the same pattern for both `Student` and `ClassSection`.

### Accessors, Mutators, and Casts — what's the difference, and how do you write them (Laravel 9+ syntax)?
Accessors transform an attribute when *reading* it; mutators transform it when *writing*. Since Laravel 9, the preferred syntax is a single `Attribute` return object instead of separate `getXAttribute`/`setXAttribute` methods:
```php
use Illuminate\Database\Eloquent\Casts\Attribute;

class User extends Model {
    protected function name(): Attribute {
        return Attribute::make(
            get: fn (string $value) => ucfirst($value),
            set: fn (string $value) => strtolower($value),
        );
    }
}
```
Casts (`$casts` property or `casts()` method in Laravel 11) convert attribute types automatically on both read/write — `'is_active' => 'boolean'`, `'settings' => 'array'`, `'price' => 'decimal:2'`, or custom cast classes implementing `CastsAttributes` for reusable, complex transformations (e.g., encrypting a field, converting to a Money value object).

### What are Model Events / lifecycle hooks, and how do Observers relate to them?
Eloquent fires events at each lifecycle stage: `retrieved`, `creating`, `created`, `updating`, `updated`, `saving`, `saved`, `deleting`, `deleted`, `restoring`, `restored`, `forceDeleted`. You can hook into these via:
1. **Closures in the model's `boot()`** — `static::creating(fn ($model) => ...)` — fine for one-off logic.
2. **Observers** — a dedicated class grouping all lifecycle logic, better for anything non-trivial or reused.

```php
class OrderObserver {
    public function creating(Order $order): void {
        $order->reference = 'ORD-' . Str::upper(Str::random(8));
    }
    public function created(Order $order): void {
        event(new OrderPlaced($order));
    }
    public function deleting(Order $order): void {
        // prevent deletion if order has shipped
        if ($order->status === 'shipped') {
            throw new \RuntimeException('Cannot delete a shipped order.');
        }
    }
}

// Registered in AppServiceProvider::boot() (or via #[ObservedBy] attribute on the model, Laravel 11+)
Order::observe(OrderObserver::class);
```
Why Observers over model-boot closures: single-responsibility (keeps the model class clean), easier to test in isolation, and easier to find — logic isn't buried inside the model definition.

### What are Policies, and how do they differ from Gates?
**Gates** are simple closure-based authorization checks, good for actions not tied to a specific model (`Gate::define('access-admin-panel', fn ($user) => $user->is_admin)`). **Policies** are classes that group authorization logic for a specific model, keeping it organized and testable — the framework auto-resolves the right policy method based on the model type.

```php
class OrderPolicy {
    public function view(User $user, Order $order): bool {
        return $user->id === $order->user_id || $user->hasRole('admin');
    }
    public function update(User $user, Order $order): bool {
        return $user->id === $order->user_id && $order->status === 'pending';
    }
    public function delete(User $user, Order $order): bool {
        return $user->hasRole('admin');
    }
}

// Usage
$this->authorize('update', $order);      // in a controller, throws 403 automatically
Gate::allows('update', $order);          // boolean check
@can('update', $order) ... @endcan       // in Blade
```
Policies are auto-discovered by naming convention (`Order` → `OrderPolicy`) or registered explicitly in `AuthServiceProvider` (or `bootstrap/app.php` in Laravel 11).

### How do you handle authorization for non-model actions (e.g., "can view admin dashboard")?
A Gate, since there's no specific model instance involved — `Gate::define()` plus `$user->can('access-admin-panel')` or `@can` in Blade.

### What is Global Scope vs Local Scope in Eloquent?
A **Local Scope** is a reusable query constraint you opt into per-call:
```php
class Order extends Model {
    public function scopeActive(Builder $query): void {
        $query->where('status', 'active');
    }
}
Order::active()->get(); // opt-in
```
A **Global Scope** applies automatically to *every* query on the model unless explicitly removed — used for things like multi-tenancy or soft-delete-style filtering:
```php
class TenantScope implements Scope {
    public function apply(Builder $builder, Model $model): void {
        $builder->where('tenant_id', auth()->user()->tenant_id);
    }
}
// In the model's booted() method:
static::addGlobalScope(new TenantScope());

// Bypass when needed:
Order::withoutGlobalScope(TenantScope::class)->get();
```

### What are Mutation-safe features like `SoftDeletes`, and how do they work?
`use SoftDeletes` trait adds a `deleted_at` timestamp; `delete()` sets it instead of removing the row, and a global scope automatically excludes soft-deleted rows from normal queries. `withTrashed()`, `onlyTrashed()`, and `restore()` give you access back.

### Explain Eloquent Collections vs plain PHP arrays/Collections — what extra do you get?
Every Eloquent query returns an `Illuminate\Database\Eloquent\Collection` (extends the base `Collection`), giving you chainable methods (`map`, `filter`, `groupBy`, `pluck`, `sum`) plus Eloquent-specific ones like `modelKeys()`, `load()` (lazy eager load on the whole set), `fresh()`, and `diff`/`intersect` comparing by model keys rather than object identity.

### How does Laravel's task scheduler work, and how do you set it up in production?
You define scheduled tasks in code (Laravel 11+: `routes/console.php` via `Schedule::command(...)`; pre-11: `app/Console/Kernel.php`'s `schedule()` method) instead of managing multiple cron entries manually. A single cron entry runs every minute and Laravel decides what actually needs to execute:
```php
Schedule::command('reports:generate-daily')->dailyAt('01:00');
Schedule::job(new CleanupOldSessions())->hourly();
Schedule::call(fn () => Cache::forget('stats'))->everyFiveMinutes();
```
Production cron entry (only one, ever):
```
* * * * * cd /path-to-app && php artisan schedule:run >> /dev/null 2>&1
```

### How do you prevent overlapping scheduled tasks, and how do you handle a task that must run on only one server in a multi-server setup?
```php
Schedule::command('reports:generate-daily')
    ->dailyAt('01:00')
    ->withoutOverlapping()      // skip if the previous run is still in progress
    ->onOneServer();            // only one server executes it, using a cache lock
```
`onOneServer()` requires a shared cache driver (Redis/database) across servers so the lock is visible to all of them.

### How do you handle failures in scheduled tasks?
`->emailOutputOnFailure($email)`, `->onFailure(fn () => ...)` for custom handling (e.g., alerting), and `->appendOutputTo($logFile)` for auditing. I also generally keep the scheduled command thin and dispatch the real work as a queued job, so failures go through the same job-failure/retry/monitoring path (Horizon, `failed_jobs`) as everything else instead of being a separate failure mode to track.

### What is middleware, and how do you create a custom one?
A filtering layer the request passes through before reaching the controller (and optionally the response passes back through). Used for auth checks, logging, CORS, rate limiting, etc.
```php
class EnsureTenantIsActive {
    public function handle(Request $request, Closure $next): Response {
        if ($request->user()?->tenant?->is_suspended) {
            abort(403, 'Tenant account suspended.');
        }
        return $next($request);
    }
}
```
Registered globally, per-route-group, or per-route; can accept parameters (`middleware('role:admin')`) via additional method arguments.

### Global vs Route middleware vs Middleware groups — what's the difference?
Global runs on every request. Route middleware is opt-in per route/group (`->middleware('auth')`). Groups (`web`, `api`) bundle several together under one alias, applied to whole route files by default in `bootstrap/app.php` / `RouteServiceProvider`.

### FormRequest vs inline `$request->validate()` — when do you use which?
Inline validation is fine for a quick, simple controller action. `FormRequest` classes are preferred once validation rules get non-trivial or are reused, because they also centralize `authorize()` logic and keep the controller clean:
```php
class StoreOrderRequest extends FormRequest {
    public function authorize(): bool {
        return $this->user()->can('create', Order::class);
    }
    public function rules(): array {
        return [
            'customer_id' => ['required', 'exists:customers,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sku' => ['required', 'string'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
        ];
    }
}
```

### How do you write a custom validation rule?
A `Rule` class (invokable since Laravel 9+):
```php
class ValidSku implements ValidationRule {
    public function validate(string $attribute, mixed $value, Closure $fail): void {
        if (!Product::where('sku', $value)->exists()) {
            $fail("The {$attribute} does not correspond to a known product.");
        }
    }
}
// usage: 'sku' => ['required', new ValidSku()]
```

### What's the difference between `.env` and `config/*.php` files, and why shouldn't you call `env()` outside config files?
`.env` holds actual environment-specific secrets/values; `config/*.php` files read from `env()` once and expose typed, structured config that the rest of the app should reference via `config('services.stripe.key')`. Calling `env()` directly in application code breaks once you run `config:cache` in production — the cached config file is the only thing read at that point, so raw `env()` calls outside config files silently return `null`.

### What are Artisan commands, and how do you build one?
```php
class SendWeeklyDigest extends Command {
    protected $signature = 'digest:send {--dry-run}';
    protected $description = 'Send the weekly digest email to active users';

    public function handle(): int {
        $users = User::active()->get();
        foreach ($users as $user) {
            if (!$this->option('dry-run')) {
                Mail::to($user)->queue(new WeeklyDigest($user));
            }
        }
        $this->info("Processed {$users->count()} users.");
        return self::SUCCESS;
    }
}
```
Used heavily for scheduled tasks, one-off data fixes, and CLI tooling for ops.

### How does Laravel handle real-time features (e.g., live notifications)?
Events implementing `ShouldBroadcast` are pushed to a broadcasting driver (Pusher, Ably, or self-hosted via Laravel Reverb/Soketi using WebSockets) on a named channel. The frontend (via Laravel Echo) subscribes to that channel and reacts to the event in real time, instead of polling.
```php
class OrderStatusUpdated implements ShouldBroadcast {
    public function __construct(public Order $order) {}
    public function broadcastOn(): Channel {
        return new PrivateChannel('orders.' . $this->order->id);
    }
}
```

### How do you test Policies and Observers specifically?
Policies — feature test asserting the right HTTP status (403 vs 200) for different user/model combinations, or unit test calling the policy method directly with mock users/models. Observers — since they hook into model events, test them through the model action that triggers them (`Order::create([...])` then assert the side effect happened, e.g., a reference code was generated) rather than calling the observer method directly, since that's closer to how it's actually exercised in production.

### What is route model binding, and what's the difference between implicit and explicit?
Instead of manually looking up a model by ID in the controller, Laravel resolves it automatically from the route parameter.
```php
// Implicit — {order} matches the Order model by primary key automatically
Route::get('/orders/{order}', fn (Order $order) => $order);

// Custom key — resolve by a different column
Route::get('/orders/{order:uuid}', fn (Order $order) => $order);

// Explicit — registered once, reused everywhere
Route::model('order', Order::class);
```

### How do you scope implicit binding to a parent (e.g., only fetch a comment belonging to a given post)?
```php
Route::get('/posts/{post}/comments/{comment}', ...)->scopeBindings();
// or globally in RouteServiceProvider / bootstrap/app.php
```
This prevents an id-guessing bug where `/posts/1/comments/999` returns comment 999 even if it actually belongs to post 5.

### What happens if the model isn't found?
Laravel automatically throws `ModelNotFoundException`, which the exception handler converts into a 404 response — you don't need to handle it manually.

### Beyond `map`/`filter`, what Collection methods come up often in real code?
```php
$orders->groupBy('status');                     // group by a key/callback
$orders->keyBy('id');                            // re-index by a column
$orders->pluck('total', 'id');                   // [id => total] map
$orders->partition(fn ($o) => $o->total > 100);  // split into two collections
$orders->chunk(50);                              // batches, e.g. for bulk processing
$orders->reduce(fn ($carry, $o) => $carry + $o->total, 0);
$orders->when($request->filled('status'), fn ($c) => $c->where('status', $request->status));
$orders->tap(fn ($c) => Log::info('count', ['n' => $c->count()])); // side-effect w/o breaking chain
```

### Higher-order messages — what are they?
A shorthand for calling a method/accessing a property on every item, without writing a closure.
```php
$orders->each->markAsProcessed();  // instead of ->each(fn($o) => $o->markAsProcessed())
$total = $orders->sum->total;      // instead of ->sum(fn($o) => $o->total)
```

### When would you write a Collection macro?
To add a reusable method to the Collection class app-wide, useful for a domain-specific operation used in many places:
```php
Collection::macro('averageOf', function (string $key) {
    return $this->avg($key);
});
```

### Do you use the Repository pattern with Eloquent? What's the trade-off?
Eloquent models are already an implementation of the Active Record + Repository-ish pattern, so a full separate repository layer is sometimes redundant overhead. That said, I do introduce a **Service layer** (not necessarily a full Repository) to hold business logic that shouldn't live in a controller or model — e.g., `OrderService::placeOrder()` orchestrating stock checks, payment, and event dispatching. I add a true Repository interface mainly when: (1) I expect to swap the data source (e.g., an external API today, DB later), or (2) I want to fully decouple a bounded context for testing without hitting the DB at all. Otherwise, thin controllers → services → Eloquent models directly is usually enough and avoids an indirection layer that doesn't earn its keep.

```php
class OrderService {
    public function __construct(private PaymentGateway $gateway) {}

    public function place(User $user, array $items): Order {
        return DB::transaction(function () use ($user, $items) {
            $order = Order::create(['user_id' => $user->id, 'status' => 'pending']);
            foreach ($items as $item) {
                $order->items()->create($item);
                Product::where('id', $item['product_id'])->decrement('stock', $item['qty']);
            }
            $this->gateway->charge($order->total_cents);
            $order->update(['status' => 'paid']);
            event(new OrderPlaced($order));
            return $order;
        });
    }
}
```

### How do you handle schema changes safely in production?
Every change is a new migration file (never edit an already-run migration in production), reviewed for whether it locks the table (e.g., adding a column with a default on a huge MySQL table can lock it depending on version/engine), run during a low-traffic window or via online schema change tools for very large tables. I also always write the `down()` method properly, even though rollbacks are rare in practice, because it forces me to think about reversibility.

### Factories vs Seeders — what's each for?
Factories define *how* to generate fake instances of a model (`UserFactory::new()->count(10)->create()`), used in tests and local seeding. Seeders orchestrate *what* gets populated and in what order (calling factories, or inserting fixed reference data like roles/permissions) — run via `db:seed`, often as part of local environment setup or CI test bootstrapping.

```php
class OrderFactory extends Factory {
    public function definition(): array {
        return [
            'user_id' => User::factory(),
            'status' => fake()->randomElement(['pending', 'paid', 'shipped']),
            'total' => fake()->randomFloat(2, 10, 500),
        ];
    }
    public function paid(): static {
        return $this->state(['status' => 'paid']); // named state for readable tests
    }
}
// Order::factory()->paid()->count(5)->create();
```

### How does Laravel's Storage/Filesystem abstraction work?
A driver-agnostic API (`Storage::disk('s3')->put(...)`) over local disk, S3, or any Flysystem-compatible driver, configured in `config/filesystems.php`. Switching from local storage to S3 in production is a config change, not a code change, as long as you consistently use the `Storage` facade instead of raw PHP file functions.
```php
$path = $request->file('avatar')->store('avatars', 's3');
Storage::disk('s3')->url($path);            // public URL
Storage::disk('s3')->temporaryUrl($path, now()->addMinutes(5)); // signed, expiring URL for private files
```

### Mailables vs Notifications — when do you use which?
`Mailable` is specifically for constructing an email's content/view. `Notification` is a higher-level abstraction that can send the *same* notification across multiple channels (mail, database, SMS via Vonage, Slack, broadcast) from one class, and can optionally store an in-app/database record for a notifications bell/inbox UI.

```php
class OrderShipped extends Notification {
    public function via($notifiable): array {
        return ['mail', 'database'];
    }
    public function toMail($notifiable): MailMessage {
        return (new MailMessage)
            ->subject('Your order has shipped')
            ->line("Order #{$this->order->id} is on its way.");
    }
    public function toArray($notifiable): array {
        return ['order_id' => $this->order->id];
    }
}
$user->notify(new OrderShipped($order));
```
I default to Notifications even for email-only cases if there's a reasonable chance another channel (SMS, in-app) gets added later — cheap to set up up front, annoying to refactor later.

### What cache drivers have you used, and how do you decide?
File/database cache for local dev simplicity; Redis in production for speed and features like tags and atomic locks. `array` driver for tests (in-memory, resets per request/test).

### What is `Cache::remember` vs `Cache::rememberForever` vs cache locks?
```php
$stats = Cache::remember('dashboard:stats', now()->addMinutes(10), fn () => $this->computeStats());

// Prevent a cache stampede — many requests recomputing an expensive value simultaneously
$stats = Cache::lock('dashboard:stats:lock', 10)->block(5, function () {
    return Cache::remember('dashboard:stats', 600, fn () => $this->computeStats());
});
```
Atomic locks (`Cache::lock()`) are also useful outside caching, e.g., ensuring only one process runs a specific critical section at a time — the same underlying mechanism `onOneServer()` on the scheduler uses.

### What are Laravel Contracts, and why would you type-hint one instead of a Facade or concrete class?
Contracts (`Illuminate\Contracts\*`) are interfaces defining the framework's core services (`Illuminate\Contracts\Cache\Repository`, `Illuminate\Contracts\Queue\Queue`). Type-hinting a Contract in your own class constructor keeps you decoupled from Laravel's concrete implementation and makes swapping/mocking trivial in tests — closer to proper DIP. Facades are more convenient for quick usage (especially in Blade/routes) but hide the dependency; I use Contracts in service classes I care about testing cleanly, and Facades for glue code.

### How do you use native PHP Enums with Eloquent?
```php
enum OrderStatus: string {
    case Pending = 'pending';
    case Paid = 'paid';
    case Shipped = 'shipped';

    public function label(): string {
        return match($this) {
            self::Pending => 'Pending Payment',
            self::Paid => 'Paid',
            self::Shipped => 'Shipped',
        };
    }
}

class Order extends Model {
    protected $casts = ['status' => OrderStatus::class];
}

$order->status === OrderStatus::Paid; // type-safe comparison instead of magic strings
```
Why this matters at your level: it replaces magic-string status columns and scattered `if ($status === 'paid')` checks throughout the codebase with a single source of truth, catchable by static analysis.

### What's the difference between chaining jobs and batching jobs?
**Chaining** — jobs run sequentially, each starting only after the previous succeeds; if one fails, the rest of the chain is cancelled.
```php
Bus::chain([
    new ImportOrders($file),
    new ValidateOrders(),
    new NotifyImportComplete(),
])->dispatch();
```
**Batching** — a group of jobs runs (potentially in parallel across workers), and you can react once the whole batch finishes, track progress, or handle partial failure without cancelling the rest.
```php
$batch = Bus::batch([
    new ProcessInvoice($inv1),
    new ProcessInvoice($inv2),
])->then(fn (Batch $batch) => Log::info('All invoices processed'))
  ->catch(fn (Batch $batch, Throwable $e) => Log::error($e->getMessage()))
  ->finally(fn (Batch $batch) => Cache::forget('import:in-progress'))
  ->dispatch();
```
Real use case from ERP-style work: batching per-machine data imports where one machine's bad data shouldn't block processing the others, but you still want a single "import complete" notification once everything's done.

### How does Sanctum actually authenticate a request — walk through token vs SPA cookie mode.
**Token mode** (mobile apps, third-party API clients): client sends `Authorization: Bearer {token}`, Sanctum looks it up in `personal_access_tokens`, hashed, matches it to a user, and can enforce **abilities/scopes** (`$token->can('orders:read')`). **SPA mode** (first-party JS frontend on the same domain): uses Laravel's normal session cookie + CSRF protection instead of a bearer token — the SPA hits `/sanctum/csrf-cookie` first, then normal session-authenticated requests work, giving you session-based auth without a full OAuth flow.

### What do Horizon and Telescope give you that you don't get by default?
**Horizon** — a dashboard + config layer specifically for Redis queues: live monitoring of throughput, failed jobs, retry from the UI, and per-queue worker balancing/auto-scaling config (`balance: auto`). **Telescope** — a general debugging dashboard logging requests, queries (with N+1 highlighting), jobs, exceptions, mail, and cache hits/misses in one place — invaluable in staging, but should be disabled or heavily gated in production (it stores everything, which is both a perf and a data-exposure concern) — I typically only enable it for specific IPs/users via its `Telescope::auth()` gate, or not at all in prod, relying on Horizon + external APM instead.
