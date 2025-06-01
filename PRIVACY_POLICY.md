# Privacy Policy for Kokoro TTS Reader Chrome Extension

**Last Updated:** December 2024

## Overview

Kokoro TTS Reader is a Chrome extension that converts selected text from webpages into speech using the Kokoro TTS API. We are committed to protecting your privacy and being transparent about how our extension works.

## Information We Collect

### Data Processed Locally
- **Selected Text**: When you select text on a webpage, the extension temporarily stores this text locally in your browser to process it for text-to-speech conversion.
- **Extension Settings**: Your API URL, API key, voice preferences, and chunk size settings are stored locally in your browser using Chrome's storage API.

### Data We Do NOT Collect
- We do not collect, store, or transmit any personal information to external servers (except as described below)
- We do not track your browsing history
- We do not collect analytics or usage statistics
- We do not share any data with third parties

## How We Use Your Information

### Text Processing
- Selected text is sent to your configured Kokoro TTS server (which you control) to generate audio
- Text is processed in chunks and temporarily cached for smooth playback
- All text processing is done through your own TTS server - we never see or store your text

### Settings Storage
- Your extension settings (API URL, API key, voice preferences) are stored locally in your browser
- API keys are encrypted before storage for security
- Settings never leave your device except when communicating with your TTS server

## Data Transmission

### To Your TTS Server
- Selected text is sent to your configured Kokoro TTS server for audio generation
- Your API key (if configured) is sent to authenticate with your server
- The extension only communicates with the server URL you specify in settings

### No External Data Transmission
- We do not send any data to our servers (we don't have any!)
- No analytics, telemetry, or usage data is transmitted anywhere
- Your data stays between your browser and your TTS server

## Data Storage and Security

### Local Storage
- All data is stored locally in your browser using Chrome's secure storage API
- API keys are encrypted using AES-GCM 256-bit encryption before storage
- You can clear all stored data by removing the extension

### Security Measures
- API keys are encrypted at rest
- No sensitive data is logged or exposed
- Extension uses secure communication protocols (HTTPS recommended)

## Permissions Explanation

Our extension requests the following permissions:

- **`activeTab`**: To read selected text from the current webpage when you use the extension
- **`storage`**: To save your settings (API URL, voice preferences, etc.) locally
- **`contextMenus`**: To add "Read with Kokoro TTS" option to right-click menu
- **`offscreen`**: To play audio in the background while you browse
- **`<all_urls>`**: To detect text selection on any website you visit

## Your Rights and Controls

### Data Control
- All your data is stored locally - you have complete control
- You can clear all extension data by removing the extension
- You can modify or delete your settings at any time
- You control which TTS server the extension communicates with

### Opt-Out
- You can stop using the extension at any time by disabling or removing it
- No data persists after extension removal

## Third-Party Services

### Kokoro TTS Server
- The extension communicates with a Kokoro TTS server that YOU configure and control
- We are not responsible for the privacy practices of your TTS server
- Please review the privacy policy of your TTS server provider

### No Other Third Parties
- The extension does not integrate with any other third-party services
- No data is shared with analytics providers, advertisers, or other services

## Children's Privacy

This extension is not directed at children under 13. We do not knowingly collect personal information from children under 13.

## Changes to This Policy

We may update this privacy policy from time to time. When we do:
- We will update the "Last Updated" date
- Significant changes will be noted in the extension's update notes
- Continued use of the extension constitutes acceptance of any changes

## Data Retention

- Text selections are only stored temporarily during processing and playback
- Settings are stored until you change them or remove the extension
- Audio cache is cleared when playback stops or extension is restarted
- No data is retained after extension removal

## Contact Information

If you have questions about this privacy policy or the extension's data practices:

- **GitHub Issues**: https://github.com/VJ-Ranga/kokoro-ttsv5/issues
- **Email**: info@vjranga.com

## Compliance

This extension and privacy policy are designed to comply with:
- Chrome Web Store policies
- General privacy best practices
- Applicable data protection regulations

## Technical Details

### Encryption
- API keys are encrypted using AES-GCM 256-bit encryption
- Encryption keys are derived using PBKDF2 with 200,000 iterations
- Each installation generates unique encryption keys

### Data Flow
1. You select text on a webpage
2. Extension temporarily stores text locally
3. Text is sent to YOUR TTS server for audio generation
4. Audio is played locally in your browser
5. Temporary data is cleared after playback

---

**Note**: This extension is designed to be privacy-focused by default. Your data stays under your control, and we've built the extension to minimize data collection and maximize your privacy.
