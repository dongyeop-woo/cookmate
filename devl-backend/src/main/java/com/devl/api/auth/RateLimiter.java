package com.devl.api.auth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * 메모리 기반 간단한 슬라이딩-윈도우 레이트 리밋.
 * 분산 환경(멀티 인스턴스)에서는 인스턴스별로 카운트되므로, 전역 한도는
 * (한도 * 인스턴스 수) 로 느슨해진다는 점을 감안해야 함. 현재 단일 인스턴스
 * Cloud Run 구성을 전제로 한다.
 */
@Slf4j
@Component
public class RateLimiter {

    private static final class Window {
        long windowStart;
        int count;
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    /**
     * @param key     제한 키 (예: "attendance:uid123")
     * @param limit   windowMs 동안 허용 횟수
     * @param windowMs 시간 창 (밀리초)
     * @return true=허용, false=초과
     */
    public boolean tryAcquire(String key, int limit, long windowMs) {
        long now = System.currentTimeMillis();
        Window w = windows.computeIfAbsent(key, k -> new Window());
        synchronized (w) {
            if (now - w.windowStart >= windowMs) {
                w.windowStart = now;
                w.count = 1;
                return true;
            }
            if (w.count >= limit) return false;
            w.count++;
            return true;
        }
    }

    public void check(String key, int limit, long windowMs) {
        if (!tryAcquire(key, limit, windowMs)) {
            throw new TooManyRequestsException("요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.");
        }
    }

    public static class TooManyRequestsException extends RuntimeException {
        public TooManyRequestsException(String msg) { super(msg); }
    }
}
