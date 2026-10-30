# CommonGround — Hackathon Submission Package

## Project Title
**CommonGround**

## Tagline
*Different tastes. One unforgettable adventure.*

## Live Production Deployment (Google Cloud)
- **Live Web Application:** [https://commonground-web-799175996958.us-central1.run.app](https://commonground-web-799175996958.us-central1.run.app)
- **Live Backend API:** [https://commonground-backend-799175996958.us-central1.run.app](https://commonground-backend-799175996958.us-central1.run.app)
- **API Health Check:** [https://commonground-backend-799175996958.us-central1.run.app/health](https://commonground-backend-799175996958.us-central1.run.app/health)
- **API Readiness / Qloo Status:** [https://commonground-backend-799175996958.us-central1.run.app/ready](https://commonground-backend-799175996958.us-central1.run.app/ready)
- **Google Cloud Project ID:** `spatialguard` (Region: `us-central1`)
- **GitHub Repository:** [https://github.com/MeenalSinha/CommonGround](https://github.com/MeenalSinha/CommonGround)

---

## 1. Problem Statement

Every group faces the same exhausting dilemma when planning time together: **the paradox of conflicting tastes**.

One person loves intimate indie film festivals and quiet coffee houses; another loves high-energy live sports and bustling food halls; a third has dietary restrictions or a strict budget. Traditional group planning descends into endless group chats, unhelpful voting polls, or one person reluctantly compromising while someone else feels left out.

Standard recommendation engines fail social groups because they:
1. Focus on a single individual's taste profile.
2. Rely on simplistic "average rating" or popularity metrics that homogenize unique preferences.
3. Treat group consensus as a blunt mathematical average rather than a nuanced negotiation.

---

## 2. The Solution: CommonGround

**CommonGround** is a collaborative, game-inspired mobile and web application powered by **cultural intelligence**. Instead of forcing one person's taste onto everyone else or settling for bland lowest-common-denominator compromises, CommonGround:

1. **Captures Individual Cultural Tastes:** Each participant adds real cultural entities they love across film, music, dining, literature, and places.
2. **Harnesses Qloo Cultural Intelligence:** CommonGround queries Qloo's taste graph to uncover unexpected cross-domain affinities and shared cultural intersections that link the group's diverse interests.
3. **Fuses Candidate Pools with Provenance:** Generates both group-level and participant-specific candidate recommendations, preserving complete transparency about why each candidate was surfaced and which participant's taste inspired it.
4. **Negotiates Consensus with Hard Constraints:** Members express feedback (`interested`, `unsure`, `pass`, or `exclude`). Hard exclusions immediately filter out deal-breakers, while soft preferences determine ranking through Reciprocal Rank Fusion and a group-coverage heuristic.
5. **Generates & Refines Adaptive Plans:** Assembles an organized experience plan that balances group appeal and individual representation, allowing real-time alternative swaps, reordering, and finalization.

---

## 3. How Qloo Is Used

CommonGround integrates Qloo as the foundational cultural intelligence backbone through a secure FastAPI backend service:

- **Entity Resolution (`/api/v1/integrations/qloo/search`):** Resolves free-text user searches to authoritative Qloo entities across supported URN types (`urn:entity:place`, `urn:entity:movie`, `urn:entity:tv_show`, `urn:entity:music_artist`, `urn:entity:book`).
- **Cultural Affinity Discovery (`/api/v1/integrations/qloo/recommendations`):** Sends sets of resolved Qloo entity IDs to generate recommendations within a chosen target category.
- **Participant-Specific Signal Queries:** The negotiation engine decomposes the party into both group-level queries and individual participant queries. This ensures that quieter members with niche tastes still get candidates surfaced in the candidate pool.
- **Deduplication & Provenance:** Each candidate entity retains its originating Qloo entity ID, title, category, and query provenance so participants can trace recommendations back to the specific tastes that sparked them.
- **Keyless Contingency:** If a live Qloo API key is absent, the backend operates in keyless mode, honestly reporting its unconfigured state without fabricating fake cultural results.

---

## 4. Technical Architecture

- **Frontend Application:**
  - **Framework:** Expo 58 SDK with React Native 0.88, React 19.3.0, and React Native for Web (`~0.21.0`).
  - **Routing:** Expo Router v58 (file-based navigation with deep linking).
  - **Language:** TypeScript with strict type checking.
  - **Visual Identity:** Warm, cozy adventure-game aesthetic inspired by classic RPG quest logs: warm cream backgrounds (`#FFF6E5`), coral action buttons, pastel accents (sky, mint, lavender, yellow), and friendly, accessible typography (Nunito & Fredoka).
  - **Persistence:** Local-first persistence using `@react-native-async-storage/async-storage` with transactional serialization and complete local wipe capabilities.
- **Backend Service:**
  - **Framework:** FastAPI with Uvicorn.
  - **Language:** Python 3.11/3.12 with Pydantic v2 and HTTPX async client.
  - **Architecture:** Zero-trust architecture where all third-party Qloo API credentials reside exclusively on the server.
  - **Deployment:** Packaged in a hardened, non-root Debian Docker container (`commonground-backend:latest`).
- **Negotiation & Planning Engine:**
  - **Deterministic Ranking:** Implements Reciprocal Rank Fusion (RRF, $k=60$) combined with participant feedback scores.
  - **Coverage Greedy Selection:** Gives priority to candidates that reach participants who have no other representation in the plan.
  - **Constraint Enforcement:** Hard exclusions (`exclude`) act as absolute filters that cannot be overridden by any ranking score.
  - **Plan Lifecycle:** Governed by state machine (`draft` → `proposed` → `ready` → `finalized`) with invalidation triggers when upstream party members or interests change.

---

## 5. Innovation & Competitive Differentiation

| Conventional Group Planning | CommonGround with Qloo |
|---|---|
| Rigid voting polls on pre-decided venues | AI-discovered cultural cross-sections based on open taste profiles |
| "Lowest common denominator" (boring chains) | Hidden gems that connect diverse tastes across different cultural domains |
| Majority-rules voting marginalizes minority tastes | Participant-specific query pools guarantee individual representation |
| Black-box recommendations | Full provenance showing which member's taste sparked each suggestion |
| Ad-heavy, invasive user tracking and signups | 100% local-first privacy model with no accounts or cloud tracking |

---

## 6. Social & Real-World Impact

CommonGround transforms group planning across several communities:
- **Friend Circles:** Eliminates the friction and decision fatigue of choosing weekend dinners, movie nights, or outings.
- **University Students & Roommates:** Helps new acquaintances find surprising common cultural ground.
- **Travelers & Roadtrippers:** Generates multi-stop day itineraries that satisfy both the history buff and the foodie in the car.
- **Corporate Teams & Offsites:** Creates team-bonding activities that respect dietary needs, physical limitations, and varied personal interests.

---

## 7. Limitations & Honest Disclosures

To ensure absolute transparency with judges and reviewers:
1. **Live Qloo Authentication Status:** The repository contains a complete, verified Qloo integration client, error handling pipeline, and normalization engine. However, as of this submission, verification was performed using test mocks and keyless mode because an authenticated production Qloo API key was not yet provisioned. The app honestly surfaces this state without fabricating fake recommendations.
2. **Local-First Persistence:** Application state is stored in device AsyncStorage as unencrypted JSON. It does not provide cross-device cloud synchronization or multi-device live voting.
3. **Ranking Tuning:** Ranking heuristics (RRF $k=60$ and coverage bonus) are mathematically deterministic and documented, but have not yet been empirically calibrated against large-scale live Qloo user datasets.

