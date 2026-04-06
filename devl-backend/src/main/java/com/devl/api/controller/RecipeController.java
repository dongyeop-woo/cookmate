package com.devl.api.controller;

import com.devl.api.dto.CategoryDto;
import com.devl.api.dto.RecipeDto;
import com.devl.api.service.RecipeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
public class RecipeController {

    private final RecipeService recipeService;

    @GetMapping
    public ResponseEntity<List<RecipeDto>> getAll() throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.getAllRecipes());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecipeDto> getById(@PathVariable String id) throws ExecutionException, InterruptedException {
        RecipeDto dto = recipeService.getRecipeById(id);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<List<RecipeDto>> getByCategory(@PathVariable String category) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.getRecipesByCategory(category));
    }

    @GetMapping("/top")
    public ResponseEntity<List<RecipeDto>> getTop(@RequestParam(defaultValue = "10") int limit) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.getTopRecipes(limit));
    }

    @GetMapping("/quick")
    public ResponseEntity<List<RecipeDto>> getQuick(@RequestParam(defaultValue = "15") int maxMinutes) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.getQuickRecipes(maxMinutes));
    }

    @PostMapping
    public ResponseEntity<RecipeDto> create(@RequestBody RecipeDto dto) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.createRecipe(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RecipeDto> update(@PathVariable String id, @RequestBody RecipeDto dto) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.updateRecipe(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) throws ExecutionException, InterruptedException {
        recipeService.deleteRecipe(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/categories")
    public ResponseEntity<List<CategoryDto>> getCategories() throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(recipeService.getAllCategories());
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<RecipeDto> addComment(@PathVariable String id, @RequestBody Map<String, String> body)
            throws ExecutionException, InterruptedException {
        RecipeDto.CommentDto comment = RecipeDto.CommentDto.builder()
                .uid(body.get("uid"))
                .nickname(body.get("nickname"))
                .text(body.get("text"))
                .profileImage(body.get("profileImage"))
                .build();
        RecipeDto dto = recipeService.addComment(id, comment);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}/comments/{commentId}")
    public ResponseEntity<RecipeDto> deleteComment(@PathVariable String id, @PathVariable String commentId)
            throws ExecutionException, InterruptedException {
        RecipeDto dto = recipeService.deleteComment(id, commentId);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }
}
