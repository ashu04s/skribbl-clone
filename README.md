# Skribbl.io Clone — Web3Task Full Stack Intern Assignment

A real-time multiplayer drawing and guessing game built with React, Node.js, Express and Socket.IO.

## Features

- Create private rooms with configurable settings
- Join using room code
- Lobby and host-controlled game start
- Turn-based drawing
- Word selection
- Real-time HTML5 Canvas drawing
- Brush colors and sizes
- Eraser tool
- Undo and clear canvas
- Guessing and scoring
- Leaderboard
- Countdown timer
- Progressive hints
- Chat
- Game-over winner screen
- Responsive UI

## Project structure

```text
skribbl-clone/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   └── package.json
├── server/
│   ├── server.js
│   └── package.json
└── package.json
```

## Run locally

### 1. Install root dependencies

```bash
npm install
```

### 2. Install server/client dependencies

```bash
npm run install:all
```

### 3. Start both

```bash
npm run dev
```

Frontend:
http://localhost:5173

Backend:
http://localhost:5000

## Production

Set the frontend environment variable:

```env
VITE_SERVER_URL=https://YOUR-BACKEND-URL
```

Deploy the Node/Socket.IO server on Render or Railway and the React frontend on a static hosting platform. The assignment requires a public live URL and working create-room → draw → guess → score flow.

## Architecture

```text
React Client
   |
   | Socket.IO events
   v
Node + Express + Socket.IO
   |
   +-- Room state
   +-- Player state
   +-- Game rounds
   +-- Timer
   +-- Word selection
   +-- Score calculation
   |
   v
Broadcast to all clients
```

## Main WebSocket events

Room:
- create_room
- join_room
- player_joined
- player_left
- start_game

Game:
- game_state
- round_start
- choose_word
- word_chosen
- round_end
- game_over

Drawing:
- draw_start
- draw_move
- draw_end
- draw_data
- canvas_clear
- draw_undo

Chat:
- guess
- guess_result
- chat
- chat_message

## Code walkthrough

### Drawing

The drawer captures pointer coordinates on the HTML5 canvas. Each stroke is sent through Socket.IO to the server, which broadcasts the stroke to the other clients.

### Game state

The server owns the room, current drawer, current word, round, timer and scores. Clients receive game_state and other events.

### Guessing

The server trims and lowercases the guess and compares it with the current word. A correct guess awards points based on remaining time.

### Important deployment note

WebSockets need a backend service that supports persistent WebSocket connections. Render or Railway can host the Node/Socket.IO server. If the frontend is deployed separately, set `VITE_SERVER_URL` to the backend URL.

## Assignment source

This implementation follows the supplied Web3Task Full Stack Intern evaluation brief: multiplayer rooms, turn-based drawing, real-time drawing, word selection, scoring, leaderboard, WebSockets, deployment and README requirements.
