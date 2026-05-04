import { createOpencodeClient } from '@opencode-ai/sdk';

async function debug(sessionId) {
    const client = createOpencodeClient({ baseUrl: 'http://localhost:4096' });
    
    console.log('--- TRYING path: { id: sessionId } ---');
    const res1 = await client.session.messages({ path: { id: sessionId } });
    console.log('Res 1 Data:', res1.data ? 'Success' : 'Fail');
    
    console.log('--- TRYING path: { sessionID: sessionId } ---');
    const res2 = await client.session.messages({ path: { sessionID: sessionId } });
    console.log('Res 2 Data:', res2.data ? 'Success' : 'Fail');

    console.log('--- TRYING sessionID: sessionId (flat) ---');
    const res3 = await client.session.messages({ sessionID: sessionId });
    console.log('Res 3 Data:', res3.data ? 'Success' : 'Fail');
}

const sid = process.argv[2];
if (sid) {
    debug(sid).catch(console.error);
} else {
    console.log('Usage: node debug_messages.js <sessionId>');
}
