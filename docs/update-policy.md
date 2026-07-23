# Update security and rollout policy

Automatic update installation is intentionally disabled in the current unsigned
beta. A release may enable it only after all conditions below are met.

## Trust requirements

- macOS DMG/ZIP and every nested executable are Developer ID signed and the app
  is notarized/stapled.
- Windows NSIS/portable artifacts are Authenticode-signed with the pinned Cure
  Voicer publisher identity.
- Update metadata is produced by the same protected GitHub release workflow;
  renderer code cannot provide a feed URL.
- The updater rejects downgrades and a package whose platform signature or
  expected publisher does not validate.
- Secrets used for signing/notarization exist only in protected CI secrets.

## Rollout

1. Publish to an internal channel and run the manual macOS/Windows matrix.
2. Release to 10% of opted-in clients for at least 24 hours.
3. Increase to 50%, then 100%, only while crash, launch and migration health stay
   within the release threshold.
4. Never roll back by serving a lower version. Publish a new signed patch that
   reverses the faulty change and preserves forward-only SQLite migrations.

Update checks must expose a user-visible disable switch and use no dictated text,
clipboard data or application identity. Until an updater implementation has tests
for signature failure, partial download, offline startup, migration failure and
rollback, `publish` remains disabled in `electron-builder.yml`.
