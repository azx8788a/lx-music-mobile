// QR Code Generator (vendored from qrcode-generator@1.4.4) 类型声明
interface QRCode {
  addData: (data: string, mode?: 'Numeric' | 'Alphanumeric' | 'Byte' | 'Kanji') => void
  make: () => void
  getModuleCount: () => number
  isDark: (row: number, col: number) => boolean
}

declare function qrcode(typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'): QRCode

export default qrcode
