package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.dto.FridgeItemDto;
import com.devl.api.dto.FridgeSettingsDto;
import com.devl.api.service.FridgeService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/fridge")
@RequiredArgsConstructor
public class FridgeController {

    private final FridgeService fridgeService;

    @GetMapping("/items")
    public ResponseEntity<?> list(@RequestParam("uid") String uid, HttpServletRequest req) {
        AuthContext.requireSelf(req, uid);
        try {
            return ResponseEntity.ok(fridgeService.list(uid));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/items")
    public ResponseEntity<?> add(@RequestParam("uid") String uid,
                                  @RequestBody FridgeItemDto body,
                                  HttpServletRequest req) {
        AuthContext.requireSelf(req, uid);
        try {
            return ResponseEntity.ok(fridgeService.add(uid, body));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/items/{id}")
    public ResponseEntity<?> update(@RequestParam("uid") String uid,
                                     @PathVariable("id") String id,
                                     @RequestBody FridgeItemDto body,
                                     HttpServletRequest req) {
        AuthContext.requireSelf(req, uid);
        try {
            return ResponseEntity.ok(fridgeService.update(uid, id, body));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<?> remove(@RequestParam("uid") String uid,
                                     @PathVariable("id") String id,
                                     HttpServletRequest req) {
        AuthContext.requireSelf(req, uid);
        try {
            fridgeService.remove(uid, id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/items")
    public ResponseEntity<?> clear(@RequestParam("uid") String uid, HttpServletRequest req) {
        AuthContext.requireSelf(req, uid);
        try {
            fridgeService.clear(uid);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/settings")
    public ResponseEntity<?> getSettings(@RequestParam("uid") String uid, HttpServletRequest req) {
        AuthContext.requireSelf(req, uid);
        try {
            FridgeSettingsDto settings = fridgeService.getSettings(uid);
            if (settings == null) return ResponseEntity.ok(Map.of());
            return ResponseEntity.ok(settings);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/settings")
    public ResponseEntity<?> saveSettings(@RequestParam("uid") String uid,
                                           @RequestBody FridgeSettingsDto body,
                                           HttpServletRequest req) {
        AuthContext.requireSelf(req, uid);
        try {
            return ResponseEntity.ok(fridgeService.saveSettings(uid, body));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
