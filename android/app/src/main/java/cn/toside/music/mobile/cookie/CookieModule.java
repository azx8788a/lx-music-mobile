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

}
