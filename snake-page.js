(function () {
  const logic = window.SnakeGameLogic;

  if (!logic) {
    return;
  }

  const GRID_SIZE = 16;
  const TICK_MS = 150;
  const directionKeys = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    W: 'up',
    a: 'left',
    A: 'left',
    s: 'down',
    S: 'down',
    d: 'right',
    D: 'right',
  };

  const board = document.getElementById('game-board');
  const scoreValue = document.getElementById('score-value');
  const statusValue = document.getElementById('status-value');
  const helperText = document.getElementById('helper-text');
  const startButton = document.getElementById('start-button');
  const restartButton = document.getElementById('restart-button');
  const pauseButton = document.getElementById('pause-button');
  const controlButtons = Array.from(document.querySelectorAll('[data-direction]'));
  const randomFn = Math.random;
  const cellElements = [];
  let state = logic.createGameState({ gridSize: GRID_SIZE, randomFn });

  function getCellIndex(cell) {
    if (!cell) {
      return -1;
    }

    return cell.y * state.gridSize + cell.x;
  }

  function buildBoard() {
    board.innerHTML = '';
    board.style.setProperty('--grid-size', String(state.gridSize));
    cellElements.length = 0;

    for (let i = 0; i < state.gridSize * state.gridSize; i += 1) {
      const cell = document.createElement('div');
      cell.className = 'board-cell';
      cell.setAttribute('aria-hidden', 'true');
      board.appendChild(cell);
      cellElements.push(cell);
    }
  }

  function getStatusLabel() {
    if (state.status === 'ready') {
      return 'Ready';
    }

    if (state.status === 'paused') {
      return 'Paused';
    }

    if (state.status === 'gameover') {
      return state.outcome === 'cleared' ? 'Cleared' : 'Game Over';
    }

    return 'Running';
  }

  function getHelperText() {
    if (state.status === 'ready') {
      return 'Press Start or use the arrow keys / WASD to begin.';
    }

    if (state.status === 'paused') {
      return 'Paused. Press Space, P, or Resume to continue.';
    }

    if (state.status === 'gameover') {
      return state.outcome === 'cleared'
        ? 'You filled the board. Restart to play again.'
        : 'You hit a wall or yourself. Restart to play again.';
    }

    return 'Eat the red square. Avoid the walls and your own body.';
  }

  function renderBoard() {
    const snakeIndexes = new Set(state.snake.map(getCellIndex));
    const headIndex = getCellIndex(state.snake[0]);
    const foodIndex = getCellIndex(state.food);

    cellElements.forEach(function (cell, index) {
      cell.className = 'board-cell';

      if (snakeIndexes.has(index)) {
        cell.classList.add('is-snake');
      }

      if (index === headIndex) {
        cell.classList.add('is-head');
      }

      if (index === foodIndex) {
        cell.classList.add('is-food');
      }
    });
  }

  function renderControls() {
    startButton.disabled = state.status !== 'ready';
    restartButton.disabled = state.status === 'ready';
    pauseButton.disabled = state.status === 'ready' || state.status === 'gameover';
    pauseButton.textContent = state.status === 'paused' ? 'Resume' : 'Pause';
  }

  function render() {
    scoreValue.textContent = String(state.score);
    statusValue.textContent = getStatusLabel();
    helperText.textContent = getHelperText();
    renderBoard();
    renderControls();
  }

  function beginGame() {
    state = logic.startGame(state);
    render();
  }

  function handleDirectionInput(direction) {
    if (state.status === 'gameover') {
      return;
    }

    state = logic.queueDirection(state, direction);

    if (state.status === 'ready') {
      state = logic.startGame(state);
    }

    render();
  }

  function restart() {
    state = logic.restartGame({ gridSize: GRID_SIZE, randomFn });
    render();
  }

  function togglePause() {
    state = logic.togglePause(state);
    render();
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'p' || event.key === 'P') {
      if (state.status === 'running' || state.status === 'paused') {
        event.preventDefault();
        togglePause();
      }
      return;
    }

    const direction = directionKeys[event.key];
    if (!direction) {
      return;
    }

    event.preventDefault();
    handleDirectionInput(direction);
  });

  controlButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      handleDirectionInput(button.dataset.direction);
    });
  });

  startButton.addEventListener('click', beginGame);
  restartButton.addEventListener('click', restart);
  pauseButton.addEventListener('click', togglePause);

  window.setInterval(function () {
    const nextState = logic.stepGame(state, { randomFn });
    if (nextState !== state) {
      state = nextState;
      render();
    }
  }, TICK_MS);

  buildBoard();
  render();
})();
