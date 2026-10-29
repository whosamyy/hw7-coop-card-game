1. Game Introduction

Sonar Diver is a top-down 2D stealth-escape game set in a procedurally generated underwater basin. The player begins near the water surface, pilots a small submarine into the deep, finds a hidden access key, and then reaches a locked rescue beacon while avoiding two types of sea monsters.

The environment becomes almost completely dark at a depth of 10 meters. The player can press Space to emit sonar rays that reveal nearby terrain and creatures for a short time. Sonar rays reflect when they strike rock walls, but every sonar activation also alerts the giant squid to the player's emission position. Sonar therefore provides information at the cost of danger.

Use WASD or the arrow keys to move, Space to emit sonar, M to mute or restore the procedural background music, and R to generate a new run after winning or losing.

Game Focus: An intense escape experience centered on memory, navigation, reflected sonar, and manipulating monster movement. The player must balance the need to see with the risk of revealing their position.


2. Full Feature Set

Phase 1

- A procedurally generated 52-by-48 tile underwater map with an uneven seafloor, a randomized rescue beacon, and up to 23 randomized reef formations.
- A 1120-by-680 pixel camera viewport that follows the player through the larger world.
- The player moves smoothly with WASD or the arrow keys at 190 pixels per second and cannot pass through rocks or the seafloor.
- The player begins near a visible water surface. Sunbeams, bubbles, and water colors gradually give way to deep darkness during descent.
- At a depth of 10 meters or more, animated fog covers the map except for an irregular persistent light area of approximately 1.5 tiles around the submarine.
- Pressing Space emits 72 sonar rays from the player's current position. The rays travel up to 8 tiles over 0.8 seconds.
- Sonar rays reflect from rock walls, with a maximum of three bounces per ray.
- Terrain, monsters, and the key reached by sonar remain revealed for 1.5 seconds before fading back into the fog.
- Sonar has a 1.5-second cooldown.
- Procedural background music creates an urgent low-frequency rhythm after the player's first click or keypress. Pressing M mutes or restores it.


Phase 2

- One giant squid starts at a randomized valid location. It moves at 112 pixels per second.
- Every sonar activation alerts the giant squid, regardless of distance. It pathfinds to the coordinates where sonar was emitted.
- After reaching the sound source, the giant squid searches random reachable positions within 4 tiles of that point for approximately 7 seconds. A new sonar pulse immediately replaces its current target.
- One shark starts at a different randomized valid location. It continuously pathfinds toward the submarine, recalculates its route every 0.65 seconds, and moves at 72 pixels per second.
- An access key appears at a random valid location anywhere in the open water. It does not spawn near the start, exit, or monsters.
- Each sonar activation briefly displays a yellow arrow pointing in the approximate direction of the key. The arrow includes a random error of 8–22 degrees and does not reveal distance or exact coordinates.
- The rescue beacon remains locked and yellow until the player collects the key. After collection, it becomes green and can be entered to win.
- Victory: Reaching the rescue beacon while carrying the key freezes gameplay and displays "ESCAPE SUCCESSFUL."
- Defeat: Touching either monster freezes gameplay and displays "GAME OVER."
- Restart: Pressing R after victory or defeat generates a new map and randomizes the seafloor, reefs, exit, key, and both monster positions.

Full Intended Version (Not Yet Implemented in the Current Prototype)

- Online cooperative play supports two players joining the same run from separate browsers. Both players share the same generated map, monsters, key state, sonar events, and game result.
- The team shares one access key. Either player can collect it, but both surviving submarines must reach the rescue beacon to complete the level. If either submarine is destroyed before escape, the team loses unless a survival ability prevents that collision.
- Additional monsters create different movement problems. The intended roster includes the current sound-searching giant squid and slow tracking shark, plus an anglerfish that waits in darkness and charges after being revealed, and an electric eel that patrols narrow passages and briefly disables abilities on contact.
- Multiple monsters may appear in the same level. The exact number is determined by difficulty, starting with one monster in the tutorial and increasing to five or more mixed monsters on expert levels.
- Before a run, each player can customize submarine appearance. Customization includes hull color, one body pattern, and one decorative item such as a light, flag, fin, or propeller trail. Cosmetics do not change gameplay statistics.
- Each player chooses one active ability before a run:
  - Speed Boost: Move at 1.8 times normal speed for 2 seconds, with a 10-second cooldown.
  - Short Blink: Teleport up to 3 open tiles in the facing direction, with a 15-second cooldown. The ability fails without consuming its cooldown if no valid landing position exists.
  - Emergency Shield: Ignore one monster collision during a 2-second shield window, with a 20-second cooldown.
- Cooperative players may choose different abilities, allowing one player to distract monsters while the other searches for the key or exit.
- The game includes four progression levels:
  - Tutorial: A smaller map, one slow monster, longer reveal time, and on-screen instructions.
  - Explorer: The standard map with two monsters and the normal sonar values documented above.
  - Deep Dive: A larger, denser map with three or four monsters, shorter sonar reveal time, and fewer safe open spaces.
  - Abyss: An expert map with five or more mixed monsters, longer ability cooldowns, minimal light, and no key direction arrow.
- Completing a level unlocks the next difficulty. Players may replay unlocked difficulties and choose cosmetic appearance and ability before starting.


3. Acceptance Criteria

1. [Movement and Collision] The player moves smoothly with WASD or the arrow keys and cannot move through reefs, side boundaries, or the seafloor.
2. [Random Map] Each new run contains a 52-by-48 connected map with an uneven seafloor, up to 23 reef formations, and a reachable rescue beacon.
3. [Surface and Darkness] The run begins near a visible water surface. At 10 meters of depth or more, animated fog hides the world except for an irregular local view of approximately 1.5 tiles around the player.
4. [Sonar Activation] Pressing Space emits 72 visible sonar rays from the player's emission position. The rays travel a maximum of 8 tiles over approximately 0.8 seconds.
5. [Sonar Reflection] Sonar rays reflect when they collide with reefs or boundaries, and no individual ray reflects more than three times.
6. [Reveal and Cooldown] Objects reached by sonar remain visible for 1.5 seconds. Sonar cannot be activated more than once every 1.5 seconds.
7. [Giant Squid] Every sonar pulse causes the giant squid to pathfind toward the emission position. On arrival, it searches within 4 tiles for approximately 7 seconds instead of tracking silent player movement.
8. [Shark] The shark continuously follows the player using pathfinding, updates its route approximately every 0.65 seconds, and moves more slowly than both the player and the giant squid.
9. [Random Key] One key appears at a random reachable location and is collected when the submarine touches it.
10. [Key Direction Hint] Activating sonar while the key is missing displays a temporary yellow direction arrow with 8–22 degrees of error and no distance value.
11. [Locked Exit] Touching the rescue beacon without the key does not end the game and displays "ACCESS KEY REQUIRED." Collecting the key changes the beacon from locked yellow to usable green.
12. [Failure Condition] Touching either monster immediately freezes gameplay and displays "GAME OVER."
13. [Victory Condition] Touching the rescue beacon while carrying the key immediately freezes gameplay and displays "ESCAPE SUCCESSFUL."
14. [Reset Function] Pressing R after the game ends starts a new run with a newly generated map, new entity positions, cleared sonar effects, and reset game state.
15. [Audio] Urgent procedural background music starts after the first user interaction, and pressing M toggles mute.
16. [Online Co-op] Two players in separate browsers can join one run and see synchronized player movement, map state, monsters, sonar, key collection, and results.
17. [Cooperative Escape] Either player can collect the shared key, but the team wins only after both surviving submarines reach the rescue beacon. An unprotected player death causes a team loss.
18. [Expanded Monster Roster] The full game includes giant squid, shark, anglerfish, and electric eel behaviors, and higher difficulties can spawn multiple monster types together.
19. [Appearance Customization] Before a run, each player can select a hull color, body pattern, and decorative item. These choices are visible to both players and have no gameplay effect.
20. [Abilities] Each player can select Speed Boost, Short Blink, or Emergency Shield. Each ability follows its documented duration, range, validity rules, and cooldown.
21. [Difficulty Progression] Tutorial, Explorer, Deep Dive, and Abyss provide increasing map complexity and monster pressure. Completing one level unlocks the next difficulty.


4. Priorities & Triage

Highest Priority

- Player movement, camera tracking, wall collision, and a connected procedurally generated map.
- Darkness, animated fog, reflected sonar, 1.5-second reveals, and the 1.5-second cooldown.
- The randomized key, approximate direction hint, locked rescue beacon, and key-based victory condition.
- Giant squid sound investigation, shark pursuit, monster collision defeat, and R-key restart.

Secondary Priority

- Online two-player synchronization and the shared cooperative escape condition.
- Difficulty progression from Tutorial through Abyss.
- Player-selectable Speed Boost, Short Blink, and Emergency Shield abilities.
- Anglerfish and electric eel behaviors, followed by mixed-monster encounters.
- Distinct large squid and shark models with smooth animation.
- Water surface, sunbeams, bubbles, drifting fog, sonar glow, and the depth display.
- Procedural urgent background music and the M-key mute control.
- Cosmetic hull colors, patterns, and decorations after the cooperative game loop is stable.

First to Cut When Time Is Limited

- Additional cosmetic options beyond one hull color, one pattern, and one decoration per player.
- Extra monster variants beyond the four specified types.
- Additional abilities beyond Speed Boost, Short Blink, and Emergency Shield.
- More complex music layers or external sound effects.
- Extra particles, decorative lighting, and additional visual polish.
- Additional objectives, combat, multiple keys, or difficulty levels beyond the four specified tiers.
