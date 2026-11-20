# The Empty Village — Houses & World Design

This is the development specification for the browser game’s houses, districts, and first-person horror experience. The world is set in an abandoned rural Indian village at roughly **02:43**. Its menace comes from scarcity of light, quiet, and uncertain sights and sounds, not from combat or scripted jumpscares.

## 1. First-person controls

| Input | Action |
| --- | --- |
| Click the play prompt | Focus the game and request Pointer Lock |
| Mouse | Rotate the view freely in yaw and within a safe pitch range |
| WASD / arrows | Move relative to horizontal view direction |
| Hold Shift | Sprint while moving |
| Space | Jump once per press; gravity brings the player back to a valid surface |
| F | Toggle the camera-mounted flashlight |
| Escape | Release the mouse |

Keep drag-to-look as an iframe/browser fallback and retain touch movement. Expose mouse sensitivity in the game options, retain the value locally where browser storage is available, and never require that storage to play. The camera sits at eye height; no avatar mesh obstructs the view. Apply restrained, movement-dependent head sway and a small sprint field-of-view change, with reduced-motion support. Keep collision at a fixed simulation timestep. Stop the body at solid walls and locked doors, allow it through clear apertures, and keep it on floors, steps, and stair runs. The flashlight illuminates what the eyes point at, not what direction movement happens to be going.

## 2. Connected map and residence roster

The village is a single meter-scaled world with continuous terrain. Village roads meet with visible junctions, and narrower tracks branch to farmland, woods, and compounds. Locations may change the HUD label, lighting, and local ambience, but they never teleport the player or require a loading screen. The first view is aimed down the main road; the square is the legible central landmark.

| District | Geography and landmarks | Residences |
| --- | --- | ---: |
| **Village Centre** | Start near the southern approach. Main road, walkable square, shuttered shops, broken lamps, small temple, and the preserved hospital | 15 |
| **The Forest** | West track from the square through dense growth and lower fog. Narrow path, crooked huts, timber structures, and faint distant lights | 6 |
| **Farmland** | East track to fields with alternating crop rows, derelict tractors and irrigation gear. A canal separates the fields, with walkable crossings | 6 |
| **Old Settlement** | North road into tighter alleys, older walls, an abandoned courtyard, and a masonry well | 12 |
| **Abandoned School** | Northeast spur: connected classrooms, office, storage, and a playground | — |
| **The Mansion** | Lane northwest from the old settlement ends at a larger compound | 1 |
| | **Total residences, excluding schools, shops, temple and hospital** | **40** |

Every residence has a stable identifier and an authored footprint, roof form, material palette, and room programme. The roster must include traditional mud, exposed brick, two-storey, concrete, open and enclosed courtyard, partly collapsed, flat-roof, sloping-roof, mansion, isolated farmhouse, and landlord’s houses. Culture and place should read through jali-like openings, verandas, timber shutters, inward courtyards, clay roof and limewash, not through identical buildings or arbitrary decoration. The code may reuse components; silhouettes, plan, access, fenestration and wear should differ. Do not count a repeat of a mesh with a different position or tint as a distinct design.

## 3. Architecture, access, and collisions

- Build solid wall segments around real door and window openings, with thresholds, reveals, jambs and lintels. Ensure visible interior and exterior wall faces, properly oriented UVs, floors, ceilings or visible rafters, and roof construction with overhangs and fascia. Courtyards are intentionally open to the sky; partially ruined roofs retain visibly supported sections.
- Include wooden singles and doubles, damaged board doors, metal gates, ajar doors, and deliberate locked doors in the mansion. Doors turn about their physical hinge edge; the frame, hardware and leaf must line up. Leave a walkable aperture where a door is open. Rock scatter is excluded from entrance approaches and gates.
- Ground-floor plans may be single-room huts, two-room long cottages, three- or four-room houses with corridors, or rooms flanking a court. Larger houses have a genuinely reachable upper floor. The mansion has a ground floor, upper rooms, a reachable storage basement, dining room and more than one locked room. Floors are absent only where a courtyard, stairwell or visible ruin calls for one. Stair collision can use a continuous ramp under the textured treads; the player must not fall through adjacent slabs or jump through a ceiling.
- Frame and furnish each accessible room. Living rooms have seating, tables, an old TV/radio or clock; bedrooms have beds and storage; kitchens have worktops, cookware and jars; storerooms have shelves and crates. Appropriate layouts add a bath, landing or hallway. Put props on floors, shelves, or real anchor points. Doors, furniture, fixed masonry, and stair rails must not cause impassable routes.
- Keep an authored furnishing recipe per room type and deterministic variations per building: cloth, damage, stains, displaced chairs, framed pictures, calendars, mirrors, jute and utensils. Place cobweb strands at room corners, joinery, cabinets, stair landings, and around furniture. The school has desks, benches, chalkboards and storage; temple offerings remain static; farm and forest structures have context-appropriate objects.

## 4. Night lighting and ambience

- Set night skylight and moonlight low enough that dark interiors and distant fog matter, but keep nearby silhouettes and the road readable. Use the first-person flashlight as the most dependable light. Put a limited number of warm sources on buildings and lamp posts. Nearby fixtures can flicker, briefly go out or come back on; avoid constant full-screen flashing. Distant lightning should be uncommon and brief. Respect reduced motion for movement and flashes.
- Use depth and height fog with slow drift in road corridors. Add localized dust indoors, slight branch and curtain movement, and occasional moving leaves. A few windows may reveal a distant shadow crossing behind the glass; these are environmental silhouettes, not creatures or an AI system.
- Stage restrained environmental events: door leaves move on hinges when used, torn cloth moves near a window, broken fan blades or hanging wires move slightly, a clock stops at **3:17**, and a radio gives low static. Wind, isolated footsteps in a room, and a rare distant knock use the sound control and the browser’s user-gesture audio requirement. Do not stage a repeated surprise at every house.

## 5. Materials, provenance, and performance

Bundle legally reusable downloaded image assets under `src/assets/textures/`, with origin and license tracked beside them. Prefer photograph-based Poly Haven or ambientCG material sets. Albedo and sky color are sRGB; normals, roughness, occlusion and height are non-color data. Use the provided channels when available, with meter-scale tiling and UVs appropriate to the model. Use height for surface relief where useful, but not to silently deform the walkable collision floor. Use tiled variation, different plaster/wood/brick families, and appropriately textured hardware, vegetation, glass and fabric. No CSS, Canvas, or procedural material textures; no untextured placeholder surfaces in the final scene.

Keep repeat geometry instanced and static components batched by material and building or sector. Frustum-cull the terrain dressing and distant trees by sector. Use a collision spatial index and separate architectural collision shapes from rendering geometry. Near-only furnishings, dust, and moving objects must stay out of the distant render budget; building shells remain visible. Pool actual shadow-casting lights, reuse textures, and use reduced render/shadow budgets on small devices and software WebGL. All game dependencies and textures used in a production build should resolve locally.

## 6. Verification and definition of done

1. Assert the 40-residence roster, exactly 15 residences in the centre, all 12 styles, distinct footprints/roof/room combinations, and all six connected areas.
2. Programmatically check each accessible building’s entrance using the real collision solver, each open room and its supporting surface, window and locked-door blocking, and travel up and down each stair run. Check the school and mansion rooms, lower-floor headroom, well clearance, canal crossing, and links between areas.
3. Check every bundled texture path and loader decoding, UVs on render meshes, render errors, and first-person controls including sensitivity, sprint, jump, flashlight, and Pointer Lock / drag fallback in a real browser. Check the night framing, legibility of the torch beam, doors supported by frames, furniture support, and open approaches without decorative rocks.
4. Run the automated suite and production build. Keep `npm install` and `npm run dev` working with the existing Vite hosting/preview setup. Keep no third-person gameplay camera, enemies, missions, objectives or story systems in this pass.
