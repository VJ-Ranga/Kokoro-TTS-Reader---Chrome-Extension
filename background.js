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

// Check if offscreen document exists, create if it doesn't
async function ensureOffscreenDocumentExists() {
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
      
      // After waiting, check if document is now available
      if (ttsState.offscreenDocumentReady) {
        console.log('Document is now ready after waiting');
        return;
      }
    }
    
    // Check if the offscreen API is available
    if (!chrome.offscreen) {
      throw new Error('Offscreen API not available in this browser version');
    }
    
    // Set flag to indicate document creation is in progress
    // Do this BEFORE any async operations to prevent race conditions
    ttsState.documentCreationInProgress = true;
    ttsState.offscreenDocumentReady = false;
    
    // Check if we already have an offscreen document
    let hasExistingDocument = false;
    try {
      const existingContexts = await chrome.offscreen.getContexts();
      hasExistingDocument = existingContexts && existingContexts.length > 0;
    } catch (e) {
      console.log('Error checking for existing documents:', e);
    }
    
    // If we have an existing document, close it first
    if (hasExistingDocument) {
      console.log('Existing document found, closing it first');
      try {
        await chrome.offscreen.closeDocument();
        console.log('Successfully closed existing document');
        
        // Add a delay after closing to avoid race conditions
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.log('Error closing existing document:', e);
        // Continue anyway - the document might have been closed already
      }
    }
    
    // Create a new offscreen document with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        console.log(`Creating offscreen document (attempt ${attempts + 1}/${maxAttempts})`);
        await chrome.offscreen.createDocument({
          url: 'offscreen.html', 
          reasons: ['AUDIO_PLAYBACK'],
          justification: 'Playing TTS audio in the background'
        });
        
        // Wait for the offscreen document to report ready with a timeout
        const isReady = await waitForOffscreenReady(8000);
        
        if (isReady) {
          console.log('Offscreen document created and ready');
          return;
        } else {
          console.log('Offscreen document failed to become ready, retrying...');
          // Try to close the document before retrying
          await safeCloseDocument();
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        console.log(`Error creating document (attempt ${attempts + 1}):`, error);
        
        // If error contains "only a single offscreen document may be created"
        if (error.message && error.message.includes("only a single")) {
          console.log("Single document error detected, trying to close and retry");
          await safeCloseDocument();
          await new Promise(r => setTimeout(r, 1000)); // Longer delay for retry
        }
      }
      
      attempts++;
      
      // Wait before retrying
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 500 * attempts)); // Increasing backoff
      }
    }
    
    if (attempts >= maxAttempts) {
      throw new Error(`Failed to create offscreen document after ${maxAttempts} attempts`);
    }
  } catch (error) {
    console.error('Error ensuring offscreen document exists:', error);
    ttsState.lastError = getUserFriendlyErrorMessage(error.message);
    ttsState.documentCreationInProgress = false;
    broadcastStatus();
    
    // Fallback for older browsers
    if (error.message.includes('not available')) {
      ttsState.lastError = 'This feature requires Chrome 116 or newer. Please update your browser.';
      broadcastStatus();
    }
  } finally {
    // Always make sure to reset the creation flag
    ttsState.documentCreationInProgress = false;
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
  return new Promise((resolve) => {
    // If already ready, resolve immediately
    if (ttsState.offscreenDocumentReady) {
      resolve(true);
      return;
    }
    
    // Set up a timeout
    const timer = setTimeout(() => {
      console.log('Timed out waiting for offscreen document ready');
      chrome.runtime.onMessage.removeListener(readyListener);
      resolve(false); // Resolve with false to indicate timeout
    }, timeout);
    
    // Set up a listener for the ready message
    const readyListener = (message) => {
      if (message.target === 'background' && message.action === 'offscreenReady') {
        console.log('Received offscreen ready message');
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(readyListener);
        ttsState.offscreenDocumentReady = true;
        resolve(true);
      }
    };
    
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

// Check if offscreen document exists
async function hasOffscreenDocument() {
  try {
    // Check if offscreen API is fully available
    if (!chrome.offscreen || typeof chrome.offscreen.getContexts !== 'function') {
      console.log('Offscreen API not fully available, assuming no document exists');
      return false;
    }
    
    try {
      const existingContexts = await chrome.offscreen.getContexts();
      return existingContexts && existingContexts.length > 0;
    } catch (e) {
      // If getContexts throws an error, handle it gracefully
      console.log('Error in getContexts, assuming no document exists:', e);
      return false;
    }
  } catch (error) {
    console.error('Error checking for offscreen document:', error);
    // If there's an error, assume we need to create a new document
    return false;
  }
}

// Broadcast status to the popup with error handling
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

// Count words in text
function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Function to check server connection
async function checkServerConnection() {
  try {
    const settings = await new Promise(resolve => {
      chrome.storage.local.get({
        apiUrl: 'http://localhost:8880',
        apiKey: '' // Default to empty string, decrypt will handle it
      }, resolve);
    });

    let decryptedApiKey;
    let currentApiKeyToUse = settings.apiKey; // This is the potentially encrypted key from storage

    try {
      decryptedApiKey = await decrypt(currentApiKeyToUse);
    } catch (decryptionError) {
      if (decryptionError instanceof MigrationNeededError) {
        console.log("API key migration needed in checkServerConnection.");
        decryptedApiKey = decryptionError.migratedPlaintext; // Use the plaintext from migration
        try {
          const newEncryptedApiKey = await encrypt(decryptedApiKey);
          await chrome.storage.local.set({ apiKey: newEncryptedApiKey });
          console.log("API key migrated and re-encrypted in storage (from checkServerConnection).");
        } catch (encryptError) {
          console.error("Failed to re-encrypt migrated API key in checkServerConnection:", encryptError);
          // Continue with the decrypted (migrated) key for this check
        }
      } else {
        console.error('Error decrypting API key for server check:', decryptionError);
        ttsState.lastError = 'Failed to decrypt API key. Using default key for connection test.';
        decryptedApiKey = 'not-needed'; // Fallback to default for this check
      }
    }

    ttsState.lastError = ''; // Reset error before new check

    const response = await fetch(`${settings.apiUrl}/audio/voices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${decryptedApiKey}` // Use the (potentially migrated and now plaintext) API key
      }
    });

    if (response.ok) {
      ttsState.serverConnected = true;
      return { connected: true, message: "Successfully connected to Kokoro TTS server" };
    } else {
      ttsState.serverConnected = false;
      const errorText = await response.text().catch(() => "Could not read error response.");
      const errorMsg = `Server connection failed: ${response.status} ${response.statusText || ''}. Server says: ${errorText}`;
      ttsState.lastError = errorMsg;
      return { connected: false, message: errorMsg };
    }
  } catch (connectionError) {
    ttsState.serverConnected = false;
    let apiUrlForError = 'http://localhost:8880'; // Default
    try {
        const storedSettings = await chrome.storage.local.get('apiUrl');
        if (storedSettings.apiUrl) apiUrlForError = storedSettings.apiUrl;
    } catch(e) { /* ignore, use default */ }

    const errorMsg = connectionError.message.includes("Failed to fetch") 
      ? `Cannot connect to server at ${ (new URL(apiUrlForError)).origin }. Please check the URL and ensure the server is running.`
      : `Connection error: ${getUserFriendlyErrorMessage(connectionError.message || "Unknown connection error.")}`;
    ttsState.lastError = errorMsg;
    console.error('Error during server connection test:', connectionError);
    return { connected: false, message: errorMsg };
  }
}

// New function to handle saving settings from popup or other sources
async function handleSettingsSave(settings) {
  if (!settings) {
    return { success: false, error: "No settings provided to save." };
  }

  const { apiUrl, apiKey, voice, chunkSize, maxCacheSize } = settings;

  // Validate API Key before encrypting.
  // 'not-needed' or empty string are considered valid special cases by validateApiKey.
  // The encrypt function will also handle these by returning them as-is or as an empty string.
  const validation = validateApiKey(apiKey); // apiKey here is plaintext
  if (!validation.isValid) {
    // Only error out if the key is not empty and not 'not-needed' but still invalid.
    // If apiKey is "" or "not-needed", validateApiKey might say invalid based on length,
    // but these are acceptable values to store (encrypt will handle them).
    if (apiKey && apiKey !== 'not-needed') {
        console.error("Invalid API key provided for saving:", validation.reason);
        return { success: false, error: validation.reason || "Invalid API key format." };
    }
  }

  try {
    // Encrypt the API key (encrypt function handles "" and "not-needed" appropriately)
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

// --- Refined AES-GCM Encryption Suite (256-bit) ---
class MigrationNeededError extends Error {
  constructor(message, migratedPlaintext) {
    super(message);
    this.name = "MigrationNeededError";
    this.migratedPlaintext = migratedPlaintext;
  }
}

// Constants for key derivation
const DERIVED_KEY_NAME = 'kokoro_tts_derived_encryption_key_v3'; // v3 for new derivation
const SALT_NAME = 'kokoro_tts_salt_v3'; // v3 for new salt
const BASE_MATERIAL_NAME = 'kokoro_tts_base_key_material_v3'; // v3 for new base material
const ITERATIONS = 200000; // Increased iterations for PBKDF2

async function getEncryptionKey() {
  // Try to get the already derived key
  let { [DERIVED_KEY_NAME]: storedKeyMaterial } = await chrome.storage.local.get(DERIVED_KEY_NAME);
  if (storedKeyMaterial) {
    try {
      return await crypto.subtle.importKey(
        "raw",
        Uint8Array.from(atob(storedKeyMaterial), c => c.charCodeAt(0)).buffer,
        { name: "AES-GCM" }, // Algorithm for the key
        false, // Not extractable
        ["encrypt", "decrypt"] // Key usages
      );
    } catch (e) {
      console.error("Failed to import stored derived key, will regenerate. Error:", e);
      // Fall through to regenerate, remove potentially corrupted key
      await chrome.storage.local.remove(DERIVED_KEY_NAME);
    }
  }

  // If derived key isn't there or failed to import, generate it
  // 1. Get or create a salt
  let { [SALT_NAME]: saltString } = await chrome.storage.local.get(SALT_NAME);
  let saltBuffer;
  if (!saltString) {
    const saltArray = crypto.getRandomValues(new Uint8Array(16)); // 16-byte salt
    saltString = btoa(String.fromCharCode.apply(null, saltArray));
    await chrome.storage.local.set({ [SALT_NAME]: saltString });
    saltBuffer = saltArray.buffer;
  } else {
    saltBuffer = Uint8Array.from(atob(saltString), c => c.charCodeAt(0)).buffer;
  }

  // 2. Get or create base key material (this is the "password" for PBKDF2)
  let { [BASE_MATERIAL_NAME]: baseMaterialString } = await chrome.storage.local.get(BASE_MATERIAL_NAME);
  let baseMaterialBuffer;
  if (!baseMaterialString) {
    const newBaseMaterialArray = crypto.getRandomValues(new Uint8Array(32)); // 32-byte base material
    baseMaterialString = btoa(String.fromCharCode.apply(null, newBaseMaterialArray));
    await chrome.storage.local.set({ [BASE_MATERIAL_NAME]: baseMaterialString });
    baseMaterialBuffer = newBaseMaterialArray.buffer;
  } else {
    baseMaterialBuffer = Uint8Array.from(atob(baseMaterialString), c => c.charCodeAt(0)).buffer;
  }
  
  // 3. Import the base material as a CryptoKey for PBKDF2
  let importedBaseKey;
  try {
    importedBaseKey = await crypto.subtle.importKey(
        "raw",
        baseMaterialBuffer,
        { name: "PBKDF2" }, // Specify the algorithm for which the key is to be used
        false, // Not extractable
        ["deriveKey"] // Usage: for deriving other keys
    );
  } catch (e) {
      console.error("Failed to import base material for PBKDF2. Error:", e);
      // This is a critical failure if the base material is somehow corrupt and cannot be imported.
      // For robustness, one might try to regenerate base material here, but that would mean
      // existing encrypted data becomes undecryptable. For now, let the error propagate.
      throw new Error("Could not prepare base key material for encryption key derivation.");
  }

  // 4. Derive the AES-GCM key using PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256", // Hash function for PBKDF2
    },
    importedBaseKey, // The imported base key material
    { name: "AES-GCM", length: 256 }, // Desired algorithm and length for the derived key
    false, // Not extractable
    ["encrypt", "decrypt"] // Usages for the derived key
  );

  // 5. Store the derived key (as raw material) for future use
  const exportedKeyMaterial = await crypto.subtle.exportKey("raw", derivedKey);
  await chrome.storage.local.set({ 
    [DERIVED_KEY_NAME]: btoa(String.fromCharCode.apply(null, new Uint8Array(exportedKeyMaterial))) 
  });
  
  console.log("New AES-GCM 256-bit derived encryption key generated and stored.");
  return derivedKey;
}

async function encrypt(text) {
  // Handle special cases: null, undefined, empty string, or "not-needed"
  if (text === null || typeof text === 'undefined' || text === "") {
    return ""; // Encrypting an empty string results in an empty string representation for storage
  }
  if (text === 'not-needed') {
      return 'not-needed'; // "not-needed" is a special marker, store as is
  }

  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard IV size is 12 bytes
  const encodedText = new TextEncoder().encode(text); // Convert plaintext to Uint8Array

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv }, // Algorithm parameters: specify AES-GCM and the IV
    key, // The encryption key
    encodedText // The data to encrypt
  );

  // Combine IV and ciphertext for storage: IV (12 bytes) + Ciphertext
  const resultBuffer = new Uint8Array(iv.length + ciphertext.byteLength);
  resultBuffer.set(iv); // Prepend IV
  resultBuffer.set(new Uint8Array(ciphertext), iv.length); // Append ciphertext
  
  // Convert to Base64 string with a prefix for easy identification
  return `aesgcm:${btoa(String.fromCharCode.apply(null, resultBuffer))}`;
}

// Heuristic to detect if a string *might* be an old Base64 encoded key
function isOldBase64Format(text) {
  if (!text || typeof text !== 'string') return false;
  // If it has our new prefix, it's not old format.
  // "not-needed" is also not old format.
  if (text.startsWith('aesgcm:') || text === 'not-needed') {
    return false;
  }
  // Try to decode it. If it decodes without error, it's likely Base64.
  // This is a simple check; more robust validation might be needed if non-Base64 strings
  // could accidentally pass this.
  try {
    // Check for typical Base64 characters and padding.
    // A valid Base64 string's length is a multiple of 4.
    if (text.length % 4 !== 0) return false;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return false;

    atob(text); // If this doesn't throw, it's valid Base64
    return true;
  } catch (e) {
    return false; // Not valid Base64
  }
}

async function decrypt(encryptedText) {
  // Handle cases where decryption isn't needed or possible
  if (!encryptedText || encryptedText === "" || encryptedText === 'not-needed') {
    return encryptedText === 'not-needed' ? 'not-needed' : "";
  }

  // Check for old Base64 format and trigger migration if detected
  if (isOldBase64Format(encryptedText)) {
    console.log("Old Base64 format API key detected during decryption attempt.");
    try {
      const plaintext = atob(encryptedText);
      // Throw a special error to signal that migration is needed.
      // The caller should catch this, re-encrypt the plaintext, and update storage.
      throw new MigrationNeededError("API key is in old Base64 format and needs migration.", plaintext);
    } catch (e_atob) {
      console.error("Failed to decode suspected old Base64 format API key during migration attempt:", e_atob, "Value was:", encryptedText);
      // If it looked like Base64 but failed to decode, it's an invalid/corrupt key.
      throw new Error("Invalid API key: suspected old Base64 format but failed to decode.");
    }
  }

  // If not old format, it must have the 'aesgcm:' prefix for new encrypted keys
  if (!encryptedText.startsWith('aesgcm:')) {
    console.warn(`API key is not in a recognizable encrypted format: "${encryptedText}". It lacks the 'aesgcm:' prefix and wasn't identified as old Base64.`);
    // This could be an unencrypted key saved by mistake, or a corrupted key.
    // If it's not "not-needed" or empty, and not a known format, it's an issue.
    // Throw an error as we cannot decrypt it.
    throw new Error(`Invalid API key format for decryption. Value: "${encryptedText}"`);
  }

  const key = await getEncryptionKey();
  const encryptedDataB64 = encryptedText.substring('aesgcm:'.length);
  let encryptedData;
  try {
    encryptedData = Uint8Array.from(atob(encryptedDataB64), c => c.charCodeAt(0));
  } catch (e) {
    console.error("Failed to Base64 decode the AES-GCM ciphertext part:", e);
    throw new Error("Invalid AES-GCM ciphertext encoding (Base64 decoding failed).");
  }

  if (encryptedData.length < 12) { // IV is 12 bytes
    console.error("AES-GCM encrypted data is too short (less than 12 bytes for IV).");
    throw new Error("Invalid AES-GCM encrypted data: too short to contain IV.");
  }

  const iv = encryptedData.slice(0, 12); // Extract the IV (first 12 bytes)
  const ciphertext = encryptedData.slice(12); // The rest is the ciphertext

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv }, // Algorithm parameters
      key, // The decryption key
      ciphertext // The data to decrypt
    );
    return new TextDecoder().decode(decryptedBuffer); // Decode Uint8Array back to string
  } catch (error) {
    console.error("AES-GCM decryption failed:", error);
    // This error is critical. It might mean the key is wrong, data is corrupt,
    // or the key derivation changed incompatibly.
    throw new Error('Failed to decrypt API key with AES-GCM. The key might be corrupted, from a different installation, or the encryption method changed.');
  }
}

// Validate the format of a plaintext API key
function validateApiKey(apiKey) {
  // "not-needed" and empty string are considered valid special cases (bypass other checks)
  if (apiKey === 'not-needed' || apiKey === "") {
    return { isValid: true, reason: "Key is designated as not needed or is empty." };
  }

  if (typeof apiKey !== 'string') {
    return { isValid: false, reason: "API key must be a string." };
  }

  // Example: Check for a reasonable length. Adjust as per actual API key constraints.
  // This is a basic check; more specific rules (e.g., character sets) can be added.
  if (apiKey.length < 8 || apiKey.length > 256) {
    return { isValid: false, reason: "API key length is invalid. It should be between 8 and 256 characters." };
  }
  
  // Example: Check for non-printable characters (optional, depends on key format)
  // if (/[\\x00-\\x1F\\x7F]/.test(apiKey)) {
  //   return { isValid: false, reason: "API key contains non-printable characters." };
  // }

  return { isValid: true };
}
// --- End of Refined AES-GCM Encryption Suite ---