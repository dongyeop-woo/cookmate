package com.devl.api.service;

import com.devl.api.dto.CommunityRecipeDto;
import com.devl.api.dto.PointHistoryDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommunityService {

    private final Firestore firestore;
    private final NotificationService notificationService;
    private final PointHistoryService pointHistoryService;
    private final UserService userService;

    private static final String COLLECTION = "community";
    // 커뮤니티 레시피 한 번에 최대 반환 수. 쌓이면 페이지네이션 쓰도록.
    private static final int DEFAULT_COMMUNITY_LIMIT = 200;

    public List<CommunityRecipeDto> getAll() throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(DEFAULT_COMMUNITY_LIMIT)
                .get();

        List<CommunityRecipeDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            list.add(doc.toObject(CommunityRecipeDto.class));
        }
        return list;
    }

    public CommunityRecipeDto getById(String id) throws ExecutionException, InterruptedException {
        DocumentSnapshot doc = firestore.collection(COLLECTION).document(id).get().get();
        if (!doc.exists()) {
            return null;
        }
        return doc.toObject(CommunityRecipeDto.class);
    }

    public CommunityRecipeDto create(CommunityRecipeDto dto) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document();
        dto.setId(ref.getId());
        dto.setCreatedAt(java.time.Instant.now().toString());
        dto.setLikes(0);
        if (dto.getRatings() == null) dto.setRatings(new ArrayList<>());
        if (dto.getQuestions() == null) dto.setQuestions(new ArrayList<>());
        ref.set(dto).get();

        // 관리자 등록분(이미 approved)은 검토 알림 스킵
        if (!"approved".equals(dto.getStatus())) {
            notificationService.sendToAdmins(
                    "새 레시피 검토 요청",
                    String.format("\"%s\" 레시피가 등록되었어요. 검토해주세요.", dto.getTitle())
            );
        }

        return dto;
    }

    public CommunityRecipeDto update(String id, CommunityRecipeDto dto) throws ExecutionException, InterruptedException {
        dto.setId(id);
        firestore.collection(COLLECTION).document(id).set(dto, SetOptions.merge()).get();
        return dto;
    }

    public void delete(String id) throws ExecutionException, InterruptedException {
        // 삭제 전에 작성자/상태 정보 확보 — 승인 상태였다면 user.recipeCount 도 같이 감소.
        try {
            DocumentSnapshot snap = firestore.collection(COLLECTION).document(id).get().get();
            if (snap.exists() && "approved".equals(snap.getString("status"))) {
                String authorUid = snap.getString("authorUid");
                if (authorUid != null && !authorUid.isEmpty()) {
                    firestore.collection("users").document(authorUid)
                            .update("recipeCount", FieldValue.increment(-1)).get();
                }
            }
        } catch (Exception e) {
            log.warn("recipeCount 감소 실패 recipeId={}: {}", id, e.getMessage());
        }
        firestore.collection(COLLECTION).document(id).delete().get();
    }

    /**
     * 작성자의 총 게시물 수 — community 승인분 + recipes(관리자 등록분) 합산.
     * 앱의 프로필 "게시물" 카운트와 동일한 기준 (myRegular + myCommunity).
     * recipes 컬렉션은 author(닉네임)로도 매칭 — 레거시 레시피가 authorUid 없이 닉네임만 있을 수 있어서.
     */
    public int countApprovedByAuthor(String authorUid, String authorNickname) {
        int total = 0;
        // 1) community 컬렉션 — 승인된 사용자 게시물
        if (authorUid != null && !authorUid.isEmpty()) {
            try {
                total += firestore.collection(COLLECTION)
                        .whereEqualTo("authorUid", authorUid)
                        .whereEqualTo("status", "approved")
                        .get().get().size();
            } catch (Exception e) {
                log.warn("community 카운트 실패 uid={}: {}", authorUid, e.getMessage());
            }
        }
        // 2) recipes 컬렉션 — 관리자 등록 일반 레시피
        //    authorUid 우선, 없으면 닉네임으로 매칭. 둘 다 시도해서 OR 합집합 카운트.
        java.util.Set<String> recipeIds = new java.util.HashSet<>();
        if (authorUid != null && !authorUid.isEmpty()) {
            try {
                firestore.collection("recipes")
                        .whereEqualTo("authorUid", authorUid)
                        .get().get().getDocuments()
                        .forEach(d -> recipeIds.add(d.getId()));
            } catch (Exception e) {
                log.warn("recipes(authorUid) 카운트 실패 uid={}: {}", authorUid, e.getMessage());
            }
        }
        if (authorNickname != null && !authorNickname.isEmpty()) {
            try {
                firestore.collection("recipes")
                        .whereEqualTo("author", authorNickname)
                        .get().get().getDocuments()
                        .forEach(d -> recipeIds.add(d.getId()));
            } catch (Exception e) {
                log.warn("recipes(author) 카운트 실패 nickname={}: {}", authorNickname, e.getMessage());
            }
        }
        total += recipeIds.size();
        return total;
    }

    public CommunityRecipeDto addRating(String id, String userId, double score)
            throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        CommunityRecipeDto dto = ref.get().get().toObject(CommunityRecipeDto.class);
        if (dto == null) return null;

        List<CommunityRecipeDto.RatingDto> ratings = dto.getRatings();
        if (ratings == null) ratings = new ArrayList<>();
        ratings.removeIf(r -> userId.equals(r.getUserId()));
        ratings.add(CommunityRecipeDto.RatingDto.builder().userId(userId).score(score).build());
        dto.setRatings(ratings);

        ref.update("ratings", ratings).get();
        return dto;
    }

    private static final int APPROVAL_POINTS = 100;

    private static final int DAILY_APPROVAL_LIMIT = 2;

    // 관리자 1인이 하루에 승인 처리할 수 있는 레시피 수 (계정 탈취 시 피해 상한)
    private static final int DAILY_ADMIN_APPROVAL_LIMIT = 100;

    /** @deprecated adminUid, adminIp 전달하는 오버로드를 사용하세요 (관리자 레이트 리밋 + 감사 로그) */
    @Deprecated
    public void updateStatus(String id, String status, String rejectionReason)
            throws ExecutionException, InterruptedException {
        updateStatus(id, status, rejectionReason, null, null);
    }

    public void updateStatus(String id, String status, String rejectionReason, String adminUid, String adminIp)
            throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        CommunityRecipeDto dto = ref.get().get().toObject(CommunityRecipeDto.class);
        if (dto == null) return;

        String todayStart = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul"))
                .atStartOfDay(java.time.ZoneId.of("Asia/Seoul")).toInstant().toString();

        // 하루 승인 상한 (작성자당 2건/일) — approvedAt 기준으로 카운트
        if ("approved".equals(status) && dto.getAuthorUid() != null && !dto.getAuthorUid().isEmpty()) {
            ApiFuture<QuerySnapshot> approvedToday = firestore.collection(COLLECTION)
                    .whereEqualTo("authorUid", dto.getAuthorUid())
                    .whereEqualTo("status", "approved")
                    .get();
            long count = approvedToday.get().getDocuments().stream()
                    .filter(d -> {
                        String approvedAt = d.getString("approvedAt");
                        return approvedAt != null && approvedAt.compareTo(todayStart) >= 0;
                    }).count();
            if (count >= DAILY_APPROVAL_LIMIT) {
                throw new IllegalStateException("이 작성자는 오늘 이미 " + DAILY_APPROVAL_LIMIT + "건이 승인되어 더 이상 승인할 수 없습니다.");
            }
        }

        // 관리자 1인 하루 승인 상한 (관리자 담합 기반 첫 레시피 500P 농사 차단)
        if ("approved".equals(status) && adminUid != null && !adminUid.isEmpty()) {
            ApiFuture<QuerySnapshot> adminApprovals = firestore.collection("admin_audit_log")
                    .whereEqualTo("adminUid", adminUid)
                    .whereEqualTo("action", "community_approve")
                    .whereGreaterThanOrEqualTo("createdAt", todayStart)
                    .get();
            long adminCount = adminApprovals.get().getDocuments().size();
            if (adminCount >= DAILY_ADMIN_APPROVAL_LIMIT) {
                throw new IllegalStateException("관리자 1일 승인 한도(" + DAILY_ADMIN_APPROVAL_LIMIT + "건)를 초과했습니다.");
            }
        }

        Map<String, Object> updates = new java.util.HashMap<>();
        updates.put("status", status);
        updates.put("rejectionReason", rejectionReason != null ? rejectionReason : "");
        if ("approved".equals(status)) {
            updates.put("approvedAt", java.time.Instant.now().toString());
            if (adminUid != null) updates.put("approvedByAdminUid", adminUid);
        }
        ref.update(updates).get();

        // 감사 로그: 어떤 관리자가 언제 어느 IP에서 어떤 레시피를 어떻게 처리했는지 기록
        try {
            Map<String, Object> audit = new java.util.HashMap<>();
            audit.put("adminUid", adminUid);
            audit.put("adminIp", adminIp);
            audit.put("action", "approved".equals(status) ? "community_approve" : "community_reject");
            audit.put("targetRecipeId", id);
            audit.put("targetAuthorUid", dto.getAuthorUid());
            audit.put("rejectionReason", rejectionReason);
            audit.put("createdAt", java.time.Instant.now().toString());
            firestore.collection("admin_audit_log").add(audit).get();
        } catch (Exception e) {
            log.warn("관리자 감사 로그 기록 실패: {}", e.getMessage());
        }

        // 작성자에게 알림 + 포인트 지급
        if (dto.getAuthorUid() != null && !dto.getAuthorUid().isEmpty()) {
            if ("approved".equals(status)) {
                DocumentReference userRef = firestore.collection("users").document(dto.getAuthorUid());
                // 이전 상태가 이미 approved 였으면 중복 증가 방지
                boolean wasApprovedAlready = "approved".equals(dto.getStatus());
                Map<String, Object> userUpdates = new java.util.HashMap<>();
                userUpdates.put("points", FieldValue.increment(APPROVAL_POINTS));
                if (!wasApprovedAlready) {
                    userUpdates.put("recipeCount", FieldValue.increment(1));
                }
                userRef.update(userUpdates).get();
                log.info("포인트 {}P 지급: uid={}, recipeId={}", APPROVAL_POINTS, dto.getAuthorUid(), id);

                // 포인트 히스토리 기록
                PointHistoryDto history = PointHistoryDto.builder()
                        .uid(dto.getAuthorUid())
                        .type("earn")
                        .amount(APPROVAL_POINTS)
                        .title(dto.getTitle())
                        .description("레시피 승인 포인트 적립")
                        .build();
                pointHistoryService.create(history);

                notificationService.sendToUser(dto.getAuthorUid(),
                        "레시피 승인 완료! 🎉",
                        String.format("%s 레시피가 승인되었어요! %dP가 적립되었습니다.", dto.getTitle() != null ? dto.getTitle() : "회원님의", APPROVAL_POINTS),
                        "recipe", "/recipe/" + id, dto.getImage());

                // 첫 레시피 승인 보너스 500P
                try {
                    userService.claimFirstRecipeBonus(dto.getAuthorUid());
                } catch (Exception e) {
                    log.warn("첫 레시피 보너스 지급 실패: uid={}, error={}", dto.getAuthorUid(), e.getMessage());
                }
            } else if ("rejected".equals(status)) {
                String reason = (rejectionReason != null && !rejectionReason.isEmpty())
                        ? " 사유: " + rejectionReason : "";
                notificationService.sendToUser(dto.getAuthorUid(),
                        "레시피 반려 안내",
                        String.format("%s 레시피가 반려되었습니다.%s", dto.getTitle() != null ? dto.getTitle() : "회원님의", reason),
                        "recipe", "/my-activity", dto.getImage());
            }
        }
    }

    public CommunityRecipeDto like(String id) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        ref.update("likes", FieldValue.increment(1)).get();
        return ref.get().get().toObject(CommunityRecipeDto.class);
    }

    public CommunityRecipeDto unlike(String id) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        // 동시 unlike 시 atomicity 위해 FieldValue.increment(-1) 사용 (read-then-write race 방지)
        ref.update("likes", FieldValue.increment(-1)).get();
        CommunityRecipeDto dto = ref.get().get().toObject(CommunityRecipeDto.class);
        if (dto == null) return null;
        // 음수 방어 — 만약 동시 unlike가 0 미만으로 내렸으면 0으로 보정
        if (dto.getLikes() < 0) {
            ref.update("likes", 0).get();
            dto.setLikes(0);
        }
        return dto;
    }
}
