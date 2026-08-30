const MONTH_LENGTH = 3

const amounts = new Intl.NumberFormat('en-US')

const dayMonth = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
})

const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const monthOnly = new Intl.DateTimeFormat('en-GB', { month: 'short' })

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const compose = (formatter: Intl.DateTimeFormat, value: string): string =>
  formatter
    .formatToParts(new Date(value))
    .map((part) =>
      part.type === 'month' ? part.value.slice(0, MONTH_LENGTH) : part.value,
    )
    .join('')

export const formatRwf = (value: number): string =>
  `${amounts.format(value)} RWF`

export const formatAmount = (value: number): string => amounts.format(value)

export const formatPercent = (fraction: number): string =>
  `${(fraction * 100).toFixed(1)}%`

export const formatShare = (fraction: number): string =>
  `${Math.round(fraction * 100)}%`

export const formatDay = (value: string): string => compose(dayMonth, value)

export const formatMonth = (value: string): string => compose(monthOnly, value)

export const formatDate = (value: string): string =>
  compose(dayMonthYear, value)

export const formatDateTime = (value: string): string =>
  compose(dateTime, value)

export const formatDateRange = (
  start: string | null,
  end: string | null,
): string => {
  if (start && end) return `${formatDay(start)} – ${formatDay(end)}`
  if (start) return `From ${formatDay(start)}`
  if (end) return `Until ${formatDay(end)}`
  return 'Not scheduled'
}
