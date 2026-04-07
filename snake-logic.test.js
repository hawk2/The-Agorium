const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createGameState,
  getRandomEmptyCell,
  queueDirection,
  stepGame,
  togglePause,
} = require('./snake-logic.js');

function createRunningState(overrides) {
  return createGameState({
    gridSize: 6,
    status: 'running',
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: 'right',
    queuedDirection: 'right',
    food: { x: 5, y: 5 },
    ...overrides,
  });
}

test('stepGame moves the snake one cell in the queued direction', function () {
  const state = createRunningState();
  const nextState = stepGame(state, { randomFn: () => 0 });

  assert.deepEqual(nextState.snake, [
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ]);
  assert.equal(nextState.score, 0);
  assert.equal(nextState.status, 'running');
});

test('stepGame grows the snake and increments score after eating food', function () {
  const state = createRunningState({
    food: { x: 3, y: 2 },
  });
  const nextState = stepGame(state, { randomFn: () => 0 });

  assert.deepEqual(nextState.snake, [
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
    { x: 0, y: 2 },
  ]);
  assert.equal(nextState.score, 1);
  assert.notDeepEqual(nextState.food, { x: 3, y: 2 });
  assert.equal(nextState.status, 'running');
});

test('stepGame ends the game when the snake hits a wall', function () {
  const state = createRunningState({
    snake: [
      { x: 5, y: 2 },
      { x: 4, y: 2 },
      { x: 3, y: 2 },
    ],
  });
  const nextState = stepGame(state, { randomFn: () => 0 });

  assert.equal(nextState.status, 'gameover');
  assert.equal(nextState.outcome, 'collision');
});

test('stepGame ends the game when the snake hits its body', function () {
  const state = createRunningState({
    snake: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    direction: 'up',
    queuedDirection: 'up',
  });
  const nextState = stepGame(state, { randomFn: () => 0 });

  assert.equal(nextState.status, 'gameover');
  assert.equal(nextState.outcome, 'collision');
});

test('queueDirection rejects direct reversal', function () {
  const state = createRunningState();
  const nextState = queueDirection(state, 'left');

  assert.equal(nextState.queuedDirection, 'right');
});

test('getRandomEmptyCell only returns unoccupied cells', function () {
  const food = getRandomEmptyCell(4, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ], () => 0);

  assert.deepEqual(food, { x: 3, y: 0 });
});

test('togglePause switches between running and paused', function () {
  const paused = togglePause(createRunningState());
  const resumed = togglePause(paused);

  assert.equal(paused.status, 'paused');
  assert.equal(resumed.status, 'running');
});
