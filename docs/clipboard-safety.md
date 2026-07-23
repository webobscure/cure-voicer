# Clipboard safety

The clipboard is not monitored continuously and is not used by the default
insertion mode. `ClipboardTransactionManager` is used only for
`clipboard-safe`.

For one serialized transaction it:

1. snapshots every format exposed by Electron as raw bytes;
2. writes the temporary dictation text;
3. fingerprints the complete temporary clipboard;
4. waits for clipboard hooks to settle;
5. verifies ownership before sending paste;
6. waits for the destination to consume paste;
7. verifies ownership again;
8. restores every prior format only if the temporary fingerprint is unchanged.

If Punto Switcher, a clipboard manager, or the user changes the clipboard at
either ownership check, Cure Voicer does not overwrite that newer content. A
change before paste blocks the paste. A change after paste keeps the new
clipboard and reports that restoration was skipped.

Transactions share a FIFO mutex, so two dictations cannot interleave snapshots
or restoration. On failure or cancellation, owned temporary contents are
restored. If paste was already sent, restoration still observes the configured
consumption delay.

Tests cover multiple formats, Punto/manager mutation before paste, user copy
after paste, paste failure, and two consecutive operations. Clipboard bytes and
dictated text are absent from logs.

