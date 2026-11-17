# MoneyScope Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Ownership**: Every document in `/users/{userId}`, `/users/{userId}/private/{docId}`, `/accounts/{accountId}`, `/transactions/{transactionId}`, `/categories/{categoryId}`, `/budgets/{budgetId}`, `/food_logs/{foodLogId}`, and `/report_preferences/{userId}` MUST belong strictly to `request.auth.uid` and require `request.auth.token.email_verified == true`.
2. **PII Isolation**: User email, Telegram Chat ID, and WhatsApp Phone are isolated inside `/users/{userId}/private/{docId}` and never exposed in public profiles.
3. **Strict Key & Size Enforcement**: Every string is bounded by `maxLength`, every document ID is validated via `isValidId()`, and shadow keys are rejected via `.keys().hasAll(...)` and `.keys().hasOnly(...)`.
4. **Immutable Ownership & Creation Time**: `userId` and `createdAt` cannot be modified during updates, and timestamps must match `request.time`.
5. **Query Enforcer**: All `allow list` rules explicitly validate `resource.data.userId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads
1. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting to create a transaction.
2. **Identity Spoofing**: Creating a transaction where `userId` is `"victim-uid-123"` instead of `request.auth.uid`.
3. **Shadow Field Injection**: Updating a transaction with an undeclared field `"isAdmin": true`.
4. **ID Poisoning**: Creating a document with a 500-character ID or special characters `../admin`.
5. **Oversized String DoS**: Sending a 10,000-character `description` or `notes` payload to `/transactions/{id}`.
6. **Immutable Field Mutation**: Updating `createdAt` or `userId` on an existing transaction.
7. **Timestamp Forgery**: Creating a transaction with a past/future forged `createdAt` instead of `request.time`.
8. **Cross-Tenant PII Read**: Authenticated user reading `/users/otherUser/private/info`.
9. **Blanket List Scraping**: Listing `/transactions` or `/food_logs` without filtering `resource.data.userId == request.auth.uid`.
10. **Invalid Enum State**: Creating a transaction with `type: "crypto_hack"` outside `['income', 'expense', 'transfer']`.
11. **Unbounded Array Injection**: Creating a custom category with 50 subcategories exceeding the 20-item array cap.
12. **Value Type Poisoning**: Updating `amount` on `/transactions/{id}` with a string `"1000000"` instead of a number.
