# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **PII Isolation**: `users/{userId}` holds user email addresses and may ONLY be read (`get`) and written by the authenticated, email-verified owner (`request.auth.uid == userId`). `list` queries on `/users` are strictly denied.
2. **No PII in Public Bios**: `bios/{handle}` and `bios/{handle}/links/{linkId}` contain zero personal email/phone PII fields. Public reads (`get`/`list`) are only permitted when `resource.data.isPublished == true` or when the requester is the `ownerId`.
3. **Identity & Immutability**: `ownerId`, `uid`, `handle`, `bioHandle`, and `createdAt` cannot be spoofed on creation or altered on update.
4. **Master Gate Sync**: Every write (`create`, `update`, `delete`) to `/bios/{handle}/links/{linkId}` verifies ownership via `get(/databases/$(database)/documents/bios/$(handle)).data.ownerId == request.auth.uid`, except the atomic 1-increment click counter action on published links.
5. **Temporal Integrity**: `createdAt` and `updatedAt` must strictly equal `request.time`.
6. **Verified Email Mandate**: All mutations require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Bio Create**: `uid: null` creating `/bios/hacked` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `email_verified: false` creating `/users/{uid}` -> `PERMISSION_DENIED`.
3. **Cross-User PII Read**: User B calling `get(/users/userA)` or `list(/users)` -> `PERMISSION_DENIED`.
4. **Identity Spoofing on Bio Create**: User A setting `ownerId: "userB"` -> `PERMISSION_DENIED`.
5. **Shadow Ghost Field Injection**: Creating `/bios/mybio` with extra key `isVerifiedBadge: true` -> `PERMISSION_DENIED`.
6. **Handle Mismatch / ID Poisoning**: Creating `/bios/abc` with `handle: "xyz"` or a 200-char handle ID -> `PERMISSION_DENIED`.
7. **Client Timestamp Forgery**: Creating `/bios/mybio` with `createdAt` in the past instead of `request.time` -> `PERMISSION_DENIED`.
8. **Immortal Field Mutation**: Updating `ownerId` or `createdAt` on an existing `/bios/mybio` -> `PERMISSION_DENIED`.
9. **Unauthorized Bio Update**: User B trying to update `displayName` or `links` on User A's Bio -> `PERMISSION_DENIED`.
10. **Click Counter Manipulation**: Setting `clicks: 999999` instead of `existing().clicks + 1` -> `PERMISSION_DENIED`.
11. **Unpublished Bio Scraping**: Unauthenticated user listing `/bios` without `isPublished == true` -> `PERMISSION_DENIED`.
12. **Oversized / Unsafe Payload Exhaustion**: Injecting a 10KB string into `tagline` (>180 chars), `socials.tiktok` (>200 chars), >120KB image payload, or `data:image/svg+xml` into `avatarUrl` -> `PERMISSION_DENIED`.
