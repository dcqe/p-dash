package com.example.dash.mcp.dto;

import java.util.Set;

public record GetLogsRequest(Set<String> processIds, long afterCursor, int limit, boolean plain) {}
