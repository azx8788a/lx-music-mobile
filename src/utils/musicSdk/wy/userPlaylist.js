// 登录态：/weapi/w/nuser/account/get（旧路径 /weapi/login/status 已失效）
// 歌单列表：/weapi/user/playlist（参考 NeteaseCloudMusicApi 的 login_status / user_playlist 模块）
// 写操作防风控：Cookie 带 __csrf、os=pc，payload 带 csrf_token（来源见 wyCsrf）
import { weapi } from './utils/crypto'
import { httpFetch } from '../../request'
import { getWyCsrf } from '../../wyCsrf'


const successCode = 200

const request = (path, data, token) => {
  const csrf = getWyCsrf()
  const requestObj = httpFetch(`https://music.163.com${path}`, {
    method: 'post',
    format: 'json',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      Referer: 'https://music.163.com',
      Cookie: `MUSIC_U=${token}; __csrf=${csrf}; os=pc`,
    },
    // cache: 'default',
    form: weapi({ ...data, csrf_token: csrf }),
    timeout: 10_000,
  })
  return requestObj.promise
}

const retryOnFail = (handler, tryNum = 0) => {
  if (tryNum > 2) return Promise.reject(new Error('try max num'))
  return handler(tryNum + 1).catch(err => {
    console.log('retry', err.message)
    return retryOnFail(handler, tryNum + 1)
  })
}

/**
 * 获取登录态信息（含 uid）
 * 注意：原 /weapi/login/status 路径已失效（返回 404 接口未找到），改用 /weapi/w/nuser/account/get
 */
export const getLoginStatus = async(token) => {
  const { statusCode, body } = await retryOnFail(() => request('/weapi/w/nuser/account/get', {}, token))
  if (statusCode !== 200) throw new Error(`获取登录态请求失败 (statusCode: ${statusCode})`)
  if (body.code !== successCode) throw new Error(`获取登录态失败 (code: ${body.code}, message: ${body.message ?? '-'})`)
  const profile = body.data?.profile ?? body.profile
  if (!profile?.userId) {
    const err = new Error('未获取到用户信息')
    err.code = 'INVALID_TOKEN'
    throw err
  }
  return profile
}

/**
 * 获取用户的歌单列表（创建的 + 收藏的）
 */
export const getUserPlaylistList = async({ uid, token }) => {
  const { statusCode, body } = await retryOnFail(() => request('/weapi/user/playlist', { uid, offset: 0, limit: 1000, includeVideo: 'true' }, token))
  if (statusCode !== 200) throw new Error(`获取歌单列表请求失败 (statusCode: ${statusCode})`)
  if (body.code !== successCode) throw new Error(`获取歌单列表失败 (code: ${body.code}, message: ${body.message ?? '-'})`)
  return body.playlist
}
