---
name: pmmp-api
description: PocketMine-MP 5.x verified API reference. Player, Server, World, Event, Command, Scheduler, Form, TextFormat, GameMode. Includes common pitfalls.
---

# PocketMine-MP 5.x API Reference

## Critical Rule

**Never guess PocketMine API signatures.**

Verification order:

1. `stubs/pmmpthread.php` — threading stubs
2. `stubs/sofe_await.php` — await-generator stubs
3. PocketMine-MP source in `vendor/` (if present)

If the class or method **cannot be located** in any of the above: state **"API NOT FOUND: [qualified name]"** explicitly and stop. Do not proceed with an assumed signature.

---

## Core Namespaces

```
pocketmine\
├── player\Player
├── entity\Entity
├── Server
├── event\
│   ├── Event, Cancellable, Listener, EventHandler, EventPriority
│   └── player\  (PlayerJoinEvent, PlayerQuitEvent, ...)
├── command\  (Command, CommandSender, ConsoleCommandSender)
├── world\    (World, Position, GameMode)
├── item\     (Item, VanillaItems)
├── block\    (Block, VanillaBlocks)
├── math\     (Vector3, Vector2)
├── scheduler\ (Task, AsyncTask, TaskScheduler)
└── utils\    (TextFormat)
```

---

## Player API (verified for PM 5.x)

```php
// Identity
$player->getName(): string
$player->getXuid(): string               // Primary key — use this, not getName()
$player->getUniqueId(): \Ramsey\Uuid\UuidInterface

// State
$player->isOnline(): bool
$player->isConnected(): bool
$player->isAlive(): bool

// Position & world
$player->getPosition(): Position
$player->getWorld(): World               // throws if player is not in a world
$player->teleport(Position|Vector3 $pos, ?float $yaw = null, ?float $pitch = null): bool

// Health
$player->getHealth(): float
$player->setHealth(float $amount): void
$player->getMaxHealth(): int
$player->setMaxHealth(int $amount): void

// Inventory
$player->getInventory(): \pocketmine\inventory\PlayerInventory
$player->getArmorInventory(): \pocketmine\inventory\ArmorInventory

// Display
$player->sendMessage(string $message): void
$player->sendTitle(string $title, string $subtitle = "", int $fadeIn = -1, int $stay = -1, int $fadeOut = -1): void
$player->sendActionBarMessage(string $message): void
$player->sendForm(\pocketmine\form\Form $form): void
$player->sendPopup(string $message): void

// Gamemode & flight
$player->getGamemode(): GameMode
$player->setGamemode(GameMode $gm): void
$player->setAllowFlight(bool $value): void
$player->setFlying(bool $value): void

// Effects
$player->getEffects(): \pocketmine\entity\effect\EffectManager
```

---

## Server API

```php
use pocketmine\Server;

$server = Server::getInstance();

$server->getPlayerByXuid(string $xuid): ?Player       // null if offline
$server->getPlayerExact(string $name): ?Player
$server->getOnlinePlayers(): Player[]

$server->getWorldManager(): \pocketmine\world\WorldManager
$server->getPluginManager()->registerEvents(Listener $listener, Plugin $plugin): void
$server->getScheduler(): \pocketmine\scheduler\TaskScheduler
$server->getLogger(): \pocketmine\utils\Logger
```

---

## World API

```php
use pocketmine\world\World;
use pocketmine\world\Position;
use pocketmine\math\Vector3;

$pos = new Position(float $x, float $y, float $z, World $world);
$vec = new Vector3(float $x, float $y, float $z);

$world->getName(): string
$world->getPlayers(): Player[]
$world->getSafeSpawn(?Vector3 $spawn = null): Position
$world->setSpawnLocation(Vector3 $pos): void
$world->getBlock(Vector3 $pos): Block
$world->setBlock(Vector3 $pos, Block $block, bool $update = true): void

// WorldManager
$server->getWorldManager()->getWorldByName(string $name): ?World
$server->getWorldManager()->loadWorld(string $name): bool
$server->getWorldManager()->unloadWorld(World $world, bool $forceUnload = false): bool
```

---

## Event System

```php
use pocketmine\event\EventPriority;

#[\pocketmine\event\EventHandler]
public function onEvent(SomeEvent $event): void { ... }

#[\pocketmine\event\EventHandler(priority: EventPriority::MONITOR)]
public function onEventMonitor(SomeEvent $event): void { ... }
```

### Common player events (PM 5.x)

| Event Class                 | When it fires                       |
| --------------------------- | ----------------------------------- |
| `PlayerJoinEvent`           | Player fully connected and in world |
| `PlayerQuitEvent`           | Player disconnects                  |
| `PlayerChatEvent`           | Player sends chat                   |
| `PlayerDeathEvent`          | Player health reaches 0             |
| `PlayerRespawnEvent`        | Player respawns                     |
| `PlayerInteractEvent`       | Player interacts with block         |
| `PlayerItemUseEvent`        | Player uses an item                 |
| `PlayerDropItemEvent`       | Player drops item                   |
| `PlayerMoveEvent`           | Player moves (high frequency)       |
| `EntityDamageEvent`         | Any entity takes damage             |
| `EntityDamageByEntityEvent` | Entity damaged by another entity    |

---

## Command API

```php
use pocketmine\command\Command;
use pocketmine\command\CommandSender;
use pocketmine\player\Player;

final class MyCommand extends Command
{
    public function __construct()
    {
        parent::__construct("name", "description", "/usage", ["alias"]);
        $this->setPermission("sulfur.mycommand");
    }

    public function execute(CommandSender $sender, string $commandLabel, array $args): void
    {
        if (!($sender instanceof Player)) {
            $sender->sendMessage("In-game only.");
            return;
        }
        // logic
    }
}
```

---

## Scheduler / Task API

```php
use pocketmine\scheduler\Task;
use sulfur\Sulfur;

final class MyTask extends Task
{
    public function onRun(): void { ... }
}

// 20 ticks = 1 second
$handler = Sulfur::getInstance()->getScheduler()->scheduleRepeatingTask(new MyTask(), 20);
$handler->cancel();

Sulfur::getInstance()->getScheduler()->scheduleDelayedTask(new MyTask(), 40);
```

---

## TextFormat & GameMode

```php
use pocketmine\utils\TextFormat;
use pocketmine\world\GameMode;

TextFormat::RED, TextFormat::GREEN, TextFormat::YELLOW, TextFormat::AQUA
TextFormat::WHITE, TextFormat::GRAY, TextFormat::BOLD, TextFormat::RESET

$player->setGamemode(GameMode::SURVIVAL);
$player->setGamemode(GameMode::CREATIVE);
$player->setGamemode(GameMode::ADVENTURE);
$player->setGamemode(GameMode::SPECTATOR);
```

---

## Common Pitfalls

| Pitfall                                        | Correct Approach                             |
| ---------------------------------------------- | -------------------------------------------- |
| Using player name as DB key                    | Use `getXuid()` — names can change           |
| Assuming `getPlayerByXuid()` non-null in async | Always null-check after async gap            |
| Teleporting during `PlayerJoinEvent`           | Schedule a 1-tick delay                      |
| Registering the same listener twice            | Guard with `isRunning` check in `BaseModule` |
| `getWorld()` on offline player                 | Check `isOnline()` first                     |
| World operations in `AsyncTask::onRun()`       | Main-thread only; use `onCompletion()`       |
| Capturing `$player` in long-lived closure      | Capture `$xuid`, re-fetch the player         |
