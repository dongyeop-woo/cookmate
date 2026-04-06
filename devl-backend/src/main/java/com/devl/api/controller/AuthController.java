package com.devl.api.controller;

import com.google.firebase.auth.FirebaseAuth;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @PostMapping("/kakao")
    public ResponseEntity<Map<String, Object>> kakaoLogin(@RequestBody Map<String, String> body) {
        String accessToken = body.get("accessToken");
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "accessToken이 필요합니다."));
        }

        try {
            // Kakao API로 사용자 정보 조회
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
