## Composer

### What is Composer?
Composer is the standard dependency manager for PHP. It resolves packages from version constraints in `composer.json`, installs them into `vendor/`, and provides an autoloader. Applications generally commit both `composer.json` and `composer.lock` so development and deployment use the same dependency set.
```bash
composer require monolog/monolog
composer install
```

### What is composer.lock for?
`composer.lock` records the exact package versions and references Composer resolved. `composer install` uses the lock file to reproduce that set; `composer update` resolves newer versions allowed by `composer.json` and updates the lock. Commit the lock file for applications, but not normally for reusable libraries.
```bash
composer install  # installs the exact locked versions
composer update  # resolves allowed updates and rewrites the lock file
```

### What is the difference between require and require-dev?
`require` lists packages needed for the application to run. `require-dev` lists tools used only during development, such as test runners, static analyzers, and code formatters. Production installs can omit development packages with `composer install --no-dev`.
```json
{
  "require": {"monolog/monolog": "^3.0"},
  "require-dev": {"phpunit/phpunit": "^11.0"}
}
```

### How does Composer autoload PHP classes?
Composer generates `vendor/autoload.php` from the configured autoload rules. With PSR-4, a namespace prefix maps to a directory; include the generated loader once and Composer can find classes by namespace and path.

```json
{
  "autoload": {
    "psr-4": { "App\\": "src/" }
  }
}
```

After changing autoload rules, regenerate the map with `composer dump-autoload`.

### What are Composer scripts?
Composer scripts are named commands declared in `composer.json`. They can chain common project tasks such as tests, formatting, or code generation and run with `composer run <script-name>`. Scripts should call tools available to the project and avoid hiding destructive or surprising operations.

```json
{
  "scripts": {
    "test": "phpunit"
  }
}
```

### How do composer.json and composer.lock work together?
`composer.json` declares package requirements and project configuration; `composer.lock` stores the concrete dependency versions that satisfy those requirements. Running `composer install` in an application reproduces the lock. Running `composer update` recalculates dependencies and changes the lock, which should be reviewed and committed with intentional updates.
```bash
composer require monolog/monolog  # updates composer.json and composer.lock
composer install                  # reproduces composer.lock
```

### How can a project use different versions of a package?
A single Composer dependency graph normally resolves one version of a package per package name. Use a version constraint to select a compatible release. If two applications need incompatible major versions, isolate them as separate Composer projects or services; loading both versions into one PHP runtime often causes class and autoloading conflicts.
```json
{
  "require": {"vendor/library": "^2.4"}
}
```

### What does Composer’s optimized autoloader do?
`composer install --optimize-autoloader` builds a class map that can make production class lookup faster. It is commonly used with `--no-dev` for deployment. `--classmap-authoritative` can speed lookup further but assumes all classes are known at build time, so avoid it if the app dynamically generates classes.

```bash
composer install --no-dev --optimize-autoloader
```

### What are Composer stability flags?
Stability levels are `dev`, `alpha`, `beta`, `RC`, and `stable`. The `minimum-stability` setting controls the least stable packages allowed overall; a per-package stability flag such as `@dev` can allow one explicitly selected development dependency. Prefer stable releases unless a development build is intentionally required.
```json
{
  "minimum-stability": "stable",
  "prefer-stable": true,
  "require": {"vendor/package": "dev-main@dev"}
}
```
