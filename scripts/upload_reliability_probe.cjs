const { chromium } = require(process.env.PW_REQUIRE || 'playwright')
const path = require('node:path')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4180/'

  try {
    const bootstrap = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    await bootstrap.goto(baseUrl, { waitUntil: 'networkidle' })
    const placeholders = bootstrap.locator('.day-cell-placeholder')
    const tries = Math.min(await placeholders.count(), 3)
    await bootstrap.close()
    const results = []

    for (let i = 0; i < tries; i += 1) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.locator('.day-cell-placeholder').nth(i).click()
      await page.setInputFiles(
        'input.calendar__file-input',
        path.resolve('/repo/reference/queensjournal/codex-a.jpg'),
      )
      const visible = await page
        .waitForSelector('.calendar__punch-overlay', { state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)

      results.push({ index: i, overlayVisible: visible })
      await page.close()
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          tries,
          results,
          allVisible: results.every((item) => item.overlayVisible),
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
