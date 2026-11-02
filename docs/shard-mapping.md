# Shard identity mapping

Every numbered guide entry has an explicit `(mapId, UniqueID)` identity. The complete
[99-record inventory](shard-mapping.json) includes the actor's package, name, world position,
guide screenshot links, and the evidence used to match it. It also fingerprints the installed
game's container indexes, the property mappings, and the CUE4Parse revision used for inspection.

## Save data and lookup

`evaluate` reads the map's `treasureBoxList` and retains the `UniqueID` of each open record with
`ID === -1`. Closed records remain missing; unrelated treasure records do not count. `UniqueID`
is local to a map, and zero is a valid ID.

Each location key in `index.html` is `[mapId, uniqueId, guideNo]`. The third value joins that actor
to the location's existing English/German guide description. It is an explicit association,
independent of the order of either list. `analyse` checks each actor separately before calculating
location and chapter totals. Map presence controls that shard's visited state, including locations
that span several maps.

## Verification method

The game was inspected statically; it was not launched or modified. Native assets were decoded with
[CUE4Parse](https://github.com/FabianFG/CUE4Parse) in UE5.6 mode and the release property mappings
identified in the inventory. All 99 distinct actor identities matched the finder's original key pool.

1. Resolve the save map ID through `DT_MapData_*` to its level packages.
2. Find each `BP_MapGimmick_FieldItem_Medal` actor, its `m_UniqueId`, and its root component's
   `RelativeLocation`. Account for defaults, streaming transforms, attachments, component scale,
   and instance transforms when checking nearby objects.
3. Match the physical spot to the [numbered guide entry](https://www.powerpyx.com/final-fantasy-resonance-all-tablet-shard-locations/)
   using distinctive props, floor heights, route geometry, or the baked native minimap. Coordinates
   alone do not assign a guide number. For baked/merged meshes, inspect the actual transformed mesh
   vertices rather than treating the actor origin as the landmark's position.
4. Record the resulting association and its evidence. A location with one actor is unambiguous;
   within a larger group, a uniquely remaining actor can be identified after the other spots match.

Native map captures in `DA_MapLandCapture` use horizontal `worldY` and vertical `-worldX`.
Their `WorldLocation` and `BoxSize` let actor positions be compared with the captured path geometry.
Floor-specific captures and nearby landmarks distinguish vertically overlapping routes. Invisible
walkways can extend beyond the solid floor footprint, so bounding-box containment is not a universal
validation rule.

## Important corrections

Several groups differ from ascending actor-ID order. Examples:

| Guide numbers | Map ID | UniqueIDs in guide order | Distinguishing evidence |
|---|---:|---|---|
| 3, 4 | 2040 | 9, 8 | Ground wall spot versus raised ladder platform |
| 5, 6 | 3040 | 15, 14 | Cylinder geometry versus fallen pillar geometry |
| 10, 11, 12 | 3030 | 8, 7, 6 | Successive tower floors |
| 28, 29, 30, 31 | 2070 | 26, 29, 27, 28 | Dock, statue/bench, bridge planter, tree |
| 40, 41, 42 | 3110 | 59, 60, 58 | Separate platform room and descending water-control route |
| 48, 49 | 3140 | 11, 10 | Overhead metal walkway versus fence and lit side room |
| 50, 51 | 2120 | 11, 10 | Upper crate platform versus metal pillar and railing |
| 54, 55 | 3150 | 3, 2 | Right cell versus left cell in separate captured sections |
| 77, 78, 79 | 3220 | 34, 36, 35 | Ground desks, shelves, high gantry |
| 92, 93 | 3271 | 2, 1 | Initial save-point bend versus later southwest dead end |

Fina's Psyche spans three maps: #68 is `(3210,26)` by the chained gate; #69 is `(3211,3)`
inside the supply tent; #70 is `(3212,4)` in the forest clearing; #75 is `(3211,4)` in the outdoor
army camp. These identities also determine which entries remain hidden before their own map is visited.

The guide's image filenames are not reliable numbering keys. Entry #62 links to `guide-99.jpg`,
#67 links to `guide-62.jpg`, and later entries use shifted image numbers. The article repeats #54's
image for #55; the separate `guide-55.jpg` image resolves the left-cell spot. The inventory records
the actual images used rather than constructing filenames from guide numbers.

## Maintaining the data

Run `node --test tests/per-shard.test.cjs` after changing either the lookup or inventory. Tests require
99 unique actor identities, guide numbers 1–99 exactly once, matching descriptions, and agreement
between the inventory and runtime lookup. They also exercise each collection subset and the display
and spoiler behavior.

For a future game build, compare the container fingerprints and recheck affected actor/landmark
packages before changing associations. The game installation, mapping file, extracted assets,
screenshots, and personal save files are development inputs and are not shipped with this tool.
