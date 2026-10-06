# apps/mobile — Flutter Home Care Mobile Application

A cross-platform Flutter application providing both **Customer** and **Caregiver / Nurse** experiences in a single unified codebase, gated on `user.role` from `@homecare/contracts`.

---

## 📱 Mobile Architecture

```
apps/mobile/
├── pubspec.yaml                 # Dependencies (Riverpod, Dio, GoRouter, Google Fonts)
├── README.md
└── lib/
    ├── main.dart                # App entry point + ProviderScope + Role Auth Gate
    ├── core/
    │   ├── theme/
    │   │   └── app_theme.dart   # Exact brand tokens (colors, typography, component styles)
    │   └── network/
    │       └── api_client.dart  # Dio HTTP client configured for NestJS backend with JWT auth
    └── features/
        ├── auth/
        │   ├── models/
        │   │   └── user.dart            # AppUser, UserRole (customer, caregiver, admin)
        │   ├── providers/
        │   │   └── auth_provider.dart   # Riverpod AuthNotifier (OTP login, token, role switch)
        │   └── presentation/
        │       └── login_screen.dart    # Phone OTP auth + Instant Role Switcher for dev/testing
        ├── customer/
        │   └── presentation/
        │       ├── customer_home_screen.dart   # Service catalog (9 Addis services), Emergency banner
        │       ├── book_care_screen.dart       # 5-step horizontal booking wizard
        │       ├── request_tracking_screen.dart # 7-stage visual lifecycle tracker & caregiver card
        │       └── review_visit_screen.dart    # 4-part star rating (Professionalism, Punctuality, etc.)
        └── caregiver/
            └── presentation/
                ├── caregiver_home_screen.dart  # Availability toggle, new assignment offers (Accept/Decline)
                └── visit_execution_screen.dart # En-route -> Start Visit -> Complete Visit + Vitals modal
```

---

## 🌟 Key Features Implemented

### 1. Unified Single App with Role Gating
- Switch seamlessly between **Customer Mode** and **Caregiver Mode** on the login screen or via role switcher.
- Gated by `AppUser.role` matching backend authentication.

### 2. Customer Surface
- **Emergency Medical Banner**: Explicitly guides urgent trauma/ICU emergencies to call 907 or hospital (Spec Requirement 9).
- **Service Catalog**: 9 core Addis Ababa launch services (Nursing, Elderly, Post-Hospital, Wound Care, Medication Support, Personal Care, Feeding, Vitals Monitoring, Physiotherapy).
- **5-Step Booking Wizard**:
  1. Service selection & duration
  2. Patient profile (Name, age, gender, mobility, medical needs)
  3. Appointment scheduling (Date, start time)
  4. Addis Ababa location (11 Sub-cities selection, street, landmarks)
  5. Emergency contact & estimated cost in ETB
- **Lifecycle Tracking (`request_tracking_screen.dart`)**:
  - `REQUESTED` → `UNDER_REVIEW` → `CAREGIVER_ASSIGNED` → `CONFIRMED` → `CAREGIVER_ARRIVING` → `IN_PROGRESS` → `COMPLETED`
  - Caregiver contact card with direct phone trigger and rating display.
  - Interactive status simulator tool for instant walkthrough of all stages.
- **Review Visit (`review_visit_screen.dart`)**:
  - 4 rating categories: Overall experience, Caregiver professionalism, Punctuality, Clinical quality.
  - Open text feedback and submission confirmation.

### 3. Caregiver Surface
- **Availability Toggle**: Real-time switch between "Available for Dispatch" and "Off-Duty".
- **Assignment Offers**:
  - Displays patient name, sub-city address, time, and clinical care instructions.
  - **ACCEPT** (locks visit to calendar and notifies customer) and **DECLINE** actions.
- **Visit Execution Console (`visit_execution_screen.dart`)**:
  - Journey progression: `CONFIRMED` → `START JOURNEY (EN ROUTE)` → `ARRIVED: START VISIT`.
  - **START VISIT**: Records arrival timestamp.
  - **COMPLETE VISIT**: Full clinical documentation modal:
    - Vital signs: Blood pressure (systolic/diastolic mmHg), Pulse (bpm), Temperature (°C), Oxygen Saturation SpO2 (%).
    - Clinical procedures checklist.
    - Supplies used (sterile gauze, saline, etc.).
    - Clinical observations and follow-up recommendation.

---

## 🚀 How to Run the App

### Prerequisites
- Install Flutter SDK (3.19+ or stable):
  ```bash
  git clone -b stable https://github.com/flutter/flutter.git ~/flutter
  export PATH="$HOME/flutter/bin:$PATH"
  flutter doctor
  ```

### Running on Mobile / Simulator / Chrome
```bash
cd apps/mobile

# Get dependencies
flutter pub get

# Run on connected device or simulator
flutter run

# Or run directly on Web / Chrome for rapid UI inspection
flutter run -d chrome
```

### Backend Integration
The mobile app communicates with the NestJS API at `http://localhost:3000/api/v1` (or your host IP when running on a physical phone or Android emulator `http://10.0.2.2:3000/api/v1`).