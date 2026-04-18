#!/bin/bash
# Guandan LAN - Installation Script

echo "--- Installing Guandan Multiplayer dependencies ---"

echo "Checking Node.js version..."
node -v

echo "Installing Backend dependencies (server/)..."
cd server && npm install
cd ..

echo "Installing Frontend dependencies (client/)..."
cd client && npm install
cd ..

echo "--------------------------------------------------"
echo "Done! You can now run ./start.sh to begin."
