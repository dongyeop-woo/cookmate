package com.devl.api.service;

import com.devl.api.dto.UserDto;
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
public class UserService {

    private final Firestore firestore;
    private static final String COLLECTION = "users";
    private static final String RECIPES_COLLECTION = "recipes";

    public UserDto getByUid(String uid) throws ExecutionException, InterruptedException {
        DocumentSnapshot doc = firestore.collection(COLLECTION).document(uid).get().get();
        if (!doc.exists()) return null;
        return doc.toObject(UserDto.class);
    }

    public UserDto create(UserDto dto) throws ExecutionException, InterruptedException {
        dto.initDefaults();
        dto.setRecipeCount(0);
        dto.setTotalLikes(0);
        if (dto.getRole() == null) dto.setRole("user");
        dto.setCreatedAt(Instant.now().toString());
        dto.setUpdatedAt(Instant.now().toString());
        firestore.collection(COLLECTION).document(dto.getUid()).set(dto).get();
        return dto;
    }

    public UserDto update(String uid, UserDto dto) throws ExecutionException, InterruptedException {
        Map<String, Object> updates = new HashMap<>();
        if (dto.getNickname() != null) updates.put("nickname", dto.getNickname());
        if (dto.getBio() != null) updates.put("bio", dto.getBio());
        if (dto.getProfileImage() != null) updates.put("profileImage", dto.getProfileImage());
        if (dto.getGender() != null) updates.put("gender", dto.getGender());
        if (dto.getEmail() != null) updates.put("email", dto.getEmail());
        if (dto.getPhone() != null) updates.put("phone", dto.getPhone());
        updates.put("updatedAt", Instant.now().toString());
        firestore.collection(COLLECTION).document(uid).update(updates).get();
        return getByUid(uid);
    }

    public void follow(String uid, String targetUid) throws ExecutionException, InterruptedException {
        DocumentReference myRef = firestore.collection(COLLECTION).document(uid);
        DocumentReference targetRef = firestore.collection(COLLECTION).document(targetUid);

        myRef.update("following", FieldValue.arrayUnion(targetUid)).get();
        targetRef.update("followers", FieldValue.arrayUnion(uid)).get();
    }

    public void unfollow(String uid, String targetUid) throws ExecutionException, InterruptedException {
        DocumentReference myRef = firestore.collection(COLLECTION).document(uid);
        DocumentReference targetRef = firestore.collection(COLLECTION).document(targetUid);

        myRef.update("following", FieldValue.arrayRemove(targetUid)).get();
        targetRef.update("followers", FieldValue.arrayRemove(uid)).get();
    }

    public void likeRecipe(String uid, String recipeId) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(uid)
                .update("likedRecipes", FieldValue.arrayUnion(recipeId)).get();
        // Find recipe in 'recipes' or 'community' collection
        DocumentReference recipeRef = findRecipeRef(recipeId);
        if (recipeRef != null) {
            firestore.runTransaction(transaction -> {
                DocumentSnapshot snap = transaction.get(recipeRef).get();
                long current = snap.getLong("likes") != null ? snap.getLong("likes") : 0;
                transaction.update(recipeRef, "likes", current + 1);
                return null;
            }).get();
            updateAuthorTotalLikes(recipeRef, 1);
        }
    }

    public void unlikeRecipe(String uid, String recipeId) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(uid)
                .update("likedRecipes", FieldValue.arrayRemove(recipeId)).get();
        DocumentReference recipeRef = findRecipeRef(recipeId);
        if (recipeRef != null) {
            firestore.runTransaction(transaction -> {
                DocumentSnapshot snap = transaction.get(recipeRef).get();
                long current = snap.getLong("likes") != null ? snap.getLong("likes") : 0;
                transaction.update(recipeRef, "likes", Math.max(0, current - 1));
                return null;
            }).get();
            updateAuthorTotalLikes(recipeRef, -1);
        }
    }

    private DocumentReference findRecipeRef(String recipeId) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(RECIPES_COLLECTION).document(recipeId);
        if (ref.get().get().exists()) return ref;
        DocumentReference communityRef = firestore.collection("community").document(recipeId);
        if (communityRef.get().get().exists()) return communityRef;
        return null;
    }

    private void updateAuthorTotalLikes(DocumentReference recipeRef, int delta) {
        try {
            DocumentSnapshot snap = recipeRef.get().get();
            if (!snap.exists()) return;
            // Try authorUid first (community recipes)
            String authorUid = snap.getString("authorUid");
            if (authorUid != null && !authorUid.isEmpty()) {
                firestore.collection(COLLECTION).document(authorUid)
                        .update("totalLikes", FieldValue.increment(delta)).get();
                return;
            }
            // Fallback: find user by author nickname
            String author = snap.getString("author");
            if (author != null && !author.isEmpty()) {
                QuerySnapshot users = firestore.collection(COLLECTION)
                        .whereEqualTo("nickname", author).limit(1).get().get();
                if (!users.isEmpty()) {
                    users.getDocuments().get(0).getReference()
                            .update("totalLikes", FieldValue.increment(delta)).get();
                }
            }
        } catch (Exception e) {
            log.warn("Failed to update author totalLikes: {}", e.getMessage());
        }
    }

    public void bookmarkRecipe(String uid, String recipeId) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(uid)
                .update("bookmarkedRecipes", FieldValue.arrayUnion(recipeId)).get();
        DocumentReference recipeRef = firestore.collection(RECIPES_COLLECTION).document(recipeId);
        firestore.runTransaction(transaction -> {
            DocumentSnapshot snap = transaction.get(recipeRef).get();
            long current = snap.getLong("bookmarks") != null ? snap.getLong("bookmarks") : 0;
            transaction.update(recipeRef, "bookmarks", current + 1);
            return null;
        }).get();
    }

    public void unbookmarkRecipe(String uid, String recipeId) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(uid)
                .update("bookmarkedRecipes", FieldValue.arrayRemove(recipeId)).get();
        DocumentReference recipeRef = firestore.collection(RECIPES_COLLECTION).document(recipeId);
        firestore.runTransaction(transaction -> {
            DocumentSnapshot snap = transaction.get(recipeRef).get();
            long current = snap.getLong("bookmarks") != null ? snap.getLong("bookmarks") : 0;
            transaction.update(recipeRef, "bookmarks", Math.max(0, current - 1));
            return null;
        }).get();
    }

    public boolean isNicknameTaken(String nickname) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("nickname", nickname)
                .limit(1)
                .get();
        return !future.get().getDocuments().isEmpty();
    }

    public UserDto getByEmail(String email) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("email", email)
                .limit(1)
                .get();
        List<QueryDocumentSnapshot> docs = future.get().getDocuments();
        if (docs.isEmpty()) return null;
        return docs.get(0).toObject(UserDto.class);
    }

    public UserDto getByPhone(String phone) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("phone", phone)
                .limit(1)
                .get();
        List<QueryDocumentSnapshot> docs = future.get().getDocuments();
        if (docs.isEmpty()) return null;
        return docs.get(0).toObject(UserDto.class);
    }

    public List<UserDto> getTopUsers(int limit) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION).get();
        List<UserDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            UserDto u = doc.toObject(UserDto.class);
            u.initDefaults();
            list.add(u);
        }
        list.sort((a, b) -> {
            boolean aAdmin = "admin".equals(a.getRole());
            boolean bAdmin = "admin".equals(b.getRole());
            if (aAdmin != bAdmin) return aAdmin ? -1 : 1;
            return Integer.compare(
                    b.getFollowers() != null ? b.getFollowers().size() : 0,
                    a.getFollowers() != null ? a.getFollowers().size() : 0);
        });
        return list.stream().limit(limit).toList();
    }

    public void deleteUser(String uid) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(uid).delete().get();
    }

    public void updatePushToken(String uid, String pushToken) throws ExecutionException, InterruptedException {
        Map<String, Object> updates = new HashMap<>();
        updates.put("pushToken", pushToken != null ? pushToken : "");
        updates.put("updatedAt", Instant.now().toString());
        firestore.collection(COLLECTION).document(uid).update(updates).get();
    }

    public UserDto updateRole(String uid, String role) throws ExecutionException, InterruptedException {
        Map<String, Object> updates = new HashMap<>();
        updates.put("role", role);
        updates.put("updatedAt", Instant.now().toString());
        firestore.collection(COLLECTION).document(uid).update(updates).get();
        return getByUid(uid);
    }
}
