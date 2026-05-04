# Guandan LAN (掼蛋)

A modern, high-performance web implementation of the classic Chinese card game **Guandan (掼蛋)**. Designed for real-time multiplayer over a local network or the internet.

![Guandan Gameplay](https://raw.githubusercontent.com/yangli2/guandan_lan/main/client/public/favicon.svg) <!-- Shorthand placeholder for logo -->

## 🌟 Features

- **Real-time Multiplayer**: Powered by Socket.io for synchronous gameplay across 4 players.
- **Full Rule Support**:
  - **Tribute System**: Automated "Give Tribute" (highest card) and interactive "Return Tribute".
  - **Leveling Progression**: Team-based levels (2 to Ace) with automatic advancement.
  - **Special Rules**: Level A failure penalty (reset to Level 2 after 3 failed attempts).
  - **Wild Cards**: Dynamic level-based wild cards (Red Hearts of current level).
- **Premium UI/UX**:
  - **Clean Layout**: Hand cards organized by rank in vertical stacks for easy management of 27 cards.
  - **Visual Clarity**: High-contrast card designs with curated "Dark Text" theme.
  - **Modern Aesthetics**: Glassmorphism effects, smooth transitions, and responsive design.
- **Admin Controls**: Server-wide reset functionality to clear game state and re-initialize sessions.
- **Developer Ready**: Includes a REST API for bot control and automated E2E testing with Playwright.
- **Control Interface**: File-based control system for external automation.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (v9 or higher)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yangli2/guandan_lan.git
   cd guandan_lan
   ```

2. **Install Server dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Install Client dependencies**:
   ```bash
   cd ../client
   npm install
   ```

### Running Locally

1. **Start the Backend Server**:
   ```bash
   cd server
   npm start # or node index.js
   ```
   The server will run on `http://localhost:3001`.

2. **Start the Frontend Dev Server**:
   ```bash
   cd client
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

## 🎮 How to Play

1. Open the application in four separate tabs (or have four players join).
2. Enter a unique name for each player and join the room.
3. Once 4 players have joined, the first player can click **Start Game**.
4. Follow the turn indicators to play combos or pass.
5. In the **Tribute Phase**, losers will automatically give their highest cards, and winners must select one card from their hand to return.

## 🛠️ Technology Stack
- **Frontend**: React (v19), Vite, Lucide React (Icons), Vanilla CSS.
- **Backend**: Node.js, Express, Socket.io.
- **Testing**: Playwright (E2E).

## 🤖 Developer API & Automation

### Bot REST API
Allows external bots to participate in games without a browser.
- `POST /api/bot/join`: Join a room. Body: `{ roomId, playerName }`
- `GET /api/bot/state/:roomId/:playerId`: Get game state and player's hand.
- `POST /api/bot/play`: Play cards. Body: `{ roomId, playerId, cardIndices }`

### Control Interface (File-based)
The server watches `server/control_in.json` for commands and writes to `server/control_out.json`.
- **SERVER_PLAY**: Forces the current player to play specific cards.
- **GET_STATE**: Requests the current state of a specific room.

## 📄 License


This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Created with ❤️ for Guandan enthusiasts.*
