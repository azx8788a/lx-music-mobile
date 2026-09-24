// 网易云登录 Token（MUSIC_U）安全存储：
// - 密文保存在 AsyncStorage，加解密密钥由 AndroidKeyStore 保管（见 nativeModules/secureStore）
// - 内容生成的内存明文不会再被写回 @setting_v1（落盘前剥离 Token 字段）
// - 旧版本的明文 Token 在启动时自动迁移为密文（加密 → 回读校验 → 由设置保存清除明文）
import { getData, removeData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import settingState from '@/store/setting/state'
import { decryptString, encryptString } from '@/utils/nativeModules/secureStore'
import { log } from '@/utils/log'

const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : String(err)

const isUnsupportedError = (err: unknown) => (err as { code?: string } | null)?.code == 'SECURE_STORE_UNSUPPORTED'

// 持久化模式：
// - encrypted：密文存储可用，落盘时剥离 Token 字段（正常运行路径）
// - legacy：加密通道不可用（如 Android 6.0 以下），按原有明文方式运行；此时仅允许
//   allowedPlaintext 这一个值落盘（老设备的当前值，或迁移失败时被保护的旧明文），
//   避免其他来源的明文被意外写盘
const persistState = {
  mode: 'encrypted' as 'encrypted' | 'legacy',
  allowedPlaintext: '',
}

// 设置对象落盘前调用（见 config/setting.ts、core/common.ts）
export const sanitizeWyTokenForSave = (setting: LX.AppSetting): LX.AppSetting => {
  const token = setting['wy.musicUToken']
  if (persistState.mode == 'legacy') {
    if (token && token === persistState.allowedPlaintext) return setting
  }
  if (!token) return setting
  return { ...setting, 'wy.musicUToken': '' }
}

const applyToSettingState = (token: string) => {
  settingState.setting['wy.musicUToken'] = token
  global.state_event.configUpdated(['wy.musicUToken'], { 'wy.musicUToken': token })
}

// 运行期将当前设置整体落盘（Token 字段按当前模式剥离）
const persistSetting = async() => {
  await saveData(storageDataPrefix.setting, sanitizeWyTokenForSave(settingState.setting))
}

/**
 * 启动初始化：读取密文 / 迁移旧明文。
 * 在设置首次落盘前调用（config/setting.ts），保证：
 * 1. 迁移成功时，由紧随其后的设置保存删除明文（加密失败则保留明文，下次启动重试）
 * 2. 解密失败时不会启用一个错误的登录状态
 */
export const initWyTokenStorage = async(setting: LX.AppSetting): Promise<void> => {
  const plaintext = setting['wy.musicUToken']

  let encrypted: string | null = null
  try {
    encrypted = await getData<string>(storageDataPrefix.wyMusicUSecure)
  } catch (err) {
    log.warn(`[WY 安全存储] 读取加密 Token 失败：${getErrorMessage(err)}`)
  }

  // 1) 已有密文：解密读取（已迁移用户 / 已加密登录用户）
  if (encrypted) {
    try {
      const decrypted = await decryptString(encrypted)
      if (!decrypted) throw new Error('解密结果为空')
      setting['wy.musicUToken'] = decrypted
      persistState.mode = 'encrypted'
      if (plaintext) log.warn('[WY 安全存储] 检测到设置中的明文 Token 残留，将以加密存储为准并由本次设置保存清除')
      return
    } catch (err) {
      // 解密失败不得产生错误的登录状态：优先回退到旧明文重新迁移，否则按未登录处理
      log.error(`[WY 安全存储] 解密失败，未启用已保存的登录状态：${getErrorMessage(err)}`)
    }
  }

  // 2) 无明文：按未登录处理（新安装 / 已退出登录）
  if (!plaintext) {
    setting['wy.musicUToken'] = ''
    persistState.mode = 'encrypted'
    return
  }

  // 3) 旧明文迁移：加密 → 回读校验 → 明文交由本次设置保存删除
  try {
    const cipherText = await encryptString(plaintext)
    await saveData(storageDataPrefix.wyMusicUSecure, cipherText)
    const saved = await getData<string>(storageDataPrefix.wyMusicUSecure)
    if (saved !== cipherText) throw new Error('密文回读校验不一致')
    persistState.mode = 'encrypted'
    log.info('[WY 安全存储] 旧明文 Token 已加密迁移')
  } catch (err) {
    // 迁移失败：保留明文（不删除），下次启动或下次登录时重试
    persistState.mode = 'legacy'
    persistState.allowedPlaintext = plaintext
    log.warn(`[WY 安全存储] 加密迁移失败，本次保留明文存储，稍后重试：${getErrorMessage(err)}`)
  }
}

/**
 * 保存 Token（登录成功 / 手动修改）：加密并回读校验后写入，内存设置立即生效
 * @returns 是否已加密保存（false 表示仅保留在运行内存/降级到了原有方式）
 */
export const saveWyToken = async(token: string): Promise<boolean> => {
  if (!token) {
    await clearWyToken()
    return true
  }
  applyToSettingState(token)
  try {
    const cipherText = await encryptString(token)
    await saveData(storageDataPrefix.wyMusicUSecure, cipherText)
    const saved = await getData<string>(storageDataPrefix.wyMusicUSecure)
    if (saved !== cipherText) throw new Error('密文回读校验不一致')
    persistState.mode = 'encrypted'
    await persistSetting()
    log.info(`[WY 安全存储] 登录 Token 已加密保存（长度: ${token.length}）`)
    return true
  } catch (err) {
    if (isUnsupportedError(err)) {
      // Android 6.0 以下没有 Keystore AES：降级为原有明文方式，保持功能可用
      persistState.mode = 'legacy'
      persistState.allowedPlaintext = token
      try {
        await persistSetting()
        log.warn('[WY 安全存储] 系统不支持加密存储，已按原有方式保存登录 Token')
      } catch (saveErr) {
        log.error(`[WY 安全存储] 明文保存失败，Token 仅保留在运行内存中：${getErrorMessage(saveErr)}`)
      }
      return false
    }
    log.error(`[WY 安全存储] 加密保存失败，Token 仅保留在运行内存中：${getErrorMessage(err)}`)
    return false
  }
}

/**
 * 清除 Token（退出登录）：删除密文并同步内存设置
 */
export const clearWyToken = async(): Promise<void> => {
  applyToSettingState('')
  try {
    await removeData(storageDataPrefix.wyMusicUSecure)
    await persistSetting()
    log.info('[WY 安全存储] 已清除加密登录 Token')
  } catch (err) {
    log.warn(`[WY 安全存储] 清除加密 Token 失败：${getErrorMessage(err)}`)
  }
}
