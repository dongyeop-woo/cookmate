package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.service.AnalyticsTrackingService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 프론트가 호출하는 이벤트 수집 엔드포인트.
 * 인증 사용자만 기록 — 익명 스팸 차단.
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsTrackingController {

    private final AnalyticsTrackingService tracking;

    /**
     * body: { "query": "...", "source": "recipe" | "ingredient" | "community" }
     */
    @PostMapping("/failed-search")
    public ResponseEntity<Void> failedSearch(@RequestBody Map<String, String> body, HttpServletRequest req) {
        AuthContext.requireAuth(req);
        tracking.logFailedSearch(
                AuthContext.uid(req),
                body.get("query"),
                body.getOrDefault("source", "unknown")
        );
        return ResponseEntity.accepted().build();
    }

    /**
     * body: { "recipeId": "...", "recipeTitle": "...", "step": 3, "type": "enter" | "complete" }
     */
    @PostMapping("/cooking-step")
    public ResponseEntity<Void> cookingStep(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        AuthContext.requireAuth(req);
        String recipeId = (String) body.get("recipeId");
        String recipeTitle = (String) body.get("recipeTitle");
        Object stepRaw = body.get("step");
        int step = stepRaw instanceof Number ? ((Number) stepRaw).intValue() : 0;
        String type = (String) body.get("type");
        tracking.logCookingStepEvent(AuthContext.uid(req), recipeId, recipeTitle, step, type);
        return ResponseEntity.accepted().build();
    }
}
