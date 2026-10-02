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
import java.util.regex.Pattern;

/**
 * 웹 전용 분석 — 페이지뷰, 레시피 조회수.
 *
 * Firestore 컬렉션:
 *  - web_stats/total : { count: long }                      — 전체(사람만)
 *  - web_stats/{YYYY-MM-DD} : { count, bots }               — 일자별 (KST 기준)
 *  - web_referrers/{YYYY-MM-DD} : { naver, google, ... }    — 유입 경로
 *  - web_recipe_views/{recipeId} : { count, lastViewed }    — 레시피별 조회수
 *
 * 비인증 호출 허용. 정확도보다 단순성·비용 우선.
 * 프론트는 sessionStorage 로 같은 세션 내 중복 카운트 방지.
 *
 * 봇은 count 에 넣지 않는다. 크롤러는 세션을 유지하지 않아 페이지마다 새
 * 방문자로 잡히는데, 2026-10-01 에 메타 AI 크롤러가 하루 65회 훑고 가면서
 * 방문자가 평소의 3.3배로 뛴 것처럼 보였다(실제 사람은 18명).
 * 집계가 틀리면 없느니만 못하므로 UA 로 걸러 bots 로 따로 센다.
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
    private static final String REFERRERS_COLLECTION = "web_referrers";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 흔한 크롤러·자동화 도구. 실제 로그에서 잡힌 것부터 넣었다. */
    private static final Pattern BOT_UA = Pattern.compile(
            "bot|spider|crawler|crawl|slurp|externalagent|yeti|facebookexternalhit"
                    + "|headlesschrome|python-requests|curl|wget|okhttp|java/|go-http"
                    + "|axios|scrapy|lighthouse|pagespeed|semrush|ahrefs|petalbot"
                    + "|applebot|duckduckbot|yandex|baidu|sogou|archive\\.org|ia_archiver",
            Pattern.CASE_INSENSITIVE);

    /** UA 가 없는 요청도 사람으로 보지 않는다 — 브라우저는 항상 보낸다. */
    static boolean isBot(String ua) {
        return ua == null || ua.isBlank() || BOT_UA.matcher(ua).find();
    }

    /**
     * 유입 경로 분류. 프론트가 document.referrer 를 ref 로 넘겨준다.
     *
     * Referer 헤더를 쓰면 안 된다 — fetch 는 '현재 페이지' 를 보내므로
     * 전부 yojalal.com 으로 찍힌다. 밖에서 어떻게 왔는지는 거기 안 남는다.
     */
    static String refBucket(String ref) {
        if (ref == null || ref.isBlank()) return "direct";
        String host;
        try {
            host = java.net.URI.create(ref).getHost();
        } catch (Exception e) {
            return "other";
        }
        if (host == null) return "other";
        host = host.toLowerCase();
        if (host.contains("yojalal.com")) return "internal";
        if (host.contains("naver")) return "naver";
        if (host.contains("google")) return "google";
        if (host.contains("instagram")) return "instagram";
        if (host.contains("facebook") || host.startsWith("fb.")) return "facebook";
        if (host.contains("daum") || host.contains("kakao")) return "kakao";
        if (host.contains("bing")) return "bing";
        if (host.contains("youtube") || host.contains("youtu.be")) return "youtube";
        return "other";
    }

    /** 페이지뷰 기록 — 일자별 + 누적. 봇은 bots 로 따로 센다. */
    @PostMapping("/visit")
    public ResponseEntity<Void> trackVisit(HttpServletRequest req,
                                           @RequestParam(required = false) String ref) {
        String today = LocalDate.now(KST).toString();
        try {
            if (isBot(req.getHeader("User-Agent"))) {
                firestore.collection(STATS_COLLECTION).document(today)
                        .set(Map.of("bots", FieldValue.increment(1)), SetOptions.merge()).get();
                return ResponseEntity.ok().build();
            }
            firestore.collection(STATS_COLLECTION).document(today)
                    .set(Map.of("count", FieldValue.increment(1)), SetOptions.merge()).get();
            firestore.collection(STATS_COLLECTION).document("total")
                    .set(Map.of("count", FieldValue.increment(1)), SetOptions.merge()).get();
            firestore.collection(REFERRERS_COLLECTION).document(today)
                    .set(Map.of(refBucket(ref), FieldValue.increment(1)), SetOptions.merge()).get();
        } catch (Exception e) {
            log.warn("trackVisit 실패: {}", e.getMessage());
        }
        return ResponseEntity.ok().build();
    }

    /** 레시피 페이지 조회수 기록. */
    @PostMapping("/recipe-view/{id}")
    public ResponseEntity<Void> trackRecipeView(@PathVariable String id, HttpServletRequest req) {
        if (id == null || id.isBlank()) return ResponseEntity.ok().build();
        if (isBot(req.getHeader("User-Agent"))) return ResponseEntity.ok().build();
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
    public ResponseEntity<Void> trackBlogView(@PathVariable String slug, HttpServletRequest req) {
        if (slug == null || slug.isBlank()) return ResponseEntity.ok().build();
        if (isBot(req.getHeader("User-Agent"))) return ResponseEntity.ok().build();
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
