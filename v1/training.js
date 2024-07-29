import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';


const numActions = 5; // up, down, left, right, place bomb
const stateSize = 13 * 15; // Adjust this based on your actual state size (numRows * numCols)

const model = tf.sequential();

let replayMemory = [];
const memorySize = 2000;
const batchSize = 32;
const gamma = 0.95;
let epsilon = 1.0;
const epsilonMin = 0.01;
const epsilonDecay = 0.995;

async function setup() {
  await tf.setBackend('webgl');

  model.add(tf.layers.dense({ units: 24, inputShape: [stateSize], activation: 'relu' }));
  model.add(tf.layers.dense({ units: 24, activation: 'relu' }));
  model.add(tf.layers.dense({ units: numActions, activation: 'linear' }));
  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

}

export function getState(cells, numRows, numCols) {
  let state = [];
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      state.push(cells[row][col] ? 1 : 0); // Simple binary state representation
    }
  }

  // Ensure the state array has the correct length
  if (state.length !== stateSize) {
    console.error(`State size mismatch: expected ${stateSize}, but got ${state.length}`);
    return null;
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
      if (state == null) {
        console.error('Invalid state tensor passed to selectAction.');
        return Math.floor(Math.random() * numActions);
      }
      const qValues = model.predict(state);
      return qValues.argMax(-1).dataSync()[0];
    });
  }
}


export async function trainModel() {
  if (replayMemory.length < batchSize) 
    return;

  const batch = [];
  for (let i = 0; i < batchSize; i++) {
    const idx = Math.floor(Math.random() * replayMemory.length);
    batch.push(replayMemory[idx]);
  }

  const states = [];
  const targets = [];

  batch.forEach(memory => {
    let targetB = memory.reward;
    
    if (!memory.done) {
      const qNextTensor = model.predict(memory.nextState);
      const qNext = qNextTensor.max(-1).dataSync()[0];
      targetB += gamma * qNext;
      qNextTensor.dispose();
    }

    const targetFTensor = model.predict(memory.state);
    const targetF = targetFTensor.dataSync();
    targetFTensor.dispose();

    targetF[memory.action] = targetB;

    states.push(memory.state.dataSync());
    targets.push(targetF);
  });

  const x = tf.tensor2d(states, [states.length, stateSize]);
  const y = tf.tensor2d(targets, [targets.length, numActions]);

  await model.fit(x, y, { epochs: 1 });
  tf.dispose([x, y]);

  if (epsilon > epsilonMin) {
    epsilon *= epsilonDecay;
  }
}

setup();