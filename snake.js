const size = 16;
const squaresPerSecond = 10;
const speedUp = 1.025;
const boost = 1.5;
const autoBoost = 5;

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
 * The grid of cells.
 */
class Grid {
  constructor(dimension, initialValue) {
    this.dimension = dimension;
    this.cells = Array(dimension * dimension).fill(initialValue);
  }

  // Whoops. This is apparently column major order. Which works. But was not what I meant.
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
    return { x: Math.floor(i / this.dimension), y: i % this.dimension };
  }

  fromXY(cell) {
    return cell.x * this.dimension + cell.y;
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

  xneighbors(i) {
    let ns = [];
    let [x, y] = [Math.floor(i / this.dimension), this.dimension];

    if (x > 0) ns.push(i - this.dimension);
    if (x < this.dimension - 1) ns.push(i + this.dimension);
    if (y > 0) ns.push(i - 1);
    if (y < this.dimension - 1) ns.push(i + 1);
    return ns;
  }

  neighbors(i) {
    let ns = [];
    let { x, y } = this.toXY(i);

    if (x > 0) ns.push({ x: x - 1, y: y });
    if (x < this.dimension - 1) ns.push({ x: x + 1, y: y });
    if (y > 0) ns.push({ x: x, y: y - 1 });
    if (y < this.dimension - 1) ns.push({ x: x, y: y + 1 });

    return ns.map((d) => this.fromXY(d));
  }
}

/*
 * The snake itself.
 */
class Snake {
  constructor(dimension) {
    this.segments = Array(dimension * dimension).fill(null);
    this.head = 0;
    this.tail = 0;
    this.dx = 1;
    this.dy = 0;
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

  direction() {
    return { dx: this.dx, dy: this.dy };
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
    return { x: head.x + this.dx, y: head.y + this.dy };
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
        //console.log("Applying turn " + JSON.stringify(d) + " at " + JSON.stringify(this.getHead()) + " remaining turns: " + JSON.stringify(this.turns));
        this.dx = d.dx;
        this.dy = d.dy;
        return;
      }
    }
  }

  isLegalTurn(d) {
    // Can only turn left or right. In current direction one of dx and
    // dy will be zero before the turn and the opposite coordinate
    // will be zero after.
    return this.dx == d.dy || this.dy == d.dx;
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
    this.ai = new AI(this.grid, this.snake);
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
      this.snake.changeDirection(key);
    } else {
      console.log(e.keyCode);
    }
  }

  enterSquare(cell, timestamp, isFood) {
    this.enteredSquare = timestamp;
    this.isEating = isFood;
    this.snake.addAtHead(cell);
    this.grid.set(cell.x, cell.y, snakeColor); // Set this even though we will fill it in in bits.
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
    this.grid.set(cell.x, cell.y, color);
    this.ctx.fillStyle = grassColor;
    this.ctx.fillRect(cell.x * size, cell.y * size, size, size);
    if (color !== grassColor) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(cell.x * size + 1, cell.y * size + 1, size - 2, size - 2);
    }
  }

  drawPartialHead(proportion) {
    this.partialFill(this.snake.getHead(), this.snake, proportion, snakeColor);
  }

  erasePartialTail(proportion) {
    let tail = this.snake.getTail();
    let direction = this.snake.getTailDirection();
    this.partialFill(tail, direction, proportion, grassColor);
  }

  ok(cell) {
    let { x, y } = cell;
    return this.grid.onGrid(x, y) && (this.grid.isGrass(x, y) || this.grid.isFood(x, y));
  }

  update(timestamp) {
    if (!this.running) return false;
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
        this.drawCell(this.snake.getHead(), snakeColor);
        if (!this.isEating) {
          this.removeTail();
        }
        if (this.automatic) {
          let move = this.ai.move(this.foodCell);
          if (move !== null) {
            this.snake.turns.push(move);
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

  updateHead(timestamp) {
    // Called when we have completely filled the current cell. Figure
    // out the next position and add it as the head but don't fill it in
    // immediately. Instead update() will progressively fill it in.
    // When it is filled in then update will call this function again
    // to get the next head position after applying the next queued
    // turn. This method still returns false if we crash and update
    // needs to propagate that out

    //console.log("updateHead (" + timestamp + ") " + JSON.stringify(this.snake.turns));

    this.snake.applyNextTurn();
    this.scorekeeper.decrementBonusPoints();

    let next = this.snake.nextPosition();

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

function j(x) {
  return JSON.stringify(x);
}

class AI {
  constructor(grid, snake) {
    this.grid = grid;
    this.snake = snake;
  }

  cellOk(cell, tailSet, foodCell) {
    return (
      this.grid.onGrid(cell.x, cell.y) &&
      (tailSet.has(this.grid.fromXY(cell)) || (cell.x == foodCell.x && cell.y == foodCell.y))
    );
  }

  move(foodCell) {
    let tailSet = this.tailSet();
    let head = this.snake.getHead();
    let next = this.snake.nextPosition();

    function toward(a, b) {
      return a === b ? 0 : a > b ? 1 : -1;
    }

    // Direction we'd like to go toward food.
    let goal = {
      dx: toward(foodCell.x, head.x),
      dy: toward(foodCell.y, head.y),
    };

    let current = this.snake.direction();

    let xAway = goal.dx * current.dx == -1;
    let yAway = goal.dy * current.dy == -1;

    let turn = null;
    if (xAway || goal.dx == 0) {
      turn = { dx: 0, dy: goal.dy };
    } else if (yAway || goal.dy == 0) {
      turn = { dx: goal.dx, dy: 0 };
    }

    if (turn !== null) {
      let afterTurn = { x: head.x + turn.dx, y: head.y + turn.dy };
      if (this.cellOk(afterTurn, tailSet, foodCell)) {
        return turn;
      }
    }

    if (this.cellOk(next, tailSet, foodCell)) {
      //console.log("next: " + j(next) + " in tailSet. No move.")
      return null;
    } else {
      let ok = [];
      for (let n of this.grid.neighbors(this.grid.fromXY(head))) {
        //console.log("Checking " + JSON.stringify(this.grid.toXY(n)));
        if (tailSet.has(n)) {
          ok.push(n);
        }
      }
      if (ok.length == 0) {
        console.log("No where to go");
        return null;
      } else {
        //console.log("ok: " + JSON.stringify(ok.map((i) => this.grid.toXY(i))));
        let cell = this.grid.toXY(ok[Math.floor(Math.random() * ok.length)]);
        let move = { dx: cell.x - head.x, dy: cell.y - head.y };
        //console.log("Move: " + JSON.stringify(move));
        return move;
      }
    }
  }

  tailSet() {
    let tail = this.grid.fromXY(this.snake.getTail());
    let set = new Set();
    for (let n of this.grid.neighbors(tail)) {
      //console.log(`Got neighbor of tail ${n}`);
      this.walk(n, set);
    }
    return set;
  }

  walk(i, set) {
    if (this.grid.cells[i] !== snakeColor && !set.has(i)) {
      let cell = this.grid.toXY(i);
      if (cell.x < 0 || cell.y < 0) {
        throw new Error(j(cell));
      }
      set.add(i);
      for (let n of this.grid.neighbors(i)) {
        //console.log(`Got neighbor ${n}`);
        this.walk(n, set);
      }
    } else {
      //console.log(`${i} ${this.grid.cells[i]} and in set: ${set.has(i)}`)
    }
    return set;
  }
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
      game.drawCell(game.snake.getHead(), "black");
      game.drawCell(game.snake.getTail(), "white");
    }
  };
  requestAnimationFrame(step);
}

var game;

function init() {
  let canvas = document.getElementById("screen");
  let html = document.getElementsByTagName("html")[0];
  let gridSize = Math.floor(canvas.width / size);
  game = new Game(gridSize, canvas, html, new UI());
}

window.onload = () => init();
