package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.auth.RateLimiter;
import com.devl.api.dto.UserDto;
import com.devl.api.service.AuditLogService;
import com.devl.api.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AuditLogService auditLogService;
    private final RateLimiter rateLimiter;

    @PostMapping
    public ResponseEntity<UserDto> createUser(@RequestBody UserDto dto)
            throws ExecutionException, InterruptedException {
        UserDto existing = userService.getByUid(dto.getUid());
        // 기존 유저가 있어도 soft-delete된 상태면 재가입 플로우로 진입 (create 호출 → rejoinedAt 마킹)
        if (existing != null && existing.getWithdrawnAt() == null) {
            return ResponseEntity.ok(existing);
        }
        return ResponseEntity.ok(userService.create(dto));
    }

    @GetMapping("/{uid}")
    public ResponseEntity<UserDto> getUser(@PathVariable String uid)
            throws ExecutionException, InterruptedException {
        UserDto user = userService.getByUid(uid);
        if (user == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(user);
    }

    @PutMapping("/{uid}")
    public ResponseEntity<UserDto> updateUser(@PathVariable String uid, @RequestBody UserDto dto, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        return ResponseEntity.ok(userService.update(uid, dto));
    }

    @PostMapping("/{uid}/follow/{targetUid}")
    public ResponseEntity<Void> follow(@PathVariable String uid, @PathVariable String targetUid, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        userService.follow(uid, targetUid);
        return ResponseEntity.ok().build();
    }

    /** 유저 차단 — 차단 대상의 게시물/댓글/리뷰가 본인 화면에 안 보이게 됨. 팔로우 관계도 해제. */
    @PostMapping("/{uid}/block/{targetUid}")
    public ResponseEntity<Void> blockUser(@PathVariable String uid, @PathVariable String targetUid, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        if (uid.equals(targetUid)) return ResponseEntity.badRequest().build();
        userService.blockUser(uid, targetUid);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{uid}/block/{targetUid}")
    public ResponseEntity<Void> unblockUser(@PathVariable String uid, @PathVariable String targetUid, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        userService.unblockUser(uid, targetUid);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{uid}/follow/{targetUid}")
    public ResponseEntity<Void> unfollow(@PathVariable String uid, @PathVariable String targetUid, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        userService.unfollow(uid, targetUid);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{uid}/like/{recipeId}")
    public ResponseEntity<Void> likeRecipe(@PathVariable String uid, @PathVariable String recipeId, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        userService.likeRecipe(uid, recipeId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{uid}/like/{recipeId}")
    public ResponseEntity<Void> unlikeRecipe(@PathVariable String uid, @PathVariable String recipeId, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        userService.unlikeRecipe(uid, recipeId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/nickname-check")
    public ResponseEntity<Map<String, Boolean>> checkNickname(@RequestParam String nickname)
            throws ExecutionException, InterruptedException {
        boolean taken = userService.isNicknameTaken(nickname);
        return ResponseEntity.ok(Map.of("available", !taken));
    }

    /** 관리자 전용 — 일반 사용자는 사용자 열거 공격에 악용 가능하므로 차단. */
    @GetMapping("/email/{email}")
    public ResponseEntity<UserDto> getByEmail(@PathVariable String email, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        UserDto user = userService.getByEmail(email);
        if (user == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(user);
    }

    /**
     * 계정 찾기 플로우 전용 — 비로그인 사용자가 자기 전화번호로 가입 이메일 확인.
     * IP 단위 레이트 리밋(시간당 10회)으로 enumeration 방어. 응답엔 마스킹용 email만 포함.
     */
    @GetMapping("/phone/{phone}")
    public ResponseEntity<?> getByPhone(@PathVariable String phone, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        rateLimiter.check("user-lookup-phone:" + AuthContext.clientIp(req), 10, 60L * 60 * 1000);
        UserDto user = userService.getByPhone(phone);
        if (user == null) return ResponseEntity.notFound().build();
        // 민감 필드 제거 — find-account 플로우는 email만 사용
        return ResponseEntity.ok(Map.of("email", user.getEmail() != null ? user.getEmail() : ""));
    }

    @GetMapping("/top")
    public ResponseEntity<List<UserDto>> getTopUsers(@RequestParam(defaultValue = "20") int limit)
            throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(userService.getTopUsers(limit));
    }

    @DeleteMapping("/{uid}")
    public ResponseEntity<Void> deleteUser(@PathVariable String uid,
                                           @RequestParam(defaultValue = "false") boolean purgeContent,
                                           HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        // 본인 또는 관리자
        if (AuthContext.uid(req) == null) throw new AuthContext.UnauthorizedException("인증이 필요합니다.");
        if (!uid.equals(AuthContext.uid(req)) && !AuthContext.isAdmin(req)) {
            throw new AuthContext.ForbiddenException("본인 또는 관리자만 삭제할 수 있습니다.");
        }
        boolean byAdmin = AuthContext.isAdmin(req) && !uid.equals(AuthContext.uid(req));
        // purgeContent=true면 익명화 대신 본인 작성 콘텐츠(레시피/리뷰/댓글)까지 완전 삭제
        userService.deleteUser(uid, purgeContent);
        if (byAdmin) auditLogService.log(req, "user", uid, purgeContent ? "admin_delete_with_content" : "admin_delete");
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{uid}/push-token")
    public ResponseEntity<Void> updatePushToken(@PathVariable String uid, @RequestBody Map<String, String> body, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        String pushToken = body.get("pushToken");
        userService.updatePushToken(uid, pushToken);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{uid}/active")
    public ResponseEntity<Void> updateActive(@PathVariable String uid, HttpServletRequest req) {
        AuthContext.requireSelf(req, uid);
        userService.updateLastActive(uid);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{uid}/role")
    public ResponseEntity<UserDto> updateRole(@PathVariable String uid, @RequestBody Map<String, String> body, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        String role = body.get("role");
        if (role == null || (!role.equals("admin") && !role.equals("user"))) {
            return ResponseEntity.badRequest().build();
        }
        UserDto result = userService.updateRole(uid, role);
        auditLogService.log(req, "user", uid, "update_role", "role=" + role);
        return ResponseEntity.ok(result);
    }

    /** 관리자 전용: 프리미엄 상태 지정 */
    @PutMapping("/{uid}/premium")
    public ResponseEntity<?> setPremium(@PathVariable String uid, @RequestBody Map<String, Boolean> body, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        Boolean premium = body.get("premium");
        if (premium == null) return ResponseEntity.badRequest().body(Map.of("error", "premium 필드 필요"));
        UserDto result = userService.setPremium(uid, premium);
        auditLogService.log(req, "user", uid, "set_premium", "premium=" + premium);
        return ResponseEntity.ok(result);
    }

    /**
     * 관리자: 이메일 기준 영구 차단. 해당 유저의 device/email/kakao/phone 모두 banned_identifiers에 등록.
     * 이후 같은 식별자로는 가입 자체가 거부된다 (소프트 탈퇴 후 재가입도 불가).
     * Body: { "email": "...", "reason": "..." }
     */
    @PostMapping("/ban-by-email")
    public ResponseEntity<?> banByEmail(@RequestBody Map<String, String> body, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        String email = body.get("email");
        String reason = body.getOrDefault("reason", "admin_ban");
        if (email == null || email.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "email 필드 필요"));
        Map<String, Object> result = userService.banByEmail(email, reason);
        auditLogService.log(req, "user", String.valueOf(result.get("uid")), "ban_by_email",
                "email=" + email + " reason=" + reason + " types=" + result.get("bannedTypes"));
        return ResponseEntity.ok(result);
    }

    /**
     * 관리자: 단일 식별자 차단. Body: { "type": "device|email|kakao|phone", "value": "...", "reason": "..." }
     */
    @PostMapping("/ban-identifier")
    public ResponseEntity<?> banIdentifier(@RequestBody Map<String, String> body, HttpServletRequest req) {
        AuthContext.requireAdmin(req);
        String type = body.get("type");
        String value = body.get("value");
        String reason = body.getOrDefault("reason", "admin_ban");
        if (type == null || value == null) return ResponseEntity.badRequest().body(Map.of("error", "type/value 필요"));
        userService.banIdentifier(type, value, reason);
        auditLogService.log(req, "banned_identifier", type + "__" + value, "ban", "reason=" + reason);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** 관리자: 식별자 차단 해제. */
    @DeleteMapping("/ban-identifier/{type}/{value}")
    public ResponseEntity<?> unbanIdentifier(@PathVariable String type, @PathVariable String value, HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        boolean removed = userService.unbanIdentifier(type, value);
        auditLogService.log(req, "banned_identifier", type + "__" + value, "unban", "removed=" + removed);
        return ResponseEntity.ok(Map.of("removed", removed));
    }

    /**
     * 본인 프리미엄 상태 동기화 — RevenueCat 구매/복원 후 클라이언트가 호출.
     * 본인 인증만 검사 (requireSelf) — 클라이언트 신뢰. 프로덕션 검증 강화는 RC 웹훅 또는
     * REST API 검증으로 추후 추가 권장.
     */
    @PostMapping("/{uid}/premium-self")
    public ResponseEntity<?> syncPremiumSelf(@PathVariable String uid, @RequestBody Map<String, Object> body,
                                             HttpServletRequest req)
            throws ExecutionException, InterruptedException {
        AuthContext.requireSelf(req, uid);
        Object isPremiumRaw = body.get("isPremium");
        if (!(isPremiumRaw instanceof Boolean)) {
            return ResponseEntity.badRequest().body(Map.of("error", "isPremium boolean 필드 필요"));
        }
        boolean isPremium = (Boolean) isPremiumRaw;
        String expiresAt = body.get("expiresAt") instanceof String ? (String) body.get("expiresAt") : null;
        UserDto result = userService.setPremiumWithExpiry(uid, isPremium, expiresAt);
        auditLogService.log(req, "user", uid, "premium_self_sync",
                "premium=" + isPremium + (expiresAt != null ? " expiresAt=" + expiresAt : ""));
        return ResponseEntity.ok(result);
    }

    /** 관리자 전용: orphan unique_keys 일괄 청소 (탈퇴 시 해제 누락 복구) */
    @PostMapping("/admin/cleanup-orphan-unique-keys")
    public ResponseEntity<?> cleanupOrphanUniqueKeys(HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            return ResponseEntity.ok(userService.cleanupOrphanUniqueKeys());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자 전용: 가입 환영 600P 2배 적립 보정 */
    @PostMapping("/admin/correct-double-signup-bonus")
    public ResponseEntity<?> correctDoubleSignupBonus(HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            return ResponseEntity.ok(userService.correctDoubleSignupBonus());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 관리자 전용 1회성 보정: 과거 2배 적립 버그를 수정.
     *  - 친구 초대 보상 500P (초대자 + 피초대자)
     *  - 첫 출석 보너스 200P
     *  - 첫 레시피 승인 보너스 500P
     * 각 유저에 보정 플래그를 기록하므로 재실행 시 중복 차감되지 않음.
     */
    @PostMapping("/admin/correct-double-bonuses")
    public ResponseEntity<?> correctDoubleBonuses(HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            return ResponseEntity.ok(userService.correctDoublePointBonuses());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
