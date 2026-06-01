package com.devl.api.service;

import com.devl.api.dto.RefundRequestDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefundRequestService {

    private final Firestore firestore;
    private final GiftishowApiService giftishowApiService;
    private final PointHistoryService pointHistoryService;
    private final NotificationService notificationService;
    private static final String COLLECTION = "refund_requests";
    private static final String GIFTICONS = "user_gifticons";
    private static final String USERS = "users";
    private static final int REFUND_WINDOW_DAYS = 3;

    /** 유저가 환불 요청 생성 */
    public RefundRequestDto createRequest(String uid, String gifticonId, String reason)
            throws ExecutionException, InterruptedException {
        if (reason == null || reason.trim().length() < 5) {
            throw new IllegalArgumentException("환불 사유를 5자 이상 입력해주세요.");
        }

        DocumentReference gRef = firestore.collection(GIFTICONS).document(gifticonId);
        DocumentSnapshot gSnap = gRef.get().get();
        if (!gSnap.exists()) throw new IllegalArgumentException("기프티콘을 찾을 수 없습니다.");
        if (!uid.equals(gSnap.getString("uid"))) throw new IllegalArgumentException("권한이 없습니다.");
        if (Boolean.TRUE.equals(gSnap.getBoolean("used"))) throw new IllegalArgumentException("사용한 기프티콘은 환불할 수 없습니다.");
        if (Boolean.TRUE.equals(gSnap.getBoolean("refunded"))) throw new IllegalArgumentException("이미 환불된 기프티콘입니다.");
        if (Boolean.TRUE.equals(gSnap.getBoolean("refundPending"))) throw new IllegalArgumentException("이미 환불 요청 중입니다.");

        // 교환 후 3일 이내만 환불 신청 가능
        String createdAtStr = gSnap.getString("createdAt");
        if (createdAtStr != null && !createdAtStr.isEmpty()) {
            try {
                Instant createdAt = Instant.parse(createdAtStr);
                long daysSince = java.time.Duration.between(createdAt, Instant.now()).toDays();
                if (daysSince >= REFUND_WINDOW_DAYS) {
                    throw new IllegalArgumentException("교환 후 " + REFUND_WINDOW_DAYS + "일이 지나 환불 신청이 불가합니다.");
                }
            } catch (java.time.format.DateTimeParseException e) {
                log.warn("기프티콘 createdAt 파싱 실패: gifticonId={}, value={}", gifticonId, createdAtStr);
            }
        }

        DocumentSnapshot userSnap = firestore.collection(USERS).document(uid).get().get();
        if (!userSnap.exists()) throw new IllegalArgumentException("유저를 찾을 수 없습니다.");
        String nickname = userSnap.getString("nickname");

        // 환불 요청 생성
        DocumentReference ref = firestore.collection(COLLECTION).document();
        Long pcLong = gSnap.getLong("pointCost");
        RefundRequestDto dto = RefundRequestDto.builder()
                .id(ref.getId())
                .uid(uid)
                .nickname(nickname)
                .gifticonId(gifticonId)
                .trId(gSnap.getString("trId"))
                .gifticonName(gSnap.getString("name"))
                .brand(gSnap.getString("brand"))
                .pointCost(pcLong != null ? pcLong.intValue() : 0)
                .reason(reason.trim())
                .status("pending")
                .createdAt(Instant.now().toString())
                .build();
        ref.set(dto).get();

        // 기프티콘에 환불 대기 플래그
        Map<String, Object> gUpdates = new HashMap<>();
        gUpdates.put("refundPending", true);
        gUpdates.put("refundRequestId", ref.getId());
        gRef.update(gUpdates).get();

        // 관리자 알림
        notificationService.sendToAdmins("환불 요청 접수", nickname + "님이 " + gSnap.getString("name") + " 환불을 요청했어요.");

        log.info("환불 요청 생성: uid={}, gifticonId={}, reason={}", uid, gifticonId, reason);
        return dto;
    }

    /** 유저 본인의 환불 요청 목록 */
    public List<RefundRequestDto> getByUid(String uid) throws ExecutionException, InterruptedException {
        var docs = firestore.collection(COLLECTION).whereEqualTo("uid", uid).get().get().getDocuments();
        List<RefundRequestDto> list = new ArrayList<>();
        for (var d : docs) list.add(d.toObject(RefundRequestDto.class));
        list.sort((a, b) -> (b.getCreatedAt() != null ? b.getCreatedAt() : "").compareTo(a.getCreatedAt() != null ? a.getCreatedAt() : ""));
        return list;
    }

    /** 관리자: 전체/상태별 조회 */
    public List<RefundRequestDto> getAll(String status) throws ExecutionException, InterruptedException {
        var query = (status == null || status.isEmpty())
                ? firestore.collection(COLLECTION)
                : firestore.collection(COLLECTION).whereEqualTo("status", status);
        var docs = query.get().get().getDocuments();
        List<RefundRequestDto> list = new ArrayList<>();
        for (var d : docs) list.add(d.toObject(RefundRequestDto.class));
        list.sort((a, b) -> (b.getCreatedAt() != null ? b.getCreatedAt() : "").compareTo(a.getCreatedAt() != null ? a.getCreatedAt() : ""));
        return list;
    }

    /**
     * 관리자 승인 - 기프티쇼 취소 + 포인트 환급.
     * 동시 승인 방지: 트랜잭션으로 status==pending→processing 원자적 전이.
     */
    public void approve(String requestId, String adminNote) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(requestId);

        // 트랜잭션으로 "pending" → "processing" 선점 — 중복 승인 차단
        Map<String, Object> claimed;
        try {
            claimed = firestore.runTransaction(tx -> {
                DocumentSnapshot s = tx.get(ref).get();
                if (!s.exists()) throw new IllegalArgumentException("환불 요청을 찾을 수 없습니다.");
                String status = s.getString("status");
                if (!"pending".equals(status)) {
                    throw new IllegalArgumentException("이미 처리된 요청입니다.");
                }
                tx.update(ref, "status", "processing");
                Map<String, Object> data = new HashMap<>();
                data.put("uid", s.getString("uid"));
                data.put("gifticonId", s.getString("gifticonId"));
                data.put("trId", s.getString("trId"));
                Long pc = s.getLong("pointCost");
                data.put("pointCost", pc != null ? pc.intValue() : 0);
                data.put("gifticonName", s.getString("gifticonName"));
                return data;
            }).get();
        } catch (ExecutionException e) {
            if (e.getCause() instanceof IllegalArgumentException) {
                throw (IllegalArgumentException) e.getCause();
            }
            throw e;
        }

        String uid = (String) claimed.get("uid");
        String gifticonId = (String) claimed.get("gifticonId");
        String trId = (String) claimed.get("trId");
        int pointCost = (Integer) claimed.get("pointCost");
        String gifticonName = (String) claimed.get("gifticonName");

        // 기프티쇼 쿠폰 상태 사전 조회 (취소 가능 여부 확인)
        if (trId == null || trId.isEmpty()) {
            throw new IllegalArgumentException("거래 ID가 없어 환불할 수 없습니다.");
        }
        try {
            JsonNode detail = giftishowApiService.getCouponDetail(trId);
            JsonNode outer = detail.has("result") ? detail.get("result") : detail;
            if (outer.isArray() && outer.size() > 0) outer = outer.get(0);
            JsonNode infoList = outer.has("couponInfoList") ? outer.get("couponInfoList") : null;
            if (infoList != null && infoList.isArray() && infoList.size() > 0) {
                String pinStatusCd = infoList.get(0).has("pinStatusCd") ? infoList.get(0).get("pinStatusCd").asText() : null;
                String pinStatusNm = infoList.get(0).has("pinStatusNm") ? infoList.get(0).get("pinStatusNm").asText() : "";
                // 01(발행)만 취소 가능, 그 외는 모두 취소 불가
                if (pinStatusCd != null && !"01".equals(pinStatusCd)) {
                    throw new IllegalArgumentException("취소 불가능한 쿠폰 상태입니다: " + pinStatusNm + " (코드: " + pinStatusCd + ")");
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.warn("쿠폰 상태 조회 실패 (진행 지속): trId={}, error={}", trId, e.getMessage());
        }

        // 기프티쇼 쿠폰 취소 API 호출
        try {
            JsonNode resp = giftishowApiService.cancelCoupon(trId);
            String code = resp.has("code") ? resp.get("code").asText() : "ERROR";
            if (!"0000".equals(code)) {
                String msg = resp.has("message") ? resp.get("message").asText() : "취소 실패";
                log.warn("기프티쇼 취소 실패: trId={}, msg={}", trId, msg);
                notificationService.sendToAdmins("⚠️ 기프티쇼 취소 실패",
                        String.format("유저 포인트는 환급되나 기프티쇼 취소 실패 (손실 발생): %s / %s", gifticonName, msg));
            }
        } catch (Exception e) {
            log.warn("기프티쇼 취소 오류: {}", e.getMessage());
            notificationService.sendToAdmins("⚠️ 기프티쇼 취소 오류",
                    String.format("유저 포인트는 환급되나 기프티쇼 API 오류 (손실 발생): %s / %s", gifticonName, e.getMessage()));
        }

        // 포인트 환급 (addPoints 내부에서 users.points 증가)
        DocumentReference userRef = firestore.collection(USERS).document(uid);
        if (pointCost > 0) {
            pointHistoryService.addPoints(uid, pointCost, gifticonName + " 환불 환급", null);
        }

        // 기프티콘 상태 + 환불 요청 상태를 WriteBatch로 원자 업데이트
        Map<String, Object> gUpdates = new HashMap<>();
        gUpdates.put("refunded", true);
        gUpdates.put("refundedAt", Instant.now().toString());
        gUpdates.put("refundPending", false);

        Map<String, Object> rUpdates = new HashMap<>();
        rUpdates.put("status", "approved");
        rUpdates.put("processedAt", Instant.now().toString());
        if (adminNote != null) rUpdates.put("adminNote", adminNote);

        com.google.cloud.firestore.WriteBatch batch = firestore.batch();
        batch.update(firestore.collection(GIFTICONS).document(gifticonId), gUpdates);
        batch.update(ref, rUpdates);
        batch.commit().get();

        notificationService.sendToUser(uid, "환불 승인 완료",
                String.format("%s 환불이 승인되어 %dP가 환급되었어요.", gifticonName, pointCost),
                "refund", "/my-points", null);
        log.info("환불 승인: requestId={}, uid={}, point={}", requestId, uid, pointCost);
    }

    /** 관리자: 쿠폰 현재 상태 미리 조회 */
    public Map<String, Object> checkCouponStatus(String requestId) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(requestId);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) throw new IllegalArgumentException("환불 요청을 찾을 수 없습니다.");
        String trId = snap.getString("trId");
        if (trId == null || trId.isEmpty()) throw new IllegalArgumentException("거래 ID 없음");

        Map<String, Object> result = new HashMap<>();
        try {
            JsonNode detail = giftishowApiService.getCouponDetail(trId);
            JsonNode outer = detail.has("result") ? detail.get("result") : detail;
            if (outer.isArray() && outer.size() > 0) outer = outer.get(0);
            JsonNode infoList = outer.has("couponInfoList") ? outer.get("couponInfoList") : null;
            if (infoList != null && infoList.isArray() && infoList.size() > 0) {
                JsonNode info = infoList.get(0);
                String pinStatusCd = info.has("pinStatusCd") ? info.get("pinStatusCd").asText() : null;
                String pinStatusNm = info.has("pinStatusNm") ? info.get("pinStatusNm").asText() : "";
                boolean cancelable = "01".equals(pinStatusCd);
                result.put("pinStatusCd", pinStatusCd);
                result.put("pinStatusNm", pinStatusNm);
                result.put("cancelable", cancelable);
                if (info.has("validPrdEndDt")) result.put("validPrdEndDt", info.get("validPrdEndDt").asText());
            } else {
                result.put("error", "쿠폰 정보 조회 실패");
            }
        } catch (Exception e) {
            result.put("error", e.getMessage());
        }
        return result;
    }

    /**
     * 관리자 전용: approve() 중간에 서버가 죽어 status=="processing"에 멈춘 요청을 "pending"으로 되돌린다.
     * 이미 포인트가 환급됐을 가능성이 있으니 관리자가 상황 확인 후 수동 실행해야 함.
     */
    public void resetStuckProcessing(String requestId) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(requestId);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) throw new IllegalArgumentException("환불 요청을 찾을 수 없습니다.");
        if (!"processing".equals(snap.getString("status"))) {
            throw new IllegalArgumentException("processing 상태가 아닙니다: " + snap.getString("status"));
        }
        Map<String, Object> updates = new HashMap<>();
        updates.put("status", "pending");
        updates.put("adminNote", "processing 멈춘 상태에서 pending으로 복구됨");
        ref.update(updates).get();
        log.warn("환불 처리 멈춤 복구: requestId={}", requestId);
    }

    /** 관리자 거절 */
    public void reject(String requestId, String adminNote) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(requestId);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) throw new IllegalArgumentException("환불 요청을 찾을 수 없습니다.");
        if (!"pending".equals(snap.getString("status"))) throw new IllegalArgumentException("이미 처리된 요청입니다.");

        String uid = snap.getString("uid");
        String gifticonId = snap.getString("gifticonId");
        String gifticonName = snap.getString("gifticonName");

        // 기프티콘 환불 대기 해제 (다시 사용 가능)
        Map<String, Object> gUpdates = new HashMap<>();
        gUpdates.put("refundPending", false);
        gUpdates.put("refundRequestId", null);
        firestore.collection(GIFTICONS).document(gifticonId).update(gUpdates).get();

        // 환불 요청 상태
        Map<String, Object> rUpdates = new HashMap<>();
        rUpdates.put("status", "rejected");
        rUpdates.put("processedAt", Instant.now().toString());
        if (adminNote != null) rUpdates.put("adminNote", adminNote);
        ref.update(rUpdates).get();

        notificationService.sendToUser(uid, "환불 요청이 반려되었어요",
                gifticonName + " 환불 요청이 반려되었습니다." + (adminNote != null ? " 사유: " + adminNote : ""),
                "refund", "/my-gifticons", null);
        log.info("환불 거절: requestId={}, uid={}", requestId, uid);
    }

    /**
     * 일회성 보정: 과거 approve() 버그로 포인트가 2배 적립된 건을 보정.
     * - status == "approved" 이면서 pointsCorrected 플래그가 없는 항목만 처리
     * - user.points에서 pointCost만큼 차감하고 refund_requests 문서에 pointsCorrected=true 기록
     * - 재실행해도 pointsCorrected 플래그 덕분에 중복 차감되지 않음
     */
    public Map<String, Object> correctDoubleRefunds() throws ExecutionException, InterruptedException {
        List<QueryDocumentSnapshot> docs = firestore.collection(COLLECTION)
                .whereEqualTo("status", "approved")
                .get().get().getDocuments();

        int corrected = 0;
        int skipped = 0;
        long totalDeducted = 0;
        List<Map<String, Object>> details = new ArrayList<>();

        for (QueryDocumentSnapshot doc : docs) {
            if (Boolean.TRUE.equals(doc.getBoolean("pointsCorrected"))) {
                skipped++;
                continue;
            }
            String uid = doc.getString("uid");
            Long pointCostLong = doc.getLong("pointCost");
            if (uid == null || pointCostLong == null || pointCostLong <= 0) {
                skipped++;
                continue;
            }
            int pointCost = pointCostLong.intValue();

            DocumentReference userRef = firestore.collection(USERS).document(uid);
            userRef.update("points", FieldValue.increment(-pointCost)).get();

            Map<String, Object> rUpdates = new HashMap<>();
            rUpdates.put("pointsCorrected", true);
            rUpdates.put("correctedAt", Instant.now().toString());
            doc.getReference().update(rUpdates).get();

            corrected++;
            totalDeducted += pointCost;
            Map<String, Object> d = new HashMap<>();
            d.put("requestId", doc.getId());
            d.put("uid", uid);
            d.put("deducted", pointCost);
            details.add(d);
            log.info("환불 중복 적립 보정: requestId={}, uid={}, deducted={}", doc.getId(), uid, pointCost);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("corrected", corrected);
        result.put("skipped", skipped);
        result.put("totalDeducted", totalDeducted);
        result.put("details", details);
        return result;
    }
}
