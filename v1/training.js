import * as tf from '@tensorflow/tfjs';

const numActions = 5; // up, down, left, right, place bomb
const stateSize = 13 * 15; // Adjust this based on your actual state size (numRows * numCols)

const model = tf.sequential();
model.add(
  tf.layers.dense({ units: 24, inputShape: [stateSize], activation: 'relu' })
);
model.add(tf.layers.dense({ units: 24, activation: 'relu' }));
model.add(tf.layers.dense({ units: numActions, activation: 'linear' }));
model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

let replayMemory = [];
const memorySize = 2000;
const batchSize = 32;
const gamma = 0.95;
let epsilon = 1.0;
const epsilonMin = 0.01;
const epsilonDecay = 0.995;

export function getState(cells, numRows, numCols) {
  let state = [];
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      state.push(cells[row][col] ? 1 : 0); // Simple binary state representation
    }
  }
  return tf.tensor2d([state]);
}

export function remember(state, action, reward, nextState, done) {
  if (replayMemory.length > memorySize) {
    replayMemory.shift();
  }
  replayMemory.push({ state, action, reward, nextState, done });
}

export function selectAction(state) {
  if (Math.random() <= epsilon) {
    return Math.floor(Math.random() * numActions);
  } else {
    return tf.tidy(() => {
      const qValues = model.predict(state);
      return qValues.argMax(-1).dataSync()[0];
    });
  }
}

export async function trainModel() {
  if (replayMemory.length < batchSize) return;

  const batch = [];
  for (let i = 0; i < batchSize; i++) {
    const idx = Math.floor(Math.random() * replayMemory.length);
    batch.push(replayMemory[idx]);
  }

  const states = [];
  const targets = [];

  batch.forEach(({ state, action, reward, nextState, done }) => {
    let targetB = reward;
    if (!done) {
      const qNext = model.predict(nextState).max(-1).dataSync()[0];
      targetB += gamma * qNext;
    }

    const targetF = model.predict(state).dataSync();
    targetF[action] = targetB;

    states.push(state.dataSync());
    targets.push(targetF);
  });

  const x = tf.tensor2d(states);
  const y = tf.tensor2d(targets);

  await model.fit(x, y, { epochs: 1 });
  tf.dispose([x, y]);

  if (epsilon > epsilonMin) {
    epsilon *= epsilonDecay;
  }
}
