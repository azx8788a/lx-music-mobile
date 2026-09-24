package cn.toside.music.mobile.securestore;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * 本地敏感字符串的加密存储（AES-GCM + AndroidKeyStore）。
 *
 * - 密钥由 AndroidKeyStore 生成与保管，不写入任何文件、SharedPreferences 或 AsyncStorage；
 * - 加密结果格式（Base64）：[1 字节版本][1 字节 IV 长度][IV][GCM 密文+认证标签]；
 * - 密钥丢失或密文损坏时解密会失败（GCM 认证），调用方不得将失败结果当作有效数据。
 */
public class SecureStoreModule extends ReactContextBaseJavaModule {
  private static final String MODULE_NAME = "SecureStoreModule";
  private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
  private static final String KEY_ALIAS = "lx_music_wy_token_v1";
  private static final String TRANSFORMATION = "AES/GCM/NoPadding";
  private static final int GCM_TAG_LENGTH_BIT = 128;
  private static final int KEY_SIZE_BIT = 256;
  private static final int PAYLOAD_VERSION = 1;

  SecureStoreModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return MODULE_NAME;
  }

  // Android Keystore 的对称密钥（AES）需要 Android 6.0（API 23）及以上
  private static boolean isSupported() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M;
  }

  private SecretKey getOrCreateKey() throws Exception {
    KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
    keyStore.load(null);
    if (keyStore.containsAlias(KEY_ALIAS)) {
      KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
      if (entry instanceof KeyStore.SecretKeyEntry) {
        return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
      }
      // 别名被非对称密钥占用（正常流程不会发生）：删除后重建
      keyStore.deleteEntry(KEY_ALIAS);
    }
    KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
    keyGenerator.init(new KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(KEY_SIZE_BIT)
      .setRandomizedEncryptionRequired(true)
      .build());
    return keyGenerator.generateKey();
  }

  private static String errorMessage(Throwable e) {
    return e.getMessage() != null ? e.getMessage() : e.toString();
  }

  @ReactMethod
  public void encrypt(String plainText, Promise promise) {
    if (!isSupported()) {
      promise.reject("SECURE_STORE_UNSUPPORTED", "Android Keystore AES 需要 Android 6.0（API 23）及以上");
      return;
    }
    try {
      SecretKey key = getOrCreateKey();
      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.ENCRYPT_MODE, key);
      byte[] iv = cipher.getIV();
      byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
      ByteBuffer buffer = ByteBuffer.allocate(2 + iv.length + encrypted.length);
      buffer.put((byte) PAYLOAD_VERSION);
      buffer.put((byte) iv.length);
      buffer.put(iv);
      buffer.put(encrypted);
      promise.resolve(Base64.encodeToString(buffer.array(), Base64.NO_WRAP));
    } catch (Throwable e) {
      promise.reject("SECURE_STORE_ENCRYPT_FAILED", errorMessage(e), e);
    }
  }

  @ReactMethod
  public void decrypt(String payload, Promise promise) {
    if (!isSupported()) {
      promise.reject("SECURE_STORE_UNSUPPORTED", "Android Keystore AES 需要 Android 6.0（API 23）及以上");
      return;
    }
    try {
      byte[] bytes = Base64.decode(payload, Base64.NO_WRAP);
      if (bytes.length < 2) throw new IllegalArgumentException("密文长度非法");
      ByteBuffer buffer = ByteBuffer.wrap(bytes);
      int version = buffer.get() & 0xFF;
      if (version != PAYLOAD_VERSION) throw new IllegalArgumentException("密文版本不支持: " + version);
      int ivLength = buffer.get() & 0xFF;
      if (ivLength <= 0 || buffer.remaining() <= ivLength) throw new IllegalArgumentException("密文长度非法");
      byte[] iv = new byte[ivLength];
      buffer.get(iv);
      byte[] encrypted = new byte[buffer.remaining()];
      buffer.get(encrypted);
      if (encrypted.length == 0) throw new IllegalArgumentException("密文内容为空");

      KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
      keyStore.load(null);
      if (!keyStore.containsAlias(KEY_ALIAS)) {
        throw new IllegalStateException("密钥不存在（可能已被系统清除）");
      }
      KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
      if (!(entry instanceof KeyStore.SecretKeyEntry)) {
        throw new IllegalStateException("密钥类型异常");
      }
      SecretKey key = ((KeyStore.SecretKeyEntry) entry).getSecretKey();

      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BIT, iv));
      byte[] decrypted = cipher.doFinal(encrypted);
      promise.resolve(new String(decrypted, StandardCharsets.UTF_8));
    } catch (Throwable e) {
      promise.reject("SECURE_STORE_DECRYPT_FAILED", errorMessage(e), e);
    }
  }
}
