#!/bin/bash

# AI Agent Launcher for Guandan
# Usage: ./start_ai.sh [playerName]

PLAYER_NAME=${1:-"AI-Pro-Guandan"}
AGENT_DIR="ai_agent_server"

echo "Starting AI Agent: $PLAYER_NAME..."
cd $AGENT_DIR && node index.js "$PLAYER_NAME"
