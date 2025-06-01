# Kokoro TTS Reader - Chrome Extension

A Chrome extension for text-to-speech using the Kokoro TTS API, allowing you to listen to any selected text on webpages with background audio playback.

![Kokoro TTS Reader](koko-tts.png)

## Overview

Kokoro TTS Reader is a Chrome extension that converts selected text from any webpage into speech using the Kokoro TTS API. Unlike typical TTS extensions, this one uses Chrome's Offscreen API to play audio in the background - meaning you can close the popup and continue browsing while listening.

**Latest Update (v4.1)**: Major stability improvements with complete audio system overhaul, smart caching, and enhanced error handling.

## Features

- **Background Audio Playback**: Continue browsing while listening to text
- **Smart Audio Caching**: LRU cache system with configurable size for optimal performance
- **Enhanced Reliability**: Robust retry logic and error recovery mechanisms
- **Context Menu Integration**: Right-click on any selected text to start reading
- **Advanced Progress Tracking**: Visual progress bar with smooth chunk transitions
- **Server Connection Testing**: Verify your Kokoro TTS server connection
- **Voice Customization**: Configure voice settings and audio parameters
- **Secure API Key Storage**: Encrypted storage with secure input handling
- **Performance Optimization**: Configurable chunk sizes and cache management

## How It Works

This extension uses Chrome's Offscreen Document API (introduced in Chrome 116) to play audio in the background without requiring a visible tab:

1. When you select text and press "Play" (or use the context menu), the extension:
   - Creates an invisible offscreen document
   - Analyzes and splits the text into manageable chunks
   - Sends chunks to the Kokoro TTS server with retry logic
   - Plays the audio in the background with smart preloading

2. The extension includes a robust architecture:
   - **Background Script**: Manages the extension lifecycle and coordinates between UI and audio
   - **Offscreen Document**: Handles audio processing and playback in the background
   - **Content Script**: Captures selected text from webpages
   - **Popup UI**: Provides controls and displays status

3. Advanced features include:
   - **Smart Caching**: LRU cache management for audio chunks
   - **Retry Logic**: Exponential backoff for failed requests
   - **Keep-Alive Monitoring**: Prevents offscreen document termination
   - **Memory Management**: Automatic cleanup to prevent resource leaks
   - **Web Audio API**: Professional audio handling with seamless transitions

## Requirements

- Chrome browser (version 116+) - required for offscreen document API
- Kokoro TTS server (running on your local machine or accessible network)

## Installation

### From Source (Developer Mode)
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the directory containing this extension
5. The extension icon should appear in your Chrome toolbar

## Usage

### Method 1: Context Menu
1. Select text on any webpage
2. Right-click the selected text
3. Choose "Read with Kokoro TTS" from the context menu
4. Text will be read aloud in the background

### Method 2: Popup Interface
1. Select text on any webpage
2. Click the Kokoro TTS Reader icon in your toolbar
3. The selected text will appear in the popup
4. Click "Play" to start reading
5. Click "Stop" to stop playback at any time

## Configuration

1. Click the extension icon to open the popup
2. Go to the "Settings" tab
3. Configure the following settings:
   - **API URL**: The URL of your Kokoro TTS server (default: http://localhost:8880)
   - **API Key**: Your API key if required (securely encrypted)
   - **Voice**: The voice ID to use (default: af_bella)
   - **Chunk Size**: Text processing size (200-2000 characters)
   - **Cache Size**: Audio buffer cache size (5-20 chunks)
4. Click "Save Settings" to apply your changes
5. Use "Test Connection" to verify the server connection

## Performance Tips

- **Optimal Text Length**: Keep selections under 2000 words for best performance
- **Chunk Size Selection**: 
  - 200-500: CPU-only laptops and low-end systems
  - 1000: Recommended for most systems
  - 1500-2000: High-end systems with fast processing
- **Cache Management**: Higher cache sizes improve performance but use more memory
- **Network Considerations**: Stable internet connection recommended for longer texts

## Troubleshooting

### Audio Issues
- If audio stops unexpectedly, click stop and try playing again
- Check that your Kokoro TTS server is running and accessible
- Verify the server URL and API key in settings
- Try reducing chunk size for slower systems

### Connection Issues
- Use the "Test Connection" button to check connectivity
- Ensure your Kokoro TTS server is running and accessible
- Check firewall settings if using remote servers
- Verify API key format and permissions

### Performance Issues
- Reduce chunk size for slower systems
- Lower cache size if experiencing memory issues
- Consider splitting very long texts into smaller sections
- Check system resources during playback

### Browser Compatibility
- The extension requires Chrome 116 or newer
- Update Chrome if you receive compatibility messages
- Disable other TTS extensions that might conflict

## Known Limitations

- Maximum recommended text length is ~10,000 words for optimal performance
- Only one audio playback instance can be active at a time
- Some websites with strict Content Security Policy may block content script
- Very large texts may require manual splitting for best results

## Technical Details

This extension uses:
- **Chrome's Offscreen Document API** for background audio playback
- **Web Audio API** for professional audio processing and playback
- **AES-GCM Encryption** for secure API key storage
- **LRU Caching** for efficient memory management
- **Exponential Backoff** for robust error recovery
- **Modern JavaScript** with async/await patterns
- **Responsive UI** with real-time status updates

## Security Features

- **Encrypted API Key Storage**: Keys are encrypted using AES-GCM 256-bit encryption
- **Secure Input Handling**: Password fields and automatic clearing
- **No Data Collection**: All processing happens locally
- **Permission Minimization**: Only requests necessary browser permissions

## Version History

### v4.1 (Latest)
- 🚨 **Critical Fixes**: Resolved missing audio functions that prevented playback
- ⚡ **Performance**: Complete audio caching system with LRU management
- 🛡️ **Reliability**: Added retry logic and enhanced error handling
- 🎯 **UX**: Improved settings UI with configurable cache and chunk sizes
- 🔧 **Code Quality**: Major code cleanup and optimization

### v4.0
- Initial release with offscreen API support
- Basic TTS functionality with Kokoro API
- Encrypted settings storage
- Context menu integration

## Credits

- Extension developed by the community
- Significant improvements and code enhancements by [Claude AI](https://claude.ai)
- Kokoro TTS model and server by [remsky](https://github.com/remsky)
- Icons and UI design by the development team

## Future Plans

- **Volume and Speed Controls**: Fine-tune audio playback
- **Keyboard Shortcuts**: Hotkeys for play/stop/pause
- **Voice Preview**: Test voices before using them
- **Reading Queue**: Queue multiple text selections
- **Bookmark Support**: Save and resume long reading sessions
- **Additional TTS Engines**: Support for more TTS providers
- **Accessibility Improvements**: Enhanced screen reader support

## Contributing

We welcome contributions! Please feel free to:
- Report bugs and issues
- Suggest new features
- Submit code improvements
- Improve documentation
- Test on different systems

## License

[MIT License](LICENSE)

---

*This extension is not affiliated with Kokoro TTS. It is designed to work with any Kokoro TTS server and can be adapted for other TTS APIs.*

**Support**: For technical support, please check the troubleshooting section above or open an issue on the project repository.