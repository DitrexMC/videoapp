---
name: php-coding-standards
description: PHP 8.2+ coding standards. Covers file structure, type safety, import rules, braces, async patterns, error handling, and PHP-specific anti-patterns. Extends general coding standards.
---

# PHP Coding Standards

Extends `.github/skills/general/coding-standards/SKILL.md`.
These rules apply to all PHP files regardless of the framework used.

---

## 1. File Header (every .php file)

```php
<?php

declare(strict_types=1);

namespace Vendor\Module\Subpackage;

// Group 1: Standard / PSR interfaces (if any)
use Psr\Log\LoggerInterface;

// Group 2: Framework / library imports (alphabetical)
use SomeFramework\BaseClass;

// Group 3: Project-internal imports (alphabetical)
use MyApp\Core\SomeInterface;
```

**Rules:**

- `declare(strict_types=1)` is mandatory in every file — no exceptions.
- Namespace must exactly match the directory path (PSR-4).
- `use` statements: grouped by vendor, sorted alphabetically within each group, one blank line between groups.
- No blank line between the last `use` and the class declaration.

---

## 2. No Inline Fully-Qualified Class Names

All classes must be imported via `use`. Inline FQCNs are **forbidden** everywhere except inside `use` statements.

```php
// FORBIDDEN
$obj = new \Vendor\Package\ClassName();
$result = \Vendor\Package\ClassName::staticMethod();
function foo(\Vendor\Package\Type $param): \Vendor\Package\OtherType {}

// REQUIRED — import at top, use short name
use Vendor\Package\ClassName;
use Vendor\Package\OtherType;
use Vendor\Package\Type;

$obj = new ClassName();
$result = ClassName::staticMethod();
function foo(Type $param): OtherType {}
```

---

## 3. Braces on ALL Control Structures

No exceptions. All `if`, `else`, `elseif`, `foreach`, `while`, `for`, `do` require `{}`.

```php
// FORBIDDEN
if ($condition) return;
if ($condition) $x = 1;
else $x = 2;
foreach ($items as $item) process($item);
while ($running) tick();

// REQUIRED
if ($condition) {
    return;
}
if ($condition) {
    $x = 1;
} else {
    $x = 2;
}
foreach ($items as $item) {
    process($item);
}
while ($running) {
    tick();
}
```

`match` expressions use their own syntax and are exempt.

---

## 4. Type Declarations Everywhere

```php
// FORBIDDEN
class Foo {
    public $bar;
    public function doThing($x) { ... }
    public function getBar() { return $this->bar; }
}

// REQUIRED
final class Foo {
    private string $bar;

    public function doThing(int $x): void { ... }
    public function getBar(): string { return $this->bar; }
}
```

**Rules:**

- All constructor parameters: typed
- All method parameters: typed
- All return types: declared (including `void`)
- All class properties: typed
- Nullable: use `?Type` (consistent; avoid `Type|null` union unless necessary)
- `mixed`: allowed only when genuinely unavoidable — no comment required unless non-obvious

**Prefer `readonly` for injected dependencies and value objects:**

```php
public function __construct(
    private readonly LoggerInterface $logger,
    private readonly string $xuid,
) {
}
```

---

## 5. Class Design

### Final by default

Concrete classes must be `final` unless explicitly designed for extension.

```php
final class PlayerSessionManager { ... }    // concrete — final
abstract class BaseRepository { ... }       // designed for extension — abstract
interface SessionManagerInterface { ... }   // contract — interface
```

### Constructor promotion

Use constructor promotion for simple dependency injection:

```php
public function __construct(
    private readonly DatabaseInterface $database,
    private readonly LoggerInterface $logger,
) {
}
```

### No ad-hoc singletons

Do not introduce new `static $instance` singletons. Inject dependencies via the constructor.
If a singleton already exists in the codebase (e.g., `Sulfur::getInstance()`), use it through the established pattern — do not replicate it.

---

## 6. Error Handling

```php
// FORBIDDEN — silent swallow
try {
    riskyOperation();
} catch (\Throwable $e) {
    // empty
}

// REQUIRED — always handle or rethrow
try {
    riskyOperation();
} catch (\Throwable $e) {
    $this->logger->error($e->getMessage(), ['exception' => $e]);
    throw $e; // or handle appropriately
}
```

Catch `\Throwable` only at the outermost boundary. Catch specific exceptions in inner scopes.

---

## 7. Async / Callback Patterns

When using async callbacks (libasynql, Guzzle, ReactPHP, etc.):

- Always provide an error/rejection handler — never omit it.
- In callbacks: re-fetch mutable state (player, entity, connection) — do not capture it in closures.
- After an async continuation (yield, callback): verify the captured resource is still valid.

```php
// PATTERN — re-fetch after async operation
$xuid = $player->getXuid();

$this->database->executeSelect(
    "app.user.get",
    ["xuid" => $xuid],
    function (array $rows) use ($xuid): void {
        $player = Server::getInstance()->getPlayerByXuid($xuid);
        if ($player === null || !$player->isOnline()) {
            return;
        }
        // safe to act on $player
    },
    function (SqlError $error): void {
        $this->logger->error((string) $error);
    }
);
```

---

## 8. phpDoc Usage

phpDoc is only for cases the type system cannot express:

```php
/** @var array<string, PlayerSession> $sessions */
private array $sessions = [];

/**
 * @param array<int, string> $names
 * @return array<string, bool>
 */
public function checkNames(array $names): array { ... }
```

Do not write `@param` or `@return` doc blocks when the types are already declared in the signature.

---

## 9. Anti-Patterns

| Anti-Pattern                     | Why Forbidden       | Correct Approach       |
| -------------------------------- | ------------------- | ---------------------- |
| `new \Full\Class\Name()`         | Inline FQCN         | `use` at top           |
| `if ($x) return;`                | Missing braces      | Always `{}`            |
| Untyped `$param`                 | PHPStan failure     | Declare all types      |
| `@param int $x` on typed method  | Redundant doc       | Remove the doc block   |
| Silent `catch` block             | Hides bugs          | Handle or rethrow      |
| `static $instance` singletons    | Hidden global state | Constructor injection  |
| `TODO`/`FIXME` in committed code | Technical debt      | File an issue          |
| What-comments in code            | Noise               | Self-documenting names |
| Commented-out code               | Confusion           | Delete it, use git     |
| Magic string/number literals     | Unreadable          | Named constants        |
