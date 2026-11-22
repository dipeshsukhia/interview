## PHP

### What are traits in PHP, and why are they used?
Traits let unrelated classes reuse a set of methods without inheriting from a common parent. They are useful for small, focused behavior that does not represent an “is-a” relationship. A class can use multiple traits; if methods conflict, resolve the conflict with `insteadof` or rename one with `as`.

```php
trait HasTimestamps
{
    protected ?DateTimeImmutable $updatedAt = null;

    public function touch(): void
    {
        $this->updatedAt = new DateTimeImmutable();
    }
}

final class Article
{
    use HasTimestamps;
}
```

### What are the SOLID principles?
SOLID is a set of five object-oriented design guidelines:

- **Single Responsibility:** give a class one cohesive reason to change.
- **Open/Closed:** extend behavior without repeatedly modifying stable code.
- **Liskov Substitution:** subtypes should work wherever their base type is expected.
- **Interface Segregation:** prefer focused interfaces over large interfaces clients do not need.
- **Dependency Inversion:** high-level policy depends on abstractions, not concrete details.

These are design tools, not rules that require one class per method.
```php
interface PaymentGateway { public function charge(int $cents): void; }

final class Checkout
{
    public function __construct(private PaymentGateway $gateway) {}

    public function pay(int $cents): void
    {
        $this->gateway->charge($cents);
    }
}
```

### What is Composer, and how does it help PHP development?
Composer is PHP’s dependency manager. It records package constraints in `composer.json`, resolves compatible versions, installs packages into `vendor/`, and generates an autoloader. Commit `composer.lock` for applications so deployments install the same resolved versions.

```bash
composer require monolog/monolog
composer install
```

### How do PDO and MySQLi differ?
PDO provides one consistent database API for several drivers, while MySQLi is specific to MySQL. Both support prepared statements and transactions. Use prepared statements for values in either API; placeholders cannot safely substitute table or column names, so whitelist dynamic identifiers.

```php
$stmt = $pdo->prepare('SELECT id, name FROM users WHERE email = :email');
$stmt->execute(['email' => $email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
```

### What is a cookie in PHP?
A cookie is a small value a server asks the browser to store and send with later requests. Set it before sending response output, give it an appropriate lifetime, and use `Secure`, `HttpOnly`, and `SameSite` options where suitable. Do not store secrets or trusted authorization decisions directly in a client-editable cookie.

```php
setcookie('theme', 'dark', [
    'expires' => time() + 86400 * 30,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
```

### How do you handle errors in PHP?
PHP has exceptions and engine errors; both implement `Throwable` in current PHP versions. Catch exceptions where you can recover or add context, log unexpected failures centrally, and show users a safe message rather than internal details. Configure production to log errors and disable display of stack traces.

```php
try {
    $result = performOperation();
} catch (InvalidArgumentException $exception) {
    // Handle a known invalid input.
} catch (Throwable $exception) {
    error_log((string) $exception);
    // Return a generic failure response.
}
```

### What do public, protected, and private mean in PHP?
`public` members can be accessed from anywhere; `protected` members are accessible in the declaring class and its subclasses; `private` members are accessible only inside the class that declares them. Prefer the narrowest visibility that supports the class’s intended API.
```php
class Account
{
    public string $owner;
    protected int $balance = 0;
    private string $pin;
}
```

### What inheritance does PHP support?
A PHP class can extend one parent class, so class inheritance is single inheritance. That parent can itself extend another class, creating multilevel or hierarchical inheritance. A class can implement multiple interfaces, and traits can share implementation across classes. Composition is often preferable when the relationship is not truly “is-a.”
```php
interface JsonSerializableRecord { public function toArray(): array; }

class BaseRecord {}
class User extends BaseRecord implements JsonSerializableRecord
{
    public function toArray(): array { return []; }
}
```

### What is polymorphism in PHP?
Polymorphism lets code use one shared type while different implementations provide different behavior. In PHP, interfaces and abstract classes commonly define that contract; the caller can invoke the same method without knowing the concrete class.

```php
interface Notifier { public function send(string $message): void; }

function notifyUser(Notifier $notifier): void
{
    $notifier->send('Your report is ready.');
}
```

### What is the difference between method overriding and overloading in PHP?
Overriding replaces an inherited method implementation in a subclass while keeping a compatible signature. PHP does not support traditional compile-time method overloading, where several methods share a name but differ only by parameter lists. Dynamic calls can be intercepted with magic methods such as `__call`, though explicit methods or variadic parameters are usually clearer.
```php
class BaseLogger
{
    public function log(string $message): void {}
}

class FileLogger extends BaseLogger
{
    public function log(string $message): void
    {
        file_put_contents("app.log", $message . PHP_EOL, FILE_APPEND);
    }
}
```

### What is an abstract class in PHP?
An abstract class cannot be instantiated directly. It can contain shared implementation and state, as well as abstract methods that concrete subclasses must implement. Use it when related classes share a base concept and some common behavior.

```php
abstract class Report
{
    abstract public function render(): string;

    public function filename(): string
    {
        return 'report.txt';
    }
}
```

### What is an interface in PHP?
An interface defines a contract that implementing classes must fulfill. Interfaces enable unrelated classes to be used through the same type and support multiple interface implementation. Keep an interface focused on behavior its consumers actually need.
```php
interface CacheStore
{
    public function get(string $key): mixed;
    public function put(string $key, mixed $value): void;
}

final class ArrayCache implements CacheStore
{
    private array $items = [];
    public function get(string $key): mixed { return $this->items[$key] ?? null; }
    public function put(string $key, mixed $value): void { $this->items[$key] = $value; }
}
```

### How do abstract classes and interfaces differ?
An abstract class can hold instance state, constructors, and shared method implementations; a class can extend only one class. An interface describes a contract without instance state or constructor implementation; a class can implement several interfaces. Use an interface for capability boundaries and an abstract class when subclasses genuinely share a base implementation.
```php
interface Exportable { public function export(): string; }

abstract class ReportBase
{
    public function generatedAt(): DateTimeImmutable { return new DateTimeImmutable(); }
}

final class CsvReport extends ReportBase implements Exportable
{
    public function export(): string { return "id,name\n1,Ada"; }
}
```

### What are static properties and methods in PHP?
Static members belong to the class rather than an individual object and are accessed with `ClassName::$property` or `ClassName::method()`. Static methods have no `$this`, so they cannot access instance members. They are useful for stateless helpers or class-level state, but can make dependencies and tests harder to manage.
```php
final class Slug
{
    public static function from(string $text): string
    {
        return strtolower(str_replace(" ", "-", trim($text)));
    }
}

$slug = Slug::from("Hello World");
```

### What are the benefits and drawbacks of static members?
Static members are convenient when behavior or data truly belongs to the class and does not depend on object state. Excessive static state creates hidden global dependencies, complicates parallel tests, and makes substitution difficult. Prefer injected services for dependencies that need configuration, lifecycle management, or mocking.
```php
final class TaxRate
{
    public static function percentage(): float { return 0.2; }
}

// For configurable behavior, inject a service instead of global static state.
final class InvoiceTotal
{
    public function __construct(private TaxCalculator $tax) {}
}
```

### Does PHP support method overloading?
PHP does not choose between multiple methods with the same name based on parameter types or count. It does provide magic methods such as `__call` and `__callStatic` to handle calls to inaccessible or undefined methods dynamically. For ordinary optional inputs, use defaults, union types, or variadic parameters instead.
```php
final class Search
{
    public function find(string $term, int $limit = 10): array
    {
        return [];
    }
}

$results = (new Search())->find("laravel", limit: 20);
```

### What are namespaces in PHP?
Namespaces group class, function, and constant names and prevent collisions between libraries. They also support PSR-4 autoloading, so a class can be loaded from a predictable file path instead of manual `require` calls.

```php
namespace App\Services;

use App\Contracts\PaymentGateway;

final class CheckoutService
{
    public function __construct(private PaymentGateway $gateway) {}
}
```

### How does exception handling work in PHP, and what exception types are available?
Use `try` to run code that may fail, `catch` to handle a specific failure, and `finally` for cleanup that must always run. Built-in exceptions include `InvalidArgumentException`, `RuntimeException`, and `PDOException`; applications can define their own by extending `Exception`. PHP engine errors use the separate `Error` hierarchy, and both errors and exceptions implement `Throwable`.

```php
try {
    $connection->beginTransaction();
    // Perform database work.
    $connection->commit();
} catch (Throwable $exception) {
    if ($connection->inTransaction()) {
        $connection->rollBack();
    }
    throw $exception;
}
```

### Which design patterns are commonly used in PHP?
Useful patterns include **Factory** for object creation, **Strategy** for interchangeable behavior, **Adapter** for a consistent interface around a different API, **Observer** for event subscribers, and **Decorator** for wrapping behavior. MVC separates request handling, domain logic, and presentation in web applications. Choose a pattern to solve a real change or coupling problem rather than adding ceremony.
```php
interface Formatter { public function format(array $data): string; }

final class JsonFormatter implements Formatter
{
    public function format(array $data): string
    {
        return json_encode($data, JSON_THROW_ON_ERROR);
    }
}
```

### What is the difference between self::class and static::class?
`self::class` resolves to the class where the code is declared. `static::class` uses late static binding and resolves to the runtime class that called the method, which matters in inherited code.

```php
class BaseType
{
    public static function names(): array
    {
        return [self::class, static::class];
    }
}

class ChildType extends BaseType {}

// BaseType::names() returns [BaseType::class, BaseType::class].
// ChildType::names() returns [BaseType::class, ChildType::class].
```

### How can you count each character in “SOFTWARE ENGINEER” with PHP?
Normalize the input, remove spaces if only letters should be counted, then use `array_count_values` on its characters. Sorting the result makes the output predictable.

```php
$word = 'SOFTWARE ENGINEER';
$letters = str_split(str_replace(' ', '', strtoupper($word)));
$counts = array_count_values($letters);
ksort($counts);

foreach ($counts as $letter => $count) {
    echo "$letter: $count\n";
}
```

### How do you find the maximum value in a PHP array in one line?
Use PHP’s `max` function. For the array shown in the sheet, the maximum is `45`.

```php
$maximum = max([5, 9, 2, 3, 6, 45]);
```

### How do you version a REST API?
Common approaches include a version in the URL (`/api/v1/...`), a vendor media type in the `Accept` header, or a custom version header. URL versioning is easy to understand and route; header versioning keeps the resource path stable. Keep old versions during a documented migration window and avoid breaking existing clients without notice.
```php
Route::prefix("api/v1")->group(function () {
    Route::get("/users", [UserController::class, "index"]);
});
```

### What is throttling in an API?
Throttling limits how frequently a client can make requests, usually per user, API key, or IP address. It protects service capacity and reduces abuse. A rate limit is the policy; throttling is the enforcement behavior, such as returning HTTP `429 Too Many Requests` with a `Retry-After` value.
```php
Route::middleware('throttle:60,1')->get('/api/items', [ItemController::class, 'index']);
```

### How would you implement rate limiting in a PHP REST API?
Use a shared store such as Redis so limits work across application servers. Choose a key per authenticated user or API key, apply a fixed-window, sliding-window, or token-bucket policy atomically, and return `429` plus limit/reset headers when the quota is exhausted. Framework middleware can centralize the check and response.

```php
$key = 'rate-limit:' . $apiKey;
$count = $redis->incr($key);
if ($count === 1) {
    $redis->expire($key, 60);
}
if ($count > 100) {
    http_response_code(429);
    header('Retry-After: ' . $redis->ttl($key));
    exit;
}
```

### Which HTTP methods can a PHP REST API handle?
HTTP methods include `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`. PHP can receive any of them; the web server passes the method in `$_SERVER['REQUEST_METHOD']`. `$_POST` is populated for form-encoded POST data, so JSON or other request bodies for PUT/PATCH/DELETE are commonly read from `php://input`. Frameworks often provide method-override support for HTML forms.
```php
Route::get('/users', [UserController::class, 'index']);
Route::post('/users', [UserController::class, 'store']);
Route::put('/users/{user}', [UserController::class, 'update']);
Route::patch('/users/{user}', [UserController::class, 'update']);
Route::delete('/users/{user}', [UserController::class, 'destroy']);
```
