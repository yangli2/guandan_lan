import { test, expect } from '@playwright/test';

test.describe('Guandan Tribute Process', () => {
  test('should handle tribute and interactive return in second round', async ({ browser }) => {
    test.setTimeout(180000);

    const contexts = await Promise.all([
      browser.newContext({ recordVideo: { dir: 'test-results/videos' } }),
      browser.newContext({ recordVideo: { dir: 'test-results/videos' } }),
      browser.newContext({ recordVideo: { dir: 'test-results/videos' } }),
      browser.newContext({ recordVideo: { dir: 'test-results/videos' } })
    ]);

    const [p1, p2, p3, p4] = await Promise.all(contexts.map(c => c.newPage()));
    const players = [p1, p2, p3, p4];
    const names = ['Alice', 'Bob', 'Charlie', 'Dave'];

    // Join all players
    for (let i = 0; i < 4; i++) {
      const page = players[i];
      await page.goto('/');
      await expect(page.locator('#connection-status')).toContainText('Server Connected', { timeout: 20000 });
      
      if (i === 0) {
        // Reset server state once from Alice's browser
        await page.click('button:has-text("Reset All Server State")');
        await page.waitForTimeout(1000);
      }

      await page.fill('input[type="text"]', names[i]);
      await page.click('button:has-text("Join Table")');
      await expect(page.locator('h2:has-text("GUANDAN")')).toBeVisible({ timeout: 15000 });
    }

    // Alice starts the game
    await p1.click('button:has-text("Start Game")');
    for (const page of players) {
        await expect(page.locator('.player-hand')).toBeVisible();
    }

    console.log("--- Round 1 Starting ---");

    // Play Round 1 until finished
    let loops = 0;
    while (loops < 60) {
        if (await p1.locator('.finished-overlay').isVisible()) break;

        let activePlayer = null;
        let activeName = '';
        for (let i = 0; i < 4; i++) {
            if (await players[i].locator('.player-box.bottom.active').isVisible()) {
                activePlayer = players[i];
                activeName = names[i];
                break;
            }
        }

        if (activePlayer) {
            const cards = activePlayer.locator('.player-hand .card');
            if (await cards.count() > 0) {
                await cards.first().click({ force: true });
                await activePlayer.click('button:has-text("Play Cards")');
            }
        }
        await p1.waitForTimeout(800);
        loops++;
    }

    await expect(p1.locator('.finished-overlay')).toBeVisible({ timeout: 10000 });
    console.log("--- Round 1 Finished. Starting Round 2 ---");

    // Click Next Round to trigger tribute logic for Round 2
    await p1.click('button:has-text("Next Round")');

    // Wait for Tribute State
    // In E2E_SHORT_GAME, the initial tribute is automated, but the return is manual.
    // So it should land in RETURN_TRIBUTE state quickly.
    await expect(p1.locator('.tribute-panel')).toBeVisible({ timeout: 15000 });
    console.log("✅ Tribute Panel is visible.");

    // Wait a moment for all clients to catch up to the state change
    await p1.waitForTimeout(2000);

    // Determine who needs to return. In this E2E scenario, p1 usually wins.
    // We check every player for the "Return Selected Card" button.
    let returner = null;
    let returnerName = '';
    for (let i = 0; i < 4; i++) {
        const btn = players[i].locator('button', { hasText: 'Return Selected Card' });
        if (await btn.isVisible()) {
            returner = players[i];
            returnerName = names[i];
            break;
        }
    }

    expect(returner).not.toBeNull();
    console.log(`✅ ${returnerName} identified as the returner.`);

    // Perform the return
    await returner.locator('.player-hand .card').first().click({ force: true });
    await returner.click('button:has-text("Return Selected Card")');

    // Verify game resumes to PLAYING state (no tribute panel, pass button visible if active)
    await expect(p1.locator('.tribute-panel')).not.toBeVisible({ timeout: 10000 });
    console.log("✅ Tribute completed. Game resumed.");

    // Final verification of log
    const log = await p1.locator('#game-log').innerText();
    expect(log).toContain('returned a card');
  });
});
