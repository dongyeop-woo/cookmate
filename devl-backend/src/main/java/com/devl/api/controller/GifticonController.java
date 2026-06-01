package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.auth.RateLimiter;
import com.devl.api.dto.GifticonDto;
import com.devl.api.service.GifticonService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/gifticons")
@RequiredArgsConstructor
public class GifticonController {

    private final GifticonService gifticonService;
    private final RateLimiter rateLimiter;

    @GetMapping
    public ResponseEntity<List<GifticonDto>> getAll()
            throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(gifticonService.getAll());
    }

    @PostMapping("/exchange")
    public ResponseEntity<?> exchange(@RequestBody Map<String, String> body, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        String uid = body.get("uid");
        String gifticonId = body.get("gifticonId");
        String phoneNo = body.get("phoneNo");
        if (uid == null || gifticonId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "uid와 gifticonId는 필수입니다."));
        }
        try {
            AuthContext.requireSelf(req, uid);
            rateLimiter.check("gifticon-exchange:" + uid, 5, 60_000);
            Map<String, Object> result = gifticonService.exchange(uid, gifticonId, phoneNo);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자 전용: 기프티쇼 비즈 API에서 상품 동기화 */
    @PostMapping("/sync")
    public ResponseEntity<?> syncGoods(HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            int count = gifticonService.syncGoodsFromGiftishow();
            return ResponseEntity.ok(Map.of("message", count + "개 상품 동기화 완료"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자 전용: 비즈머니 잔액 조회 */
    @GetMapping("/bizmoney")
    public ResponseEntity<?> getBizmoney(HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            long balance = gifticonService.getBizmoneyBalance();
            return ResponseEntity.ok(Map.of("balance", balance));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
