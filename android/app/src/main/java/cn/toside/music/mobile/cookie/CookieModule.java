package cn.toside.music.mobile.cookie;

import android.webkit.CookieManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class CookieModule extends ReactContextBaseJavaModule {

  CookieModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "CookieModule";
  }

  /**
   * 读取 WebView CookieManager 中指定 url 的 Cookie（含 HttpOnly Cookie）
   * 返回格式："name=value; name2=value2"，无 Cookie 时返回空字符串
   */
  @ReactMethod
  public void getCookie(String url, Promise promise) {
    try {
      String cookie = CookieManager.getInstance().getCookie(url);
      promise.resolve(cookie == null ? "" : cookie);
    } catch (Exception e) {
      promise.resolve("");
    }
  }

  /**
   * 强制将 Cookie 落盘持久化
   */
  @ReactMethod
  public void flush(Promise promise) {
    try {
      CookieManager.getInstance().flush();
    } catch (Exception ignored) {
    }
    promise.resolve(null);
  }

  /**
   * 删除指定 url 下的 Cookie（按名称逐个置为过期）。
   * 同时以 Domain=163.com 重写一份过期 Cookie，覆盖网易云设置在根域
   * （.163.com）上的持久 Cookie；不触碰其他域名的 Cookie。
   */
  @ReactMethod
  public void removeCookies(String url, Promise promise) {
    try {
      CookieManager cm = CookieManager.getInstance();
      String cookies = cm.getCookie(url);
      if (cookies != null && !cookies.isEmpty()) {
        for (String cookie : cookies.split(";")) {
          String[] parts = cookie.split("=", 2);
          String name = parts[0].trim();
          if (name.isEmpty()) continue;
          cm.setCookie(url, name + "=; Path=/; Max-Age=0");
          cm.setCookie(url, name + "=; Domain=163.com; Path=/; Max-Age=0");
        }
      }
      cm.flush();
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("COOKIE_REMOVE_FAILED", e.toString(), e);
    }
  }

}
