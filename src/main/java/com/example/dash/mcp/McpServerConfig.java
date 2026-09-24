package com.example.dash.mcp;

/**
 * Transport configuration lives in application.properties. Tools inject domain services directly.
 * LocalRequestFilter protects /mcp with the same bearer token used by REST. No stdio proxy, Node
 * server, or second process registry exists.
 */
public final class McpServerConfig {
  public static final String ROOT_PATH = "/mcp";

  private McpServerConfig() {}
}
