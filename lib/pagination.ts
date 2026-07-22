export function parsePagination(searchParams: URLSearchParams, defaults = { page: 1, pageSize: 50 }) {
  const page = Math.max(1, Number(searchParams.get('page')) || defaults.page)
  const pageSize = Math.min(Math.max(1, Number(searchParams.get('pageSize')) || defaults.pageSize), 500)
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip, take: pageSize }
}

export function parseCursor(searchParams: URLSearchParams, defaults = { take: 25 }) {
  const cursor = searchParams.get('cursor') || undefined
  const take = Math.min(Math.max(1, Number(searchParams.get('take')) || defaults.take), 100)
  return { cursor, take }
}

export function buildCursorResponse<T extends { id: string }>(items: T[], take: number, totalCount: number) {
  const hasMore = items.length > take
  const data = hasMore ? items.slice(0, take) : items
  const nextCursor = hasMore ? data[data.length - 1].id : null
  return { data, nextCursor, totalCount, hasMore }
}

export function parseSearch(searchParams: URLSearchParams) {
  return searchParams.get('q') || ''
}
