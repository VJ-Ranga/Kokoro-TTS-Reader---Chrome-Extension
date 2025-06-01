# Chrome Web Store Permission Justifications

## For Chrome Web Store Submission Form

### `<all_urls>` Permission Justification

**Why this permission is needed:**

Our Kokoro TTS Reader extension needs `<all_urls>` access because users want to convert text to speech from ANY website they visit - not just specific domains. Here's why this broad permission is essential and justified:

**Core Functionality Requirements:**
- Users select text from news websites, blogs, articles, documentation, social media, and any other web content
- The extension must detect text selection events across all websites to provide seamless TTS functionality
- Users expect the "Read with Kokoro TTS" context menu option to work on every website they visit

**Technical Necessity:**
- Text selection detection requires content script injection on all pages
- No way to predict which websites users will want to use TTS on
- Restricting to specific domains would break core functionality

**User Experience:**
- Users install a TTS extension expecting it to work everywhere, not just on limited websites
- Having to manually enable the extension for each website would create poor user experience
- The extension is designed as a universal accessibility tool

**Privacy & Security Safeguards:**
- Extension only activates when user explicitly selects text and chooses to read it
- No automatic data collection or background scanning of web content
- Selected text is only processed when user initiates TTS playback
- All data stays local or goes only to user's own configured TTS server
- No analytics, tracking, or data transmission to third parties

**Alternative Approaches Considered:**
- activeTab only: Would require users to manually activate extension on every page
- Specific domain list: Impossible to predict all websites users might want TTS on
- Manual permission requests: Would create friction and poor accessibility experience

**Conclusion:**
The `<all_urls>` permission is essential for providing universal text-to-speech functionality that users expect from an accessibility tool. The extension implements strong privacy safeguards and only processes data when explicitly requested by the user.

---

## Other Permission Justifications

### `storage` Permission
**Purpose:** Store user settings (TTS server URL, API keys, voice preferences) locally in browser
**Data:** Only extension configuration, no personal browsing data
**Security:** API keys encrypted with AES-256 before storage

### `activeTab` Permission  
**Purpose:** Read selected text from current webpage when user requests TTS
**Usage:** Only activated when user explicitly selects text and clicks play
**Scope:** Current tab only, no background access

### `contextMenus` Permission
**Purpose:** Add "Read with Kokoro TTS" option to right-click context menu
**Usage:** Provides convenient access to TTS functionality for selected text
**Scope:** Only appears when text is selected

### `offscreen` Permission
**Purpose:** Enable background audio playback so users can continue browsing while listening
**Usage:** Creates hidden document for audio processing only
**Benefit:** Users can close popup and continue browsing while TTS plays

---

## For Developer Dashboard Form Fields

**Single-Use Justification (if asked for one combined justification):**

"Kokoro TTS Reader requires <all_urls> access to provide universal text-to-speech functionality across all websites. Users select text from any website (news, blogs, documentation, etc.) and expect the extension to convert it to speech. The extension only activates when users explicitly select text and request TTS playback. No automatic data collection occurs - all processing is user-initiated. Selected text is sent only to the user's own configured TTS server. This broad permission is essential for accessibility, as users cannot predict which websites they'll need TTS on, and restricting to specific domains would break the core functionality of a universal reading tool."
