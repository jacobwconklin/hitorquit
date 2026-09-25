Yes, React Native is a solid fit for this — it's actually one of the more common cross-platform patterns now, especially with Expo. Here's the breakdown.

Why it works

React Native compiles to native iOS/Android, but the same codebase can target web via React Native Web (RNW), which maps RN primitives (View, Text, Pressable, etc.) to DOM elements. Expo has this built in, so you get iOS + web from one codebase without maintaining a parallel React app.

The main constraint: stick to components/APIs that have web equivalents. Anything using native-only modules (certain camera/AR features, native navigation transitions, some third-party native SDKs) needs a Platform.select() or .web.tsx / .ios.tsx file split.

Recommended stack
Expo (managed workflow) — handles the iOS build pipeline (EAS Build) and web bundling in one config
Expo Router — file-based routing that works across web and native, avoids you having to hand-roll two navigation stacks
NativeWind or a cross-platform styling lib if you want Tailwind-style utility classes that work on both targets
Setup steps
npx create-expo-app@latest myapp — scaffolds with Expo Router by default
Add web support: npx expo install react-native-web react-dom (usually already included in new Expo projects)
Build for web: npx expo export -p web → outputs static files to dist/
Build for iOS: eas build --platform ios (requires an Apple Developer account, which you already have from Techno Holdem)
Test locally: npx expo start --web for web dev server, npx expo start + Expo Go / simulator for iOS
Keeping both exports always viable
Avoid native-only APIs by default — check Expo's platform compatibility table before adding a package; prefer libraries explicitly marked "web-compatible"
Isolate platform-specific code with file extensions (Component.ios.tsx, Component.web.tsx) rather than sprinkling Platform.OS checks everywhere — keeps the divergence contained and easy to audit
CI check: add a script/CI step that runs both expo export -p web and a native prebuild check on every commit so a native-breaking or web-breaking change gets caught immediately, not at release time
Env-based config for anything that differs (API base URLs, deep link schemes) rather than hardcoding
S3 deployment

Since you've already got the AWS pattern down (S3 + CloudFront + Route 53 from your earlier static hosting work): expo export -p web output is just static HTML/JS/CSS, so it drops into the same S3 + CloudFront setup — enable SPA routing (redirect 404s to index.html in the CloudFront error pages, since Expo Router does client-side routing).

One caveat worth knowing upfront: RNW is good but not pixel-perfect parity — some things (shadows, certain flex edge cases, gesture handling) render slightly differently on web vs. native, so budget some per-platform polish time rather than expecting zero divergence.