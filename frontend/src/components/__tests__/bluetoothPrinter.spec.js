import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isBluetoothSupported,
  formatRupiahSimple,
  formatTwoColumns,
  generateKitchenReceiptText,
  generateCustomerReceiptText,
  generateReceiptPlainText,
  buildKitchenEscPosBuffer,
  buildCustomerEscPosBuffer,
  buildEscPosBuffer,
  printReceiptViaBluetooth,
  resetCachedBluetoothDevice,
  getSavedPrinterName
} from '@/utils/bluetoothPrinter'

describe('bluetoothPrinter utility', () => {
  beforeEach(() => {
    resetCachedBluetoothDevice()
  })
  const sampleOrder = {
    id: 'ORD-98765',
    createdAt: '2026-09-24T10:30:00Z',
    customer: {
      name: 'Budi Santoso',
      phone: '08123456789',
      orderType: 'Dine-In',
      tableOrAddress: 'Meja 05'
    },
    payment: {
      method: 'qris',
      label: 'QRIS'
    },
    items: [
      {
        id: 1,
        name: 'Kopi Susu Gula Aren',
        price: 22000,
        quantity: 2,
        notes: 'Less ice, normal sugar'
      },
      {
        id: 2,
        name: 'Croissant Coklat',
        price: 25000,
        quantity: 1
      }
    ],
    breakdown: {
      subtotal: 69000,
      ecoFee: 3000,
      tax: 7200,
      total: 79200
    }
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('formatRupiahSimple', () => {
    it('formats numbers into Rupiah string', () => {
      expect(formatRupiahSimple(50000)).toContain('Rp')
      expect(formatRupiahSimple(50000)).toContain('50.000')
      expect(formatRupiahSimple(0)).toContain('0')
    })
  })

  describe('formatTwoColumns', () => {
    it('pads spaces between two columns to reach specified width', () => {
      const result = formatTwoColumns('Subtotal', 'Rp 50.000', 32)
      expect(result.length).toBe(32)
      expect(result.startsWith('Subtotal')).toBe(true)
      expect(result.endsWith('Rp 50.000')).toBe(true)
    })
  })

  describe('generateKitchenReceiptText', () => {
    it('generates internal kitchen ticket with SIKopi branding and transaction proof', () => {
      const text = generateKitchenReceiptText(sampleOrder, 32)
      expect(text).toContain('SIKopi')
      expect(text).toContain('[ STRUK DAPUR ]')
      expect(text).toContain('ORD-98765')
      expect(text).toContain('Budi Santoso')
      expect(text).toContain('Kopi Susu Gula Aren')
      expect(text).toContain('Less ice, normal sugar')
      expect(text).toContain('Paraf Barista / Dapur')
      expect(text).not.toContain('LUNAS')
    })
  })

  describe('generateCustomerReceiptText', () => {
    it('generates official customer receipt with SIKopi branding', () => {
      const text = generateCustomerReceiptText(sampleOrder, 32)
      expect(text).toContain('SIKopi')
      expect(text).toContain('[ STRUK PELANGGAN ]')
      expect(text).toContain('ORD-98765')
      expect(text).toContain('Budi Santoso')
      expect(text).toContain('TOTAL AKHIR')
      expect(text).not.toContain('LUNAS')
    })
  })

  describe('generateReceiptPlainText', () => {
    it('generates both kitchen and customer receipts by default', () => {
      const text = generateReceiptPlainText(sampleOrder, 32, 'both')
      expect(text).toContain('[ STRUK DAPUR ]')
      expect(text).toContain('[ STRUK PELANGGAN ]')
      expect(text).toContain('Budi Santoso')
      expect(text).toContain('SIKopi')
    })

    it('returns only kitchen receipt when mode is kitchen', () => {
      const text = generateReceiptPlainText(sampleOrder, 32, 'kitchen')
      expect(text).toContain('[ STRUK DAPUR ]')
      expect(text).toContain('Budi Santoso')
      expect(text).not.toContain('[ STRUK PELANGGAN ]')
    })

    it('returns only customer receipt when mode is customer', () => {
      const text = generateReceiptPlainText(sampleOrder, 32, 'customer')
      expect(text).toContain('[ STRUK PELANGGAN ]')
      expect(text).toContain('Budi Santoso')
      expect(text).not.toContain('[ STRUK DAPUR ]')
    })

    it('returns empty string if order is falsy', () => {
      expect(generateReceiptPlainText(null)).toBe('')
    })
  })

  describe('buildEscPosBuffer', () => {
    it('returns Uint8Array containing both kitchen and customer receipts with ESC/POS commands', () => {
      const buffer = buildEscPosBuffer(sampleOrder, 32, 'both')
      expect(buffer).toBeInstanceOf(Uint8Array)
      expect(buffer.length).toBeGreaterThan(0)

      // Inisialisasi awal ESC @ (0x1B, 0x40)
      expect(buffer[0]).toBe(0x1b)
      expect(buffer[1]).toBe(0x40)

      const decoded = new TextDecoder().decode(buffer)
      expect(decoded).toContain('SIKopi')
      expect(decoded).toContain('[ STRUK DAPUR ]')
      expect(decoded).toContain('[ STRUK PELANGGAN ]')
      expect(decoded).toContain('Budi Santoso')
    })

    it('builds kitchen-only buffer properly', () => {
      const buffer = buildKitchenEscPosBuffer(sampleOrder, 32)
      const decoded = new TextDecoder().decode(buffer)
      expect(decoded).toContain('[ STRUK DAPUR ]')
      expect(decoded).toContain('Budi Santoso')
      expect(decoded).not.toContain('[ STRUK PELANGGAN ]')
    })

    it('builds customer-only buffer properly', () => {
      const buffer = buildCustomerEscPosBuffer(sampleOrder, 32)
      const decoded = new TextDecoder().decode(buffer)
      expect(decoded).toContain('[ STRUK PELANGGAN ]')
      expect(decoded).toContain('Budi Santoso')
      expect(decoded).not.toContain('[ STRUK DAPUR ]')
    })
  })

  describe('isBluetoothSupported', () => {
    it('returns true when navigator.bluetooth.requestDevice is available', () => {
      vi.stubGlobal('navigator', {
        bluetooth: {
          requestDevice: vi.fn()
        }
      })
      expect(isBluetoothSupported()).toBe(true)
    })

    it('returns false when navigator.bluetooth is undefined', () => {
      vi.stubGlobal('navigator', {})
      expect(isBluetoothSupported()).toBe(false)
    })
  })

  describe('printReceiptViaBluetooth', () => {
    it('throws error when bluetooth is not supported', async () => {
      vi.stubGlobal('navigator', {})
      await expect(printReceiptViaBluetooth(sampleOrder)).rejects.toThrow(
        /Web Bluetooth API/
      )
    })

    it('handles cancellation gracefully when user dismisses picker', async () => {
      const notFoundErr = new Error('User cancelled')
      notFoundErr.name = 'NotFoundError'

      vi.stubGlobal('navigator', {
        bluetooth: {
          requestDevice: vi.fn().mockRejectedValue(notFoundErr)
        }
      })

      await expect(printReceiptViaBluetooth(sampleOrder)).rejects.toThrow(
        /dibatalkan/
      )
    })

    it('executes multi-step print with tear wait callback when printing both receipts', async () => {
      const mockCharacteristic = {
        properties: { write: true },
        writeValue: vi.fn().mockResolvedValue(undefined)
      }
      const mockService = {
        getCharacteristics: vi.fn().mockResolvedValue([mockCharacteristic])
      }
      const mockServer = {
        getPrimaryService: vi.fn().mockResolvedValue(mockService),
        getPrimaryServices: vi.fn().mockResolvedValue([mockService])
      }
      const mockDevice = {
        name: 'POS-58 Bluetooth',
        gatt: {
          connect: vi.fn().mockResolvedValue(mockServer),
          disconnect: vi.fn(),
          connected: true
        }
      }

      vi.stubGlobal('navigator', {
        bluetooth: {
          requestDevice: vi.fn().mockResolvedValue(mockDevice)
        }
      })

      const waitTearSpy = vi.fn().mockResolvedValue(undefined)
      const progressSpy = vi.fn()

      const result = await printReceiptViaBluetooth(sampleOrder, {
        mode: 'both',
        tearDelaySeconds: 1,
        onWaitTear: waitTearSpy,
        onProgress: progressSpy
      })

      expect(result.success).toBe(true)
      expect(waitTearSpy).toHaveBeenCalledTimes(1)
      expect(mockCharacteristic.writeValue).toHaveBeenCalled()
    })

    it('auto-reconnects to remembered printer without calling requestDevice again', async () => {
      const mockCharacteristic = {
        properties: { write: true },
        writeValue: vi.fn().mockResolvedValue(undefined)
      }
      const mockService = {
        getCharacteristics: vi.fn().mockResolvedValue([mockCharacteristic])
      }
      const mockServer = {
        getPrimaryService: vi.fn().mockResolvedValue(mockService),
        getPrimaryServices: vi.fn().mockResolvedValue([mockService])
      }
      const mockDevice = {
        id: 'printer-id-123',
        name: 'POS-58 Bluetooth',
        gatt: {
          connect: vi.fn().mockResolvedValue(mockServer),
          disconnect: vi.fn(),
          connected: false
        }
      }

      const requestDeviceSpy = vi.fn().mockResolvedValue(mockDevice)
      vi.stubGlobal('navigator', {
        bluetooth: {
          requestDevice: requestDeviceSpy
        }
      })

      // Print first time (calls requestDevice)
      await printReceiptViaBluetooth(sampleOrder, { mode: 'kitchen' })
      expect(requestDeviceSpy).toHaveBeenCalledTimes(1)
      expect(getSavedPrinterName()).toBe('POS-58 Bluetooth')

      // Print second time: should auto-reconnect using cachedDevice, NOT calling requestDevice!
      await printReceiptViaBluetooth(sampleOrder, { mode: 'customer' })
      expect(requestDeviceSpy).toHaveBeenCalledTimes(1) // Still 1! No new picker dialog
    })

    it('falls back to requestDevice if auto-reconnecting to cached printer fails (e.g. turned off)', async () => {
      const mockCharacteristic = {
        properties: { write: true },
        writeValue: vi.fn().mockResolvedValue(undefined)
      }
      const mockService = {
        getCharacteristics: vi.fn().mockResolvedValue([mockCharacteristic])
      }
      const mockServer = {
        getPrimaryService: vi.fn().mockResolvedValue(mockService),
        getPrimaryServices: vi.fn().mockResolvedValue([mockService])
      }
      const mockDevice = {
        id: 'printer-id-456',
        name: 'POS-58 Bluetooth',
        gatt: {
          connect: vi.fn().mockResolvedValue(mockServer),
          disconnect: vi.fn(),
          connected: false
        }
      }

      const requestDeviceSpy = vi.fn().mockResolvedValue(mockDevice)
      vi.stubGlobal('navigator', {
        bluetooth: {
          requestDevice: requestDeviceSpy
        }
      })

      // 1. Initial connect
      await printReceiptViaBluetooth(sampleOrder, { mode: 'kitchen' })
      expect(requestDeviceSpy).toHaveBeenCalledTimes(1)

      // 2. Simulate printer powered off (connect rejects)
      mockDevice.gatt.connect = vi.fn().mockRejectedValueOnce(new Error('NetworkError: Device is off'))
        .mockResolvedValueOnce(mockServer)

      // 3. Second print should detect disconnect, fail reconnect, and fallback to requestDevice
      await printReceiptViaBluetooth(sampleOrder, { mode: 'kitchen' })
      expect(requestDeviceSpy).toHaveBeenCalledTimes(2) // Falls back to picker!
    })
  })
})
