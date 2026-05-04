import 'dotenv/config';

export default {
    GAME_SERVER_URL: process.env.GAME_SERVER_URL || 'http://127.0.0.1:3001',
    BOT_API_PREFIX: '/api/bot',
    PLAYER_NAME: process.env.PLAYER_NAME || 'AI-Pro-Guandan',
    ROOM_ID: process.env.ROOM_ID || 'main',
    POLL_INTERVAL: 2000,
    REASONING_LEVEL: process.env.REASONING_LEVEL || 'DEEP', // Options: BASIC, ADVANCED, DEEP
};
