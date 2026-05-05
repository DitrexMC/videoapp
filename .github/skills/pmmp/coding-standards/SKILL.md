---
name: pmmp-coding-standards
description: PocketMine-MP 5.x specific coding standards on top of PHP standards. Covers event patterns, libasynql, Await/coroutines, and PMMP-specific rules.
---

# PocketMine-MP Coding Standards

Extends `php/coding-standards/SKILL.md`.
These rules apply specifically to PocketMine-MP plugin code.

---

## 1. API Verification Requirement

**You are a PHP professional working with PocketMine-MP 5.x.**

Before using any PocketMine-MP API:

1. Search for the class in `stubs/` or `vendor/` first.
2. If found: read the actual method signature.
3. If NOT found in the current codebase: **explicitly state "API NOT FOUND: [class::method]"** before taking any alternative action. Never invent a method signature.

The stubs are located at:

- `stubs/pmmpthread.php`
- `stubs/sofe_await.php`

---

## 2. Event Patterns

### Registering listeners

```php
use pocketmine\event\Listener;
use pocketmine\Server;
use sulfur\Sulfur;

final class MyListener implements Listener
{
    #[\pocketmine\event\EventHandler]
    public function onPlayerJoin(PlayerJoinEvent $event): void
    {
        // handle
    }
}

Server::getInstance()->getPluginManager()->registerEvents(
    new MyListener(),
    Sulfur::getInstance()
);
```

### Custom events

```php
use pocketmine\event\Event;
use pocketmine\player\Player;

final class PlayerApplyKitEvent extends Event
{
    public function __construct(
        private readonly Player $player,
        private readonly Kit $kit,
    ) {
    }

    public function getPlayer(): Player
    {
        return $this->player;
    }

    public function getKit(): Kit
    {
        return $this->kit;
    }
}

// Firing
$event = new PlayerApplyKitEvent($player, $kit);
$event->call();
if ($event->isCancelled()) {
    return;
}
```

**Rules:**

- Call `$event->call()` **before** any mutations
- Check `$event->isCancelled()` when the event implements `Cancellable`
- Custom event classes are `final` and placed in the relevant `*/event/` subpackage

---

## 3. libasynql — SQL Access

### Never embed SQL in PHP files

All queries are defined in `.sql` resource files, never as PHP string literals.

```php
// FORBIDDEN
$this->database->executeSelect("SELECT * FROM players WHERE xuid = ?", ...);

// REQUIRED — query name maps to a resource file
$this->database->executeSelect(
    "sulfur.players.get",
    ["xuid" => $xuid],
    function (array $rows) use ($callback): void {
        $callback($rows);
    },
    function (SqlError $error): void {
        ErrorReporter::getInstance()->onError($error);
    }
);
```

### Always handle the error callback

```php
// FORBIDDEN — no error handling
$this->database->executeGeneric("sulfur.foo", []);

// REQUIRED
$this->database->executeGeneric(
    "sulfur.foo",
    ["param" => $value],
    null,
    function (SqlError $error): void {
        ErrorReporter::getInstance()->onError($error);
    }
);
```

### SQL resource file format

```sql
-- #{ sulfur.players.get
--   #& xuid: string
SELECT * FROM players WHERE xuid = :xuid
-- #}
```

---

## 4. Await / Coroutines

When using `SOFe\AwaitGenerator\Await`:

```php
use poggit\libasynql\SqlError;
use SOFe\AwaitGenerator\Await;

Await::f2c(function () use ($xuid): \Generator {
    /** @var array<array<string, mixed>> $rows */
    $rows = yield from Await::promise(
        function (callable $resolve, callable $reject) use ($xuid): void {
            $this->database->executeSelect(
                "sulfur.players.get",
                ["xuid" => $xuid],
                $resolve,
                $reject
            );
        }
    );

    $player = Server::getInstance()->getPlayerByXuid($xuid);
    if ($player === null || !$player->isOnline()) {
        return;
    }

    // safe to act on $player
});
```

**Rules:**

- After every `yield from`: re-fetch the player by XUID and check `isOnline()`.
- Never capture `$player` or other mutable game objects in closures that outlive the current tick.
- Capture primitive keys (`$xuid`, `$name`) and re-fetch the live object after the async gap.

---

## 5. Module Boundary Rules

- Do NOT import `sulfur\practice\*` from any class in `sulfur\lobby\*` (or vice versa).
- Do NOT import `pocketmine\*` in `sulfur\core\` business-logic classes (exceptions: `core/listener/`, `core/command/`, `core/form/`, `core/task/`).
- All new game logic goes in the module directory — not in `core/`.

---

## 6. Player Identity

Always use `$player->getXuid()` as the primary key for players.
Never use `$player->getName()` as a key — player names can be changed.

```php
// FORBIDDEN as primary key
$this->sessions[$player->getName()] = $session;

// REQUIRED
$this->sessions[$player->getXuid()] = $session;
```

---

## 7. World / Teleport Rules

- Teleporting during `PlayerJoinEvent` causes client desync — use a 1-tick scheduled delay.
- `getWorld()` on an offline player throws. Always check `$player->isOnline()` first.
- World operations (block set, entity spawn) are main-thread only. Never do them in `AsyncTask::onRun()`.
