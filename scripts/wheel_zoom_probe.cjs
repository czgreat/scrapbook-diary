const path = require('node:path')
const { chromium } = require(process.env.PW_REQUIRE || 'playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4180/'

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.locator('.day-cell-placeholder').first().click()
    await page.setInputFiles(
      'input.calendar__file-input',
      path.resolve('/repo/reference/queensjournal/codex-a.jpg'),
    )
    await page.waitForSelector('.calendar__punch-overlay', { timeout: 10000 })

    const before = await page.evaluate(() => {
      const photo = document.querySelector('.calendar__workbench-photo')
      const device = document.querySelector('.calendar__punch-device')

      if (!photo || !device) {
        throw new Error('punch overlay not ready')
      }

      const photoRect = photo.getBoundingClientRect()
      const deviceRect = device.getBoundingClientRect()
      return {
        photo: {
          x: Math.round(photoRect.x),
          y: Math.round(photoRect.y),
          width: Math.round(photoRect.width),
          height: Math.round(photoRect.height),
        },
        device: {
          x: Math.round(deviceRect.x),
          y: Math.round(deviceRect.y),
          width: Math.round(deviceRect.width),
          height: Math.round(deviceRect.height),
        },
      }
    })

    const workbench = page.locator('.calendar__punch-workbench')
    await workbench.hover()
    await page.mouse.wheel(0, -320)
    await page.waitForTimeout(150)

    const afterZoomIn = await page.evaluate(() => {
      const photo = document.querySelector('.calendar__workbench-photo')
      const device = document.querySelector('.calendar__punch-device')

      if (!photo || !device) {
        throw new Error('punch overlay disappeared unexpectedly')
      }

      const photoRect = photo.getBoundingClientRect()
      const deviceRect = device.getBoundingClientRect()
      return {
        photo: {
          x: Math.round(photoRect.x),
          y: Math.round(photoRect.y),
          width: Math.round(photoRect.width),
          height: Math.round(photoRect.height),
        },
        device: {
          x: Math.round(deviceRect.x),
          y: Math.round(deviceRect.y),
          width: Math.round(deviceRect.width),
          height: Math.round(deviceRect.height),
        },
      }
    })

    await page.mouse.wheel(0, 320)
    await page.waitForTimeout(150)

    const afterZoomOut = await page.evaluate(() => {
      const photo = document.querySelector('.calendar__workbench-photo')
      const device = document.querySelector('.calendar__punch-device')

      if (!photo || !device) {
        throw new Error('punch overlay disappeared unexpectedly')
      }

      const photoRect = photo.getBoundingClientRect()
      const deviceRect = device.getBoundingClientRect()
      return {
        photo: {
          x: Math.round(photoRect.x),
          y: Math.round(photoRect.y),
          width: Math.round(photoRect.width),
          height: Math.round(photoRect.height),
        },
        device: {
          x: Math.round(deviceRect.x),
          y: Math.round(deviceRect.y),
          width: Math.round(deviceRect.width),
          height: Math.round(deviceRect.height),
        },
      }
    })

    console.log(
      JSON.stringify(
        {
          ok: true,
          before,
          afterZoomIn,
          afterZoomOut,
          photoScaledUp:
            afterZoomIn.photo.width > before.photo.width ||
            afterZoomIn.photo.height > before.photo.height,
          photoScaledDown:
            afterZoomOut.photo.width < afterZoomIn.photo.width ||
            afterZoomOut.photo.height < afterZoomIn.photo.height,
          deviceStayedMostlyPut:
            Math.abs(afterZoomOut.device.x - before.device.x) <= 1 &&
            Math.abs(afterZoomOut.device.y - before.device.y) <= 1,
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
