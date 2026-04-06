package com.devl.api.controller;

import com.devl.api.dto.CommunityRecipeDto;
import com.devl.api.service.CommunityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityService communityService;

    @GetMapping
    public ResponseEntity<List<CommunityRecipeDto>> getAll() throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(communityService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CommunityRecipeDto> getById(@PathVariable String id) throws ExecutionException, InterruptedException {
        CommunityRecipeDto dto = communityService.getById(id);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    @PostMapping
    public ResponseEntity<CommunityRecipeDto> create(@RequestBody CommunityRecipeDto dto) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(communityService.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CommunityRecipeDto> update(@PathVariable String id, @RequestBody CommunityRecipeDto dto) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(communityService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) throws ExecutionException, InterruptedException {
        communityService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/rating")
    public ResponseEntity<CommunityRecipeDto> addRating(
            @PathVariable String id,
            @RequestBody Map<String, Object> body) throws ExecutionException, InterruptedException {
        String userId = (String) body.get("userId");
        double score = ((Number) body.get("score")).doubleValue();
        CommunityRecipeDto dto = communityService.addRating(id, userId, score);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<CommunityRecipeDto> like(@PathVariable String id) throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(communityService.like(id));
    }

    @DeleteMapping("/{id}/like")
    public ResponseEntity<CommunityRecipeDto> unlike(@PathVariable String id) throws ExecutionException, InterruptedException {
        CommunityRecipeDto dto = communityService.unlike(id);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }
}
