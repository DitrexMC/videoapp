---
name: php-architecture
description: PHP project architecture — PSR-4 namespace layout, dependency injection, interface-driven design, and module structure.
---

# PHP Architecture

Extends `.github/skills/general/architecture/SKILL.md`.

---

## Namespace Layout (PSR-4)

Namespace must exactly mirror the directory path under the autoload root.

```
src/
├── Core/
│   ├── Domain/          # Business rules, entities, value objects
│   │   └── User.php     → namespace App\Core\Domain;
│   ├── Repository/      # Repository interfaces (domain-owned)
│   │   └── UserRepository.php
│   └── Event/           # Domain events
├── Application/         # Use cases / application services
├── Infrastructure/      # DB implementations, external API clients
│   ├── Database/
│   └── Http/
└── Presentation/        # CLI commands, HTTP controllers, event listeners
```

**Rule:** If the namespace does not match the file path, PSR-4 autoloading fails. Verify the mapping.

---

## Dependency Injection

PHP projects should use constructor injection. Never rely on service locators or static accessors inside business logic.

```php
// FORBIDDEN in domain/application layer
$db = GlobalContainer::get(DatabaseInterface::class);

// REQUIRED — constructor injection
public function __construct(
    private readonly UserRepository $users,
    private readonly LoggerInterface $logger,
) {
}
```

**Exception:** Framework entry points (`PluginBase::onEnable()`, controllers, command `execute()`) may use service accessors to bootstrap the dependency graph.

---

## Interface-Driven Design

Define interfaces in the layer that consumes them (domain or application), not in the layer that implements them.

```
App\Core\Repository\UserRepository        ← interface, owned by domain
App\Infrastructure\Database\MysqlUserRepository implements UserRepository
```

---

## Autoloading Verification

Before introducing a new class:

1. Confirm the namespace matches the directory path.
2. Confirm `composer.json` has the correct PSR-4 mapping.
3. If using `vendor/` libraries: read the library's actual class path before importing.

---

## Shared Code Placement

| "Is it...?"                          | Place it in                 |
| ------------------------------------ | --------------------------- |
| Used by all modules                  | `Core/` or `Common/`        |
| Implementation of a domain interface | `Infrastructure/`           |
| Use-case orchestration               | `Application/`              |
| User/system-facing entry point       | `Presentation/`             |
| Specific to one bounded context      | That context's subdirectory |

---

## Module Boundaries in PHP

In PHP projects without a formal module system, enforce boundaries through namespaces and `composer.json` path restrictions (or PHPStan baseline rules).

- Each module owns its namespace: `App\Module\Lobby\*`, `App\Module\Practice\*`
- Modules communicate only through interfaces in `App\Core\*`
- PHPStan or Deptrac can enforce these boundaries automatically
