# Warehouse modeling brief

Room ID: `warehouse`
Inputs: none measured yet. Every number is an assumption in `config.ts`.
Output: `demos/warehouse/`, registered in `demos/index.ts`.

## Evidence status

| Item | Status | Current value (config.ts) |
| --- | --- | --- |
| Interior width × depth | assumed | 160 × 100 ft (48.77 × 30.48 m) |
| Eave height, roof pitch | assumed | 30 ft, 1:12, ridge along the length |
| Frame bays, end-wall bays | assumed | 6 bays of 26.7 ft; 4 end-wall bays |
| Dock doors | assumed | 5 on the south wall, 9 × 10 ft, dock height 48 in |
| Drive-in door | assumed | east wall, 12 × 14 ft |
| Personnel doors | assumed | 2 north (aligned with aisles), 1 each east, west and south |
| Office | assumed | SW corner, 40 × 28 ft, 12 ft partitions, 9 ft drop ceiling |
| Racking | assumed | 42 in frames, 108 in beams, 24 ft uprights, beams at 5/10/15/20 ft, 6 bays, aisles at least 12 ft |
| Finishes and colors | assumed | white liner, tan R-panel exterior, blue uprights, orange beams |
| Equipment | illustrative | positions chosen to show typical operations, not an inventory |

Nothing in this model has been compared with photographs or a scan. Treat it as a layout study until the measurements below are in.

## Measure first, in this order

1. Interior wall-to-wall width and depth at the floor. Note whether walls are square.
2. Eave height (floor to the underside of the roof at the long walls) and the ridge height. The pitch follows from those two.
3. Main frame column positions along one long wall. These set `BUILDING.bays`; mark them if the spacing is uneven.
4. Every opening: wall, center position from a corner, width, height. Dock doors also need the drop to the truck court.
5. Office footprint, partition height, door and window positions.
6. Racking: frame depth, beam length, upright height, beam levels, number of bays per row, the first row's distance from the walls, and the aisle widths. Note any row that breaks the pattern (cross aisles, tunnel bays, a different height).
7. Photos from each corner at eye height and from the dock doors, for colors and for checking the comparison views.

Record uneven spacing or extra elements as new config fields instead of hard-coding them in a part file. Positions should keep coming from `plan.ts`.

## Structure

- `config.ts`: every editable dimension.
- `plan.ts`: positions derived from the config: walls and openings, frame lines, rack rows and aisles, office rectangle, staging lanes, walkable test, floor-plan export.
- `shell.ts`: walls (one group each, for the dollhouse cutaway), columns, roof, purlins, rafters.
- `doors.ts`: dock, drive-in and personnel doors, windows, levelers, bollards, building sign.
- `racking.ts` + `loads.ts`: rack steel and seeded pallet loads.
- `office.ts`: partitions, rooms and furniture. The drop ceiling is part of the "ceiling" list, so it hides in the dollhouse view.
- `equipment.ts`: vehicles, stations, staged pallets, wall services. Separable items are named, physics-tagged objects.
- `overhead.ts`: fixtures, fans, sprinklers and aisle signs, all hung from the roof group.
- `floor.ts`: the painted slab, drawn from the plan.
- `site.ts`: pavement, truck well, trailers, parking, trees.
- `lights.ts`: the light rig (5 lights; see the budget note in the file).

## Verification so far

- `npm run build` passes (TypeScript and Vite).
- Rendered in headless Chromium with software WebGL from these views: dollhouse home, top, dock close-up, eye level in an aisle, office interior, floor plan, knolling and the physics playground. No console errors.
- Scene size after batching is about 0.9 M vertices, 0.5 M triangles and about 115 draw calls.

## Next steps

- Replace the assumed numbers with measurements, then compare the views with photographs from the same positions.
- Scan the office with the iPhone app and rebuild `office.ts` from the measured walls (see the README).
- Match the actual rack inventory: row count, bay counts, levels and real SKU mix.
