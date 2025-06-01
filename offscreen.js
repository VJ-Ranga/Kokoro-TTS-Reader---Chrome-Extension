// TTS Player state for offscreen document
const playerState = {
  text: '',
  chunks: [],
  currentChunk: 0,
  totalChunks: 0,
  isPlaying: false,
  currentAudio: null,
  audioCache: {},     // Cache for preloaded audio
  audioCacheOrder: [], // Track order of cached items for LRU cache
  preloadingChunk: -1, // Currently preloading chunk index
  keepAliveInterval: null, // Keep alive timer
  audioContext: null,  // Web Audio API context
  audioSource: null,   // Audio source node
  isInitialized: false, // Track initialization state
  settings: {
    apiUrl: 'http://localhost:8880',
    apiKey: 'not-needed',
    voice: 'af_bella',
    chunkSize: 1000,  // Default to 1000 characters
    preloadThreshold: 0.3,  // Start loading next chunk when current is 30% complete
    maxCacheSize: 10  // Maximum number of audio chunks to keep in cache
  }
};

// Initialize Web Audio API context
function initAudioContext() {
  if (!playerState.audioContext) {
    try {
      playerState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('Audio context initialized');
    } catch (e) {
      console.error('Failed to create audio context:', e);
    }
  }
}

// Keep the offscreen document alive
function startKeepAlive() {
  // Clear any existing interval
  if (playerState.keepAliveInterval) {
    clearInterval(playerState.keepAliveInterval);
  }
  
  // Set up a new interval
  playerState.keepAliveInterval = setInterval(() => {
    if (playerState.isPlaying) {
      console.log('Keep alive ping - currently playing chunk', playerState.currentChunk + 1, 'of', playerState.totalChunks);
      
      // Send a keep alive message to the background script
      chrome.runtime.sendMessage({
        target: 'background',
        action: 'keepAlive',
        isPlaying: playerState.isPlaying,
        currentChunk: playerState.currentChunk,
        totalChunks: playerState.totalChunks
      });
    }
  }, 5000); // Ping every 5 seconds
}

// Stop the keep alive interval
function stopKeepAlive() {
  if (playerState.keepAliveInterval) {
    clearInterval(playerState.keepAliveInterval);
    playerState.keepAliveInterval = null;
  }
}

// Send processing update to background
function sendProcessingUpdate(message) {
  try {
    chrome.runtime.sendMessage({
      target: 'background',
      action: 'processingUpdate',
      message: message
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Silently handle - this is not critical
        console.log('Processing update message error (handled):', chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    // Silently handle messaging errors during shutdown
    console.log('Error sending processing update (handled):', error);
  }
}

// Initialize the offscreen document
document.addEventListener('DOMContentLoaded', function() {
  console.log('Offscreen document DOMContentLoaded event fired');
  initializeOffscreen();
});

// Also try to initialize immediately in case DOMContentLoaded already fired
if (document.readyState === 'loading') {
  console.log('Document still loading, waiting for DOMContentLoaded...');
} else {
  console.log('Document already loaded, initializing immediately...');
  initializeOffscreen();
}

function initializeOffscreen() {
  console.log('Initializing offscreen document...');
  
  try {
    // Initialize Web Audio API
    initAudioContext();
    
    // Start the keep alive mechanism
    startKeepAlive();
    
    // Mark as initialized
    playerState.isInitialized = true;
    
    console.log('Offscreen document initialized, sending ready signal...');
    
    // Send ready signal immediately
    sendReadySignal();
    
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener(handleMessages);
    
    // Add a visibility change listener to ensure we keep playing when the page is hidden
    document.addEventListener('visibilitychange', function() {
      console.log('Visibility changed:', document.visibilityState);
      if (document.visibilityState === 'hidden' && playerState.isPlaying) {
        // Make sure we keep playing in the background
        updateBackgroundStatus();
      }
    });
    
    // Add a before unload listener
    window.addEventListener('beforeunload', function(event) {
      if (playerState.isPlaying) {
        // Try to prevent unloading while playing
        console.log('Attempting to prevent unload while playing');
        
        // Send a final status update
        updateBackgroundStatus();
      }
    });
    
  } catch (error) {
    console.error('Error initializing offscreen document:', error);
  }
}

function sendReadySignal() {
  console.log('Sending ready signal to background...');
  
  try {
    chrome.runtime.sendMessage({
      target: 'background',
      action: 'offscreenReady'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending ready message:', chrome.runtime.lastError.message);
        // Retry sending the ready message
        setTimeout(() => {
          console.log('Retrying ready signal...');
          sendReadySignal();
        }, 1000);
      } else {
        console.log('Ready message sent successfully, response:', response);
      }
    });
  } catch (error) {
    console.error('Exception sending ready signal:', error);
    // Retry after delay
    setTimeout(() => {
      console.log('Retrying ready signal after exception...');
      sendReadySignal();
    }, 1000);
  }
}

// Message handler for offscreen document
function handleMessages(message, sender, sendResponse) {
  // Only handle messages targeting the offscreen document
  if (message.target !== 'offscreen') {
    return false;
  }
  
  console.log('Offscreen received message:', message.action);
  
  try {
    switch (message.action) {
      case 'processText':
        // Check if document is ready
        if (!playerState.isInitialized) {
          sendResponse({ success: false, error: 'Offscreen document not fully initialized' });
          break;
        }
        
        // Update text and settings
        if (message.text) {
          playerState.text = message.text;
          
          // Update settings if provided
          if (message.settings) {
            playerState.settings = { ...playerState.settings, ...message.settings };
          }
          
          // Send processing update
          sendProcessingUpdate('Analyzing text and splitting into chunks...');
          
          // Process the text and start playback
          try {
            processText();
            startPlayback();
            // Send immediate success response
            sendResponse({ success: true });
          } catch (error) {
            console.error('Error processing text:', error);
            sendResponse({ success: false, error: error.message });
          }
        } else {
          sendResponse({ success: false, error: 'No text provided' });
        }
        break;
        
      case 'stopPlayback':
        stopPlayback();
        sendResponse({ success: true });
        break;
        
      case 'heartbeat':
        // Respond to heartbeat to let background know we're still alive
        sendResponse({ 
          alive: true,
          isPlaying: playerState.isPlaying,
          currentChunk: playerState.currentChunk,
          totalChunks: playerState.totalChunks
        });
        break;
        
      case 'cleanup':
        // Clean up resources before document is closed
        performCleanup();
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action: ' + message.action });
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep messaging channel open for async responses
}

// Clean up resources
function performCleanup() {
  console.log('Performing cleanup');
  
  // Stop any playing audio
  if (playerState.audioSource) {
    try {
      playerState.audioSource.stop();
    } catch (e) {
      console.error('Error stopping audio source during cleanup:', e);
    }
    playerState.audioSource = null;
  }
  
  // Close audio context
  if (playerState.audioContext) {
    try {
      if (playerState.audioContext.state !== 'closed') {
        playerState.audioContext.close();
      }
    } catch (e) {
      console.error('Error closing audio context during cleanup:', e);
    }
    playerState.audioContext = null;
  }
  
  // Clear audio cache
  playerState.audioCache = {};
  playerState.audioCacheOrder = [];
  
  // Stop keep alive
  stopKeepAlive();
  
  // Update state
  playerState.isPlaying = false;
  playerState.currentChunk = 0;
  
  console.log('Cleanup completed');
}

// Process text into chunks
function processText() {
  if (!playerState.text) {
    showError('No text provided');
    return;
  }
  
  try {
    // Send processing update
    sendProcessingUpdate('Splitting text into manageable chunks...');
    
    playerState.chunks = splitTextIntoChunks(playerState.text, playerState.settings.chunkSize);
    playerState.totalChunks = playerState.chunks.length;
    playerState.currentChunk = 0;
    
    if (playerState.chunks.length === 0) {
      showError('Failed to process text into chunks');
      return;
    }
    
    const wordCount = countWords(playerState.text);
    console.log(`Text split into ${playerState.chunks.length} chunks (${wordCount} words total)`);
    
    // Send processing update with chunk info
    sendProcessingUpdate(`Preparing to process ${playerState.chunks.length} audio chunks...`);
  } catch (error) {
    showError(`Error processing text: ${error.message}`);
  }
}

// Count words in text
function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Split text into chunks
function splitTextIntoChunks(text, chunkSize) {
  const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [];
  const chunks = [];
  let currentChunk = '';
  
  for (let sentence of sentences) {
    // Clean the sentence
    sentence = sentence.trim();
    if (!sentence) continue;
    
    // If adding this sentence exceeds the chunk size and we already have content,
    // start a new chunk unless the sentence is too long on its own
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
    
    // If current chunk is already over size limit, break it up
    if (currentChunk.length > chunkSize * 1.5) {
      // Try to break at word boundaries
      const words = currentChunk.split(/\s+/);
      let tempChunk = '';
      
      for (let word of words) {
        if (tempChunk.length + word.length + 1 > chunkSize && tempChunk.length > 0) {
          chunks.push(tempChunk.trim());
          tempChunk = word + ' ';
        } else {
          tempChunk += word + ' ';
        }
      }
      
      if (tempChunk.trim().length > 0) {
        currentChunk = tempChunk;
      } else {
        currentChunk = '';
      }
    }
  }
  
  // Add any remaining text as the final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Start playback
function startPlayback() {
  if (playerState.isPlaying) return;
  
  if (playerState.chunks.length === 0) {
    processText();
    if (playerState.chunks.length === 0) {
      showError('No text to play');
      return;
    }
  }
  
  // Send processing update
  sendProcessingUpdate(`Preparing to generate audio for the first chunk...`);
  
  playerState.isPlaying = true;
  
  // Ensure we have a fresh audio context
  initAudioContext();
  
  // Ensure the keep alive mechanism is running
  startKeepAlive();
  
  // Start with the current chunk (or restart)
  processChunk(playerState.currentChunk);
  
  // Update background status
  updateBackgroundStatus();
}

// Cache audio buffer with LRU management
function cacheAudioBuffer(index, buffer) {
  // Store the audio buffer
  playerState.audioCache[index] = buffer;
  
  // Update cache order (move to front as most recently used)
  updateCacheOrder(index);
  
  // Manage cache size
  manageCacheSize();
  
  console.log(`Cached audio for chunk ${index + 1}, cache size: ${Object.keys(playerState.audioCache).length}`);
}

// Update cache order for LRU management
function updateCacheOrder(index) {
  // Remove index if it already exists in order
  const existingIndex = playerState.audioCacheOrder.indexOf(index);
  if (existingIndex > -1) {
    playerState.audioCacheOrder.splice(existingIndex, 1);
  }
  
  // Add to front (most recently used)
  playerState.audioCacheOrder.unshift(index);
}

// Manage cache size using LRU eviction
function manageCacheSize() {
  const maxSize = playerState.settings.maxCacheSize || 10;
  
  while (playerState.audioCacheOrder.length > maxSize) {
    // Remove least recently used item
    const oldestIndex = playerState.audioCacheOrder.pop();
    delete playerState.audioCache[oldestIndex];
    console.log(`Evicted chunk ${oldestIndex + 1} from cache (LRU)`);
  }
}

// Play audio from cache
function playAudioFromCache(index) {
  const buffer = playerState.audioCache[index];
  if (!buffer) {
    console.error(`No cached audio found for chunk ${index + 1}`);
    // Fallback to regular processing
    processChunk(index);
    return;
  }
  
  playAudioBuffer(buffer, index);
}

// Play audio buffer using Web Audio API
async function playAudioBuffer(buffer, index) {
  try {
    // Ensure audio context is ready
    if (!playerState.audioContext) {
      initAudioContext();
    }
    
    if (playerState.audioContext.state === 'suspended') {
      await playerState.audioContext.resume();
    }
    
    // Stop any currently playing audio
    if (playerState.audioSource) {
      try {
        playerState.audioSource.stop();
      } catch (e) {
        console.log('Previous audio source already stopped');
      }
    }
    
    // Decode the audio data
    const audioBuffer = await playerState.audioContext.decodeAudioData(buffer.slice(0));
    
    // Create audio source
    playerState.audioSource = playerState.audioContext.createBufferSource();
    playerState.audioSource.buffer = audioBuffer;
    
    // Connect to destination (speakers)
    playerState.audioSource.connect(playerState.audioContext.destination);
    
    // Set up event handlers
    playerState.audioSource.onended = () => {
      console.log(`Finished playing chunk ${index + 1}`);
      
      // Update status
      try {
        chrome.runtime.sendMessage({
          target: 'background',
          action: 'chunkUpdate',
          currentChunk: index,
          totalChunks: playerState.totalChunks
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Chunk update message error (handled):', chrome.runtime.lastError.message);
          }
        });
      } catch (error) {
        console.log('Error sending chunk update (handled):', error);
      }
      
      // Move to next chunk or end playback
      if (playerState.isPlaying && index < playerState.totalChunks - 1) {
        const nextIndex = index + 1;
        playerState.currentChunk = nextIndex;
        
        // Start preloading next chunk if not already cached
        if (nextIndex + 1 < playerState.totalChunks && !playerState.audioCache[nextIndex + 1]) {
          preloadNextChunk(nextIndex + 1);
        }
        
        // Play next chunk
        setTimeout(() => {
          processChunk(nextIndex);
        }, 100); // Small delay for smooth transition
      } else {
        // Playback completed
        playerState.isPlaying = false;
        stopKeepAlive();
        
        try {
          chrome.runtime.sendMessage({
            target: 'background',
            action: 'playbackEnded'
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Playback ended message error (handled):', chrome.runtime.lastError.message);
            }
          });
        } catch (error) {
          console.log('Error sending playback ended (handled):', error);
        }
      }
    };
    
    playerState.audioSource.onerror = (error) => {
      console.error(`Audio playback error for chunk ${index + 1}:`, error);
      showError(`Audio playback failed for chunk ${index + 1}`);
    };
    
    // Start playback
    playerState.audioSource.start(0);
    
    console.log(`Started playing chunk ${index + 1}/${playerState.totalChunks}`);
    
    // Notify background of playback start
    try {
      chrome.runtime.sendMessage({
        target: 'background',
        action: 'playbackStarted',
        currentChunk: index,
        totalChunks: playerState.totalChunks
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Playback started message error (handled):', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.log('Error sending playback started (handled):', error);
    }
    
    // Start preloading next chunk if needed
    const nextIndex = index + 1;
    if (nextIndex < playerState.totalChunks && !playerState.audioCache[nextIndex] && playerState.preloadingChunk !== nextIndex) {
      // Delay preloading slightly to avoid overwhelming the server
      setTimeout(() => {
        preloadNextChunk(nextIndex);
      }, 1000);
    }
    
  } catch (error) {
    console.error(`Error playing audio buffer for chunk ${index + 1}:`, error);
    showError(`Failed to play audio: ${error.message}`);
    
    // Try to continue with next chunk
    if (index < playerState.totalChunks - 1) {
      setTimeout(() => {
        processChunk(index + 1);
      }, 1000);
    } else {
      playerState.isPlaying = false;
      stopKeepAlive();
      try {
        chrome.runtime.sendMessage({
          target: 'background',
          action: 'playbackError',
          error: error.message
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Playback error message send failed (handled):', chrome.runtime.lastError.message);
          }
        });
      } catch (msgError) {
        console.log('Error sending playback error (handled):', msgError);
      }
    }
  }
}

// Process a chunk of text (main entry point)
async function processChunk(index) {
  try {
    await processChunkInternal(index);
  } catch (error) {
    handleChunkError(index, error, 0);
  }
}

// Preload the next chunk with enhanced error handling
async function preloadNextChunk(index) {
  // Skip if already preloading, out of range, or already cached
  if (index >= playerState.chunks.length || 
      playerState.audioCache[index] || 
      playerState.preloadingChunk === index) {
    return;
  }
  
  playerState.preloadingChunk = index;
  console.log(`Preloading chunk ${index + 1}`);
  
  try {
    const chunk = playerState.chunks[index];
    const apiKey = playerState.settings.apiKey || 'not-needed';
    
    const requestBody = {
      model: 'kokoro',
      voice: playerState.settings.voice,
      input: chunk,
      response_format: 'mp3'
    };

    const response = await fetch(`${playerState.settings.apiUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Preload API request failed with status ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    
    if (buffer.byteLength === 0) {
      throw new Error("Received empty audio data during preload");
    }
    
    const bufferCopy = buffer.slice(0);
    cacheAudioBuffer(index, bufferCopy);
    
    console.log(`Successfully preloaded chunk ${index + 1}`);
  } catch (error) {
    console.error(`Error preloading chunk ${index + 1}:`, error);
    // Don't retry preloading failures - they're not critical
  } finally {
    playerState.preloadingChunk = -1;
  }
}

// Stop playback
function stopPlayback() {
  console.log('Stopping playback');
  
  // Stop any current audio
  if (playerState.audioSource) {
    try {
      playerState.audioSource.stop();
    } catch (e) {
      console.error('Error stopping audio source:', e);
    }
    playerState.audioSource = null;
  }
  
  playerState.isPlaying = false;
  
  // Don't clear the entire cache, just stop playback
  // We'll let the LRU mechanism manage the cache
  
  // Stop the keep alive interval
  stopKeepAlive();
  
  updateBackgroundStatus();
}

// Show error message by sending to background
function showError(message) {
  console.error(message);
  
  try {
    // Send error to background script
    chrome.runtime.sendMessage({
      target: 'background',
      action: 'playbackError',
      error: message
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Silently handle - this is not critical
        console.log('Error message send failed (handled):', chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    // Silently handle messaging errors during shutdown
    console.log('Error sending error message (handled):', error);
  }
}

// Update background script with current status
function updateBackgroundStatus() {
  try {
    chrome.runtime.sendMessage({
      target: 'background',
      action: 'statusUpdate',
      isPlaying: playerState.isPlaying,
      currentChunk: playerState.currentChunk,
      totalChunks: playerState.totalChunks
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Silently handle - this is not critical
        console.log('Status update message error (handled):', chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    // Silently handle messaging errors during shutdown
    console.log('Error sending status update (handled):', error);
  }
}

// Enhanced error handling with retry logic
function handleChunkError(index, error, retryCount = 0) {
  const maxRetries = 3;
  const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
  
  console.error(`Error processing chunk ${index + 1} (attempt ${retryCount + 1}):`, error);
  
  if (retryCount < maxRetries) {
    console.log(`Retrying chunk ${index + 1} in ${retryDelay}ms...`);
    setTimeout(() => {
      processChunkWithRetry(index, retryCount + 1);
    }, retryDelay);
  } else {
    console.error(`Failed to process chunk ${index + 1} after ${maxRetries} attempts`);
    showError(`Failed to generate audio for chunk ${index + 1}`);
    
    // Try to continue with next chunk
    if (index < playerState.totalChunks - 1) {
      setTimeout(() => {
        processChunk(index + 1);
      }, 1000);
    } else {
      playerState.isPlaying = false;
      stopKeepAlive();
      try {
        chrome.runtime.sendMessage({
          target: 'background',
          action: 'playbackError',
          error: `Failed to complete playback`
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Final playback error message send failed (handled):', chrome.runtime.lastError.message);
          }
        });
      } catch (msgError) {
        console.log('Error sending final playback error (handled):', msgError);
      }
    }
  }
}

// Process chunk with retry support
async function processChunkWithRetry(index, retryCount = 0) {
  try {
    await processChunkInternal(index);
  } catch (error) {
    handleChunkError(index, error, retryCount);
  }
}

// Internal chunk processing logic
async function processChunkInternal(index) {
  if (index >= playerState.chunks.length || !playerState.isPlaying) {
    return;
  }
  
  playerState.currentChunk = index;
  const chunk = playerState.chunks[index];
  
  // Update background status
  updateBackgroundStatus();
  
  // Check if we already have this chunk cached
  if (playerState.audioCache[index]) {
    console.log(`Using cached audio for chunk ${index + 1}`);
    updateCacheOrder(index);
    playAudioFromCache(index);
    return;
  }
  
  // Send processing update
  sendProcessingUpdate(`Generating audio for chunk ${index + 1} of ${playerState.totalChunks}...`);
  
  const requestBody = {
    model: 'kokoro',
    voice: playerState.settings.voice,
    input: chunk,
    response_format: 'mp3'
  };
  
  console.log(`Requesting audio for chunk ${index + 1}/${playerState.totalChunks}`);
  
  const apiKey = playerState.settings.apiKey || 'not-needed';
  
  const response = await fetch(`${playerState.settings.apiUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  
  if (buffer.byteLength === 0) {
    throw new Error("Received empty audio data from server");
  }
  
  console.log(`Received audio data for chunk ${index + 1}, size: ${buffer.byteLength} bytes`);
  
  sendProcessingUpdate(`Processing audio for chunk ${index + 1}...`);
  
  const bufferCopy = buffer.slice(0);
  cacheAudioBuffer(index, bufferCopy);
  
  if (playerState.isPlaying && playerState.currentChunk === index) {
    await playAudioBuffer(bufferCopy, index);
  }
}

// Clear all cached audio
function clearAudioCache() {
  playerState.audioCache = {};
  playerState.audioCacheOrder = [];
  console.log('Audio cache cleared');
}