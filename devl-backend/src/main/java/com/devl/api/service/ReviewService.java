package com.devl.api.service;

import com.devl.api.dto.PointHistoryDto;
import com.devl.api.dto.ReviewDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final Firestore firestore;
    private final NotificationService notificationService;
    private final PointHistoryService pointHistoryService;
    private final CookingHistoryService cookingHistoryService;

    private static final String COLLECTION = "reviews";
    private static final String USERS = "users";
    private static final String RECIPES = "recipes";
    private static final String COMMUNITY = "community";
    private static final int REVIEW_POINTS_WITH_PHOTO = 20;
    private static final int REVIEW_POINTS_TEXT_ONLY = 10;
    private static final int MIN_CONTENT_LEN = 10;
    private static final int DAILY_POINT_LIMIT = 5;

    public List<ReviewDto> getByRecipeId(String recipeId) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("recipeId", recipeId)
                .get();
        List<ReviewDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            list.add(doc.toObject(ReviewDto.class));
        }
        list.sort((a, b) -> {
            String A = a.getCreatedAt() != null ? a.getCreatedAt() : "";
            String B = b.getCreatedAt() != null ? b.getCreatedAt() : "";
            return B.compareTo(A);
        });
        return list;
    }

    public List<ReviewDto> getByUid(String uid) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("uid", uid)
                .get();
        List<ReviewDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            list.add(doc.toObject(ReviewDto.class));
        }
        return list;
    }

    public ReviewDto create(ReviewDto dto) throws ExecutionException, InterruptedException {
        // 1) 필수 조건 검증
        if (dto.getRecipeId() == null || dto.getRecipeId().isEmpty()) {
            throw new IllegalArgumentException("recipeId는 필수입니다.");
        }
        if (dto.getUid() == null || dto.getUid().isEmpty()) {
            throw new IllegalArgumentException("uid는 필수입니다.");
        }
        String trimmedContent = dto.getContent() == null ? "" : dto.getContent().trim();
        boolean hasRating = dto.getRating() != null && dto.getRating() > 0;
        if (!hasRating && trimmedContent.isEmpty()) {
            throw new IllegalArgumentException("별점을 남기거나 후기 내용을 작성해주세요.");
        }
        if (!trimmedContent.isEmpty() && trimmedContent.length() < MIN_CONTENT_LEN) {
            throw new IllegalArgumentException("후기 내용은 " + MIN_CONTENT_LEN + "자 이상 작성하거나 비워주세요.");
        }

        // 1-1) 자기 레시피에는 후기 작성 불가 (자문자답 차단)
        DocumentReference recipeCheckRef = findRecipeRef(dto.getRecipeId());
        if (recipeCheckRef != null) {
            DocumentSnapshot snap = recipeCheckRef.get().get();
            if (snap.exists()) {
                String authorUid = snap.getString("authorUid");
                if (dto.getUid().equals(authorUid)) {
                    throw new IllegalArgumentException("본인이 작성한 레시피에는 후기를 남길 수 없어요.");
                }
            }
        }

        // 1-2) 요리모드 완료 여부 검증 (로컬 우회 방지)
        if (!cookingHistoryService.hasCooked(dto.getUid(), dto.getRecipeId())) {
            throw new IllegalArgumentException("이 레시피의 요리모드를 완료한 후에 후기를 작성할 수 있어요.");
        }

        // 2) 같은 레시피에 이미 후기를 작성했는지 확인 (1레시피 1후기 정책)
        ApiFuture<QuerySnapshot> existing = firestore.collection(COLLECTION)
                .whereEqualTo("recipeId", dto.getRecipeId())
                .whereEqualTo("uid", dto.getUid())
                .limit(1)
                .get();
        if (!existing.get().getDocuments().isEmpty()) {
            throw new IllegalArgumentException("이미 이 레시피에 후기를 작성하셨습니다.");
        }

        // 3) 포인트 지급 여부 결정 (사진 20P, 별점·텍스트 10P)
        boolean hasPhoto = dto.getPhotoUrl() != null && !dto.getPhotoUrl().isEmpty();
        PointResult pr = calculatePointsWithReason(dto.getUid(), dto.getRecipeId(), hasPhoto);
        int points = pr.points;

        // 3) 리뷰 저장
        DocumentReference ref = firestore.collection(COLLECTION).document();
        dto.setId(ref.getId());
        dto.setCreatedAt(Instant.now().toString());
        dto.setPointAwarded(points);
        dto.setPointDenyReason(points > 0 ? null : pr.reason);
        ref.set(dto).get();

        // 4) 레시피 문서의 reviewCount 증가 + reviewAvgRating 재계산
        try {
            DocumentReference recipeRef = findRecipeRef(dto.getRecipeId());
            if (recipeRef != null) {
                recipeRef.update("reviewCount", FieldValue.increment(1)).get();
                recalcAvgRating(dto.getRecipeId(), recipeRef);
            }
        } catch (Exception e) {
            log.warn("reviewCount/avg 업데이트 실패: {}", e.getMessage());
        }

        // 5) 포인트 지급 처리 — addPoints가 WriteBatch로 history + points를 원자적으로 처리
        if (points > 0) {
            pointHistoryService.addPoints(dto.getUid(), points, "후기 작성 포인트", "레시피 후기 작성 적립", dto.getRecipeId());
            log.info("후기 포인트 {}P 지급: uid={}, recipeId={}", points, dto.getUid(), dto.getRecipeId());
        }

        // 6) 레시피 작성자에게 알림
        notifyRecipeAuthor(dto);

        return dto;
    }

    /** 포인트 계산 결과 — 지급액 + 미지급 사유 코드. */
    private static class PointResult {
        final int points;
        final String reason; // null when points > 0
        PointResult(int points, String reason) { this.points = points; this.reason = reason; }
    }

    /** 지급 가능한 포인트 계산. 모든 어뷰징 가드 통과 시 사진 여부에 따라 20/10P, 아니면 0 + 사유 코드. */
    private PointResult calculatePointsWithReason(String uid, String recipeId, boolean hasPhoto) throws ExecutionException, InterruptedException {
        // 자기 레시피 자기 후기 → 0P
        DocumentReference recipeRef = findRecipeRef(recipeId);
        if (recipeRef != null) {
            DocumentSnapshot snap = recipeRef.get().get();
            if (snap.exists()) {
                String authorUid = snap.getString("authorUid");
                if (uid.equals(authorUid)) return new PointResult(0, "OWN_RECIPE");
            }
        }

        // 같은 레시피에 이미 후기 작성했으면 → 0P (작성은 허용)
        ApiFuture<QuerySnapshot> dup = firestore.collection(COLLECTION)
                .whereEqualTo("recipeId", recipeId)
                .whereEqualTo("uid", uid)
                .limit(1)
                .get();
        if (!dup.get().getDocuments().isEmpty()) return new PointResult(0, "ALREADY_REVIEWED");

        // 과거에 같은 레시피로 후기 포인트를 받은 적이 있으면 → 0P (삭제 후 재작성 어뷰징 방지)
        ApiFuture<QuerySnapshot> pastEarn = firestore.collection("point_history")
                .whereEqualTo("uid", uid)
                .whereEqualTo("recipeId", recipeId)
                .whereEqualTo("type", "earn")
                .limit(1)
                .get();
        if (!pastEarn.get().getDocuments().isEmpty()) return new PointResult(0, "PAST_EARN");

        // 오늘 이미 DAILY_POINT_LIMIT개 이상 포인트 받았으면 → 0P (KST 기준, 출석체크와 동일 타임존)
        ZoneId kst = ZoneId.of("Asia/Seoul");
        String todayStart = LocalDate.now(kst).atStartOfDay(kst).toInstant().toString();
        ApiFuture<QuerySnapshot> today = firestore.collection(COLLECTION)
                .whereEqualTo("uid", uid)
                .whereGreaterThanOrEqualTo("createdAt", todayStart)
                .get();
        long awardedToday = today.get().getDocuments().stream()
                .filter(d -> {
                    Long p = d.getLong("pointAwarded");
                    return p != null && p > 0;
                }).count();
        if (awardedToday >= DAILY_POINT_LIMIT) return new PointResult(0, "DAILY_LIMIT");

        return new PointResult(hasPhoto ? REVIEW_POINTS_WITH_PHOTO : REVIEW_POINTS_TEXT_ONLY, null);
    }

    private DocumentReference findRecipeRef(String recipeId) throws ExecutionException, InterruptedException {
        // 2개 컬렉션 조회를 병렬화 — 순차 대비 응답 시간 반으로.
        DocumentReference ref = firestore.collection(RECIPES).document(recipeId);
        DocumentReference communityRef = firestore.collection(COMMUNITY).document(recipeId);
        ApiFuture<DocumentSnapshot> recipeFut = ref.get();
        ApiFuture<DocumentSnapshot> communityFut = communityRef.get();
        if (recipeFut.get().exists()) return ref;
        if (communityFut.get().exists()) return communityRef;
        return null;
    }

    private void notifyRecipeAuthor(ReviewDto dto) {
        try {
            DocumentReference ref = findRecipeRef(dto.getRecipeId());
            if (ref == null) return;
            DocumentSnapshot snap = ref.get().get();
            String authorUid = snap.getString("authorUid");
            if (authorUid == null || authorUid.isEmpty() || authorUid.equals(dto.getUid())) return;
            String nickname = dto.getAuthorNickname() != null ? dto.getAuthorNickname() : "누군가";
            String recipeImage = snap.getString("image");
            notificationService.sendToUser(authorUid, "새로운 후기",
                    nickname + "님이 회원님의 레시피 후기를 남겼어요.",
                    "review", "/recipe/" + dto.getRecipeId(), recipeImage);
        } catch (Exception e) {
            log.warn("후기 알림 전송 실패: {}", e.getMessage());
        }
    }

    /** 레시피 작성자가 후기에 답글 작성/수정 */
    public ReviewDto addOrUpdateReply(String reviewId, String requesterUid, String replyContent) throws ExecutionException, InterruptedException {
        if (replyContent == null || replyContent.trim().isEmpty()) {
            throw new IllegalArgumentException("답글 내용은 비어있을 수 없습니다.");
        }
        DocumentReference ref = firestore.collection(COLLECTION).document(reviewId);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) {
            throw new IllegalArgumentException("후기를 찾을 수 없습니다.");
        }
        String recipeId = snap.getString("recipeId");
        DocumentReference recipeRef = findRecipeRef(recipeId);
        if (recipeRef == null) {
            throw new IllegalArgumentException("레시피를 찾을 수 없습니다.");
        }
        DocumentSnapshot recipeSnap = recipeRef.get().get();
        String authorUid = recipeSnap.getString("authorUid");
        // 일반 레시피는 authorUid가 없을 수 있어 nickname으로 폴백
        if (authorUid == null || authorUid.isEmpty()) {
            String authorName = recipeSnap.getString("author");
            if (authorName != null && !authorName.isEmpty()) {
                QuerySnapshot users = firestore.collection(USERS)
                        .whereEqualTo("nickname", authorName).limit(1).get().get();
                if (!users.isEmpty()) {
                    authorUid = users.getDocuments().get(0).getId();
                }
            }
        }
        if (authorUid == null || !authorUid.equals(requesterUid)) {
            throw new IllegalArgumentException("레시피 작성자만 답글을 달 수 있습니다.");
        }
        DocumentSnapshot userSnap = firestore.collection(USERS).document(requesterUid).get().get();
        String nickname = userSnap.getString("nickname");
        java.util.Map<String, Object> fields = new java.util.HashMap<>();
        fields.put("reply", replyContent.trim());
        fields.put("replyAuthorNickname", nickname != null ? nickname : "작성자");
        fields.put("replyCreatedAt", Instant.now().toString());
        ref.update(fields).get();

        // 후기 작성자에게 알림
        try {
            String reviewerUid = snap.getString("uid");
            if (reviewerUid != null && !reviewerUid.equals(requesterUid)) {
                String recipeImage = recipeSnap.getString("image");
                notificationService.sendToUser(reviewerUid, "새로운 답글",
                        (nickname != null ? nickname : "작성자") + "님이 회원님의 후기에 답글을 남겼어요.",
                        "review", "/recipe/" + recipeId, recipeImage);
            }
        } catch (Exception e) {
            log.warn("답글 알림 실패: {}", e.getMessage());
        }
        return ref.get().get().toObject(ReviewDto.class);
    }

    public ReviewDto deleteReply(String reviewId, String requesterUid) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(reviewId);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) {
            throw new IllegalArgumentException("후기를 찾을 수 없습니다.");
        }
        String recipeId = snap.getString("recipeId");
        DocumentReference recipeRef = findRecipeRef(recipeId);
        String authorUid = recipeRef != null ? recipeRef.get().get().getString("authorUid") : null;
        if (authorUid == null || !authorUid.equals(requesterUid)) {
            throw new IllegalArgumentException("레시피 작성자만 답글을 삭제할 수 있습니다.");
        }
        java.util.Map<String, Object> fields = new java.util.HashMap<>();
        fields.put("reply", FieldValue.delete());
        fields.put("replyAuthorNickname", FieldValue.delete());
        fields.put("replyCreatedAt", FieldValue.delete());
        ref.update(fields).get();
        return ref.get().get().toObject(ReviewDto.class);
    }

    public ReviewDto update(String id, String requesterUid, ReviewDto updates) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) {
            throw new IllegalArgumentException("후기를 찾을 수 없습니다.");
        }
        String ownerUid = snap.getString("uid");
        if (ownerUid == null || !ownerUid.equals(requesterUid)) {
            throw new IllegalArgumentException("수정 권한이 없습니다.");
        }
        java.util.Map<String, Object> fields = new java.util.HashMap<>();
        if (updates.getContent() != null) {
            if (updates.getContent().trim().length() < MIN_CONTENT_LEN) {
                throw new IllegalArgumentException("후기는 " + MIN_CONTENT_LEN + "자 이상 작성해주세요.");
            }
            fields.put("content", updates.getContent().trim());
        }
        if (updates.getPhotoUrl() != null && !updates.getPhotoUrl().isEmpty()) {
            fields.put("photoUrl", updates.getPhotoUrl());
        }
        if (updates.getRating() != null) {
            fields.put("rating", updates.getRating());
        }
        if (!fields.isEmpty()) {
            ref.update(fields).get();
        }
        // rating 수정 시 avg 재계산
        if (updates.getRating() != null) {
            try {
                String rid = snap.getString("recipeId");
                DocumentReference recipeRef = findRecipeRef(rid);
                if (recipeRef != null) recalcAvgRating(rid, recipeRef);
            } catch (Exception e) {
                log.warn("avg 재계산 실패: {}", e.getMessage());
            }
        }
        return ref.get().get().toObject(ReviewDto.class);
    }

    /** 특정 레시피의 reviewAvgRating을 현재 후기들의 평균으로 업데이트 */
    private void recalcAvgRating(String recipeId, DocumentReference recipeRef) throws ExecutionException, InterruptedException {
        QuerySnapshot snaps = firestore.collection(COLLECTION).whereEqualTo("recipeId", recipeId).get().get();
        double sum = 0;
        int count = 0;
        for (QueryDocumentSnapshot d : snaps.getDocuments()) {
            Long r = d.getLong("rating");
            if (r != null && r > 0) { sum += r; count++; }
        }
        double avg = count > 0 ? sum / count : 0.0;
        recipeRef.update("reviewAvgRating", avg).get();
    }

    /** 모든 레시피의 reviewCount를 실제 후기 개수로 재계산. 1회성 백필용. */
    public java.util.Map<String, Integer> recalculateAllReviewCounts() throws ExecutionException, InterruptedException {
        java.util.Map<String, Integer> counts = new java.util.HashMap<>();
        for (QueryDocumentSnapshot doc : firestore.collection(COLLECTION).get().get().getDocuments()) {
            String rid = doc.getString("recipeId");
            if (rid == null) continue;
            counts.merge(rid, 1, Integer::sum);
        }
        for (java.util.Map.Entry<String, Integer> e : counts.entrySet()) {
            try {
                DocumentReference ref = findRecipeRef(e.getKey());
                if (ref != null) {
                    ref.update("reviewCount", e.getValue()).get();
                    recalcAvgRating(e.getKey(), ref);
                }
            } catch (Exception ex) {
                log.warn("백필 실패 recipeId={}: {}", e.getKey(), ex.getMessage());
            }
        }
        log.info("reviewCount 백필 완료: {} 레시피", counts.size());
        return counts;
    }

    public void delete(String id, String requesterUid, boolean isAdmin) throws ExecutionException, InterruptedException {
        DocumentSnapshot snap = firestore.collection(COLLECTION).document(id).get().get();
        if (!snap.exists()) return;
        String reviewerUid = snap.getString("uid");
        if (!isAdmin && (reviewerUid == null || !reviewerUid.equals(requesterUid))) {
            throw new IllegalArgumentException("후기 삭제 권한이 없습니다");
        }
        String recipeId = snap.getString("recipeId");
        firestore.collection(COLLECTION).document(id).delete().get();
        if (recipeId != null) {
            try {
                DocumentReference recipeRef = findRecipeRef(recipeId);
                if (recipeRef != null) {
                    DocumentSnapshot rs = recipeRef.get().get();
                    long current = rs.getLong("reviewCount") != null ? rs.getLong("reviewCount") : 0;
                    if (current > 0) recipeRef.update("reviewCount", current - 1).get();
                    recalcAvgRating(recipeId, recipeRef);
                }
            } catch (Exception e) {
                log.warn("reviewCount/avg 업데이트 실패: {}", e.getMessage());
            }
        }
    }
}
