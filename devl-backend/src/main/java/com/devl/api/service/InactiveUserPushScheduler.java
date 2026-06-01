package com.devl.api.service;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.WriteBatch;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 비활성 유저에게 재참여 유도 푸시를 전송하는 스케줄러.
 * 매일 오후 6시(KST, UTC+9 → UTC 09:00)에 실행.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InactiveUserPushScheduler {

    private final Firestore firestore;
    private final NotificationService notificationService;

    private static final String[] MESSAGES = {
            "오늘은 뭐 먹지? 🍳",
            "오늘의 추천 레시피를 확인해보세요!",
            "포인트로 기프티콘 받으셨나요? 🎁",
            "출석체크하고 포인트 받아가세요!",
            "새로운 요리에 도전해볼까요?",
    };

    /** 매일 오후 6시(KST) — UTC 09:00. 3일 이상 미접속 유저에게만 푸시. */
    @Scheduled(cron = "0 0 9 * * *", zone = "UTC")
    public void sendToInactiveUsers() {
        try {
            Instant threeDaysAgo = Instant.now().minus(Duration.ofDays(3));
            Instant oneDayAgo = Instant.now().minus(Duration.ofDays(1));
            String nowIso = Instant.now().toString();

            // 비용 최적화: 전체 users 스캔 대신 lastActiveAt < 3일전 조건으로 서버 필터링.
            // 활성 유저가 많을수록 절감 효과 큼 (활성 90% 가정 시 10%만 읽음).
            List<QueryDocumentSnapshot> docs = firestore.collection("users")
                    .whereLessThan("lastActiveAt", threeDaysAgo.toString())
                    .get().get().getDocuments();

            int sent = 0;
            WriteBatch batch = firestore.batch();
            int pending = 0;
            for (QueryDocumentSnapshot doc : docs) {
                String uid = doc.getId();
                String pushToken = doc.getString("pushToken");
                String lastInactive = doc.getString("lastInactivePushAt");
                if (pushToken == null || pushToken.isEmpty()) continue;

                // 하루 내 이미 비활성 푸시 보냈으면 스킵
                if (lastInactive != null) {
                    try {
                        Instant lastInactiveInst = Instant.parse(lastInactive);
                        if (lastInactiveInst.isAfter(oneDayAgo)) continue;
                    } catch (Exception ignored) {}
                }

                String msg = MESSAGES[(int)(Math.random() * MESSAGES.length)];
                notificationService.sendToUser(uid, "요잘알", msg, "system", null, null);
                // N+1 쓰기 대신 WriteBatch로 묶어서 commit (500건 한도)
                batch.update(doc.getReference(), "lastInactivePushAt", nowIso);
                pending++;
                sent++;
                if (pending >= 500) {
                    batch.commit().get();
                    batch = firestore.batch();
                    pending = 0;
                }
            }
            if (pending > 0) batch.commit().get();
            log.info("비활성 유저 푸시 완료: {}명 (후보 {}명)", sent, docs.size());
        } catch (Exception e) {
            log.warn("비활성 유저 푸시 실패: {}", e.getMessage());
        }
    }
}
