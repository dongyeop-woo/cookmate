package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FridgeSettingsDto {
    private Integer urgentDays;
    private Integer soonDays;
    /** keys: urgent, soon, ok, expired — hex color strings */
    private Map<String, String> colors;
}
