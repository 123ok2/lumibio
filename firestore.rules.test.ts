/**
 * Payload-First Security TDD Spec Runner for LumiBio Firestore Rules
 * Validates the 12 Dirty Dozen adversarial cases against DRAFT_firestore.rules / firestore.rules.
 * Run with @firebase/rules-unit-testing in an emulator environment.
 */

export const DIRTY_DOZEN_TEST_CASES = [
  {
    id: 1,
    name: 'Unauthenticated Bio Create',
    path: 'bios/hacked_bio',
    expected: 'PERMISSION_DENIED',
    auth: null,
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    path: 'users/userA',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email_verified: false },
  },
  {
    id: 3,
    name: 'Cross-User PII Read',
    path: 'users/userA',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userB', email_verified: true },
  },
  {
    id: 4,
    name: 'Identity Spoofing on Bio Create',
    path: 'bios/spoofed',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userB' },
  },
  {
    id: 5,
    name: 'Shadow Ghost Field Injection',
    path: 'bios/usera_bio',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email_verified: true },
    payload: { isVerifiedBadge: true },
  },
  {
    id: 6,
    name: 'Handle Mismatch / ID Poisoning',
    path: 'bios/abc',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email_verified: true },
    payload: { handle: 'xyz' },
  },
  {
    id: 7,
    name: 'Client Timestamp Forgery',
    path: 'bios/usera_bio',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 8,
    name: 'Immortal Field Mutation',
    path: 'bios/usera_bio',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userC' },
  },
  {
    id: 9,
    name: 'Unauthorized Bio Link Update',
    path: 'bios/usera_bio/links/link1',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userB', email_verified: true },
    payload: { title: 'Hacked Link' },
  },
  {
    id: 10,
    name: 'Click Counter Manipulation',
    path: 'bios/usera_bio/links/link1',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userB', email_verified: true },
    payload: { clicks: 999999 },
  },
  {
    id: 11,
    name: 'Unpublished Bio Scraping',
    path: 'bios',
    expected: 'PERMISSION_DENIED',
    auth: null,
  },
  {
    id: 12,
    name: 'Oversized / Unsafe Payload Exhaustion',
    path: 'bios/usera_bio',
    expected: 'PERMISSION_DENIED',
    auth: { uid: 'userA', email_verified: true },
    payload: { taglineLength: 10000, avatarUrl: 'data:image/svg+xml;base64,PHN2Zz4=' },
  },
] as const;
