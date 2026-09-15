---
name: make-bot-ui
description: "Build a small local UI that sends structured events to an existing authorized bot webhook. Use for make bot UI, a local bot control page, or buttons for a configured webhook."
disable-model-invocation: true
---

# Make a bot UI

Build a page the user clicks. A local server forwards a validated JSON event to the user's configured webhook. Keep credentials on the server. This portable skill does not provide a bot service, scheduler, secret-entry widget, or remote network.

## Establish the receiver

Find the webhook contract in the project or from information the user supplied. Record the endpoint, accepted event fields, authentication scheme, expected response, and how completion is observed. Use an existing receiver when available. If a connected service exposes routine creation and the user has authorized creating one, use that service's documented API and verify the resulting endpoint. Do not assume Cursor's `update_state` API, Routines panel, or `[routine]` event format exists.

If no receiver is available, implement and exercise a local mock receiver alongside the UI. Mark the external connection as unconfigured, name the missing endpoint/auth contract, and leave a working local demonstration. Do not claim that a bot woke or that an external task completed.

## Keep the credential local

Use the project's secret manager or a server-only environment variable. When the user must enter a key, provide the local configuration location or secure secret-entry mechanism actually available in the host. Do not request the key in chat. Do not put credentials in browser code, URLs, committed files, logs, screenshots, or the generated skill.

Use an untracked configuration file only when appropriate for the project and restrict its access. The UI calls the local server; the server adds the upstream authentication header. Log event IDs and safe status information, not secrets or complete sensitive payloads.

## Build the page and server

1. Follow the project's existing framework and launch conventions. For a new local tool, choose a small server with a same-origin page.
2. Bind to loopback by default. Use a fixed configured upstream endpoint rather than accepting arbitrary destinations from the browser. Protect mutation routes against cross-origin requests and validate event fields on the server.
3. Give each button a concrete action and show sending, accepted, completed, or failed states based on evidence from the receiver. HTTP acceptance is not proof that the downstream task finished.
4. Include a correlation ID in the event when the receiver supports one. Show its receipt or status link when available.
5. Add durable retry storage only when the task needs it. Define duplicate handling and the receiver's idempotency contract before automatic retries. Do not replay a mutation blindly after an ambiguous timeout.

## Verify and hand over

Run the page and local server, click one action, inspect the event at the receiver, and verify the visible result. Exercise an invalid event, an upstream failure, and a missing credential. Confirm credentials stay server-side and failure messages do not expose them. Use a mock receiver for side effects outside the authorized task; label that result clearly.

Return the local URL, launch/stop commands, configuration location, actual verification result, and any unresolved external integration. Stop only processes created for temporary verification. Leave an intentionally running tool with its process ownership and stop command recorded.

## Optional remote access

Use an existing authorized tunnel or network only when the task includes access from another device. Do not assume a shared Tailscale node, install a VPN, or expose the server publicly merely to build a local page. Authenticate the control surface and verify the actual reachable URL before sharing it.
