---
name: java-coding-standards
description: Java 17+ coding standards. Covers immutability, generics, exception handling, naming conventions, records, and Java-specific anti-patterns. Extends general coding standards.
---

# Java Coding Standards

Extends `.github/skills/general/coding-standards/SKILL.md`.

---

## 1. File Header

```java
package com.example.module.subpackage;

// Standard library imports (sorted)
import java.util.List;
import java.util.Map;
import java.util.Optional;

// Third-party imports
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

// Project-internal imports
import com.example.core.SomeInterface;
```

**Rules:**

- Package name matches directory path exactly.
- Static imports are only for constants and test DSLs (`assertThat`, `Mockito.when`, etc.).
- Wildcard imports (`import java.util.*`) are forbidden.

---

## 2. Immutability First

Prefer immutable data. Fields and parameters should be `final` whenever they are not reassigned.

```java
// REQUIRED — final fields where possible
private final UserRepository users;
private final Logger logger;

// For value objects: prefer records (Java 16+)
public record PlayerId(String xuid) {
    public PlayerId {
        Objects.requireNonNull(xuid, "xuid must not be null");
    }
}
```

---

## 3. Type Safety — No Raw Types

```java
// FORBIDDEN — raw types
List players = new ArrayList();
Map sessions = new HashMap();

// REQUIRED — parameterized types
List<Player> players = new ArrayList<>();
Map<String, PlayerSession> sessions = new HashMap<>();
```

Use bounded wildcards when appropriate:

```java
public void processAll(List<? extends Processable> items) { ... }
```

---

## 4. Braces on All Control Structures

Same rule as PHP — no braceless single-statement bodies.

```java
// FORBIDDEN
if (condition) return;
for (Item item : items) process(item);

// REQUIRED
if (condition) {
    return;
}
for (Item item : items) {
    process(item);
}
```

---

## 5. Nullability

Avoid `null` returning methods in new code. Prefer:

- `Optional<T>` for values that may be absent
- Empty collections over `null` collections
- Annotate with `@Nullable` / `@NonNull` (from `org.jetbrains:annotations` or `javax.annotation`) for framework boundaries

```java
// PREFERRED
public Optional<PlayerSession> findSession(String xuid) {
    return Optional.ofNullable(sessions.get(xuid));
}

// Instead of
public @Nullable PlayerSession findSession(String xuid) {
    return sessions.get(xuid);
}
```

---

## 6. Exception Handling

```java
// FORBIDDEN — empty catch
try {
    riskyOperation();
} catch (Exception e) {
    // empty
}

// REQUIRED — log and rethrow, or handle explicitly
try {
    riskyOperation();
} catch (IOException e) {
    logger.error("Failed to read config: {}", e.getMessage(), e);
    throw new ConfigurationException("Config load failed", e);
}
```

- Catch specific exceptions, not `Exception` or `Throwable` in inner scopes.
- Catch `Throwable` only at the outermost boundary (server loop, plugin lifecycle).
- Never swallow exceptions silently.

---

## 7. Class Design

```java
// Final by default for non-extensible classes
public final class PlayerSessionManager { ... }

// Abstract for designed-for-extension
public abstract class BaseModule { ... }

// Records for value objects
public record Rank(String name, int level) { }
```

**Constructor injection:**

```java
public final class PlayerSessionManager {
    private final PlayerRepository repository;
    private final Logger logger;

    public PlayerSessionManager(PlayerRepository repository, Logger logger) {
        this.repository = Objects.requireNonNull(repository);
        this.logger = Objects.requireNonNull(logger);
    }
}
```

---

## 8. Naming Conventions

| Element        | Convention                | Example                          |
| -------------- | ------------------------- | -------------------------------- |
| Class          | `UpperCamelCase`          | `PlayerSessionManager`           |
| Interface      | `UpperCamelCase`          | `PlayerRepository`               |
| Method         | `lowerCamelCase`          | `getSession()`, `isOnline()`     |
| Field          | `lowerCamelCase`          | `sessionMap`                     |
| Constant       | `UPPER_SNAKE_CASE`        | `MAX_PLAYERS`                    |
| Package        | `lowercase.dots`          | `com.example.core`               |
| Boolean method | `is`, `has`, `can` prefix | `isRunning()`, `hasPermission()` |

---

## 9. Anti-Patterns

| Anti-Pattern                        | Why Forbidden                    | Correct Approach         |
| ----------------------------------- | -------------------------------- | ------------------------ |
| Raw types (`List`, `Map`)           | Type safety lost at compile time | Parameterized types      |
| `null` return instead of `Optional` | NPE risk                         | `Optional<T>`            |
| Empty `catch` block                 | Hides failures                   | Log and rethrow          |
| Wildcard imports                    | Namespace ambiguity              | Explicit imports         |
| Mutable public fields               | Encapsulation broken             | Private fields + getters |
| `static` mutable state              | Hidden global state              | Inject via constructor   |
| `TODO`/`FIXME` in committed code    | Technical debt                   | File an issue            |
| What-comments                       | Noise                            | Self-documenting names   |
| Commented-out code                  | Confusion                        | Delete, use git          |
