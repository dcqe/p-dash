package com.example.dash.mcp.dto;

public record WaitForLogRequest(String processId, String regex, long afterCursor, int timeoutMs) {}
