package com.devl.api.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 앱 버전 관리 — 프론트가 시작 시 이 엔드포인트를 호출해서
 * 최소 요구 버전 미만이면 강제 업데이트 안내, 권장 버전 미만이면 업데이트 추천 모달을 표시.
 *
 * 설정값은 application.properties에서 관리 (긴급 보안 패치 시 빠르게 올림).
 */
@RestController
@RequestMapping("/api/app")
public class AppVersionController {

    @Value("${app.min-version.ios:1.0.0}")
    private String iosMin;

    @Value("${app.min-version.android:1.0.0}")
    private String androidMin;

    @Value("${app.latest-version.ios:1.0.0}")
    private String iosLatest;

    @Value("${app.latest-version.android:1.0.0}")
    private String androidLatest;

    @Value("${app.store-url.ios:https://apps.apple.com/app/id0000000000}")
    private String iosStoreUrl;

    @Value("${app.store-url.android:https://play.google.com/store/apps/details?id=com.twentyvi.cookmate}")
    private String androidStoreUrl;

    @GetMapping("/version")
    public ResponseEntity<?> getVersion() {
        return ResponseEntity.ok(Map.of(
                "ios", Map.of(
                        "minVersion", iosMin,
                        "latestVersion", iosLatest,
                        "storeUrl", iosStoreUrl
                ),
                "android", Map.of(
                        "minVersion", androidMin,
                        "latestVersion", androidLatest,
                        "storeUrl", androidStoreUrl
                )
        ));
    }
}
