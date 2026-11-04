# CanCulator documentation

Index of the app's features and architecture decisions (ADRs). The user guide is in the [README](../README.md); the manual phone tests are in [mobile-checklist.md](mobile-checklist.md).

## Features

1. [Stock](features/01-stock.md)
2. [Expiry](features/02-expiry.md)
3. [Restock](features/03-restock.md)
4. [Print](features/04-print.md)
5. [Statistics](features/05-statistics.md)
6. [Adding lots and the scanner](features/06-adding-lots-and-scanner.md)
7. [Open Food Facts](features/07-open-food-facts.md)
8. [Photos](features/08-photos.md)
9. [Settings: categories and locations](features/09-settings-categories-and-locations.md)
10. [Phone sync](features/10-phone-sync.md)
11. [Backup and reset](features/11-backup-and-reset.md)
12. [Language](features/12-language.md)
13. [Installable app and offline use](features/13-offline-pwa.md)
14. [Weight, volume and price](features/14-weight-volume-and-price.md)

## Architecture decisions (ADR)

The decisions were reconstructed in October 2026 from the commit history, `CLAUDE.md` and the code, because the project had no ADR log before. Each one records its status and, where relevant, the commit that introduced it.

| ADR | Decision | Status |
| :--- | :--- | :--- |
| [0001](adr/0001-static-web-app-no-build-step.md) | Static web app with no build step | Accepted |
| [0002](adr/0002-data-in-indexeddb-on-device.md) | Data in IndexedDB, on the device | Accepted |
| [0003](adr/0003-personal-data-outside-the-repo.md) | Personal data outside the repository | Accepted |
| [0004](adr/0004-p2p-sync-webrtc.md) | Direct sync between phones over WebRTC (PeerJS) | Accepted |
| [0005](adr/0005-no-apps-script-or-spreadsheet.md) | No Apps Script or spreadsheet as sync server | Accepted |
| [0006](adr/0006-conflicts-latest-change-wins.md) | Conflicts: the latest change wins | Accepted |
| [0007](adr/0007-service-worker-network-first.md) | Service worker with network first and a cache fallback | Accepted |
| [0008](adr/0008-open-food-facts-local-cache.md) | Open Food Facts with a local cache and failure tolerance | Accepted |
| [0009](adr/0009-language-per-device-localstorage.md) | Language per device, stored in localStorage | Accepted |
| [0010](adr/0010-tdd-and-one-branch-per-change.md) | TDD and one branch per change | Accepted |
| [0011](adr/0011-github-pages-deploy-from-ci.md) | Deployment to GitHub Pages from CI | Accepted |
| [0012](adr/0012-reset-with-sum-confirmation.md) | App reset with a prior copy and sum confirmation | Accepted |
| [0013](adr/0013-photos-compressed-in-browser.md) | Photos compressed in the browser | Accepted |
| [0014](adr/0014-volume-in-ml-for-drinks-and-sauces.md) | Volume in ml for drinks, tomato, sauces and oils | Accepted |

To add an ADR: use the next number, `NNNN-kebab-case-title.md`, with the sections Status, Context, Decision and Consequences, and add a new link to this table. `tests/unit/docs-features-adr.test.js` checks the structure.
