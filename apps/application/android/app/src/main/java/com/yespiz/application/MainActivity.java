package com.yespiz.application;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.util.Collections;

public class MainActivity extends BridgeActivity {
    @Override
    protected void load() {
        super.load();
        if (bridge.getServerUrl() != null) return;

        Uri local = Uri.parse(bridge.getAppUrl());
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String path = url.getPath();
                if ("GET".equals(request.getMethod()) && local.getScheme().equals(url.getScheme())
                    && local.getAuthority().equals(url.getAuthority()) && path != null
                    && path.matches("/[A-Za-z0-9_/-]+") && !path.contains("//")) {
                    String route = path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
                    try {
                        return new WebResourceResponse("text/html", "UTF-8", getAssets().open("public" + route + ".html"));
                    } catch (IOException missing) {
                        try {
                            return new WebResourceResponse("text/html", "UTF-8", 404, "Not Found",
                                Collections.emptyMap(), getAssets().open("public/404.html"));
                        } catch (IOException ignored) {
                            return super.shouldInterceptRequest(view, request);
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }
}
