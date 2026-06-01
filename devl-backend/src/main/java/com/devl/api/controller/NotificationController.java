package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final Firestore firestore;

    /** 유저의 저장된 알림 목록 조회 (최신순, 최대 100개). */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(@RequestParam("uid") String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            // Firestore composite index 없이 동작하도록 단일 where + 인메모리 정렬.
            // per-user cap 100이라 데이터량 작음.
            List<QueryDocumentSnapshot> docs = firestore.collection("notifications")
                    .whereEqualTo("uid", uid)
                    .get().get().getDocuments();
            List<Map<String, Object>> list = new ArrayList<>();
            for (QueryDocumentSnapshot d : docs) {
                Map<String, Object> m = new HashMap<>(d.getData());
                m.put("id", d.getId());
                list.add(m);
            }
            list.sort((a, b) -> {
                Object A = a.get("createdAt");
                Object B = b.get("createdAt");
                return String.valueOf(B).compareTo(String.valueOf(A));
            });
            if (list.size() > 100) list = list.subList(0, 100);
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /** 안 읽은 알림 카운트 — 홈 탭 배지용. 단일 where + 인메모리 카운트 (composite index 회피). */
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Integer>> unreadCount(@RequestParam("uid") String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            List<QueryDocumentSnapshot> docs = firestore.collection("notifications")
                    .whereEqualTo("uid", uid)
                    .get().get().getDocuments();
            int count = 0;
            for (QueryDocumentSnapshot d : docs) {
                Boolean read = d.getBoolean("read");
                if (!Boolean.TRUE.equals(read)) count++;
            }
            return ResponseEntity.ok(Map.of("count", count));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /** 알림 읽음 처리 — 본인 알림만 */
    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable String id, HttpServletRequest req) {
        try {
            var docRef = firestore.collection("notifications").document(id);
            var snap = docRef.get().get();
            if (!snap.exists()) return ResponseEntity.notFound().build();
            String owner = snap.getString("uid");
            AuthContext.requireSelf(req, owner);
            docRef.update("read", true).get();
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /** 유저의 모든 알림 읽음 처리 — 단일 where + 인메모리 필터 (composite index 회피). */
    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@RequestBody Map<String, String> body, HttpServletRequest req) {
        try {
            String uid = body.get("uid");
            if (uid == null) return ResponseEntity.badRequest().build();
            AuthContext.requireSelf(req, uid);
            List<QueryDocumentSnapshot> docs = firestore.collection("notifications")
                    .whereEqualTo("uid", uid)
                    .get().get().getDocuments();
            for (QueryDocumentSnapshot d : docs) {
                if (!Boolean.TRUE.equals(d.getBoolean("read"))) {
                    d.getReference().update("read", true).get();
                }
            }
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /** 알림 단건 삭제 — 본인 알림만 */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOne(@PathVariable String id, HttpServletRequest req) {
        try {
            var docRef = firestore.collection("notifications").document(id);
            var snap = docRef.get().get();
            if (!snap.exists()) return ResponseEntity.notFound().build();
            String owner = snap.getString("uid");
            AuthContext.requireSelf(req, owner);
            docRef.delete().get();
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /** 유저의 모든 알림 삭제 */
    @DeleteMapping
    public ResponseEntity<Void> deleteAll(@RequestParam("uid") String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            List<QueryDocumentSnapshot> docs = firestore.collection("notifications")
                    .whereEqualTo("uid", uid)
                    .get().get().getDocuments();
            for (QueryDocumentSnapshot d : docs) {
                d.getReference().delete().get();
            }
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
