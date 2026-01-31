// server/src/simulation.ts
import { io } from "socket.io-client";

// 1. Connect two imaginary players to your local server
const URL = "http://localhost:3000";
const playerHome = io(URL);
const playerAway = io(URL);

console.log("🤖 SIMULATION STARTING...");

// --- HELPER: LOGGING ---
function log(prefix: string, data: any) {
  // If we get a state update, just show us the interesting bits
  if (data.myState) {
    console.log(`\n📩 [${prefix}] RECEIVED STATE:`);
    console.log(`   Phase: ${data.phase}`);
    console.log(`   Hand: ${data.myState.hand.length} cards`);
    console.log(`   Score: ${data.myState.score} - ${data.opponentState.score}`);
    
    if (data.lastPlay) {
      console.log(`   🏈 RESULT: ${data.lastPlay.message}`);
      console.log(`   🏈 YARDS: ${data.lastPlay.yardsGained}`);
    }
  } else {
    console.log(`[${prefix}]`, data);
  }
}

// --- PLAYER 1 (HOME) LOGIC ---
playerHome.on("connect", () => {
  console.log("✅ Home Connected!");
  // Join Room "TEST_ROOM"
  playerHome.emit("JOIN_GAME", "TEST_ROOM");
});

playerHome.on("GAME_STATE_UPDATE", (state) => {
  log("HOME", state);

  // Auto-Play Logic: If it's my turn, play the first card in my hand
  if (state.phase === "OFFENSE_SELECT" || state.phase === "DEFENSE_SELECT" || state.phase === "LOBBY") {
    // Check if we are waiting for opponent
    if (state.waitingForOpponent) {
      console.log("⏳ Home waiting for opponent...");
      return;
    }

    const cardToPlay = state.myState.hand[0]; // Just pick the first one
    if (cardToPlay) {
      console.log(`👉 Home playing: ${cardToPlay.name} (${cardToPlay.id})`);
      playerHome.emit("PLAY_CARD", { roomId: "TEST_ROOM", cardId: cardToPlay.id });
    }
  }
});

// --- PLAYER 2 (AWAY) LOGIC ---
playerAway.on("connect", () => {
  console.log("✅ Away Connected!");
  // Join the same room
  playerAway.emit("JOIN_GAME", "TEST_ROOM");
});

playerAway.on("GAME_STATE_UPDATE", (state) => {
  log("AWAY", state);

  if (state.phase === "OFFENSE_SELECT" || state.phase === "DEFENSE_SELECT") {
    if (state.waitingForOpponent) {
      console.log("⏳ Away waiting for opponent...");
      return;
    }

    const cardToPlay = state.myState.hand[0]; 
    if (cardToPlay) {
      setTimeout(() => {
        // Add a tiny delay so logs are readable
        console.log(`👉 Away playing: ${cardToPlay.name} (${cardToPlay.id})`);
        playerAway.emit("PLAY_CARD", { roomId: "TEST_ROOM", cardId: cardToPlay.id });
      }, 500);
    }
  }
});