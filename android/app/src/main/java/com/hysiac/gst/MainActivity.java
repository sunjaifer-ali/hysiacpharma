package com.hysiac.gst;

import android.app.KeyguardManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.CancellationSignal;
import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "https://appassets.androidplatform.net/assets/desktop.html";

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private boolean suppressLock = false;
    private boolean awaitingDevice = false;
    private boolean leftApp = false;
    private CancellationSignal deviceSignal;
    private BackupFolder backups;
    private final ExecutorService backupIo = Executors.newSingleThreadExecutor();

    private final ActivityResultLauncher<Intent> backupFolderPicker =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                Intent data = result.getData();
                if (result.getResultCode() != RESULT_OK || data == null || data.getData() == null) {
                    tellBackupFolder(false, "");
                    return;
                }
                try {
                    backups.remember(data.getData());
                    tellBackupFolder(true, backups.name());
                } catch (Exception e) {
                    tellBackupFolder(false, "");
                }
            });

    private final ActivityResultLauncher<Intent> deviceLock =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                tellDevice(result.getResultCode() == RESULT_OK);
            });

    private final ActivityResultLauncher<Intent> filePicker =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                Uri[] uris = WebChromeClient.FileChooserParams.parseResult(
                        result.getResultCode(), result.getData());
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(uris);
                    fileCallback = null;
                }
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        backups = new BackupFolder(getApplicationContext());
        getWindow().setStatusBarColor(Color.parseColor("#1B5C4A"));
        getWindow().setNavigationBarColor(Color.parseColor("#F3F0E8"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#F3F0E8"));
        setContentView(webView);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        webView.addJavascriptInterface(new Bridge(), "HysiacAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if ("appassets.androidplatform.net".equals(host)) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(
                        "(function(){if(window.HysiacAndroid&&!window.__hysiacPrintHook){window.__hysiacPrintHook=1;window.print=function(){var o=(document.documentElement.dataset.printOrient)||'portrait';window.HysiacAndroid.printPage(o);};}})();",
                        null);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                suppressLock = true;
                try {
                    filePicker.launch(params.createIntent());
                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        webView.loadUrl(APP_URL);
    }

    @Override
    protected void onStop() {
        if (!suppressLock && !awaitingDevice && webView != null) {
            leftApp = true;
            webView.evaluateJavascript("window.__hysiacLock&&window.__hysiacLock()", null);
        }
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (awaitingDevice) {
            if (webView != null) {
                webView.postDelayed(() -> {
                    if (!awaitingDevice) return;
                    awaitingDevice = false;
                    tellDevice(false);
                }, 600);
            }
            return;
        }
        boolean lockNow = leftApp && !suppressLock;
        suppressLock = false;
        leftApp = false;
        if (lockNow && webView != null) {
            webView.post(() -> {
                if (webView != null) {
                    webView.evaluateJavascript("window.__hysiacLock&&window.__hysiacLock()", null);
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void doPrint(String orient) {
        PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
        if (pm == null || webView == null) return;
        suppressLock = true;
        boolean landscape = orient != null && orient.toLowerCase().contains("land");
        PrintAttributes.MediaSize media = landscape
                ? PrintAttributes.MediaSize.ISO_A4.asLandscape()
                : PrintAttributes.MediaSize.ISO_A4.asPortrait();
        PrintAttributes attrs = new PrintAttributes.Builder()
                .setMediaSize(media)
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .setResolution(new PrintAttributes.Resolution("hysiac", "hysiac", 300, 300))
                .build();
        pm.print("Hysiac GST", webView.createPrintDocumentAdapter("Hysiac GST"), attrs);
    }

    private void tellDevice(boolean ok) {
        awaitingDevice = false;
        if (webView == null) return;
        webView.post(() -> {
            if (webView == null) return;
            webView.evaluateJavascript("window.__hysiacDeviceLock&&window.__hysiacDeviceLock(" + ok + ")", null);
        });
    }

    private void tellBackupFolder(boolean ok, String name) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.__hysiacBackupFolder&&window.__hysiacBackupFolder(" + ok + "," + JSONObject.quote(name == null ? "" : name) + ")",
                null);
    }

    private void tellBackupWrite(boolean ok) {
        if (webView == null) return;
        webView.evaluateJavascript("window.__hysiacBackupWrite&&window.__hysiacBackupWrite(" + ok + ")", null);
    }

    private void confirmDevice() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            confirmBiometric();
            return;
        }
        confirmLegacy();
    }

    private void confirmBiometric() {
        BiometricManager manager = (BiometricManager) getSystemService(BIOMETRIC_SERVICE);
        int kinds = BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        if (manager == null || manager.canAuthenticate(kinds) != BiometricManager.BIOMETRIC_SUCCESS) {
            kinds = BiometricManager.Authenticators.DEVICE_CREDENTIAL;
            if (manager == null || manager.canAuthenticate(kinds) != BiometricManager.BIOMETRIC_SUCCESS) {
                tellDevice(false);
                return;
            }
        }
        if (deviceSignal != null) {
            try {
                deviceSignal.cancel();
            } catch (Exception ignored) {
            }
        }
        deviceSignal = new CancellationSignal();
        suppressLock = true;
        awaitingDevice = true;
        try {
            BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                    .setTitle("Hysiac GST")
                    .setSubtitle("Unlock the books")
                    .setAllowedAuthenticators(kinds)
                    .build();
            prompt.authenticate(deviceSignal, getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    tellDevice(true);
                }

                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    tellDevice(false);
                }
            });
        } catch (Exception e) {
            awaitingDevice = false;
            confirmLegacy();
        }
    }

    @SuppressWarnings("deprecation")
    private void confirmLegacy() {
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (km == null || !km.isDeviceSecure()) {
            tellDevice(false);
            return;
        }
        Intent intent = km.createConfirmDeviceCredentialIntent("Hysiac GST", "Unlock the books");
        if (intent == null) {
            tellDevice(false);
            return;
        }
        suppressLock = true;
        awaitingDevice = true;
        deviceLock.launch(intent);
    }

    private void saveDownload(String fileName, byte[] bytes) {
        try {
            String safe = (fileName == null || fileName.trim().isEmpty()) ? "hysiac-gst-latest.json" : fileName.trim();
            safe = safe.replaceAll("[\\\\/:*?\"<>|]", "-");
            String mime = mimeFor(safe);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Could not create file");
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os == null) throw new IllegalStateException("Could not write file");
                    os.write(bytes);
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(uri, done, null, null);
                Toast.makeText(this, "Saved to Downloads: " + safe, Toast.LENGTH_LONG).show();
                if (safe.endsWith(".xls") || safe.endsWith(".xlsx") || safe.endsWith(".csv")) {
                    shareSaved(uri, mime, safe);
                }
                return;
            }
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) dir = getFilesDir();
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            File out = new File(dir, safe);
            try (OutputStream os = new FileOutputStream(out)) {
                os.write(bytes);
            }
            Toast.makeText(this, "Saved: " + out.getAbsolutePath(), Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Could not save file", Toast.LENGTH_LONG).show();
        }
    }

    private static String mimeFor(String name) {
        String lower = name.toLowerCase();
        if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
        if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".pdf")) return "application/pdf";
        return "application/json";
    }

    private void shareSaved(Uri uri, String mime, String name) {
        try {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, name);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            suppressLock = true;
            startActivity(Intent.createChooser(send, "Open or share " + name));
        } catch (Exception ignored) {
        }
    }

    private class Bridge {
        @JavascriptInterface
        public void saveTextFile(String fileName, String text) {
            byte[] bytes = (text == null ? "" : text).getBytes(StandardCharsets.UTF_8);
            runOnUiThread(() -> saveDownload(fileName, bytes));
        }

        @JavascriptInterface
        public void saveBase64File(String fileName, String data) {
            try {
                byte[] bytes = Base64.decode(data == null ? "" : data, Base64.DEFAULT);
                runOnUiThread(() -> saveDownload(fileName, bytes));
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Could not save file", Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void printPage(String orient) {
            runOnUiThread(() -> doPrint(orient));
        }

        @JavascriptInterface
        public void confirmDevice() {
            runOnUiThread(MainActivity.this::confirmDevice);
        }

        @JavascriptInterface
        public boolean hasBackupFolder() {
            return backups.has();
        }

        @JavascriptInterface
        public String backupFolderName() {
            return backups.has() ? backups.name() : "";
        }

        @JavascriptInterface
        public void pickBackupFolder() {
            runOnUiThread(() -> {
                suppressLock = true;
                backupFolderPicker.launch(backups.pickIntent());
            });
        }

        @JavascriptInterface
        public void clearBackupFolder() {
            backups.clear();
        }

        @JavascriptInterface
        public void writeBackupFile(String fileName, String text) {
            backupIo.execute(() -> {
                boolean ok = backups.write(fileName, text);
                runOnUiThread(() -> tellBackupWrite(ok));
            });
        }

        @JavascriptInterface
        public void listBackupFiles() {
            backupIo.execute(() -> {
                String json = backups.listJson();
                runOnUiThread(() -> {
                    if (webView == null) return;
                    webView.evaluateJavascript("window.__hysiacBackupList&&window.__hysiacBackupList(" + json + ")", null);
                });
            });
        }

        @JavascriptInterface
        public void readBackupFile(String fileName) {
            backupIo.execute(() -> {
                String text = backups.read(fileName);
                runOnUiThread(() -> {
                    if (webView == null) return;
                    webView.evaluateJavascript(
                            "window.__hysiacBackupRead&&window.__hysiacBackupRead(" + JSONObject.quote(text == null ? "" : text) + ")",
                            null);
                });
            });
        }
    }
}
