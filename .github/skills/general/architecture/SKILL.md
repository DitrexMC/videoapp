---
name: general-architecture
description: Language-agnostic architecture principles — layering, module isolation, dependency direction, and extension points.
---

# General Architecture

These principles apply to all projects regardless of language.

---

## 1. Layered Architecture

Code is organized into layers. Dependencies flow in one direction only: **outer layers depend on inner layers, never the reverse**.

```
┌────────────────────────────────┐
│  Presentation / Delivery       │  Commands, Forms, HTTP handlers, Event listeners
├────────────────────────────────┤
│  Application / Use-case        │  Orchestration of domain operations
├────────────────────────────────┤
│  Domain / Core                 │  Business logic, entities, value objects, events
├────────────────────────────────┤
│  Infrastructure / Adapters     │  Database, external APIs, platform frameworks
└────────────────────────────────┘
```

**Direction rule:** Domain/Core must NOT import from Presentation or Infrastructure.
Infrastructure adapts to the Domain interface, not the other way around.

---

## 2. Module Isolation

Modules (feature areas, bounded contexts) must not import directly from each other.

```
✅ ModuleA → Core         (allowed: depend on shared abstractions)
✅ ModuleB → Core         (allowed)
❌ ModuleA → ModuleB      (forbidden: direct cross-module dependency)
```

Cross-module communication goes through:

- Shared abstractions in the Core/Common layer
- Events (publish/subscribe)
- Explicit interfaces

---

## 3. Dependency Direction

- High-level modules define interfaces.
- Low-level modules implement them.
- The consumer owns the interface, not the provider.

```
Domain defines:  interface PlayerRepository
Infrastructure:  class DatabasePlayerRepository implements PlayerRepository
Application:     depends on PlayerRepository (the interface)
```

---

## 4. Single Responsibility

Each class, module, or file should have one reason to change.
If a class does two distinct things, split it.

---

## 5. New Code Placement Heuristic

| "Is it...?"                         | Place it in              |
| ----------------------------------- | ------------------------ |
| Shared by all modules               | Core / Common            |
| Specific to one feature             | That feature's module    |
| Bridges the framework to the domain | Infrastructure / Adapter |
| Pure business rule                  | Domain / Core            |
| User-facing entry point             | Presentation / Delivery  |

---

## 6. Extension Points

Design for extension at boundaries, not inside implementations.
Prefer:

- Events over direct calls for cross-cutting concerns
- Interfaces over concrete dependencies for replaceable components
- Configuration over hard-coded behaviour

---

## 7. Naming Conventions for Layers

Use consistent naming to make layer membership obvious at a glance:

| Layer          | Naming Examples                                                            |
| -------------- | -------------------------------------------------------------------------- |
| Presentation   | `*Command`, `*Form`, `*Handler`, `*Listener`, `*Controller`                |
| Application    | `*Service`, `*UseCase`, `*Orchestrator`, `*Initializer`                    |
| Domain         | `*Entity`, `*ValueObject`, `*Event`, `*Repository (interface)`, `*Manager` |
| Infrastructure | `*Repository (impl)`, `*Connector`, `*Client`, `*Adapter`                  |
