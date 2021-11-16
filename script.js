const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");
const html = document.getElementsByTagName("html")[0];

const size = 16;
const grid = Math.floor(canvas.width / size);

const grassColor = "green";
const snakeColor = "purple";
const foodColor = "red";

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

function Snake(dimension) {
  this.dimension = dimension;
  this.grid = Array(dimension * dimension).fill(grassColor);
  this.segments = Array(dimension * dimension).fill(null);
  this.head = 0;
  this.tail = 0;
  this.dx = 0;
  this.dy = 0;
  this.turns = [];
  this.listeners = [];
  this.enteredSquare = undefined;
  this.isEating = false;
  this.speedUp = 1;
}

Snake.prototype.get = function (cell) {
  return this.grid[cell.x * this.dimension + cell.y];
};

Snake.prototype.set = function (cell, value) {
  this.grid[cell.x * this.dimension + cell.y] = value;
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

  if (direction.dx == 1) {
    // Moving right.
    width *= proportion;
  } else if (direction.dx == -1) {
    // Moving left
    x += size * (1 - proportion);
    width *= proportion;
  } else if (direction.dy == 1) {
    // Moving down.
    height *= proportion;
  } else if (direction.dy == -1) {
    // Moving up.
    y += size * (1 - proportion);
    height *= proportion;
  }

  //console.log(`Filling x: ${x}; y: ${y}; width: ${width}; height: ${height}; proportion: ${proportion}`);

  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

Snake.prototype.ok = function (cell) {
  let xOk = 0 <= cell.x && cell.x < this.dimension;
  let yOk = 0 <= cell.y && cell.y < this.dimension;
  return (xOk && yOk && this.get(cell) == grassColor) || this.get(cell) == foodColor;
};

Snake.prototype.isFood = function (cell) {
  return this.get(cell) == foodColor;
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

  let next = this.nextPosition();

  if (this.ok(next)) {
    // Have to check if it's food before we draw the new head. But we
    // want to draw the new head before we place the new random food
    // so the snake is at its new length.
    let nextIsFood = this.isFood(next);

    this.enterSquare(next, timestamp, nextIsFood);

    if (nextIsFood) {
      // I.e. we're eating the food in the next square. Go ahead and
      // add some new food elsewhere.
      this.addRandomFood();
      this.updateScore();
      this.squaresPerSecond *= this.speedUp;
    }
    return true;
  } else {
    return false;
  }
};

Snake.prototype.update = function () {
  if (this.turns.length > 0) {
    this.applyTurn(this.turns.shift());
  }

  let next = this.nextPosition();

  if (this.ok(next)) {
    // Have to check if it's food before we draw the new head. But we
    // want to draw the new head before we place the new random food
    // so the snake is at its new length.
    let wasFood = this.isFood(next);

    this.addAtHead(next);
    if (!wasFood) {
      this.removeTail();
    } else {
      this.addRandomFood();
      this.updateScore();
    }
    return true;
  } else {
    return false;
  }
};

Snake.prototype.addScoreListener = function (fn) {
  this.listeners.push(fn);
  this.updateScore();
};

Snake.prototype.updateScore = function () {
  for (let fn of this.listeners) {
    fn(this.length() - 2);
  }
};

Snake.prototype.addRandomFood = function () {
  let max = this.grid.length - this.length();
  let n = Math.floor(Math.random() * max);
  for (let i = 0; i < this.grid.length; i++) {
    if (this.grid[i] == grassColor) {
      n--;
    }
    if (n == 0) {
      let x = Math.floor(i / this.dimension);
      let y = i % this.dimension;
      this.drawCell(pos(x, y), foodColor);
      break;
    }
  }
};

function init() {
  ctx.fillStyle = grassColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let snake = new Snake(grid);
  snake.dx = 1;
  snake.squaresPerSecond = 10;
  snake.speedUp = 1.05;
  snake.addAtHead(pos(grid / 2 - 1, grid / 2 - 1), true);
  snake.addAtHead(snake.nextPosition(), true);
  snake.addRandomFood();

  html.onkeydown = directionChanger(snake);

  snake.addScoreListener((s) => {
    document.getElementById("score").innerText = nDigits(s, 4);
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
  //animate(() => snake.update(), 10);
  animate((ts) => snake.animate(ts));
}

/*
function animate(update, fps) {
  let nextFrame;
  const oneFrame = (timestamp) => {
    if (nextFrame === undefined) {
      nextFrame = timestamp;
    }
    if (timestamp >= nextFrame) {
      nextFrame = nextFrame + 1000 / fps;
      if (update()) {
        requestAnimationFrame(oneFrame);
      }
    } else {
      requestAnimationFrame(oneFrame);
    }
  };
  requestAnimationFrame(oneFrame);
}
*/

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
