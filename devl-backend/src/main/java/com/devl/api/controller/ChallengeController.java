package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.auth.RateLimiter;
import com.devl.api.service.ChallengeService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/challenges")
@RequiredArgsConstructor
public class ChallengeController {

    private final ChallengeService challengeService;
    private final RateLimiter rateLimiter;

    @GetMapping("/today")
    public ResponseEntity<?> today(@RequestParam("uid") String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            return ResponseEntity.ok(challengeService.getToday(uid));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/complete")
    public ResponseEntity<?> complete(
            @RequestParam("uid") String uid,
            @RequestParam("taskId") String taskId,
            HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            // 과제 종류가 3개뿐이라 정상 사용이면 분당 몇 회를 넘지 않는다
            rateLimiter.check("challenge:" + uid, 20, 60_000);
            return ResponseEntity.ok(challengeService.complete(uid, taskId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
