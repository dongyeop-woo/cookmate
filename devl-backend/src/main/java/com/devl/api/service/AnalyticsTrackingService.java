package com.devl.api.service;

import com.google.cloud.firestore.Firestore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 제품 개선을 위한 이벤트 로그 수집.
 * - failed_searches: 검색 결과 0개 쿼리 (새 콘텐츠 추가 힌트)
 * - cooking_step_events: 요리모드 단계 진입/완료 (이탈 지점 발견)
 *
 * 쓰기 전용 컬렉션으로, 집계는 AdminStatsService가 담당.
 * TTL이나 샘플링이 필요해지면 Firestore TTL 또는 스케줄드 클린업으로 대응.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsTrackingService {

    private final Firestore firestore;

    /** 검색 결과 0개인 쿼리를 기록 (비동기적 best-effort). */
    public void logFailedSearch(String uid, String query, String source) {
        if (query == null || query.isBlank()) return;
        try {
            Map<String, Object> m = new HashMap<>();
            m.put("uid", uid);
            m.put("query", query.trim());
            m.put("source", source); // "recipe" | "ingredient" | "community" 등
            m.put("at", Instant.now().toString());
            firestore.collection("failed_searches").document(UUID.randomUUID().toString()).set(m);
            // .get() 하지 않음 — fire-and-forget로 프론트 응답 지연 방지
        } catch (Exception e) {
            log.warn("failed_searches 기록 실패: {}", e.getMessage());
        }
    }

    /**
     * 요리모드 단계 이벤트 기록.
     * type: "enter" (단계 진입) / "complete" (단계 완료 후 다음으로 진행)
     * complete 카운트가 enter 대비 낮으면 해당 단계에서 이탈.
     */
    public void logCookingStepEvent(String uid, String recipeId, String recipeTitle, int step, String type) {
        if (recipeId == null || type == null) return;
        if (!type.equals("enter") && !type.equals("complete")) return;
        try {
            Map<String, Object> m = new HashMap<>();
            m.put("uid", uid);
            m.put("recipeId", recipeId);
            m.put("recipeTitle", recipeTitle);
            m.put("step", step);
            m.put("type", type);
            m.put("at", Instant.now().toString());
            firestore.collection("cooking_step_events").document(UUID.randomUUID().toString()).set(m);
        } catch (Exception e) {
            log.warn("cooking_step_events 기록 실패: {}", e.getMessage());
        }
    }
}
