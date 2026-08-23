export const formatRwf = (value: number): string =>
  `${new Intl.NumberFormat('en-US').format(value)} RWF`
