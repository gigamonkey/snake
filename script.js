const canvas = document.getElementById("screen");
const ctx = canvas.getContext('2d');
const html = document.getElementsByTagName("html")[0];

const size = 16;
const grid = Math.floor(canvas.width / size);

const grassColor = 'green';
const snakeColor = 'purple';
const foodColor = 'red';

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
}

Snake.prototype.get = function (cell) {
  return this.grid[cell.x * this.dimension + cell.y];
};

Snake.prototype.set = function (cell, value) {
  this.grid[cell.x * this.dimension + cell.y] = value;
};

Snake.prototype.nextPosition = function () {
  let cell = this.segments[(this.head + this.segments.length - 1) % this.segments.length];
  return pos(cell.x + this.dx, cell.y + this.dy);
};

Snake.prototype.addAtHead = function (cell) {
  this.segments[this.head] = cell;
  this.head = (this.head + 1) % this.segments.length;
  this.drawCell(cell, snakeColor);
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
  return this.dx != 0 && this.dx == d.dx * -1 || this.dy != 0 && this.dy == d.dy * -1;
}

Snake.prototype.drawCell = function (cell, color) {
  this.set(cell, color);
  ctx.fillStyle = color;
  ctx.fillRect(cell.x * size, cell.y * size, size, size)
};

Snake.prototype.ok = function (cell) {
  let xOk = 0 <= cell.x && cell.x < this.dimension;
  let yOk = 0 <= cell.y && cell.y < this.dimension
  if (xOk && yOk) {
    return this.get(cell) == grassColor || this.get(cell) == foodColor;
  } else {
    return false;
  }
};

Snake.prototype.food = function (cell) {
  return this.get(cell) == foodColor;
};



Snake.prototype.update = function () {
  if (this.turns.length > 0) {
    this.applyTurn(this.turns.shift())
  }
  let next = this.nextPosition();
  if (this.ok(next)) {
    if (!this.food(next)) {
      this.removeTail();
    } else {
      this.addFood();
    }
    this.addAtHead(next);
    return true;
  } else {
    // game over.
    return false;
  }
};

Snake.prototype.addFood = function () {
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
  snake.addAtHead(pos(grid / 2 - 1, grid / 2 - 1));
  snake.addAtHead(snake.nextPosition())
  snake.addFood();

  html.onkeydown = directionChanger(snake);
}

function start(snake) {
  animate(() => snake.update(), 10);
}

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

const keys = {
  38: "up",
  40: "down",
  37: "left",
  39: "right",
  32: "space",
};

function directionChanger(snake) {
  return (e) => {
    if (e.keyCode in keys) {
      const key = keys[e.keyCode];
      if (key == "space") {
        start(snake);
      } else {
        snake.changeDirection(key);
      }
    } else {
      console.log(e.keyCode);
    }
  }
}

window.onload = (e) => init();