# Kokoro TTS Reader - Changelog

## Version 4.1 - Major Improvements & Bug Fixes

### 🚨 Critical Fixes
- **Fixed Missing Audio Functions**: Added `playAudioBuffer()`, `cacheAudioBuffer()`, `updateCacheOrder()`, and `playAudioFromCache()` functions that were referenced but missing
- **Removed Dead Code**: Cleaned up unused `isBase64Encoded()` and `decrypt()` functions from offscreen.js
- **Fixed Keep-Alive Monitoring**: Added missing `startKeepAliveMonitoring()` and `stopKeepAliveMonitoring()` functions

### ⚡ Performance Improvements
- **Enhanced Audio Caching**: Implemented complete LRU (Least Recently Used) cache management with configurable cache size
- **Retry Logic**: Added exponential backoff retry mechanism for failed audio generation
- **Memory Management**: Improved cleanup and resource management to prevent memory leaks
- **Preloading Optimization**: Enhanced chunk preloading with better error handling

### 🎯 User Experience Enhancements
- **Improved Settings UI**: 
  - Added configurable audio cache size setting (5-20 chunks)
  - Enhanced chunk size options (up to 2000 characters)
  - Changed API key input to password field for security
  - Added helpful placeholders and tooltips
- **Better Error Handling**: More user-friendly error messages with auto-hide based on message length
- **Enhanced Progress Feedback**: Smoother transitions between audio chunks
- **Security Improvements**: API key field now shows dots when saved, clears after saving

### 🛡️ Robustness & Reliability
- **Better Error Recovery**: Smart retry logic for network failures and API timeouts
- **Document Lifecycle**: Improved offscreen document management with proper cleanup
- **State Management**: Enhanced state synchronization between components
- **Input Validation**: Added client-side validation for settings

### 🔧 Code Quality Improvements
- **Structured Error Handling**: Centralized error processing with user-friendly messages
- **Modular Functions**: Better separation of concerns and code organization
- **Enhanced Logging**: More comprehensive logging for debugging
- **Type Safety**: Better validation of settings and API responses

### 📱 UI/UX Polish
- **Visual Feedback**: Improved loading states and processing indicators
- **Responsive Design**: Better handling of long error messages
- **Accessibility**: Improved form validation and user guidance
- **Settings Persistence**: Better handling of saved vs. new settings

## Technical Details

### Audio System Overhaul
- Complete Web Audio API implementation with proper buffer management
- LRU cache system for efficient memory usage
- Automatic chunk sequencing with smooth transitions
- Enhanced preloading strategy to reduce playback gaps

### Background Script Improvements
- Robust offscreen document lifecycle management
- Keep-alive monitoring to prevent document termination
- Enhanced message passing with timeout handling
- Better state synchronization across components

### Security Enhancements
- Secure API key handling with encryption at rest
- Password field for API key input
- Automatic clearing of sensitive fields
- Better validation of user inputs

## Breaking Changes
None - this is a backward-compatible update.

## Migration Notes
- Existing settings will be preserved
- Users may need to re-enter API keys due to enhanced security
- Audio cache will be automatically managed with new LRU system

## Known Issues Fixed
- Extension no longer crashes when trying to play audio
- Audio caching now works properly
- Keep-alive monitoring prevents document termination
- Retry logic handles network failures gracefully
- Memory leaks in audio playback resolved

---

**Upgrade Recommendation**: This is a major stability and performance update. All users should upgrade to resolve critical audio playback issues.
