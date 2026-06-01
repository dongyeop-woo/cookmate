package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.auth.RateLimiter;
import com.devl.api.dto.RefundRequestDto;
import com.devl.api.service.AuditLogService;
import com.devl.api.service.RefundRequestService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/refund-requests")
@RequiredArgsConstructor
public class RefundRequestController {

    private final RefundRequestService service;
    private final RateLimiter rateLimiter;
    private final AuditLogService auditLogService;

    /** 유저가 환불 요청 */
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body, HttpServletRequest req) {
        try {
            String uid = body.get("uid");
            String gifticonId = body.get("gifticonId");
            String reason = body.get("reason");
            if (uid == null || gifticonId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "uid, gifticonId는 필수입니다."));
            }
            AuthContext.requireSelf(req, uid);
            // 더블클릭 정도만 차단 (10초 내 5회)
            rateLimiter.check("refund-create:" + uid, 5, 10_000);
            RefundRequestDto dto = service.createRequest(uid, gifticonId, reason);
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 유저 본인의 환불 요청 목록 */
    @GetMapping("/user")
    public ResponseEntity<?> listByUser(@RequestParam String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            return ResponseEntity.ok(service.getByUid(uid));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자: 전체 조회 (status 필터 옵션) */
    @GetMapping
    public ResponseEntity<?> listAll(@RequestParam(required = false) String status, HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            return ResponseEntity.ok(service.getAll(status));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자: 쿠폰 현재 상태 조회 (승인 전 확인용) */
    @GetMapping("/{id}/coupon-status")
    public ResponseEntity<?> checkCouponStatus(@PathVariable String id, HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            return ResponseEntity.ok(service.checkCouponStatus(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자 승인 */
    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable String id, @RequestBody(required = false) Map<String, String> body, HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            String adminNote = body != null ? body.get("adminNote") : null;
            service.approve(id, adminNote);
            auditLogService.log(req, "refund", id, "approve", adminNote);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자 거절 */
    @PostMapping("/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable String id, @RequestBody(required = false) Map<String, String> body, HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            String adminNote = body != null ? body.get("adminNote") : null;
            service.reject(id, adminNote);
            auditLogService.log(req, "refund", id, "reject", adminNote);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자: 서버 장애로 "processing" 상태에 멈춘 환불 요청을 pending으로 복구 */
    @PostMapping("/admin/{id}/reset-processing")
    public ResponseEntity<?> resetStuckProcessing(@PathVariable String id, HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            service.resetStuckProcessing(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자: 과거 환불 2배 적립 버그 1회성 보정 (이미 보정된 건은 자동 스킵) */
    @PostMapping("/admin/correct-double-refunds")
    public ResponseEntity<?> correctDoubleRefunds(HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            return ResponseEntity.ok(service.correctDoubleRefunds());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
