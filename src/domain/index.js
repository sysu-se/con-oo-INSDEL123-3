const SUDOKU_SIZE = 9;

function createEmptyGrid() {
	return Array.from({ length: SUDOKU_SIZE }, () => Array(SUDOKU_SIZE).fill(0));
}

function cloneGrid(grid) {
	return grid.map((row) => row.slice());
}

function assertGrid9x9(grid, label = 'grid') {
	if (!Array.isArray(grid) || grid.length !== SUDOKU_SIZE) {
		throw new Error(`${label} must be a 9x9 array.`);
	}

	for (const row of grid) {
		if (!Array.isArray(row) || row.length !== SUDOKU_SIZE) {
			throw new Error(`${label} must be a 9x9 array.`);
		}

		for (const value of row) {
			if (!Number.isInteger(value) || value < 0 || value > 9) {
				throw new Error(`${label} values must be integers in [0, 9].`);
			}
		}
	}
}

function normalizeGrid(grid, label = 'grid') {
	assertGrid9x9(grid, label);
	return cloneGrid(grid);
}

function normalizeMove(move) {
	if (!move || typeof move !== 'object') {
		throw new Error('Move must be an object.');
	}

	const { row, col } = move;
	const value = move.value == null ? 0 : move.value;

	if (!Number.isInteger(row) || row < 0 || row >= SUDOKU_SIZE) {
		throw new Error('Move.row must be an integer in [0, 8].');
	}

	if (!Number.isInteger(col) || col < 0 || col >= SUDOKU_SIZE) {
		throw new Error('Move.col must be an integer in [0, 8].');
	}

	if (!Number.isInteger(value) || value < 0 || value > 9) {
		throw new Error('Move.value must be null or an integer in [0, 9].');
	}

	return { row, col, value };
}

function assertPuzzleCompatibility(puzzleGrid, currentGrid) {
	for (let row = 0; row < SUDOKU_SIZE; row++) {
		for (let col = 0; col < SUDOKU_SIZE; col++) {
			const fixedValue = puzzleGrid[row][col];
			if (fixedValue !== 0 && currentGrid[row][col] !== fixedValue) {
				throw new Error('Current grid must preserve all fixed puzzle values.');
			}
		}
	}
}

function collectInvalidCells(grid) {
	const invalid = new Set();

	const markInvalid = (row, col) => {
		invalid.add(`${col},${row}`);
	};

	for (let row = 0; row < SUDOKU_SIZE; row++) {
		for (let col = 0; col < SUDOKU_SIZE; col++) {
			const value = grid[row][col];
			if (value === 0) {
				continue;
			}

			for (let index = 0; index < SUDOKU_SIZE; index++) {
				if (index !== col && grid[row][index] === value) {
					markInvalid(row, col);
					markInvalid(row, index);
				}

				if (index !== row && grid[index][col] === value) {
					markInvalid(row, col);
					markInvalid(index, col);
				}
			}

			const boxRowStart = Math.floor(row / 3) * 3;
			const boxColStart = Math.floor(col / 3) * 3;
			for (let boxRow = boxRowStart; boxRow < boxRowStart + 3; boxRow++) {
				for (let boxCol = boxColStart; boxCol < boxColStart + 3; boxCol++) {
					if ((boxRow !== row || boxCol !== col) && grid[boxRow][boxCol] === value) {
						markInvalid(row, col);
						markInvalid(boxRow, boxCol);
					}
				}
			}
		}
	}

	return Array.from(invalid);
}

function isFilled(grid) {
	for (const row of grid) {
		for (const value of row) {
			if (value === 0) {
				return false;
			}
		}
	}

	return true;
}

function normalizeHistory(history, label) {
	if (!Array.isArray(history)) {
		throw new Error(`${label} must be an array.`);
	}

	return history.map((snapshot, index) => {
		const grid = snapshot && typeof snapshot === 'object' && Array.isArray(snapshot.grid)
			? snapshot.grid
			: snapshot;
		return normalizeGrid(grid, `${label}[${index}]`);
	});
}

function createSudokuInternal({ puzzleGrid, currentGrid = puzzleGrid }) {
	const state = {
		puzzleGrid: normalizeGrid(puzzleGrid, 'puzzleGrid'),
		currentGrid: normalizeGrid(currentGrid, 'grid'),
	};

	assertPuzzleCompatibility(state.puzzleGrid, state.currentGrid);

	return {
		getGrid() {
			return cloneGrid(state.currentGrid);
		},

		getPuzzleGrid() {
			return cloneGrid(state.puzzleGrid);
		},

		isFixedCell(row, col) {
			return state.puzzleGrid[row][col] !== 0;
		},

		guess(move) {
			const { row, col, value } = normalizeMove(move);

			if (state.puzzleGrid[row][col] !== 0) {
				return false;
			}

			if (state.currentGrid[row][col] === value) {
				return false;
			}

			state.currentGrid[row][col] = value;
			return true;
		},

		validate() {
			return collectInvalidCells(state.currentGrid);
		},

		getInvalidCells() {
			return collectInvalidCells(state.currentGrid);
		},

		isSolved() {
			return isFilled(state.currentGrid) && this.getInvalidCells().length === 0;
		},

		clone() {
			return createSudokuInternal({
				puzzleGrid: state.puzzleGrid,
				currentGrid: state.currentGrid,
			});
		},

		toJSON() {
			return {
				puzzleGrid: cloneGrid(state.puzzleGrid),
				grid: cloneGrid(state.currentGrid),
			};
		},

		toString() {
			return state.currentGrid
				.map((row) => row.map((value) => (value === 0 ? '.' : String(value))).join(' '))
				.join('\n');
		},
	};
}

function createGameInternal({ sudoku, undoStack = [], redoStack = [] }) {
	if (!sudoku || typeof sudoku.clone !== 'function' || typeof sudoku.toJSON !== 'function') {
		throw new Error('createGame requires a Sudoku-like object.');
	}

	let currentSudoku = sudoku.clone();
	const puzzleGrid = currentSudoku.getPuzzleGrid
		? currentSudoku.getPuzzleGrid()
		: currentSudoku.getGrid();
	let undoHistory = normalizeHistory(undoStack, 'undoStack');
	let redoHistory = normalizeHistory(redoStack, 'redoStack');

	const restoreGrid = (grid) => {
		currentSudoku = createSudokuInternal({ puzzleGrid, currentGrid: grid });
	};

	const snapshotCurrentGrid = () => currentSudoku.getGrid();

	return {
		getSudoku() {
			return currentSudoku.clone();
		},

		guess(move) {
			const snapshot = snapshotCurrentGrid();
			const changed = currentSudoku.guess(move);

			if (!changed) {
				return false;
			}

			undoHistory.push(snapshot);
			redoHistory = [];
			return true;
		},

		undo() {
			if (undoHistory.length === 0) {
				return false;
			}

			redoHistory.push(snapshotCurrentGrid());
			restoreGrid(undoHistory.pop());
			return true;
		},

		redo() {
			if (redoHistory.length === 0) {
				return false;
			}

			undoHistory.push(snapshotCurrentGrid());
			restoreGrid(redoHistory.pop());
			return true;
		},

		canUndo() {
			return undoHistory.length > 0;
		},

		canRedo() {
			return redoHistory.length > 0;
		},

		toJSON() {
			return {
				sudoku: currentSudoku.toJSON(),
				undoStack: undoHistory.map((grid) => cloneGrid(grid)),
				redoStack: redoHistory.map((grid) => cloneGrid(grid)),
			};
		},
	};
}

export function createSudoku(input) {
	return createSudokuInternal({ puzzleGrid: input });
}

export function createSudokuFromJSON(json) {
	if (!json || typeof json !== 'object') {
		throw new Error('Invalid sudoku JSON.');
	}

	const puzzleGrid = Array.isArray(json.puzzleGrid) ? json.puzzleGrid : json.grid;
	const currentGrid = Array.isArray(json.grid) ? json.grid : puzzleGrid;

	return createSudokuInternal({ puzzleGrid, currentGrid });
}

export function createGame({ sudoku }) {
	return createGameInternal({ sudoku });
}

export function createGameFromJSON(json) {
	if (!json || typeof json !== 'object') {
		throw new Error('Invalid game JSON.');
	}

	const sudoku = createSudokuFromJSON(json.sudoku);
	const undoStack = Array.isArray(json.undoStack) ? json.undoStack : [];
	const redoStack = Array.isArray(json.redoStack) ? json.redoStack : [];

	return createGameInternal({ sudoku, undoStack, redoStack });
}

export function createEmptySudoku() {
	return createSudoku(createEmptyGrid());
}
