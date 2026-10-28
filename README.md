# WCP Warehouse

An editable 3D model of the whole warehouse: building shell, steel frames and roof, dock-high loading with trailers, selective pallet racking with loaded pallets, the front office, material-handling equipment, overhead services and the site around it. It runs in the room viewer from [wesbos/3d-model-anything](https://github.com/wesbos/3d-model-anything), with dollhouse, walk-around, floor-plan, knolling and physics-playground views.

**This is a planning model, not a measured one yet.** Every dimension comes from one file, [`demos/warehouse/config.ts`](demos/warehouse/config.ts), set to typical values for a 160 × 100 ft (48.8 × 30.5 m) pre-engineered metal building. Change the numbers to the real building's and the walls, racks, docks, floor markings and plan rebuild around them. [`demos/warehouse/BRIEF.md`](demos/warehouse/BRIEF.md) lists what to measure first.

## Run it

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:5188. Use the sidebar to switch views:

- **Dollhouse**: orbit around the building. The walls facing you and the roof hide so you can see inside.
- **Walk around**: first-person at eye height (WASD, Shift to run, Esc to exit).
- **Layout**: a measured floor plan of walls, doors, rack rows and equipment, with the floor area.
- **Knolling**: every separable piece of equipment laid out side by side at the same scale.
- **Enter playground**: physics. Throw cartons, totes and cones, or walk the aisles.

`npm run build` type-checks and builds the static site into `apps/room-viewer/dist`, and `npm run preview` serves that build.

## What's modeled

| Area | Contents |
| --- | --- |
| Shell | Insulated metal-panel walls (white liner inside, R-panel with wainscot outside), tapered rigid frames, end-wall posts, purlins, a 1:12 gable roof with skylights, translucent wall panels, gutters and downspouts |
| Docks | 5 dock-high doors with sectional doors (2 open), levelers, seals, bumpers, truck restraints, signal and dock lights, numbering, a sunken truck court with ramp and retaining walls, two 53 ft trailers being loaded |
| Storage | 14 rack rows (single rows on the walls, back-to-back doubles between them), 6 bays × 5 levels, teardrop uprights, step beams, wire decks, end guards, about 720 seeded pallet loads (cartons, stretch-wrapped, totes, drums, crates, sacks) |
| Office | South-west corner: storefront entrance, windows, reception, desk pod, glass conference room, break area, restrooms, drop ceiling with troffers |
| Operations | 2 forklifts, 2 pallet jacks, 3 packing benches, a stretch wrapper, a vertical baler, a rolling ladder, a charger, staged pallets in the dock lanes, carts, totes, cones |
| Services | LED high bays, 2 HVLS fans, the ESFR sprinkler grid with its riser, electrical service, extinguishers, exit signs, aisle signs |
| Floor | One painted slab drawn from the plan: saw cuts, aisle lines, STOP bars, dock hazard zones, staging lanes, walkways, tire marks |
| Site | Pavement, parking, sidewalk, dumpster and trees |

All textures are drawn in code ([`textures.ts`](demos/warehouse/textures.ts)), so the model ships with no image files.

## Make it match the real building

1. **Measure the shell**: interior width and depth, eave height, roof pitch and frame spacing. Enter them in `BUILDING`.
2. **Locate the openings**: dock door centers and sizes, drive-in and personnel doors, office windows. Enter them in `DOCKS`, `DRIVE_IN`, `MAN_DOORS` and `OFFICE`.
3. **Measure the racking**: frame depth, beam length, upright height, beam levels, aisle width and number of bays. Enter them in `RACKS`. Row positions are laid out automatically: single rows on the side walls, doubles in between, spare width shared by the aisles.
4. **Compare with photos** and adjust colors in [`materials.ts`](demos/warehouse/materials.ts).

Save, and the viewer reloads in place. Use **Layout** to check the plan against a drawing.

### Using the iPhone scan workflow

The [scan-to-threejs skill](.agents/skills/scan-to-threejs/SKILL.md) from 3d-model-anything is included, so an AI coding agent can rebuild spaces from LiDAR captures. RoomPlan scanning works best on room-sized spaces, so in a warehouse use it for the office, restrooms and other enclosed rooms. Measure the main floor with a laser measure or take it from drawings. To capture, build the 3D Model Anything iPhone app from [the upstream repository](https://github.com/wesbos/3d-model-anything/tree/main/apps/house-capture) and extract exports into the git-ignored `data/captures-in/<room>/`. Then ask your agent:

> Use scan-to-threejs with data/captures-in/office and update demos/warehouse/office.ts to match the measured walls and furniture.

The skill's references mention Wes Bos's office demo and `apps/house-capture`. Neither is copied into this repository; both are in the upstream repository.

## Debug parameters

Add these to the viewer URL:

- `?parts=racking,office`: build only the listed parts (`site`, `racking`, `office`, `equipment`, `overhead`); the shell is always built.
- `?shadows=0`: turn off the shadowed key light.
- `?key=`, `?hemi=`, `?env=`, `?exp=`, `?dock=`, `?office=`: lighting A/B (key, fill, environment, exposure, dock daylight, office).
- `?nobatch`: skip mesh merging, for inspecting individual objects.

## Layout of this repository

- `demos/warehouse/`: the warehouse model. Start with `config.ts`; `plan.ts` derives positions from it, and one file builds each area.
- `apps/room-viewer/`: the viewer, playground and capture page.
- `packages/room-runtime/`, `packages/room-physics/`: shared Three.js helpers and Rapier physics.
- `.agents/skills/scan-to-threejs/`: the agent skill for scan-based reconstruction.

## Credits and license

The viewer, runtime, physics package and agent skill are copied from [wesbos/3d-model-anything](https://github.com/wesbos/3d-model-anything) (commit `31b2dc9`), MIT licensed, © 2026 Wes Bos. See [LICENSE](LICENSE). Changes to those files here:

- The camera range and far plane now scale with the room's size.
- The environment capture distance is configurable (`render.envFar`).
- Floor-plan labels scale with the plan's size.
- Office-only hooks are removed from the playground.

Wes's office demo and its image assets are not included. The warehouse model in `demos/warehouse/` is original to this repository.
