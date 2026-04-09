import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js'

describe('HW1 bonus round-trip / history restore', () => {
  it('restores game history stacks after serialize -> deserialize', async () => {
    const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi()

    const game = createGame({ sudoku: createSudoku(makePuzzle()) })
    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })
    game.undo()

    const restored = createGameFromJSON(JSON.parse(JSON.stringify(game.toJSON())))

    expect(restored.canUndo()).toBe(true)
    expect(restored.canRedo()).toBe(true)

    restored.redo()
    expect(restored.getSudoku().getGrid()[1][1]).toBe(7)

    restored.undo()
    expect(restored.getSudoku().getGrid()[1][1]).toBe(0)
  })

  it('restored game still follows redo invalidation after new guess', async () => {
    const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi()

    const game = createGame({ sudoku: createSudoku(makePuzzle()) })
    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })
    game.undo()

    const restored = createGameFromJSON(JSON.parse(JSON.stringify(game.toJSON())))

    expect(restored.canRedo()).toBe(true)
    restored.guess({ row: 2, col: 0, value: 1 })
    expect(restored.canRedo()).toBe(false)
  })
})
