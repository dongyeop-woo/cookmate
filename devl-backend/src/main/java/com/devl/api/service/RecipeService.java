package com.devl.api.service;

import com.devl.api.dto.CategoryDto;
import com.devl.api.dto.RecipeDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecipeService {

    private final NotificationService notificationService;
    private final PointHistoryService pointHistoryService;

    private final Firestore firestore;

    // 한 번에 반환하는 최대 레시피 수. 공식 레시피가 95개 이상이 되면서 80 cap 에 걸려 누락되는
    // 문제가 있어 200 으로 상향. 필요 시 페이지네이션 (fetchRecipesPage) 사용.
    private static final int DEFAULT_RECIPE_PAGE_LIMIT = 200;
    private static final int MAX_RECIPE_PAGE_LIMIT = 500;

    /** 기본: 최신순으로 최대 DEFAULT_RECIPE_PAGE_LIMIT 개까지 */
    public List<RecipeDto> getAllRecipes() throws ExecutionException, InterruptedException {
        return getRecipesPage(DEFAULT_RECIPE_PAGE_LIMIT, null).items;
    }

    public static class Page {
        public final List<RecipeDto> items;
        /** 다음 페이지 요청에 사용할 커서 (마지막 doc의 createdAt). null이면 더 없음. */
        public final String nextCursor;
        public Page(List<RecipeDto> items, String nextCursor) {
            this.items = items;
            this.nextCursor = nextCursor;
        }
    }

    /**
     * 페이지네이션: 최신 createdAt 내림차순으로 limit 개씩 반환.
     * cursor는 이전 페이지 마지막 문서의 createdAt 문자열.
     */
    public Page getRecipesPage(int limit, String cursor) throws ExecutionException, InterruptedException {
        int safeLimit = Math.max(1, Math.min(limit, MAX_RECIPE_PAGE_LIMIT));
        Query q = firestore.collection("recipes")
                .orderBy("createdAt", Query.Direction.DESCENDING);
        if (cursor != null && !cursor.isEmpty()) {
            q = q.startAfter(cursor);
        }
        q = q.limit(safeLimit);

        List<QueryDocumentSnapshot> documents = q.get().get().getDocuments();
        List<RecipeDto> recipes = new ArrayList<>();
        for (QueryDocumentSnapshot doc : documents) {
            recipes.add(mapToRecipeDto(doc));
        }
        String nextCursor = null;
        if (documents.size() == safeLimit) {
            QueryDocumentSnapshot last = documents.get(documents.size() - 1);
            nextCursor = last.getString("createdAt");
        }
        return new Page(recipes, nextCursor);
    }

    /**
     * 여러 레시피를 한 번에 조회 — 북마크/저장 목록 등 N+1 방지.
     * Firestore의 whereIn은 30개 제한이라 두 컬렉션 각 2회까지 나눠 처리 (최대 50개 × 2 = 4쿼리).
     */
    public List<RecipeDto> getRecipesByIds(List<String> ids) throws ExecutionException, InterruptedException {
        if (ids == null || ids.isEmpty()) return new ArrayList<>();
        Map<String, RecipeDto> result = new java.util.LinkedHashMap<>();
        for (String coll : new String[]{"recipes", "community"}) {
            // whereIn은 최대 30개이므로 청크로 분할
            for (int i = 0; i < ids.size(); i += 30) {
                List<String> chunk = ids.subList(i, Math.min(i + 30, ids.size()));
                QuerySnapshot snap = firestore.collection(coll)
                        .whereIn(com.google.cloud.firestore.FieldPath.documentId(), chunk)
                        .get().get();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    if (!result.containsKey(doc.getId())) {
                        result.put(doc.getId(), mapToRecipeDto(doc));
                    }
                }
            }
        }
        // 요청 순서대로 정렬
        List<RecipeDto> ordered = new ArrayList<>();
        for (String id : ids) {
            RecipeDto dto = result.get(id);
            if (dto != null) ordered.add(dto);
        }
        return ordered;
    }

    public RecipeDto getRecipeById(String id) throws ExecutionException, InterruptedException {
        DocumentSnapshot doc = firestore.collection("recipes").document(id).get().get();
        if (!doc.exists()) {
            doc = firestore.collection("community").document(id).get().get();
            if (!doc.exists()) return null;
        }
        return mapToRecipeDto(doc);
    }

    public List<RecipeDto> getRecipesByCategory(String category) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection("recipes")
                .whereEqualTo("category", category)
                .get();

        List<RecipeDto> recipes = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            recipes.add(mapToRecipeDto(doc));
        }
        return recipes;
    }

    public List<RecipeDto> getRecipesByTag(String tag) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection("recipes")
                .whereArrayContains("tags", tag)
                .get();

        List<RecipeDto> recipes = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            recipes.add(mapToRecipeDto(doc));
        }
        return recipes;
    }

    public List<RecipeDto> getTopRecipes(int limit) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection("recipes")
                .orderBy("rating", Query.Direction.DESCENDING)
                .limit(limit)
                .get();

        List<RecipeDto> recipes = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            recipes.add(mapToRecipeDto(doc));
        }
        return recipes;
    }

    public List<RecipeDto> getQuickRecipes(int maxMinutes) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection("recipes")
                .whereLessThanOrEqualTo("time", maxMinutes)
                .orderBy("time")
                .get();

        List<RecipeDto> recipes = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            recipes.add(mapToRecipeDto(doc));
        }
        return recipes;
    }

    public RecipeDto createRecipe(RecipeDto dto) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection("recipes").document();
        dto.setId(ref.getId());
        dto.setCreatedAt(java.time.Instant.now().toString());
        dto.setUpdatedAt(java.time.Instant.now().toString());
        ref.set(dto).get();
        return dto;
    }

    public RecipeDto updateRecipe(String id, RecipeDto dto) throws ExecutionException, InterruptedException {
        dto.setId(id);
        dto.setUpdatedAt(java.time.Instant.now().toString());
        DocumentReference ref = findRecipeRef(id);
        if (ref == null) return null;
        ref.set(dto, SetOptions.merge()).get();
        return dto;
    }

    public void deleteRecipe(String id) throws ExecutionException, InterruptedException {
        DocumentReference recipesRef = firestore.collection("recipes").document(id);
        if (recipesRef.get().get().exists()) {
            recipesRef.delete().get();
            return;
        }
        DocumentReference communityRef = firestore.collection("community").document(id);
        if (communityRef.get().get().exists()) {
            communityRef.delete().get();
        }
    }

    private DocumentReference findRecipeRef(String recipeId) throws ExecutionException, InterruptedException {
        // 2개 컬렉션 조회를 병렬화 — 순차 대비 응답 시간 반으로.
        DocumentReference ref = firestore.collection("recipes").document(recipeId);
        DocumentReference communityRef = firestore.collection("community").document(recipeId);
        com.google.api.core.ApiFuture<com.google.cloud.firestore.DocumentSnapshot> recipeFut = ref.get();
        com.google.api.core.ApiFuture<com.google.cloud.firestore.DocumentSnapshot> communityFut = communityRef.get();
        if (recipeFut.get().exists()) return ref;
        if (communityFut.get().exists()) return communityRef;
        return null;
    }

    public RecipeDto addComment(String recipeId, RecipeDto.CommentDto comment) throws ExecutionException, InterruptedException {
        DocumentReference ref = findRecipeRef(recipeId);
        if (ref == null) return null;
        comment.setId(java.util.UUID.randomUUID().toString());
        comment.setCreatedAt(java.time.Instant.now().toString());
        Map<String, Object> commentMap = new HashMap<>();
        commentMap.put("id", comment.getId());
        commentMap.put("uid", comment.getUid());
        commentMap.put("nickname", comment.getNickname());
        commentMap.put("text", comment.getText());
        commentMap.put("createdAt", comment.getCreatedAt());
        commentMap.put("profileImage", comment.getProfileImage());
        ref.update("comments", FieldValue.arrayUnion(commentMap)).get();
        // Increment comments count
        ref.update("comments_count", FieldValue.increment(1));

        // 레시피 작성자에게 댓글 알림
        DocumentSnapshot recipeDoc = ref.get().get();
        String authorUid = recipeDoc.getString("authorUid");
        if (authorUid == null || authorUid.isEmpty()) {
            // recipes 컬렉션은 author(닉네임)만 있을 수 있음 — authorUid 없으면 생략
        } else if (!authorUid.equals(comment.getUid())) {
            String title = recipeDoc.getString("title");
            String nickname = comment.getNickname() != null ? comment.getNickname() : "누군가";
            String recipeImage = recipeDoc.getString("image");
            notificationService.sendToUser(authorUid, "새 댓글",
                    String.format("\"%s\" 레시피에 %s님이 댓글을 남겼어요.", title, nickname),
                    "comment", "/recipe/" + recipeId, recipeImage);
        }

        return getRecipeById(recipeId);
    }

    /** 질문 답글: 레시피 작성자 또는 관리자만 가능 */
    public RecipeDto addCommentReply(String recipeId, String commentId, String requesterUid, String reply)
            throws ExecutionException, InterruptedException {
        if (reply == null || reply.trim().isEmpty()) {
            throw new IllegalArgumentException("답글 내용은 필수입니다.");
        }
        DocumentReference ref = findRecipeRef(recipeId);
        if (ref == null) throw new IllegalArgumentException("레시피를 찾을 수 없습니다.");
        DocumentSnapshot doc = ref.get().get();

        // 권한 확인: 레시피 작성자(authorUid 또는 author 닉네임) 또는 admin role
        DocumentSnapshot userDoc = firestore.collection("users").document(requesterUid).get().get();
        String role = userDoc.getString("role");
        String requesterNickname = userDoc.getString("nickname");
        boolean isAdmin = "admin".equals(role);

        String authorUid = doc.getString("authorUid");
        boolean isAuthor = false;
        if (authorUid != null && authorUid.equals(requesterUid)) {
            isAuthor = true;
        } else {
            // 일반 레시피는 author 닉네임으로 매칭
            String authorName = doc.getString("author");
            if (authorName != null && authorName.equals(requesterNickname)) isAuthor = true;
        }
        if (!isAdmin && !isAuthor) {
            throw new IllegalArgumentException("레시피 작성자 또는 관리자만 답글을 달 수 있습니다.");
        }

        // 트랜잭션으로 comments 배열을 read-modify-write 하며 answerRewarded 플래그를
        // 원자적으로 세팅해 동시 답글 달기 시 중복 보상을 차단한다.
        final String finalRequesterNickname = requesterNickname;
        final boolean finalIsAuthor = isAuthor;
        final String replyTrim = reply.trim();
        Map<String, Object> outcome = firestore.runTransaction(tx -> {
            DocumentSnapshot snap = tx.get(ref).get();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> comments = (List<Map<String, Object>>) snap.get("comments");
            if (comments == null) throw new IllegalArgumentException("질문을 찾을 수 없습니다.");
            Map<String, Object> result = new HashMap<>();
            result.put("found", false);
            for (Map<String, Object> c : comments) {
                if (!commentId.equals(c.get("id"))) continue;
                Object prevReply = c.get("reply");
                boolean hadReplyBefore = prevReply instanceof String && !((String) prevReply).trim().isEmpty();
                boolean alreadyRewarded = Boolean.TRUE.equals(c.get("answerRewarded"));
                String questionerUid = (String) c.get("uid");

                c.put("reply", replyTrim);
                c.put("replyAuthorNickname", finalRequesterNickname != null ? finalRequesterNickname : "작성자");
                c.put("replyAuthorRole", finalIsAuthor ? "author" : "admin");
                c.put("replyCreatedAt", java.time.Instant.now().toString());

                boolean eligible = !hadReplyBefore
                        && !alreadyRewarded
                        && questionerUid != null
                        && !questionerUid.equals(requesterUid);
                if (eligible) {
                    c.put("answerRewarded", true);
                    c.put("answerRewardedUid", requesterUid);
                }

                tx.update(ref, "comments", comments);
                result.put("found", true);
                result.put("eligible", eligible);
                result.put("questionerUid", questionerUid);
                break;
            }
            return result;
        }).get();

        if (!Boolean.TRUE.equals(outcome.get("found"))) {
            throw new IllegalArgumentException("질문을 찾을 수 없습니다.");
        }

        String questionerUid = (String) outcome.get("questionerUid");
        // 알림은 트랜잭션 외부에서 (한 번만 전송)
        if (questionerUid != null && !questionerUid.equals(requesterUid)) {
            String recipeImage = doc.getString("image");
            notificationService.sendToUser(questionerUid, "질문에 답글이 달렸어요",
                    (requesterNickname != null ? requesterNickname : "작성자") + "님이 회원님의 질문에 답글을 남겼어요.",
                    "comment", "/recipe/" + recipeId, recipeImage);
        }

        // 포인트 지급도 트랜잭션 외부 — 트랜잭션에서 eligible을 세팅할 때 이미 플래그가
        // 기록되었으므로, 포인트 적립 실패 시에는 수동 보정이 필요하다(플래그만 남음).
        if (Boolean.TRUE.equals(outcome.get("eligible"))) {
            try {
                pointHistoryService.addPoints(requesterUid, 10, "질문 답변 보상", recipeId);
            } catch (Exception e) {
                log.warn("답변 포인트 지급 실패 (수동 보정 필요): uid={}, error={}", requesterUid, e.getMessage());
            }
        }

        return getRecipeById(recipeId);
    }

    public RecipeDto deleteCommentReply(String recipeId, String commentId, String requesterUid)
            throws ExecutionException, InterruptedException {
        DocumentReference ref = findRecipeRef(recipeId);
        if (ref == null) throw new IllegalArgumentException("레시피를 찾을 수 없습니다.");
        DocumentSnapshot doc = ref.get().get();

        DocumentSnapshot userDoc = firestore.collection("users").document(requesterUid).get().get();
        boolean isAdmin = "admin".equals(userDoc.getString("role"));
        String requesterNickname = userDoc.getString("nickname");
        String authorUid = doc.getString("authorUid");
        String authorName = doc.getString("author");
        boolean isAuthor = (authorUid != null && authorUid.equals(requesterUid))
                || (authorName != null && authorName.equals(requesterNickname));
        if (!isAdmin && !isAuthor) {
            throw new IllegalArgumentException("레시피 작성자 또는 관리자만 답글을 삭제할 수 있습니다.");
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> comments = (List<Map<String, Object>>) doc.get("comments");
        if (comments == null) return getRecipeById(recipeId);
        for (Map<String, Object> c : comments) {
            if (commentId.equals(c.get("id"))) {
                c.remove("reply");
                c.remove("replyAuthorNickname");
                c.remove("replyAuthorRole");
                c.remove("replyCreatedAt");
                break;
            }
        }
        ref.update("comments", comments).get();
        return getRecipeById(recipeId);
    }

    public RecipeDto deleteComment(String recipeId, String commentId) throws ExecutionException, InterruptedException {
        DocumentReference ref = findRecipeRef(recipeId);
        if (ref == null) return null;
        DocumentSnapshot doc = ref.get().get();
        if (!doc.exists()) return null;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> comments = (List<Map<String, Object>>) doc.get("comments");
        if (comments != null) {
            comments.removeIf(c -> commentId.equals(c.get("id")));
            ref.update("comments", comments).get();
        }
        return getRecipeById(recipeId);
    }

    public List<CategoryDto> getAllCategories() throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection("categories")
                .orderBy("order")
                .get();

        List<CategoryDto> categories = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            categories.add(CategoryDto.builder()
                    .id(doc.getId())
                    .name(doc.getString("name"))
                    .icon(doc.getString("icon"))
                    .color(doc.getString("color"))
                    .order(doc.getLong("order") != null ? doc.getLong("order").intValue() : 0)
                    .build());
        }
        return categories;
    }

    @SuppressWarnings("unchecked")
    private RecipeDto mapToRecipeDto(DocumentSnapshot doc) {
        List<Map<String, Object>> ingredientMaps = (List<Map<String, Object>>) doc.get("ingredients");
        List<RecipeDto.IngredientDto> ingredients = new ArrayList<>();
        if (ingredientMaps != null) {
            for (Map<String, Object> m : ingredientMaps) {
                ingredients.add(RecipeDto.IngredientDto.builder()
                        .name((String) m.get("name"))
                        .amount((String) m.get("amount"))
                        .icon((String) m.get("icon"))
                        .build());
            }
        }

        List<Map<String, Object>> stepMaps = (List<Map<String, Object>>) doc.get("steps");
        List<RecipeDto.StepDto> steps = new ArrayList<>();
        if (stepMaps != null) {
            for (Map<String, Object> m : stepMaps) {
                steps.add(RecipeDto.StepDto.builder()
                        .step(m.get("step") != null ? ((Number) m.get("step")).intValue() : 0)
                        .description((String) m.get("description"))
                        .time(m.get("time") != null ? ((Number) m.get("time")).doubleValue() : 0)
                        .imageUrl((String) m.get("imageUrl"))
                        .isAiImage((Boolean) m.get("isAiImage"))
                        .build());
            }
        }

        List<Map<String, Object>> commentMaps = (List<Map<String, Object>>) doc.get("comments");
        List<RecipeDto.CommentDto> comments = new ArrayList<>();
        if (commentMaps != null) {
            for (Map<String, Object> m : commentMaps) {
                comments.add(RecipeDto.CommentDto.builder()
                        .id((String) m.get("id"))
                        .uid((String) m.get("uid"))
                        .nickname((String) m.get("nickname"))
                        .text((String) m.get("text"))
                        .createdAt((String) m.get("createdAt"))
                        .profileImage((String) m.get("profileImage"))
                        .reply((String) m.get("reply"))
                        .replyAuthorNickname((String) m.get("replyAuthorNickname"))
                        .replyAuthorRole((String) m.get("replyAuthorRole"))
                        .replyCreatedAt((String) m.get("replyCreatedAt"))
                        .build());
            }
        }

        @SuppressWarnings("unchecked")
        List<String> tags = (List<String>) doc.get("tags");

        return RecipeDto.builder()
                .id(doc.getId())
                .title(doc.getString("title"))
                .author(doc.getString("author"))
                .time(doc.get("time") != null ? ((Number) doc.get("time")).doubleValue() : 0)
                .difficulty(doc.getString("difficulty"))
                .calories(doc.getLong("calories") != null ? doc.getLong("calories").intValue() : 0)
                .servings(doc.get("servings"))
                .rating(doc.getDouble("rating") != null ? doc.getDouble("rating") : 0.0)
                .likes(doc.getLong("likes") != null ? doc.getLong("likes").intValue() : 0)
                .image(doc.getString("image"))
                .category(doc.getString("category"))
                .description(doc.getString("description"))
                .ingredients(ingredients)
                .steps(steps)
                .comments(comments)
                .createdAt(doc.getString("createdAt"))
                .updatedAt(doc.getString("updatedAt"))
                .reviewCount(doc.getLong("reviewCount") != null ? doc.getLong("reviewCount").intValue() : 0)
                .reviewAvgRating(doc.getDouble("reviewAvgRating") != null ? doc.getDouble("reviewAvgRating") : 0.0)
                .tags(tags != null ? tags : new ArrayList<>())
                .build();
    }
}
