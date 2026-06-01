package com.devl.api.service;

import com.devl.api.dto.UserDto;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final Firestore firestore;
    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
    private static final HttpClient httpClient = HttpClient.newHttpClient();

    /** 사용자당 최대 보관 알림 수 — 초과 시 가장 오래된 것 자동 삭제. */
    private static final int MAX_NOTIFICATIONS_PER_USER = 100;

    @Async
    public void sendToUser(String uid, String title, String body) {
        sendToUser(uid, title, body, null, null, null);
    }

    /**
     * 알림 전송 + Firestore 저장 (카테고리/라우트/이미지 포함)
     *
     * @param category 'comment' | 'review' | 'like' | 'follow' | 'point' | 'event' | 'gifticon' | 'refund' | 'system'
     * @param route 알림 탭 시 이동할 경로 (예: /recipe/xyz, /my-gifticons)
     * @param imageUrl 알림 썸네일 이미지 URL (레시피 이미지 등)
     */
    @Async
    public void sendToUser(String uid, String title, String body, String category, String route, String imageUrl) {
        try {
            Map<String, Object> notif = new HashMap<>();
            notif.put("uid", uid);
            notif.put("title", title);
            notif.put("body", body);
            notif.put("category", category != null ? category : "system");
            if (route != null) notif.put("route", route);
            if (imageUrl != null) notif.put("imageUrl", imageUrl);
            notif.put("read", false);
            notif.put("createdAt", java.time.Instant.now().toString());
            try {
                firestore.collection("notifications").add(notif).get();
                trimOldNotifications(uid);
            } catch (Exception e) {
                log.warn("알림 히스토리 저장 실패: uid={}, error={}", uid, e.getMessage());
            }

            UserDto user = firestore.collection("users").document(uid).get().get()
                    .toObject(UserDto.class);
            if (user == null || user.getPushToken() == null || user.getPushToken().isEmpty()) {
                log.info("푸시 토큰 없음: uid={}", uid);
                return;
            }
            sendPush(user.getPushToken(), title, body);
        } catch (Exception e) {
            log.warn("알림 전송 실패: uid={}, error={}", uid, e.getMessage());
        }
    }

    /** 사용자당 캡 — MAX 초과 시 가장 오래된 것부터 삭제. best-effort, 인메모리 정렬(composite index 회피). */
    private void trimOldNotifications(String uid) {
        try {
            List<QueryDocumentSnapshot> docs = new java.util.ArrayList<>(
                    firestore.collection("notifications")
                            .whereEqualTo("uid", uid)
                            .get().get().getDocuments()
            );
            if (docs.size() <= MAX_NOTIFICATIONS_PER_USER) return;
            // createdAt 내림차순 정렬 → 100개 이후부터 삭제
            docs.sort((a, b) -> {
                String A = a.getString("createdAt");
                String B = b.getString("createdAt");
                return String.valueOf(B).compareTo(String.valueOf(A));
            });
            for (int i = MAX_NOTIFICATIONS_PER_USER; i < docs.size(); i++) {
                docs.get(i).getReference().delete();
            }
            log.info("알림 캡 적용: uid={}, 삭제={}", uid, docs.size() - MAX_NOTIFICATIONS_PER_USER);
        } catch (Exception e) {
            log.warn("알림 캡 적용 실패: uid={}, error={}", uid, e.getMessage());
        }
    }

    @Async
    public void sendToAdmins(String title, String body) {
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection("users")
                    .whereEqualTo("role", "admin")
                    .get().get().getDocuments();

            for (QueryDocumentSnapshot doc : docs) {
                UserDto admin = doc.toObject(UserDto.class);
                if (admin.getPushToken() != null && !admin.getPushToken().isEmpty()) {
                    sendPush(admin.getPushToken(), title, body);
                }
            }
            log.info("관리자 {}명에게 알림 전송", docs.size());
        } catch (Exception e) {
            log.warn("관리자 알림 전송 실패: {}", e.getMessage());
        }
    }

    private void sendPush(String token, String title, String body) {
        try {
            String json = String.format(
                    "{\"to\":\"%s\",\"title\":\"%s\",\"body\":\"%s\",\"sound\":\"default\",\"priority\":\"high\",\"channelId\":\"default-v2\",\"_displayInForeground\":true}",
                    escapeJson(token), escapeJson(title), escapeJson(body)
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(EXPO_PUSH_URL))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            log.debug("Expo Push 응답: {}", response.body());
        } catch (Exception e) {
            log.warn("Expo Push 전송 실패: token={}, error={}", token, e.getMessage());
        }
    }

    private String escapeJson(String str) {
        return str.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
