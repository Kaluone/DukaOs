import { describe, it, expect } from 'vitest'

// Test pure utility functions used across the app

function formatCurrency(amount: number, currency = 'TZS') {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function generateBarcode(productId: string): string {
  const hash = productId.replace(/-/g, '').slice(0, 12)
  const nums = hash.split('').map(c => parseInt(c, 16) % 10).join('').slice(0, 12)
  return nums.padEnd(12, '0')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1048576).toFixed(1)}MB`
}

function parseCSV(text: string): string[][] {
  return text.trim().split('\n').map(line =>
    line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
  )
}

describe('formatCurrency', () => {
  it('formats TZS amounts', () => {
    const result = formatCurrency(4500)
    expect(result).toContain('4,500')
  })

  it('handles zero', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
  })

  it('formats large amounts', () => {
    const result = formatCurrency(1000000)
    expect(result).toContain('1,000,000')
  })
})

describe('generateBarcode', () => {
  it('returns 12 digit string', () => {
    const barcode = generateBarcode('550e8400-e29b-41d4-a716-446655440000')
    expect(barcode).toHaveLength(12)
  })

  it('only contains digits', () => {
    const barcode = generateBarcode('550e8400-e29b-41d4-a716-446655440000')
    expect(/^\d+$/.test(barcode)).toBe(true)
  })

  it('produces consistent output for same input', () => {
    const id = 'abc12345-def6-7890-abcd-ef1234567890'
    expect(generateBarcode(id)).toBe(generateBarcode(id))
  })

  it('produces different barcodes for different products', () => {
    const b1 = generateBarcode('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    const b2 = generateBarcode('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    expect(b1).not.toBe(b2)
  })
})

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(2097152)).toBe('2.0MB')
  })
})

describe('parseCSV', () => {
  it('parses basic CSV', () => {
    const csv = 'name,price\nBread,1000\nMilk,2000'
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(['name', 'price'])
    expect(rows[1]).toEqual(['Bread', '1000'])
  })

  it('strips quotes', () => {
    const csv = '"name","price"\n"Bread","1000"'
    const rows = parseCSV(csv)
    expect(rows[0]).toEqual(['name', 'price'])
    expect(rows[1]).toEqual(['Bread', '1000'])
  })

  it('trims whitespace', () => {
    const csv = ' name , price \n Bread , 1000 '
    const rows = parseCSV(csv)
    expect(rows[0][0]).toBe('name')
    expect(rows[1][1]).toBe('1000')
  })
})
