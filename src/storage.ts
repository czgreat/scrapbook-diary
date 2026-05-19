export type DiaryImage = {
  id: string
  url: string
  frameStyle: string
  ratioId: string
  rotationDeg: number
  sourceAspect: number
  cropScale: number
  cropX: number
  cropY: number
}

export type DiaryEntry = {
  dateKey: string
  monthKey: string
  title: string
  note: string
  topics: string[]
  location: string
  visibility: string
  publishMode: string
  scheduledAt: string
  erased: boolean
  images: DiaryImage[]
  coverImageId: string
  createdAt: string
  updatedAt: string
}

const DB_NAME = 'scrapbook-diary'
const STORE_NAME = 'entries'
const DB_VERSION = 1

let databasePromise: Promise<IDBDatabase> | null = null

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function openDatabase() {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'dateKey',
        })

        store.createIndex('monthKey', 'monthKey', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return databasePromise
}

export async function getMonthEntries(monthKey: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const store = transaction.objectStore(STORE_NAME)
  const index = store.index('monthKey')
  const request = index.getAll(IDBKeyRange.only(monthKey))
  const result = await requestToPromise(request)

  await transactionDone(transaction)
  return result as DiaryEntry[]
}

export async function putEntry(entry: DiaryEntry) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).put(entry)
  await transactionDone(transaction)
}

export async function deleteEntry(dateKey: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).delete(dateKey)
  await transactionDone(transaction)
}

export async function clearMonthEntries(monthKey: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  const index = store.index('monthKey')
  const cursorRequest = index.openCursor(IDBKeyRange.only(monthKey))

  await new Promise<void>((resolve, reject) => {
    cursorRequest.onerror = () => reject(cursorRequest.error)
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result

      if (!cursor) {
        resolve()
        return
      }

      cursor.delete()
      cursor.continue()
    }
  })

  await transactionDone(transaction)
}
