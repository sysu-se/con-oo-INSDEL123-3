# DESIGN

## 1. Overall Design

This submission uses a `store adapter` design.

- The domain layer is `Sudoku` + `Game` in `src/domain/index.js`.
- The Svelte-facing adapter is `gameState` in `src/node_modules/@sudoku/stores/grid.js`.
- View components do not mutate raw arrays directly. They only:
  - read reactive state from stores such as `grid`, `userGrid`, `invalidCells`, `gameState`
  - call commands exposed by the adapter such as `set`, `applyHint`, `undo`, `redo`, `generate`, `decodeSencode`

This matches the homework requirement that the real UI must consume the domain objects instead of leaving them only in tests.

## 2. Domain Objects

### Sudoku

`Sudoku` is responsible for board-level state and rules.

- It stores an immutable `puzzleGrid` for the original givens.
- It stores a mutable `grid` for the current player-facing board.
- It exposes:
  - `getGrid()`
  - `getPuzzleGrid()`
  - `guess(move)`
  - `validate()`
  - `getInvalidCells()`
  - `isSolved()`
  - `clone()`
  - `toJSON()`
  - `toString()`

Important behavior:

- Fixed cells cannot be edited.
- Validation lives in `Sudoku`, not in Svelte components.
- `toJSON()` includes both `puzzleGrid` and current `grid`, so the object can be reconstructed without losing puzzle metadata.

### Game

`Game` is responsible for session-level behavior.

- It holds the current `Sudoku`.
- It manages `undo` / `redo`.
- It exposes:
  - `getSudoku()`
  - `guess(move)`
  - `undo()`
  - `redo()`
  - `canUndo()`
  - `canRedo()`
  - `toJSON()`

## 3. Improvements Over HW1

Compared with HW1, I made three substantive improvements.

### A. Clearer responsibility boundary

HW1 only modeled a mutable board plus history. That was enough for tests, but not enough for real UI integration.

In this version:

- `Sudoku` owns board rules and validation.
- `Game` owns history and interaction sequencing.
- Svelte-specific reactivity is moved out of the domain layer into a dedicated adapter store.

### B. Immutable puzzle givens are now explicit

The original puzzle and the current board are now different pieces of state.

This matters because the UI needs both:

- the original puzzle to know which cells are fixed
- the current board to render player input

Without this separation, the UI would need to reconstruct domain meaning from raw arrays, which weakens the design.

### C. History stores only current-board snapshots

`Game` keeps undo/redo history as snapshots of the current grid, not full cloned game objects.

Why this is better here:

- the puzzle givens are stable and do not need to be duplicated in every history entry
- restore logic stays simple
- serialized history becomes smaller and easier to reason about

Trade-off:

- snapshot history uses more space than pure move logs
- however, it keeps undo/redo deterministic and easy to restore after serialization

## 4. How The View Consumes The Domain Objects

The view does not subscribe to `Game` directly. It subscribes to the adapter store `gameState`, plus selector stores derived from it.

### Reactive state exposed to the UI

`gameState` publishes plain data for Svelte:

- `puzzleGrid`
- `grid`
- `invalidCells`
- `won`
- `canUndo`
- `canRedo`

Selector stores are built on top of that adapter:

- `grid` exposes `puzzleGrid`
- `userGrid` exposes the current board and UI commands
- `invalidCells` exposes the validation result

### UI flow

1. Starting a game

- `startNew()` or `startCustom()` calls `grid.generate(...)` or `grid.decodeSencode(...)`
- those functions create a fresh domain `Game(createSudoku(...))`
- the adapter publishes a new Svelte view state

2. Rendering the board

- `Board/index.svelte` reads:
  - `$grid` for fixed puzzle cells
  - `$userGrid` for current values
  - `$invalidCells` for conflict highlighting

3. User input

- `Keyboard.svelte` calls `userGrid.set($cursor, value)`
- `userGrid.set(...)` delegates to `gameState.guess(...)`
- `gameState.guess(...)` delegates to domain `Game.guess(...)`
- `Game.guess(...)` delegates to domain `Sudoku.guess(...)`

4. Undo / Redo

- `Actions.svelte` calls `userGrid.undo()` / `userGrid.redo()`
- those commands go into domain `Game.undo()` / `Game.redo()`

5. Hint

- `Actions.svelte` calls `userGrid.applyHint($cursor)`
- the adapter computes the solved value, then still writes through `Game.guess(...)`
- this keeps hint writes inside the same domain/history pipeline as normal user input

## 5. Why Svelte Updates Correctly

This homework specifically asks how the domain objects and Svelte reactivity cooperate.

The key point is:

- mutating a field inside a normal object does not automatically notify Svelte
- therefore the domain object is not exposed directly as a mutable object graph for templates to depend on

Instead, the adapter does this:

1. call a domain command such as `guess`, `undo`, or `redo`
2. read fresh plain data from the domain object
3. call `store.set(...)` with a new view-state object

Because `gameState` is a real Svelte store, components can consume it with `$gameState`, `$grid`, `$userGrid`, and `$invalidCells`.
When `store.set(...)` runs, Svelte knows the store changed and re-renders the dependent components.

### Why I did not rely on direct object mutation

If the UI held a `Game` object and I only mutated its internals, Svelte would not know that:

- `game.sudoku.grid[row][col]` changed
- history availability changed
- invalid cells changed
- win state changed

That would cause classic bugs like "data changed but the screen did not refresh".

## 6. Reactive Boundary

The reactive boundary is the adapter store.

- Inside the domain layer:
  - state is plain JavaScript objects and arrays
  - mutation is allowed as part of domain commands
- At the adapter boundary:
  - fresh serializable view data is emitted through a Svelte store
- Inside Svelte components:
  - templates react only to store values, not to hidden internal mutation

This keeps the responsibilities explicit:

- domain layer: correctness
- adapter layer: reactivity bridge
- view layer: rendering and event forwarding

## 7. States Visible To UI vs Internal States

Visible to UI:

- current grid
- original puzzle grid
- invalid cell list
- win state
- undo/redo availability

Kept internal:

- domain object identity
- undo/redo snapshot arrays
- mutation details inside `Sudoku` / `Game`
- reconstruction logic used during restore

This is intentional. The UI should know enough to render and invoke commands, but it should not manage domain internals.

## 8. Important Svelte Detail

One subtle bug from this homework is that method calls are not automatically reactive.

For example, code like this is risky:

```svelte
$: canUndo = userGrid.canUndo()
```

That expression does not subscribe to a changing store value by itself. So I changed the undo/redo buttons to read `$gameState.canUndo` and `$gameState.canRedo` directly from reactive store state.

This is exactly why the adapter layer is useful: it turns domain facts into explicit reactive data.

## 9. If Migrating To Svelte 5 Later

The most stable layer is the domain layer:

- `Sudoku`
- `Game`

The most likely layer to change is the adapter layer:

- `gameState`
- selector stores in `stores/grid.js`

That is a good sign. The domain model is UI-framework-agnostic, while the Svelte integration remains replaceable.
