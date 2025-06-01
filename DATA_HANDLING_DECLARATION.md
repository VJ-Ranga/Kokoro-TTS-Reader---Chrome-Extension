# Chrome Web Store - Data Handling Declaration

## For Chrome Web Store Developer Dashboard

### Data Collection Questions & Answers

**Q: Does your extension collect or use any of the following types of user data?**

**Personal Communications:**
- ❌ No - We do not collect emails, text messages, or other personal communications

**Financial and Payment Information:**
- ❌ No - We do not collect credit card, bank account, or payment information

**Health:**
- ❌ No - We do not collect health or fitness information

**Location:**
- ❌ No - We do not collect location data

**Web History:**
- ❌ No - We do not collect browsing history

**User Activity:**
- ✅ **YES** - We temporarily process selected text for TTS conversion
- **Details**: Users explicitly select text on webpages that is temporarily processed for text-to-speech conversion only

**Website Content:**
- ✅ **YES** - We access selected text from websites 
- **Details**: Only when user explicitly selects text and requests TTS playback

**Personal Identifiers:**
- ❌ No - We do not collect names, addresses, phone numbers, or other personal identifiers

**Authentication Information:**
- ✅ **YES** - We store user's TTS server API key
- **Details**: API key for user's own TTS server, encrypted with AES-256 before storage

---

## Detailed Data Handling Responses

### 1. User Activity Data

**What data do you collect?**
- Selected text from webpages that users explicitly choose to convert to speech

**How is it collected?**
- When user selects text and clicks "Play" or uses right-click context menu
- Content script captures selected text only upon explicit user action

**Why is it collected?**
- To convert selected text into speech audio using TTS service
- Essential for core functionality of the extension

**How is it used?**
- Sent to user's configured TTS server to generate audio
- Temporarily cached for smooth playback experience
- Automatically deleted after playback completion

**Is it transmitted outside the user's device?**
- ✅ Yes - to user's own configured TTS server only
- ❌ Never transmitted to extension developers or third parties

### 2. Website Content Data

**What data do you collect?**
- Text content that users select on webpages

**How is it collected?**
- Through content scripts when user explicitly selects text
- Only activated when user initiates TTS playback

**Why is it collected?**
- To provide text-to-speech functionality
- Users expect to convert any web text to audio

**How is it used?**
- Processed into manageable chunks for TTS conversion
- Sent to user's TTS server for audio generation
- Cached temporarily for playback optimization

**Is it transmitted outside the user's device?**
- ✅ Yes - only to the TTS server URL configured by the user
- ❌ No transmission to extension developers or other parties

### 3. Authentication Information

**What data do you collect?**
- API keys for user's TTS server (if required by their server)

**How is it collected?**
- User manually enters API key in extension settings

**Why is it collected?**
- To authenticate with user's TTS server
- Required by some TTS server configurations

**How is it used?**
- Sent with TTS requests to user's server for authentication
- Stored locally in encrypted format

**Is it transmitted outside the user's device?**
- ✅ Yes - only to the user's own configured TTS server
- ❌ Never shared with extension developers or third parties

---

## Data Retention & Deletion

**Selected Text:**
- Retained: Only during active playback session
- Deleted: Automatically when playback stops or extension restarts
- User Control: Can stop playback anytime to clear data

**API Keys:**
- Retained: Until user changes/deletes them in settings
- Deleted: When user removes extension or clears settings
- User Control: Full control to modify or delete anytime

**Settings:**
- Retained: Until user modifies or removes extension
- Deleted: Complete removal when extension is uninstalled
- User Control: Can modify or reset all settings anytime

---

## Data Security Measures

**Encryption:**
- API keys encrypted with AES-GCM 256-bit encryption
- Unique encryption keys per browser installation
- PBKDF2 key derivation with 200,000 iterations

**Access Control:**
- Data only accessible to the extension itself
- No external access or sharing mechanisms
- User has complete control over all data

**Transmission Security:**
- HTTPS recommended for TTS server communication
- No data sent to extension developers' servers
- All communication is between user's browser and user's TTS server

---

## Third-Party Data Sharing

**Data shared with third parties:** ❌ NONE

**Why?**
- Extension operates entirely between user's browser and user's TTS server
- No analytics, tracking, or external services integrated
- No business model requiring data monetization

**User's TTS Server:**
- Not considered "third party" as it's user's own infrastructure
- User controls the server, privacy policies, and data handling
- Extension only facilitates communication user initiates

---

## User Rights & Control

**Data Access:**
- Users can view all stored settings in extension popup
- Selected text visible in real-time during processing

**Data Modification:**
- Full control to modify API keys, server URLs, and preferences
- Can change or delete any stored information anytime

**Data Deletion:**
- Individual settings can be cleared/reset
- Complete data removal by uninstalling extension
- No data persistence after removal

**Data Portability:**
- Settings stored in standard Chrome storage format
- Can be backed up using Chrome's sync features (if user enables)
- No proprietary data formats or lock-in

---

## Compliance Statement

This extension is designed to comply with:
- Chrome Web Store policies
- GDPR principles (data minimization, user control, transparency)
- General privacy best practices
- No data collection beyond functional necessity

**Contact for Data Questions:** info@vjranga.com
**Privacy Policy:** https://github.com/VJ-Ranga/Kokoro-TTS-Reader---Chrome-Extension/blob/main/PRIVACY_POLICY.md
