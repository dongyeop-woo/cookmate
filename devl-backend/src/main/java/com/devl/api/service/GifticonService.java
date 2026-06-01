package com.devl.api.service;

import com.devl.api.dto.GifticonDto;
import com.devl.api.dto.PointHistoryDto;
import com.devl.api.dto.UserDto;
import com.devl.api.dto.UserGifticonDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class GifticonService {

    private final Firestore firestore;
    private final UserService userService;
    private final PointHistoryService pointHistoryService;
    private final NotificationService notificationService;
    private final GiftishowApiService giftishowApiService;
    private final UserGifticonService userGifticonService;
    private final AlimtalkService alimtalkService;

    private static final String COLLECTION = "gifticons";

    // 요리/식품 + 기타 관련 브랜드 화이트리스트
    private static final java.util.Set<String> ALLOWED_BRANDS = java.util.Set.of(
            "네이버페이", "네이버페이 포인트", "카카오페이",
            "신세계상품권", "신세계",
            "배달의민족", "배민", "요기요",
            "올리브영",
            "CU", "GS25", "세븐일레븐", "바이더웨이", "이마트24", "미니스톱",
            "이마트", "홈플러스", "롯데마트",
            "스타벅스", "투썸플레이스", "이디야", "메가커피", "컴포즈커피", "할리스",
            "BHC", "BBQ", "교촌치킨", "굽네치킨", "푸라닭",
            "도미노피자", "피자헛", "미스터피자", "피자마루",
            "맥도날드", "버거킹", "롯데리아", "맘스터치", "KFC",
            "던킨", "파리바게뜨", "뚜레쥬르",
            "배스킨라빈스", "설빙",
            "쿠팡이츠",
            // 기타
            "교보문고", "YES24", "예스24",
            "문화상품권", "컬쳐랜드",
            "도서문화상품권", "도서상품권",
            "CGV", "메가박스", "롯데시네마",
            "다이소",
            "SKT", "KT", "LG U+", "통신"
    );

    public List<GifticonDto> getAll() throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("active", true)
                .get();

        List<GifticonDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            list.add(doc.toObject(GifticonDto.class));
        }
        return list;
    }

    public GifticonDto getById(String id) throws ExecutionException, InterruptedException {
        DocumentSnapshot doc = firestore.collection(COLLECTION).document(id).get().get();
        if (!doc.exists()) return null;
        return doc.toObject(GifticonDto.class);
    }

    /**
     * 기프티콘 교환 (기프티쇼 비즈 API 연동)
     */
    public Map<String, Object> exchange(String uid, String gifticonId, String inputPhone) throws ExecutionException, InterruptedException {
        // 1. 사용자 확인
        UserDto user = userService.getByUid(uid);
        if (user == null) {
            throw new RuntimeException("사용자를 찾을 수 없습니다.");
        }

        // 2. 기프티콘 확인
        GifticonDto gifticon = getById(gifticonId);
        if (gifticon == null) {
            throw new RuntimeException("기프티콘을 찾을 수 없습니다.");
        }
        if (!gifticon.isActive()) {
            throw new RuntimeException("현재 교환할 수 없는 기프티콘입니다.");
        }

        // 4. 수신 phoneNo — 요청에서 입력받은 번호 우선 사용
        String phoneNo = inputPhone != null && !inputPhone.isEmpty() ? inputPhone : user.getPhone();
        if (phoneNo == null || phoneNo.isEmpty()) {
            throw new RuntimeException("기프티콘 수신 전화번호가 필요합니다.");
        }
        phoneNo = phoneNo.replaceAll("-", "").replaceAll("\\s+", "");
        if (!phoneNo.matches("01\\d{8,9}")) {
            throw new RuntimeException("올바른 휴대폰 번호를 입력해주세요.");
        }

        // 3/5. 포인트 "선결제" — 트랜잭션으로 원자적 차감.
        // 병렬 교환 시 한쪽만 통과시켜 "외부 쿠폰 발급 후 잔액 부족" 상태가 생기지 않도록 함.
        final int pointCost = gifticon.getPointCost();
        DocumentReference userRef = firestore.collection("users").document(uid);
        try {
            firestore.runTransaction(tx -> {
                DocumentSnapshot snap = tx.get(userRef).get();
                if (!snap.exists()) throw new IllegalStateException("사용자를 찾을 수 없습니다.");
                Long pts = snap.getLong("points");
                long current = pts != null ? pts : 0L;
                if (current < pointCost) throw new IllegalStateException("포인트가 부족합니다.");
                tx.update(userRef, "points", current - pointCost);
                return null;
            }).get();
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof IllegalStateException) throw new RuntimeException(cause.getMessage());
            throw e;
        }

        // TR_ID 생성 (25자 이하, 고유값)
        String trId = "YJA_" + System.currentTimeMillis();

        // 6. 기프티쇼 API로 쿠폰 발급 (gubun=I, SMS 미발송, 이미지+PIN 수신)
        // 포인트는 이미 트랜잭션으로 선차감됨 — 쿠폰 발급 실패 시 보상 차감(환급) 필요
        String goodsCode = gifticon.getGoodsCode();
        String couponImageUrl = null;
        String pinNo = null;
        String validPeriod = null;
        if (goodsCode != null && !goodsCode.isEmpty()) {
            try {
                JsonNode sendResult = giftishowApiService.sendCoupon(goodsCode, phoneNo, trId);
                String code = sendResult.has("code") ? sendResult.get("code").asText() : "ERROR";

                if (!"0000".equals(code)) {
                    String msg = sendResult.has("message") ? sendResult.get("message").asText() : "알 수 없는 오류";
                    log.error("기프티쇼 쿠폰 발행 실패: code={}, message={}", code, msg);
                    refundExchangeFailure(uid, pointCost, gifticon.getName(), "발급 실패: " + msg);
                    throw new RuntimeException("기프티콘 발급에 실패했습니다: " + msg);
                }

                // 응답 구조: { code, result: { code, result: { orderNo, pinNo, couponImgUrl } } }
                JsonNode outer = sendResult.has("result") ? sendResult.get("result") : sendResult;
                JsonNode result = outer.has("result") ? outer.get("result") : outer;
                log.info("기프티쇼 쿠폰 응답 전체: {}", result.toString());
                couponImageUrl = result.has("couponImgUrl") ? result.get("couponImgUrl").asText() : null;
                pinNo = result.has("pinNo") ? result.get("pinNo").asText() : null;
                validPeriod = result.has("endDate") ? result.get("endDate").asText() : null;

                // sendCoupon 응답엔 유효기간이 없으므로 상세 조회로 보강
                if (validPeriod == null || validPeriod.isEmpty()) {
                    try {
                        JsonNode detail = giftishowApiService.getCouponDetail(trId);
                        JsonNode dResult = detail.has("result") ? detail.get("result") : detail;
                        JsonNode arr = dResult.isArray() ? dResult : (dResult.has("result") ? dResult.get("result") : null);
                        if (arr != null && arr.isArray() && arr.size() > 0) {
                            JsonNode infoList = arr.get(0).has("couponInfoList") ? arr.get(0).get("couponInfoList") : null;
                            if (infoList != null && infoList.isArray() && infoList.size() > 0) {
                                JsonNode info = infoList.get(0);
                                if (info.has("validPrdEndDt")) {
                                    String raw = info.get("validPrdEndDt").asText();
                                    String digits = raw != null ? raw.replaceAll("[^0-9]", "") : "";
                                    if (digits.length() >= 8) {
                                        validPeriod = digits.substring(0, 4) + "." + digits.substring(4, 6) + "." + digits.substring(6, 8);
                                    }
                                }
                            }
                        }
                    } catch (Exception e) {
                        log.warn("유효기간 상세 조회 실패 (무시): trId={}, error={}", trId, e.getMessage());
                    }
                }

                log.info("기프티쇼 쿠폰 발행 성공: trId={}, goodsCode={}, pinReceived={}, imgReceived={}", trId, goodsCode, pinNo != null, couponImageUrl != null);
                // MMS 자동 발송은 비용(30~50원/건)이 비싸서 하지 않음.
                // 알림은 카카오 알림톡(Solapi) + 앱 푸시로 대체.
            } catch (RuntimeException re) {
                throw re;
            } catch (Exception apiEx) {
                log.error("기프티쇼 API 예외: {}", apiEx.getMessage());
                refundExchangeFailure(uid, pointCost, gifticon.getName(), "API 오류: " + apiEx.getMessage());
                throw new RuntimeException("기프티콘 발급 중 오류가 발생했습니다.");
            }
        }

        // 8. 포인트 히스토리 기록
        PointHistoryDto history = PointHistoryDto.builder()
                .uid(uid)
                .type("spend")
                .amount(gifticon.getPointCost())
                .title(gifticon.getName())
                .description(gifticon.getBrand() + " 기프티콘 교환")
                .gifticonId(gifticonId)
                .build();
        pointHistoryService.create(history);

        // 9. 교환 이력 저장
        Map<String, Object> exchangeRecord = new HashMap<>();
        exchangeRecord.put("uid", uid);
        exchangeRecord.put("gifticonId", gifticonId);
        exchangeRecord.put("gifticonName", gifticon.getName());
        exchangeRecord.put("brand", gifticon.getBrand());
        exchangeRecord.put("pointCost", gifticon.getPointCost());
        exchangeRecord.put("trId", trId);
        exchangeRecord.put("goodsCode", goodsCode);
        exchangeRecord.put("createdAt", Instant.now().toString());
        firestore.collection("gifticon_exchanges").add(exchangeRecord).get();

        // 9-2. 유저 기프티콘 지갑에 저장 (앱 내 표시용)
        UserGifticonDto userGifticon = UserGifticonDto.builder()
                .uid(uid)
                .trId(trId)
                .goodsCode(goodsCode)
                .name(gifticon.getName())
                .brand(gifticon.getBrand())
                .brandIcon(gifticon.getBrandIcon())
                .couponImageUrl(couponImageUrl != null ? couponImageUrl : gifticon.getImage())
                .pinNo(pinNo != null ? pinNo : "")
                .validPeriod(validPeriod != null ? validPeriod : "")
                .pointCost(gifticon.getPointCost())
                .used(false)
                .build();
        userGifticonService.save(userGifticon);

        log.info("기프티콘 교환 완료: uid={}, gifticonId={}, trId={}, cost={}P", uid, gifticonId, trId, gifticon.getPointCost());

        // 10. 푸시 알림
        notificationService.sendToUser(uid, "기프티콘 교환 완료",
                String.format("%s 기프티콘이 교환되었어요! %dP를 사용했습니다.", gifticon.getName(), gifticon.getPointCost()),
                "gifticon", "/my-gifticons", gifticon.getImage());

        // 10-2. 카카오 알림톡 (실패해도 무시 — 부가 기능)
        try {
            alimtalkService.sendExchangeAlimtalk(
                    phoneNo,
                    user.getNickname(),
                    gifticon.getName(),
                    pinNo,
                    validPeriod
            );
        } catch (Exception e) {
            log.warn("알림톡 호출 실패 (무시): {}", e.getMessage());
        }

        // 11. 결과 반환
        Map<String, Object> result = new HashMap<>();
        result.put("gifticon", gifticon);
        result.put("trId", trId);
        return result;
    }

    /**
     * 쿠폰 발급 실패 시 선차감된 포인트를 즉시 환급하고 기록을 남긴다.
     * (실패해도 예외는 재전파되어 호출측에서 RuntimeException을 그대로 던짐)
     */
    private void refundExchangeFailure(String uid, int pointCost, String gifticonName, String reason) {
        try {
            firestore.collection("users").document(uid)
                    .update("points", FieldValue.increment(pointCost)).get();
            PointHistoryDto refundHistory = PointHistoryDto.builder()
                    .uid(uid)
                    .type("earn")
                    .amount(pointCost)
                    .title(gifticonName + " 교환 실패 환급")
                    .description("쿠폰 발급 실패로 자동 환급 — " + reason)
                    .build();
            pointHistoryService.create(refundHistory);
            log.warn("교환 실패 자동 환급: uid={}, amount={}P, reason={}", uid, pointCost, reason);
        } catch (Exception e) {
            log.error("교환 실패 환급 처리 자체 실패 (수동 보정 필요): uid={}, amount={}P, error={}", uid, pointCost, e.getMessage());
            try {
                notificationService.sendToAdmins("⚠️ 교환 환급 실패 (수동 조치 필요)",
                        String.format("uid=%s, %dP, %s / 사유: %s", uid, pointCost, gifticonName, reason));
            } catch (Exception ignored) {}
        }
    }

    /**
     * 기프티쇼 비즈 API에서 상품 목록을 가져와 Firestore에 동기화
     */
    public int syncGoodsFromGiftishow() throws ExecutionException, InterruptedException {
        // 기존 기프티콘 전부 삭제 — WriteBatch로 500건씩 묶어서 N+1 write 제거
        var existingDocs = firestore.collection(COLLECTION).get().get().getDocuments();
        com.google.cloud.firestore.WriteBatch batch = firestore.batch();
        int pending = 0;
        for (var doc : existingDocs) {
            batch.delete(doc.getReference());
            if (++pending >= 500) {
                batch.commit().get();
                batch = firestore.batch();
                pending = 0;
            }
        }
        if (pending > 0) batch.commit().get();
        log.info("기존 기프티콘 {}개 삭제 (batch)", existingDocs.size());

        int totalSynced = 0;
        int page = 1;
        int pageSize = 100;

        while (true) {
            JsonNode response = giftishowApiService.getGoodsList(page, pageSize);
            if (response == null || !"0000".equals(response.path("code").asText())) {
                log.warn("기프티쇼 상품 목록 조회 실패: {}", response);
                break;
            }

            JsonNode goodsList = response.path("result").path("goodsList");
            if (!goodsList.isArray() || goodsList.isEmpty()) break;

            for (JsonNode goods : goodsList) {
                String goodsCode = goods.path("goodsCode").asText();
                String goodsStateCd = goods.path("goodsStateCd").asText();
                if (!"SALE".equals(goodsStateCd)) continue;

                // 요리/식품 관련 브랜드만 필터링
                String brandName = goods.path("brandName").asText();
                boolean isAllowed = ALLOWED_BRANDS.stream().anyMatch(allowed ->
                        brandName.contains(allowed) || allowed.contains(brandName)
                );
                if (!isAllowed) continue;

                // 2,000원 미만 상품 제외
                int salePrice = goods.path("salePrice").asInt();
                if (salePrice < 2000) continue;

                GifticonDto dto = GifticonDto.builder()
                        .id(goodsCode)
                        .goodsCode(goodsCode)
                        .name(goods.path("goodsName").asText())
                        .brand(goods.path("brandName").asText())
                        .brandCode(goods.path("brandCode").asText())
                        .image(goods.path("goodsImgB").asText())
                        .imageSmall(goods.path("goodsImgS").asText())
                        .brandIcon(goods.path("brandIconImg").asText())
                        .pointCost((int) (goods.path("salePrice").asInt() * 1.3))
                        .realPrice(goods.path("realPrice").asInt())
                        // 할인 표시용: 실제 포인트 가격의 1.5배를 "원가"로 표시 (실제 구매가는 pointCost)
                        .salePrice((int) (goods.path("salePrice").asInt() * 1.3 * 1.18))
                        .category(goods.path("goodsTypeDtlNm").asText())
                        .description(goods.path("content").asText())
                        .affiliate(goods.path("affiliate").asText())
                        .active(true)
                        .stock(9999)
                        .build();

                firestore.collection(COLLECTION).document(goodsCode).set(dto).get();
                totalSynced++;
            }

            int listNum = response.path("result").path("listNum").asInt(0);
            if (page * pageSize >= listNum) break;
            page++;
        }

        log.info("기프티쇼 상품 동기화 완료: {}개 상품", totalSynced);
        return totalSynced;
    }

    /**
     * 비즈머니 잔액 조회
     */
    public long getBizmoneyBalance() {
        JsonNode response = giftishowApiService.getBizmoneyBalance();
        if (response != null && "0000".equals(response.path("code").asText())) {
            return response.path("balance").asLong(0);
        }
        return -1;
    }
}
