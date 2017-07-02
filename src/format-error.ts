export default function (data: string, message: string, pos?: number) {
  if (!pos) {
    pos = data.length
  }

  // count unix/mac/win eols
  const line = (data.slice(0, pos).match(/\r\n?|\n/g) || '').length + 1

  let col = 0
  while (--pos >= 0 && !/[\r\n]/.test(data[pos])) {
    ++col
  }

  return `[${line},${col}]: ${message}`
}
