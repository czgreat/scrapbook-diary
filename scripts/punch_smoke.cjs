const { chromium } = require(process.env.PW_REQUIRE || 'playwright')
const path = require('node:path')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const logs = []

  page.on('console', (msg) => logs.push(`[console:${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.stack || err.message}`))

  try {
    await page.goto('http://127.0.0.1:4180/', { waitUntil: 'networkidle' })
    await page.screenshot({ path: '/repo/.codex-homepage.png', fullPage: true })

    const emptyTrigger = page.locator('.day-cell-placeholder').first()
    await emptyTrigger.waitFor({ state: 'visible', timeout: 10000 })
    await emptyTrigger.click()

    await page.setInputFiles(
      'input.calendar__file-input',
      path.resolve('/repo/reference/queensjournal/codex-a.jpg'),
    )
    await page.waitForSelector('.calendar__punch-overlay', { timeout: 10000 })
    await page.screenshot({ path: '/repo/.codex-punch-overlay.png', fullPage: true })

    const device = page.locator('.calendar__punch-device')
    await device.waitFor({ state: 'visible', timeout: 10000 })
    const before = await device.boundingBox()

    if (!before) {
      throw new Error('punch device has no bounding box')
    }

    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2 + 60, before.y + before.height / 2 + 40, {
      steps: 12,
    })
    await page.mouse.up()

    const after = await device.boundingBox()

    if (!after) {
      throw new Error('punch device missing after drag')
    }

    await device.click()
    await page.waitForSelector('.calendar__punch-overlay', {
      state: 'hidden',
      timeout: 15000,
    })
    await page.screenshot({ path: '/repo/.codex-after-stamp.png', fullPage: true })

    const stampedCount = await page.locator('.day-cell-stamp').count()
    await page.reload({ waitUntil: 'networkidle' })
    const stampedCountAfterReload = await page.locator('.day-cell-stamp').count()

    console.log(
      JSON.stringify(
        {
          ok: true,
          moved: {
            before: {
              x: Math.round(before.x),
              y: Math.round(before.y),
            },
            after: {
              x: Math.round(after.x),
              y: Math.round(after.y),
            },
          },
          stampedCount,
          stampedCountAfterReload,
          screenshots: [
            '/repo/.codex-homepage.png',
            '/repo/.codex-punch-overlay.png',
            '/repo/.codex-after-stamp.png',
          ],
          logs,
        },
        null,
        2,
      ),
    )
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
