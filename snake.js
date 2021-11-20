const debug = false;

const size = 32;
const squaresPerSecond = 6;
const speedUp = 1.01;
const boost = 1.5;
const autoBoost = 2;

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
  65: "automatic",
};

const directions = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/*
 * The grid of cells. We store the grid in a single array in column
 * major order.
 */
class Grid {
  constructor(dimension, initialValue) {
    this.dimension = dimension;
    this.cells = Array(dimension * dimension).fill(initialValue);
  }

  getCell(cell) {
    return this.cells[this.fromCell(cell)];
  }

  setCell(cell, value) {
    this.cells[this.fromCell(cell)] = value;
  }

  onGrid(cell) {
    let { x, y } = cell;
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

  toXY(i) {
    // Whoops. This is apparently column major order. Which works. But
    // was not what I meant to do.
    return { x: Math.floor(i / this.dimension), y: i % this.dimension };
  }

  fromXY(x, y) {
    return x * this.dimension + y;
  }

  fromCell(cell) {
    return this.fromXY(cell.x, cell.y);
  }

  isGrass(cell) {
    return this.getCell(cell) == grassColor;
  }

  isFood(cell) {
    return this.getCell(cell) == foodColor || this.isSuperFood(cell);
  }

  isSuperFood(cell) {
    return this.getCell(cell) == superFoodColor;
  }

  neighbors(i) {
    let { x, y } = this.toXY(i);
    let ns = [];
    if (x > 0) ns.push(i - this.dimension);
    if (x < this.dimension - 1) ns.push(i + this.dimension);
    if (y > 0) ns.push(i - 1);
    if (y < this.dimension - 1) ns.push(i + 1);
    return ns;
  }
}

/*
 * The snake itself. We use a circular buffer since we need to add at
 * one end and remove at the other. Could just use a regular array
 * with push and shift but shift is technically O(n).
 */
class Snake {
  constructor(dimension) {
    this.segments = Array(dimension * dimension).fill(null);
    this.head = 0;
    this.tail = 0;
    this.direction = { dx: 1, dy: 0 };
    this.turns = [];
  }

  getHead() {
    return this.segments[(this.head + this.segments.length - 1) % this.segments.length];
  }

  getTail() {
    return this.segments[this.tail];
  }

  map(fn) {
    for (let i = this.tail; i != this.head; i = (i + 1) % this.segments.length) {
      fn(this.segments[i]);
    }
  }

  getTailDirection() {
    let tail = this.getTail();
    let nextCell = this.segments[(this.tail + 1) % this.segments.length];
    return {
      dx: nextCell.x - tail.x,
      dy: nextCell.y - tail.y,
    };
  }

  length() {
    let max = this.segments.length;
    return (max + (this.head - this.tail)) % max;
  }

  nextPosition() {
    let head = this.getHead();
    let { dx, dy } = this.direction;
    return { x: head.x + dx, y: head.y + dy };
  }

  extend() {
    this.addAtHead(this.nextPosition());
  }

  addAtHead(cell) {
    this.segments[this.head] = cell;
    this.head = (this.head + 1) % this.segments.length;
  }

  removeTail() {
    this.tail = (this.tail + 1) % this.segments.length;
  }

  changeDirection(name) {
    this.turns.push(directions[name]);
  }

  applyNextTurn() {
    while (this.turns.length > 0) {
      let d = this.turns.shift();
      if (this.isLegalTurn(d)) {
        this.direction = d;
        return;
      }
    }
  }

  isLegalTurn(d) {
    // Can only turn left or right. In current direction one of dx and
    // dy will be zero before the turn and the opposite coordinate
    // will be zero after.
    let { dx, dy } = this.direction;
    return dx == d.dy || dy == d.dx;
  }
}

/*
 * Keep track of the score and update listeners when it changes.
 */
class Scorekeeper {
  constructor(ui) {
    this.ui = ui;
    this.score = 0;
    this.bonusPoints = 0;
    this.listeners = [];
  }

  incrementScore() {
    this.score += 1 + this.bonusPoints;
    this.ui.updateScore(this.score);
  }

  setBonusPoints(points) {
    this.bonusPoints = Math.max(0, points);
    this.ui.updateBonusPoints(this.bonusPoints);
  }

  decrementBonusPoints() {
    this.setBonusPoints(this.bonusPoints - 1);
  }
}

class Game {
  constructor(dimension, canvas, html, ui) {
    this.dimension = dimension;
    this.canvas = canvas;
    this.ui = ui;
    this.ctx = this.canvas.getContext("2d");
    this.running = false;
    html.onkeydown = this.handleKeyEvent.bind(this);
    this.reset();
  }

  reset() {
    this.snake = new Snake(this.dimension);
    this.grid = new Grid(this.dimension, grassColor);
    this.running = false;
    this.scorekeeper = new Scorekeeper(this.ui);
    this.enteredSquare = undefined;
    this.isEating = false;
    this.speedUp = 1;
    this.boosted = false;
    this.squaresPerSecond = squaresPerSecond;
    this.speedUp = speedUp;
    this.automatic = false;

    let mid = this.dimension / 2 - 1;
    this.ctx.fillStyle = grassColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.placeSnake(mid, mid, "right", 2);
    this.foodCell = this.addRandomFood();
  }

  toggleAutomatic() {
    if (this.automatic) {
      this.automatic = false;
      this.squaresPerSecond /= autoBoost;
    } else {
      this.automatic = true;
      this.squaresPerSecond *= autoBoost;
    }
  }

  start() {
    this.running = true;
    animate((ts) => this.update(ts));
  }

  handleKeyEvent(e) {
    const key = keys[e.keyCode];
    if (key == "space") {
      this.start();
    } else if (key == "rerun") {
      this.reset();
    } else if (key == "automatic") {
      this.toggleAutomatic();
    } else if (key in directions) {
      if (!this.automatic) {
        this.snake.changeDirection(key);
      }
    } else {
      console.log(e.keyCode);
    }
  }

  enterSquare(cell, timestamp, isFood) {
    this.enteredSquare = timestamp;
    this.isEating = isFood;
    this.snake.addAtHead(cell);
    this.grid.setCell(cell, snakeColor); // Set this even though we will fill it in in bits.
  }

  placeSnake(x, y, direction, length) {
    this.snake.addAtHead({ x: x, y: y });
    this.snake.changeDirection(direction);
    this.snake.applyNextTurn();
    for (let i = 0; i < length - 1; i++) {
      this.snake.extend();
    }
    this.snake.map((cell) => this.drawCell(cell, snakeColor));
  }

  removeTail() {
    this.drawCell(this.snake.getTail(), grassColor);
    this.snake.removeTail();
  }

  drawCell(cell, color) {
    this.grid.setCell(cell, color);
    this.ctx.fillStyle = grassColor;
    this.ctx.fillRect(cell.x * size, cell.y * size, size, size);
    if (color !== grassColor) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(cell.x * size + 1, cell.y * size + 1, size - 2, size - 2);
    }
  }

  drawPartialHead(proportion) {
    this.partialFill(this.snake.getHead(), this.snake.direction, proportion, snakeColor);
  }

  erasePartialTail(proportion) {
    let tail = this.snake.getTail();
    let direction = this.snake.getTailDirection();
    this.partialFill(tail, direction, proportion, grassColor);
  }

  ok(cell) {
    return this.grid.onGrid(cell) && (this.grid.isGrass(cell) || this.grid.isFood(cell));
  }

  update(timestamp) {
    // Handle one animation frame. Most of the time this is just
    // filling in the current head and erasing the current tail.
    // However once we've completely filled the head, we call
    // updateHead to handle turning, detect crashes, etc.
    if (!this.running) {
      return false;
    } else {
      if (this.enteredSquare === undefined) {
        return this.updateHead(timestamp);
      } else {
        let timeInSquare = timestamp - this.enteredSquare;
        let proportion = (timeInSquare * this.squaresPerSecond) / 1000;
        if (proportion >= 1) {
          // We have completely filled in the head.
          this.drawCell(this.snake.getHead(), snakeColor);
          if (!this.isEating) {
            this.removeTail();
          }
          if (this.automatic) {
            let m = move(this.grid, this.snake, this.foodCell);
            if (m !== null) {
              this.snake.turns.push(m);
            }
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
    }
  }

  updateHead(timestamp) {
    // Called when we are entering a new cell. Figure out the next
    // position and add it as the head but don't fill it in
    // immediately. Instead update() will progressively fill it in.
    // When it is completely filled in then this method will be called
    // again to get the next head position.

    this.snake.applyNextTurn();
    this.scorekeeper.decrementBonusPoints();

    let next = this.snake.nextPosition();

    if (this.ok(next)) {
      // Check if it's food before we enter the square but wait to place
      // the new random food so the snake is at its new length.
      let nextIsFood = this.grid.isFood(next);
      let nextIsSuperfood = this.grid.isSuperFood(next);

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
        // We're eating the food in the square we're entering so add
        // more food elsewhere.
        this.foodCell = this.addRandomFood();
      }
      return true;
    } else {
      return false;
    }
  }

  addRandomFood() {
    let cell = this.grid.randomCell(grassColor);
    if (cell) {
      let color = !this.boosted && Math.random() < 0.1 ? superFoodColor : foodColor;
      this.drawCell(cell, color);

      let h = this.snake.getHead();
      let dist = manhattanDistance(cell.x, cell.y, h.x, h.y);
      let bonus = color == foodColor ? 20 : 60;
      this.scorekeeper.setBonusPoints(dist + bonus);
      return cell;
    }
    return null;
  }

  partialFill(cell, direction, proportion, color) {
    let x = cell.x * size + 1;
    let y = cell.y * size + 1;
    let width = size - 2;
    let height = size - 2;

    if (direction.dx != 0) {
      width *= proportion;
      if (direction.dx == -1) {
        x += (size - 2) * (1 - proportion);
      }
    } else if (direction.dy != 0) {
      height *= proportion;
      if (direction.dy == -1) {
        y += (size - 2) * (1 - proportion);
      }
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
  }
}

class UI {
  updateScore(score) {
    document.getElementById("score").innerText = nDigits(score, 4);
  }
  updateBonusPoints(points) {
    document.getElementById("bonus").innerText = nDigits(points, 3);
  }
}

/*
 * Robot mover
 */
function move(grid, snake, food) {
  let head = snake.getHead();
  let tail = snake.getTail();
  let next = snake.nextPosition();

  let tailGradient = gradient(grid, tail.x, tail.y);
  let foodGradient = gradient(grid, food.x, food.y);

  function better(n, current) {
    if (current == null || tailGradient[current] === Infinity) {
      return true;
    } else if (tailGradient[n] === Infinity) {
      return false;
    } else if (foodGradient[n] < foodGradient[current]) {
      return true;
    } else if (foodGradient[n] == foodGradient[current]) {
      return tailGradient[n] > tailGradient[current];
    } else {
      return false;
    }
  }

  // Default to continuing in the current direction and then see if we
  // can find something better.
  let nextIndex = grid.fromCell(next);
  let choice = grid.onGrid(next) ? nextIndex : null;
  for (let n of grid.neighbors(grid.fromCell(head))) {
    if (grid.cells[n] !== snakeColor) {
      if (better(n, choice)) {
        choice = n;
      }
    }
  }

  if (choice == nextIndex || choice == null) {
    return null;
  } else {
    let { x, y } = grid.toXY(choice);
    return {
      dx: toward(x, head.x),
      dy: toward(y, head.y),
    };
  }
}

function gradient(grid, x, y) {
  let g = Array(grid.cells.length).fill(Infinity);

  let stack = [];
  let seen = new Set();
  let i = grid.fromXY(x, y);

  stack.push({ i: i, d: 0 });
  seen.add(i);

  while (stack.length > 0) {
    let { i, d } = stack.shift();
    g[i] = d;
    for (let n of grid.neighbors(i)) {
      if (!seen.has(n) && grid.cells[n] !== snakeColor) {
        stack.push({ i: n, d: d + 1 });
        seen.add(n);
      }
    }
  }
  return g;
}

function toward(a, b) {
  return a === b ? 0 : a > b ? 1 : -1;
}

function manhattanDistance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function nDigits(num, n) {
  let numStr = "" + num;
  return (
    Array(Math.max(0, n - numStr.length))
      .fill(0)
      .join("") + numStr
  );
}

function animate(update) {
  const step = (timestamp) => {
    if (update(timestamp)) {
      requestAnimationFrame(step);
    } else {
      if (debug) {
        game.drawCell(game.snake.getHead(), "black");
        game.drawCell(game.snake.getTail(), "white");
      }
    }
  };
  requestAnimationFrame(step);
}

// Stash this is the global object so we can inspect it in the console
// REPL.
var game;

function init() {
  let canvas = document.getElementById("screen");
  let html = document.getElementsByTagName("html")[0];
  let gridSize = Math.floor(canvas.width / size);
  game = new Game(gridSize, canvas, html, new UI());
}

window.onload = () => init();
