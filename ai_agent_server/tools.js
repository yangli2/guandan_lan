import axios from 'axios';
import config from './config.js';

const apiClient = axios.create({
    baseURL: `${config.GAME_SERVER_URL}${config.BOT_API_PREFIX}`,
});

export async function joinGame(playerName, roomId) {
    const res = await apiClient.post('/join', { playerName, roomId });
    return res.data;
}

export async function getGameState(playerId, roomId) {
    const res = await apiClient.get(`/state/${roomId}/${playerId}`);
    return res.data;
}

export async function playCards(playerId, roomId, cardIndices) {
    try {
        const res = await apiClient.post('/play', {
            playerId,
            roomId,
            cardIndices,
        });
        return res.data;
    } catch (error) {
        if (error.response && error.response.data && error.response.data.error) {
            return { success: false, error: error.response.data.error };
        }
        return { success: false, error: error.message };
    }
}
