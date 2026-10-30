# Sonar Diver

Original game design and foundation: **kewuan-lyk**, the documented commit author of the [original repository](https://github.com/kewuan-lyk/-Jack-Li-.CoopCardGame). Phase 2 continuation: **whosamyy**. The original README does not identify a personal name, and the author's GitHub profile has no display name. This credit uses the verified author identity rather than guessing from a folder name; personal-name credit still needs confirmation before submission.

Sonar Diver is a single-player underwater stealth game. You pilot a submarine through a random basin, find an access key, and escape through the rescue beacon. Sonar helps you navigate the dark, but it also tells the giant squid where you were. A slower shark keeps following you even when you stay quiet. Online co-op is part of the spec, but is not implemented.

This README was updated with Codex assistance and checked against the code. `spec.md` is the original source of truth and was left unchanged.

## Running the game

You need a desktop browser supporting Canvas, `roundRect`, and Web Audio, plus a keyboard. There are no packages to install or build steps.

1. Keep `index.html`, `game.js`, and `style.css` together.
2. Open `index.html` in Chrome or another compatible browser.
3. Choose an ability and click **Start run**. The simulation waits until you start.
4. Click the canvas after starting if the browser keeps keyboard focus on the button. Music requires a user interaction.

If opening the file directly is blocked, run this from the repository folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Python is only needed for this optional server.

## Playing and controls

| Control | Action |
| --- | --- |
| WASD / arrow keys | Move and face that direction |
| Space | Emit sonar; 1.5-second cooldown |
| E | Activate the ability selected before starting |
| M | Mute or restore procedural music |
| R | Start a new random run after victory or defeat |

Dive into the basin and use the temporary yellow arrow from sonar to search for the key. The arrow is deliberately inaccurate and shows no distance. Collecting the key changes the beacon from yellow to green. Touch the green beacon to win. An unprotected collision with either monster loses the run.

At 10 meters, fog hides most of the world except a small local light around the submarine. Sonar rays reflect off terrain and briefly reveal what they reach. The squid investigates the last sonar emission position, then searches nearby for seven seconds. A new pulse redirects it. The shark continuously pathfinds toward you.

### Abilities

Choose one ability before the first run. Press E to activate it; the text above the canvas shows readiness, active state, or cooldown.

| Ability | Effect | Cooldown |
| --- | --- | --- |
| Speed Boost | 1.8 times normal movement speed for 2 seconds; normal terrain collision still applies | 10 seconds |
| Short Blink | Teleport up to 3 tiles in the facing direction, using the furthest valid whole-tile landing along a clear route | 15 seconds on success |
| Emergency Shield | Ignore one monster contact within a 2-second activation window | 20 seconds |

Cooldowns start on activation. Blink tries a shorter landing if needed; if no one-, two-, or three-tile landing along the open route exists, nothing moves and no cooldown is consumed. The spec does not explicitly say whether Blink crosses walls; this version interprets “open tiles” as requiring a clear route.

Shield is consumed by one contact, not two seconds of invulnerability. The existing collision system checks every frame, so staying overlapped can kill you on the next frame. If both monsters touch you together, Shield blocks one contact and the other causes defeat. These are the chosen interpretations of unspecified repeated/simultaneous contact behavior.

After a result, R keeps the chosen ability and resets its timers along with the rest of the run. Reload the page to choose another ability. E cannot activate an ability before starting, during cooldown, or after a result.

## Phase 2 changes

- Fixed the squid's search timer to start on arrival, including long investigations, and limited search destinations to four tiles from the sound source.
- Froze gameplay and the final rendered frame after either result, including sonar and reveal updates. R still works.
- Added pre-run ability selection, E activation, status text, Boost, Blink, and Shield.

The original functions, shared state objects, map generator, rendering, and BFS pathfinding remain in place. Changes extend the inherited architecture rather than replacing it.

## Acceptance criteria report

**Met means implemented based on code inspection and the Node checks described below. It does not mean manually verified in a browser.** The table covers all 21 original criteria. Criteria 12 and 13 are read together with the specified Shield exception.

| # | Requirement | Status | Current result / remaining work |
| --- | --- | --- | --- |
| 1 | Smooth movement and terrain collision | Met | Existing normalized keyboard movement and collision checks remain; Node checks covered normal/boosted movement and terrain. Browser feel still needs checking. |
| 2 | Connected random 52×48 map, uneven floor, up to 23 reefs, reachable beacon | Met | Generator implements these features. All 100 maps sampled in the initial Node audit were connected with reachable key and beacon; generation has no final connectivity validation. |
| 3 | Surface and animated darkness from 10 m, about 1.5 tiles of local light | Met | Surface, depth threshold, fog, and irregular local light are implemented. Visual quality is code-inspected only. |
| 4 | 72 sonar rays, 8-tile travel in about 0.8 seconds | Met | Ray count and controlled travel distance/timing passed Node checks. Visible rendering needs Chrome verification. |
| 5 | Sonar reflection with at most three continued bounces | Met | Collision logic reflects rays and stops them at the next collision after three bounces. Corner behavior remains visually unverified. |
| 6 | 1.5-second reveals and sonar cooldown | Met | Reveal timers/fading are implemented; cooldown passed Node checks. Visual fading still needs checking. |
| 7 | Squid investigates sonar, then searches within 4 tiles for about 7 seconds | Met | Arrival starts the search window; new sonar replaces the target. Near/far travel, interruptions, timing, and destination bounds passed Node checks. |
| 8 | Slower shark pursues with roughly 0.65-second route updates | Met | BFS pursuit and speed 72 versus squid 112 and player 190 remain. Route timer checked in Node; an empty path triggers earlier recalculation. |
| 9 | Random reachable key collected on contact | Met | Sampled maps had reachable keys; collection passed Node checks. |
| 10 | Temporary yellow key arrow, 8–22° error, no distance | Met | Direction/error calculation and temporary rendering are implemented. Appearance is not browser-verified. |
| 11 | Locked beacon message; key unlocks yellow beacon to green | Met | Locked rejection and key collection passed Node checks; message and color branches were inspected. |
| 12 | Monster collision freezes gameplay and shows GAME OVER | Met | Both monsters cause defeat unless Shield blocks the contact. Node checks confirmed result text and unchanged simulation/render calls afterward. |
| 13 | Key plus beacon freezes gameplay and shows ESCAPE SUCCESSFUL | Met | Victory and freeze passed Node checks; unprotected monster contact still takes priority. |
| 14 | R regenerates map/entities and resets gameplay | Met | R handler, fresh maps, cleared sonar/key/results, reset ability timers, and resumed movement passed Node checks. Selection and mute preference persist. |
| 15 | Procedural music after interaction; M toggles mute | Met | Web Audio rhythm, drones, interaction startup, and mute handler exist. Audio has not been heard/tested in Chrome; the inherited README mentioned unspecified music problems. |
| 16 | Online two-player synchronization | Not Met | No networking, rooms, server, or second player. Deferred to keep Phase 2 focused on a complete single-player loop. |
| 17 | Shared key and two-player escape/team-loss rules | Not Met | Single-player outcomes only; depends on #16. |
| 18 | Squid, shark, anglerfish, eel, and mixed higher-difficulty encounters | Partial | Squid and shark exist; anglerfish, eel, and variable mixed spawning are missing. Deferred with difficulty work. |
| 19 | Hull color, pattern, and decoration selection shared between players | Not Met | Fixed submarine appearance; no customization or synchronization. Cosmetics were lower priority than gameplay. |
| 20 | Select Boost, Blink, or Shield with specified effects and cooldowns | Met | All three are selectable and passed Node logic checks, including invalid Blink, Shield consumption, cooldowns, end-state blocking, and reset. Interpretations are documented above; browser verification remains. |
| 21 | Tutorial, Explorer, Deep Dive, Abyss, and sequential unlocks | Not Met | One fixed configuration, no selection, progression, or unlocks. Deferred within the limited Phase 2 scope. |

## Testing and remaining manual checks

During Phase 2, Codex ran JavaScript syntax checks and temporary Node harnesses with stubbed DOM/Canvas APIs. These were one-off commands, not a committed automated test suite. No real Chrome playthrough was completed: browser automation failed to initialize, and the initial local server attempt was blocked by the environment.

The executed Node checks passed for sampled map connectivity, movement/collision, sonar count/travel/cooldown, squid arrival/search and interruption, shark route timing, key and beacon logic, both losses, victory, frozen outcomes, restart, and all three abilities. Some scenarios used controlled maps or moved entities directly in memory. Canvas calls and text were checked with stubs; that does not verify actual pixels, audio, or browser input behavior.

Before submission, manually check in Chrome:

1. Choose each ability on separate page loads and start the game. Check controls, status text, and browser console errors.
2. Move normally and with Boost into reefs, sides, and the seafloor. Check Boost's two-second duration and ten-second cooldown.
3. Blink straight and diagonally, near obstacles and boundaries. Check shortened/failed teleports, no cooldown on failure, and fifteen seconds on success.
4. Test Shield against both monsters, expiry, repeated overlap, and its twenty-second cooldown. It should block only one contact.
5. Dive past 10 m, inspect fog and reflected sonar, and check temporary reveals and the inaccurate yellow arrow.
6. Observe squid redirection and a full seven-second search after a long journey; confirm shark pursuit.
7. Test the locked beacon, key collection, unlocked victory, and both defeats. Trigger sonar near an outcome and confirm the final scene freezes. E must do nothing after a result; R must restore a playable run.
8. Listen for music after interaction, toggle M, and check the layout at a smaller window size. Finish at least one run normally.

## Code structure

| File | Purpose |
| --- | --- |
| `index.html` | Canvas, pre-run ability selector, Start button, status text, and controls |
| `style.css` | Page styling and responsive canvas scaling |
| `game.js` | All game state, generation, movement, abilities, AI, audio, rendering, and frame loop |
| `spec.md` | Unchanged original rules and 21 acceptance criteria |
| `README.md` | Run instructions, implementation report, testing limits, and code map |
| `prompt_log.md` | Inherited AI history and Phase 2 prompts/process |

There are no classes or modules. State lives in top-level objects such as `player`, `monster`, `hunter`, and `keyItem`.

| Functions / state | Responsibility and extension point |
| --- | --- |
| `generateSeafloor`, `generateMap`, `randomOpenTile` | Terrain and random entity placement; extend here for validated generation or difficulty settings |
| `isWallAt`, `canStandAt`, `updatePlayer`, `updateCamera` | Collision, normal/boosted movement, heading, and following camera |
| `abilityDefinitions`, `activateAbility`, `updateAbilityStatus` | Ability values, E effects, status, and selection handler |
| `createSonarRays`, `triggerSonar`, `updateSonar` | Pulse creation, reflection, reveals, cooldown, and squid alerts |
| `findPath` | Shared grid BFS used by both monsters |
| `sendMonsterTo`, `chooseSearchDestination`, `updateMonster` | Squid investigation, arrival-based search, and idle transition |
| `updateHunter` | Shark pursuit |
| `placeKeyRandomly`, `checkGameOutcome`, `resetGame` | Key placement/collection, Shield consumption, beacon, results, and new runs |
| `startMusic`, `playUrgentBeat`, `toggleMusic` | Web Audio startup, rhythm, and mute |
| `draw…` functions, `gameLoop` | Canvas presentation and update/render order; completed outcomes preserve the final frame |

## Known limits and shortcuts

- No online co-op, progression, customization, anglerfish, or eel. Reloading loses state.
- Random generation uses `Math.random`; there is no reproducible seed or final flood-fill/retry. Passing sampled maps is not a guarantee for every run.
- Monster navigation uses tile centers without checking the full monster radius. Large sprites can overlap reef edges, and contact checks do not test for an intervening wall. These need visual investigation.
- Sonar uses stepped grid reflection rather than physical acoustics. Tight corners can produce abrupt direction changes. Frame-time clamping can stretch travel timing under slow/background rendering.
- No pause menu. Losing focus clears movement keys, but a playing run can continue; wall-clock ability timers can expire in the background. Music also continues after results.
- Shield's single-frame protection can be hard to use because continued overlap is lethal. This is documented behavior, not a two-second immunity effect.
- R restarts immediately with the same ability. Changing ability requires reloading.
- Fixed 1120×680 internal resolution is scaled by CSS. Small windows shrink details. Keyboard input, focus, and audio need real browser testing.
- Canvas shapes, procedural tones, shared global state, and simple BFS were kept to preserve the inherited foundation and avoid an asset/build pipeline. There are no persistent automated tests.

## What to do next

First finish the Chrome checks above and address any confirmed problems with the core loop. After that, follow the spec's secondary priorities: online synchronization and cooperative escape, difficulty progression, then anglerfish/eel encounters. Cosmetics and extra visual/audio polish come last. Add connectivity validation and reproducible map data when preparing synchronization. Keep changes small rather than starting with a full rewrite.
