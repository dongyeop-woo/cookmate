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
    private static final String BLOG_VIEWS_COLLECTION = "web_blog_views";
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

    /** 블로그 글 조회수 기록. (slug 단위) */
    @PostMapping("/blog-view/{slug}")
    public ResponseEntity<Void> trackBlogView(@PathVariable String slug) {
        if (slug == null || slug.isBlank()) return ResponseEntity.ok().build();
        try {
            Map<String, Object> update = new HashMap<>();
            update.put("count", FieldValue.increment(1));
            update.put("lastViewed", Instant.now().toString());
            firestore.collection(BLOG_VIEWS_COLLECTION).document(slug)
                    .set(update, SetOptions.merge()).get();
        } catch (Exception e) {
            log.warn("trackBlogView 실패 slug={}: {}", slug, e.getMessage());
        }
        return ResponseEntity.ok().build();
    }

    /** 단일 블로그 글 조회수. */
    @GetMapping("/blog-view/{slug}")
    public ResponseEntity<Map<String, Object>> getBlogViewCount(@PathVariable String slug)
            throws ExecutionException, InterruptedException {
        long count = readCount(BLOG_VIEWS_COLLECTION, slug);
        return ResponseEntity.ok(Map.of("slug", slug, "count", count));
    }

    /** 모든 블로그 글 조회수 한 번에 — {slug: count} 맵. 목록 페이지에서 N+1 방지. */
    @GetMapping("/blog-views")
    public ResponseEntity<Map<String, Long>> getAllBlogViews()
            throws ExecutionException, InterruptedException {
        var snap = firestore.collection(BLOG_VIEWS_COLLECTION).get().get();
        Map<String, Long> result = new HashMap<>();
        for (var d : snap.getDocuments()) {
            Long c = d.getLong("count");
            result.put(d.getId(), c == null ? 0L : c);
        }
        return ResponseEntity.ok(result);
    }

    /** 조회수 상위 N개 — {id, count} 리스트. limit 기본 5, 최대 50. */
    @GetMapping("/top-viewed")
    public ResponseEntity<java.util.List<Map<String, Object>>> getTopViewed(
            @RequestParam(defaultValue = "5") int limit
    ) throws ExecutionException, InterruptedException {
        int safeLimit = Math.max(1, Math.min(50, limit));
        var snap = firestore.collection(RECIPE_VIEWS_COLLECTION)
                .orderBy("count", com.google.cloud.firestore.Query.Direction.DESCENDING)
                .limit(safeLimit)
                .get().get();
        var result = snap.getDocuments().stream()
                .map(d -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", d.getId());
                    Long c = d.getLong("count");
                    m.put("count", c == null ? 0L : c);
                    return m;
                })
                .toList();
        return ResponseEntity.ok(result);
    }

    private long readCount(String collection, String docId) throws ExecutionException, InterruptedException {
        var snap = firestore.collection(collection).document(docId).get().get();
        if (!snap.exists()) return 0L;
        Long v = snap.getLong("count");
        return v == null ? 0L : v;
    }
}
