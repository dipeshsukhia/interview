## Laravel

### How does a Laravel request move through the framework?
The web server sends the request to `public/index.php`, which loads Composer and bootstraps the application. Laravel resolves the HTTP kernel, runs global and route middleware, matches a route, invokes its controller or closure, then sends the response back through middleware. Service providers register and boot application services during startup. In an interview, explain where authentication, binding, validation, and exception handling fit in this flow.

```php
Route::middleware(['auth', 'verified'])->get('/dashboard', [DashboardController::class, 'index']);
```

### What do the service container and service providers do?
The container constructs classes and injects dependencies, including interfaces bound to concrete implementations. A provider's `register` method declares bindings; `boot` runs after providers have registered and is appropriate for framework integrations. Use constructor injection to make dependencies visible and replaceable in tests. Bind an interface when implementation can vary, rather than wrapping every class in an interface.

```php
// AppServiceProvider::register()
$this->app->bind(PaymentGateway::class, StripePaymentGateway::class);

// Laravel resolves the gateway when it creates CheckoutService.
public function __construct(private PaymentGateway $gateway) {}
```

### When should you use a facade, a contract, or dependency injection?
Facades provide concise access to container-managed services and are convenient at framework boundaries. Contracts are interfaces for common framework capabilities; constructor injection makes a class's dependencies explicit. For domain code with replaceable collaborators, inject a contract or focused interface. Facades remain testable through Laravel's fake and mock helpers, but avoid hiding many dependencies inside a large service.

```php
Cache::put('report:42', $report, now()->addMinutes(10));

final class ReportService {
    public function __construct(private Illuminate\Contracts\Cache\Repository $cache) {}
}
```

### Which Eloquent relationships should you know?
`hasOne` and `belongsTo` model one-to-one ownership; `hasMany` and `belongsTo` model one-to-many; `belongsToMany` uses a pivot table. Through relationships traverse an intermediate model. Polymorphic relationships let one related table point to several model types. Define the inverse relationship when callers need to navigate both directions, and ensure foreign keys and indexes match access patterns.

```php
class User extends Model {
    public function posts(): HasMany { return $this->hasMany(Post::class); }
    public function roles(): BelongsToMany { return $this->belongsToMany(Role::class)->withTimestamps(); }
}
class Post extends Model {
    public function author(): BelongsTo { return $this->belongsTo(User::class, 'user_id'); }
}
```

### How do one-to-one and one-to-many relationships differ?
A one-to-one relation expects one related row, such as a user profile; enforce that expectation with a unique foreign key in the database. One-to-many returns a collection, such as a user's posts. The child side generally declares `belongsTo`, which owns the foreign key. Eloquent method names are expressive, but database constraints are what prevent invalid duplicate or orphan rows.

```php
public function profile(): HasOne { return $this->hasOne(Profile::class); }
public function posts(): HasMany { return $this->hasMany(Post::class); }
// profiles.user_id should be UNIQUE; posts.user_id is usually indexed.
```

### How does a many-to-many pivot relationship work?
A pivot table stores the two foreign keys linking models, commonly `role_user` for users and roles. The relationship can read additional pivot columns and timestamps, and `attach`, `detach`, and `sync` modify links. Use unique constraints on the pair to prevent duplicate membership. If the join has substantial behavior or lifecycle, model it as a real Eloquent entity.

```php
public function roles(): BelongsToMany {
    return $this->belongsToMany(Role::class)->withPivot('granted_by')->withTimestamps();
}
$user->roles()->sync([1 => ['granted_by' => auth()->id()]]);
```

### What are has-one-through and has-many-through relationships?
Through relationships reach a distant model through an intermediate table without manually writing each join. For example, a mechanic can have one car owner through a car, or a country can have many posts through users. The key layout must match the path. Use them for straightforward traversal, and use an explicit query when filters or relationship semantics become difficult to explain.

```php
class Country extends Model {
    public function posts(): HasManyThrough {
        return $this->hasManyThrough(Post::class, User::class);
    }
}
```

### How do polymorphic Eloquent relationships work?
A polymorphic record stores both a model identifier and a type discriminator. `morphTo` is declared on the shared child; parents use `morphOne` or `morphMany`. `morphToMany` uses a polymorphic pivot for shared tags. Use a morph map so stored type values remain stable if PHP classes are renamed, and add a composite index on type and identifier.

```php
class Comment extends Model {
    public function commentable(): MorphTo { return $this->morphTo(); }
}
class Post extends Model {
    public function comments(): MorphMany { return $this->morphMany(Comment::class, 'commentable'); }
}
// comments: commentable_type, commentable_id, body
```

### How do you prevent N+1 queries in Eloquent?
N+1 occurs when a loop lazily loads a relationship once per row. Eager load with `with()` for a query or `load()` for models already retrieved, and inspect generated SQL or query counts. Select only required columns while retaining relationship keys. `withCount()` retrieves a count without hydrating every related model. Lazy-loading prevention in development can expose accidental regressions.

```php
$posts = Post::with(['author:id,name'])->withCount('comments')->latest()->paginate(20);
foreach ($posts as $post) {
    echo $post->author->name . ': ' . $post->comments_count;
}
```

### How do scopes, casts, accessors, and mutators differ?
A local scope packages reusable query conditions; a global scope applies conditions to every query unless deliberately removed. Casts convert stored attributes to useful PHP types, while accessors and mutators transform values when read or written. Use these for focused model behavior. Avoid hidden database queries or costly work in accessors, especially when serializing lists of models.

```php
protected $casts = ['settings' => 'array', 'published_at' => 'datetime'];
public function scopePublished(Builder $query): void { $query->whereNotNull('published_at'); }
$posts = Post::published()->get();
```

### What are model events and observers, and when should each be used?
Eloquent fires lifecycle events such as `creating`, `created`, `updating`, and `deleted`. An observer groups handlers for one model and keeps large models readable. Use it for small, model-related side effects; dispatch a job for slow or external work. Mass updates and deletes executed as queries do not hydrate each model, so per-model events do not fire. For events inside transactions, consider after-commit dispatch.

```php
class PostObserver {
    public function created(Post $post): void {
        SearchIndexJob::dispatch($post->id)->afterCommit();
    }
}
Post::observe(PostObserver::class);
```

### How do policies differ from middleware and gates?
Policies organize authorization rules around a model, such as `view`, `update`, or `delete`. Gates fit abilities that are not naturally tied to one model. Middleware can reject a request before controller execution, including authentication or ability checks. Authorization belongs on the server and should be repeated in the relevant operation; hiding buttons in the UI is not authorization.

```php
class PostPolicy {
    public function update(User $user, Post $post): bool {
        return $user->id === $post->user_id;
    }
}
Gate::authorize('update', $post);
```

### What is route model binding, and how do scoped bindings help?
Implicit binding resolves a route parameter into a model and returns a 404 when it is absent. Customize the route key for readable URLs. Scoped binding restricts a nested child lookup to its parent relationship, preventing a valid child ID from another parent from being accepted. Authorization is still needed: scope checks resource ownership of the URL, while a policy decides whether the current user may act.

```php
Route::scopeBindings()->get('/users/{user}/posts/{post:slug}', function (User $user, Post $post) {
    return $post;
});
```

### How do Form Requests and custom validation rules work?
A Form Request centralizes authorization and validation before the controller executes. It returns validated data through `validated()` or `safe()`, helping prevent unchecked request fields from reaching model writes. A custom rule encapsulates domain-specific validation reused across endpoints. Database uniqueness and foreign keys still need database constraints because concurrent requests can pass application validation at the same time.

```php
class StorePostRequest extends FormRequest {
    public function authorize(): bool { return $this->user()?->can('create', Post::class) ?? false; }
    public function rules(): array { return ['title' => ['required', 'string', 'max:200']]; }
}
Post::create($request->validated());
```

### How does Laravel's scheduler work in a multi-server deployment?
The server runs `php artisan schedule:run` every minute; Laravel decides which defined tasks are due. `withoutOverlapping()` uses a cache lock so a slow task does not start again, while `onOneServer()` elects one scheduler node for a task. Both depend on a shared cache backend in a cluster. Queue long-running work and monitor failures rather than keeping scheduler processes busy.

```php
Schedule::command('reports:daily')
    ->dailyAt('02:00')
    ->withoutOverlapping()
    ->onOneServer();
```

### How do queues, retries, and failed jobs work?
A queued job moves slow work out of the request and is handled by a worker. Pick a durable queue backend, set timeouts and retry limits, and make the job idempotent because delivery can happen more than once. Record failures, monitor queue age, and provide a safe retry path. Dispatch after the database transaction commits when the job reads newly written rows.

```php
class SendReceipt implements ShouldQueue {
    public int $tries = 3;
    public function backoff(): array { return [10, 30, 60]; }
    public function handle(): void { /* Send once using an idempotency key. */ }
}
SendReceipt::dispatch($order->id)->afterCommit();
```

### When would you use job chaining or batching?
A chain runs jobs in order and stops if one fails; use it when later steps depend on earlier results. A batch groups independent jobs and exposes progress, cancellation, and completion callbacks. Neither makes external operations transactional. Make each job retry-safe and design compensation when a workflow has already changed an external system.

```php
Bus::chain([new ImportFile($path), new RebuildIndex()])->dispatch();
Bus::batch($reportJobs)->name('Monthly reports')->dispatch();
```

### What do Horizon and Telescope provide?
Horizon manages and monitors Redis-backed queues, showing throughput, wait times, retries, and failed jobs. Telescope records application activity such as requests, queries, exceptions, jobs, and mail to help debug. Configure access carefully in production because diagnostics may contain sensitive application data. Neither replaces alerting, structured logs, or external monitoring.

```bash
php artisan horizon
php artisan telescope:install
```

### How do transactions and atomic locks solve different problems?
A database transaction groups database writes with commit or rollback. An atomic cache lock coordinates work across processes, such as ensuring only one worker generates a report. A lock does not make database and external API calls atomic; use idempotency keys, after-commit jobs, or an outbox pattern for cross-system workflows. Keep lock leases and transaction durations bounded.

```php
Cache::lock('report:monthly', 60)->block(5, function () {
    DB::transaction(fn () => Report::create(['status' => 'queued']));
});
```

### How do caching and config caching affect deployment?
Cache computed values with a key and expiration, and invalidate them when the source data changes. `config:cache` compiles configuration for faster startup; after that, application code should read `config()` rather than call `env()` outside configuration files. Rebuild cached config on each deployment when environment values change. Use shared cache storage for locks and counters across servers.

```php
$stats = Cache::remember('dashboard:stats', now()->addMinutes(5), fn () => DashboardStats::calculate());
$region = config('services.billing.region');
```

### How do migrations, factories, and seeders work together?
Migrations version schema changes, factories generate realistic model data, and seeders populate required or sample records. Keep production migrations safe for large tables: avoid long blocking changes and separate schema expansion from old-column removal when rolling deployments. Factories should make tests readable and independent; seeders should be idempotent if they may run repeatedly.

```php
Schema::table('users', fn (Blueprint $table) => $table->string('timezone')->default('UTC'));
$user = User::factory()->create();
```

### How does Laravel handle file storage and temporary URLs?
The Storage facade addresses named disks such as local or S3 through one API. Store the file path and metadata in the database, rather than treating a public URL as the canonical identifier. Validate file type and size, use private disks for sensitive uploads, and issue short-lived temporary URLs only when the selected driver supports them. Large files may need direct uploads.

```php
$path = $request->file('avatar')->store('avatars', 's3');
$url = Storage::disk('s3')->temporaryUrl($path, now()->addMinutes(10));
```

### How do notifications differ from mailables?
A mailable describes an email message and its content. A notification describes a user-facing event and can deliver through mail, database, broadcast, or other channels. Use notifications when one event reaches several channels or needs per-user preferences; use a mailable for a standalone email workflow. Queue external delivery and track failures rather than sending it synchronously in a request.

```php
$user->notify(new InvoiceReady($invoice));
Mail::to($accountingEmail)->queue(new MonthlyStatement($statement));
```

### How do Sanctum's two authentication modes differ?
For a first-party SPA, Sanctum can use Laravel's session cookie and CSRF protection; this is appropriate when frontend and backend share the configured stateful domain relationship. For mobile or third-party clients, Sanctum issues bearer tokens with optional abilities. Protect tokens as credentials, revoke them when no longer needed, and do not confuse token abilities with model-level authorization policies.

```php
$token = $user->createToken('mobile', ['orders:read'])->plainTextToken;
Route::middleware('auth:sanctum')->get('/orders', [OrderController::class, 'index']);
```

### How do events, listeners, and broadcasting differ?
An event states that something happened; listeners react to it, often asynchronously. Broadcasting publishes selected events to connected clients over a real-time transport. Do not broadcast confidential payloads on public channels; authorize private or presence channels and keep events small. For transaction-dependent events, dispatch after commit so listeners can read consistent data.

```php
OrderPlaced::dispatch($order);
// Broadcast an event only after defining and authorizing its channel.
Broadcast::channel('orders.{order}', fn (User $user, Order $order) => $user->can('view', $order));
```

### When should you use a repository or service layer?
A service is useful for an application workflow that coordinates models, transactions, gateways, or jobs. A repository adds value when persistence needs a stable abstraction or multiple implementations; wrapping every Eloquent method often adds indirection without simplifying code. Explain the boundary, expected changes, and testing benefit rather than applying a pattern uniformly.

```php
final class PlaceOrder {
    public function __construct(private PaymentGateway $payments) {}
    public function handle(array $items): Order {
        return DB::transaction(fn () => Order::create(['status' => 'pending']));
    }
}
```

### How would you debug a slow Laravel endpoint in production?
Start with request latency and error metrics, then correlate traces or request IDs with SQL duration, queue wait, cache calls, and external APIs. Check for N+1 queries, missing indexes, overlarge responses, and recent deploys. Reproduce with representative data before changing code. Compare before and after under load, and add a targeted alert or regression check for the failure mode.

```php
DB::listen(function (QueryExecuted $query) {
    if ($query->time > 200) Log::warning('Slow query', ['sql' => $query->sql, 'ms' => $query->time]);
});
```
