# CommonGround — Hackathon Demonstration Script

**Target Duration:** 90–120 Seconds  
**Core Message:** *Different tastes. One unforgettable adventure.*  
**Central Moment:** Demonstrating how three friends with wildly contrasting tastes discover an activity they all love through Qloo cultural intelligence and adaptive negotiation.

---

## 1. Storyboard & Narration (90-120s)

### Screen 1: Welcome Screen (`/`) — [0:00 - 0:15]
- **Visual:** The app opens with the warm cream background, adventure-game logo, and cheerful tagline: *"Different tastes. One unforgettable adventure."*
- **Action:** Tap **"Create a party"** (or **"Open your party"**).
- **Narration:**
  > *"We've all been there: you and your friends want to hang out this weekend, but everyone wants something completely different. One wants an art film, another wants barbecue, and a third just wants live music. Traditional voting always leaves someone unhappy. Meet CommonGround."*

### Screen 2: The Party Quest Log (`/party`) — [0:15 - 0:35]
- **Visual:** Party screen showing the group **"The Weekend Crew"** with members:
  - **Maya:** Loves Japanese cinema and indie coffee shops.
  - **Liam:** Loves craft beer and live indie rock.
  - **Sofia:** Loves contemporary art galleries and outdoor street markets.
- **Action:** Open Sofia's profile, search Qloo for an art gallery, and add it to her profile.
- **Narration:**
  > *"In CommonGround, you create your party and each person adds what they genuinely love. No ratings or surveys—just real cultural entities resolved through Qloo's taste graph across films, music, dining, and places."*

### Screen 3: Cultural Discovery & Negotiation (`/discover` & `/negotiate`) — [0:35 - 1:05]
- **Visual:** The group chooses **Places to Go** as their target experience. Candidate pool cards appear with explicit cultural provenance badges.
- **Action:** Scroll through candidates. Show how candidate #1 ("Vinyl & Bites Food Hall") connects Liam's indie music tastes and Maya's culinary preferences.
- **Action:** Record participant reactions:
  - Maya taps **"Interested"**.
  - Liam taps **"Interested"**.
  - Sofia passes on candidate #3 and marks candidate #4 as an **"Exclude"** constraint (e.g. noise dealbreaker).
- **Narration:**
  > *"Here's where Qloo's cultural intelligence shines. Instead of suggesting generic tourist spots, CommonGround queries Qloo for cross-domain affinities that link our different tastes. Every suggestion includes full provenance—you can see exactly whose tastes inspired it. Participants can vote 'interested', 'unsure', 'pass', or place a hard 'exclude' on a deal-breaker."*

### Screen 4: The Shared Plan (`/plan`) — [1:05 - 1:30]
- **Visual:** The proposed itinerary appears:
  1. Midday Coffee & Gallery Walk (satisfies Maya & Sofia).
  2. Afternoon Vinyl Record Market (connects Sofia & Liam).
  3. Evening Craft Bistro & Live Jazz (satisfies all three).
- **Action:** Demonstrate adaptive replanning: Tap **"Swap alternative"** on step 1 to show real-time candidate replacement while preserving all participant feedback.
- **Action:** Tap **"Mark ready"** and **"Finalize plan"**.
- **Narration:**
  > *"Our deterministic planning engine balances ranking scores with group coverage so nobody gets left behind. If someone changes their mind, one tap generates an alternative without throwing away the rest of the plan. When everyone agrees, the plan is finalized—ready for the weekend."*

### Screen 5: System Status & Privacy (`/status`) — [1:30 - 1:50]
- **Visual:** Connection status and Privacy Panel showing local storage guarantees and clear data button.
- **Action:** Highlight backend connectivity and local-only data storage.
- **Narration:**
  > *"Best of all, CommonGround respects privacy: zero user accounts, zero cloud tracking, and all taste profiles stay on your device. Different tastes, one unforgettable adventure. Thank you!"*

---

## 2. Strongest Demonstration Moment
The **"Aha!" moment** of the demo occurs on the **Negotiate Screen**:
Pointing out that candidate *Vinyl & Bites Lounge* was surfaced not because both people chose the same restaurant, but because **Qloo's cultural intelligence recognized that fans of indie rock and fans of Japanese cinema share an affinity for intimate acoustic vinyl bistros.** Showing this provenance tag directly on the candidate card proves that CommonGround provides genuine cultural intelligence, not simple keyword matching.

---

## 3. Contingency / Backup Explanation (Keyless Mode)

If demonstrating in an environment where live Qloo API credentials are not active:
> *"CommonGround features a fully implemented Qloo integration client on our FastAPI backend. When running without a live production key, our app operates transparently in keyless mode: it displays our connection status honestly on the status panel, prevents fake mock data from being passed off as real Qloo discoveries, and demonstrates our full consensus planning engine with local persistence."*

---

## 4. Judges' Q&A Cheat Sheet

### Q1: "How does your ranking algorithm work? Is it an LLM?"
**Answer:**
> *"No, it is a deterministic, explainable algorithm. We use Reciprocal Rank Fusion (RRF with $k=60$) across multi-list queries (both group-level and individual member queries), combined with participant feedback scores (positive for interest, negative for pass). Then a greedy selection algorithm applies a group-coverage bonus to ensure every participant has at least one candidate that appeals to their taste in the final plan."*

### Q2: "What prevents someone's deal-breaker from ending up in the plan?"
**Answer:**
> *"Hard constraints are absolute filters in our engine. When a member marks a candidate as 'Exclude', it is immediately stripped from eligibility before ranking takes place. No amount of positive affinity score from other members can override a hard exclusion."*

### Q3: "Where is user data stored? Can users sync across phones?"
**Answer:**
> *"CommonGround is designed local-first. All party members, taste profiles, feedback, and plans are stored on the local device using AsyncStorage. There is no cloud user database or ad tracking. For groups together in the same room, one phone acts as the shared quest log. Cross-device collaborative sessions are planned for future versions using end-to-end encrypted rooms."*

### Q4: "How do you protect Qloo credentials?"
**Answer:**
> *"Qloo credentials reside strictly on the server in the FastAPI backend, loaded via Pydantic SecretStr and injected as container secrets. The mobile and web clients communicate with our backend API over HTTPS; no Qloo key is ever included in the Expo client bundle."*

