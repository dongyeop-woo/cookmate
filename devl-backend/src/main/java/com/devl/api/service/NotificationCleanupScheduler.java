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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 알림 자동 청소 스케줄러 — 카테고리별 TTL 기준으로 오래된 알림 삭제.
 * 매일 새벽 3시(KST, UTC 18:00) 실행.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationCleanupScheduler {

    private final Firestore firestore;

    /** 카테고리별 보관 기간(일). 카테고리 없거나 매핑 안 되면 DEFAULT_TTL_DAYS 적용. */
    private static final Map<String, Integer> CATEGORY_TTL_DAYS = new LinkedHashMap<>() {{
        put("like", 14);
        put("follow", 14);
        put("comment", 30);
        put("review", 30);
        put("event", 30);
        put("system", 30);
        put("point", 60);
        put("gifticon", 60);
        put("refund", 90);
        put("recipe", 90); // 레시피 승인/반려 — 행정성, 길게 보관
        put("inquiry", 90);
    }};
    private static final int DEFAULT_TTL_DAYS = 30;

    /** 매일 새벽 3시(KST) — UTC 18:00. */
    @Scheduled(cron = "0 0 18 * * *", zone = "UTC")
    public void cleanupExpiredNotifications() {
        int totalDeleted = 0;
        try {
            for (Map.Entry<String, Integer> entry : CATEGORY_TTL_DAYS.entrySet()) {
                String category = entry.getKey();
                int days = entry.getValue();
                totalDeleted += deleteByCategoryOlderThan(category, days);
            }
            // 카테고리 미매핑 알림 — DEFAULT_TTL_DAYS 적용 (legacy 데이터 청소)
            totalDeleted += deleteUncategorizedOlderThan(DEFAULT_TTL_DAYS);

            log.info("알림 자동 청소 완료: {}개 삭제", totalDeleted);
        } catch (Exception e) {
            log.warn("알림 청소 실패: {}", e.getMessage());
        }
    }

    private int deleteByCategoryOlderThan(String category, int days) {
        try {
            String cutoff = Instant.now().minus(Duration.ofDays(days)).toString();
            // 단일 where + 인메모리 필터 (composite index 회피).
            List<QueryDocumentSnapshot> all = firestore.collection("notifications")
                    .whereEqualTo("category", category)
                    .get().get().getDocuments();
            java.util.List<QueryDocumentSnapshot> expired = new java.util.ArrayList<>();
            for (QueryDocumentSnapshot d : all) {
                String createdAt = d.getString("createdAt");
                if (createdAt != null && createdAt.compareTo(cutoff) < 0) {
                    expired.add(d);
                }
            }
            return batchDelete(expired);
        } catch (Exception e) {
            log.warn("카테고리 청소 실패 category={}: {}", category, e.getMessage());
            return 0;
        }
    }

    /** 'category' 필드가 없는 legacy 알림은 별도 쿼리 어렵 → 미사용(추후 마이그레이션). */
    private int deleteUncategorizedOlderThan(int days) {
        // Firestore는 'where field is null'을 직접 지원하지 않음. legacy 데이터는
        // 새 알림이 쌓이면서 per-user cap(100개)으로 자연스럽게 제거됨.
        return 0;
    }

    private int batchDelete(List<QueryDocumentSnapshot> docs) throws Exception {
        if (docs.isEmpty()) return 0;
        WriteBatch batch = firestore.batch();
        int pending = 0;
        int total = 0;
        for (QueryDocumentSnapshot d : docs) {
            batch.delete(d.getReference());
            pending++;
            total++;
            if (pending >= 500) {
                batch.commit().get();
                batch = firestore.batch();
                pending = 0;
            }
        }
        if (pending > 0) batch.commit().get();
        return total;
    }
}
