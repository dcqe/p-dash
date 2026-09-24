package com.example.dash.process;

import java.util.List;

public record ProcessGroup(String id, String name, List<String> processIds) {}
