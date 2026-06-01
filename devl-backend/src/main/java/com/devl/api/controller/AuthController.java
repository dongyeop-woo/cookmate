package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.auth.RateLimiter;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.firebase.auth.FirebaseAuth;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private final com.devl.api.service.PointHistoryService pointHistoryService;
    private final com.devl.api.service.NotificationService notificationService;
    private final com.google.cloud.firestore.Firestore firestore;
    private final RateLimiter rateLimiter;
    private final com.devl.api.service.UserService userService;

    public AuthController(com.devl.api.service.PointHistoryService pointHistoryService, com.devl.api.service.NotificationService notificationService, com.google.cloud.firestore.Firestore firestore, RateLimiter rateLimiter, com.devl.api.service.UserService userService) {
        this.pointHistoryService = pointHistoryService;
        this.notificationService = notificationService;
        this.firestore = firestore;
        this.rateLimiter = rateLimiter;
        this.userService = userService;
    }

    /** 카카오 채널 보상 지급 여부 확인 */
    @GetMapping("/kakao-channel-status")
    public ResponseEntity<Map<String, Object>> kakaoChannelStatus(@RequestParam String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            var userDoc = firestore.collection("users").document(uid).get().get();
            Boolean rewarded = userDoc.getBoolean("kakaoChannelRewarded");
            return ResponseEntity.ok(Map.of("rewarded", Boolean.TRUE.equals(rewarded)));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("rewarded", false));
        }
    }

    /**
     * 카카오 채널 친구 추가 보상 (1인 1회 — 카카오 ID 기준 중복 방지).
     * Firestore 트랜잭션으로 "이미 받았는지 체크 → 플래그 세팅" 경쟁 조건을 차단.
     */
    @PostMapping("/kakao-channel-reward")
    public ResponseEntity<Map<String, Object>> kakaoChannelReward(@RequestBody Map<String, String> body, HttpServletRequest req) {
        String uid = body.get("uid");
        String kakaoId = body.get("kakaoId");
        if (uid == null || uid.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "uid가 필요합니다."));
        }
        // kakaoId는 카카오 계정 단위 중복 방지의 핵심 — 누락 시 절대 포인트 지급 금지
        if (kakaoId == null || kakaoId.isBlank()) {
            log.warn("카카오 채널 보상 거부: kakaoId 누락. uid={}", uid);
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "카카오 계정 정보를 가져오지 못했습니다. 다시 시도해주세요."));
        }
        try {
            AuthContext.requireSelf(req, uid);
        } catch (AuthContext.UnauthorizedException | AuthContext.ForbiddenException e) {
            return ResponseEntity.status(e instanceof AuthContext.ForbiddenException ? 403 : 401)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
        // uid + client IP 기준 분당 3회 — 봇/스크립트 차단
        try {
            rateLimiter.check("kakao-reward:" + uid, 3, 60_000);
            rateLimiter.check("kakao-reward-ip:" + AuthContext.clientIp(req), 20, 60_000);
        } catch (RateLimiter.TooManyRequestsException e) {
            return ResponseEntity.status(429).body(Map.of("success", false, "message", e.getMessage()));
        }
        try {
            DocumentReference userRef = firestore.collection("users").document(uid);

            // 다른 계정이 동일 kakaoId로 이미 받았는지 트랜잭션 밖에서 미리 체크 (트랜잭션 내 쿼리는 제약이 있음)
            List<com.google.cloud.firestore.QueryDocumentSnapshot> existing = firestore.collection("users")
                    .whereEqualTo("kakaoChannelRewardedKakaoId", kakaoId)
                    .get().get().getDocuments();
            boolean claimedByOther = existing.stream().anyMatch(d -> !d.getId().equals(uid));
            if (claimedByOther) {
                return ResponseEntity.ok(Map.of("success", false, "message", "이 카카오 계정으로 이미 포인트를 받으셨습니다."));
            }

            // uid 단위 1회성은 트랜잭션으로 원자적 처리 (kakaoId도 함께 저장 — 이후 다른 계정의 같은 카카오 재참여 차단에 필요)
            final String kakaoIdFinal = kakaoId;
            Boolean alreadyRewarded = firestore.runTransaction(tx -> {
                DocumentSnapshot snap = tx.get(userRef).get();
                if (!snap.exists()) throw new IllegalStateException("유저를 찾을 수 없습니다.");
                Boolean already = snap.getBoolean("kakaoChannelRewarded");
                if (Boolean.TRUE.equals(already)) return Boolean.TRUE;
                java.util.Map<String, Object> updates = new java.util.HashMap<>();
                updates.put("kakaoChannelRewarded", true);
                updates.put("kakaoChannelRewardedKakaoId", kakaoIdFinal);
                tx.update(userRef, updates);
                return Boolean.FALSE;
            }).get();

            if (Boolean.TRUE.equals(alreadyRewarded)) {
                return ResponseEntity.ok(Map.of("success", false, "message", "이미 포인트를 받으셨습니다."));
            }

            // 플래그를 원자적으로 선점했을 때만 포인트 적립
            pointHistoryService.addPoints(uid, 500, "카카오 채널 친구 추가 보상", null);
            notificationService.sendToUser(uid, "이벤트 포인트 지급 완료! 🎉",
                    "카카오 채널 친구 추가 보상으로 500P가 지급되었습니다.",
                    "event", "/my-points", null);
            return ResponseEntity.ok(Map.of("success", true, "message", "500P가 지급되었습니다!"));
        } catch (Exception e) {
            log.error("카카오 채널 보상 실패: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", "포인트 지급에 실패했습니다."));
        }
    }

    @PostMapping("/kakao")
    public ResponseEntity<Map<String, Object>> kakaoLogin(@RequestBody Map<String, String> body) {
        String accessToken = body.get("accessToken");
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "accessToken이 필요합니다."));
        }

        try {
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://kapi.kakao.com/v2/user/me",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );

            Map<String, Object> kakaoUser = response.getBody();
            if (kakaoUser == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "카카오 사용자 정보를 가져올 수 없습니다."));
            }

            String kakaoId = String.valueOf(kakaoUser.get("id"));
            String uid = "kakao:" + kakaoId;

            // 카카오 계정 정보 추출
            @SuppressWarnings("unchecked")
            Map<String, Object> kakaoAccount = (Map<String, Object>) kakaoUser.get("kakao_account");
            String email = "";
            String nickname = "";

            if (kakaoAccount != null) {
                email = kakaoAccount.get("email") != null ? String.valueOf(kakaoAccount.get("email")) : "";

                @SuppressWarnings("unchecked")
                Map<String, Object> profile = (Map<String, Object>) kakaoAccount.get("profile");
                if (profile != null) {
                    nickname = profile.get("nickname") != null ? String.valueOf(profile.get("nickname")) : "";
                }
            }

            // Firebase Custom Token 생성
            String customToken = FirebaseAuth.getInstance().createCustomToken(uid);

            // 초기 카카오 로그인 구현이 firebaseUser.email(빈 값)만 저장해서
            // 기존 가입자들의 email 필드가 비어있는 케이스가 있다.
            // 이번 로그인에서 카카오로부터 받은 email로 자동 보강 (best-effort).
            if (!email.isEmpty()) {
                userService.backfillKakaoEmailIfMissing(uid, email);
            }

            log.info("Kakao login success: kakaoId={}, uid={}", kakaoId, uid);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "firebaseToken", customToken,
                    "kakaoId", kakaoId,
                    "email", email,
                    "nickname", nickname
            ));
        } catch (Exception e) {
            log.error("Kakao login failed: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "카카오 로그인 처리 중 오류가 발생했습니다."
            ));
        }
    }
}
