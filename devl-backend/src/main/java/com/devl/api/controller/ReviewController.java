package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.auth.RateLimiter;
import com.devl.api.dto.ReviewDto;
import com.devl.api.service.ReviewService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;
    private final RateLimiter rateLimiter;

    @GetMapping("/recipe/{recipeId}")
    public ResponseEntity<List<ReviewDto>> getByRecipe(@PathVariable String recipeId)
            throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(reviewService.getByRecipeId(recipeId));
    }

    @GetMapping("/user/{uid}")
    public ResponseEntity<List<ReviewDto>> getByUser(@PathVariable String uid)
            throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(reviewService.getByUid(uid));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody ReviewDto dto, HttpServletRequest req) {
        try {
            if (dto.getUid() != null) AuthContext.requireSelf(req, dto.getUid());
            // 유저 단위 분당 3개까지만 (DAILY_POINT_LIMIT=5와 상보적, 스팸/어뷰징 1차 방어선)
            if (dto.getUid() != null) rateLimiter.check("review:" + dto.getUid(), 3, 60_000);
            return ResponseEntity.ok(reviewService.create(dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAuth(req);
        try {
            reviewService.delete(id, AuthContext.uid(req), AuthContext.isAdmin(req));
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/reply")
    public ResponseEntity<?> addReply(
            @PathVariable String id,
            @RequestParam("uid") String uid,
            @RequestBody Map<String, String> body,
            HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            return ResponseEntity.ok(reviewService.addOrUpdateReply(id, uid, body.get("content")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/reply")
    public ResponseEntity<?> deleteReply(
            @PathVariable String id,
            @RequestParam("uid") String uid,
            HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            return ResponseEntity.ok(reviewService.deleteReply(id, uid));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/recalculate-counts")
    public ResponseEntity<?> recalculateCounts(HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            return ResponseEntity.ok(reviewService.recalculateAllReviewCounts());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable String id,
            @RequestParam("uid") String uid,
            @RequestBody ReviewDto updates,
            HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            return ResponseEntity.ok(reviewService.update(id, uid, updates));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
