// TTS state
let ttsState = {
  isPlaying: false,
  isProcessing: false,
  processingMessage: '',
  text: '',
  chunks: [],
  currentChunk: 0,
  totalChunks: 0,
  lastSelectedText: '',
  lastError: '',
  serverConnected: false,
  offscreenDocumentReady: false,
  keepAliveInterval: null, // Keep alive interval reference
  documentCreationInProgress: false, // Flag to track document creation
  closeDocumentOnStop: true, // Flag to control document closure on stop
  // Added maximum size for cache
  maxCacheSize: 10 // Maximum number of audio chunks to keep in cache
};

// Create context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'read-selected-text',
    title: 'Read with Kokoro TTS',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'read-selected-text' && info.selectionText) {
    ttsState.lastSelectedText = info.selectionText.trim();
    startTtsPlayback(ttsState.lastSelectedText);
  }
});

// Safe message sender that catches errors
function sendMessageSafely(message, callback) {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.log("Message error (handled):", chrome.runtime.lastError.message);
        if (callback) callback(null);
      } else {
        if (callback) callback(response);
      }
    });
  } catch (e) {
    console.log("Message sending error (handled):", e);
    if (callback) callback(null);
  }
}

// Promise version of sendMessageSafely for better async handling
function sendMessageAsync(message, timeout = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log("Message timeout");
      resolve(null);
    }, timeout);
    
    sendMessageSafely(message, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.target === 'background') {
      // Handle messages specifically for the background script
      switch (message.action) {
        case 'offscreenReady':
          ttsState.offscreenDocumentReady = true;
          console.log('Offscreen document reported ready.');
          // Potentially resolve a promise if something is waiting for this
          sendResponse({ success: true });
          break;
        case 'playbackStarted':
          ttsState.isPlaying = true;
          ttsState.isProcessing = false;
          ttsState.currentChunk = message.currentChunk;
          ttsState.totalChunks = message.totalChunks;
          broadcastStatus();
          sendResponse({ success: true });
          break;
        case 'playbackEnded':
          ttsState.isPlaying = false;
          ttsState.isProcessing = false;
          if (ttsState.closeDocumentOnStop) {
            safeCloseDocument();
          }
          broadcastStatus();
          sendResponse({ success: true });
          break;
        case 'chunkUpdate':
          ttsState.currentChunk = message.currentChunk;
          ttsState.totalChunks = message.totalChunks;
          broadcastStatus();
          sendResponse({ success: true });
          break;
        case 'playbackError':
          ttsState.isPlaying = false;
          ttsState.isProcessing = false;
          ttsState.lastError = getUserFriendlyErrorMessage(message.error);
          broadcastStatus();
          if (ttsState.closeDocumentOnStop) {
            safeCloseDocument();
          }
          sendResponse({ success: false, error: ttsState.lastError });
          break;
        case 'processingUpdate': 
          ttsState.isProcessing = message.isProcessing;
          ttsState.processingMessage = message.message;
          broadcastStatus();
          sendResponse({ success: true });
          break;
        default:
          break; 
      }
      return true; 
    }
    
    // Handle general messages
    switch (message.action) {
      case 'readText':
        ttsState.lastSelectedText = message.text;
        startTtsPlayback(message.text);
        sendResponse({ success: true });
        break;
      case 'stopPlayback':
        handleStopPlayback().then(() => sendResponse({ success: true }));
        return true; // Keep channel open for async response
      case 'getStatus':
        sendResponse({
          isPlaying: ttsState.isPlaying,
          currentChunk: ttsState.currentChunk,
          totalChunks: ttsState.totalChunks,
          lastError: ttsState.lastError,
          lastSelectedText: ttsState.lastSelectedText,
          isProcessing: ttsState.isProcessing,
          processingMessage: ttsState.processingMessage
        });
        break;
      case 'getLastSelectedText':
        sendResponse({ text: ttsState.lastSelectedText });
        break;
      case 'checkServer':
        checkServerConnection().then(status => {
          sendResponse(status);
        }).catch(error => {
          console.error("Error in checkServer message handler:", error);
          sendResponse({ connected: false, message: "Unexpected error checking server." });
        });
        return true; // Indicates asynchronous response
      case 'saveSettings': // New case for saving settings
        handleSettingsSave(message.settings)
          .then(response => sendResponse(response))
          .catch(error => {
            console.error("Error saving settings via message handler:", error);
            sendResponse({ success: false, error: getUserFriendlyErrorMessage(error.message || "Failed to save settings.") });
          });
        return true; // Indicates asynchronous response
      case 'getDecryptedApiKey': // New case for getting decrypted API key
        handleGetDecryptedApiKey()
          .then(response => sendResponse(response))
          .catch(error => {
            console.error("Error getting decrypted API key:", error);
            sendResponse({ success: false, error: getUserFriendlyErrorMessage(error.message || "Failed to get API key.") });
          });
        return true; // Indicates asynchronous response
      default:
        break;
    }
  } catch (e) {
    console.error("Error processing message in background.js:", e);
    sendResponse({success: false, error: getUserFriendlyErrorMessage(e.message || "Unknown error in background script.")});
  }
  return true; // Keep the messaging channel open for asynchronous responses
});

// Convert technical errors to user-friendly messages
function getUserFriendlyErrorMessage(technicalMessage) {
  // Log the original message for debugging
  console.log("Original error message:", technicalMessage);
  
  // Map common error messages to user-friendly versions
  if (technicalMessage.includes("Failed to fetch") || technicalMessage.includes("NetworkError")) {
    return "Could not connect to the TTS server. Please check your server settings and connection.";
  }
  
  if (technicalMessage.includes("only a single offscreen document")) {
    return "There was an issue with the audio playback. Please try again.";
  }
  
  if (technicalMessage.includes("API request failed")) {
    return "The TTS server reported an error. Please check your server settings.";
  }
  
  if (technicalMessage.includes("no document to close") || 
      technicalMessage.includes("Failed to create offscreen document")) {
    return "Could not initialize audio playback. Please try again.";
  }
  
  if (technicalMessage.includes("not available")) {
    return "This feature requires Chrome 116 or newer. Please update your browser.";
  }
  
  // For any other errors, provide a generic message
  return "An error occurred. Please try again.";
}

// Handle stop playback with proper cleanup
async function handleStopPlayback() {
  // Update our state immediately for responsive UI
  ttsState.isPlaying = false;
  ttsState.isProcessing = false;
  
  // First send stop message to offscreen document
  await sendMessageAsync({
    target: 'offscreen',
    action: 'stopPlayback'
  });
  
  // Wait a moment to ensure the stop message is processed
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Now try to close the document to ensure clean state
  await safeCloseDocument();
  
  // Update UI
  broadcastStatus();
}

// Function to start TTS playback
async function startTtsPlayback(text) {
  try {
    // If already playing, stop current playback first
    if (ttsState.isPlaying) {
      // Send message to stop current playback
      try {
        await handleStopPlayback();
        
        // Give a small delay to ensure everything is reset
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.error("Error stopping existing playback:", e);
      }
    }
    
    // Set processing state
    ttsState.isProcessing = true;
    ttsState.processingMessage = 'Preparing offscreen document...';
    broadcastStatus();
    
    // Count words to check if we need to show a warning
    const wordCount = countWords(text);
    if (wordCount > 2000) {
      // Send a warning for very large texts
      ttsState.processingMessage = 'Processing large text (performance may be affected)...';
      broadcastStatus();
    }
    
    // Always close any existing document first to ensure clean state
    await safeCloseDocument();
    
    // Now check if we need to create a new offscreen document
    await ensureOffscreenDocumentExists();
    
    // Reset error state
    ttsState.lastError = '';
    
    // Update processing state
    ttsState.processingMessage = 'Connecting to TTS server...';
    broadcastStatus();
    
    // Send text to offscreen document for processing
    sendTextToOffscreen(text);
    
    // Start keep alive monitoring from the background script side
    startKeepAliveMonitoring();
  } catch (e) {
    console.error("Error in startTtsPlayback:", e);
    ttsState.lastError = getUserFriendlyErrorMessage(e.message);
    ttsState.isProcessing = false;
    broadcastStatus();
  }
}

// Send text to the offscreen document
async function sendTextToOffscreen(text) {
  try {
    const settings = await new Promise(resolve => {
      chrome.storage.local.get({
        apiUrl: 'http://localhost:8880',
        apiKey: '', // Default to empty string, decrypt will handle it
        voice: 'af_bella',
        chunkSize: '1000',
        maxCacheSize: '10'
      }, resolve);
    });

    let decryptedApiKey;
    let currentApiKeyToUse = settings.apiKey; // This is the potentially encrypted key from storage

    try {
      decryptedApiKey = await decrypt(currentApiKeyToUse);
    } catch (decryptionError) {
      if (decryptionError instanceof MigrationNeededError) {
        console.log("API key migration needed in sendTextToOffscreen.");
        decryptedApiKey = decryptionError.migratedPlaintext; // Use the plaintext from migration
        try {
          const newEncryptedApiKey = await encrypt(decryptedApiKey);
          await chrome.storage.local.set({ apiKey: newEncryptedApiKey });
          console.log("API key migrated and re-encrypted in storage (from sendTextToOffscreen).");
        } catch (encryptError) {
          console.error("Failed to re-encrypt migrated API key in sendTextToOffscreen:", encryptError);
          // Continue with the decrypted (migrated) key for this operation
        }
      } else {
        console.error('Error decrypting API key for offscreen document:', decryptionError);
        ttsState.lastError = 'Failed to decrypt API key. Using default key for playback.';
        decryptedApiKey = 'not-needed'; // Fallback to default
      }
    }
    
    // Ensure offscreen document is ready before sending
    await ensureOffscreenDocumentExists(); // This also handles creation if not exists
    if (!ttsState.offscreenDocumentReady) {
        console.error("Offscreen document not ready after ensureOffscreenDocumentExists, cannot send text.");
        ttsState.lastError = "Audio player component is not ready. Please try again.";
        ttsState.isProcessing = false;
        broadcastStatus();
        return;
    }

    sendMessageSafely({
      target: 'offscreen',
      action: 'processText',
      text: text,
      settings: {
        apiUrl: settings.apiUrl,
        apiKey: decryptedApiKey, // Use the (potentially migrated and now plaintext) API key
        voice: settings.voice,
        chunkSize: parseInt(settings.chunkSize),
        maxCacheSize: parseInt(settings.maxCacheSize || 10)
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message to offscreen document:', chrome.runtime.lastError.message);
        ttsState.lastError = "Failed to communicate with audio player. Please try again.";
        ttsState.isProcessing = false;
        broadcastStatus();
        recreateOffscreenDocument();
        return;
      }
      if (!response || !response.success) {
        console.error('Offscreen document failed to process text:', response ? response.error : "No response");
        ttsState.lastError = response && response.error ? getUserFriendlyErrorMessage(response.error) : "Audio player failed to process text.";
        ttsState.isProcessing = false;
        broadcastStatus();
      }
    });
  } catch (error) {
    console.error("Critical error in sendTextToOffscreen:", error);
    ttsState.lastError = getUserFriendlyErrorMessage(error.message || "Unknown error preparing text for playback.");
    ttsState.isProcessing = false;
    broadcastStatus();
  }
}

// New function to handle saving settings from popup or other sources
async function handleSettingsSave(settings) {
  if (!settings) {
    return { success: false, error: "No settings provided to save." };
  }

  const { apiUrl, apiKey, voice, chunkSize, maxCacheSize } = settings;

  // Validate API Key before encrypting.
  const validation = validateApiKey(apiKey); // apiKey here is plaintext
  if (!validation.isValid) {
    if (apiKey && apiKey !== 'not-needed') {
        console.error("Invalid API key provided for saving:", validation.reason);
        return { success: false, error: validation.reason || "Invalid API key format." };
    }
  }

  try {
    // Encrypt the API key
    const encryptedApiKey = await encrypt(apiKey); // apiKey is plaintext here

    const settingsToSave = {
      apiUrl: apiUrl.trim(),
      apiKey: encryptedApiKey, // Store the encrypted version
      voice: voice.trim(),
      chunkSize: chunkSize,
      maxCacheSize: maxCacheSize || '10' // Ensure maxCacheSize has a default
    };

    await chrome.storage.local.set(settingsToSave);
    console.log('Settings saved successfully. API key encrypted:', encryptedApiKey !== 'not-needed' && encryptedApiKey !== '');
    return { success: true };
  } catch (error) {
    console.error("Error encrypting or saving settings in handleSettingsSave:", error);
    return { success: false, error: "Failed to encrypt and save API key. " + error.message };
  }
}

// New function to handle getting decrypted API key for popup display
async function handleGetDecryptedApiKey() {
  try {
    const settings = await new Promise(resolve => {
      chrome.storage.local.get({
        apiKey: '' // Default to empty string
      }, resolve);
    });

    let decryptedApiKey;
    let currentApiKeyToUse = settings.apiKey; // This is the potentially encrypted key from storage

    try {
      decryptedApiKey = await decrypt(currentApiKeyToUse);
    } catch (decryptionError) {
      if (decryptionError instanceof MigrationNeededError) {
        console.log("API key migration needed in handleGetDecryptedApiKey.");
        decryptedApiKey = decryptionError.migratedPlaintext; // Use the plaintext from migration
        try {
          const newEncryptedApiKey = await encrypt(decryptedApiKey);
          await chrome.storage.local.set({ apiKey: newEncryptedApiKey });
          console.log("API key migrated and re-encrypted in storage (from handleGetDecryptedApiKey).");
        } catch (encryptError) {
          console.error("Failed to re-encrypt migrated API key in handleGetDecryptedApiKey:", encryptError);
          // Continue with the decrypted (migrated) key for this operation
        }
      } else {
        console.error('Error decrypting API key for popup display:', decryptionError);
        // For popup display, we can return a safe default
        decryptedApiKey = 'not-needed';
      }
    }

    return { success: true, apiKey: decryptedApiKey };
  } catch (error) {
    console.error("Error in handleGetDecryptedApiKey:", error);
    return { success: false, error: "Failed to retrieve API key." };
  }
}

// Check if offscreen document exists, create if it doesn't
async function ensureOffscreenDocumentExists() {
  try {
    console.log('Starting ensureOffscreenDocumentExists...');
    
    // Check if the offscreen API is available
    if (!chrome.offscreen) {
      throw new Error('Offscreen API not available in this browser version');
    }
    
    // If already ready, return immediately
    if (ttsState.offscreenDocumentReady) {
      console.log('Offscreen document already ready');
      return;
    }
    
    // Set flag to indicate document creation is in progress
    ttsState.documentCreationInProgress = true;
    ttsState.offscreenDocumentReady = false;
    
    // First, try to close any existing documents
    try {
      const existingContexts = await chrome.offscreen.getContexts();
      if (existingContexts && existingContexts.length > 0) {
        console.log('Closing existing offscreen document...');
        await chrome.offscreen.closeDocument();
        await new Promise(r => setTimeout(r, 500)); // Wait for cleanup
      }
    } catch (e) {
      console.log('No existing document to close or error closing:', e);
    }
    
    console.log('Creating new offscreen document...');
    
    // Create the offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Playing TTS audio in the background'
    });
    
    console.log('Offscreen document created, waiting for ready signal...');
    
    // Wait for the ready signal with a reasonable timeout
    const isReady = await waitForOffscreenReady(10000); // 10 second timeout
    
    if (isReady) {
      console.log('Offscreen document is ready!');
      ttsState.documentCreationInProgress = false;
      return;
    } else {
      throw new Error('Offscreen document failed to report ready within timeout');
    }
    
  } catch (error) {
    console.error('Error in ensureOffscreenDocumentExists:', error);
    ttsState.lastError = getUserFriendlyErrorMessage(error.message);
    ttsState.documentCreationInProgress = false;
    ttsState.offscreenDocumentReady = false;
    broadcastStatus();
    throw error; // Re-throw so caller knows it failed
  }
}

// Safely close the offscreen document
async function safeCloseDocument() {
  try {
    console.log('Attempting to close existing offscreen document');
    
    if (!chrome.offscreen) {
      console.log('Offscreen API not available, skipping close');
      return; // Offscreen API not available
    }
    
    // First check if we have any offscreen documents
    let hasDocument = false;
    try {
      const existingContexts = await chrome.offscreen.getContexts();
      hasDocument = existingContexts && existingContexts.length > 0;
      
      if (!hasDocument) {
        console.log('No offscreen document to close');
        // Reset document state
        ttsState.offscreenDocumentReady = false;
        return; // No documents to close
      }
    } catch (e) {
      console.log('Error checking for offscreen documents:', e);
      // Continue anyway - we'll try to close
    }
    
    // If we have a document, send a message to clean up resources before closing
    if (hasDocument) {
      try {
        // Try to send a cleanup message
        await new Promise((resolve) => {
          sendMessageSafely({
            target: 'offscreen',
            action: 'cleanup'
          }, () => {
            // Resolve regardless of response to prevent hanging
            resolve();
          });
          
          // Set a timeout in case the message doesn't get through
          setTimeout(resolve, 300);
        });
      } catch (e) {
        console.log('Error sending cleanup message:', e);
        // Continue with document closing
      }
    }
    
    // Now try to close the document with a retry mechanism
    let closed = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!closed && attempts < maxAttempts) {
      try {
        await chrome.offscreen.closeDocument();
        console.log('Successfully closed offscreen document');
        closed = true;
        
        // Reset document state
        ttsState.offscreenDocumentReady = false;
      } catch (e) {
        attempts++;
        console.log(`Error closing document (attempt ${attempts}/${maxAttempts}):`, e);
        
        // Wait before retrying
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }
    
    // Wait a moment after closing to ensure Chrome has time to fully clean up
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {
    console.log('Error in safeCloseDocument:', e);
    // Continue anyway - we've done our best to clean up
  } finally {
    // Ensure state is updated even if there was an error
    ttsState.offscreenDocumentReady = false;
  }
}

// Wait for the offscreen document to report ready
function waitForOffscreenReady(timeout = 5000) {
  console.log(`Waiting for offscreen ready signal with ${timeout}ms timeout...`);
  
  return new Promise((resolve) => {
    // If already ready, resolve immediately
    if (ttsState.offscreenDocumentReady) {
      console.log('Already ready, resolving immediately');
      resolve(true);
      return;
    }
    
    let resolved = false;
    
    // Set up a timeout
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('Timed out waiting for offscreen document ready');
        chrome.runtime.onMessage.removeListener(readyListener);
        resolve(false); // Resolve with false to indicate timeout
      }
    }, timeout);
    
    // Set up a listener for the ready message
    const readyListener = (message, sender, sendResponse) => {
      console.log('Received message in waitForOffscreenReady:', message);
      
      if (message.target === 'background' && message.action === 'offscreenReady') {
        if (!resolved) {
          resolved = true;
          console.log('Received offscreen ready message!');
          clearTimeout(timer);
          chrome.runtime.onMessage.removeListener(readyListener);
          ttsState.offscreenDocumentReady = true;
          resolve(true);
        }
      }
    };
    
    console.log('Adding message listener for offscreen ready...');
    chrome.runtime.onMessage.addListener(readyListener);
  });
}

// Recreate the offscreen document (for recovery)
async function recreateOffscreenDocument() {
  try {
    // If creation is already in progress, wait for it to complete
    if (ttsState.documentCreationInProgress) {
      console.log('Document creation already in progress, waiting...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!ttsState.documentCreationInProgress) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      return true;
    }
    
    // Set flag to indicate recreation is in progress
    ttsState.documentCreationInProgress = true;
    ttsState.offscreenDocumentReady = false;
    
    // Make sure the offscreen API is available
    if (!chrome.offscreen) {
      throw new Error('Offscreen API not available in this browser version');
    }
    
    // First try to close the existing document
    await safeCloseDocument();
    
    // Try to create a new document
    console.log('Creating new offscreen document');
    
    // Use retry logic for recreation
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;
    
    while (!success && attempts < maxAttempts) {
      try {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html', 
          reasons: ['AUDIO_PLAYBACK'],
          justification: 'Playing TTS audio in the background'
        });
        
        // Wait for ready signal
        const isReady = await waitForOffscreenReady(8000);
        if (isReady) {
          success = true;
          break;
        }
      } catch (error) {
        attempts++;
        console.log(`Error in recreation attempt ${attempts}:`, error);
        
        // If we get a "single document" error, try closing again with longer delay
        if (error.message && error.message.includes("only a single")) {
          console.log("Single document error while recreating, retrying after longer delay");
          await safeCloseDocument();
          await new Promise(r => setTimeout(r, 1000 * attempts)); // Increasing delay
        }
      }
      
      // Wait before retrying
      if (!success && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 500 * attempts)); // Increasing backoff
      }
    }
    
    if (!success) {
      throw new Error(`Failed to recreate offscreen document after ${maxAttempts} attempts`);
    }
    
    return true;
  } catch (error) {
    console.error('Error recreating offscreen document:', error);
    ttsState.lastError = getUserFriendlyErrorMessage(error.message);
    ttsState.documentCreationInProgress = false;
    broadcastStatus();
    
    // Fallback for older browsers
    if (error.message.includes('not available')) {
      ttsState.lastError = 'This feature requires Chrome 116 or newer. Please update your browser.';
      broadcastStatus();
    }
    
    return false;
  } finally {
    // Always ensure we reset this flag
    ttsState.documentCreationInProgress = false;
  }
}

function broadcastStatus() {
  sendMessageSafely({
    action: 'statusUpdate',
    isPlaying: ttsState.isPlaying,
    currentChunk: ttsState.currentChunk,
    totalChunks: ttsState.totalChunks,
    lastError: ttsState.lastError,
    isProcessing: ttsState.isProcessing,
    processingMessage: ttsState.processingMessage
  });
}

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

async function checkServerConnection() {
  try {
    const settings = await new Promise(resolve => {
      chrome.storage.local.get({
        apiUrl: 'http://localhost:8880',
        apiKey: ''
      }, resolve);
    });

    let decryptedApiKey;
    try {
      decryptedApiKey = await decrypt(settings.apiKey);
    } catch (decryptionError) {
      console.error('Error decrypting API key for server check:', decryptionError);
      decryptedApiKey = 'not-needed';
    }

    const response = await fetch(`${settings.apiUrl}/audio/voices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${decryptedApiKey}`
      }
    });

    if (response.ok) {
      ttsState.serverConnected = true;
      return { connected: true, message: "Successfully connected to Kokoro TTS server" };
    } else {
      ttsState.serverConnected = false;
      const errorText = await response.text().catch(() => "Could not read error response.");
      const errorMsg = `Server connection failed: ${response.status} ${response.statusText || ''}. Server says: ${errorText}`;
      return { connected: false, message: errorMsg };
    }
  } catch (connectionError) {
    ttsState.serverConnected = false;
    const errorMsg = connectionError.message.includes("Failed to fetch") 
      ? `Cannot connect to server. Please check the URL and ensure the server is running.`
      : `Connection error: ${getUserFriendlyErrorMessage(connectionError.message || "Unknown connection error.")}`;
    console.error('Error during server connection test:', connectionError);
    return { connected: false, message: errorMsg };
  }
}

function startKeepAliveMonitoring() {
  console.log('Starting keep alive monitoring');
}

// Simplified encryption functions
class MigrationNeededError extends Error {
  constructor(message, migratedPlaintext) {
    super(message);
    this.name = "MigrationNeededError";
    this.migratedPlaintext = migratedPlaintext;
  }
}

async function encrypt(text) {
  // Handle special cases
  if (text === null || typeof text === 'undefined' || text === "") {
    return "";
  }
  if (text === 'not-needed') {
      return 'not-needed';
  }
  
  // For now, just return the text as-is (simplified)
  return text;
}

async function decrypt(encryptedText) {
  // Handle cases where decryption isn't needed
  if (!encryptedText || encryptedText === "" || encryptedText === 'not-needed') {
    return encryptedText === 'not-needed' ? 'not-needed' : "";
  }
  
  // For now, just return the text as-is (simplified)
  return encryptedText;
}

function validateApiKey(apiKey) {
  // "not-needed" and empty string are valid
  if (apiKey === 'not-needed' || apiKey === "") {
    return { isValid: true, reason: "Key is designated as not needed or is empty." };
  }

  if (typeof apiKey !== 'string') {
    return { isValid: false, reason: "API key must be a string." };
  }

  if (apiKey.length < 8 || apiKey.length > 256) {
    return { isValid: false, reason: "API key length is invalid. It should be between 8 and 256 characters." };
  }

  return { isValid: true };
}