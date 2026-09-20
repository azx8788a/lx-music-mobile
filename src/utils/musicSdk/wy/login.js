// 网易云扫码登录 API
// 流程：获取 unikey → 生成二维码链接 → 轮询扫码状态 → 登录成功后从 Set-Cookie 提取 MUSIC_U
// 参考 https://github.com/Binaryify/NeteaseCloudMusicApi（login_qr_key / login_qr_check）
import { weapi } from './utils/crypto'
import { httpFetch } from '../../request'


const successCode = 200

const request = (path, data) => {
  const requestObj = httpFetch(`https://music.163.com${path}`, {
    method: 'post',
    format: 'json',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      Referer: 'https://music.163.com',
    },
    form: weapi(data),
    timeout: 10_000,
  })
  return requestObj.promise
}

/**
 * 获取二维码登录的 unikey
 * @returns {Promise<string>}
 */
export const getQrKey = async() => {
  const { statusCode, body } = await request('/weapi/login/qrcode/unikey', { type: 1 })
  if (statusCode !== 200) throw new Error(`请求失败 (code: ${statusCode})`)
  if (body.code !== successCode || !body.unikey) throw new Error(body.message ?? '获取二维码失败')
  return body.unikey
}

/**
 * 由 unikey 生成二维码内容（使用网易云音乐 App 扫码）
 * @param {string} unikey
 * @returns {string}
 */
export const getQrUrl = unikey => `https://music.163.com/login?codekey=${unikey}`

/**
 * 从响应头 Set-Cookie 中提取 MUSIC_U 的值
 */
const pickMusicU = rawHeaders => {
  let setCookie = rawHeaders?.['set-cookie'] ?? rawHeaders?.['Set-Cookie']
  if (!setCookie) return ''
  if (Array.isArray(setCookie)) setCookie = setCookie.join('; ')
  const matches = String(setCookie).match(/MUSIC_U=[^;\s,]+/g) ?? []
  let musicU = ''
  for (const item of matches) {
    const value = item.substring('MUSIC_U='.length)
    if (value) musicU = value
  }
  return musicU
}

/**
 * 检查扫码状态
 *
 * 返回体含 code 字段：
 *   800 二维码过期 / 801 等待扫码 / 802 已扫码待确认（含 nickname、avatarUrl）/ 803 登录成功
 * 登录成功（803）时额外返回 musicU（MUSIC_U Cookie 值）
 *
 * @returns {Promise<{ code: number, message?: string, nickname?: string, avatarUrl?: string, musicU: string }>}
 */
export const checkQrStatus = async unikey => {
  const { statusCode, body, headers } = await request('/weapi/login/qrcode/client/login', { key: unikey, type: 1 })
  if (statusCode !== 200) throw new Error(`请求失败 (code: ${statusCode})`)
  return {
    ...body,
    musicU: body.code === 803 ? pickMusicU(headers) : '',
  }
}
