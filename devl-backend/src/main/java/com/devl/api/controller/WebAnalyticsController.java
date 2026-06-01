package com.devl.api.controller;

import com.google.cloud.firestore.FieldValue;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.SetOptions;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;

/**
 * 웹 전용 분석 — 페이지뷰, 레시피 조회수.
 *
 * Firestore 컬렉션:
 *  - web_stats/total : { count: long }                — 전체 페이지뷰
 *  - web_stats/{YYYY-MM-DD} : { count: long }         — 일자별 페이지뷰 (KST 기준)
 *  - web_recipe_views/{recipeId} : { count, lastViewed } — 레시피별 조회수
 *
 * 비인증 호출 허용. 정확도보다 단순성·비용 우선.
 * 프론트는 localStorage 로 같은 세션 내 중복 카운트 방지.
 */
@Slf4j
@RestController
@RequestMapping("/api/web")
@RequiredArgsConstructor
public class WebAnalyticsController {

    private final Firestore firestore;

    private static final String STATS_COLLECTION = "web_stats";
    private static final String RECIPE_VIEWS_COLLECTION = "web_recipe_views";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 페이지뷰 기록 — 일자별 + 누적. */
    @PostMapping("/visit")
    public ResponseEntity<Void> trackVisit(HttpServletRequest req) {
        try {
            String today = LocalDate.now(KST).toString();
            firestore.collection(STATS_COLLECTION).document(today)
                    .set(Map.of("count", FieldValue.increment(1)), SetOptions.merge()).get();
            firestore.collection(STATS_COLLECTION).document("total")
                    .set(Map.of("count", FieldValue.increment(1)), SetOptions.merge()).get();
        } catch (Exception e) {
            log.warn("trackVisit 실패: {}", e.getMessage());
        }
        return ResponseEntity.ok().build();
    }

    /** 레시피 페이지 조회수 기록. */
    @PostMapping("/recipe-view/{id}")
    public ResponseEntity<Void> trackRecipeView(@PathVariable String id) {
        if (id == null || id.isBlank()) return ResponseEntity.ok().build();
        try {
            Map<String, Object> update = new HashMap<>();
            update.put("count", FieldValue.increment(1));
            update.put("lastViewed", Instant.now().toString());
            firestore.collection(RECIPE_VIEWS_COLLECTION).document(id)
                    .set(update, SetOptions.merge()).get();
        } catch (Exception e) {
            log.warn("trackRecipeView 실패 id={}: {}", id, e.getMessage());
        }
        return ResponseEntity.ok().build();
    }

    /** 오늘 + 누적 페이지뷰 반환. */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() throws ExecutionException, InterruptedException {
        String today = LocalDate.now(KST).toString();
        long todayCount = readCount(STATS_COLLECTION, today);
        long totalCount = readCount(STATS_COLLECTION, "total");
        return ResponseEntity.ok(Map.of("today", todayCount, "total", totalCount));
    }

    /** 단일 레시피 조회수. */
    @GetMapping("/recipe-view/{id}")
    public ResponseEntity<Map<String, Object>> getRecipeViewCount(@PathVariable String id)
            throws ExecutionException, InterruptedException {
        long count = readCount(RECIPE_VIEWS_COLLECTION, id);
        return ResponseEntity.ok(Map.of("id", id, "count", count));
    }

    private long readCount(String collection, String docId) throws ExecutionException, InterruptedException {
        var snap = firestore.collection(collection).document(docId).get().get();
        if (!snap.exists()) return 0L;
        Long v = snap.getLong("count");
        return v == null ? 0L : v;
    }
}
