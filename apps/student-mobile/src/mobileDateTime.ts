const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000

interface ChinaDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function chinaDateParts(value: string): ChinaDateParts | null {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp + CHINA_TIME_OFFSET_MS)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  }
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatChinaDateTime(value: string): string {
  const parts = chinaDateParts(value)
  if (!parts) return '时间待确认'
  return `${parts.year}年${parts.month}月${parts.day}日 ${twoDigits(parts.hour)}:${twoDigits(parts.minute)}`
}

export function formatChinaShortDateTime(value: string): string {
  const parts = chinaDateParts(value)
  if (!parts) return '时间待确认'
  return `${parts.month}月${parts.day}日 ${twoDigits(parts.hour)}:${twoDigits(parts.minute)}`
}

export function formatChinaDate(value: string): string {
  const parts = chinaDateParts(value)
  if (!parts) return '日期待确认'
  return `${parts.year}年${parts.month}月${parts.day}日`
}
