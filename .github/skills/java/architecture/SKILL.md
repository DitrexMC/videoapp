---
name: java-architecture
description: Java project architecture — package layout, layered design, dependency injection patterns, and module boundaries.
---

# Java Architecture

Extends `.github/skills/general/architecture/SKILL.md`.

---

## Package Layout

```
src/main/java/
└── com/example/
    ├── core/
    │   ├── domain/          # Entities, value objects, domain events
    │   │   ├── Player.java
    │   │   └── Rank.java
    │   ├── repository/      # Repository interfaces (owned by domain)
    │   │   └── PlayerRepository.java
    │   └── event/           # Domain events
    │       └── PlayerJoinEvent.java
    ├── application/         # Use cases / application services
    │   └── PlayerService.java
    ├── infrastructure/      # DB, external API, framework adapters
    │   ├── database/
    │   │   └── JpaPlayerRepository.java
    │   └── http/
    │       └── DiscordWebhookClient.java
    └── presentation/        # Entry points (CLI, HTTP, event listeners)
        └── command/
            └── RankCommand.java
```

**Rule:** Package path must match the logical layer. Cross-layer imports flow inward only (presentation → application → domain).

---

## Dependency Injection

Use constructor injection. Do not use field injection (`@Autowired` on fields) — it hides dependencies and makes testing difficult.

```java
// FORBIDDEN — field injection
@Component
public class PlayerService {
    @Autowired
    private PlayerRepository repository;  // hidden dependency
}

// REQUIRED — constructor injection
@Component
public final class PlayerService {
    private final PlayerRepository repository;

    public PlayerService(PlayerRepository repository) {
        this.repository = Objects.requireNonNull(repository);
    }
}
```

---

## Interface-Driven Design

Interfaces are owned by the layer that consumes them, not the layer that implements them.

```
com.example.core.repository.PlayerRepository  ← interface, owned by domain
com.example.infrastructure.database.JpaPlayerRepository implements PlayerRepository
```

---

## Module Boundaries

Use package-private access to enforce module boundaries:

- Classes that should not be used outside their module are package-private.
- Only the module's public API is `public`.

For multi-module Gradle/Maven builds:

- Each module is a separate subproject.
- Inter-module dependencies are declared explicitly in `build.gradle` / `pom.xml`.

---

## Event System

For decoupled cross-module communication, use an event bus or Spring's `ApplicationEvent`:

```java
// Domain event
public record PlayerRankChangedEvent(String xuid, Rank newRank) implements DomainEvent { }

// Publisher (in domain/application layer)
eventBus.publish(new PlayerRankChangedEvent(player.getXuid(), newRank));

// Subscriber (in any module — no direct dependency on the publisher)
@EventListener
public void onRankChanged(PlayerRankChangedEvent event) { ... }
```

---

## Naming Conventions for Layers

| Layer                  | Naming                                                   |
| ---------------------- | -------------------------------------------------------- |
| Domain entity          | `Player`, `Rank`, `Session`                              |
| Domain event           | `PlayerJoinedEvent`, `RankChangedEvent`                  |
| Repository (interface) | `PlayerRepository`, `SessionRepository`                  |
| Repository (impl)      | `JpaPlayerRepository`, `InMemoryPlayerRepository`        |
| Application service    | `PlayerService`, `RankService`                           |
| Use case               | `AssignRankUseCase`, `ProcessDuelRequestUseCase`         |
| Infrastructure         | `DiscordWebhookClient`, `MysqlSessionRepository`         |
| Presentation           | `RankCommand`, `PlayerEventListener`, `PlayerController` |
