    await chrome.storage.local.set(settingsToSave);
    console.log('Settings saved successfully. API key encrypted:', encryptedApiKey !== 'not-needed' && encryptedApiKey !== '');
    return { success: true };
  } catch (error) {
    console.error("Error encrypting or saving settings in handleSettingsSave:", error);
    return { success: false, error: "Failed to encrypt and save API key. " + error.message };
  }
}

// Function to get available voices from server
async function handleGetVoices(forceRefresh = false) {
  const now = Date.now();
  
  // Return cached voices if available and not expired
  if (!forceRefresh && voiceCache.voices.length > 0 && (now - voiceCache.lastFetched) < voiceCache.cacheTimeout) {
    console.log('Returning cached voices');
    return { success: true, voices: voiceCache.voices };
  }
  
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
      if (decryptionError instanceof MigrationNeededError) {
        console.log("API key migration needed in handleGetVoices.");
        decryptedApiKey = decryptionError.migratedPlaintext;
        try {
          const newEncryptedApiKey = await encrypt(decryptedApiKey);
          await chrome.storage.local.set({ apiKey: newEncryptedApiKey });
          console.log("API key migrated and re-encrypted in storage (from handleGetVoices).");
        } catch (encryptError) {
          console.error("Failed to re-encrypt migrated API key in handleGetVoices:", encryptError);
        }
      } else {
        console.error('Error decrypting API key for voice fetching:', decryptionError);
        decryptedApiKey = 'not-needed';
      }
    }

    console.log('Fetching voices from server...');
    const response = await fetch(`${settings.apiUrl}/audio/voices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${decryptedApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Could not read error response.");
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const voicesData = await response.json();
    
    // Handle different response formats from Kokoro API
    let voices = [];
    
    if (Array.isArray(voicesData)) {
      // Direct array of voices
      voices = voicesData;
    } else if (voicesData.voices && Array.isArray(voicesData.voices)) {
      // Wrapped in voices property
      voices = voicesData.voices;
    } else if (voicesData.data && Array.isArray(voicesData.data)) {
      // Wrapped in data property (OpenAI-style)
      voices = voicesData.data;
    } else {
      console.warn('Unexpected voices response format:', voicesData);
      voices = [];
    }
    
    // Normalize voice objects
    const normalizedVoices = voices.map(voice => {
      if (typeof voice === 'string') {
        return { id: voice, name: voice };
      } else if (typeof voice === 'object') {
        return {
          id: voice.id || voice.name || voice.voice_id,
          name: voice.name || voice.id || voice.voice_id,
          language: voice.language || voice.lang || 'Unknown',
          gender: voice.gender || 'Unknown',
          description: voice.description || ''
        };
      }
      return { id: 'unknown', name: 'Unknown Voice' };
    });
    
    // Update cache
    voiceCache.voices = normalizedVoices;
    voiceCache.lastFetched = now;
    
    console.log(`Successfully fetched ${normalizedVoices.length} voices`);
    return { success: true, voices: normalizedVoices };
    
  } catch (error) {
    console.error('Error fetching voices:', error);
    
    // Return cached voices if available, even if expired
    if (voiceCache.voices.length > 0) {
      console.log('Returning stale cached voices due to error');
      return { success: true, voices: voiceCache.voices, warning: 'Using cached voices (server unavailable)' };
    }
    
    return { 
      success: false, 
      error: error.message.includes('Failed to fetch') 
        ? 'Cannot connect to server. Please check your API URL and ensure the server is running.'
        : getUserFriendlyErrorMessage(error.message)
    };
  }
}

// Function to preview a voice
async function handlePreviewVoice(voiceId, text) {
  if (!voiceId) {
    return { success: false, error: 'Voice ID is required for preview' };
  }
  
  if (!text) {
    text = 'Hello, this is a preview of the selected voice.';
  }
  
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
      if (decryptionError instanceof MigrationNeededError) {
        console.log("API key migration needed in handlePreviewVoice.");
        decryptedApiKey = decryptionError.migratedPlaintext;
        try {
          const newEncryptedApiKey = await encrypt(decryptedApiKey);
          await chrome.storage.local.set({ apiKey: newEncryptedApiKey });
          console.log("API key migrated and re-encrypted in storage (from handlePreviewVoice).");
        } catch (encryptError) {
          console.error("Failed to re-encrypt migrated API key in handlePreviewVoice:", encryptError);
        }
      } else {
        console.error('Error decrypting API key for voice preview:', decryptionError);
        decryptedApiKey = 'not-needed';
      }
    }

    console.log(`Previewing voice: ${voiceId}`);
    
    // Create a shorter text for preview to make it quick
    const previewText = text.length > 50 ? text.substring(0, 50) + '...' : text;
    
    const response = await fetch(`${settings.apiUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${decryptedApiKey}`
      },
      body: JSON.stringify({
        model: 'kokoro',
        voice: voiceId,
        input: previewText,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Could not read error response.");
      throw new Error(`Preview failed: ${response.status} ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    if (audioBuffer.byteLength === 0) {
      throw new Error("Received empty audio data for preview");
    }
    
    // Create a simple audio playback for preview
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    // Play the preview
    audio.play().catch(playError => {
      console.error('Error playing preview audio:', playError);
      URL.revokeObjectURL(audioUrl);
      throw new Error('Failed to play preview audio');
    });
    
    // Clean up the URL after playing
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl);
    });
    
    // Also clean up if there's an error
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(audioUrl);
    });
    
    console.log('Voice preview started successfully');
    return { success: true, message: 'Voice preview started' };
    
  } catch (error) {
    console.error('Error in voice preview:', error);
    return { 
      success: false, 
      error: error.message.includes('Failed to fetch') 
        ? 'Cannot connect to server for voice preview. Please check your connection.'
        : getUserFriendlyErrorMessage(error.message)
    };
  }
}

// Simple encryption functions (simplified for this fix)
async function encrypt(text) {
  if (text === null || typeof text === 'undefined' || text === "") {
    return "";
  }
  if (text === 'not-needed') {
    return 'not-needed';
  }
  // For now, just return the text as-is (you can implement proper encryption later)
  return text;
}

async function decrypt(encryptedText) {
  if (!encryptedText || encryptedText === "" || encryptedText === 'not-needed') {
    return encryptedText === 'not-needed' ? 'not-needed' : "";
  }
  // For now, just return the text as-is (you can implement proper decryption later)
  return encryptedText;
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
const DERIVED_KEY_NAME = 'kokoro_tts_derived_encryption_key_v3';
const SALT_NAME = 'kokoro_tts_salt_v3';
const BASE_MATERIAL_NAME = 'kokoro_tts_base_key_material_v3';
const ITERATIONS = 200000;

async function getEncryptionKey() {
  let { [DERIVED_KEY_NAME]: storedKeyMaterial } = await chrome.storage.local.get(DERIVED_KEY_NAME);
  if (storedKeyMaterial) {
    try {
      return await crypto.subtle.importKey(
        "raw",
        Uint8Array.from(atob(storedKeyMaterial), c => c.charCodeAt(0)).buffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
    } catch (e) {
      console.error("Failed to import stored derived key, will regenerate. Error:", e);
      await chrome.storage.local.remove(DERIVED_KEY_NAME);
    }
  }

  let { [SALT_NAME]: saltString } = await chrome.storage.local.get(SALT_NAME);
  let saltBuffer;
  if (!saltString) {
    const saltArray = crypto.getRandomValues(new Uint8Array(16));
    saltString = btoa(String.fromCharCode.apply(null, saltArray));
    await chrome.storage.local.set({ [SALT_NAME]: saltString });
    saltBuffer = saltArray.buffer;
  } else {
    saltBuffer = Uint8Array.from(atob(saltString), c => c.charCodeAt(0)).buffer;
  }

  let { [BASE_MATERIAL_NAME]: baseMaterialString } = await chrome.storage.local.get(BASE_MATERIAL_NAME);
  let baseMaterialBuffer;
  if (!baseMaterialString) {
    const newBaseMaterialArray = crypto.getRandomValues(new Uint8Array(32));
    baseMaterialString = btoa(String.fromCharCode.apply(null, newBaseMaterialArray));
    await chrome.storage.local.set({ [BASE_MATERIAL_NAME]: baseMaterialString });
    baseMaterialBuffer = newBaseMaterialArray.buffer;
  } else {
    baseMaterialBuffer = Uint8Array.from(atob(baseMaterialString), c => c.charCodeAt(0)).buffer;
  }
  
  let importedBaseKey;
  try {
    importedBaseKey = await crypto.subtle.importKey(
        "raw",
        baseMaterialBuffer,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
  } catch (e) {
      console.error("Failed to import base material for PBKDF2. Error:", e);
      throw new Error("Could not prepare base key material for encryption key derivation.");
  }

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    importedBaseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  const exportedKeyMaterial = await crypto.subtle.exportKey("raw", derivedKey);
  await chrome.storage.local.set({ 
    [DERIVED_KEY_NAME]: btoa(String.fromCharCode.apply(null, new Uint8Array(exportedKeyMaterial))) 
  });
  
  console.log("New AES-GCM 256-bit derived encryption key generated and stored.");
  return derivedKey;
}

async function encrypt(text) {
  if (text === null || typeof text === 'undefined' || text === "") {
    return "";
  }
  if (text === 'not-needed') {
      return 'not-needed';
  }

  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encodedText
  );

  const resultBuffer = new Uint8Array(iv.length + ciphertext.byteLength);
  resultBuffer.set(iv);
  resultBuffer.set(new Uint8Array(ciphertext), iv.length);
  
  return `aesgcm:${btoa(String.fromCharCode.apply(null, resultBuffer))}`;
}

function isOldBase64Format(text) {
  if (!text || typeof text !== 'string') return false;
  if (text.startsWith('aesgcm:') || text === 'not-needed') {
    return false;
  }
  try {
    if (text.length % 4 !== 0) return false;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return false;
    atob(text);
    return true;
  } catch (e) {
    return false;
  }
}

async function decrypt(encryptedText) {
  if (!encryptedText || encryptedText === "" || encryptedText === 'not-needed') {
    return encryptedText === 'not-needed' ? 'not-needed' : "";
  }

  if (isOldBase64Format(encryptedText)) {
    console.log("Old Base64 format API key detected during decryption attempt.");
    try {
      const plaintext = atob(encryptedText);
      throw new MigrationNeededError("API key is in old Base64 format and needs migration.", plaintext);
    } catch (e_atob) {
      console.error("Failed to decode suspected old Base64 format API key during migration attempt:", e_atob, "Value was:", encryptedText);
      throw new Error("Invalid API key: suspected old Base64 format but failed to decode.");
    }
  }

  if (!encryptedText.startsWith('aesgcm:')) {
    console.warn(`API key is not in a recognizable encrypted format: "${encryptedText}".`);
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

  if (encryptedData.length < 12) {
    console.error("AES-GCM encrypted data is too short (less than 12 bytes for IV).");
    throw new Error("Invalid AES-GCM encrypted data: too short to contain IV.");
  }

  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error("AES-GCM decryption failed:", error);
    throw new Error('Failed to decrypt API key with AES-GCM. The key might be corrupted, from a different installation, or the encryption method changed.');
  }
}

function validateApiKey(apiKey) {
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
// --- End of Refined AES-GCM Encryption Suite ---