// Test script to verify extension functionality
// Run this in the browser console to check if everything is working

console.log('🔧 Kokoro TTS Extension Test Script v4.1');
console.log('==========================================');

// Test 1: Check if extension is loaded
try {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    console.log('✅ Extension context available');
    console.log('Extension ID:', chrome.runtime.id);
  } else {
    console.log('❌ Extension context not available');
  }
} catch (e) {
  console.log('❌ Error checking extension context:', e);
}

// Test 2: Check manifest version
fetch(chrome.runtime.getURL('manifest.json'))
  .then(response => response.json())
  .then(manifest => {
    console.log('✅ Manifest loaded');
    console.log('Version:', manifest.version);
    console.log('Description:', manifest.description);
  })
  .catch(e => console.log('❌ Error loading manifest:', e));

// Test 3: Check if offscreen.html exists
fetch(chrome.runtime.getURL('offscreen.html'))
  .then(response => {
    if (response.ok) {
      console.log('✅ offscreen.html accessible');
    } else {
      console.log('❌ offscreen.html not found');
    }
  })
  .catch(e => console.log('❌ Error checking offscreen.html:', e));

// Test 4: Check background script status
chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
  if (chrome.runtime.lastError) {
    console.log('❌ Background script not responding:', chrome.runtime.lastError.message);
  } else {
    console.log('✅ Background script responding');
    console.log('Status:', response);
  }
});

// Test 5: Check if Chrome supports offscreen API
if (chrome.offscreen) {
  console.log('✅ Offscreen API available');
  
  // Check Chrome version
  const userAgent = navigator.userAgent;
  const chromeVersion = userAgent.match(/Chrome\/(\d+)/);
  if (chromeVersion && parseInt(chromeVersion[1]) >= 116) {
    console.log('✅ Chrome version compatible:', chromeVersion[1]);
  } else {
    console.log('⚠️ Chrome version may be too old:', chromeVersion ? chromeVersion[1] : 'unknown');
  }
} else {
  console.log('❌ Offscreen API not available - Chrome 116+ required');
}

// Test 6: Test server connection (if settings exist)
chrome.storage.local.get(['apiUrl'], (result) => {
  if (result.apiUrl) {
    console.log('🔗 Testing server connection to:', result.apiUrl);
    chrome.runtime.sendMessage({ action: 'checkServer' }, (response) => {
      if (response && response.connected) {
        console.log('✅ Server connection successful');
      } else {
        console.log('❌ Server connection failed:', response ? response.message : 'no response');
      }
    });
  } else {
    console.log('⚠️ No server URL configured - check settings');
  }
});

console.log('==========================================');
console.log('🏁 Test completed - check results above');
