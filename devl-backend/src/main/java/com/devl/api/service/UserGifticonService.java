package com.devl.api.service;

import com.devl.api.dto.UserGifticonDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.google.api.core.ApiFuture;
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
public class UserGifticonService {

    private final Firestore firestore;
    private final GiftishowApiService giftishowApiService;
    private static final String COLLECTION = "user_gifticons";

    public UserGifticonDto save(UserGifticonDto dto) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document();
        dto.setId(ref.getId());
        dto.setCreatedAt(Instant.now().toString());
        ref.set(dto).get();
        return dto;
    }

    public List<UserGifticonDto> getByUid(String uid) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("uid", uid).get();
        List<UserGifticonDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            list.add(doc.toObject(UserGifticonDto.class));
        }
        // 미사용 쿠폰들의 실제 사용 상태를 기프티쇼 API로 확인하여 자동 업데이트
        for (UserGifticonDto g : list) {
            if (g.isUsed()) continue;
            if (g.getTrId() == null || g.getTrId().isEmpty()) continue;
            try {
                JsonNode resp = giftishowApiService.getCouponDetail(g.getTrId());
                JsonNode result = resp.has("result") ? resp.get("result") : resp;
                JsonNode arr = result.isArray() ? result : (result.has("result") ? result.get("result") : null);
                if (arr != null && arr.isArray() && arr.size() > 0) {
                    JsonNode first = arr.get(0);
                    JsonNode infoList = first.has("couponInfoList") ? first.get("couponInfoList") : null;
                    if (infoList != null && infoList.isArray() && infoList.size() > 0) {
                        JsonNode info = infoList.get(0);
                        String pinStatusCd = info.has("pinStatusCd") ? info.get("pinStatusCd").asText() : null;
                        Map<String, Object> updates = new HashMap<>();
                        // 02 = 교환(사용완료)
                        if ("02".equals(pinStatusCd)) {
                            updates.put("used", true);
                            updates.put("usedAt", Instant.now().toString());
                            g.setUsed(true);
                            g.setUsedAt(Instant.now().toString());
                        }
                        // validPeriod 백필 — 발급 시 빈 값으로 저장된 건들을 API 응답으로 보강
                        if ((g.getValidPeriod() == null || g.getValidPeriod().isEmpty())
                                && info.has("validPrdEndDt")) {
                            String validEnd = info.get("validPrdEndDt").asText();
                            if (validEnd != null && !validEnd.isEmpty()) {
                                String formatted = formatValidPeriod(validEnd);
                                updates.put("validPeriod", formatted);
                                g.setValidPeriod(formatted);
                            }
                        }
                        if (!updates.isEmpty()) {
                            firestore.collection(COLLECTION).document(g.getId()).update(updates).get();
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("쿠폰 상태 조회 실패: trId={}, error={}", g.getTrId(), e.getMessage());
            }
        }
        list.sort((a, b) -> {
            String A = a.getCreatedAt() != null ? a.getCreatedAt() : "";
            String B = b.getCreatedAt() != null ? b.getCreatedAt() : "";
            return B.compareTo(A);
        });
        return list;
    }

    /** 기프티쇼 응답의 validPrdEndDt(yyyyMMdd 또는 yyyyMMddHHmmss)를 yyyy.MM.dd 표시용으로 변환 */
    private String formatValidPeriod(String raw) {
        if (raw == null) return "";
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.length() < 8) return raw;
        return digits.substring(0, 4) + "." + digits.substring(4, 6) + "." + digits.substring(6, 8);
    }

    /**
     * 관리자가 특정 유저에게 기프티콘을 직접 발급한다.
     * 포인트 차감 없이 user_gifticons 컬렉션에 직접 문서를 추가한다.
     * 이벤트 보상 등 운영팀이 수동으로 보내야 하는 케이스 전용.
     */
    public UserGifticonDto adminGrant(UserGifticonDto dto, String adminUid) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document();
        dto.setId(ref.getId());
        dto.setCreatedAt(Instant.now().toString());
        dto.setUsed(false);
        dto.setPointCost(0);
        dto.setGrantedBy(adminUid);
        ref.set(dto).get();
        return dto;
    }

    public void markUsed(String id, String uid) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) throw new IllegalArgumentException("기프티콘을 찾을 수 없습니다.");
        if (!uid.equals(snap.getString("uid"))) throw new IllegalArgumentException("권한이 없습니다.");
        Map<String, Object> updates = new HashMap<>();
        updates.put("used", true);
        updates.put("usedAt", Instant.now().toString());
        ref.update(updates).get();
    }

}
