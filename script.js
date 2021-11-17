const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");
const html = document.getElementsByTagName("html")[0];

const size = 16;
const squaresPerSecond = 10;
const speedUp = 1.025;
const boost = 1.5;

const grid = Math.floor(canvas.width / size);

const grassColor = "green";
const snakeColor = "purple";
const foodColor = "red";
const superFoodColor = "orange";

const keys = {
  38: "up",
  40: "down",
  37: "left",
  39: "right",
  32: "space",
  82: "rerun",
};

const directions = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

function pos(x, y) {
  return { x: x, y: y };
}

/*
 * The grid of cells.
 */
class Grid {
  constructor(dimension, initialValue) {
    this.dimension = dimension;
    this.cells = Array(dimension * dimension).fill(initialValue);
  }

  get(x, y) {
    return this.cells[x * this.dimension + y];
  }

  set(x, y, value) {
    this.cells[x * this.dimension + y] = value;
  }

  onGrid(x, y) {
    return 0 <= x && x < this.dimension && 0 <= y && y < this.dimension;
  }

  count(value) {
    let c = 0;
    for (let color of this.cells) {
      if (color == value) {
        c++;
      }
    }
    return c;
  }

  toXY(i) {
    let x = Math.floor(i / this.dimension);
    let y = i % this.dimension;
    return { x: x, y: y };
  }

  randomCell(value) {
    if (this.count(value) > 0) {
      while (true) {
        let i = Math.floor(Math.random() * this.cells.length);
        if (this.cells[i] == value) {
          return this.toXY(i);
        }
      }
    }
  }

  isGrass(x, y) {
    return this.get(x, y) == grassColor;
  }

  isFood(x, y) {
    return this.get(x, y) == foodColor || this.isSuperFood(x, y);
  }

  isSuperFood(x, y) {
    return this.get(x, y) == superFoodColor;
  }
}

/*
 * Keep track of the score and update listeners when it changes.
 */
class Scorekeeper {

  constructor() {
    this.score = 0;
    this.bonusPoints = 0;
    this.listeners = [];
  }

  addListener(listener) {
    this.listeners.push(listener);
    this.postScore(listener);
    this.postBonusPoints(listener);
  }

  incrementScore() {
    this.score += 1 + this.bonusPoints;
    for (let listener of this.listeners) {
      this.postScore(listener);
    }
  }

  setBonusPoints(points) {
    this.bonusPoints = Math.max(0, points);
    for (let listener of this.listeners) {
      this.postBonusPoints(listener);
    }
  }

  decrementBonusPoints() {
    this.setBonusPoints(this.bonusPoints - 1);
  }

  postScore(listener) {
    listener.updateScore(this.score);
  }

  postBonusPoints(listener) {
    listener.updateBonusPoints(this.score);
  }
}


function Snake(dimension) {
  this.grid = new Grid(dimension, grassColor);
  this.segments = Array(dimension * dimension).fill(null);
  this.head = 0;
  this.tail = 0;
  this.dx = 0;
  this.dy = 0;
  this.turns = [];
  this.enteredSquare = undefined;
  this.isEating = false;
  this.speedUp = 1;
  this.scorekeeper = new Scorekeeper();
  this.boosted = false;
}

Snake.prototype.get = function (cell) {
  return this.grid.get(cell.x, cell.y);
};

Snake.prototype.set = function (cell, value) {
  this.grid.set(cell.x, cell.y, value);
};

Snake.prototype.nextPosition = function () {
  let head = this.getHead();
  return pos(head.x + this.dx, head.y + this.dy);
};

Snake.prototype.getHead = function () {
  return this.segments[(this.head + this.segments.length - 1) % this.segments.length];
};

Snake.prototype.getTail = function () {
  return this.segments[this.tail];
};

Snake.prototype.enterSquare = function (cell, timestamp, isFood) {
  this.enteredSquare = timestamp;
  this.isEating = isFood;
  this.addAtHead(cell);
};

Snake.prototype.addAtHead = function (cell, draw) {
  this.segments[this.head] = cell;
  this.head = (this.head + 1) % this.segments.length;
  if (draw) {
    this.drawCell(cell, snakeColor);
  } else {
    this.set(cell, snakeColor); // Set this even though we will fill it in in bits.
  }
};

Snake.prototype.removeTail = function () {
  this.drawCell(this.segments[this.tail], grassColor);
  this.tail = (this.tail + 1) % this.segments.length;
};

Snake.prototype.length = function () {
  let max = this.segments.length;
  return (max + (this.head - this.tail)) % max;
};

Snake.prototype.changeDirection = function (name) {
  this.turns.push(directions[name]);
};

Snake.prototype.applyTurn = function (d) {
  if (!this.isReversal(d)) {
    this.dx = d.dx;
    this.dy = d.dy;
  }
};

Snake.prototype.isReversal = function (d) {
  return this.dx * -1 == d.dx && this.dy * -1 == d.dy;
};

Snake.prototype.drawCell = function (cell, color) {
  this.set(cell, color);
  ctx.fillStyle = color;
  ctx.fillRect(cell.x * size, cell.y * size, size, size);
};

Snake.prototype.drawPartialHead = function (proportion) {
  partialFill(this.getHead(), this, proportion, snakeColor);
};

Snake.prototype.erasePartialTail = function (proportion) {
  let tail = this.getTail();
  let nextCell = this.segments[(this.tail + 1) % this.segments.length];

  let direction = {
    dx: nextCell.x - tail.x,
    dy: nextCell.y - tail.y,
  };

  partialFill(tail, direction, proportion, grassColor);
};

function partialFill(cell, direction, proportion, color) {
  let x = cell.x * size;
  let y = cell.y * size;
  let width = size;
  let height = size;

  if (direction.dx != 0) {
    width *= proportion;
    if (direction.dx == -1) {
      x += size * (1 - proportion);
    }
  } else if (direction.dy != 0) {
    height *= proportion;
    if (direction.dy == -1) {
      y += size * (1 - proportion);
    }
  }

  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

Snake.prototype.ok = function (cell) {
  let { x, y } = cell;
  return this.grid.onGrid(x, y) && (this.grid.isGrass(x, y) || this.grid.isFood(x, y));
};

Snake.prototype.animate = function (timestamp) {
  // When we completely fill a cell, then we check the next position
  // to see if we're crashing into something. If not, then we check to
  // see if we're going to be eating food.
  // Fill in the next position in proportion to the number of
  // milliseconds that have passed since we entered this cell. The big
  // update happens exactly when we have filled the cell.
  //
  // Similarly, unfill the tail segment unless we are in the process
  // of consuming food.
  //
  // Need to fill the cell in the direction we are moving.
  //
  // To unfill the tail we need to figure out the correct direction,
  // namely toward the next segment.

  if (this.enteredSquare === undefined) {
    return this.updateHead(timestamp);
  } else {
    let timeInSquare = timestamp - this.enteredSquare;
    let proportion = (timeInSquare * this.squaresPerSecond) / 1000;
    if (proportion >= 1) {
      // We have completely filled in the head.
      this.drawCell(this.getHead(), snakeColor);
      if (!this.isEating) {
        this.removeTail();
      }
      return this.updateHead(timestamp);
    } else {
      this.drawPartialHead(proportion);
      if (!this.isEating) {
        this.erasePartialTail(proportion);
      }
      return true;
    }
  }
};

Snake.prototype.updateHead = function (timestamp) {
  // Called when we have completely filled the current cell. Figure
  // out the next position and add it as the head but don't fill it in
  // immediately. Instead animate() will progressively fill it in.
  // When it is filled in then animate will call this function again
  // to get the next head position after applying the next queued
  // turn. This method still returns false if we crash and animate
  // needs to propagate that out

  if (this.turns.length > 0) {
    this.applyTurn(this.turns.shift());
  }
  this.scorekeeper.decrementBonusPoints();

  let next = this.nextPosition();

  if (this.ok(next)) {
    // Check if it's food before we enter the square but wait to place
    // the new random food so the snake is at its new length.
    let nextIsFood = this.grid.isFood(next.x, next.y);
    let nextIsSuperfood = this.grid.isSuperFood(next.x, next.y);

    this.enterSquare(next, timestamp, nextIsFood);

    if (nextIsFood) {
      if (nextIsSuperfood) {
        this.boosted = true;
        this.squaresPerSecond *= boost;
      } else if (nextIsFood && this.boosted) {
        this.boosted = false;
        this.squaresPerSecond /= boost;
      }
      this.scorekeeper.incrementScore();
      this.squaresPerSecond *= this.speedUp;

      // I.e. we're eating the food in the next square. Go ahead and
      // add some new food elsewhere.
      this.addRandomFood();
    }
    return true;
  } else {
    return false;
  }
};

Snake.prototype.addScoreListener = function (listener) {
  this.scorekeeper.addListener(listener);
};

Snake.prototype.addRandomFood = function () {
  let cell = this.grid.randomCell(grassColor);
  this.drawCell(cell, !this.boosted && Math.random() < 0.1 ? superFoodColor : foodColor);

  let h = this.getHead();
  this.scorekeeper.setBonusPoints(manhattanDistance(cell.x, cell.y, h.x, h.y) + 20);
};

function manhattanDistance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function init() {
  ctx.fillStyle = grassColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let snake = new Snake(grid);
  snake.dx = 1;
  snake.squaresPerSecond = squaresPerSecond;
  snake.speedUp = speedUp;
  snake.addAtHead(pos(grid / 2 - 1, grid / 2 - 1), true);
  snake.addAtHead(snake.nextPosition(), true);
  snake.addRandomFood();

  html.onkeydown = directionChanger(snake);

  snake.addScoreListener({
    updateScore: function (score) {
      document.getElementById("score").innerText = nDigits(score, 4);
    },
    updateBonusPoints: function (points) {
      document.getElementById("bonus").innerText = nDigits(points, 3);
    }
  });

  return snake;
}

function nDigits(num, n) {
  let numStr = "" + num;
  return (
    Array(Math.max(0, n - numStr.length))
      .fill(0)
      .join("") + numStr
  );
}

function start(snake) {
  animate((ts) => snake.animate(ts));
}

function animate(update) {
  const step = (timestamp) => {
    if (update(timestamp)) {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

function directionChanger(snake) {
  return (e) => {
    if (e.keyCode in keys) {
      const key = keys[e.keyCode];
      if (key == "space") {
        start(snake);
      } else if (key == "rerun") {
        snake = init();
      } else {
        snake.changeDirection(key);
      }
    } else {
      console.log(e.keyCode);
    }
  };
}

window.onload = () => init();
