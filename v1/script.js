import { getState, remember, selectAction, trainModel } from './training.js';

const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const grid = 64;
const numRows = 13;
const numCols = 15;
const numSoftWalls = 60;

// Game Characteristics
let score = 0;
const dateStart = new Date();
let dateEnd = new Date().setMinutes(dateStart.getMinutes() + 1);

// SoftWall characteristics
const softWallCanvas = document.createElement('canvas');
const softWallCtx = softWallCanvas.getContext('2d');
softWallCanvas.width = softWallCanvas.height = grid;

softWallCtx.fillStyle = 'black';
softWallCtx.fillRect(0, 0, grid, grid);
softWallCtx.fillStyle = '#a0530c';

// 1st row brick
softWallCtx.fillRect(1, 1, grid - 2, 20);

// 2nd row bricks
softWallCtx.fillRect(0, 23, 20, 18);
softWallCtx.fillRect(22, 23, 42, 18);

// 3rd row bricks
softWallCtx.fillRect(0, 43, 42, 20);
softWallCtx.fillRect(44, 43, 20, 20);

// Wall characteristics
const wallCanvas = document.createElement('canvas');
const wallCtx = wallCanvas.getContext('2d');
wallCanvas.width = wallCanvas.height = grid;

wallCtx.fillStyle = '#121211';
wallCtx.fillRect(0, 0, grid, grid);
wallCtx.fillStyle = '#212120';
wallCtx.fillRect(0, 0, grid - 2, grid - 2);
wallCtx.fillStyle = '#1c1c1b';
wallCtx.fillRect(2, 2, grid - 4, grid - 4);

// OutLine characteristics
const outlineCanvas = document.createElement('canvas');
const outlineCtx = outlineCanvas.getContext('2d');
outlineCanvas.width = outlineCanvas.height = grid;

outlineCtx.fillStyle = 'black';
outlineCtx.fillRect(0, grid - 2, grid, 2);
outlineCtx.fillStyle = '#c93e2e';
outlineCtx.fillRect(0, 0, grid - 2, grid - 2);
outlineCtx.fillStyle = '#991203';
outlineCtx.fillRect(2, 2, grid - 4, grid - 4);

// create a mapping of object types
const types = {
  outline: '⛩',
  wall: '▉',
  softWall: 1,
  bomb: 2,
};

// keep track of all entities
let entities = [];

// keep track of what is in every cell of the game using a 2d array. the
// template is used to note where walls are and where soft walls cannot spawn.
// '▉' represents a wall
// 'x' represents a cell that cannot have a soft wall (player start zone)
let cells = [];
const template = [
  ['⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩'],
  ['⛩', 'x', 'x', , , , , , , , , , 'x', 'x', '⛩'],
  ['⛩', 'x', '▉', , '▉', , '▉', , '▉', , '▉', , '▉', 'x', '⛩'],
  ['⛩', 'x', , , , , , , , , , , , 'x', '⛩'],
  ['⛩', , '▉', , '▉', , '▉', , '▉', , '▉', , '▉', , '⛩'],
  ['⛩', , , , , , , , , , , , , , '⛩'],
  ['⛩', , '▉', , '▉', , '▉', , '▉', , '▉', , '▉', , '⛩'],
  ['⛩', , , , , , , , , , , , , , '⛩'],
  ['⛩', , '▉', , '▉', , '▉', , '▉', , '▉', , '▉', , '⛩'],
  ['⛩', 'x', , , , , , , , , , , , 'x', '⛩'],
  ['⛩', 'x', '▉', , '▉', , '▉', , '▉', , '▉', , '▉', 'x', '⛩'],
  ['⛩', 'x', 'x', , , , , , , , , , 'x', 'x', '⛩'],
  ['⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩', '⛩'],
];

// populate the level with walls and soft walls
function generateLevel() {
  cells = [];
  let softWalls = 0;
  let iteration = 0;

  // Initialize the cells array with empty arrays
  for (let row = 0; row < numRows; row++) {
    cells[row] = [];
  }

  // While is needed to make sure that softwalls can be generated on all tiles
  while (softWalls < numSoftWalls) {
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        // don't place anything if there is already something there
        // iteration is used to not replace anything that was place on the first run
        if (iteration > 0 && cells[row][col] !== undefined) continue;

        if (
          !template[row][col] &&
          Math.random() < 0.3 &&
          softWalls < numSoftWalls
        ) {
          cells[row][col] = types.softWall;
          softWalls++;
        } else if (template[row][col] === types.wall) {
          cells[row][col] = types.wall;
        } else if (template[row][col] === types.outline) {
          cells[row][col] = types.outline;
        }
      }
    }
    iteration++;
  }
}

// blow up a bomb and its surrounding tiles
function blowUpBomb(bomb) {
  // bomb has already exploded so don't blow up again
  if (!bomb.alive) return;

  bomb.alive = false;

  // remove bomb from grid
  cells[bomb.row][bomb.col] = null;

  // explode bomb outward by size
  const dirs = [
    {
      // up
      row: -1,
      col: 0,
    },
    {
      // down
      row: 1,
      col: 0,
    },
    {
      // left
      row: 0,
      col: -1,
    },
    {
      // right
      row: 0,
      col: 1,
    },
  ];
  dirs.forEach((dir) => {
    for (let i = 0; i < bomb.size; i++) {
      const row = bomb.row + dir.row * i;
      const col = bomb.col + dir.col * i;
      const cell = cells[row][col];

      // stop the explosion if it hit a wall
      if (cell === types.wall || cell === types.outline) return;

      // center of the explosion is the first iteration of the loop
      entities.push(new Explosion(row, col, dir, i === 0 ? true : false));
      cells[row][col] = null;

      // bomb hit another bomb so blow that one up too
      if (cell === types.bomb) {
        // find the bomb that was hit by comparing positions
        const nextBomb = entities.find((entity) => {
          return (
            entity.type === types.bomb &&
            entity.row === row &&
            entity.col === col
          );
        });
        blowUpBomb(nextBomb);
      }

      // bomb hit a player so kill the player and end the explosion
      if (col === player.col && row === player.row) {
        player.alive = false;
        player.bombKiller = bomb;
        return;
      }

      // stop the explosion if hit anything
      if (cell) {
        if (cell === types.softWall) {
          score++;
          const scoreDiv = document.getElementById('score');
          scoreDiv.textContent = 'Score : ' + score;
        }
        return;
      }
    }
  });
}

// bomb constructor function
class Bomb {
  constructor(row, col, size, owner) {
    this.row = row;
    this.col = col;
    this.radius = grid * 0.4;
    this.size = size; // the size of the explosion
    this.owner = owner; // which player placed this bomb
    this.alive = true;
    this.type = types.bomb;

    // bomb blows up after 3 seconds
    this.timer = 3000;

    // update the bomb each frame
    this.update = function (dt) {
      this.timer -= dt;

      // blow up bomb if timer is done
      if (this.timer <= 0) {
        return blowUpBomb(this);
      }

      // change the size of the bomb every half second. we can determine the size
      // by dividing by 500 (half a second) and taking the ceiling of the result.
      // then we can check if the result is even or odd and change the size
      const interval = Math.ceil(this.timer / 500);
      if (interval % 2 === 0) {
        this.radius = grid * 0.4;
      } else {
        this.radius = grid * 0.5;
      }
    };

    // render the bomb each frame
    this.render = function () {
      const x = (this.col + 0.5) * grid;
      const y = (this.row + 0.5) * grid;

      // draw bomb
      context.fillStyle = 'black';
      context.beginPath();
      context.arc(x, y, this.radius, 0, 2 * Math.PI);
      context.fill();

      // draw bomb fuse moving up and down with the bomb size
      const fuseY = this.radius === grid * 0.5 ? grid * 0.15 : 0;
      context.strokeStyle = 'white';
      context.lineWidth = 5;
      context.beginPath();
      context.arc(
        (this.col + 0.75) * grid,
        (this.row + 0.25) * grid - fuseY,
        10,
        Math.PI,
        -Math.PI / 2
      );
      context.stroke();
    };
  }
}

// explosion constructor function
class Explosion {
  constructor(row, col, dir, center) {
    this.row = row;
    this.col = col;
    this.dir = dir;
    this.alive = true;

    // show explosion for 0.3 seconds
    this.timer = 300;

    // update the explosion each frame
    this.update = function (dt) {
      this.timer -= dt;

      if (this.timer <= 0) {
        this.alive = false;
      }
    };

    // render the explosion each frame
    this.render = function () {
      const x = this.col * grid;
      const y = this.row * grid;
      const horizontal = this.dir.col;
      const vertical = this.dir.row;

      // create a fire effect by stacking red, orange, and yellow on top of
      // each other using progressively smaller rectangles
      context.fillStyle = '#D72B16'; // red
      context.fillRect(x, y, grid, grid);

      context.fillStyle = '#F39642'; // orange

      // determine how to draw based on if it's vertical or horizontal
      // center draws both ways
      if (center || horizontal) {
        context.fillRect(x, y + 6, grid, grid - 12);
      }
      if (center || vertical) {
        context.fillRect(x + 6, y, grid - 12, grid);
      }

      context.fillStyle = '#FFE5A8'; // yellow

      if (center || horizontal) {
        context.fillRect(x, y + 12, grid, grid - 24);
      }
      if (center || vertical) {
        context.fillRect(x + 12, y, grid - 24, grid);
      }
    };
  }
}

// player character (just a simple circle)
const player = {
  row: 1,
  col: 1,
  alive: true,
  bombKiller: undefined,
  numBombs: 1,
  bombSize: 3,
  radius: grid * 0.35,
  render() {
    const x = (this.col + 0.5) * grid;
    const y = (this.row + 0.5) * grid;

    context.save();
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(x, y, this.radius, 0, 2 * Math.PI);
    context.fill();
  },
  clear() {
    const x = this.col * grid;
    const y = this.row * grid;
    context.clearRect(x, y, grid, grid);
  },
};

// game loop
let last;
let dt;
let dateTimePK;
let pk = false;
let gameWin = false;
let state;
let action;
let iteration = 0;
async function loop(timestamp) {
  console.log(iteration)
  iteration++;

  if (gameWin) {
    console.log('Game Win !');
    return;
  }
  // End the game if the player is dead
  if (!player.alive) {
    dateTimePK = pk ? dateTimePK : timestamp;
    pk = true;
    if (timestamp - dateTimePK > 350) {
      player.clear();
      console.log('Game Over !');
      return;
    }
  }

  requestAnimationFrame(loop);
  context.clearRect(0, 0, canvas.width, canvas.height);

  // calculate the time difference since the last update. requestAnimationFrame
  // passes the current timestamp as a parameter to the loop
  if (!last) {
    last = timestamp;
  }

  dt = timestamp - last;
  last = timestamp;

  let currentSoftWalls = 0;
  // update and render everything in the grid
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      switch (cells[row][col]) {
        case types.wall:
          context.drawImage(wallCanvas, col * grid, row * grid);
          break;
        case types.softWall:
          currentSoftWalls++;
          context.drawImage(softWallCanvas, col * grid, row * grid);
          break;
        case types.outline:
          context.drawImage(outlineCanvas, col * grid, row * grid);
          break;
      }
    }
  }

  if (currentSoftWalls === 0) {
    gameWin = true;
  }

  // update and render all entities
  entities.forEach((entity) => {
    entity.update(dt);
    entity.render();
  });

  // remove dead entities
  entities = entities.filter((entity) => entity.alive);

  player.render();

  // Collect experiences for the model
  if (state) {
    const reward = player.alive ? 1 : -10;
    const nextState = getState(cells, numRows, numCols);
    const done = !player.alive || gameWin;
    console.log('State:', state, 'Action:', action, 'Reward:', reward, 'Done:', done);
    remember(state, action, reward, nextState, done);
    await trainModel();
    state.dispose();
    nextState.dispose();
    if (done) {
      score = 0;
      player.alive = true;
      gameWin = false;
      generateLevel();
    }
  }

  state = getState(cells, numRows, numCols);
  if (state == null) {
    console.error('Failed to retrieve valid state');
    return;
  }
  action = selectAction(state);
  performAction(action);
}

// Perform the action chosen by the model
function performAction(action) {
  let row = player.row;
  let col = player.col;

  switch (action) {
    case 0:
      col--;
      break;
    case 1:
      row--;
      break;
    case 2:
      col++;
      break;
    case 3:
      row++;
      break;
    case 4: // Place bomb
      if (
        !cells[row][col] &&
        entities.filter(
          (entity) => entity.type === types.bomb && entity.owner === player
        ).length < player.numBombs
      ) {
        const bomb = new Bomb(row, col, player.bombSize, player);
        entities.push(bomb);
        cells[row][col] = types.bomb;
      }
      break;
      default:
        console.error('Invalid action:', action);
        break;
  }

  if (!cells[row][col]) {
    player.row = row;
    player.col = col;
  }
}

document.addEventListener('keydown', function (e) {
  const actionMap = {
    37: 0, // left arrow key
    38: 1, // up arrow key
    39: 2, // right arrow key
    40: 3, // down arrow key
    32: 4, // space key
  };

  if (actionMap[e.which] !== undefined) {
    const action = actionMap[e.which];
    performAction(action);
  }
});

// start the game
setTimeout(() => {
  generateLevel();
requestAnimationFrame(loop);
}, 2000);

