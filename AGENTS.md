# Project guidance

## Supported platforms

- Hit or Quit ships as a website for desktop/mobile browsers and a native iOS app for **iPhone and iPad**. Preserve feature parity and test responsive layouts, portrait/landscape, native storage and app lifecycle behavior. Android tooling exists, but an Android store release is not currently a supported release target.
- Frontend code is in `hoq-fe/`; the authoritative multiplayer backend is in `hoq-be/`. Solo must remain playable without the backend.
- Guard browser-only APIs by platform. Website storage uses localStorage; native iOS uses AsyncStorage. Session recovery must query the authoritative server state.
- Maintain backend compatibility with installed iOS clients when changing the multiplayer protocol. Web and App Store updates do not reach players simultaneously.

## Versions and iOS releases

- Current configured frontend version: **1.0.0**, iOS build **1**. This is source configuration, not a claim of App Store publication.
- Permanent bundle identifier: `com.jacobconklin.hitorquit`. Keep `expo.ios.supportsTablet: true`.
- `hoq-fe/app.json` is the native configuration source of truth. Keep `expo.version`, `hoq-fe/package.json` version, and the current-release documentation synchronized. Backend package versioning is independent.
- Follow the complete **iOS release checklist** and update the release record in `hoq-fe/README.md` for each release. Increment the iOS build number for every subsequent upload; bump the public version for a new public release. Update the version/build in this file too.
- Run `npm run prebuild:ios` in `hoq-fe` on macOS to generate/update the ignored `ios/` directory, then open its `.xcworkspace` in Xcode. Persist native customizations in Expo config/plugins. Clean prebuild deletes generated native changes.
- Native signing, archives, iPhone/iPad runtime testing, and App Store upload require the Mac/Apple toolchain. Never report them as completed from web exports or TypeScript checks alone.
- Website deployment uses `_DEPLOY.md`; it does not publish a native iOS update. There is no configured OTA native update workflow.
- Keep Apple signing credentials, private keys and account secrets out of source control. Select the developer team in Xcode rather than inventing a team identifier.

## Validation

- Frontend: `npm run typecheck`, `npm test`, and `npm run build:web` from `hoq-fe` as appropriate to changes.
- Backend/shared gameplay: `npm test` from `hoq-be`; integration tests need localhost WebSocket access.
- iOS release: follow the README's iPhone/iPad device and TestFlight checks. Document actual results and unresolved release requirements.
