import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";
const socket = io(SERVER_URL, { autoConnect: true });

const defaultSettings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 60,
  wordCount: 3,
  hints: 2,
  category: "all",
  language: "en",
  private: true
};

function App() {
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [error, setError] = useState("");
  const [roundOptions, setRoundOptions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [hint, setHint] = useState("");
  const [word, setWord] = useState("");
  const [winner, setWinner] = useState(null);
  const [roundWinner, setRoundWinner] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const onState = s => {
      setRoom(s);
      if (s.phase === "lobby") setScreen("lobby");
      if (s.phase === "choosing" || s.phase === "drawing" || s.phase === "round_end") setScreen("game");
      if (s.phase === "game_over") setScreen("gameover");
    };
    const onRound = data => {
      setRoundOptions(data.wordOptions || []);
      setRoundWinner(null);
      setHint("");
      setWord("");
      setMessages([]);
      setScreen("game");
      setTimeout(() => clearCanvas(), 50);
    };
    const onWordChosen = data => {
      if (data.word) setWord(data.word);
      else setWord("");
      if (data.hint) setHint(data.hint);
    };
    const onHint = data => setHint(data.hint);
    const onTimer = value => setRoom(r => r ? ({...r, timeLeft: value}) : r);
    const onChat = msg => setMessages(m => [...m.slice(-80), msg]);
    const onGuess = msg => {
      setMessages(m => [...m.slice(-80), {
        playerId: msg.playerId,
        playerName: msg.playerName,
        text: msg.correct ? `${msg.playerName} guessed the word! +${msg.points}` : "Wrong guess"
      }]);
    };
    const onRoundEnd = data => {
      setWord("");
      setHint(`Word: ${data.word}`);
      setRoundWinner({
        name: data.roundWinner?.name || null,
        points: data.roundWinner?.points || 0,
        word: data.word,
        scores: data.scores || []
      });
      setMessages(m => [...m, {
        playerName: "SYSTEM",
        text: data.roundWinner
          ? `${data.roundWinner.name} won the round! +${data.roundWinner.points} points`
          : `Time up! Nobody guessed "${data.word}".`
      }]);
    };
    const onGameOver = data => {
      setWinner(data.winner);
      setScreen("gameover");
    };
    const onError = msg => setError(msg);

    socket.on("game_state", onState);
    socket.on("players_update", players => setRoom(r => r ? ({...r, players}) : r));
    socket.on("round_start", onRound);
    socket.on("word_chosen", onWordChosen);
    socket.on("hint_update", onHint);
    socket.on("timer", onTimer);
    socket.on("chat_message", onChat);
    socket.on("guess_result", onGuess);
    socket.on("round_end", onRoundEnd);
    socket.on("game_over", onGameOver);
    socket.on("error_message", onError);

    return () => {
      socket.off("game_state", onState);
      socket.off("players_update");
      socket.off("round_start", onRound);
      socket.off("word_chosen", onWordChosen);
      socket.off("hint_update", onHint);
      socket.off("timer", onTimer);
      socket.off("chat_message", onChat);
      socket.off("guess_result", onGuess);
      socket.off("round_end", onRoundEnd);
      socket.off("game_over", onGameOver);
      socket.off("error_message", onError);
    };
  }, []);

  function createRoom() {
    if (!name.trim()) return setError("Enter your name.");
    setError("");
    socket.emit("create_room", { hostName: name, settings }, result => {
      if (!result.ok) return setError(result.error);
      setRoomId(result.roomId);
    });
  }

  function joinRoom() {
    if (!name.trim() || !roomId.trim()) return setError("Enter your name and room code.");
    setError("");
    socket.emit("join_room", { roomId, playerName: name }, result => {
      if (!result.ok) setError(result.error);
    });
  }

  function startGame() {
    setError("");
    socket.emit("start_game");
  }

  function chooseWord(w) {
    socket.emit("choose_word", { word: w });
    setRoundOptions([]);
  }

  function sendGuessOrChat() {
    const text = input.trim();
    if (!text) return;
    if (room?.phase === "drawing" && !room.isDrawer) socket.emit("guess", { text });
    else socket.emit("chat", { text });
    setInput("");
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function home() {
    setScreen("home");
    setRoom(null);
    setWinner(null);
    setMessages([]);
    setRoundOptions([]);
  }

  if (screen === "home") {
    return <Home
      name={name} setName={setName}
      roomId={roomId} setRoomId={setRoomId}
      settings={settings} setSettings={setSettings}
      createRoom={createRoom} joinRoom={joinRoom}
      error={error}
    />;
  }

  if (screen === "lobby") {
    return <Lobby room={room} startGame={startGame} home={home} />;
  }

  if (screen === "game") {
    return <Game
      room={room}
      roundOptions={roundOptions}
      chooseWord={chooseWord}
      hint={hint}
      word={word}
      messages={messages}
      input={input}
      setInput={setInput}
      sendGuessOrChat={sendGuessOrChat}
      canvasRef={canvasRef}
      roundWinner={roundWinner}
    />;
  }

  return <GameOver winner={winner} players={room?.players || []} home={home} />;
}

function Home({name,setName,roomId,setRoomId,settings,setSettings,createRoom,joinRoom,error}) {
  const update = (key, value) => setSettings(s => ({...s, [key]: value}));
  return <div className="page home-page">
    <div className="hero">
      <div className="logo">✏️ Skribbl Clone</div>
      <p>Draw • Guess • Compete</p>
    </div>

    <div className="home-grid">
      <section className="card">
        <h2>Create Room</h2>
        <label>Your Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter name" maxLength={20}/>

        <div className="settings-grid">
          <div><label>Max Players</label><select value={settings.maxPlayers} onChange={e=>update("maxPlayers",e.target.value)}>{[2,4,6,8,10,15,20].map(x=><option key={x}>{x}</option>)}</select></div>
          <div><label>Rounds</label><select value={settings.rounds} onChange={e=>update("rounds",e.target.value)}>{[2,3,4,5,6,8,10].map(x=><option key={x}>{x}</option>)}</select></div>
          <div><label>Draw Time</label><select value={settings.drawTime} onChange={e=>update("drawTime",e.target.value)}>{[15,30,60,90,120,180,240].map(x=><option key={x}>{x}s</option>)}</select></div>
          <div><label>Word Choices</label><select value={settings.wordCount} onChange={e=>update("wordCount",e.target.value)}>{[1,2,3,4,5].map(x=><option key={x}>{x}</option>)}</select></div>
          <div><label>Hints</label><select value={settings.hints} onChange={e=>update("hints",e.target.value)}>{[0,1,2,3,4,5].map(x=><option key={x}>{x}</option>)}</select></div>
          <div><label>Category</label><select value={settings.category} onChange={e=>update("category",e.target.value)}><option value="all">All</option><option value="animals">Animals</option><option value="objects">Objects</option><option value="food">Food</option><option value="actions">Actions</option><option value="nature">Nature</option></select></div>
          <div><label>Word Language</label><select value={settings.language} onChange={e=>update("language",e.target.value)}>
            <option value="en">🇬🇧 English</option>
            <option value="hi">🇮🇳 Hindi</option>
            <option value="es">🇪🇸 Spanish</option>
            <option value="fr">🇫🇷 French</option>
          </select></div>
        </div>

        <button className="primary" onClick={createRoom}>Create Room</button>
      </section>

      <section className="card">
        <h2>Join Room</h2>
        <label>Your Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter name" maxLength={20}/>
        <label>Room Code</label>
        <input value={roomId} onChange={e=>setRoomId(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6}/>
        <button className="secondary" onClick={joinRoom}>Join Room</button>
        <p className="muted">Share the room code with your friends.</p>
      </section>
    </div>
    {error && <div className="error">{error}</div>}
  </div>
}

function Lobby({room,startGame,home}) {
  const isHost = room.hostId === socket.id;
  const copyLink = async () => {
    await navigator.clipboard?.writeText(`${location.origin}?room=${room.roomId}`);
    alert("Room link copied!");
  };
  return <div className="page">
    <div className="topbar"><div className="logo">✏️ Skribbl Clone</div><button className="ghost" onClick={home}>Leave</button></div>
    <div className="lobby card">
      <h1>Room {room.roomId}</h1>
      <p className="muted">Waiting for players...</p>
      <div className="room-share"><b>{room.roomId}</b><button onClick={copyLink}>Copy Invite Link</button></div>

      <div className="players-grid">
        {room.players.map((p,i)=><div className="player-card" key={p.id}>
          <div className="avatar">{p.name.charAt(0).toUpperCase()}</div>
          <div><b>{p.name}</b>{p.id===room.hostId && <span className="badge">HOST</span>}<small>{p.ready ? "Ready" : "Not ready"}</small></div>
        </div>)}
      </div>

      <div className="lobby-settings">
        <span>👥 {room.settings.maxPlayers} max</span>
        <span>🔄 {room.settings.rounds} rounds</span>
        <span>⏱️ {room.settings.drawTime}s</span>
        <span>💡 {room.settings.hints} hints</span><span>🌍 {room.settings.language === "hi" ? "Hindi" : room.settings.language === "es" ? "Spanish" : room.settings.language === "fr" ? "French" : "English"}</span>
      </div>

      {isHost ? <button className="primary" onClick={startGame}>Start Game</button> : <div className="waiting">Waiting for host to start...</div>}
    </div>
  </div>
}

function Game({room,roundOptions,chooseWord,hint,word,messages,input,setInput,sendGuessOrChat,canvasRef,roundWinner}) {
  const drawing = useDrawing(canvasRef, room.isDrawer && room.phase === "drawing");
  const [color,setColor] = useState("#111827");
  const [size,setSize] = useState(5);
  const [tool,setTool] = useState("brush");

  useEffect(() => {
    drawing.setColor(color);
    drawing.setSize(size);
    drawing.setTool(tool);
  }, [color,size]);

  return <div className="game-page">
    <header className="game-header">
      <div className="logo">✏️ Skribbl</div>
      <div className="round-info">Round {Math.ceil(room.round / Math.max(1, room.players.length))} / {room.settings.rounds}</div>
      <div className="timer">⏱ {room.timeLeft}s</div>
    </header>

    <main className="game-layout">
      <aside className="sidebar">
        <h3>Leaderboard</h3>
        {[...room.players].sort((a,b)=>b.score-a.score).map((p,i)=>
          <div className="score-row" key={p.id}><span>{i+1}. {p.name}</span><b>{p.score}</b></div>
        )}
      </aside>

      <section className="canvas-area">
        <div className="word-bar">
          {room.isDrawer ? (
            room.phase === "choosing" ? <b>Choose a word below</b> : <><span>Drawing:</span> <strong>{word}</strong></>
          ) : <><span>Guess:</span> <strong className="hint">{hint || "_ _ _ _ _"}</strong></>}
        </div>

        <div className="canvas-wrap">
          <canvas ref={canvasRef} width={900} height={560} />
          {room.isDrawer && room.phase === "choosing" && <div className="word-modal">
            <h2>Choose your word</h2>
            <div className="word-options">{roundOptions.map(w=><button key={w} onClick={()=>chooseWord(w)}>{w}</button>)}</div>
          </div>}
          {room.phase === "round_end" && <div className="round-overlay"><h2>Round Over</h2><p>{hint}</p></div>}
        </div>

        {room.isDrawer && room.phase === "drawing" && <div className="toolbar">
          <button className={tool === "brush" ? "tool-active" : ""} onClick={()=>setTool("brush")}>🖊 Brush</button>
          <button className={tool === "eraser" ? "tool-active" : ""} onClick={()=>setTool("eraser")}>🧽 Eraser</button>
          {["#111827","#ef4444","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#ffffff"].map(c=>
            <button key={c} className="color-btn" style={{background:c}} onClick={()=>{setColor(c);setTool("brush")}} />
          )}
          <select value={size} onChange={e=>setSize(Number(e.target.value))}><option value="3">Thin</option><option value="5">Medium</option><option value="10">Thick</option><option value="18">Very thick</option><option value="30">Huge</option></select>
          <button onClick={drawing.undo}>↩ Undo</button>
          <button onClick={drawing.clear}>🗑 Clear Canvas</button>
        </div>}
      </section>

      <aside className="chat">
        <h3>Chat / Guess</h3>
        <div className="messages">{messages.map((m,i)=><div className="message" key={i}><b>{m.playerName}:</b> {m.text}</div>)}</div>
        <div className="chat-input"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendGuessOrChat()} placeholder={room.isDrawer ? "Chat..." : "Type your guess..."}/><button onClick={sendGuessOrChat}>Send</button></div>
      </aside>
    </main>

    {roundWinner && (
      <div className="round-winner-backdrop">
        <div className="confetti confetti-a">✦</div>
        <div className="confetti confetti-b">✦</div>
        <div className="confetti confetti-c">✦</div>
        <div className="round-winner-card">
          <div className="winner-glow"></div>
          <div className="winner-icon">{roundWinner.name ? "🏆" : "⏰"}</div>
          <div className="winner-kicker">{roundWinner.name ? "ROUND WINNER" : "ROUND OVER"}</div>
          <h2>{roundWinner.name ? roundWinner.name : "Time's up!"}</h2>
          {roundWinner.name ? (
            <p><strong>+{roundWinner.points} points</strong> for the correct guess!</p>
          ) : (
            <p>Nobody guessed <strong>"{roundWinner.word}"</strong></p>
          )}
          <div className="winner-word">The word was <b>{roundWinner.word}</b></div>
          <div className="winner-score-preview">
            {roundWinner.scores.slice(0, 4).map((p, i) => (
              <span key={p.id}>#{i + 1} {p.name}: {p.score}</span>
            ))}
          </div>
          <div className="next-round-text">Next round starting…</div>
        </div>
      </div>
    )}
  </div>
}

function useDrawing(canvasRef, enabled) {
  const drawingRef = useRef(false);
  const lastRef = useRef({x:0,y:0});
  const colorRef = useRef("#111827");
  const sizeRef = useRef(5);
  const toolRef = useRef("brush");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const drawStroke = data => {
      if (data.type === "start") {
        ctx.globalCompositeOperation = data.tool === "eraser" ? "destination-out" : "source-over";
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.size;
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
        lastRef.current = {x:data.x,y:data.y};
      } else if (data.type === "move") {
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
        lastRef.current = {x:data.x,y:data.y};
      } else if (data.type === "end") {
        ctx.closePath();
      }
    };

    const onDraw = data => drawStroke(data);
    const onClear = () => ctx.clearRect(0,0,canvas.width,canvas.height);
    const onSnapshot = strokes => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      strokes.forEach(drawStroke);
    };

    socket.on("draw_data", onDraw);
    socket.on("canvas_clear", onClear);
    socket.on("canvas_snapshot", onSnapshot);
    socket.emit("request_canvas");

    return () => {
      socket.off("draw_data", onDraw);
      socket.off("canvas_clear", onClear);
      socket.off("canvas_snapshot", onSnapshot);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const point = e => ({
      x: (e.clientX - rect.left) * canvas.width / rect.width,
      y: (e.clientY - rect.top) * canvas.height / rect.height
    });

    const down = e => {
      if (!enabled) return;
      e.preventDefault();
      const p = point(e);
      drawingRef.current = true;
      lastRef.current = p;
      const ctx = canvas.getContext("2d");
      ctx.globalCompositeOperation = toolRef.current === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = sizeRef.current;
      ctx.beginPath();
      ctx.moveTo(p.x,p.y);
      socket.emit("draw_start",{...p,color:colorRef.current,size:sizeRef.current,tool:toolRef.current});
    };
    const move = e => {
      if (!enabled || !drawingRef.current) return;
      e.preventDefault();
      const p = point(e);
      const ctx = canvas.getContext("2d");
      ctx.globalCompositeOperation = toolRef.current === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = sizeRef.current;
      ctx.lineTo(p.x,p.y);
      ctx.stroke();
      socket.emit("draw_move",p);
      lastRef.current = p;
    };
    const up = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      canvas.getContext("2d").closePath();
      socket.emit("draw_end");
    };

    canvas.addEventListener("pointerdown",down);
    canvas.addEventListener("pointermove",move);
    window.addEventListener("pointerup",up);
    return () => {
      canvas.removeEventListener("pointerdown",down);
      canvas.removeEventListener("pointermove",move);
      window.removeEventListener("pointerup",up);
    };
  }, [enabled]);

  return {
    setColor: c => colorRef.current = c,
    setSize: s => sizeRef.current = s,
    setTool: t => toolRef.current = t,
    clear: () => { clearLocal(canvasRef.current); socket.emit("canvas_clear"); },
    undo: () => socket.emit("draw_undo")
  };
}

function clearLocal(canvas) {
  if (canvas) canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
}

function GameOver({winner,players,home}) {
  const leaderboard = [...players].sort((a,b)=>b.score-a.score);
  return <div className="page gameover">
    <div className="card result-card">
      <div className="trophy">🏆</div>
      <h1>Game Over!</h1>
      <p className="winner-text">{winner ? `${winner.name} wins!` : "Game finished"}</p>
      <div className="final-list">{leaderboard.map((p,i)=><div className="final-row" key={p.id}><span>#{i+1} {p.name}</span><b>{p.score} pts</b></div>)}</div>
      <button className="primary" onClick={home}>Back to Home</button>
    </div>
  </div>
}

export default App;