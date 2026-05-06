# GitHub Copilot Instructions

## Project Context — SulfurNetwork

**SulfurNetwork** is a PocketMine-MP 5.x plugin (Minecraft Bedrock Edition server) written in PHP 8.2+.
It powers a competitive practice server featuring a lobby, 1v1 duel system, and party modes.

For architecture and API details specific to this project, see:
- `.github/skills/pmmp/architecture/SKILL.md`
- `.github/skills/pmmp/api/SKILL.md`

> **All final responses and explanations to the user MUST be in Japanese.**
> Internal reasoning, code, and agent prompts are written in English.

---

## Mandatory Workflow

Every task follows this pipeline in order. No stage may be skipped.

<workflow>

```
1. Task Recognition   → Confirm exact requirements with the user
2. Problem Framing    → Identify risks, edge cases, constraints
3. Planning Loop      → Plan → Design → Re-raise problems → repeat until zero unresolved issues
4. Implementation     → Write code directly into files (never only in chat)
5. Review Loop        → Review → if problems found → rewrite → repeat (no iteration limit)
6. Change Summary     → Report intent, changed/added/deleted files and code to the user
```

The **orchestrator agent** drives this pipeline. Sub-agents stay within their role.

</workflow>

---

## Skill Reference Guide

Always load the relevant skill document before acting on any task.

<workflow>

### Detect Language First

| Language / Framework   | Load skills from                  |
|------------------------|-----------------------------------|
| PHP (general)          | `php/architecture`, `php/coding-standards` |
| PHP + PocketMine-MP    | `php/coding-standards`, `pmmp/architecture`, `pmmp/coding-standards`, `pmmp/api` |
| Java                   | `java/architecture`, `java/coding-standards` |
| Language-agnostic      | `general/architecture`, `general/coding-standards` |

### Full Skill Index

See `.github/skills/SKILL.md` for the complete index.

</workflow>

---

## Universal Coding Standards (All Languages)

These rules apply regardless of language. Language-specific rules are additive.

<rules>

### Comments — Minimalism First

Code must be written to be self-documenting. Comments are **prohibited by default** except in these specific cases:

**Permitted:**
1. Type-annotation doc comments where the type system cannot express it
   ```php
   /** @var array<string, int> $counts */
   ```
2. A single-line explanation of **why** something non-obvious is done (not what)
   ```php
   // Delay by 1 tick: teleport during PlayerJoinEvent causes client desync
   ```
3. Interface/class-level doc blocks if the project convention requires them

**Prohibited:**
- Comments explaining what the code does (the code explains itself)
- Commented-out code (use version control instead)
- `TODO` / `FIXME` left in committed code (create an issue instead)
- Redundant comments (`// increment counter` above `$counter++`)

### Implementation Belongs in Files

Code changes must be applied directly to files on disk.
Showing code only in chat without writing it is not an implementation.

### External API References

When using any external API (PocketMine-MP, Java standard library, etc.):
- **Always verify** signatures against the actual source, stubs, or official documentation.
- If the API member cannot be located in the codebase or stubs, **explicitly state it is not found** before taking any alternative action. Never guess or fabricate an API.

</rules>

---

## Change Summary Format

At the end of every completed task, output in Japanese:

<format>

```
## 今回の変更サマリー

### 変更の意図
<何を解決/追加したか、なぜその設計にしたか>

### 変更・追加・削除したファイルとコード
| 操作 | ファイル | 変更内容の概要 |
|------|----------|----------------|
| 追加 | src/...  | ...            |
| 変更 | src/...  | ...            |
| 削除 | src/...  | ...            |
```

</format>
