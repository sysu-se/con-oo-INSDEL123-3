## HW 问题收集

结合本次作业实现和 `codex-review.md` 中的 review，我整理了 3 个已经解决的问题，以及 3 个目前还没有彻底解决的问题。

### 已解决

1. 如何让 `Sudoku` / `Game` 不只停留在测试里，而是真正进入 Svelte 的主流程？
   1. **上下文**：HW1 里很容易出现一种情况，就是领域对象已经写出来了，测试也能跑，但真实页面还是沿用原来的数组和组件逻辑。这样实际上不算“接入成功”。根据 review，我这版已经把“开始游戏、棋盘渲染、用户输入、Undo/Redo”都接进了 `createGameStore -> Game/Sudoku` 这条链路里。对应代码主要在 [src/node_modules/@sudoku/stores/grid.js](f:/con-oo-INSDEL123-3/src/node_modules/@sudoku/stores/grid.js)、[src/components/Board/index.svelte](f:/con-oo-INSDEL123-3/src/components/Board/index.svelte)、[src/components/Controls/Keyboard.svelte](f:/con-oo-INSDEL123-3/src/components/Controls/Keyboard.svelte) 和 [src/components/Controls/ActionBar/Actions.svelte](f:/con-oo-INSDEL123-3/src/components/Controls/ActionBar/Actions.svelte)。
   2. **解决手段**：通过增加 store adapter，把 `Game` 包在 `gameState` 中，对外只暴露可订阅状态和命令接口。这样组件负责“读 store + 发命令”，而不是自己维护核心业务逻辑。这个问题现在已经基本解决。

2. 如何把 Svelte 的响应式机制和领域对象配合起来？
   1. **上下文**：领域对象本身是普通 JavaScript 对象，直接修改内部字段时，Svelte 并不会自动知道它变了。所以如果把 `Game` 或 `Sudoku` 直接暴露给组件，UI 很容易出现“数据改了但页面没刷新”的问题。review 里认可的一点，是当前实现已经通过 adapter 把 `puzzleGrid`、`grid`、`invalidCells`、`won`、`canUndo`、`canRedo` 等状态统一外表化。
   2. **解决手段**：在 [src/node_modules/@sudoku/stores/grid.js](f:/con-oo-INSDEL123-3/src/node_modules/@sudoku/stores/grid.js) 里通过 `createViewState()` 和 `publish()`，每次调用领域命令后重新生成一份 view state，再由 Svelte store 通知页面更新。这样响应式边界就清楚了，也回答了“为什么 UI 会更新”这个作业要求里的关键问题。

3. `Sudoku` 和 `Game` 的职责应该怎么划分？
   1. **上下文**：如果职责划分不清，很容易出现规则判断、历史管理、UI 操作入口混在一起的问题。review 里对这一版的正面评价之一，是 `Sudoku` 已经把固定格保护、guess、冲突检测、序列化、clone 等核心盘面职责收进了领域层，而组件不再直接操作二维数组。
   2. **解决手段**：目前的设计是 `Sudoku` 负责棋盘规则和状态，`Game` 负责对 `Sudoku` 的包装以及 Undo/Redo。这种分层至少把最核心的数独业务规则从 View 层收回到了领域层，比单纯在 `.svelte` 文件里处理业务逻辑更合理。这个问题目前算是已经有了比较明确的解决方案。

### 未解决

1. `Game` 的历史现在只是裸 `grid` 快照，这样的领域建模还不够完整
   1. **上下文**：review 指出当前 [src/domain/index.js](f:/con-oo-INSDEL123-3/src/domain/index.js) 里的 Undo/Redo 历史保存的是 `number[][]`，恢复时也是重新用 `puzzleGrid + currentGrid` 去构造 `Sudoku`。这说明 `Game` 管理的其实不是一个完整的 `Sudoku` 演化过程，而只是它当前最小的一种内部表示。现在这样做可以工作，但如果以后 `Sudoku` 再增加候选数、缓存、标记或别的状态，历史和序列化都可能丢信息。
   2. **尝试解决手段**：我现在已经理解这个问题的本质，也认同 review 里“扩展性不足”的判断。但我还没有继续把历史从“grid 快照”升级成“完整局面快照”或者“更稳定的领域快照结构”，所以这个问题目前还没有彻底解决。

2. 与棋局强相关的状态还没有被统一纳入 `Game`
   1. **上下文**：目前数字填写是通过 `Game` 管理的，但候选数在 [src/node_modules/@sudoku/stores/candidates.js](f:/con-oo-INSDEL123-3/src/node_modules/@sudoku/stores/candidates.js)，提示次数在 [src/node_modules/@sudoku/stores/hints.js](f:/con-oo-INSDEL123-3/src/node_modules/@sudoku/stores/hints.js)，这些状态都散落在独立 store 里。review 提到，这样会导致 Undo/Redo 只能回滚数字，不能回滚提示次数或候选数，对用户来说会出现“同一局游戏里有些状态能回退，有些不能回退”的不一致。
   2. **尝试解决手段**：我已经能意识到这不是单纯的“功能缺一点”，而是聚合根边界还不完整。但当前版本还没有把 hints、candidates 这些和棋局强相关的状态并入 `Game`，所以这个问题目前仍然存在。

3. `applyHint()` 的设计还有改进空间，提示依赖的是当前盘面求解而不是稳定答案
   1. **上下文**：在 [src/node_modules/@sudoku/stores/grid.js](f:/con-oo-INSDEL123-3/src/node_modules/@sudoku/stores/grid.js) 中，`applyHint()` 每次都会对当前 `sudoku.getGrid()` 调 `solveSudoku()`。review 指出，如果玩家当前已经填错，甚至把盘面填成无解状态，那么 hint 的表现就会依赖外部求解器怎么处理这个错误盘面，可能不稳定。这说明“提示”这个能力目前还不够健壮。
   2. **尝试解决手段**：我现在能理解为什么更合理的设计应该是基于题目的稳定解，或者在开始游戏时就缓存合法答案，而不是每次对当前盘面重新求解。但这部分我还没有改，所以现在只能说是发现并理解了问题，还没有真正解决。
