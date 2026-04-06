package com.devl.api.controller;

import com.google.firebase.cloud.StorageClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    @Value("${firebase.storage-bucket}")
    private String storageBucket;

    @PostMapping("/profile-image")
    public ResponseEntity<Map<String, String>> uploadProfileImage(
            @RequestParam("uid") String uid,
            @RequestParam("file") MultipartFile file) throws IOException {

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "이미지 파일만 업로드 가능합니다."));
        }

        String ext = "jpg";
        if (contentType.equals("image/png")) ext = "png";
        else if (contentType.equals("image/webp")) ext = "webp";

        String fileName = "profileImages/" + uid + "." + ext;

        var bucket = StorageClient.getInstance().bucket(storageBucket);
        bucket.create(fileName, file.getInputStream(), contentType);

        String downloadUrl = String.format(
                "https://firebasestorage.googleapis.com/v0/b/%s/o/%s?alt=media",
                storageBucket,
                URLEncoder.encode(fileName, StandardCharsets.UTF_8)
        );

        return ResponseEntity.ok(Map.of("url", downloadUrl));
    }
}
