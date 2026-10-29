PS: This document contains AI-generated parts

# Sonar Diver

Sonar Diver is a browser-based, top-down underwater stealth game. The player dives from the surface into a procedurally generated basin, uses reflected sonar to navigate through darkness, finds a randomized access key, and reaches the rescue beacon while avoiding a giant squid and a tracking shark.


## 1. Installation and Running on Another Machine
- A modern desktop web browser with HTML Canvas, Web Audio, and `CanvasRenderingContext2D.roundRect` support. Current versions of Chrome, Edge, Firefox, or Safari are recommended.
- A keyboard.
- No package manager, build step, account, or internet connection is required.

1. Copy or clone the entire repository onto the machine.
2. Keep `index.html`, `style.css`, and `game.js` in the same folder.
3. Open `index.html` in a browser.
4. Click the page or press any key once to allow the browser to start audio.

The game can run directly from the local file. If a browser blocks local scripts, run a basic local server from the repository folder and visit the URL it prints. For example, on a machine with Python 3:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.


## 2. Player Instructions

Use WASD or arrow keys to move around
Use SPACE to emit sonar to detect around
Use M to mute or restore Music(Currently the music has some problems, I think you can add certain playlist from Spotify)
Use R to restart the game

1. Dive below the surface. At 10 meters, animated fog begins hiding most of the environment.
2. Use sonar to reveal reefs, monsters, and nearby objects. Sonar rays bounce from walls, but each activation alerts the giant squid to the emission position.
3. Follow the temporary yellow arrow to search for the access key. The arrow contains 8–22 degrees of intentional error and never shows distance.
4. Collect the yellow key. The locked yellow rescue beacon then turns green.
5. Reach the green beacon without touching either monster.

### Monsters

- **Giant squid:** Every sonar pulse alerts it, regardless of distance. It travels to the emission point and searches within 4 tiles for about 7 seconds. A newer sonar pulse replaces its target.
- **Shark:** It continuously updates a path toward the submarine. It moves more slowly than the player but does not require sonar to begin chasing.

Touching either monster immediately ends the run. Reaching the beacon without the key displays `ACCESS KEY REQUIRED`. After a win or loss, press R to generate a new map and restart.


## 3. Acceptance Criteria Status


| # | Criterion | Status | Evidence / Remaining Work |
| --- | --- | --- | --- |
| 1 | Movement and Collision | **Met** | Smooth keyboard movement and collision are handled by `updatePlayer`, `isWallAt`, and `canStandAt`. |
| 2 | Random Map | **Met** | Each run generates a connected 52-by-48 basin, rolling seafloor, up to 23 reefs, and a reachable randomized beacon. |
| 3 | Surface and Darkness | **Met** | The water surface, depth-based fog starting at 10 meters, and approximately 1.5-tile local visibility are implemented. |
| 4 | Sonar Activation | **Met** | Space emits 72 sonar rays with an 8-tile maximum travel distance over about 0.8 seconds. |
| 5 | Sonar Reflection | **Met** | Rays reflect from collision tiles and stop after at most three bounces. |
| 6 | Reveal and Cooldown | **Met** | Reveals and sonar cooldown both use 1.5-second timers. |
| 7 | Giant Squid | **Met** | The squid investigates every sonar source and searches nearby positions for about 7 seconds. |
| 8 | Shark | **Met** | The shark continuously pathfinds toward the player every 0.65 seconds at a lower speed. |
| 9 | Random Key | **Met** | A key is placed at a random valid open-water location each run and is collected on contact. |
| 10 | Key Direction Hint | **Met** | Sonar displays a temporary yellow arrow with 8–22 degrees of error and no distance value. |
| 11 | Locked Exit | **Met** | The beacon rejects the player without the key and changes from yellow to green after collection. |
| 12 | Failure Condition | **Met** | Contact with either monster freezes gameplay and shows `GAME OVER`. |
| 13 | Victory Condition | **Met** | Contact with the unlocked beacon freezes gameplay and shows `ESCAPE SUCCESSFUL`. |
| 14 | Reset Function | **Met** | R generates a new map and resets the player, monsters, key, exit, sonar, fog, and result state. |
| 15 | Audio | **Met** | Procedural urgent music starts after user interaction; M toggles mute. |


| 16 | Online Co-op | **Not met** | There is no networking, lobby, server, or synchronized game state. |
| 17 | Cooperative Escape | **Not met** | The current game supports one player only. Shared key and two-player escape rules are not implemented. |
| 18 | Expanded Monster Roster | **Not met** | Giant squid and shark exist. Anglerfish, electric eel, and difficulty-based mixed spawning are not implemented. |
| 19 | Appearance Customization | **Not met** | Hull colors, patterns, decorations, and a customization interface are not implemented. |
| 20 | Abilities | **Not met** | Speed Boost, Short Blink, Emergency Shield, selection UI, and cooldown UI are not implemented. |
| 21 | Difficulty Progression | **Not met** | Tutorial, Explorer, Deep Dive, Abyss, unlocks, and saved progression are not implemented. |


## 4. Code Map

### Files

| File | Responsibility | Modify This File When... |
| --- | --- | --- |
| `index.html` | Page structure, canvas element, title, and visible control summary | Adding menus, customization UI, lobby UI, or new on-page instructions |
| `style.css` | Responsive page layout and styling outside the canvas | Changing page size, typography, surrounding interface, or mobile layout |
| `game.js` | Game state, generation, controls, AI, audio, rendering, collisions, and the main loop | Changing any current gameplay behavior |
| `spec.md` | Full intended behavior, acceptance criteria, and priorities | Changing the designed rules or final product scope |
| `README.md` | Setup, player instructions, implementation status, and developer handoff | Changing how the project runs or what is currently implemented |

### Major Areas in `game.js`

| Area / Functions | Responsibility |
| --- | --- |
| Constants at the top of the file | Map size, viewport, player speed, sonar timing, monster sizes and speeds |
| `generateSeafloor`, `generateMap`, `randomOpenTile` | Procedural seafloor, reef layout, exit placement, and valid random entity positions |
| `playUrgentBeat`, `startMusic`, `toggleMusic` | Procedural background music and mute state |
| `updatePlayer`, `updateCamera`, `isWallAt`, `canStandAt` | Movement, camera tracking, and world collision |
| `placeKeyRandomly`, `drawKey`, `drawKeyGuidance` | Key placement, key rendering, collection guidance, and approximate direction arrow |
| `createSonarRays`, `triggerSonar`, `updateSonar`, `drawSonarWaves` | Sonar creation, wall reflection, reveal timing, and visible wave trails |
| `findPath` | Shared grid-based breadth-first pathfinding used by both monsters |
| `sendMonsterTo`, `chooseSearchDestination`, `updateMonster` | Giant squid response to sonar and local search behavior |
| `updateHunter`, `drawHunter` | Slow shark pursuit and rendering |
| `checkGameOutcome`, `resetGame` | Key collection, locked exit, victory, defeat, and complete run reset |
| `drawWater` through `drawVignette` | Water, surface, rocks, fog, particles, entities, HUD, and result rendering |
| `gameLoop` | Frame timing and the update/render order; start here when tracing whole-game behavior |

There are currently no classes. State is stored in module-level objects such as `player`, `monster`, `hunter`, and `keyItem`.


## 5. Next Steps in Priority Order

1. **Split `game.js` into modules before adding major systems.** Separate map generation, entities, sonar, rendering, audio, and game state so networking does not have to synchronize one monolithic file.
2. **Add deterministic map seeds and runtime validation.** A seed is necessary for two online clients to generate the same map and for developers to reproduce failures.
3. **Build the two-player networking foundation.** Define the server-authoritative state, room joining, player identity, synchronized movement, sonar events, monsters, key collection, and result state.
4. **Implement cooperative escape rules.** Add a second player, shared key state, two-player beacon completion, disconnect handling, and team failure behavior.
5. **Add ability architecture and UI.** Implement one reusable ability interface, then Speed Boost, Short Blink, and Emergency Shield with server-validated cooldowns.
6. **Add difficulty configuration.** Move map density, monster count, reveal time, hint availability, and cooldown values into difficulty presets.
7. **Add anglerfish and electric eel AI.** Reuse the pathfinding and entity interfaces after the monster system has been separated from global state.
8. **Add appearance customization.** Synchronize hull color, pattern, and decoration after multiplayer entity rendering is stable.
9. **Polish animation and audio.** Replace placeholder Canvas shapes and procedural tones with authored or licensed assets only after the complete game loop is reliable.


## 6. Known Bugs, Limitations, and Traps

- **Browser compatibility:** The renderer uses `roundRect` and Web Audio. Older browsers may fail or lose visual/audio features.
- **Audio autoplay:** Music cannot begin until the player clicks or presses a key because browsers block automatic audio. This is expected behavior.
- **Fixed internal canvas resolution:** CSS scales the 1120-by-680 canvas to fit the page, but the internal resolution does not change when the window changes size. Very small windows shrink the game and make details harder to see.
- **Keyboard only:** There are no touch, controller, or remappable controls.
- **Non-reproducible maps:** Generation uses `Math.random` and does not expose a seed. A broken or unusually difficult layout cannot currently be recreated from a run ID.
- **No runtime connectivity retry:** Reef spacing makes connected maps likely and batch simulation has passed, but the browser does not run a final flood-fill validation and regenerate if a disconnected map is produced.
- **Approximate sonar physics:** Reflection uses small collision steps against square grid tiles. At tight corners, several rays may reverse sharply or disappear after reaching the three-bounce limit.
- **AI scaling:** The shark recalculates breadth-first search every 0.65 seconds. This is acceptable for two monsters, but adding many monsters without shared path data may cause frame drops.
- **Global mutable state:** Most systems directly read and change module-level objects. Functions may look reusable but often depend on globals such as `level`, `camera`, `gameState`, and the canvas contexts.
- **No pause state:** Switching tabs clears held movement keys, but the game simulation and music continue running.
- **No automated browser tests:** Syntax and map-generation checks have been run manually, but input, audio, animation, AI, and outcome screens do not have automated integration tests.


## 7. Shortcuts and Why They Were Taken

- **Single `game.js` file:** Keeping all code together made the classroom prototype faster to build and hand off, but it should be modularized before networking or additional levels.
- **Canvas-drawn placeholder art:** The submarine, shark, squid, reefs, key, and beacon use geometric Canvas shapes. This avoided an asset pipeline while the gameplay rules were changing.
- **Procedural music:** Web Audio oscillators provide urgency without downloading, licensing, or packaging music. The result is functional but less polished than an authored soundtrack.
- **Simplified sonar:** Sonar uses 72 simulated rays and grid collision instead of physically accurate underwater acoustics. This makes reflections visible while keeping the calculation small enough for the browser.
- **Separated elliptical reefs:** The generator spaces reef formations apart instead of building a fully general maze. This reduces the chance of unreachable regions and leaves room to evade monsters.
- **Simple breadth-first pathfinding:** Both monsters use the same grid BFS rather than navigation meshes or hierarchical pathfinding. It is easy to understand and sufficient for the current map size and monster count.
- **No saved progression:** Refreshing the page loses all state. Persistence was deferred because the current prototype has only one playable difficulty.
