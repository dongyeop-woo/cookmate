package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.dto.CommunityRecipeDto;
import com.devl.api.auth.RateLimiter;
import com.devl.api.service.AuditLogService;
import com.devl.api.service.CommunityService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityService communityService;
    private final AuditLogService auditLogService;
    private final RateLimiter rateLimiter;

    @GetMapping
    public ResponseEntity<List<CommunityRecipeDto>> getAll(HttpServletRequest req) throws ExecutionException, InterruptedException {
        // 인증은 선택 — 비로그인(웹 포함)도 호출한다. uid 는 없으면 null 이다.
        String callerUid = AuthContext.uid(req);
        boolean admin = AuthContext.isAdmin(req);
        List<CommunityRecipeDto> visible = communityService.getAll().stream()
                .filter(r -> isVisibleTo(r, callerUid, admin))
                .toList();
        return ResponseEntity.ok(visible);
    }

    /** 나만보기(isPublic=false)는 작성자 본인과 관리자에게만. 필드가 없는 과거 문서는 전체공개. */
    private static boolean isVisibleTo(CommunityRecipeDto r, String callerUid, boolean admin) {
        if (!Boolean.FALSE.equals(r.getIsPublic())) return true;
        if (admin) return true;
        return callerUid != null && callerUid.equals(r.getAuthorUid());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CommunityRecipeDto> getById(@PathVariable String id, HttpServletRequest req) throws ExecutionException, InterruptedException {
        CommunityRecipeDto dto = communityService.getById(id);
        if (dto == null) return ResponseEntity.notFound().build();
        if (!isVisibleTo(dto, AuthContext.uid(req), AuthContext.isAdmin(req))) {
            // 존재 여부까지 감춘다 — 링크를 아는 사람에게도 노출되면 "나만보기"가 아니다
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    @PostMapping
    public ResponseEntity<CommunityRecipeDto> create(@RequestBody CommunityRecipeDto dto, HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAuth(req);
        // 관리자가 직접 등록한 레시피는 검토 없이 즉시 승인 + 레이트 리밋 면제
        if (AuthContext.isAdmin(req)) {
            dto.setStatus("approved");
            dto.setApprovedAt(java.time.Instant.now().toString());
        } else {
            // 작성자 사칭 방지 — authorUid는 인증된 caller로 강제
            String callerUid = AuthContext.uid(req);
            dto.setAuthorUid(callerUid);
            // 동일 유저 10분에 2건, 하루 10건 — 도배/AI 대량 투고 방지
            rateLimiter.check("community-create-min:" + callerUid, 2, 10L * 60 * 1000);
            rateLimiter.check("community-create-day:" + callerUid, 10, 24L * 60 * 60 * 1000);
        }
        return ResponseEntity.ok(communityService.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody CommunityRecipeDto dto, HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAuth(req);
        // 작성자 본인 또는 관리자만 수정 가능
        CommunityRecipeDto existing = communityService.getById(id);
        if (existing == null) return ResponseEntity.notFound().build();
        String callerUid = AuthContext.uid(req);
        if (!AuthContext.isAdmin(req) && !callerUid.equals(existing.getAuthorUid())) {
            return ResponseEntity.status(403).body(Map.of("error", "수정 권한 없음"));
        }
        return ResponseEntity.ok(communityService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAuth(req);
        // 작성자 본인 또는 관리자만 삭제 가능
        CommunityRecipeDto existing = communityService.getById(id);
        if (existing == null) return ResponseEntity.noContent().build();
        String callerUid = AuthContext.uid(req);
        if (!AuthContext.isAdmin(req) && !callerUid.equals(existing.getAuthorUid())) {
            return ResponseEntity.status(403).body(Map.of("error", "삭제 권한 없음"));
        }
        communityService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/visibility")
    public ResponseEntity<?> updateVisibility(
            @PathVariable String id,
            @RequestBody Map<String, Boolean> body,
            HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAuth(req);
        CommunityRecipeDto existing = communityService.getById(id);
        if (existing == null) return ResponseEntity.notFound().build();
        String callerUid = AuthContext.uid(req);
        if (!AuthContext.isAdmin(req) && !callerUid.equals(existing.getAuthorUid())) {
            return ResponseEntity.status(403).body(Map.of("error", "공개 범위 변경 권한 없음"));
        }
        Boolean isPublic = body.get("isPublic");
        if (isPublic == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "isPublic 은 필수입니다."));
        }
        communityService.updateVisibility(id, isPublic);
        return ResponseEntity.ok(Map.of("isPublic", isPublic));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            String status = body.get("status");
            String rejectionReason = body.get("rejectionReason");
            String adminUid = AuthContext.uid(req);
            String adminIp = AuthContext.clientIp(req);
            communityService.updateStatus(id, status, rejectionReason, adminUid, adminIp);
            auditLogService.log(req, "community", id, "update_status:" + status, rejectionReason);
            return ResponseEntity.ok().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/my/{uid}")
    public ResponseEntity<List<CommunityRecipeDto>> getMySubmissions(@PathVariable String uid, HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        List<CommunityRecipeDto> all = communityService.getAll();
        List<CommunityRecipeDto> mine = all.stream()
                .filter(r -> uid.equals(r.getAuthorUid()))
                .toList();
        return ResponseEntity.ok(mine);
    }

    @PostMapping("/{id}/rating")
    public ResponseEntity<CommunityRecipeDto> addRating(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAuth(req);
        // 평점 사칭 방지 — userId는 인증된 caller로 강제
        String userId = AuthContext.uid(req);
        double score = ((Number) body.get("score")).doubleValue();
        CommunityRecipeDto dto = communityService.addRating(id, userId, score);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<CommunityRecipeDto> like(@PathVariable String id, HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAuth(req);
        return ResponseEntity.ok(communityService.like(id));
    }

    @DeleteMapping("/{id}/like")
    public ResponseEntity<CommunityRecipeDto> unlike(@PathVariable String id, HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAuth(req);
        CommunityRecipeDto dto = communityService.unlike(id);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }
}
