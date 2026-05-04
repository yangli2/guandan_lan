#!/bin/bash
# Start Guandan Server and 4 AI Agents autonomously with logging

LOG_DIR_SERVER=${1:-"./logs/server"}
LOG_DIR_AGENTS=${2:-"./logs/agents"}

echo "Starting Autonomous Guandan Game..."
echo "Server logs: $LOG_DIR_SERVER"
echo "Agent logs: $LOG_DIR_AGENTS"

# Start the server
echo "Starting Server on port 3001..."
(cd server && node index.js --log-dir "../$LOG_DIR_SERVER") &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start 4 agents
echo "Starting 4 AI Agents..."
for i in {1..4}
do
    PLAYER_NAME="Bot-$i"
    echo "Starting Agent: $PLAYER_NAME"
    (cd ai_agent_server && node index.js "$PLAYER_NAME" --log-dir "../$LOG_DIR_AGENTS") &
    PIDS+=($!)
done

echo "--------------------------------------------------"
echo "--- Autonomous Game Running ---"
echo "Press Ctrl+C to stop all processes."

# Trap Ctrl+C to stop all processes
trap "echo -e '\\nStopping all processes...'; kill $SERVER_PID ${PIDS[*]} 2>/dev/null; exit" INT

# Keep the script running
wait
