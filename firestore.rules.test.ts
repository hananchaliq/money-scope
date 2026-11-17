import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync('./firestore.rules', 'utf8');

test('Firestore security rules enforce Eight Pillars and block Dirty Dozen vectors', () => {
  // 1. Default deny catch-all
  assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'), 'Must include global default-deny');

  // 2. Email verification requirement
  assert.ok(rules.includes('request.auth.token.email_verified == true'), 'Must require email_verified == true');

  // 3. Path variable hardening
  assert.ok(rules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"), 'Must validate document IDs with regex');

  // 4. Master Gate on subcollection /users/{userId}/private/{docId}
  assert.ok(
    rules.includes('get(/databases/$(database)/documents/users/$(userId)).data.userId == request.auth.uid'),
    'Must enforce Master Gate parent lookup on private PII subcollection'
  );

  // 5. Query Enforcer on list operations
  assert.ok(rules.includes('allow list: if isSignedIn() && existing().userId == request.auth.uid;'), 'Must enforce owner filter on list queries');

  // 6. Strict key validation & affectedKeys().hasOnly()
  assert.ok(rules.includes('data.keys().hasAll(') && rules.includes('data.keys().hasOnly('), 'Must enforce strict key allowlists');
  assert.ok(rules.includes('incoming().diff(existing()).affectedKeys().hasOnly('), 'Must enforce partial update affectedKeys allowlists');

  // 7. Temporal integrity with request.time
  assert.ok(rules.includes('incoming().createdAt == request.time'), 'Must enforce server timestamp on creation');
  assert.ok(rules.includes('incoming().updatedAt == request.time'), 'Must enforce server timestamp on update');
});
