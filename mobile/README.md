# NIRVAPROCURE Mobile

Flutter companion app sharing brand + design tokens with the web frontend.

## Setup

```bash
# Flutter 3.22+ required
flutter pub get

# Run against the local backend (Docker Compose stack on :3000):
flutter run --dart-define=API_BASE_URL=http://localhost:3000/v1

# Or against a deployed backend:
flutter run --dart-define=API_BASE_URL=https://api.nirvaprocure.com/v1
```

For iOS simulator → backend on host:
`--dart-define=API_BASE_URL=http://localhost:3000/v1`

For Android emulator → backend on host:
`--dart-define=API_BASE_URL=http://10.0.2.2:3000/v1`

## Layout

```
mobile/
├── pubspec.yaml
├── lib/
│   ├── main.dart                # bootstrap + GoRouter with redirect-based auth guard
│   ├── api/
│   │   ├── api_client.dart      # Singleton Dio with auth interceptor + auto-refresh
│   │   └── endpoints.dart       # Typed wrappers (Api.login, Api.listPr, ...)
│   ├── pages/
│   │   ├── login_page.dart      # Thai-first login form
│   │   ├── home_page.dart       # 3 big action cards
│   │   └── pr_list_page.dart    # PR list with status chips + pull-to-refresh
│   └── theme/
│       └── tokens.dart          # Design tokens mirroring web (brand colors,
│                                #   56px tap targets, Noto Sans Thai)
```

## Design parity with web

- Brand color `#4F46E5` (Tailwind brand-600)
- 56px minimum primary tap target, 44px secondary
- 18px base font (matches web's 18px html font-size override)
- Noto Sans Thai via `google_fonts`
- Status chips use the same color/icon/label trio rule from
  `frontend/design-system/principles.md`

When a token here drifts from the web, update both. Eventually we'll
generate this file from the same source.

## Auth

`api_client.dart` runs the same access+refresh flow as the web:
1. `Api.login()` stores tokens in `flutter_secure_storage` (Keychain on iOS,
   Android Keystore on Android).
2. Every request attaches `Authorization: Bearer <token>` automatically.
3. On 401 the interceptor calls `/auth/refresh` once, then replays the
   original request transparently to the caller.

`GoRouter.redirect` enforces the route guard: no token → `/login`.

## What's not in this scaffold yet

- PR detail screen
- Create PR (Shopee URL paste needs the camera/share-sheet integration that's
  unique to mobile — design TBD)
- Approvals inbox with swipe-to-approve gesture
- Push notifications via LINE / FCM
- Offline draft queue
