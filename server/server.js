import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import crypto from "crypto";

const app = express();
app.use(cors());
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "skribbl-clone-server" }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 5000;
const rooms = new Map();

const WORDS = {
  en: {
    animals: ["cat","dog","elephant","lion","tiger","monkey","rabbit","horse","giraffe","penguin"],
    objects: ["phone","laptop","chair","table","camera","umbrella","clock","guitar","book","bottle"],
    food: ["pizza","burger","apple","banana","cake","sandwich","ice cream","donut","carrot","mango"],
    actions: ["running","jumping","swimming","dancing","sleeping","cooking","reading","singing","driving","flying"],
    nature: ["tree","mountain","rainbow","sun","moon","cloud","flower","river","volcano","island"]
  },
  hi: {
    animals: ["बिल्ली","कुत्ता","हाथी","शेर","बाघ","बंदर","खरगोश","घोड़ा","जिराफ","पेंगुइन"],
    objects: ["फोन","लैपटॉप","कुर्सी","मेज","कैमरा","छाता","घड़ी","गिटार","किताब","बोतल"],
    food: ["पिज्जा","बर्गर","सेब","केला","केक","सैंडविच","आइसक्रीम","डोनट","गाजर","आम"],
    actions: ["दौड़ना","कूदना","तैरना","नाचना","सोना","खाना बनाना","पढ़ना","गाना","गाड़ी चलाना","उड़ना"],
    nature: ["पेड़","पहाड़","इंद्रधनुष","सूरज","चाँद","बादल","फूल","नदी","ज्वालामुखी","द्वीप"]
  },
  es: {
    animals: ["gato","perro","elefante","león","tigre","mono","conejo","caballo","jirafa","pingüino"],
    objects: ["teléfono","portátil","silla","mesa","cámara","paraguas","reloj","guitarra","libro","botella"],
    food: ["pizza","hamburguesa","manzana","plátano","pastel","sándwich","helado","donut","zanahoria","mango"],
    actions: ["correr","saltar","nadar","bailar","dormir","cocinar","leer","cantar","conducir","volar"],
    nature: ["árbol","montaña","arcoíris","sol","luna","nube","flor","río","volcán","isla"]
  },
  fr: {
    animals: ["chat","chien","éléphant","lion","tigre","singe","lapin","cheval","girafe","pingouin"],
    objects: ["téléphone","ordinateur","chaise","table","caméra","parapluie","horloge","guitare","livre","bouteille"],
    food: ["pizza","burger","pomme","banane","gâteau","sandwich","glace","donut","carotte","mangue"],
    actions: ["courir","sauter","nager","danser","dormir","cuisiner","lire","chanter","conduire","voler"],
    nature: ["arbre","montagne","arc-en-ciel","soleil","lune","nuage","fleur","rivière","volcan","île"]
  }
};

const SUPPORTED_LANGUAGES = ["en", "hi", "es", "fr"];

function makeId() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function cleanName(name) {
  return String(name || "Player").trim().slice(0, 20) || "Player";
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    score: p.score,
    ready: p.ready,
    connected: p.connected
  };
}

function getRoomPlayers(room) {
  return [...room.players.values()].map(publicPlayer);
}

function getRoomState(room, socketId) {
  return {
    roomId: room.id,
    hostId: room.hostId,
    players: getRoomPlayers(room),
    settings: room.settings,
    phase: room.phase,
    round: room.round,
    totalRounds: room.settings.rounds,
    drawerId: room.drawerId,
    isDrawer: room.drawerId === socketId,
    word: room.drawerId === socketId ? room.word : null,
    hints: room.hints,
    timeLeft: room.timeLeft
  };
}

function broadcastState(room) {
  for (const p of room.players.values()) {
    if (p.connected) io.to(p.id).emit("game_state", getRoomState(room, p.id));
  }
}

function broadcastPlayers(room) {
  for (const p of room.players.values()) {
    if (p.connected) io.to(p.id).emit("players_update", getRoomPlayers(room));
  }
}

function clearRoomTimer(room) {
  if (room.timer) clearInterval(room.timer);
  room.timer = null;
}

function chooseWords(room) {
  const languageWords = WORDS[room.settings.language] || WORDS.en;
  let pool = Object.values(languageWords).flat();
  if (room.settings.category !== "all" && languageWords[room.settings.category]) {
    pool = languageWords[room.settings.category];
  }
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, room.settings.wordCount);
}

function makeHints(word, count) {
  if (!count) return "_ ".repeat(word.length).trim();
  const letters = word.split("");
  const reveal = Math.min(count, letters.length);
  const indexes = [...Array(letters.length).keys()].sort(() => Math.random() - 0.5).slice(0, reveal);
  return letters.map((c, i) => c === " " ? "/" : indexes.includes(i) ? c : "_").join(" ");
}

function startRound(room) {
  clearRoomTimer(room);
  room.phase = "choosing";
  room.round += 1;
  room.hints = 0;
  room.word = "";
  room.guessedIds = new Set();
  room.drawings = [];

  const active = [...room.players.values()].filter(p => p.connected);
  if (!active.length) {
    room.phase = "lobby";
    return;
  }

  if (room.round > room.settings.rounds * active.length) {
    endGame(room);
    return;
  }

  const drawerIndex = (room.round - 1) % active.length;
  room.drawerId = active[drawerIndex].id;
  room.wordOptions = chooseWords(room);

  io.to(room.drawerId).emit("round_start", {
    drawerId: room.drawerId,
    wordOptions: room.wordOptions,
    drawTime: room.settings.drawTime,
    round: room.round,
    totalRounds: room.settings.rounds * active.length
  });

  for (const p of active) {
    if (p.id !== room.drawerId) {
      io.to(p.id).emit("round_start", {
        drawerId: room.drawerId,
        wordOptions: [],
        drawTime: room.settings.drawTime,
        round: room.round,
        totalRounds: room.settings.rounds * active.length
      });
    }
  }

  room.timeLeft = room.settings.drawTime;
  broadcastState(room);
}

function startDrawing(room, word) {
  if (room.phase !== "choosing" || !room.wordOptions.includes(word)) return;
  room.word = word.toLowerCase();
  room.phase = "drawing";
  room.timeLeft = room.settings.drawTime;
  room.hints = 0;

  io.to(room.drawerId).emit("word_chosen", { word: room.word });
  for (const p of room.players.values()) {
    if (p.connected && p.id !== room.drawerId) {
      io.to(p.id).emit("word_chosen", {
        word: null,
        hint: makeHints(room.word, room.hints)
      });
    }
  }

  broadcastState(room);

  room.timer = setInterval(() => {
    room.timeLeft -= 1;

    if (room.settings.hints > 0 && room.timeLeft > 0) {
      const elapsed = room.settings.drawTime - room.timeLeft;
      const interval = Math.max(1, Math.floor(room.settings.drawTime / room.settings.hints));
      const newHints = Math.min(room.settings.hints, Math.floor(elapsed / interval));
      if (newHints !== room.hints) {
        room.hints = newHints;
        io.to(room.id).emit("hint_update", { hint: makeHints(room.word, room.hints) });
      }
    }

    io.to(room.id).emit("timer", room.timeLeft);

    if (room.timeLeft <= 0) {
      endRound(room, null);
    }
  }, 1000);
}

function endRound(room, guessedPlayerId) {
  if (room.phase !== "drawing") return;
  clearRoomTimer(room);
  room.phase = "round_end";

  const scores = getRoomPlayers(room);
  const winnerPlayer = guessedPlayerId ? room.players.get(guessedPlayerId) : null;
  io.to(room.id).emit("round_end", {
    word: room.word,
    scores,
    guessedPlayerId,
    roundWinner: winnerPlayer ? {
      id: winnerPlayer.id,
      name: winnerPlayer.name,
      points: Math.max(50, 150 + room.timeLeft * 2)
    } : null,
    nextDrawer: room.drawerId
  });

  setTimeout(() => {
    if (!rooms.has(room.id)) return;
    if (room.round >= room.settings.rounds * [...room.players.values()].filter(p => p.connected).length) {
      endGame(room);
    } else {
      startRound(room);
    }
  }, 2500);
}

function endGame(room) {
  clearRoomTimer(room);
  room.phase = "game_over";
  const leaderboard = getRoomPlayers(room).sort((a,b) => b.score - a.score);
  io.to(room.id).emit("game_over", {
    winner: leaderboard[0] || null,
    leaderboard
  });
  broadcastState(room);
}

function leaveRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  room.players.delete(socket.id);

  if (room.hostId === socket.id) {
    const next = [...room.players.values()][0];
    room.hostId = next?.id || null;
  }

  if (room.players.size === 0) {
    clearRoomTimer(room);
    rooms.delete(roomId);
    return;
  }

  broadcastPlayers(room);
  broadcastState(room);
}

io.on("connection", socket => {
  socket.on("create_room", ({ hostName, settings = {} }, cb) => {
    const id = makeId();
    const room = {
      id,
      hostId: socket.id,
      players: new Map(),
      settings: {
        maxPlayers: Math.min(20, Math.max(2, Number(settings.maxPlayers) || 8)),
        rounds: Math.min(10, Math.max(2, Number(settings.rounds) || 3)),
        drawTime: Math.min(240, Math.max(15, Number(settings.drawTime) || 60)),
        wordCount: Math.min(5, Math.max(1, Number(settings.wordCount) || 3)),
        hints: Math.min(5, Math.max(0, Number(settings.hints) || 2)),
        category: WORDS.en[settings.category] ? settings.category : "all",
        language: SUPPORTED_LANGUAGES.includes(settings.language) ? settings.language : "en",
        private: settings.private !== false
      },
      phase: "lobby",
      round: 0,
      drawerId: null,
      word: "",
      wordOptions: [],
      hints: 0,
      timeLeft: 0,
      timer: null,
      drawings: []
    };
    rooms.set(id, room);

    room.players.set(socket.id, {
      id: socket.id,
      name: cleanName(hostName),
      score: 0,
      ready: true,
      connected: true
    });
    socket.join(id);
    socket.data.roomId = id;

    cb?.({ ok: true, roomId: id, playerId: socket.id });
    broadcastState(room);
  });

  socket.on("join_room", ({ roomId, playerName }, cb) => {
    const id = String(roomId || "").trim().toUpperCase();
    const room = rooms.get(id);

    if (!room) return cb?.({ ok: false, error: "Room not found." });
    if (room.players.size >= room.settings.maxPlayers) {
      return cb?.({ ok: false, error: "Room is full." });
    }
    if (room.phase !== "lobby") {
      return cb?.({ ok: false, error: "Game has already started." });
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: cleanName(playerName),
      score: 0,
      ready: true,
      connected: true
    });
    socket.join(id);
    socket.data.roomId = id;

    cb?.({ ok: true, roomId: id, playerId: socket.id });
    io.to(id).emit("player_joined", {
      player: publicPlayer(room.players.get(socket.id)),
      players: getRoomPlayers(room)
    });
    broadcastState(room);
  });

  socket.on("toggle_ready", () => {
    const room = rooms.get(socket.data.roomId);
    const p = room?.players.get(socket.id);
    if (!p || room.phase !== "lobby") return;
    p.ready = !p.ready;
    broadcastPlayers(room);
  });

  socket.on("start_game", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") return;
    const active = [...room.players.values()];
    if (active.length < 2) {
      return socket.emit("error_message", "At least 2 players are required.");
    }
    if (!active.every(p => p.ready)) {
      return socket.emit("error_message", "All players must be ready.");
    }
    room.round = 0;
    for (const p of active) p.score = 0;
    startRound(room);
  });

  socket.on("choose_word", ({ word }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.id !== room.drawerId) return;
    startDrawing(room, String(word || "").toLowerCase());
  });

  socket.on("draw_start", data => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.phase !== "drawing" || socket.id !== room.drawerId) return;
    const stroke = {
      type: "start",
      x: Number(data.x),
      y: Number(data.y),
      color: String(data.color || "#111827"),
      size: Number(data.size) || 4,
      tool: data.tool === "eraser" ? "eraser" : "brush"
    };
    room.drawings.push(stroke);
    socket.to(room.id).emit("draw_data", stroke);
  });

  socket.on("draw_move", data => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.phase !== "drawing" || socket.id !== room.drawerId) return;
    const stroke = { type: "move", x: Number(data.x), y: Number(data.y) };
    room.drawings.push(stroke);
    socket.to(room.id).emit("draw_data", stroke);
  });

  socket.on("draw_end", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.phase !== "drawing" || socket.id !== room.drawerId) return;
    const stroke = { type: "end" };
    room.drawings.push(stroke);
    socket.to(room.id).emit("draw_data", stroke);
  });

  socket.on("canvas_clear", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.id !== room.drawerId) return;
    room.drawings = [];
    io.to(room.id).emit("canvas_clear");
  });

  socket.on("draw_undo", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.id !== room.drawerId) return;
    let start = room.drawings.length - 1;
    while (start >= 0 && room.drawings[start].type !== "start") start--;
    if (start >= 0) {
      room.drawings.splice(start);
    }
    io.to(room.id).emit("canvas_snapshot", room.drawings);
  });

  socket.on("request_canvas", () => {
    const room = rooms.get(socket.data.roomId);
    if (room) socket.emit("canvas_snapshot", room.drawings);
  });

  socket.on("guess", ({ text }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.phase !== "drawing" || socket.id === room.drawerId) return;

    const player = room.players.get(socket.id);
    if (!player || room.guessedIds.has(socket.id)) return;

    const guess = String(text || "").trim().toLowerCase();
    if (!guess) return;

    const correct = guess === room.word.trim().toLowerCase();
    if (correct) {
      const points = Math.max(50, 150 + room.timeLeft * 2);
      player.score += points;
      room.guessedIds.add(socket.id);

      io.to(room.id).emit("guess_result", {
        correct: true,
        playerId: player.id,
        playerName: player.name,
        points
      });

      broadcastPlayers(room);

      const guessers = [...room.players.values()].filter(p => p.id !== room.drawerId && room.guessedIds.has(p.id));
      const possible = [...room.players.values()].filter(p => p.id !== room.drawerId && p.connected);
      if (guessers.length >= possible.length) endRound(room, player.id);
    } else {
      socket.emit("guess_result", {
        correct: false,
        playerId: player.id,
        playerName: player.name,
        points: 0
      });
      socket.to(room.id).emit("chat_message", {
        playerId: player.id,
        playerName: player.name,
        text: `${player.name}: ${String(text).slice(0, 80)}`
      });
    }
  });

  socket.on("chat", ({ text }) => {
    const room = rooms.get(socket.data.roomId);
    const player = room?.players.get(socket.id);
    if (!room || !player) return;
    const safeText = String(text || "").trim().slice(0, 200);
    if (!safeText) return;
    io.to(room.id).emit("chat_message", {
      playerId: player.id,
      playerName: player.name,
      text: safeText
    });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomId);
    if (room) {
      const p = room.players.get(socket.id);
      if (p) {
        p.connected = false;
        if (room.drawerId === socket.id && room.phase === "drawing") {
          endRound(room, null);
        }
        broadcastPlayers(room);
      }
    }
  });

  socket.on("leave_room", () => {
    leaveRoom(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Skribbl clone server running on http://localhost:${PORT}`);
});