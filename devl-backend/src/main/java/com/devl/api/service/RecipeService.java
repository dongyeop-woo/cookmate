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

    private final Firestore firestore;

    public List<RecipeDto> getAllRecipes() throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection("recipes").get();
        List<QueryDocumentSnapshot> documents = future.get().getDocuments();

        List<RecipeDto> recipes = new ArrayList<>();
        for (QueryDocumentSnapshot doc : documents) {
            recipes.add(mapToRecipeDto(doc));
        }
        return recipes;
    }

    public RecipeDto getRecipeById(String id) throws ExecutionException, InterruptedException {
        DocumentSnapshot doc = firestore.collection("recipes").document(id).get().get();
        if (!doc.exists()) {
            return null;
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
        firestore.collection("recipes").document(id).set(dto, SetOptions.merge()).get();
        return dto;
    }

    public void deleteRecipe(String id) throws ExecutionException, InterruptedException {
        firestore.collection("recipes").document(id).delete().get();
    }

    public RecipeDto addComment(String recipeId, RecipeDto.CommentDto comment) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection("recipes").document(recipeId);
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
        return getRecipeById(recipeId);
    }

    public RecipeDto deleteComment(String recipeId, String commentId) throws ExecutionException, InterruptedException {
        DocumentSnapshot doc = firestore.collection("recipes").document(recipeId).get().get();
        if (!doc.exists()) return null;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> comments = (List<Map<String, Object>>) doc.get("comments");
        if (comments != null) {
            comments.removeIf(c -> commentId.equals(c.get("id")));
            firestore.collection("recipes").document(recipeId).update("comments", comments).get();
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
                        .time(m.get("time") != null ? ((Number) m.get("time")).intValue() : 0)
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
                        .build());
            }
        }

        return RecipeDto.builder()
                .id(doc.getId())
                .title(doc.getString("title"))
                .author(doc.getString("author"))
                .time(doc.getLong("time") != null ? doc.getLong("time").intValue() : 0)
                .difficulty(doc.getString("difficulty"))
                .calories(doc.getLong("calories") != null ? doc.getLong("calories").intValue() : 0)
                .rating(doc.getDouble("rating") != null ? doc.getDouble("rating") : 0.0)
                .likes(doc.getLong("likes") != null ? doc.getLong("likes").intValue() : 0)
                .bookmarks(doc.getLong("bookmarks") != null ? doc.getLong("bookmarks").intValue() : 0)
                .image(doc.getString("image"))
                .category(doc.getString("category"))
                .description(doc.getString("description"))
                .ingredients(ingredients)
                .steps(steps)
                .comments(comments)
                .createdAt(doc.getString("createdAt"))
                .updatedAt(doc.getString("updatedAt"))
                .build();
    }
}
