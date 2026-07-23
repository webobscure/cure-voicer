# Update security and rollout policy

Automatic update installation is automatically disabled in an unsigned build.
`SignedUpdateService` first verifies the current `.app` with `codesign` or the
Windows executable with `Get-AuthenticodeSignature`; it never contacts the feed
unless that check succeeds. Signed builds honor the user's update switch.

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

Update checks expose a user-visible disable switch and use no dictated text,
clipboard data or application identity. Until an updater implementation has tests
for partial download and migration rollback are complete, releases should remain
prerelease-only. Feed coordinates are build-time GitHub configuration and cannot
be supplied by a renderer.
