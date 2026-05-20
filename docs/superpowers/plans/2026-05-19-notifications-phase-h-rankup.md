# Notifications Phase H — RankUp Producer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Wire the 9th and final notification producer — `RankUp` — into `IUserService.IncrementCounterAsync` so users get notified when crossing rank thresholds.

**Architecture:** Inject `INotificationProducer? producer` and `IAppConfigService? appConfig` as nullable optional ctor params on `AzureUserService` + `MockUserService`. Inside `IncrementCounterAsync`, compute old rank from current entity, perform the counter increment, recompute new rank, and fire `RankUp` if the new effective level is strictly higher. `RankCalculator.Compute` already handles `RankOverride` short-circuit (override → same value before & after → no fire).

**Tech Stack:** .NET 10, xUnit + Moq.

---

## Cross-cutting context

- `INotificationProducer.ProduceAsync(recipientUserId, NotificationType, actorId?, payloadJson, sourceEventId?, presenceGroup?)` — Phase A scaffolded.
- `NotificationType.RankUp` already in enum.
- Renderers consume payload `{ newRank: "activeMember" }` only — but include both `previousRank` + `newRank` in payload for forward-compat with future renderers and debugging.
- `RankCalculator.Compute(UserEntity user, RankThresholds t)` returns `UserRank` enum. Short-circuits on `user.RankOverride`.
- **Rank level comparison via `EffectiveLevel.Parse(string)`** — converts rank name to integer level. Only fire if new level > old level (don't fire on `delta=-1` decrement crossing a threshold downward — e.g., `UnregisterFromEvent`).
- `sourceEventId = $"rank-up-{userId}-{newRank}"` for dedup (60s producer window prevents double-fire on the same transition).
- `actorId = null` (system-generated; no actor).
- Producer call wrapped in try/catch — counter increment must not fail if producer fails.

---

## File Structure

**Backend modified:**
- `Lovecraft.Backend/Services/Azure/AzureUserService.cs` — ctor extension + producer call after `IncrementCounterAsync` write
- `Lovecraft.Backend/Services/MockUserService.cs` — same pattern
- `Lovecraft.Backend/Program.cs` — verify DI still resolves (likely zero changes, since `INotificationProducer` and `IAppConfigService` are already registered)

**Backend new tests:**
- `Lovecraft.UnitTests/UserServiceRankUpTests.cs` — 6 tests covering rank-change, no-change, override, null-producer, decrement, and rank lookup

**Docs modified:**
- `Lovecraft/docs/NOTIFICATIONS.md` — Phase H scope section
- `aloevera-harmony-meet/docs/ISSUES.md` — MCF.4 to "all phases shipped"
- `aloevera-harmony-meet/AGENTS.md` — RankUp wiring note
- `aloevera-harmony-meet/docs/superpowers/specs/2026-05-17-notifications-design.md` — Phase H note

---

## Task 1: RankUp producer wired into IncrementCounterAsync

**Files:**
- Modify: `Lovecraft.Backend/Services/Azure/AzureUserService.cs`
- Modify: `Lovecraft.Backend/Services/MockUserService.cs`
- Test: `Lovecraft.UnitTests/UserServiceRankUpTests.cs`

**Steps:**

- [ ] **Step 1: Write failing tests**

```csharp
// Lovecraft.UnitTests/UserServiceRankUpTests.cs
using System.Text.Json;
using Lovecraft.Backend.Services;
using Lovecraft.Backend.Services.Notifications;
using Lovecraft.Common.Enums;
using Moq;
using Xunit;

public class UserServiceRankUpTests
{
    [Fact]
    public async Task IncrementCounterAsync_CountersCrossThreshold_FiresRankUp()
    {
        // User is at Novice; ActiveReplies threshold is 5; incrementing
        // ReplyCount from 4 → 5 should fire RankUp(novice → activeMember).
        var producer = new Mock<INotificationProducer>();
        var svc = BuildMockServiceWith(producer);
        await SeedUserWithReplyCount(svc, userId: "u1", count: 4);

        await svc.IncrementCounterAsync("u1", UserCounter.ReplyCount, delta: 1);

        producer.Verify(p => p.ProduceAsync(
            "u1",
            NotificationType.RankUp,
            null,
            It.Is<string>(s => s.Contains("activeMember")),
            It.Is<string?>(s => s == "rank-up-u1-activeMember"),
            null), Times.Once);
    }

    [Fact]
    public async Task IncrementCounterAsync_NoRankChange_DoesNotFire()
    {
        var producer = new Mock<INotificationProducer>();
        var svc = BuildMockServiceWith(producer);
        await SeedUserWithReplyCount(svc, userId: "u1", count: 1);

        await svc.IncrementCounterAsync("u1", UserCounter.ReplyCount, delta: 1);

        producer.Verify(p => p.ProduceAsync(
            It.IsAny<string>(), It.IsAny<NotificationType>(),
            It.IsAny<string?>(), It.IsAny<string>(),
            It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    [Fact]
    public async Task IncrementCounterAsync_RankOverrideSet_DoesNotFire()
    {
        // RankOverride short-circuits RankCalculator → before & after equal → no fire.
        var producer = new Mock<INotificationProducer>();
        var svc = BuildMockServiceWith(producer);
        await SeedUserWithReplyCount(svc, userId: "u1", count: 4);
        await svc.SetRankOverrideAsync("u1", "aloeCrew");

        await svc.IncrementCounterAsync("u1", UserCounter.ReplyCount, delta: 1);

        producer.Verify(p => p.ProduceAsync(
            It.IsAny<string>(), It.IsAny<NotificationType>(),
            It.IsAny<string?>(), It.IsAny<string>(),
            It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    [Fact]
    public async Task IncrementCounterAsync_NegativeDelta_RankDrop_DoesNotFire()
    {
        // User at ActiveMember (5 replies); decrementing to 4 drops to Novice.
        // RankUp must NOT fire on rank-down transitions.
        var producer = new Mock<INotificationProducer>();
        var svc = BuildMockServiceWith(producer);
        await SeedUserWithReplyCount(svc, userId: "u1", count: 5);

        await svc.IncrementCounterAsync("u1", UserCounter.ReplyCount, delta: -1);

        producer.Verify(p => p.ProduceAsync(
            It.IsAny<string>(), It.IsAny<NotificationType>(),
            It.IsAny<string?>(), It.IsAny<string>(),
            It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    [Fact]
    public async Task IncrementCounterAsync_NullProducer_DoesNotThrow()
    {
        var svc = BuildMockServiceWithoutProducer();
        await SeedUserWithReplyCount(svc, userId: "u1", count: 4);
        await svc.IncrementCounterAsync("u1", UserCounter.ReplyCount, delta: 1);
        // No assertion on producer — just shouldn't throw.
    }

    [Fact]
    public async Task IncrementCounterAsync_PayloadIncludesPreviousAndNewRank()
    {
        var producer = new Mock<INotificationProducer>();
        string? capturedPayload = null;
        producer.Setup(p => p.ProduceAsync(
                It.IsAny<string>(), It.IsAny<NotificationType>(),
                It.IsAny<string?>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string?>()))
            .Callback<string, NotificationType, string?, string, string?, string?>(
                (_, _, _, payload, _, _) => capturedPayload = payload)
            .ReturnsAsync((Lovecraft.Common.DTOs.Notifications.NotificationDto?)null);

        var svc = BuildMockServiceWith(producer);
        await SeedUserWithReplyCount(svc, userId: "u1", count: 4);

        await svc.IncrementCounterAsync("u1", UserCounter.ReplyCount, delta: 1);

        Assert.NotNull(capturedPayload);
        var doc = JsonDocument.Parse(capturedPayload!);
        Assert.Equal("novice", doc.RootElement.GetProperty("previousRank").GetString());
        Assert.Equal("activeMember", doc.RootElement.GetProperty("newRank").GetString());
    }

    // Adapt these helpers to the actual MockUserService constructor + seeding pattern.
    private static MockUserService BuildMockServiceWith(Mock<INotificationProducer> producer)
        => new MockUserService(/* existing required deps */, producer: producer.Object);

    private static MockUserService BuildMockServiceWithoutProducer()
        => new MockUserService(/* existing required deps */);

    private static async Task SeedUserWithReplyCount(MockUserService svc, string userId, int count)
    {
        // Use existing test helpers or direct MockDataStore manipulation
        // to put the user into the desired starting state.
    }
}
```

- [ ] **Step 2: Run tests, verify fail**

```powershell
Set-Location 'D:\src\lovecraft\Lovecraft'
dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj --nologo --filter "FullyQualifiedName~UserServiceRankUpTests"
```

- [ ] **Step 3: Modify `AzureUserService`**

Add private fields + extend ctor with nullable optional params:

```csharp
private readonly INotificationProducer? _producer;
private readonly IAppConfigService? _appConfig;

public AzureUserService(
    /* existing required params */,
    INotificationProducer? producer = null,
    IAppConfigService? appConfig = null)
{
    /* existing assignments */
    _producer = producer;
    _appConfig = appConfig;
}
```

In `IncrementCounterAsync`, after the ETag-retry write succeeds (around the existing `_cache.Set` line), add:

```csharp
if (_producer is not null && _appConfig is not null)
{
    try
    {
        // entity = the version just written (with incremented counter).
        // oldEntity = a shallow snapshot of the pre-write state for comparison.
        var cfg = await _appConfig.GetConfigAsync();
        var oldRank = RankCalculator.Compute(oldEntity, cfg.Ranks);
        var newRank = RankCalculator.Compute(entity, cfg.Ranks);

        if (!string.Equals(oldRank.ToString(), newRank.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            var oldLevel = EffectiveLevel.Parse(LowerFirst(oldRank.ToString()));
            var newLevel = EffectiveLevel.Parse(LowerFirst(newRank.ToString()));
            if (newLevel > oldLevel)
            {
                var payload = System.Text.Json.JsonSerializer.Serialize(new
                {
                    previousRank = LowerFirst(oldRank.ToString()),
                    newRank = LowerFirst(newRank.ToString()),
                });
                await _producer.ProduceAsync(
                    userId,
                    NotificationType.RankUp,
                    actorId: null,
                    payloadJson: payload,
                    sourceEventId: $"rank-up-{userId}-{LowerFirst(newRank.ToString())}",
                    presenceGroup: null);
            }
        }
    }
    catch (Exception ex)
    {
        _logger?.LogWarning(ex, "RankUp producer failed for {UserId}", userId);
    }
}
```

Key implementation note: the method must take a shallow snapshot of the entity's relevant counter fields BEFORE incrementing. Easiest approach — clone the entity, then mutate the clone, then write. OR: capture (replyCount, likesReceived, eventsAttended, matchCount) into local variables before the switch statement, mutate the entity, then construct an `oldEntity` view from the saved variables.

Cleanest: after fetching `entity`, do:
```csharp
var preReply = entity.ReplyCount;
var preLikes = entity.LikesReceived;
var preEvents = entity.EventsAttended;
var preMatches = entity.MatchCount;
var preOverride = entity.RankOverride;
// ... existing increment switch ...
// after successful write, build a synthetic oldEntity:
var oldEntity = new UserEntity
{
    ReplyCount = preReply,
    LikesReceived = preLikes,
    EventsAttended = preEvents,
    MatchCount = preMatches,
    RankOverride = preOverride,
};
```

(Only the four counter fields + RankOverride matter to `RankCalculator.Compute`.)

Add `private static string LowerFirst(string s) => string.IsNullOrEmpty(s) ? s : char.ToLowerInvariant(s[0]) + s.Substring(1);` if not already present.

- [ ] **Step 4: Mirror in `MockUserService`**

Same pattern. The mock impl stores activity in `MockDataStore.UserActivity` plus the entity counter fields. Compute oldRank from current state before the increment, perform the increment, compute newRank from new state, fire producer.

For mock, you can construct the synthetic `UserEntity` for `RankCalculator.Compute` the same way as Azure.

- [ ] **Step 5: Verify DI**

Read `Program.cs` to confirm `AddSingleton<IUserService, AzureUserService>()` (or whatever it is) still compiles — DI fills the new optional nullable params automatically since `INotificationProducer` and `IAppConfigService` are both already registered.

If the services are constructed with explicit `new ...` (factory form) in `Program.cs`, update the factory to pass the producer + appConfig.

- [ ] **Step 6: Run tests, verify pass**

```powershell
dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj --nologo --filter "FullyQualifiedName~UserServiceRankUpTests"
```
Then full suite — expect 482 baseline + new tests, no regressions.

- [ ] **Step 7: Commit**

```bash
git -C 'D:\src\lovecraft' add Lovecraft/Lovecraft.Backend/Services/Azure/AzureUserService.cs Lovecraft/Lovecraft.Backend/Services/MockUserService.cs Lovecraft/Lovecraft.Backend/Program.cs Lovecraft/Lovecraft.UnitTests/UserServiceRankUpTests.cs

git -C 'D:\src\lovecraft' commit -m "feat: RankUp producer on IncrementCounterAsync (final notifications phase)"
```

---

## Task 2: Documentation + memory updates

- Backend `Lovecraft/docs/NOTIFICATIONS.md` — append Phase H section
- Frontend `docs/ISSUES.md` — MCF.4 marked fully resolved (all 8 phases shipped)
- Frontend `AGENTS.md` — RankUp wiring note
- Frontend spec note (Phase H update line)
- Update memory: MEMORY.md + project_notifications_phasing.md

- [ ] **Step 1: Update backend NOTIFICATIONS.md**

Append:

```markdown
## Phase H scope (shipped 2026-05-19) — Final phase

**RankUp producer wired.** Resolves spec phase H + closes MCF.4 entirely (all 9 producers now active).

- `AzureUserService.IncrementCounterAsync` + `MockUserService.IncrementCounterAsync` extended with nullable optional `INotificationProducer?` + `IAppConfigService?` ctor params.
- Before the counter increment, snapshot the four counter fields + `RankOverride`. Apply the increment. Compute old rank from snapshot, new rank from updated entity, both via `RankCalculator.Compute(entity, cfg.Ranks)` (which short-circuits on `RankOverride`).
- Fire `RankUp` producer only when new effective level > old effective level (via `EffectiveLevel.Parse(rankName)`). This means:
  - Admin-overridden ranks never fire (both calculations return the same override value).
  - Decrements that cross a threshold downward (e.g., `UnregisterFromEvent` calls `IncrementCounterAsync(...,-1)`) don't fire — only upward transitions trigger.
- Payload: `{ previousRank: "novice", newRank: "activeMember" }` (camelCase rank names). Note: renderers (Web Push, Telegram, Email) currently consume only `newRank` — `previousRank` is included for forward-compatibility.
- `sourceEventId = "rank-up-{userId}-{newRank}"` for the 60-second producer dedup window. Same user reaching the same rank won't fire twice within a minute.
- Producer call wrapped in try/catch; counter increment never fails if producer fails.
```

- [ ] **Step 2: Update frontend ISSUES.md**

Replace the MCF.4 entry's "Pending" + "Resolution" lines to mark fully shipped. Update the Changelog with a May-19-2026 entry.

- [ ] **Step 3: Update AGENTS.md**

Add a brief paragraph under the Notifications section noting Phase H closes the loop: all 9 producers wired; rank-up transitions auto-notify.

- [ ] **Step 4: Update spec note**

Append to the design spec:

```markdown
> **Phase H update (2026-05-19):** shipped. `RankUp` producer fires only on strict level-increase to avoid spurious notifications on decrements (`UnregisterFromEvent` etc). Renderers currently use only `newRank`; payload also carries `previousRank` for future use.
```

- [ ] **Step 5: Commit both repos**

Backend:
```bash
git -C 'D:\src\lovecraft' add Lovecraft/docs/NOTIFICATIONS.md
git -C 'D:\src\lovecraft' commit -m "docs: notifications phase H (RankUp producer — final phase)"
```

Frontend:
```bash
git -C 'D:\src\aloevera-harmony-meet' add docs/ISSUES.md AGENTS.md docs/superpowers/specs/2026-05-17-notifications-design.md docs/superpowers/plans/2026-05-19-notifications-phase-h-rankup.md
git -C 'D:\src\aloevera-harmony-meet' commit -m "docs: notifications phase H plan + final-phase docs"
```

---

## Task 3: Final verification + merge + push + memory

- [ ] **Step 1: Run both test suites**

```powershell
Set-Location 'D:\src\lovecraft\Lovecraft'; dotnet test Lovecraft.UnitTests/Lovecraft.UnitTests.csproj --nologo

Set-Location 'D:\src\aloevera-harmony-meet'; npm test -- --run
```

Backend: 482 + ≈6 new ≈ 488 PASS. Frontend: 238 PASS (no changes).

- [ ] **Step 2: Merge to main on both repos**

Standard pattern (Phases A–G): `git checkout main && git merge --no-ff feat/notifications-phase-h -m "..."` with descriptive multi-line commit message.

- [ ] **Step 3: Push origin/main, delete local branches**

- [ ] **Step 4: Update memory**

- `MEMORY.md` — bullet about Notifications phases A–H complete, MCF.4 resolved
- `project_notifications_phasing.md` — Phase H shipped section + note that the notifications subsystem is now feature-complete

---

## Self-Review

- **Spec coverage:** Phase H = RankUp producer wired into IncrementCounterAsync. Task 1 covers it. Suppression via `RankOverride` is handled implicitly by `RankCalculator.Compute`. Decrement (rank-down) suppression added beyond spec — common sense based on `UnregisterFromEvent` calling `IncrementCounterAsync(...,-1)`.
- **Type consistency:** `UserRank` enum values lowercased to camelCase via `LowerFirst` helper to match rank string conventions used elsewhere (`activeMember`, `friendOfAloe`, `aloeCrew`).
- **Payload schema:** `{ previousRank, newRank }` — both included even though renderers only read `newRank`. Documented.
- **Backward compat:** Nullable optional ctor params keep existing tests + DI compiling.
- **No placeholders.** Test helpers `BuildMockServiceWith*` are clearly stubs — adapt to the actual `MockUserService` constructor when implementing.

---

## Execution Handoff

Subagent-driven execution. Single implementer subagent dispatches for Tasks 1 + 2 (small enough to combine); Task 3 (merge/push/memory) handled by main session.
