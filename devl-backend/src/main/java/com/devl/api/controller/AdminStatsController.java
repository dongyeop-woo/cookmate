package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.service.AdminStatsService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

/**
 * 관리자 통계 엔드포인트. 전부 관리자 권한 필요.
 * 기존 데이터에서 애드혹 집계하므로 캐시 없음 — 호출 빈도가 낮다고 가정.
 */
@RestController
@RequestMapping("/api/admin/stats")
@RequiredArgsConstructor
public class AdminStatsController {

    private final AdminStatsService statsService;

    @GetMapping("/dau")
    public ResponseEntity<Map<String, Object>> dau(
            @RequestParam(required = false) String date,
            HttpServletRequest req
    ) throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getDau(date == null ? statsService.todayKst() : date));
    }

    @GetMapping("/dau/series")
    public ResponseEntity<List<Map<String, Object>>> dauSeries(
            @RequestParam(defaultValue = "7") int days,
            HttpServletRequest req
    ) throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getDauSeries(Math.min(Math.max(days, 1), 90)));
    }

    @GetMapping("/retention")
    public ResponseEntity<Map<String, Object>> retention(HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getRetention());
    }

    @GetMapping("/time-to-first-recipe")
    public ResponseEntity<Map<String, Object>> timeToFirstRecipe(HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getTimeToFirstRecipe());
    }

    @GetMapping("/reports-by-reason")
    public ResponseEntity<List<Map<String, Object>>> reportsByReason(HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getReportsByReason());
    }

    @GetMapping("/review-length")
    public ResponseEntity<Map<String, Object>> reviewLength(HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getReviewLengthDistribution());
    }

    @GetMapping("/refund-reasons")
    public ResponseEntity<List<Map<String, Object>>> refundReasons(HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getRefundReasons());
    }

    @GetMapping("/gifticon-heatmap")
    public ResponseEntity<Map<String, Object>> gifticonHeatmap(HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getGifticonHeatmap());
    }

    @GetMapping("/custom-ingredients")
    public ResponseEntity<List<Map<String, Object>>> customIngredients(HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getCustomIngredients());
    }

    @GetMapping("/failed-searches")
    public ResponseEntity<List<Map<String, Object>>> failedSearches(HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getFailedSearches());
    }

    @GetMapping("/cooking-dropoff")
    public ResponseEntity<List<Map<String, Object>>> cookingDropoff(HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(statsService.getCookingDropoff());
    }
}
