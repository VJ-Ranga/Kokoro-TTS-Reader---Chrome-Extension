# Chrome Web Store Submission Guide - Where to Use Permission Justifications

## Step-by-Step Submission Process

### 1. **Developer Dashboard → New Item**
- Go to https://chrome.google.com/webstore/devconsole/
- Click "New Item" 
- Upload your extension .zip file

### 2. **Store Listing Tab**
Fill in basic info:
- **Name:** Kokoro TTS Reader
- **Summary:** Advanced text-to-speech extension using Kokoro TTS API
- **Description:** (Use your README description)
- **Category:** Productivity or Accessibility
- **Screenshots:** (Upload popup screenshots)

### 3. **Privacy Tab** ⭐ CRITICAL
This is where you use our permission justifications:

**Privacy Policy URL:** 
```
https://github.com/VJ-Ranga/kokoro-ttsv5/blob/main/PRIVACY_POLICY.md
```

**Permission Justifications Section:**
Look for fields like:
- "Why does your extension need 'Access your data on all websites'?"
- "Justify the use of broad host permissions"
- "Permission usage justification"

**Copy-paste this for `<all_urls>`:**
```
Kokoro TTS Reader requires <all_urls> access to provide universal text-to-speech functionality across all websites. Users select text from any website (news, blogs, documentation, etc.) and expect the extension to convert it to speech. The extension only activates when users explicitly select text and request TTS playback. No automatic data collection occurs - all processing is user-initiated. Selected text is sent only to the user's own configured TTS server. This broad permission is essential for accessibility, as users cannot predict which websites they'll need TTS on, and restricting to specific domains would break the core functionality of a universal reading tool.
```

### 4. **If Asked for Individual Permission Justifications:**

**For `storage` permission:**
```
Store user settings (TTS server URL, API keys, voice preferences) locally in browser. API keys are encrypted with AES-256 before storage. No personal browsing data collected.
```

**For `activeTab` permission:**
```
Read selected text from current webpage when user requests TTS. Only activated when user explicitly selects text and clicks play.
```

**For `contextMenus` permission:**
```
Add "Read with Kokoro TTS" option to right-click context menu for convenient access to TTS functionality.
```

**For `offscreen` permission:**
```
Enable background audio playback so users can continue browsing while listening to TTS audio.
```

### 5. **Common Review Questions & Answers**

**Q: "Why do you need access to all websites?"**
**A:** Copy the main `<all_urls>` justification above.

**Q: "What data do you collect?"**
**A:** "We only collect selected text temporarily for TTS processing and user settings stored locally. No personal data, browsing history, or analytics collected. See our privacy policy for details."

**Q: "Do you transmit data to external servers?"**
**A:** "Selected text is sent only to the user's own configured TTS server (which they control). No data sent to our servers - we don't have any servers."

### 6. **Additional Tips for Approval**

✅ **DO:**
- Emphasize user control and explicit consent
- Mention accessibility use case
- Reference your privacy policy
- Explain technical necessity clearly
- Show you've considered alternatives

❌ **DON'T:**
- Say you need it for "convenience" 
- Be vague about data usage
- Forget to mention user-initiated actions only
- Skip explaining why alternatives won't work

### 7. **If You Get Rejected**

**Common rejection reasons:**
1. "Insufficient justification for broad permissions"
2. "Privacy policy doesn't adequately explain data usage"
3. "Functionality could be achieved with more limited permissions"

**How to respond:**
- Use the detailed justifications from PERMISSION_JUSTIFICATIONS.md
- Reference specific sections of your privacy policy
- Explain why activeTab alone is insufficient
- Provide examples of user workflows that require broad access

---

## Quick Copy-Paste Summary

**Homepage URL:** `https://github.com/VJ-Ranga/kokoro-ttsv5`
**Privacy Policy URL:** `https://github.com/VJ-Ranga/kokoro-ttsv5/blob/main/PRIVACY_POLICY.md`
**Main Permission Justification:** (Use the single-use justification from PERMISSION_JUSTIFICATIONS.md)

You're ready to submit! 🚀
