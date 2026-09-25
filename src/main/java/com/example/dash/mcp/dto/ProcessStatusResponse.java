package com.example.dash.mcp.dto;

import com.example.dash.process.*;
import java.util.List;

public record ProcessStatusResponse(
    List<ProcessSnapshot> processes, List<Workspace> workspaces, long cursor) {}
