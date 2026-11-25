## PHP

### What are traits in PHP, and why are they used?
A trait is a mechanism for code reuse in single-inheritance languages like PHP. A class can only extend one parent, but it can `use` multiple traits — letting you share methods across unrelated class hierarchies without duplicating code.

```php
trait Loggable {
    public function log(string $message): void {
        echo static::class . ": " . $message;
    }
}

trait Cacheable {
    public function cacheKey(): string {
        return static::class . ':' . $this->id;
    }
}

class Order {
    use Loggable, Cacheable;
    public int $id = 1;
}
```

Purpose: horizontal code reuse. If two unrelated classes need the same behavior (e.g., `HasUuid`, `Loggable`, `Cacheable`) but don't share a natural inheritance relationship, a trait avoids copy-pasting the same methods into both, and avoids forcing an artificial base class. Laravel itself relies heavily on this pattern (`SoftDeletes`, `Notifiable`, `HasFactory`).

Notes: if two traits used in the same class define a method with the same name, PHP throws a fatal error unless you resolve it with `insteadof`/`as` in the class body.

### What are the SOLID principles?
- **S — Single Responsibility**: a class should have one reason to change. A `User` model shouldn't also handle sending emails and generating PDFs — pull those into separate services.
- **O — Open/Closed**: classes should be open for extension, closed for modification. Instead of adding `if ($type === 'paypal')` branches into a `PaymentProcessor`, define a `PaymentGatewayInterface` and add new gateway classes.
- **L — Liskov Substitution**: a subclass should be usable anywhere its parent is expected without breaking behavior. If `Rectangle` has `setWidth`/`setHeight` and `Square extends Rectangle` overrides them to keep both sides equal, code that assumes independent width/height breaks — a classic LSP violation.
- **I — Interface Segregation**: prefer several small, specific interfaces over one bloated one. Don't force a class to implement methods it doesn't need (e.g., don't make every `Notifiable` implement `sendSms()` if only some channels support SMS).
- **D — Dependency Inversion**: depend on abstractions, not concrete classes. A service should type-hint `PaymentGatewayInterface`, not `StripeGateway`, so the concrete implementation can be swapped (and the container resolves the binding).

This maps directly onto how Laravel's container/interface binding is meant to be used — DIP is essentially what `$this->app->bind(Interface::class, Concrete::class)` exists for.

### What is Composer, and how does it help PHP development?
Composer is PHP's dependency manager. It reads `composer.json`, resolves version constraints across all required packages, downloads them into `vendor/`, and generates an autoload map (`vendor/autoload.php`) so classes are available via PSR-4 autoloading without manual `require` statements.

Key things it provides:
- **Dependency resolution** — handles version constraints (`^`, `~`, exact) and conflicts between packages' own sub-dependencies.
- **Autoloading** — PSR-4/PSR-0 class-map generation; `composer dump-autoload` regenerates it, `-o` optimizes it into a flat classmap for production.
- **`composer.lock`** — pins exact resolved versions so every environment (dev, CI, production) installs identical dependency versions, not just "compatible" ones.
- **Scripts** — hooks like `post-install-cmd` to run tasks automatically (e.g., `php artisan package:discover`).
- **Package publishing** — via Packagist, letting you require any public package by name, or private packages via VCS/path repositories.

### How do PDO and MySQLi differ?
Both are PHP extensions for talking to a database.

| | PDO | MySQLi |
|---|---|---|
| Database support | 12+ drivers (MySQL, Postgres, SQLite, SQL Server...) | MySQL/MariaDB only |
| API style | OOP only | OOP and procedural |
| Named parameters | Yes (`:name`) | No, positional `?` only |
| Prepared statements | Yes | Yes |

PDO is the better default for portability and consistency (Laravel's own DB layer is built on PDO under the hood). MySQLi is fine if you're MySQL-only and want the procedural style, or need MySQL-specific features not exposed by PDO. Both support prepared statements, which is what actually protects against SQL injection — the driver choice itself isn't a security decision.

### What is a cookie in PHP?
A small piece of data stored on the client's browser, sent back to the server with every subsequent request to that domain. Set with `setcookie($name, $value, $expire, $path, $domain, $secure, $httponly)`, read via `$_COOKIE`. Common uses: remembering login state (usually a signed/encrypted token, not raw credentials), preferences, tracking. In Laravel, cookies are automatically encrypted/signed by the `EncryptCookies` middleware unless explicitly excluded, and `Cookie::queue()` is the idiomatic way to set one within the framework.

### How do you handle errors in PHP?
Two separate mechanisms:
- **Errors** (`E_WARNING`, `E_NOTICE`, fatal errors) — traditionally handled via `set_error_handler()`, and since PHP 7, most fatal errors are now `Error` objects that can be caught like exceptions (`Error` implements `Throwable`, same interface as `Exception`).
- **Exceptions** — thrown deliberately with `throw new Exception(...)`, caught with `try/catch`, optionally with `finally` for cleanup that must run regardless of outcome.

```php
try {
    $result = $service->process($data);
} catch (ValidationException $e) {
    // handle a specific, expected failure
} catch (Throwable $e) {
    // catch-all for anything else, including PHP Errors
    report($e);
} finally {
    // always runs — release a lock, close a connection, etc.
}
```

In Laravel specifically, uncaught exceptions flow through the `Handler` (or `bootstrap/app.php`'s `withExceptions()` in Laravel 11+), where you can render custom responses per exception type and report to logging/error tracking.

### What do public, protected, and private mean in PHP?
- **public** — accessible from anywhere: inside the class, subclasses, and outside code.
- **protected** — accessible within the class and any subclass, but not from outside code.
- **private** — accessible only within the exact class it's declared in, not even subclasses.

```php
class Base {
    public $a = 1;      // accessible everywhere
    protected $b = 2;   // accessible in Base and Child
    private $c = 3;     // accessible only in Base
}

class Child extends Base {
    public function show() {
        echo $this->a; // ok
        echo $this->b; // ok
        echo $this->c; // Error — undefined/inaccessible
    }
}
```
Default in PHP (if omitted) is `public`, but best practice is to always declare visibility explicitly.

### What inheritance does PHP support?
Inheritance lets a class (`extends`) reuse and override the properties/methods of a parent class. PHP supports **single inheritance only** — a class can extend exactly one parent (unlike traits, which can be multiple). Multi-level inheritance is allowed (A → B → C), and interfaces can be multiply implemented, which is how PHP works around not having multiple class inheritance.

```php
class Animal {
    public function speak(): string { return "..."; }
}
class Dog extends Animal {
    public function speak(): string { return "Woof"; }
}
```

### What is polymorphism in PHP?
The ability for different classes to be treated through a common interface, with each providing its own behavior for the same method call. Achieved via:
1. **Method overriding** (inheritance) — a subclass redefines a parent's method.
2. **Interfaces** — unrelated classes implement the same interface and can be used interchangeably wherever that interface is type-hinted.

```php
interface PaymentGateway {
    public function charge(int $amountCents): bool;
}
class StripeGateway implements PaymentGateway {
    public function charge(int $amountCents): bool { /* ... */ return true; }
}
class PaypalGateway implements PaymentGateway {
    public function charge(int $amountCents): bool { /* ... */ return true; }
}

function processPayment(PaymentGateway $gateway, int $amount) {
    return $gateway->charge($amount); // doesn't care which implementation
}
```

### What is the difference between method overriding and overloading in PHP?
- **Overriding** — a subclass redefines a method that already exists in its parent, with the same signature. Fully supported natively.
- **Overloading** (in the classic sense — multiple methods with the same name but different parameter signatures/types) — **not supported in PHP**. PHP is dynamically typed, so there's no way to distinguish calls by parameter type/count at compile time the way Java/C# does.

PHP achieves overloading-like behavior via **magic methods**:
```php
class Calculator {
    public function __call($name, $arguments) {
        if ($name === 'add') {
            return array_sum($arguments); // works for 2, 3, N args
        }
    }
}
$calc = new Calculator();
echo $calc->add(1, 2);       // 3
echo $calc->add(1, 2, 3, 4); // 10
```
`__call()` handles instance method calls to undefined/inaccessible methods; `__callStatic()` does the same for static calls; `__get`/`__set` do the equivalent for property access.

### What is an abstract class in PHP?
A class that cannot be instantiated directly and is meant to be extended. It can define both concrete methods (shared implementation) and abstract methods (no body — subclasses *must* implement them).

```php
abstract class Shape {
    abstract public function area(): float; // must be implemented by subclasses

    public function describe(): string {     // shared, concrete
        return "Area: " . $this->area();
    }
}
class Circle extends Shape {
    public function __construct(private float $radius) {}
    public function area(): float { return M_PI * $this->radius ** 2; }
}
```

### What is an interface in PHP?
A contract that defines method signatures (no implementation, no properties with values, though PHP 8.3+ allows constants) that implementing classes must fulfill. A class can implement multiple interfaces (`implements A, B`), which is PHP's way of supporting multiple "is-able-to" relationships without multiple inheritance.

```php
interface Exportable {
    public function toArray(): array;
}
interface Cacheable {
    public function cacheKey(): string;
}
class Report implements Exportable, Cacheable {
    public function toArray(): array { return []; }
    public function cacheKey(): string { return 'report:1'; }
}
```

### How do abstract classes and interfaces differ?
| | Abstract Class | Interface |
|---|---|---|
| Instantiable | No | No |
| Implementation | Can have concrete methods + abstract methods | Traditionally none (PHP 8+ allows constants only, no method bodies) |
| Properties | Can have typed properties with default values | No properties |
| Inheritance | Single — a class extends only one | Multiple — a class can implement many |
| Use case | "is-a" relationship with shared base behavior | "can-do" contract across unrelated classes |

Rule of thumb: use an abstract class when subclasses share real implementation and state; use an interface when you just need to guarantee a class supports certain behavior, regardless of its position in a hierarchy.

### What are static properties and methods in PHP?
Static members belong to the class itself, not to any instance — shared across all instances, accessed via `ClassName::$property` / `ClassName::method()` without needing `new`.

```php
class Counter {
    public static int $count = 0;
    public static function increment(): void {
        static::$count++;
    }
}
Counter::increment();
Counter::increment();
echo Counter::$count; // 2
```

### What are the benefits and drawbacks of static members?
Benefits — no need to instantiate for utility/helper functionality, shared state across the whole app lifecycle (e.g., a counter, a registry), slightly faster since no object allocation. Drawbacks — hard to mock/test (can't easily swap implementations via DI), introduces global mutable state which causes hidden coupling and race conditions in concurrent contexts (a real concern under Octane, where static state persists across requests), and breaks polymorphism in some cases since static calls aren't part of an object's dynamic dispatch the same way instance methods are (mitigated partly by late static binding via `static::`).

### Does PHP support method overloading?
- **Overriding** — a subclass redefines a method that already exists in its parent, with the same signature. Fully supported natively.
- **Overloading** (in the classic sense — multiple methods with the same name but different parameter signatures/types) — **not supported in PHP**. PHP is dynamically typed, so there's no way to distinguish calls by parameter type/count at compile time the way Java/C# does.

PHP achieves overloading-like behavior via **magic methods**:
```php
class Calculator {
    public function __call($name, $arguments) {
        if ($name === 'add') {
            return array_sum($arguments); // works for 2, 3, N args
        }
    }
}
$calc = new Calculator();
echo $calc->add(1, 2);       // 3
echo $calc->add(1, 2, 3, 4); // 10
```
`__call()` handles instance method calls to undefined/inaccessible methods; `__callStatic()` does the same for static calls; `__get`/`__set` do the equivalent for property access.

### What are namespaces in PHP?
Namespaces organize code into logical groups and prevent class-name collisions — critical once you're pulling in dozens of third-party packages via Composer that might otherwise define a class also called `Collection` or `Request`.

```php
namespace App\Services\Payment;

class Gateway { /* ... */ }
```
```php
use App\Services\Payment\Gateway as PaymentGateway;
use Illuminate\Http\Request; // no collision with a `Request` in your own app namespace
```
They're also the backbone of PSR-4 autoloading — Composer maps namespace prefixes to directories (`"App\\": "app/"`), so the class location is inferable directly from its fully-qualified name.

### How does exception handling work in PHP, and what exception types are available?
PHP has a built-in exception hierarchy under `Throwable` (implemented by both `Exception` and `Error`). Common built-ins:

- `Exception` — base class for user-land exceptions
- `ErrorException` — wraps a traditional PHP error/warning/notice as a catchable exception
- `InvalidArgumentException` — invalid argument passed to a function
- `RuntimeException` — error only detectable at runtime
- `LogicException` — a programming logic error (bad usage of the API)
- `DomainException` — a value outside the defined domain of acceptable values
- `LengthException` — value's length is invalid
- `OutOfBoundsException` / `OutOfRangeException` — invalid index/key access
- `OverflowException` / `UnderflowException` — operations exceeding container capacity

**Custom exceptions** extend the base class to carry domain-specific context and behavior:
```php
class InsufficientStockException extends Exception {
    public function __construct(private string $sku, int $requested, int $available) {
        parent::__construct("Insufficient stock for {$sku}: requested {$requested}, available {$available}");
    }
    public function sku(): string { return $this->sku; }
}

try {
    throw new InsufficientStockException('SKU-123', 10, 3);
} catch (InsufficientStockException $e) {
    Log::warning($e->getMessage(), ['sku' => $e->sku()]);
}
```

**Key `Exception`/`Throwable` methods:**
- `getMessage()` — the exception message
- `getCode()` — an optional numeric code
- `getFile()` / `getLine()` — where it was thrown
- `getTrace()` — stack trace as an array
- `getTraceAsString()` — stack trace as a formatted string
- `getPrevious()` — the previous exception, if this one wraps/chains another

### Which design patterns are commonly used in PHP?
- **Singleton** — ensures a class has only one instance, globally accessible. Laravel's container `singleton()` binding gives you this without writing the boilerplate yourself.
  ```php
  class Config {
      private static ?self $instance = null;
      private function __construct() {}
      public static function getInstance(): self {
          return self::$instance ??= new self();
      }
  }
  ```

- **Factory** — centralizes object creation logic, so callers don't need to know the concrete class being instantiated.
  ```php
  class NotificationFactory {
      public static function make(string $type): NotificationChannel {
          return match ($type) {
              'email' => new EmailChannel(),
              'sms'   => new SmsChannel(),
          };
      }
  }
  ```

- **Observer** — one object (subject) notifies a list of dependents (observers) when its state changes, without being tightly coupled to them. Laravel's Event/Listener system *is* this pattern, framework-provided.

- **Strategy** — encapsulates interchangeable algorithms behind a common interface, selected at runtime. E.g., the `PaymentGateway` interface example above — swap the strategy without changing the calling code.

- **Adapter** — wraps an incompatible interface to make it compatible with what your code expects. E.g., wrapping a third-party SMS SDK behind your own `SmsSenderInterface` so the rest of the app doesn't depend on that vendor's API shape directly.

- **Decorator** — wraps an object to add behavior without altering its class. E.g., wrapping a `Repository` with a `CachingRepositoryDecorator` that checks cache before delegating to the real repository.

- **MVC** — Model (data/business rules), View (presentation), Controller (orchestrates request → model → view). Laravel's whole structure is built around this, though in practice "fat controllers" get avoided by pushing logic into services/actions and keeping controllers thin.

### What is the difference between self::class and static::class?
`self::` resolves to the class where the code is *written* (compile-time binding). `static::` uses **late static binding** — it resolves to the class that was actually *called* at runtime, which matters when a method is inherited and the parent calls a static method that a child has overridden.

```php
class ParentClass {
    public static function create(): static {
        return new static(); // late static binding
    }
    public function whoSelf(): string { return self::class; }
    public function whoStatic(): string { return static::class; }
}
class ChildClass extends ParentClass {}

$child = ChildClass::create();
echo get_class($child);      // ChildClass — static:: respected the actual called class
echo $child->whoSelf();      // ParentClass — self:: is fixed to where it's declared
echo $child->whoStatic();    // ChildClass — static:: resolves to the runtime class
```
This is exactly why Eloquent's `Model::create()`-style methods return the correct subclass — they use `static::` internally, not `self::`.

### How can you count each character in “SOFTWARE ENGINEER” with PHP?
```php
$word = "SOFTWARE ENGINEER";
$counts = array_count_values(str_split($word));
print_r($counts);
// prints frequency of each character including the space
```
If spaces should be ignored:
```php
$counts = array_count_values(str_split(str_replace(' ', '', $word)));
```

### How do you find the maximum value in a PHP array in one line?
```php
$max = max([5, 9, 2, 3, 6, 45]); // 45
```

### How do you version a REST API?
Most common in Laravel: URI-based versioning (`/api/v1/users`), implemented via route prefixes/groups pointing to versioned controller namespaces. Alternative: a custom `Accept` header (`Accept: application/vnd.myapp.v2+json`) resolved by middleware — more "RESTfully pure" but harder for clients to work with/debug (can't just hit the URL in a browser or curl without extra headers). I default to URI versioning for its simplicity and cacheability, reserving header versioning for cases where clients need very fine-grained control.

### What is throttling in an API?
Limiting how many requests a client can make in a given time window, to protect the API from abuse/overload and to enforce fair usage across clients. In Laravel, the `throttle:60,1` middleware (60 requests per minute) uses the cache (ideally Redis in production for accuracy across multiple servers) to track request counts per key (IP, user id, API token).

### How would you implement rate limiting in a PHP REST API?
Using Laravel's `RateLimiter` facade with named limiters registered in a service provider:
```php
RateLimiter::for('api', function (Request $request) {
    return $request->user()
        ? Limit::perMinute(120)->by($request->user()->id)
        : Limit::perMinute(20)->by($request->ip());
});
```
Then apply via `->middleware('throttle:api')` on routes. Under the hood it's a sliding/fixed window counter in cache, incrementing per key and comparing against the limit, returning `429 Too Many Requests` with a `Retry-After` header once exceeded. For custom (non-Laravel) implementations, the same idea works with Redis `INCR` + `EXPIRE` on a key like `throttle:{client_id}:{minute_bucket}`.

### Which HTTP methods can a PHP REST API handle?
The REST convention: `GET` (read), `POST` (create), `PUT` (full replace/update), `PATCH` (partial update), `DELETE` (remove). PHP itself doesn't restrict HTTP methods — it's the web server/framework routing that decides which are recognized. HTML forms only natively support `GET`/`POST`, so Laravel simulates `PUT`/`PATCH`/`DELETE` for HTML forms via a hidden `_method` field (`@method('PUT')` in Blade) which the `MethodOverride` middleware reads and treats as the real verb — but for actual API clients (fetch/axios/Postman/mobile apps) you send the real `PUT`/`PATCH`/`DELETE` HTTP method directly, no simulation needed.
