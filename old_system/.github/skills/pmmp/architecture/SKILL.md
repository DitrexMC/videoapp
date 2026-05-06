---
name: pmmp-architecture
description: PocketMine-MP plugin architecture for SulfurNetwork. Module/layer boundaries, session hierarchy, lifecycle, and world management patterns.
---

# PocketMine-MP Plugin Architecture

Extends `php/architecture/SKILL.md` and `general/architecture/SKILL.md`.
Specific to the SulfurNetwork plugin in this repository.

---

## Directory Layout

```
src/
├── sulfur/
│   ├── Sulfur.php                      # PluginBase entry point — bootstraps only
│   │
│   ├── core/                           # Platform infrastructure (framework adapters)
│   │   ├── command/                    # BaseCommand, CommandEnum, PermissionUtils
│   │   ├── config/                     # BaseConfig, RanksConfig, ServerConfig
│   │   ├── database/                   # SqlConnection, PlayerRepository, DatabaseInitializer
│   │   ├── form/                       # ActionForm, ModalForm, MessageForm
│   │   ├── kit/                        # Kit, KitManager, KitParser, PlayerApplyKitEvent
│   │   ├── lifecycle/                  # ServerInitializer, ServerTerminator
│   │   ├── listener/                   # ServerListener (core PM events only)
│   │   ├── locale/                     # TranslationManager, Language
│   │   ├── module/                     # BaseModule, ModuleManager
│   │   │   ├── item/                   # BaseModuleItem, SettingsItem
│   │   │   ├── listener/               # BaseModuleListener, ModuleEventDispatcher
│   │   │   └── session/                # BaseModuleSession, BaseModuleSessionManager
│   │   ├── rank/                       # Rank, RankManager, RankLoader
│   │   ├── session/                    # ServerSession, ServerSessionManager, DimensionTransfer
│   │   │   ├── event/                  # PlayerModuleSwitchEvent
│   │   │   └── scoreboard/             # ScoreboardAPI, ScoreboardInfo
│   │   ├── task/                       # BaseTask, BaseAsyncTask, AsyncTaskManager
│   │   └── world/                      # WorldInfo, WorldInfoManager, VoidGenerator, Trigger
│   │
│   ├── common/                         # Stateless shared UI (commands, forms)
│   │
│   ├── lobby/                          # Lobby module — idle players, matchmaking UI
│   │   ├── commands/, forms/, items/, kit/
│   │   ├── lifecycle/, listener/, scoreboard/
│   │   └── session/
│   │
│   ├── practice/                       # Practice module — 1v1 duels, party, queue
│   │   ├── arena/, commands/, duel/, entity/
│   │   ├── forms/, items/, lifecycle/, listener/
│   │   ├── lobby/, party/, queue/, request/
│   │   └── session/
│   │
│   └── hive/                           # (Future) Hive module
│
├── ditrex/webhookapi/                  # Discord webhook — non-PocketMine
└── poggit/libasynql/                   # Vendored async SQL (do not modify)
```

---

## Layering Rules

### L-1: `core/` — framework adapter layer

`core/` adapts PocketMine-MP to the plugin's domain. Business logic inside `core/` must not call `pocketmine\*` APIs directly.

**Adapter sub-packages (PM API allowed here):**

- `core/listener/` — extends `pocketmine\event\Listener`
- `core/command/` — extends `pocketmine\command\Command`
- `core/form/` — wraps PocketMine form API
- `core/task/` — wraps `pocketmine\scheduler\*`

**Domain sub-packages (PM API forbidden here):**

- `core/module/`, `core/session/`, `core/rank/`, `core/kit/`, `core/config/`, `core/locale/`

### L-2: Module isolation

`sulfur\lobby\*` and `sulfur\practice\*` must never import from each other.

Cross-module communication uses:

- `core/session/ServerSession` — shared player state
- `core/module/ModuleManager` — module transitions
- Custom events in `core/*/event/`

### L-3: `common/` — stateless only

`common/` holds presentational code reused by any module.
It must not own or mutate game state.

### L-4: Placement heuristic

| "Is it...?"             | Place it in                               |
| ----------------------- | ----------------------------------------- |
| Shared by all modules   | `core/`                                   |
| Specific to lobby       | `lobby/`                                  |
| Specific to practice    | `practice/`                               |
| Shared stateless UI     | `common/`                                 |
| Third-party integration | `ditrex/` (or a similar vendor namespace) |

---

## Module Contract

Every game module extends `BaseModule`:

```php
abstract class BaseModule
{
    abstract public function getSessionManager(): BaseModuleSessionManager;
    abstract public function getListeners(): array;    // list<BaseModuleListener>
    abstract public function getCommands(): array;
    abstract public function getPermissions(): array;
    abstract public function getItems(): array;        // list<BaseModuleItem>
    abstract protected function initializeProcess(): bool;
    abstract protected function launchProcess(): bool;
    abstract protected function shutdownProcess(): bool;
}
```

Lifecycle: `initialize()` → `launch()` → players join → players leave → `shutdown()`

---

## Session Hierarchy

```
ServerSession                    ← one per online player; always exists while online
└── BaseModuleSession            ← created when player joins a module; destroyed on leave
    ├── LobbySession
    └── PracticeSession
        └── PracticeSessionData  ← mutable match state (ELO, stats, kit selections)
```

---

## Adding a New Module

1. Create `src/sulfur/<module>/` directory
2. Create `<Module>Initializer` in `<module>/lifecycle/`
3. Create `<Module>Module extends BaseModule`
4. Create `<Module>Session extends BaseModuleSession`
5. Create `<Module>SessionManager extends BaseModuleSessionManager`
6. Register the module in `core/lifecycle/ServerInitializer` via `ModuleManager`
