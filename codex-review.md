# con-oo-INSDEL123-3 - Review

## Review 结论

当前实现已经把 Game/Sudoku 通过 store adapter 真实接入了 Svelte 的开始游戏、棋盘渲染、输入、Undo/Redo 主流程，这一点比“领域对象只存在于测试里”的方案明显更好；但领域层的历史模型仍然退化为裸 grid 快照，且 hints/候选数等关键交互状态没有进入统一的游戏模型，导致 OOD、业务一致性和可演进性仍有明显短板。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | good |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. Game 的历史退化为裸 grid 快照，领域抽象被快照格式反向绑定

- 严重程度：core
- 位置：src/domain/index.js:122-133,205-219,269-307
- 原因：undo/redo 保存的是 number[][]，恢复时又直接走 createSudokuInternal({ puzzleGrid, currentGrid })。这说明 Game 并不是在管理 Sudoku 的演进，而是在管理 Sudoku 的某一种内部表示。一旦 Sudoku 以后加入解答缓存、候选数、标记或其他业务状态，历史和序列化都会静默丢失这些信息，扩展性很差。

### 2. 与棋局强相关的交互状态没有纳入 Game，Undo/Redo 只能回滚数字

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/grid.js:67-110, src/components/Controls/Keyboard.svelte:10-25, src/node_modules/@sudoku/stores/hints.js:25-42, src/node_modules/@sudoku/stores/candidates.js:9-27
- 原因：候选数、提示消耗等状态散落在独立 store 中；userGrid.undo()/redo() 只会回滚 Game 里的 grid 历史，不会同步回滚 hints/candidates。对用户而言这些都是同一局游戏状态，当前模型会产生“数字回退了，但提示次数或笔记没有回退”的业务不一致，也说明 Game 还不是完整的游戏聚合根。

### 3. Hint 建立在当前可变盘面上求解，而不是基于谜题或已知解

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/grid.js:76-85
- 原因：applyHint 每次都对 sudoku.getGrid() 调 solveSudoku。如果玩家当前输入已经冲突或形成无解状态，hint 的行为就取决于外部求解器如何处理错误盘面，存在直接失效或给出不稳定结果的风险。数独提示更合理的建模通常是依赖原题的合法解，而不是对当前错误状态重新求解。

### 4. store adapter 暴露了内部 Game 实例，削弱了响应式边界

- 严重程度：minor
- 位置：src/node_modules/@sudoku/stores/grid.js:121-123
- 原因：getGame() 把内部领域对象直接暴露给外部，理论上任何调用方都能绕过 publish() 直接操作 game，从而破坏“UI 只能通过 adapter 更新领域对象”的约束。虽然当前代码里没有明显滥用，但这个出口本身让架构边界变得不稳。

### 5. 根组件把 subscribe 副作用写在顶层且没有清理

- 严重程度：minor
- 位置：src/App.svelte:12-17
- 原因：gameWon.subscribe(...) 不在 onMount/onDestroy 或显式 unsubscribe 管理之下，不符合 Svelte 对副作用生命周期管理的常见写法。根组件场景下问题未必立刻暴露，但复用、测试或重建组件时会更脆弱。

## 优点

### 1. Sudoku 对象已经封装了盘面的核心职责

- 位置：src/domain/index.js:135-201
- 原因：固定格保护、guess、冲突检测、序列化、clone 都集中在同一个领域对象里，组件不再直接改二维数组，至少把最核心的数独规则从 View 层收回到了领域层。

### 2. 领域对象已经真实进入 Svelte 主流程

- 位置：src/node_modules/@sudoku/stores/grid.js:24-124, src/components/Board/index.svelte:40-52, src/components/Controls/Keyboard.svelte:10-25, src/components/Controls/ActionBar/Actions.svelte:13-31, src/components/Modal/Types/Welcome.svelte:16-24
- 原因：开始游戏、棋盘渲染、用户输入、Undo/Redo 都经过 createGameStore -> Game/Sudoku，组件主要负责读取 store 和触发命令，满足了作业对“真实接入”而非“只在测试中存在”的核心要求。

### 3. adapter 明确区分了领域对象与可订阅视图状态

- 位置：src/node_modules/@sudoku/stores/grid.js:11-35,127-180
- 原因：createViewState/publish 把 puzzleGrid、grid、invalidCells、won、canUndo、canRedo 统一外表化，再用 derived store 适配组件消费，这比让组件直接依赖领域对象内部结构更符合 Svelte 的数据流习惯。

### 4. 构造和反序列化入口具备基本防御性校验

- 位置：src/domain/index.js:11-66,283-307
- 原因：9x9 结构、值域、固定格兼容性以及 JSON 入口都有显式校验，能较早暴露非法输入，避免错误状态直接流入 UI。

## 补充说明

- 本次结论仅基于静态阅读 src/domain/index.js 及其关联的 Svelte/store 接入代码；没有运行应用，也没有执行测试。
- 因此像 hint 在错误盘面上的实际运行表现、gameWon 弹窗与暂停时序等结论，属于基于代码路径的静态推断，而非运行时验证结果。
- 审查范围按要求限定在 src/domain/* 与其关联的 Svelte 接入（主要是 src/node_modules/@sudoku/stores/grid.js、@sudoku/game 及直接调用这些 store 的组件），没有扩展到无关目录。
