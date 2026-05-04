import { createOpencodeClient } from '@opencode-ai/sdk';

async function test() {
    const client = createOpencodeClient({ baseUrl: 'http://localhost:4096' });
    const sessionId = 'ses_test_' + Date.now();
    
    const createRes = await client.session.create({
        body: { id: sessionId, directory: process.cwd() }
    });

    console.log('Sending prompt...');
    const promptRes = await client.session.prompt({
        sessionID: sessionId,
        body: { parts: [{ type: 'text', text: 'Calculate 25 * 25. Output <final_move>[1]</final_move>' }] }
    });
    console.log('Prompt:', promptRes.error || 'Success');

    // fetch session messages
    const messagesRes = await client.session.messages({ sessionID: sessionId });
    
    if (messagesRes.data) {
        console.log('Messages:', messagesRes.data.map(m => m.info.role + ': ' + m.parts.map(p=>p.text).join(' ')));
    } else {
        console.log('Error:', messagesRes.error);
    }
}

test().catch(console.error);
