package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.auth.RateLimiter;
import com.devl.api.service.AttendanceService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final RateLimiter rateLimiter;

    @GetMapping("/status")
    public ResponseEntity<?> status(@RequestParam("uid") String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            return ResponseEntity.ok(attendanceService.getStatus(uid));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/check")
    public ResponseEntity<?> check(@RequestParam("uid") String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            // 유저당 1분에 5회 제한 (트랜잭션 외에도 방어선 추가)
            rateLimiter.check("attendance:" + uid, 5, 60_000);
            return ResponseEntity.ok(attendanceService.check(uid));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
