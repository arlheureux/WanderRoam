package com.wanderroam.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ServerLoader")
public class ServerLoaderPlugin extends Plugin {

    private static final String PREFS_NAME = "CapacitorPreferences";
    private static final String KEY = "wanderroam_server_url";

    @Override
    public void load() {
        String url = getServerUrl();
        if (url != null && !url.isEmpty()) {
            WebView webView = getBridge().getWebView();
            webView.post(() -> webView.loadUrl(url));
        }
    }

    @PluginMethod
    public void loadServerUrl(PluginCall call) {
        String url = call.getString("url", getServerUrl());
        if (url == null || url.isEmpty()) {
            call.reject("No server URL configured");
            return;
        }
        WebView webView = getBridge().getWebView();
        webView.post(() -> webView.loadUrl(url));
        call.resolve();
    }

    @PluginMethod
    public void getServerUrl(PluginCall call) {
        JSObject result = new JSObject();
        result.put("url", getServerUrl());
        call.resolve(result);
    }

    private String getServerUrl() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY, null);
    }
}
