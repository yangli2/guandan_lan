import { createOpencodeClient } from '@opencode-ai/sdk';

async function test() {
    const client = createOpencodeClient({ baseUrl: 'http://localhost:4096' });
    const sessionId = 'ses_test_' + Date.now();
    
    await client.session.create({
        body: {
            id: sessionId,
            directory: process.cwd()
        }
    });

    console.log('Sending prompt...');
    const result = await client.session.prompt({
        path: { id: sessionId },
        body: {
            parts: [{ type: 'text', text: 'Output <move>success</move>' }]
        }
    });

    console.log(JSON.stringify(result.data, null, 2));
}

test().catch(console.error);
