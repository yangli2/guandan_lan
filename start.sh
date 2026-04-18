#!/bin/bash
# Guandan LAN - Start All Servers

echo "--- Starting Guandan Multiplayer ---"

# Start the backend server in the background
echo "Starting Backend on port 3001..."
cd server && npm start &
BACKEND_PID=$!
cd ..

# Start the frontend server in the background
echo "Starting Frontend on port 5173 (LAN access enabled)..."
cd client && npm run dev &
FRONTEND_PID=$!
cd ..

echo "--------------------------------------------------"
echo "--- Servers are running ---"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo "Check your local IP (e.g., 192.168.x.x) for LAN access."
echo "Press Ctrl+C to stop both servers."

# Trap Ctrl+C to stop both processes
trap "echo -e '\nStopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

# Keep the script running
wait
