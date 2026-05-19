import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import html2canvas from 'html2canvas'
import './App.css'
import {
  deleteEntry,
  getMonthEntries,
  putEntry,
  type DiaryEntry,
  type DiaryImage,
} from './storage'

const DEFAULT_FRAME_STYLE = 'stamp'
const DEFAULT_RATIO_ID = 'stamp'
const PUNCH_MIN_ZOOM = 1
const PUNCH_MAX_ZOOM = 12
const DEFAULT_CROP_X = 50
const DEFAULT_CROP_Y = 50
const PUNCH_PRESS_DELAY = 300
const PUNCH_FADE_DELAY = 430
const PUNCH_COMMIT_DELAY = 1100

const MONTH_PICKER_LABELS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const LANGUAGES = [
  {
    code: 'jp',
    label: 'JP',
    locale: 'ja-JP',
    weekdays: ['日', '月', '火', '水', '木', '金', '土'],
  },
  {
    code: 'en',
    label: 'EN',
    locale: 'en-US',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  {
    code: 'kr',
    label: 'KR',
    locale: 'ko-KR',
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
  },
  {
    code: 'id',
    label: 'ID',
    locale: 'id-ID',
    weekdays: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  },
  {
    code: 'hi',
    label: 'HI',
    locale: 'hi-IN',
    weekdays: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
  },
  {
    code: 'pt',
    label: 'PT',
    locale: 'pt-BR',
    weekdays: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  },
  {
    code: 'es',
    label: 'ES',
    locale: 'es-ES',
    weekdays: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  },
  {
    code: 'ar',
    label: 'AR',
    locale: 'ar-EG',
    weekdays: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
  },
  {
    code: 'zh',
    label: 'ZH',
    locale: 'zh-CN',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
  },
] as const

type LangCode = (typeof LANGUAGES)[number]['code']

type CalendarDay = {
  day: number
  dateKey: string
  isCurrentMonth?: boolean
}

type CalendarViewMode = 'month' | 'week'

type PunchDraft = {
  dateKey: string
  imageUrl: string
  aspectRatio: number
}

type PunchCropState = {
  panX: number
  panY: number
  zoom: number
  sourceAspect: number
}

type StampFlight = {
  left: number
  top: number
  width: number
  height: number
  targetLeft: number
  targetTop: number
  targetWidth: number
  targetHeight: number
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  pointerOffsetX: number
  pointerOffsetY: number
}

type PunchGuideMetrics = {
  deviceWidth: number
  deviceHeight: number
  holeLeft: number
  holeTop: number
  holeWidth: number
  holeHeight: number
  holeCenterX: number
  holeCenterY: number
}

type PreviewOffset = {
  x: number
  y: number
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toMonthKey(date: Date) {
  return toDateKey(date).slice(0, 7)
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isRotatedPunchOverlay() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches
  )
}

function clientToWorkbenchPoint(clientX: number, clientY: number, workbench: HTMLDivElement | null) {
  if (!workbench) {
    return { x: 0, y: 0 }
  }

  if (!isRotatedPunchOverlay()) {
    const rect = workbench.getBoundingClientRect()
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const overlay = workbench.closest<HTMLElement>('.calendar__punch-overlay')

  if (!overlay) {
    const rect = workbench.getBoundingClientRect()
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const style = getComputedStyle(overlay)
  const matrix = new DOMMatrix(style.transform)
  const overlayRect = overlay.getBoundingClientRect()
  const overlayCenterX = overlayRect.left + overlayRect.width / 2
  const overlayCenterY = overlayRect.top + overlayRect.height / 2
  const relativeX = clientX - overlayCenterX
  const relativeY = clientY - overlayCenterY
  const inverse = matrix.inverse()
  const unrotatedX = inverse.a * relativeX + inverse.c * relativeY
  const unrotatedY = inverse.b * relativeX + inverse.d * relativeY
  const overlayX = unrotatedX + overlay.offsetWidth / 2
  const overlayY = unrotatedY + overlay.offsetHeight / 2

  let offsetX = 0
  let offsetY = 0
  let current: HTMLElement | null = workbench

  while (current && current !== overlay) {
    offsetX += current.offsetLeft
    offsetY += current.offsetTop
    current = current.offsetParent as HTMLElement | null
  }

  return {
    x: overlayX - offsetX,
    y: overlayY - offsetY,
  }
}

function mapTouchDelta(deltaX: number, deltaY: number) {
  if (!isRotatedPunchOverlay()) {
    return {
      dx: deltaX,
      dy: deltaY,
    }
  }

  return {
    dx: deltaY,
    dy: -deltaX,
  }
}

function formatMonthLabel(date: Date) {
  return MONTH_PICKER_LABELS[date.getMonth()]
}

function longLabel(dateKey: string, langCode: LangCode) {
  const language = LANGUAGES.find((item) => item.code === langCode) || LANGUAGES[0]
  return new Intl.DateTimeFormat(language.locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parseDateKey(dateKey))
}

function buildMonthWeeks(date: Date) {
  const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const firstWeekday = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  const totalSlots = Math.ceil((firstWeekday + totalDays) / 7) * 7

  return Array.from({ length: totalSlots / 7 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const slot = weekIndex * 7 + dayIndex
      const dayNumber = slot - firstWeekday + 1

      if (dayNumber < 1 || dayNumber > totalDays) {
        return null
      }

      return {
        day: dayNumber,
        dateKey: toDateKey(new Date(date.getFullYear(), date.getMonth(), dayNumber)),
      }
    }),
  )
}

function startOfWeek(date: Date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (base.getDay() + 6) % 7
  base.setDate(base.getDate() - weekday)
  return base
}

function endOfWeek(date: Date) {
  const base = startOfWeek(date)
  base.setDate(base.getDate() + 6)
  return base
}

function buildContinuousWeek(dateKey: string, currentMonthKey: string) {
  const anchor = parseDateKey(dateKey)
  const start = startOfWeek(anchor)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    return {
      day: date.getDate(),
      dateKey: toDateKey(date),
      isCurrentMonth: toMonthKey(date) === currentMonthKey,
    } satisfies CalendarDay
  })
}

function buildMonthOverviewWeeks(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const start = startOfWeek(firstDay)
  const end = endOfWeek(lastDay)
  const currentMonthKey = toMonthKey(firstDay)
  const days: CalendarDay[] = []

  for (
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    cursor <= end;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  ) {
    days.push({
      day: cursor.getDate(),
      dateKey: toDateKey(cursor),
      isCurrentMonth: toMonthKey(cursor) === currentMonthKey,
    })
  }

  return Array.from({ length: days.length / 7 }, (_, weekIndex) =>
    days.slice(weekIndex * 7, weekIndex * 7 + 7),
  )
}

function findWeekIndex(weeks: Array<Array<CalendarDay | null>>, dateKey: string) {
  return weeks.findIndex((week) => week.some((day) => day?.dateKey === dateKey))
}

function pickWeekAnchorDay(
  week: Array<CalendarDay | null>,
  side: 'first' | 'last' = 'first',
) {
  const days = week.filter((day): day is CalendarDay => day !== null)

  if (days.length === 0) {
    return null
  }

  return side === 'last' ? days[days.length - 1] : days[0]
}

function toMondayFirstWeek<T>(week: readonly T[]) {
  return [...week.slice(1), week[0]]
}

function formatPlannerMonthName(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
  }).format(date)
}

const STAMP_PATH_SIZE = 100
const STAMP_RENDER_WIDTH = 130
const STAMP_RENDER_HEIGHT = 160
const STAMP_NOTCH = 7
const STAMP_INSET = 8
const STAMP_STEPS = 10
const STAMP_SCALE_X = STAMP_RENDER_WIDTH / STAMP_PATH_SIZE
const STAMP_SCALE_Y = STAMP_RENDER_HEIGHT / STAMP_PATH_SIZE
const PUNCH_DEVICE_WIDTH_FACTOR = 2.2
const PUNCH_DEVICE_ASPECT = 3 / 4
const PUNCH_GUIDE_IMAGE_ASPECT = 427 / 585
const PUNCH_HOLE_LEFT = 0.324
const PUNCH_HOLE_TOP = 0.206
const PUNCH_HOLE_SIZE = 0.352

function buildStampPath() {
  const start = STAMP_INSET
  const end = STAMP_PATH_SIZE - STAMP_INSET
  const step = (end - start) / STAMP_STEPS
  const radius = Math.min(STAMP_NOTCH, step * 0.45)
  const commands: string[] = []

  commands.push(`M ${start} ${start}`)

  for (let index = 0; index < STAMP_STEPS; index += 1) {
    const edgeStart = start + index * step
    const center = edgeStart + step / 2
    const edgeEnd = edgeStart + step
    commands.push(
      `L ${center - radius} ${start}`,
      `A ${radius} ${radius} 0 0 1 ${center + radius} ${start}`,
      `L ${edgeEnd} ${start}`,
    )
  }

  for (let index = 0; index < STAMP_STEPS; index += 1) {
    const edgeStart = start + index * step
    const center = edgeStart + step / 2
    const edgeEnd = edgeStart + step
    commands.push(
      `L ${end} ${center - radius}`,
      `A ${radius} ${radius} 0 0 1 ${end} ${center + radius}`,
      `L ${end} ${edgeEnd}`,
    )
  }

  for (let index = STAMP_STEPS - 1; index >= 0; index -= 1) {
    const edgeStart = start + index * step
    const center = edgeStart + step / 2
    commands.push(
      `L ${center + radius} ${end}`,
      `A ${radius} ${radius} 0 0 1 ${center - radius} ${end}`,
      `L ${edgeStart} ${end}`,
    )
  }

  for (let index = STAMP_STEPS - 1; index >= 0; index -= 1) {
    const edgeStart = start + index * step
    const center = edgeStart + step / 2
    commands.push(
      `L ${start} ${center + radius}`,
      `A ${radius} ${radius} 0 0 1 ${start} ${center - radius}`,
      `L ${start} ${edgeStart}`,
    )
  }

  commands.push('Z')
  return commands.join(' ')
}

const STAMP_PATH = buildStampPath()

function createImageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function randomRotation() {
  return Math.round((Math.random() * 10 - 5) * 10) / 10
}

function normalizeImage(
  image: Partial<DiaryImage> | undefined,
  fallbackId: string,
  url = '',
): DiaryImage {
  return {
    id: image?.id || fallbackId,
    url: image?.url ?? url,
    frameStyle: image?.frameStyle || DEFAULT_FRAME_STYLE,
    ratioId: image?.ratioId || DEFAULT_RATIO_ID,
    rotationDeg:
      typeof image?.rotationDeg === 'number'
        ? clamp(image.rotationDeg, -12, 12)
        : 0,
    sourceAspect:
      typeof image?.sourceAspect === 'number' && image.sourceAspect > 0
        ? image.sourceAspect
        : 1,
    cropScale:
      typeof image?.cropScale === 'number'
        ? clamp(image.cropScale, PUNCH_MIN_ZOOM, PUNCH_MAX_ZOOM)
        : PUNCH_MIN_ZOOM,
    cropX:
      typeof image?.cropX === 'number'
        ? clamp(image.cropX, 0, 100)
        : DEFAULT_CROP_X,
    cropY:
      typeof image?.cropY === 'number'
        ? clamp(image.cropY, 0, 100)
        : DEFAULT_CROP_Y,
  }
}

function normalizeEntry(
  entry:
    | (Partial<DiaryEntry> & {
        imageDataUrl?: string
      })
    | undefined,
  dateKey: string,
  monthKey: string,
): DiaryEntry {
  const images = Array.isArray(entry?.images)
    ? entry.images
        .filter((item) => typeof item?.url === 'string' && item.url.length > 0)
        .map((item) => normalizeImage(item, item.id || createImageId()))
    : entry?.imageDataUrl
      ? [normalizeImage({ url: entry.imageDataUrl }, createImageId(), entry.imageDataUrl)]
      : []

  return {
    dateKey,
    monthKey: entry?.monthKey ?? monthKey,
    title: entry?.title ?? '',
    note: entry?.note ?? '',
    topics: Array.isArray(entry?.topics) ? entry.topics : [],
    location: entry?.location ?? '',
    visibility: entry?.visibility ?? 'public',
    publishMode: entry?.publishMode ?? 'instant',
    scheduledAt: entry?.scheduledAt ?? '',
    erased: entry?.erased === true,
    images,
    coverImageId:
      images.find((item) => item.id === entry?.coverImageId)?.id ||
      images[0]?.id ||
      '',
    createdAt: entry?.createdAt ?? '',
    updatedAt: entry?.updatedAt ?? '',
  }
}

function getStampImage(entry: DiaryEntry) {
  return entry.images.find((item) => item.id === entry.coverImageId) || entry.images[0] || null
}

function entryHasContent(entry: DiaryEntry) {
  return Boolean(
    entry.erased ||
    entry.images.length > 0 ||
      entry.note.trim() ||
      entry.title.trim() ||
      entry.topics.length > 0 ||
      entry.location.trim(),
  )
}

async function fileToCompressedData(file: File) {
  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Image load failed'))
      nextImage.src = imageUrl
    })

    const maxSide = 1800
    const scale = clamp(maxSide / Math.max(image.width, image.height), 0, 1)
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Canvas context unavailable')
    }

    canvas.width = width
    canvas.height = height
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)

    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      aspectRatio: width / height,
    }
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 1000)
}

function fitImageRect(sourceAspect: number, frameWidth: number, frameHeight: number) {
  const frameAspect = frameWidth / frameHeight

  if (sourceAspect > frameAspect) {
    return {
      width: frameHeight * sourceAspect,
      height: frameHeight,
    }
  }

  return {
    width: frameWidth,
    height: frameWidth / sourceAspect,
  }
}

function fitContainedRect(sourceAspect: number, frameWidth: number, frameHeight: number) {
  const frameAspect = frameWidth / frameHeight

  if (sourceAspect > frameAspect) {
    return {
      width: frameWidth,
      height: frameWidth / sourceAspect,
    }
  }

  return {
    width: frameHeight * sourceAspect,
    height: frameHeight,
  }
}

function createPunchCrop(sourceAspect = 1): PunchCropState {
  return {
    panX: 0,
    panY: 0,
    zoom: PUNCH_MIN_ZOOM,
    sourceAspect: sourceAspect > 0 ? sourceAspect : 1,
  }
}

function imageToPunchCrop(image: DiaryImage | null | undefined, sourceAspect = 1): PunchCropState {
  if (!image) {
    return createPunchCrop(sourceAspect)
  }

  return {
    panX: clamp((DEFAULT_CROP_X - image.cropX) / 50, -1, 1),
    panY: clamp((DEFAULT_CROP_Y - image.cropY) / 50, -1, 1),
    zoom: clamp(image.cropScale, PUNCH_MIN_ZOOM, PUNCH_MAX_ZOOM),
    sourceAspect: sourceAspect > 0 ? sourceAspect : image.sourceAspect > 0 ? image.sourceAspect : 1,
  }
}

function punchCropToStoredCrop(crop: PunchCropState) {
  return {
    cropScale: clamp(crop.zoom, PUNCH_MIN_ZOOM, PUNCH_MAX_ZOOM),
    cropX: clamp(DEFAULT_CROP_X - clamp(crop.panX, -1, 1) * 50, 0, 100),
    cropY: clamp(DEFAULT_CROP_Y - clamp(crop.panY, -1, 1) * 50, 0, 100),
  }
}

function xw(
  crop: PunchCropState | Pick<DiaryImage, 'sourceAspect' | 'cropScale' | 'cropX' | 'cropY'> | null | undefined,
  frameWidth: number,
  frameHeight: number,
) {
  const normalized =
    crop && 'zoom' in crop
      ? crop
      : imageToPunchCrop(
          crop
            ? ({
                id: '',
                url: '',
                frameStyle: DEFAULT_FRAME_STYLE,
                ratioId: DEFAULT_RATIO_ID,
                rotationDeg: 0,
                sourceAspect: crop?.sourceAspect ?? 1,
                cropScale: crop?.cropScale ?? PUNCH_MIN_ZOOM,
                cropX: crop?.cropX ?? DEFAULT_CROP_X,
                cropY: crop?.cropY ?? DEFAULT_CROP_Y,
              } satisfies DiaryImage)
            : null,
          crop?.sourceAspect ?? 1,
        )
  const sourceAspect = normalized.sourceAspect > 0 ? normalized.sourceAspect : 1
  const zoom = clamp(normalized.zoom, PUNCH_MIN_ZOOM, PUNCH_MAX_ZOOM)
  const fitted = fitImageRect(sourceAspect, frameWidth, frameHeight)
  const scaledWidth = fitted.width * zoom
  const scaledHeight = fitted.height * zoom
  const offsetX = Math.max(0, (scaledWidth - frameWidth) / 2)
  const offsetY = Math.max(0, (scaledHeight - frameHeight) / 2)
  const panX = clamp(normalized.panX, -1, 1) * offsetX
  const panY = clamp(normalized.panY, -1, 1) * offsetY

  return {
    x: (frameWidth - scaledWidth) / 2 + panX,
    y: (frameHeight - scaledHeight) / 2 + panY,
    width: scaledWidth,
    height: scaledHeight,
  }
}

function derivePunchCropFromPreviewState(
  sourceAspect: number,
  stageWidth: number,
  stageHeight: number,
  holeCenterX: number,
  holeCenterY: number,
  holeHeight: number,
  previewZoom: number,
  previewOffset: PreviewOffset,
): PunchCropState {
  const normalizedAspect = sourceAspect > 0 ? sourceAspect : 1
  const zoom = clamp(previewZoom, PUNCH_MIN_ZOOM, PUNCH_MAX_ZOOM)
  const fitted = fitImageRect(normalizedAspect, stageWidth, stageHeight)
  const baseLeft = (stageWidth - fitted.width) / 2
  const baseTop = (stageHeight - fitted.height) / 2
  const scaledWidth = fitted.width * zoom
  const scaledHeight = fitted.height * zoom
  const scaledLeft = (stageWidth - scaledWidth) / 2 + previewOffset.x
  const scaledTop = (stageHeight - scaledHeight) / 2 + previewOffset.y
  const imageSpaceX = baseLeft + (holeCenterX - scaledLeft) / zoom
  const imageSpaceY = baseTop + (holeCenterY - scaledTop) / zoom
  const visibleHoleHeight = holeHeight / zoom
  const heightRatio = Math.max(0.001, visibleHoleHeight / stageHeight)
  const derivedZoom = clamp(1 / heightRatio, PUNCH_MIN_ZOOM, PUNCH_MAX_ZOOM)
  const normalizedImageX = imageSpaceX / stageWidth
  const normalizedImageY = imageSpaceY / stageHeight
  const aspectScaleX = normalizedAspect > 1 ? normalizedAspect : 1
  const aspectScaleY = normalizedAspect > 1 ? 1 : 1 / normalizedAspect
  const scaledSpanX = aspectScaleX * derivedZoom
  const scaledSpanY = aspectScaleY * derivedZoom
  const insetX = (1 - scaledSpanX) / 2
  const insetY = (1 - scaledSpanY) / 2
  const overflowX = Math.max(0, (scaledSpanX - 1) / 2)
  const overflowY = Math.max(0, (scaledSpanY - 1) / 2)
  const projectedX = insetX + normalizedImageX * scaledSpanX
  const projectedY = insetY + normalizedImageY * scaledSpanY

  return {
    sourceAspect: normalizedAspect,
    zoom: derivedZoom,
    panX: overflowX > 0 ? clamp((0.5 - projectedX) / overflowX, -1, 1) : 0,
    panY: overflowY > 0 ? clamp((0.5 - projectedY) / overflowY, -1, 1) : 0,
  }
}

function getPreviewImageRect(
  sourceAspect: number,
  stageWidth: number,
  stageHeight: number,
  previewZoom: number,
  previewOffset: PreviewOffset,
) {
  const fitted = fitImageRect(sourceAspect > 0 ? sourceAspect : 1, stageWidth, stageHeight)
  const zoom = clamp(previewZoom, PUNCH_MIN_ZOOM, PUNCH_MAX_ZOOM)
  const width = fitted.width * zoom
  const height = fitted.height * zoom

  return {
    x: (stageWidth - width) / 2 + previewOffset.x,
    y: (stageHeight - height) / 2 + previewOffset.y,
    width,
    height,
  }
}

function renderImageRect(image: DiaryImage | null, frameWidth: number, frameHeight: number) {
  if (!image) {
    return null
  }

  return xw(image, frameWidth, frameHeight)
}

function createStampFlight(
  dateKey: string,
  workbenchElement: HTMLDivElement | null,
  guideMetrics: PunchGuideMetrics | null,
  devicePosition: { left: number; top: number } | null,
): StampFlight | null {
  if (!workbenchElement || !guideMetrics || !devicePosition) {
    return null
  }

  const targetElement =
    document.querySelector<HTMLElement>(`[data-stamp-hole="${dateKey}"]`) ||
    document.querySelector<HTMLElement>(`[data-stamp-target="${dateKey}"]`)

  if (!targetElement) {
    return null
  }

  const stageRect = workbenchElement.getBoundingClientRect()
  const targetRect = targetElement.getBoundingClientRect()
  const sourceLeft =
    stageRect.left + devicePosition.left - guideMetrics.deviceWidth / 2 + guideMetrics.holeLeft
  const sourceTop =
    stageRect.top + devicePosition.top - guideMetrics.deviceHeight / 2 + guideMetrics.holeTop
  const sourceCenterX = sourceLeft + guideMetrics.holeWidth / 2
  const sourceCenterY = sourceTop + guideMetrics.holeHeight / 2
  const stampWidth = targetRect.width
  const stampHeight = targetRect.height

  return {
    left: sourceCenterX - stampWidth / 2,
    top: sourceCenterY - stampHeight / 2,
    width: stampWidth,
    height: stampHeight,
    targetLeft: targetRect.left,
    targetTop: targetRect.top,
    targetWidth: stampWidth,
    targetHeight: stampHeight,
  }
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetKeyRef = useRef<string | null>(null)
  const notebookRef = useRef<HTMLDivElement>(null)
  const workbenchRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const pinchDistanceRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef(PUNCH_MIN_ZOOM)
  const touchPanOriginRef = useRef({ x: 0, y: 0 })
  const touchStartPointRef = useRef({ x: 0, y: 0 })
  const isTouchPanningRef = useRef(false)
  const punchDeviceMovedRef = useRef(false)
  const punchTimersRef = useRef<number[]>([])
  const today = useMemo(() => new Date(), [])
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [entries, setEntries] = useState<Record<string, DiaryEntry>>({})
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(today))
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>(() => {
    if (typeof window === 'undefined') {
      return 'month'
    }

    try {
      const saved = window.localStorage.getItem('calendarViewMode')
      return saved === 'week' ? 'week' : 'month'
    } catch {
      return 'month'
    }
  })
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0)
  const [languageCode, setLanguageCode] = useState<LangCode>('zh')
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [openDayMenuKey, setOpenDayMenuKey] = useState('')
  const [previewDateKey, setPreviewDateKey] = useState('')
  const [uploadTargetKey, setUploadTargetKey] = useState<string | null>(null)
  const [punchDraft, setPunchDraft] = useState<PunchDraft | null>(null)
  const [punchCrop, setPunchCrop] = useState<PunchCropState>(() => createPunchCrop(1))
  const [previewZoom, setPreviewZoom] = useState(PUNCH_MIN_ZOOM)
  const [previewOffset, setPreviewOffset] = useState<PreviewOffset>({ x: 0, y: 0 })
  const [showTouchZoomStrip, setShowTouchZoomStrip] = useState(false)
  const [isPunchDeviceDragging, setIsPunchDeviceDragging] = useState(false)
  const [isPunchDevicePressing, setIsPunchDevicePressing] = useState(false)
  const [isPunchCutout, setIsPunchCutout] = useState(false)
  const [isPunchOverlayFading, setIsPunchOverlayFading] = useState(false)
  const [workbenchSize, setWorkbenchSize] = useState({ width: 0, height: 0 })
  const [punchDevicePosition, setPunchDevicePosition] = useState<{ left: number; top: number } | null>(null)
  const [stampFlight, setStampFlight] = useState<StampFlight | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareFlash, setShareFlash] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [, setIsWorking] = useState(false)
  const [statusText, setStatusText] = useState('点一天，把这一天的照片盖进日历。')
  const monthKey = toMonthKey(visibleMonth)
  const weeks = useMemo(() => buildMonthWeeks(visibleMonth), [visibleMonth])
  const language = LANGUAGES.find((item) => item.code === languageCode) || LANGUAGES[0]
  const mondayFirstWeekdays = useMemo(
    () => toMondayFirstWeek(language.weekdays),
    [language.weekdays],
  )
  const activeWeekIndex = clamp(selectedWeekIndex, 0, Math.max(weeks.length - 1, 0))
  const weekDays = useMemo(() => buildContinuousWeek(selectedDateKey, monthKey), [selectedDateKey, monthKey])
  const weekDateKeys = useMemo(
    () =>
      new Set(
        weekDays.map((day) => day.dateKey),
      ),
    [weekDays],
  )
  const monthOverviewWeeks = useMemo(() => buildMonthOverviewWeeks(visibleMonth), [visibleMonth])
  const loadMonthKeys = useMemo(() => {
    const nextKeys = new Set([monthKey])

    if (calendarViewMode === 'week') {
      weekDays.forEach((day) => {
        nextKeys.add(day.dateKey.slice(0, 7))
      })
    }

    return [...nextKeys]
  }, [calendarViewMode, monthKey, weekDays])

  useEffect(() => {
    let isCancelled = false

    setIsLoading(true)

    Promise.all(loadMonthKeys.map((key) => getMonthEntries(key)))
      .then((monthEntryGroups) => {
        if (isCancelled) {
          return
        }

        const nextEntries = Object.fromEntries(
          monthEntryGroups.flat().map((entry) => {
            const normalized = normalizeEntry(entry, entry.dateKey, entry.monthKey)
            return [normalized.dateKey, normalized]
          }),
        )
        setEntries(nextEntries)
        setIsLoading(false)
      })
      .catch((error) => {
        console.error('Failed to load month entries', error)

        if (!isCancelled) {
          setEntries({})
          setIsLoading(false)
          setStatusText('读取本地日历失败。')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [loadMonthKeys])

  useEffect(() => {
    try {
      localStorage.setItem('calendarLang', languageCode)
    } catch {
      // ignore storage errors
    }
  }, [languageCode])

  useEffect(() => {
    try {
      localStorage.setItem('calendarViewMode', calendarViewMode)
    } catch {
      // ignore storage errors
    }
  }, [calendarViewMode])

  useEffect(() => {
    if (calendarViewMode === 'week') {
      return
    }

    const fallbackKey = toDateKey(
      monthKey === toMonthKey(today)
        ? today
        : new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1),
    )

    setSelectedDateKey((current) => (current.startsWith(monthKey) ? current : fallbackKey))
  }, [calendarViewMode, monthKey, today, visibleMonth])

  useEffect(() => {
    if (calendarViewMode !== 'week') {
      return
    }

    const selectedDate = parseDateKey(selectedDateKey)
    const nextVisibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)

    if (
      nextVisibleMonth.getFullYear() === visibleMonth.getFullYear() &&
      nextVisibleMonth.getMonth() === visibleMonth.getMonth()
    ) {
      return
    }

    setVisibleMonth(nextVisibleMonth)
  }, [calendarViewMode, selectedDateKey, visibleMonth])

  useEffect(() => {
    const nextWeekIndex = findWeekIndex(weeks, selectedDateKey)

    if (nextWeekIndex >= 0) {
      setSelectedWeekIndex(nextWeekIndex)
      return
    }

    setSelectedWeekIndex((current) => clamp(current, 0, Math.max(weeks.length - 1, 0)))
  }, [selectedDateKey, weeks])

  useEffect(() => {
    setOpenDayMenuKey('')
    setPreviewDateKey('')
    setIsLanguageMenuOpen(false)
    setIsMonthPickerOpen(false)
  }, [calendarViewMode])

  useEffect(() => {
    if (!punchDraft || !workbenchRef.current) {
      return undefined
    }

    function measureWorkbench() {
      if (!workbenchRef.current) {
        return
      }

      const rect = workbenchRef.current.getBoundingClientRect()
      setWorkbenchSize({
        width: rect.width,
        height: rect.height,
      })
    }

    measureWorkbench()

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measureWorkbench())
        : null

    if (resizeObserver && workbenchRef.current) {
      resizeObserver.observe(workbenchRef.current)
    } else {
      window.addEventListener('resize', measureWorkbench)
    }

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measureWorkbench)
    }
  }, [punchDraft])

  useEffect(() => {
    if (!openDayMenuKey) {
      return undefined
    }

    function handleWindowMouseDown(event: MouseEvent) {
      const target = event.target

      if (!(target instanceof HTMLElement) || target.closest('.day-cell-menu')) {
        return
      }

      setOpenDayMenuKey('')
    }

    window.addEventListener('mousedown', handleWindowMouseDown)
    return () => window.removeEventListener('mousedown', handleWindowMouseDown)
  }, [openDayMenuKey])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches)

    syncPreference()
    mediaQuery.addEventListener('change', syncPreference)

    return () => mediaQuery.removeEventListener('change', syncPreference)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const coarsePointer = window.matchMedia('(pointer: coarse)')
    const syncTouchUi = () => {
      setShowTouchZoomStrip(coarsePointer.matches || navigator.maxTouchPoints > 0)
    }

    syncTouchUi()
    coarsePointer.addEventListener('change', syncTouchUi)

    return () => coarsePointer.removeEventListener('change', syncTouchUi)
  }, [])

  const monthSummary = useMemo(() => {
    const monthEntries = Object.values(entries)
    return {
      withPhoto: monthEntries.filter((entry) => entry.images.length > 0).length,
      withNote: monthEntries.filter((entry) => entry.note.trim()).length,
      completion: Math.round(
        (monthEntries.filter((entry) => entry.images.length > 0).length /
          new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()) *
          100,
      ),
    }
  }, [entries, visibleMonth])

  const clearPunchTimers = useCallback(() => {
    punchTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    punchTimersRef.current = []
  }, [])

  const resetPunchWorkflow = useCallback(() => {
    clearPunchTimers()
    dragStateRef.current = null
    pinchDistanceRef.current = null
    isTouchPanningRef.current = false
    punchDeviceMovedRef.current = false
    setPunchDraft(null)
    setPunchCrop(createPunchCrop(1))
    setPreviewZoom(PUNCH_MIN_ZOOM)
    setPreviewOffset({ x: 0, y: 0 })
    setPunchDevicePosition(null)
    setIsPunchDeviceDragging(false)
    setIsPunchDevicePressing(false)
    setIsPunchCutout(false)
    setIsPunchOverlayFading(false)
    setStampFlight(null)
  }, [clearPunchTimers])

  useEffect(() => () => clearPunchTimers(), [clearPunchTimers])

  const persistEntry = useCallback(async (nextEntry: DiaryEntry) => {
    if (!entryHasContent(nextEntry)) {
      await deleteEntry(nextEntry.dateKey)
      setEntries((current) => {
        const next = { ...current }
        delete next[nextEntry.dateKey]
        return next
      })
      return
    }

    await putEntry(nextEntry)
    setEntries((current) => ({
      ...current,
      [nextEntry.dateKey]: nextEntry,
    }))
  }, [])

  const punchGuideMetrics = useMemo<PunchGuideMetrics | null>(() => {
    if (!punchDraft || workbenchSize.width <= 0 || workbenchSize.height <= 0) {
      return null
    }

    const deviceWidth = workbenchSize.width * PUNCH_DEVICE_WIDTH_FACTOR
    const deviceHeight = deviceWidth / PUNCH_DEVICE_ASPECT
    const renderedGuide = fitContainedRect(PUNCH_GUIDE_IMAGE_ASPECT, deviceWidth, deviceHeight)
    const guideImageLeft = (deviceWidth - renderedGuide.width) / 2
    const guideImageTop = (deviceHeight - renderedGuide.height) / 2
    const holeLeft = guideImageLeft + renderedGuide.width * PUNCH_HOLE_LEFT
    const holeTop = guideImageTop + renderedGuide.height * PUNCH_HOLE_TOP
    const holeWidth = renderedGuide.width * PUNCH_HOLE_SIZE
    const holeHeight = renderedGuide.height * PUNCH_HOLE_SIZE

    return {
      deviceWidth,
      deviceHeight,
      holeLeft,
      holeTop,
      holeWidth,
      holeHeight,
      holeCenterX: holeLeft + holeWidth / 2 - deviceWidth / 2,
      holeCenterY: holeTop + holeHeight / 2 - deviceHeight / 2,
    }
  }, [punchDraft, workbenchSize.height, workbenchSize.width])

  const defaultPunchDevicePosition = useMemo(() => {
    if (!punchDraft || !punchGuideMetrics) {
      return null
    }

    return {
      left: workbenchSize.width / 2 - punchGuideMetrics.holeCenterX,
      top: workbenchSize.height / 2 - punchGuideMetrics.holeCenterY,
    }
  }, [punchDraft, punchGuideMetrics, workbenchSize.height, workbenchSize.width])

  const flyingStampRect = useMemo(
    () => (punchDraft ? xw(punchCrop, STAMP_RENDER_WIDTH, STAMP_RENDER_HEIGHT) : null),
    [punchCrop, punchDraft],
  )

  useEffect(() => {
    setPunchDevicePosition(null)
  }, [punchDraft?.dateKey, punchDraft?.imageUrl, workbenchSize.height, workbenchSize.width])

  const getCurrentPunchDevicePosition = useCallback(() => {
    return punchDevicePosition ?? defaultPunchDevicePosition
  }, [defaultPunchDevicePosition, punchDevicePosition])

  const applyPunchZoom = useCallback(
    (nextZoom: number) => {
      const clampedZoom = clamp(nextZoom, PUNCH_MIN_ZOOM, PUNCH_MAX_ZOOM)

      if (!punchDraft || !punchGuideMetrics || workbenchSize.width <= 0 || workbenchSize.height <= 0) {
        setPreviewZoom(clampedZoom)
        return
      }

      const currentDevicePosition = getCurrentPunchDevicePosition()

      if (!currentDevicePosition) {
        setPreviewZoom(clampedZoom)
        return
      }

      const currentRect = getPreviewImageRect(punchDraft.aspectRatio, workbenchSize.width, workbenchSize.height, previewZoom, previewOffset)
      const holeCenterX = currentDevicePosition.left + punchGuideMetrics.holeCenterX
      const holeCenterY = currentDevicePosition.top + punchGuideMetrics.holeCenterY
      const focusX =
        currentRect.width > 0 ? (holeCenterX - currentRect.x) / currentRect.width : 0.5
      const focusY =
        currentRect.height > 0 ? (holeCenterY - currentRect.y) / currentRect.height : 0.5
      const nextRect = getPreviewImageRect(punchDraft.aspectRatio, workbenchSize.width, workbenchSize.height, clampedZoom, { x: 0, y: 0 })

      setPreviewZoom(clampedZoom)
      setPreviewOffset({
        x: holeCenterX - focusX * nextRect.width - (workbenchSize.width - nextRect.width) / 2,
        y: holeCenterY - focusY * nextRect.height - (workbenchSize.height - nextRect.height) / 2,
      })
    },
    [
      getCurrentPunchDevicePosition,
      punchDraft,
      previewOffset,
      previewZoom,
      punchGuideMetrics,
      workbenchSize.height,
      workbenchSize.width,
    ],
  )

  const ke = useCallback(
    (left: number, top: number) => {
      if (!punchGuideMetrics || workbenchSize.width <= 0 || workbenchSize.height <= 0) {
        return
      }

      const nextPosition = {
        left: clamp(left, -punchGuideMetrics.holeCenterX, workbenchSize.width - punchGuideMetrics.holeCenterX),
        top: clamp(top, -punchGuideMetrics.holeCenterY, workbenchSize.height - punchGuideMetrics.holeCenterY),
      }

      setPunchDevicePosition(nextPosition)
    },
    [punchGuideMetrics, workbenchSize.height, workbenchSize.width],
  )

  useEffect(() => {
    if (
      !punchDraft ||
      !punchGuideMetrics ||
      workbenchSize.width <= 0 ||
      workbenchSize.height <= 0
    ) {
      return
    }

    const currentDevicePosition = getCurrentPunchDevicePosition()

    if (!currentDevicePosition) {
      return
    }

    const nextCrop = derivePunchCropFromPreviewState(
      punchDraft.aspectRatio,
      workbenchSize.width,
      workbenchSize.height,
      currentDevicePosition.left + punchGuideMetrics.holeCenterX,
      currentDevicePosition.top + punchGuideMetrics.holeCenterY,
      punchGuideMetrics.holeHeight,
      previewZoom,
      previewOffset,
    )

    setPunchCrop((current) => {
      if (
        current.zoom === nextCrop.zoom &&
        current.panX === nextCrop.panX &&
        current.panY === nextCrop.panY &&
        current.sourceAspect === nextCrop.sourceAspect
      ) {
        return current
      }

      return nextCrop
    })
  }, [
    getCurrentPunchDevicePosition,
    previewOffset,
    previewZoom,
    punchDraft,
    punchGuideMetrics,
    workbenchSize.height,
    workbenchSize.width,
  ])

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current

      if (!dragState || !workbenchRef.current) {
        return
      }

      const deltaX = event.clientX - dragState.startX
      const deltaY = event.clientY - dragState.startY
      const localPoint = clientToWorkbenchPoint(event.clientX, event.clientY, workbenchRef.current)

      ke(localPoint.x - dragState.pointerOffsetX, localPoint.y - dragState.pointerOffsetY)

      if (deltaX * deltaX + deltaY * deltaY > 9) {
        punchDeviceMovedRef.current = true
        setIsPunchDeviceDragging(true)
      }
    }

    function handlePointerUp(event: PointerEvent) {
      if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
        return
      }

      dragStateRef.current = null
      window.setTimeout(() => {
        setIsPunchDeviceDragging(false)
      }, 0)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [ke])

  useEffect(() => {
    if (!punchDraft || !workbenchRef.current) {
      return undefined
    }

    const node = workbenchRef.current
    const handleWheel = (event: WheelEvent) => {
      if (isPunchCutout) {
        return
      }

      event.preventDefault()
      applyPunchZoom(previewZoom + (event.deltaY > 0 ? -0.15 : 0.15))
    }

    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  }, [applyPunchZoom, isPunchCutout, previewZoom, punchDraft])

  function workbenchImageStyle() {
    if (!punchDraft) {
      return undefined
    }

    const rect = getPreviewImageRect(
      punchDraft.aspectRatio,
      workbenchSize.width,
      workbenchSize.height,
      previewZoom,
      previewOffset,
    )

    return {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    } as CSSProperties
  }

  async function beginPunchDraft(file: File, targetKey: string) {
    const targetEntry = normalizeEntry(entries[targetKey], targetKey, targetKey.slice(0, 7))
    const existingImage = getStampImage(targetEntry)

    try {
      setIsWorking(true)
      const { dataUrl, aspectRatio } = await fileToCompressedData(file)

      clearPunchTimers()
      dragStateRef.current = null
      punchDeviceMovedRef.current = false
      setSelectedDateKey(targetKey)
      setOpenDayMenuKey('')
      setPreviewDateKey('')
      setPunchDraft({
        dateKey: targetKey,
        imageUrl: dataUrl,
        aspectRatio,
      })
      setPunchCrop(imageToPunchCrop(existingImage, aspectRatio))
      setPreviewZoom(PUNCH_MIN_ZOOM)
      setPreviewOffset({ x: 0, y: 0 })
      setPunchDevicePosition(null)
      setIsPunchDeviceDragging(false)
      setIsPunchDevicePressing(false)
      setIsPunchCutout(false)
      setIsPunchOverlayFading(false)
      setStampFlight(null)
      setStatusText(`调整 ${targetKey} 的照片位置，然后盖章。`)
    } catch (error) {
      console.error('Failed to load selected image', error)
      setStatusText('图片读取失败。')
    } finally {
      uploadTargetKeyRef.current = null
      setUploadTargetKey(null)
      setIsWorking(false)
    }
  }

  function ua(targetKey: string) {
    uploadTargetKeyRef.current = targetKey
    setUploadTargetKey(targetKey)

    if (typeof document === 'undefined') {
      fileInputRef.current?.click()
      return
    }

    const picker = document.createElement('input')
    picker.type = 'file'
    picker.accept = 'image/*'
    picker.className = 'calendar__file-input'
    picker.style.position = 'fixed'
    picker.style.left = '-9999px'
    picker.style.top = '0'
    picker.style.width = '1px'
    picker.style.height = '1px'
    picker.style.opacity = '0'
    picker.style.pointerEvents = 'none'

    const cleanup = () => {
      picker.onchange = null
      picker.remove()
    }

    picker.onchange = () => {
      const file = picker.files?.[0]
      cleanup()
      if (!file) {
        uploadTargetKeyRef.current = null
        setUploadTargetKey(null)
        return
      }
      void beginPunchDraft(file, targetKey)
    }

    document.body.appendChild(picker)
    picker.click()
  }

  function jumpMonth(offset: number) {
    startTransition(() => {
      setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
    })
  }

  function jumpWeek(offset: number) {
    startTransition(() => {
      const anchor = parseDateKey(selectedDateKey)
      anchor.setDate(anchor.getDate() + offset * 7)
      setSelectedDateKey(toDateKey(anchor))
    })
  }

  function jumpCalendar(offset: number) {
    if (calendarViewMode === 'week') {
      jumpWeek(offset)
      return
    }

    jumpMonth(offset)
  }

  function handleWeekSelect(weekIndex: number) {
    setSelectedWeekIndex(weekIndex)
    setOpenDayMenuKey('')
    setPreviewDateKey('')

    const anchor =
      toMondayFirstWeek(weeks[weekIndex] ?? []).find((day): day is CalendarDay => Boolean(day)) ??
      pickWeekAnchorDay(weeks[weekIndex], 'first') ??
      pickWeekAnchorDay(weeks[weekIndex], 'last')

    if (anchor) {
      setSelectedDateKey(anchor.dateKey)
    }
  }

  function handleOverviewDateSelect(dateKey: string) {
    setOpenDayMenuKey('')
    setPreviewDateKey('')
    setSelectedDateKey(dateKey)

    const nextDate = parseDateKey(dateKey)
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
  }

  function handleDayActivate(dateKey: string) {
    setSelectedDateKey(dateKey)
    const nextWeekIndex = findWeekIndex(weeks, dateKey)

    if (nextWeekIndex >= 0) {
      setSelectedWeekIndex(nextWeekIndex)
    }

    setIsMonthPickerOpen(false)
    setIsLanguageMenuOpen(false)

    const entry = normalizeEntry(entries[dateKey], dateKey, dateKey.slice(0, 7))

    if (!getStampImage(entry)) {
      ua(dateKey)
      return
    }

    setOpenDayMenuKey((current) => (current === dateKey ? '' : dateKey))
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      uploadTargetKeyRef.current = null
      setUploadTargetKey(null)
      return
    }

    const targetKey = uploadTargetKeyRef.current ?? uploadTargetKey ?? selectedDateKey
    await beginPunchDraft(file, targetKey)
  }

  const finishPunch = useCallback(
    async (nextEntry: DiaryEntry) => {
      try {
        setIsWorking(true)
        await persistEntry(nextEntry)
        setStatusText(`已把照片盖到 ${nextEntry.dateKey}。`)
      } catch (error) {
        console.error('Failed to save stamped memory', error)
        setStatusText('保存这一天失败。')
      } finally {
        setIsWorking(false)
        resetPunchWorkflow()
      }
    },
    [persistEntry, resetPunchWorkflow],
  )

  const St = useCallback(() => {
    if (!punchDraft || !defaultPunchDevicePosition || isPunchDevicePressing || isPunchCutout) {
      return
    }

    const baseEntry = normalizeEntry(
      entries[punchDraft.dateKey],
      punchDraft.dateKey,
      punchDraft.dateKey.slice(0, 7),
    )
    const storedCrop = punchCropToStoredCrop(punchCrop)
    const timeStamp = new Date().toISOString()
    const imageId = getStampImage(baseEntry)?.id || createImageId()
    const nextImage = normalizeImage(
      {
        id: imageId,
        url: punchDraft.imageUrl,
        rotationDeg: randomRotation(),
        sourceAspect: punchCrop.sourceAspect,
        cropScale: storedCrop.cropScale,
        cropX: storedCrop.cropX,
        cropY: storedCrop.cropY,
      },
      imageId,
      punchDraft.imageUrl,
    )
    const nextEntry = {
      ...baseEntry,
      erased: false,
      images: [nextImage],
      coverImageId: nextImage.id,
      updatedAt: timeStamp,
      createdAt: baseEntry.createdAt || timeStamp,
    }

    clearPunchTimers()
    setStampFlight(
      createStampFlight(
        punchDraft.dateKey,
        workbenchRef.current,
        punchGuideMetrics,
        punchDevicePosition ?? defaultPunchDevicePosition,
      ),
    )
    setIsPunchDevicePressing(true)

    if (prefersReducedMotion) {
      setIsPunchCutout(true)
      setIsPunchOverlayFading(true)
      void finishPunch(nextEntry)
      return
    }

    punchTimersRef.current = [
      window.setTimeout(() => {
        setIsPunchCutout(true)
      }, PUNCH_PRESS_DELAY),
      window.setTimeout(() => {
        setIsPunchOverlayFading(true)
      }, PUNCH_FADE_DELAY),
      window.setTimeout(() => {
        void finishPunch(nextEntry)
      }, PUNCH_COMMIT_DELAY),
    ]
  }, [
    clearPunchTimers,
    defaultPunchDevicePosition,
    entries,
    finishPunch,
    isPunchCutout,
    isPunchDevicePressing,
    prefersReducedMotion,
    punchCrop,
    punchDraft,
    punchDevicePosition,
    punchGuideMetrics,
  ])

  function handleCancelPunch() {
    resetPunchWorkflow()
    setStatusText('已取消盖章。')
  }

  async function handleRemoveDayPhoto(dateKey: string) {
    const entry = normalizeEntry(entries[dateKey], dateKey, dateKey.slice(0, 7))

    try {
      setIsWorking(true)
      await persistEntry({
        ...entry,
        erased: true,
        images: [],
        coverImageId: '',
        updatedAt: new Date().toISOString(),
      })
      setOpenDayMenuKey('')
      setPreviewDateKey('')
      setStatusText(`已移除 ${dateKey} 的照片。`)
    } catch (error) {
      console.error('Failed to remove day photo', error)
      setStatusText('移除这一天失败。')
    } finally {
      setIsWorking(false)
    }
  }

  async function handleShareNotebook() {
    if (!notebookRef.current || isSharing) {
      return
    }

    try {
      setIsSharing(true)
      notebookRef.current.classList.add('is-capturing')
      const canvas = await html2canvas(notebookRef.current, {
        backgroundColor: '#f3efe6',
        scale: Math.min(window.devicePixelRatio, 2),
      })
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })

      if (!blob) {
        throw new Error('Snapshot blob missing')
      }

      const fileName = `手账日历-${visibleMonth.getFullYear()}-${pad(visibleMonth.getMonth() + 1)}.png`
      const file = new File([blob], fileName, { type: 'image/png' })
      const shareNavigator = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>
        canShare?: (data: ShareData) => boolean
      }

      if (
        shareNavigator.share &&
        shareNavigator.canShare &&
        shareNavigator.canShare({ files: [file] })
      ) {
        await shareNavigator.share({ files: [file], title: fileName })
      } else {
        triggerDownload(blob, fileName)
      }

      setShareFlash(true)
      window.setTimeout(() => setShareFlash(false), 420)
    } catch (error) {
      console.error('Failed to share notebook', error)
      setStatusText('分享失败。')
    } finally {
      notebookRef.current.classList.remove('is-capturing')
      setIsSharing(false)
    }
  }

  function handlePunchDevicePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const currentDevicePosition = punchDevicePosition ?? defaultPunchDevicePosition

    if (
      !workbenchRef.current ||
      !currentDevicePosition ||
      isPunchCutout ||
      isPunchDevicePressing ||
      event.button !== 0
    ) {
      return
    }

    punchDeviceMovedRef.current = false
    const localPoint = clientToWorkbenchPoint(event.clientX, event.clientY, workbenchRef.current)
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pointerOffsetX: localPoint.x - currentDevicePosition.left,
      pointerOffsetY: localPoint.y - currentDevicePosition.top,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  function handlePunchDevicePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  function handlePunchDeviceClick(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation()

    if (punchDeviceMovedRef.current || isPunchDeviceDragging || isPunchCutout) {
      punchDeviceMovedRef.current = false
      return
    }

    St()
  }

  function handleWorkbenchTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (isPunchCutout || !punchDraft) {
      return
    }

    if (event.touches.length === 2) {
      const deltaX = event.touches[0].clientX - event.touches[1].clientX
      const deltaY = event.touches[0].clientY - event.touches[1].clientY
      pinchDistanceRef.current = Math.hypot(deltaX, deltaY)
      pinchStartZoomRef.current = previewZoom
      return
    }

    if (
      event.touches.length === 1 &&
      !dragStateRef.current &&
      workbenchSize.width > 0 &&
      workbenchSize.height > 0
    ) {
      touchPanOriginRef.current = {
        x: previewOffset.x,
        y: previewOffset.y,
      }
      touchStartPointRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      }
      isTouchPanningRef.current = false
    }
  }

  function handleWorkbenchTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (isPunchCutout || !punchDraft) {
      return
    }

    if (event.touches.length === 2 && pinchDistanceRef.current != null) {
      const deltaX = event.touches[0].clientX - event.touches[1].clientX
      const deltaY = event.touches[0].clientY - event.touches[1].clientY
      const distance = Math.hypot(deltaX, deltaY)

      applyPunchZoom(
        pinchStartZoomRef.current * (distance / Math.max(pinchDistanceRef.current ?? 1, 1)),
      )
      event.preventDefault()
      return
    }

    if (
      event.touches.length !== 1 ||
      dragStateRef.current ||
      previewZoom <= PUNCH_MIN_ZOOM ||
      workbenchSize.width <= 0 ||
      workbenchSize.height <= 0
    ) {
      return
    }

    const deltaX = event.touches[0].clientX - touchStartPointRef.current.x
    const deltaY = event.touches[0].clientY - touchStartPointRef.current.y

    if (!isTouchPanningRef.current && deltaX * deltaX + deltaY * deltaY > 9) {
      isTouchPanningRef.current = true
    }

    if (!isTouchPanningRef.current) {
      return
    }

    const mapped = mapTouchDelta(deltaX, deltaY)
    const rect = getPreviewImageRect(
      punchDraft.aspectRatio,
      workbenchSize.width,
      workbenchSize.height,
      previewZoom,
      { x: 0, y: 0 },
    )
    const overflowX = Math.max(0, (rect.width - workbenchSize.width) / 2)
    const overflowY = Math.max(0, (rect.height - workbenchSize.height) / 2)
    const nextOffsetX = clamp(touchPanOriginRef.current.x + mapped.dx, -overflowX, overflowX)
    const nextOffsetY = clamp(touchPanOriginRef.current.y + mapped.dy, -overflowY, overflowY)

    setPreviewOffset({
      x: nextOffsetX,
      y: nextOffsetY,
    })
    event.preventDefault()
  }

  function handleWorkbenchTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) {
      pinchDistanceRef.current = null
    }

    if (event.touches.length === 0) {
      isTouchPanningRef.current = false
    }
  }

  const leftWeekdays = language.weekdays.slice(0, 4)
  const rightWeekdays = [...language.weekdays.slice(4, 7), '']

  function renderStampSvg(image: DiaryImage, clipId: string) {
    const rect = renderImageRect(image, STAMP_RENDER_WIDTH, STAMP_RENDER_HEIGHT)

    if (!rect) {
      return null
    }

    return (
      <svg viewBox={`0 0 ${STAMP_RENDER_WIDTH} ${STAMP_RENDER_HEIGHT}`} className="day-cell-stamp-svg" role="presentation">
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={STAMP_PATH} transform={`scale(${STAMP_SCALE_X} ${STAMP_SCALE_Y})`} />
          </clipPath>
        </defs>
        <path className="day-cell-stamp-paper" d={STAMP_PATH} transform={`scale(${STAMP_SCALE_X} ${STAMP_SCALE_Y})`} />
        <image
          href={image.url}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          preserveAspectRatio="none"
          clipPath={`url(#${clipId})`}
        />
      </svg>
    )
  }

  function renderCalendarDayCell(
    day: CalendarDay,
    clipId: string,
    options?: {
      variant?: CalendarViewMode
      weekdayLabel?: string
      onActivate?: (dateKey: string) => void
    },
  ) {
    const variant = options?.variant ?? 'month'
    const isWeekVariant = variant === 'week'
    const isOutsideMonth = isWeekVariant && day.isCurrentMonth === false
    const entry = normalizeEntry(entries[day.dateKey], day.dateKey, day.dateKey.slice(0, 7))
    const image = getStampImage(entry)
    const isMenuOpen = openDayMenuKey === day.dateKey
    const parsedDate = parseDateKey(day.dateKey)
    const isSunday = parsedDate.getDay() === 0
    const activate = options?.onActivate ?? handleDayActivate

    return (
      <div
        key={day.dateKey}
        className={`calendar__cell${
          punchDraft?.dateKey === day.dateKey ? ' calendar__cell--pending-target' : ''
        }${isWeekVariant ? ' calendar__cell--week' : ''}${isOutsideMonth ? ' calendar__cell--outside-month' : ''}`}
      >
        <div
          className={`day-cell${entry.erased ? ' is-erased' : ''}${isWeekVariant ? ' day-cell--week' : ''}${isOutsideMonth ? ' day-cell--outside-month' : ''}`}
          data-stamp-target={day.dateKey}
        >
          <div
            className={`day-cell-stamp-hole${isWeekVariant ? ' day-cell-stamp-hole--week' : ''}`}
            data-stamp-hole={day.dateKey}
            aria-hidden="true"
          />
          <button
            type="button"
            className={`day-cell-hit${isWeekVariant ? ' day-cell-hit--week' : ''}`}
            onClick={() => activate(day.dateKey)}
            aria-label={
              image
                ? `第 ${day.day} 天，已有照片，打开操作菜单。`
                : `第 ${day.day} 天，添加一张照片。`
            }
          >
            {isWeekVariant ? (
              <span className="day-cell-week-meta">
                <span className={`day-cell-week-label${isSunday ? ' day-cell-week-label--sun' : ''}`}>
                  / {options?.weekdayLabel}
                </span>
                <span className={`calendar__date calendar__date--week${isSunday ? ' calendar__date--sun' : ''}`}>
                  {pad(day.day)}
                </span>
              </span>
            ) : (
              <span className="calendar__date">{day.day}</span>
            )}
            {!image && (
              <span className={`day-cell-placeholder${isWeekVariant ? ' day-cell-placeholder--week' : ''}`}>
                点此盖照片
              </span>
            )}
          </button>

          {image && (
            <button
              type="button"
              className={`day-cell-stamp${isWeekVariant ? ' day-cell-stamp--week' : ''}`}
              style={{ ['--stamp-rotate' as string]: `${image.rotationDeg}deg` }}
              onClick={(event) => {
                event.stopPropagation()
                activate(day.dateKey)
              }}
              aria-label={`第 ${day.day} 天，打开照片操作`}
            >
              {renderStampSvg(image, clipId)}
            </button>
          )}

          {isMenuOpen && image && (
            <div className="day-cell-menu">
              <button
                type="button"
                onClick={() => {
                  setOpenDayMenuKey('')
                  setPreviewDateKey(day.dateKey)
                }}
              >
                查看
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenDayMenuKey('')
                  ua(day.dateKey)
                }}
              >
                替换
              </button>
              <button type="button" onClick={() => handleRemoveDayPhoto(day.dateKey)}>
                移除
              </button>
            </div>
          )}

          {previewDateKey === day.dateKey && image && (
            <button
              type="button"
              className="day-cell-preview"
              onClick={() => setPreviewDateKey('')}
              aria-label={`关闭第 ${day.day} 天预览`}
            >
              <img src={image.url} alt={`第 ${day.day} 天照片预览`} />
            </button>
          )}
        </div>
      </div>
    )
  }

  const viewToggle = (
    <div className="calendar__view-toggle" role="tablist" aria-label="切换日历视图">
      <button
        type="button"
        className={`calendar__view-option${calendarViewMode === 'month' ? ' calendar__view-option--active' : ''}`}
        onClick={() => setCalendarViewMode('month')}
        aria-selected={calendarViewMode === 'month'}
      >
        月
      </button>
      <button
        type="button"
        className={`calendar__view-option${calendarViewMode === 'week' ? ' calendar__view-option--active' : ''}`}
        onClick={() => setCalendarViewMode('week')}
        aria-selected={calendarViewMode === 'week'}
      >
        周
      </button>
    </div>
  )

  const languageControl = (
    <div className="calendar__lang-wrapper">
      <button
        className="calendar__lang-toggle"
        onClick={() => setIsLanguageMenuOpen((current) => !current)}
        aria-label="选择语言"
        title="选择语言"
      >
        语言
      </button>

      {isLanguageMenuOpen && (
        <>
          <div className="calendar__lang-backdrop" onClick={() => setIsLanguageMenuOpen(false)} />
          <div className="calendar__lang-dropdown">
            {LANGUAGES.map((item) => (
              <button
                key={item.code}
                className={`calendar__lang-option${
                  languageCode === item.code ? ' calendar__lang-option--active' : ''
                }`}
                onClick={() => {
                  setLanguageCode(item.code)
                  setIsLanguageMenuOpen(false)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const monthPicker = isMonthPickerOpen && (
    <div className="calendar__month-picker-backdrop" onClick={() => setIsMonthPickerOpen(false)}>
      <div
        className={`calendar__month-picker${calendarViewMode === 'week' ? ' calendar__month-picker--week' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="calendar__month-picker-year-row">
          <button
            className="calendar__month-picker-arrow"
            onClick={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear() - 1, current.getMonth(), 1),
              )
            }
            aria-label="上一年"
          >
            ‹
          </button>
          <span className="calendar__month-picker-year">{visibleMonth.getFullYear()}</span>
          <button
            className="calendar__month-picker-arrow"
            onClick={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear() + 1, current.getMonth(), 1),
              )
            }
            aria-label="下一年"
          >
            ›
          </button>
        </div>

        <div className="calendar__month-picker-grid">
          {MONTH_PICKER_LABELS.map((monthLabel, monthIndex) => (
            <button
              key={monthLabel}
              className={`calendar__month-picker-btn${
                visibleMonth.getMonth() === monthIndex
                  ? ' calendar__month-picker-btn--active'
                  : ''
              }`}
              onClick={() => {
                setVisibleMonth((current) => new Date(current.getFullYear(), monthIndex, 1))
                setIsMonthPickerOpen(false)
              }}
            >
              {monthLabel}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const punchDeviceStyle = punchGuideMetrics
    ? {
        left: `${(punchDevicePosition?.left ?? defaultPunchDevicePosition?.left ?? 0)}px`,
        top: `${(punchDevicePosition?.top ?? defaultPunchDevicePosition?.top ?? 0)}px`,
      }
    : undefined

  return (
    <main className="notebook-scene">
      <div className="notebook__layout">
        <div ref={notebookRef} className="notebook notebook--open" aria-label="打开的手账本">
          <div className="notebook__pages">
            <div className="notebook__page notebook__page--left" />
            <div className="notebook__page notebook__page--right" />
            <div className="notebook__gutter" />
          </div>

          <div className="notebook__cover">
            <div className="notebook__cover-front">
              <div className="notebook__elastic" />
            </div>
            <div className="notebook__cover-back" />
          </div>

          <div className="notebook__page-content">
            <div className={`calendar calendar--${calendarViewMode}`} data-lang={languageCode}>
              <div className="calendar__flip-wrapper">
                {monthPicker}

                {calendarViewMode === 'month' ? (
                  <>
                    <div className="calendar__page calendar__page--left">
                      <div className="calendar__header">
                        <h1
                          className="calendar__month calendar__month--clickable"
                          onClick={() => setIsMonthPickerOpen((current) => !current)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setIsMonthPickerOpen((current) => !current)
                            }
                          }}
                          aria-label={`月份 ${formatMonthLabel(visibleMonth)}，点击切换`}
                        >
                          {formatMonthLabel(visibleMonth)}
                        </h1>
                      </div>

                      <div className="calendar__grid calendar__grid--left" style={{ ['--rows' as string]: weeks.length }}>
                        {leftWeekdays.map((weekday) => (
                          <div key={weekday} className="calendar__day-header">
                            {weekday}
                          </div>
                        ))}

                        {weeks.flatMap((week, weekIndex) =>
                          week.slice(0, 4).map((day, columnIndex) =>
                            day
                              ? renderCalendarDayCell(day, `stamp-left-${day.dateKey}`)
                              : <div key={`left-empty-${weekIndex}-${columnIndex}`} className="calendar__cell" />,
                          ),
                        )}
                      </div>
                    </div>

                    <div className="calendar__page calendar__page--right">
                      <div className="calendar__header calendar__header--right">
                        <div className="calendar__header-actions">
                          {viewToggle}
                          {languageControl}
                        </div>
                      </div>

                      <div className="calendar__grid calendar__grid--right" style={{ ['--rows' as string]: weeks.length }}>
                        {rightWeekdays.map((weekday, index) => (
                          <div
                            key={`${weekday}-${index}`}
                            className={`calendar__day-header${weekday ? '' : ' calendar__day-header--empty'}`}
                          >
                            {weekday}
                          </div>
                        ))}

                        {weeks.flatMap((week, weekIndex) => {
                          const rightDays = [...week.slice(4, 7), null]

                          return rightDays.map((day, columnIndex) =>
                            day
                              ? renderCalendarDayCell(day, `stamp-right-${day.dateKey}`)
                              : <div key={`right-empty-${weekIndex}-${columnIndex}`} className="calendar__cell" />,
                          )
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <section className="calendar__week-spread" aria-label="周视图">
                    <div className="calendar__week-header">
                      <div className="calendar__week-year">{visibleMonth.getFullYear()}</div>
                      <button
                        type="button"
                        className="calendar__week-title calendar__month--clickable"
                        onClick={() => setIsMonthPickerOpen((current) => !current)}
                        aria-label={`月份 ${formatMonthLabel(visibleMonth)}，点击切换`}
                      >
                        <span className="calendar__week-title-number">{visibleMonth.getMonth() + 1}</span>
                        <span className="calendar__week-title-name">{formatPlannerMonthName(visibleMonth)}</span>
                      </button>
                      <div className="calendar__week-toolbar">
                        <div className="calendar__week-switcher" aria-label="切换周数">
                          <span className="calendar__week-switcher-label">Week</span>
                          {weeks.map((_, weekIndex) => (
                            <button
                              key={`week-${weekIndex + 1}`}
                              type="button"
                              className={`calendar__week-switcher-option${
                                activeWeekIndex === weekIndex
                                  ? ' calendar__week-switcher-option--active'
                                  : ''
                              }`}
                              onClick={() => handleWeekSelect(weekIndex)}
                              aria-label={`切换到第 ${weekIndex + 1} 周`}
                            >
                              {weekIndex + 1}
                            </button>
                          ))}
                        </div>
                        <div className="calendar__week-toolbar-actions">
                          {viewToggle}
                          {languageControl}
                        </div>
                      </div>
                    </div>

                    <div className="calendar__week-grid">
                      <div className="calendar__week-overview">
                        <div className="calendar__week-overview-title">{formatPlannerMonthName(visibleMonth)}</div>
                        <div className="calendar__week-overview-head">
                          {mondayFirstWeekdays.map((weekday, index) => (
                            <span
                              key={`mini-${weekday}-${index}`}
                              className={`calendar__week-overview-weekday${
                                index === 6 ? ' calendar__week-overview-weekday--sun' : ''
                              }`}
                            >
                              {weekday}
                            </span>
                          ))}
                        </div>
                        <div className="calendar__week-overview-grid">
                          {monthOverviewWeeks.flatMap((week) =>
                            week.map((day) => {
                              const parsedDate = parseDateKey(day.dateKey)
                              const isSunday = parsedDate.getDay() === 0
                              const isSelected = day.dateKey === selectedDateKey
                              const isActiveWeekDay = weekDateKeys.has(day.dateKey)
                              const isOutsideMonth = day.isCurrentMonth === false

                              return (
                                <button
                                  type="button"
                                  key={`week-overview-${day.dateKey}`}
                                  className={`calendar__week-overview-day${
                                    isSunday ? ' calendar__week-overview-day--sun' : ''
                                  }${
                                    isActiveWeekDay ? ' calendar__week-overview-day--active-week' : ''
                                  }${
                                    isSelected ? ' calendar__week-overview-day--selected' : ''
                                  }${
                                    isOutsideMonth ? ' calendar__week-overview-day--outside-month' : ''
                                  }`}
                                  onClick={() => handleOverviewDateSelect(day.dateKey)}
                                  aria-label={`切换到 ${day.dateKey}`}
                                >
                                  {day.day}
                                </button>
                              )
                            }),
                          )}
                        </div>
                      </div>

                      {weekDays.map((day, index) =>
                        renderCalendarDayCell(day, `stamp-week-${day.dateKey}`, {
                          variant: 'week',
                          weekdayLabel: mondayFirstWeekdays[index],
                        }),
                      )}
                    </div>
                  </section>
                )}

                <button
                  type="button"
                  className="calendar__nav-arrow calendar__nav-arrow--prev"
                  onClick={() => jumpCalendar(-1)}
                  aria-label={calendarViewMode === 'week' ? '上一周' : '上个月'}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="calendar__nav-arrow calendar__nav-arrow--next"
                  onClick={() => jumpCalendar(1)}
                  aria-label={calendarViewMode === 'week' ? '下一周' : '下个月'}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="notebook__sidebar">
          <button
            type="button"
            className={`share-btn ${isSharing ? 'share-btn--capturing' : ''}`}
            onClick={handleShareNotebook}
            aria-label="分享日历截图"
            title="分享"
          >
            <svg
              className="share-btn__icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
              <polyline points="16,6 12,2 8,6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span className="share-btn__label">分享</span>
          </button>
        </div>
      </div>

      <div className="visually-hidden" aria-live="polite">
        {isLoading
          ? '正在读取本地日历'
          : `本月已盖 ${monthSummary.withPhoto} 天。${statusText}`}
      </div>

      {punchDraft && (
        <div
          className={`calendar__punch-overlay${isPunchOverlayFading ? ' is-fading' : ''}`}
          aria-live="polite"
        >
          <button
            type="button"
            className="calendar__punch-backdrop"
            onClick={handleCancelPunch}
            aria-label="取消盖章"
          />

          <div className="calendar__staging-center">
            <div
              ref={workbenchRef}
              className={`calendar__punch-workbench${isPunchCutout ? ' is-cutout' : ''}`}
              style={{ ['--workbench-aspect' as string]: String(punchDraft.aspectRatio || 1.2) }}
              aria-label={`第 ${parseDateKey(punchDraft.dateKey).getDate()} 天的盖章对位区`}
              onTouchStart={handleWorkbenchTouchStart}
              onTouchMove={handleWorkbenchTouchMove}
              onTouchEnd={handleWorkbenchTouchEnd}
            >
              <div className="calendar__workbench-photo-wrapper">
                <img
                  className="calendar__workbench-photo"
                  src={punchDraft.imageUrl}
                  alt={longLabel(punchDraft.dateKey, languageCode)}
                  style={workbenchImageStyle()}
                />
              </div>
              <div
                className={`calendar__punch-device ${
                  isPunchDeviceDragging ? 'is-dragging' : ''
                } ${isPunchDevicePressing ? 'is-pressing' : ''}`}
                style={punchDeviceStyle}
                onPointerDown={handlePunchDevicePointerDown}
                onPointerUp={handlePunchDevicePointerUp}
                onPointerCancel={handlePunchDevicePointerUp}
                onClick={handlePunchDeviceClick}
                aria-hidden="true"
              >
                <img
                  src="/stampbackside.png"
                  alt=""
                  className="calendar__punch-guide-photo"
                  draggable={false}
                />
              </div>

              {showTouchZoomStrip && (
                <label className="calendar__punch-zoom-strip" aria-label="缩放图片">
                  <span>-</span>
                  <input
                    type="range"
                    min={String(PUNCH_MIN_ZOOM)}
                    max={String(PUNCH_MAX_ZOOM)}
                    step="0.01"
                    value={previewZoom}
                    onChange={(event) => applyPunchZoom(Number(event.target.value))}
                  />
                  <span>+</span>
                </label>
              )}

              {stampFlight && flyingStampRect && (
                <div
                  className={`calendar__flying-stamp is-visible${isPunchOverlayFading ? ' is-flying' : ''}`}
                  style={{
                    left: `${stampFlight.left}px`,
                    top: `${stampFlight.top}px`,
                    width: `${stampFlight.width}px`,
                    height: `${stampFlight.height}px`,
                    ['--stamp-target-x' as string]: `${stampFlight.targetLeft - stampFlight.left}px`,
                    ['--stamp-target-y' as string]: `${stampFlight.targetTop - stampFlight.top}px`,
                    ['--stamp-target-scale-x' as string]:
                      stampFlight.width > 0 ? String(stampFlight.targetWidth / stampFlight.width) : '1',
                    ['--stamp-target-scale-y' as string]:
                      stampFlight.height > 0 ? String(stampFlight.targetHeight / stampFlight.height) : '1',
                  }}
                  aria-hidden="true"
                >
                  <svg
                    viewBox={`0 0 ${STAMP_RENDER_WIDTH} ${STAMP_RENDER_HEIGHT}`}
                    className="calendar__flying-stamp-svg"
                    role="presentation"
                  >
                    <defs>
                      <clipPath id="flying-stamp-clip" clipPathUnits="userSpaceOnUse">
                        <path d={STAMP_PATH} transform={`scale(${STAMP_SCALE_X} ${STAMP_SCALE_Y})`} />
                      </clipPath>
                    </defs>
                    <path
                      className="calendar__flying-stamp-paper"
                      d={STAMP_PATH}
                      transform={`scale(${STAMP_SCALE_X} ${STAMP_SCALE_Y})`}
                    />
                    <image
                      href={punchDraft.imageUrl}
                      x={flyingStampRect.x}
                      y={flyingStampRect.y}
                      width={flyingStampRect.width}
                      height={flyingStampRect.height}
                      preserveAspectRatio="none"
                      clipPath="url(#flying-stamp-clip)"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="calendar__file-input"
        onChange={handleFileChange}
      />

      {shareFlash && <div className="share-flash" aria-hidden="true" />}
    </main>
  )
}

export default App
