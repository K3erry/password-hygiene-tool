// popup.js - Main popup logic for Password Meter extension

// DOM Elements
const toggleMeterBtn = document.getElementById('toggleMeter');
const checkPageBtn = document.getElementById('checkPage');
const syncStatusDiv = document.getElementById('syncStatus');

// Show/Hide the meter on current page
toggleMeterBtn.addEventListener('click', async () => {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    // Check if we have permission to access this tab
    if (!tab.url || tab.url.startsWith('chrome://')) {
      alert('Cannot access this page. Try a regular website.');
      return;
    }
    
    // Send message to content script to toggle the meter
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleMeter' 
    });
    
    console.log('Toggled meter on page');
    
  } catch (error) {
    console.error('Error toggling meter:', error);
    
    // If content script isn't injected, inject it first
    if (error.message.includes('Receiving end does not exist')) {
      await injectContentScript();
      alert('Meter activated! Refresh the page if needed.');
    }
  }
});

// Check passwords on current page
checkPageBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    if (!tab.url || tab.url.startsWith('chrome://')) {
      alert('Cannot scan this page. Try a regular website.');
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'checkPasswords' 
    });
    
    if (response && response.found) {
      alert(`Found ${response.count} password fields on this page`);
    } else {
      alert('No password fields found on this page');
    }
    
  } catch (error) {
    console.error('Error checking page:', error);
    alert('Error scanning page. Make sure you\'re on a website with login forms.');
  }
});

// Check sync storage status
async function checkSyncStatus() {
  try {
    // Check if sync storage is available
    const bytes = await chrome.storage.sync.getBytesInUse(null);
    
    if (bytes === undefined) {
      syncStatusDiv.textContent = 'Sync: Not available';
      syncStatusDiv.style.color = 'orange';
    } else if (bytes > 0) {
      syncStatusDiv.textContent = `Sync: Active (${bytes} bytes used)`;
      syncStatusDiv.style.color = 'green';
    } else {
      syncStatusDiv.textContent = 'Sync: Ready (no data yet)';
      syncStatusDiv.style.color = 'blue';
    }
    
    // Also check if user is signed in
    chrome.identity.getProfileUserInfo((userInfo) => {
      if (userInfo.email) {
        syncStatusDiv.textContent += ` | Signed in as: ${userInfo.email}`;
      }
    });
    
  } catch (error) {
    syncStatusDiv.textContent = 'Sync: Error checking';
    syncStatusDiv.style.color = 'red';
  }
}

// Helper function to inject content script if needed
async function injectContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']  // Path to content.js
    });
    
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['style/styles.css']  // Fixed: now points to style folder
    });
    
    console.log('Content script injected successfully');
    return true;
  } catch (error) {
    console.error('Failed to inject content script:', error);
    return false;
  }
}

// Initialize popup when it opens
document.addEventListener('DOMContentLoaded', () => {
  console.log('Password Meter popup loaded');
  
  // Check sync status
  checkSyncStatus();
  
  // Add some visual feedback for buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('mousedown', () => {
      button.style.opacity = '0.8';
    });
    button.addEventListener('mouseup', () => {
      button.style.opacity = '1';
    });
    button.addEventListener('mouseleave', () => {
      button.style.opacity = '1';
    });
  });
});

// Listen for messages from content script or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message);
  
  if (message.type === 'syncUpdate') {
    checkSyncStatus();
  }
  
  if (message.type === 'passwordChecked') {
    // Update popup with password check results if needed
    console.log('Password check completed:', message.data);
  }
});

// Optional: Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Close popup with Escape key
  if (e.key === 'Escape') {
    window.close();
  }
  
  // Toggle meter with 'm' key
  if (e.key === 'm' || e.key === 'M') {
    toggleMeterBtn.click();
  }
});