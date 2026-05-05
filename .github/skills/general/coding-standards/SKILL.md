---
name: general-coding-standards
description: Language-agnostic coding standards that apply to all code regardless of language. Covers comment minimalism, API verification, and self-documenting code principles.
---

# General Coding Standards

These rules apply to all code, in all languages. Language-specific rules are additive — they extend these, never override them.

---

## 1. Comment Minimalism

### The Rule

Code must be self-documenting. Comments are **prohibited by default**.

### Permitted Comments

Only these three categories are allowed:

**1. Type annotation doc comments** — when the type system cannot express the type:

```php
/** @var array<string, PlayerSession> $sessions */

/** @return array{name: string, rank: int} */
```

```java
// Java: prefer generics + @Nullable; doc comments on non-obvious return shapes are ok
```

**2. Single-line "why" comment** — for genuinely non-obvious business logic decisions. Must explain _why_, not _what_:

```php
// Delay 1 tick: teleport during PlayerJoinEvent causes client desync on PM5
$scheduler->scheduleDelayedTask(..., 1);
```

```java
// Offset by 1: the upstream API uses 0-indexed IDs but our DB stores 1-indexed
return externalId - 1;
```

**3. Interface/class-level doc blocks** — only when the project's conventions require them for API documentation (e.g., public library APIs).

### Prohibited Comments

| Kind                | Example                                                         | Why Prohibited           |
| ------------------- | --------------------------------------------------------------- | ------------------------ |
| What-comments       | `// check if player is online` above `if ($player->isOnline())` | The code already says it |
| Commented-out code  | `// $player->sendMessage("old message");`                       | Use version control      |
| `TODO` / `FIXME`    | `// TODO: fix this later`                                       | File an issue instead    |
| Redundant summaries | `// increment counter` above `$count++`                         | Noise                    |
| Stale comments      | A comment that no longer matches the code                       | Actively harmful         |

### How to Name Your Way Out of a Comment

If you feel a comment is needed to explain _what_ code does, rename instead:

```php
// BEFORE — comment needed because name is opaque
$r = computeR($p, $q); // compute the rank score from player and queue data

// AFTER — no comment needed
$rankScore = computeRankScore($player, $queueEntry);
```

---

## 2. Self-Documenting Code Techniques

### Names carry intent

- Variables, methods, and classes must be named for their domain concept, not their implementation.
- Avoid abbreviations except universally understood ones (`id`, `url`, `db`).
- Boolean variables and methods start with `is`, `has`, `can`, `should`.

### Extract to name

When a complex expression needs a comment, extract it to a named variable or method:

```php
// BEFORE
if ($player->getHealth() < 5.0 && !$player->hasEffect(VanillaEffects::REGENERATION())) {
    // apply emergency heal if player is near death and has no regeneration
    ...
}

// AFTER
$isNearDeath = $player->getHealth() < 5.0;
$hasNoRegeneration = !$player->hasEffect(VanillaEffects::REGENERATION());
if ($isNearDeath && $hasNoRegeneration) {
    ...
}
```

---

## 3. External API Verification

### The Rule

Never assume an external API (framework method, library function, platform class) exists.
Always verify before using it.

### Verification Steps

1. Search for the class/method in the project's stubs, vendor, or dependency source.
2. Read the actual signature (parameters, return type, exceptions thrown).
3. If found: use the verified signature.
4. If NOT found: **explicitly write "API NOT FOUND: [qualified name]"** and stop. Do not guess. Do not fabricate a signature.

### Why This Matters

Fabricated API calls produce code that looks correct but fails at runtime.
Stating "not found" allows the team to investigate: it may be a version mismatch, a missing dependency, or a wrong assumption.

---

## 4. Dead Code

Never commit:

- Unreachable branches
- Unused imports, variables, or parameters
- Commented-out code
- Feature flags with only one active path remaining

Use version control (`git`) to recover old code if needed.

---

## 5. Constants Over Magic Values

Any value that is not self-evident from context (a number, a string key, a threshold) must be named:

```php
// BEFORE
if ($player->getHealth() < 4.0) { ... }

// AFTER
private const CRITICAL_HEALTH_THRESHOLD = 4.0;
if ($player->getHealth() < self::CRITICAL_HEALTH_THRESHOLD) { ... }
```
