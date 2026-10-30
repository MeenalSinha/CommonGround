# Privacy and Data Handling Policy

**Version:** 1.0  
**Effective Date:** 2026-10-30  
**Applies To:** CommonGround Mobile & Web Applications, CommonGround Backend

---

## 1. Core Principles

CommonGround is built with a **local-first, privacy-respecting architecture**. The application helps groups of friends agree on activities without requiring user accounts, cloud databases, cross-device tracking, or advertising profiles.

Key tenets:
1. **No User Accounts:** CommonGround does not require a login, email address, phone number, or password.
2. **Local Storage Only:** All party members, taste profiles, participant feedback, and proposed itineraries are stored solely on the user's local device.
3. **No Personal Data Sent to Third Parties:** Only public cultural entity identifiers (e.g. Qloo entity IDs) and search terms are transmitted to Qloo. Personal names and group details remain local.
4. **Honest Capabilities:** The application does not claim end-to-end encryption or multi-device cloud synchronization.

---

## 2. What Data Is Collected & Where It Lives

| Data Item | Purpose | Storage Location | Retention / Deletion |
|---|---|---|---|
| **Party Name & Member Names** | Display in UI and group coordination | Local device storage (`AsyncStorage`) | Persists until user resets party or taps "Clear all local data". |
| **Participant Taste Profiles** | Cultural interest matching (Qloo entity IDs, entity titles, categories) | Local device storage (`AsyncStorage`) | Persists until user removes interest, removes member, or resets. |
| **Unresolved Interest Notes** | Notes for items not found in Qloo | Local device storage (`AsyncStorage`) | Persists until user removes note or resets party. |
| **Participant Feedback & Exclusions** | Voting (`interested`, `unsure`, `pass`, `exclude`) | Local device storage (`AsyncStorage`) | Persists until plan or session is cleared/regenerated. |
| **Generated Experience Plans** | Ordered plan steps, revisions, finalization status | Local device storage (`AsyncStorage`) | Persists until user regenerates or deletes plan. |
| **Search Queries** | Looking up entities in Qloo | Sent over HTTPS to CommonGround Backend → Qloo API | Transient in memory; never stored in a database. |

---

## 3. Communication with the CommonGround Backend & Qloo

### 3.1 Network Requests
The mobile client communicates exclusively with the CommonGround backend over HTTPS (or HTTP on localhost in local development):
- `GET /health` and `GET /api/v1/integrations/qloo/status`: Checks service availability. Transmits zero user data.
- `GET /api/v1/integrations/qloo/search?query=...&types=...`: Searches for cultural entities. Transmits the user-entered search query string.
- `POST /api/v1/integrations/qloo/recommendations`: Recommends candidates based on selected interests. Transmits a list of public Qloo entity IDs and target entity types.

### 3.2 What Qloo Receives
The Qloo API receives:
- Target category (e.g., `urn:entity:place`).
- Source entity IDs (e.g., `["ent_abc123", "ent_def456"]`).
- Backend API authentication key.

**Qloo NEVER receives:**
- Names of party members.
- Device identifiers or IP addresses of end users (the backend acts as a reverse proxy).
- User voting history, budgets, notes, or final plans.

---

## 4. Local Storage Security Details

### 4.1 Storage Mechanism
- The application uses `@react-native-async-storage/async-storage`.
- Data is stored as serialized JSON strings on the device's internal application sandbox filesystem.
- **Encryption Note:** Data is **not** encrypted at rest with custom cryptographic keys; it relies on the operating system's native application sandbox (iOS data protection and Android application sandbox isolation).

### 4.2 Clear Data Controls
Users have total control over their data:
1. **Party Reset:** Within the Party screen, users can tap "Start over" to remove current members and interests.
2. **Complete Data Wipe:** Within the Status / Privacy screen (`/status`), a dedicated **"Clear all local data"** button is provided. Confirming this action immediately clears the in-memory state and calls `AsyncStorage.clear()`, wiping all party, negotiation, and plan records.

---

## 5. Logging and Telemetry

- **No Third-Party Analytics:** The application does not embed Google Analytics, Firebase Analytics, Meta SDK, or Sentry.
- **Server Logs:** The backend logs request method, path, status code, and `X-Request-ID`.
- **Secret Scrubbing:** All backend logging automatically filters and scrubs sensitive tokens, including `QLOO_API_KEY`.

