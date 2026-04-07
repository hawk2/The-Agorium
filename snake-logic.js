(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.SnakeGameLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const GRID_SIZE = 16;
  const INITIAL_DIRECTION = 'right';
  const DIRECTIONS = Object.freeze({
    up: Object.freeze({ name: 'up', x: 0, y: -1 }),
    down: Object.freeze({ name: 'down', x: 0, y: 1 }),
    left: Object.freeze({ name: 'left', x: -1, y: 0 }),
    right: Object.freeze({ name: 'right', x: 1, y: 0 }),
  });

  function cloneCell(cell) {
    return { x: cell.x, y: cell.y };
  }

  function createCell(x, y) {
    return { x, y };
  }

  function cellsEqual(a, b) {
    return Boolean(a && b) && a.x === b.x && a.y === b.y;
  }

  function serializeCell(cell) {
    return `${cell.x},${cell.y}`;
  }

  function getDirection(name) {
    return DIRECTIONS[name] || DIRECTIONS[INITIAL_DIRECTION];
  }

  function isOppositeDirection(nextDirection, currentDirection) {
    return nextDirection.x + currentDirection.x === 0 && nextDirection.y + currentDirection.y === 0;
  }

  function createInitialSnake(gridSize) {
    const mid = Math.floor(gridSize / 2);
    return [
      createCell(mid, mid),
      createCell(mid - 1, mid),
      createCell(mid - 2, mid),
    ];
  }

  function listEmptyCells(gridSize, snake) {
    const occupied = new Set(snake.map(serializeCell));
    const emptyCells = [];

    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const cell = createCell(x, y);
        if (!occupied.has(serializeCell(cell))) {
          emptyCells.push(cell);
        }
      }
    }

    return emptyCells;
  }

  function getRandomEmptyCell(gridSize, snake, randomFn) {
    const emptyCells = listEmptyCells(gridSize, snake);

    if (!emptyCells.length) {
      return null;
    }

    const randomIndex = Math.min(
      emptyCells.length - 1,
      Math.floor((randomFn || Math.random)() * emptyCells.length)
    );

    return cloneCell(emptyCells[randomIndex]);
  }

  function createGameState(options) {
    const settings = options || {};
    const gridSize = settings.gridSize || GRID_SIZE;
    const randomFn = settings.randomFn || Math.random;
    const snake = (settings.snake || createInitialSnake(gridSize)).map(cloneCell);
    const direction = getDirection(settings.direction || INITIAL_DIRECTION).name;
    const queuedDirection = getDirection(settings.queuedDirection || direction).name;
    const food = settings.food ? cloneCell(settings.food) : getRandomEmptyCell(gridSize, snake, randomFn);

    return {
      gridSize,
      snake,
      direction,
      queuedDirection,
      food,
      score: settings.score || 0,
      status: settings.status || 'ready',
      outcome: settings.outcome || null,
    };
  }

  function startGame(state) {
    if (state.status !== 'ready') {
      return state;
    }

    return {
      ...state,
      status: 'running',
      outcome: null,
    };
  }

  function queueDirection(state, nextDirectionName) {
    const nextDirection = getDirection(nextDirectionName);
    const currentDirection = getDirection(state.direction);

    if (
      state.status === 'gameover' ||
      (state.snake.length > 1 && isOppositeDirection(nextDirection, currentDirection))
    ) {
      return state;
    }

    return {
      ...state,
      queuedDirection: nextDirection.name,
    };
  }

  function togglePause(state) {
    if (state.status === 'running') {
      return { ...state, status: 'paused' };
    }

    if (state.status === 'paused') {
      return { ...state, status: 'running' };
    }

    return state;
  }

  function restartGame(options) {
    return createGameState(options);
  }

  function stepGame(state, options) {
    if (state.status !== 'running') {
      return state;
    }

    const randomFn = (options && options.randomFn) || Math.random;
    const direction = getDirection(state.queuedDirection || state.direction);
    const head = state.snake[0];
    const nextHead = createCell(head.x + direction.x, head.y + direction.y);
    const outsideGrid =
      nextHead.x < 0 ||
      nextHead.x >= state.gridSize ||
      nextHead.y < 0 ||
      nextHead.y >= state.gridSize;

    if (outsideGrid) {
      return {
        ...state,
        direction: direction.name,
        queuedDirection: direction.name,
        status: 'gameover',
        outcome: 'collision',
      };
    }

    const isGrowing = cellsEqual(nextHead, state.food);
    const collisionBody = isGrowing ? state.snake : state.snake.slice(0, -1);
    const hitsSelf = collisionBody.some(function (cell) {
      return cellsEqual(cell, nextHead);
    });

    if (hitsSelf) {
      return {
        ...state,
        direction: direction.name,
        queuedDirection: direction.name,
        status: 'gameover',
        outcome: 'collision',
      };
    }

    const nextSnake = [nextHead].concat(
      (isGrowing ? state.snake : state.snake.slice(0, -1)).map(cloneCell)
    );

    if (isGrowing) {
      const nextFood = getRandomEmptyCell(state.gridSize, nextSnake, randomFn);

      return {
        ...state,
        snake: nextSnake,
        direction: direction.name,
        queuedDirection: direction.name,
        food: nextFood,
        score: state.score + 1,
        status: nextFood ? 'running' : 'gameover',
        outcome: nextFood ? 'food' : 'cleared',
      };
    }

    return {
      ...state,
      snake: nextSnake,
      direction: direction.name,
      queuedDirection: direction.name,
      outcome: null,
    };
  }

  return {
    GRID_SIZE,
    DIRECTIONS,
    cellsEqual,
    createGameState,
    getRandomEmptyCell,
    queueDirection,
    restartGame,
    startGame,
    stepGame,
    togglePause,
  };
});
