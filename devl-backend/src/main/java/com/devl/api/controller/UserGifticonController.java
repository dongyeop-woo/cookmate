package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.dto.UserGifticonDto;
import com.devl.api.service.UserGifticonService;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user-gifticons")
@RequiredArgsConstructor
public class UserGifticonController {

    private final UserGifticonService userGifticonService;
    private final Firestore firestore;

    @GetMapping
    public ResponseEntity<?> list(@RequestParam("uid") String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            return ResponseEntity.ok(userGifticonService.getByUid(uid));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/used")
    public ResponseEntity<?> markUsed(@PathVariable String id, @RequestParam("uid") String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            userGifticonService.markUsed(id, uid);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 관리자 전용: 특정 유저에게 기프티콘을 직접 발급한다.
     * 포인트 차감 없이 발급되므로 이벤트 보상·운영 보상 용도.
     * 운영자가 기프티쇼 비즈 등에서 사전에 발급한 PIN/이미지 정보를 그대로 저장한다.
     */
    @PostMapping("/admin/grant")
    public ResponseEntity<?> adminGrant(@RequestBody UserGifticonDto body, HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            String adminUid = AuthContext.uid(req);
            if (body.getUid() == null || body.getUid().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "대상 uid가 필요합니다."));
            }
            if (body.getName() == null || body.getName().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "기프티콘 이름이 필요합니다."));
            }
            if (body.getPinNo() == null || body.getPinNo().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "교환 번호(PIN)가 필요합니다."));
            }
            UserGifticonDto saved = userGifticonService.adminGrant(body, adminUid);
            return ResponseEntity.ok(saved);
        } catch (AuthContext.UnauthorizedException | AuthContext.ForbiddenException e) {
            throw e;
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 관리자 전용: 특정 유저의 기프티콘 지갑 전체 삭제 (이미 환불 완료된 건 등 수동 정리용).
     * refund_requests는 별도로 건드리지 않음 — 본 컨트롤러는 user_gifticons만 정리.
     */
    @DeleteMapping("/admin/clear")
    public ResponseEntity<?> adminClearByUid(@RequestParam("uid") String targetUid, HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            List<QueryDocumentSnapshot> docs = firestore.collection("user_gifticons")
                    .whereEqualTo("uid", targetUid)
                    .get().get().getDocuments();
            int count = 0;
            for (QueryDocumentSnapshot d : docs) {
                d.getReference().delete();
                count++;
            }
            return ResponseEntity.ok(Map.of("deleted", count, "uid", targetUid));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
