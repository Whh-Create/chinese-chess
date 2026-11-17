package com.example.chinesechess;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

/**
 * 中国象棋：整个游戏是纯前端页面，这里只做一个全屏 WebView 壳。
 * 页面资源打包在 assets/www 下，构建时由 Gradle 任务从仓库根目录同步。
 */
public class MainActivity extends Activity {

    private static final String GAME_URL = "file:///android_asset/www/index.html";
    private static final int BG_COLOR = Color.rgb(0xF3, 0xE8, 0xD2);

    private WebView webView;
    private long lastBackPressedAt = 0L;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setUpWindow();

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(BG_COLOR);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        configureWebSettings(webView.getSettings());

        webView.setWebChromeClient(new WebChromeClient());
        webView.loadUrl(GAME_URL);

        setContentView(webView);

        // 下棋时不要自动锁屏
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private void setUpWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(0xF0, 0xE4, 0xCD));
        window.setNavigationBarColor(Color.rgb(0xF0, 0xE4, 0xCD));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // 浅色状态栏上使用深色图标
            window.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    private void configureWebSettings(WebSettings s) {
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);

        // 本地资源不需要网络，但保留默认缓存策略以加快二次启动
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // 棋盘由 JS 自适应尺寸，禁用缩放避免误触双指缩放
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);

        // 允许落子音效无需用户手势即可播放
        s.setMediaPlaybackRequiresUserGesture(false);

        // 让 CSS 的 viewport 生效
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
    }

    @Override
    public void onBackPressed() {
        // 连按两次返回才退出，避免误触中断对局
        long now = System.currentTimeMillis();
        if (now - lastBackPressedAt < 2000L) {
            super.onBackPressed();
            return;
        }
        lastBackPressedAt = now;
        Toast.makeText(this, "再按一次返回键退出棋局", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.setVisibility(View.GONE);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
