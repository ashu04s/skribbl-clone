# 🎨 Skribbl.io Clone — Web3Task Full Stack Intern Assignment

A real-time multiplayer drawing and guessing game built with React, Node.js, Express and Socket.IO.

Players can create or join private rooms, take turns drawing, guess the selected word, chat with other players and compete on a real-time leaderboard.

---

## 🚀 Live Demo

### Frontend
https://client-uiaz.vercel.app

### Backend
https://skribbl-clone-uoni.onrender.com

### GitHub Repository
https://github.com/ashu04s/skribbl-clone

---

## ✨ Features

### Multiplayer Game

- Create private rooms
- Join rooms using room code
- Lobby with player list
- Host-controlled game start
- Turn-based drawing
- Multiple game rounds
- Game-over winner screen

### Drawing

- Real-time HTML5 Canvas drawing
- Multiple brush colors
- Adjustable brush sizes
- Eraser tool
- Undo drawing
- Clear canvas
- Real-time drawing synchronization using Socket.IO

### Guessing & Scoring

- Word selection
- Real-time guessing
- Correct guess detection
- Score calculation
- Real-time leaderboard
- Countdown timer
- Progressive word hints

### Communication

- Real-time chat
- Guess messages
- Guess result feedback

### Additional Features

- Word categories
- Multiple language support
  - English
  - Hindi
  - Spanish
  - French
- Responsive UI

---

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- JavaScript
- HTML5 Canvas
- CSS
- Socket.IO Client

### Backend

- Node.js
- Express.js
- Socket.IO

### Deployment

- Frontend: Vercel
- Backend: Render
- Source Code: GitHub

---

## 📁 Project Structure

```text
skribbl-clone/
│
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   │
│   ├── index.html
│   ├── package.json
│   └── .env
│
├── server/
│   ├── server.js
│   └── package.json
│
├── package.json
├── package-lock.json
├── .gitignore
└── README.md