package com.devl.api.controller;

import com.devl.api.dto.UserDto;
import com.devl.api.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    public ResponseEntity<UserDto> createUser(@RequestBody UserDto dto)
            throws ExecutionException, InterruptedException {
        UserDto existing = userService.getByUid(dto.getUid());
        if (existing != null) {
            return ResponseEntity.ok(existing);
        }
        return ResponseEntity.ok(userService.create(dto));
    }

    @GetMapping("/{uid}")
    public ResponseEntity<UserDto> getUser(@PathVariable String uid)
            throws ExecutionException, InterruptedException {
        UserDto user = userService.getByUid(uid);
        if (user == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(user);
    }

    @PutMapping("/{uid}")
    public ResponseEntity<UserDto> updateUser(@PathVariable String uid, @RequestBody UserDto dto)
            throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(userService.update(uid, dto));
    }

    @PostMapping("/{uid}/follow/{targetUid}")
    public ResponseEntity<Void> follow(@PathVariable String uid, @PathVariable String targetUid)
            throws ExecutionException, InterruptedException {
        userService.follow(uid, targetUid);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{uid}/follow/{targetUid}")
    public ResponseEntity<Void> unfollow(@PathVariable String uid, @PathVariable String targetUid)
            throws ExecutionException, InterruptedException {
        userService.unfollow(uid, targetUid);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{uid}/like/{recipeId}")
    public ResponseEntity<Void> likeRecipe(@PathVariable String uid, @PathVariable String recipeId)
            throws ExecutionException, InterruptedException {
        userService.likeRecipe(uid, recipeId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{uid}/like/{recipeId}")
    public ResponseEntity<Void> unlikeRecipe(@PathVariable String uid, @PathVariable String recipeId)
            throws ExecutionException, InterruptedException {
        userService.unlikeRecipe(uid, recipeId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{uid}/bookmark/{recipeId}")
    public ResponseEntity<Void> bookmarkRecipe(@PathVariable String uid, @PathVariable String recipeId)
            throws ExecutionException, InterruptedException {
        userService.bookmarkRecipe(uid, recipeId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{uid}/bookmark/{recipeId}")
    public ResponseEntity<Void> unbookmarkRecipe(@PathVariable String uid, @PathVariable String recipeId)
            throws ExecutionException, InterruptedException {
        userService.unbookmarkRecipe(uid, recipeId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/nickname-check")
    public ResponseEntity<Map<String, Boolean>> checkNickname(@RequestParam String nickname)
            throws ExecutionException, InterruptedException {
        boolean taken = userService.isNicknameTaken(nickname);
        return ResponseEntity.ok(Map.of("available", !taken));
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<UserDto> getByEmail(@PathVariable String email)
            throws ExecutionException, InterruptedException {
        UserDto user = userService.getByEmail(email);
        if (user == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(user);
    }

    @GetMapping("/phone/{phone}")
    public ResponseEntity<UserDto> getByPhone(@PathVariable String phone)
            throws ExecutionException, InterruptedException {
        UserDto user = userService.getByPhone(phone);
        if (user == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(user);
    }

    @GetMapping("/top")
    public ResponseEntity<List<UserDto>> getTopUsers(@RequestParam(defaultValue = "20") int limit)
            throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(userService.getTopUsers(limit));
    }

    @DeleteMapping("/{uid}")
    public ResponseEntity<Void> deleteUser(@PathVariable String uid)
            throws ExecutionException, InterruptedException {
        userService.deleteUser(uid);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{uid}/push-token")
    public ResponseEntity<Void> updatePushToken(@PathVariable String uid, @RequestBody Map<String, String> body)
            throws ExecutionException, InterruptedException {
        String pushToken = body.get("pushToken");
        userService.updatePushToken(uid, pushToken);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{uid}/role")
    public ResponseEntity<UserDto> updateRole(@PathVariable String uid, @RequestBody Map<String, String> body)
            throws ExecutionException, InterruptedException {
        String role = body.get("role");
        if (role == null || (!role.equals("admin") && !role.equals("user"))) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(userService.updateRole(uid, role));
    }
}
