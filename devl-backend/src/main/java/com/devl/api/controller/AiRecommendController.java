package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.dto.AiRecommendDto;
import com.devl.api.service.AiRecommendService;
import com.devl.api.service.AiRecommendService.OffTopicException;
import com.devl.api.service.AiRecommendService.QuotaExceededException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Slf4j
public class AiRecommendController {

    private final AiRecommendService aiService;

    @GetMapping("/quota/{uid}")
    public ResponseEntity<?> getQuota(@PathVariable String uid, HttpServletRequest httpReq) {
        AuthContext.requireSelf(httpReq, uid);
        try {
            if (uid == null || uid.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "uid 필수"));
            }
            return ResponseEntity.ok(aiService.getQuota(uid));
        } catch (Exception e) {
            log.error("AI 쿼터 조회 실패", e);
            return ResponseEntity.status(500).body(Map.of("error", "쿼터 조회 실패"));
        }
    }

    @PostMapping("/recommend-recipes")
    public ResponseEntity<?> recommendRecipes(@RequestBody AiRecommendDto.Request req, HttpServletRequest httpReq) {
        try {
            if (req.getUid() == null || req.getUid().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "uid 필수"));
            }
            AuthContext.requireSelf(httpReq, req.getUid());
            AiRecommendDto.Response resp = aiService.recommend(req.getUid(), req.getQuery());
            return ResponseEntity.ok(resp);
        } catch (QuotaExceededException e) {
            // 무료 한도 초과 — 클라이언트에서 페이월/프리미엄 안내 모달 표시용
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "QUOTA_EXCEEDED", "message", e.getMessage()));
        } catch (OffTopicException e) {
            // 음식 외 입력 — Gemini 호출 X, 쿼터 차감 X. 클라이언트는 친절한 안내 메시지 표시.
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "OFF_TOPIC", "message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("AI 추천 실패", e);
            return ResponseEntity.status(500).body(Map.of("error", "AI 추천 처리 중 오류"));
        }
    }
}
