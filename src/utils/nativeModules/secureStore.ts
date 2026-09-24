import { NativeModules } from 'react-native'

const { SecureStoreModule } = NativeModules

// 使用 AndroidKeyStore 中保管的 AES-GCM 密钥对字符串加解密（密钥不落盘）
// 系统不支持时 reject code 为 SECURE_STORE_UNSUPPORTED；解密失败（密钥丢失/密文损坏）会 reject，不会返回错误结果
export const encryptString = SecureStoreModule.encrypt as (plainText: string) => Promise<string>
export const decryptString = SecureStoreModule.decrypt as (payload: string) => Promise<string>
