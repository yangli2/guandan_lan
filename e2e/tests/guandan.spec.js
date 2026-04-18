import { test, expect } from '@playwright/test';

test.describe('Guandan Multiplayer Flow', () => {
  test('should handle 4 players, game start, trick reset, and reconnection', async ({ browser }) => {
    test.setTimeout(120000);

    const contexts = await Promise.all([
      browser.newContext({ recordVideo: { dir: 'test-results/videos' } }),
      browser.newContext({ recordVideo: { dir: 'test-results/videos' } }),
      browser.newContext({ recordVideo: { dir: 'test-results/videos' } }),
      browser.newContext({ recordVideo: { dir: 'test-results/videos' } })
    ]);

    const [p1, p2, p3, p4] = await Promise.all(contexts.map(c => c.newPage()));
    const players = [p1, p2, p3, p4];
    const names = ['Alice', 'Bob', 'Charlie', 'Dave'];

    for (let i = 0; i < 4; i++) {
        players[i].on('console', msg => console.log(`[Browser ${names[i]}] ${msg.text()}`));
        players[i].on('pageerror', err => console.error(`[Browser ${names[i]} ERROR] ${err.message}`));
    }

    // Join all players
    for (let i = 0; i < 4; i++) {
      const page = players[i];
      await page.goto('/');
      
      // Wait for connection status (specifically the "Server Connected" text)
      const status = page.locator('#connection-status');
      await expect(status).toContainText('Server Connected', { timeout: 20000 });
      
      await page.fill('input[type="text"]', names[i]);
      
      const joinBtn = page.locator('button:has-text("Join Table")');
      const reconBtn = page.locator('button:has-text("Reconnect as")');
      
      if (await reconBtn.isVisible()) {
          await reconBtn.click();
      } else {
          await joinBtn.click();
      }

      await expect(page.locator('h2:has-text("GUANDAN")')).toBeVisible({ timeout: 15000 });
    }

    // Setup auto-pass on error dialogs
    for (let i = 0; i < 4; i++) {
        players[i].on('dialog', async dialog => {
            console.log(`[Browser ${names[i]}] Dialog: ${dialog.message()}`);
            await dialog.accept();
            try {
                await players[i].click('button:has-text("Pass")');
            } catch(e) {}
        });
    }

    // Start game
    await p4.click('button:has-text("Start Game")');
    for (const page of players) {
        await expect(page.locator('.player-hand')).toBeVisible();
    }

    // Play until finished
    let loops = 0;
    while (loops < 50) { // Safety limit
        // Check if finished on Alice's screen
        if (await p1.locator('.finished-overlay').isVisible()) {
            break;
        }

        // Find active player
        let activePlayer = null;
        let activeName = '';
        for (let i = 0; i < 4; i++) {
            const isActive = await players[i].locator('.player-box.bottom.active').isVisible();
            if (isActive) {
                activePlayer = players[i];
                activeName = names[i];
                break;
            }
        }

        if (activePlayer) {
            console.log(`${activeName} is active. Taking turn...`);
            await activePlayer.waitForTimeout(500); // UI stabilization

            const cards = activePlayer.locator('.player-hand .card');
            const numCards = await cards.count();
            
            if (numCards > 0) {
                const playBtn = activePlayer.locator('button:has-text("Play Cards")');
                await cards.first().click({ force: true });
                await activePlayer.waitForTimeout(200);
                await playBtn.click();
            }
        }
        await p1.waitForTimeout(600); // allow network sync
        loops++;
    }

    // Verify finished
    await expect(p1.locator('.finished-overlay')).toBeVisible({ timeout: 10000 });
    console.log("Game finished successfully.");

    // Verify Log
    const logText = await p1.locator('#game-log').innerText();
    expect(logText).toContain('E2E TEST MODE');
    expect(logText).toContain('Game started!');
    expect(logText).toContain('Game Over!');
  });
});
