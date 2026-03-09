// popup.js - Main popup logic with draggable functionality

// DOM Elements
const container = document.getElementById('popup-container');
const dragHandle = document.getElementById('drag-handle');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');
const resizeHandle = document.getElementById('resize-handle');
const toggleMeterBtn = document.getElementById('toggleMeter');
const checkPageBtn = document.getElementById('checkPage');
const syncStatusDiv = document.getElementById('syncStatus');

// Draggable functionality
let isDragging = false;
let offsetX, offsetY;

dragHandle.addEventListener('mousedown', startDrag);
dragHandle.addEventListener('touchstart', startDragTouch, { passive: false });

function startDrag(e) {
  isDragging = true;
  const rect = container.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;
  
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
}

function startDragTouch(e) {
  isDragging = true;
  const touch = e.touches[0];
  const rect = container.getBoundingClientRect();
  offsetX = touch.clientX - rect.left;
  offsetY = touch.clientY - rect.top;
  
  document.addEventListener('touchmove', dragTouch, { passive: false });
  document.addEventListener('touchend', stopDrag);
  e.preventDefault();
}

function drag(e) {
  if (!isDragging) return;
  
  let newX = e.clientX - offsetX;
  let newY = e.clientY - offsetY;
  
  // Keep within viewport
  newX = Math.max(0, Math.min(newX, window.innerWidth - container.offsetWidth));
  newY = Math.max(0, Math.min(newY, window.innerHeight - container.offsetHeight));
  
  container.style.position = 'fixed';
  container.style.left = newX + 'px';
  container.style.top = newY + 'px';
}

function dragTouch(e) {
  if (!isDragging) return;
  e.preventDefault();
  
  const touch = e.touches[0];
  let newX = touch.clientX - offsetX;
  let newY = touch.clientY - offsetY;
  
  newX = Math.max(0, Math.min(newX, window.innerWidth - container.offsetWidth));
  newY = Math.max(0, Math.min(newY, window.innerHeight - container.offsetHeight));
  
  container.style.position = 'fixed';
  container.style.left = newX + 'px';
  container.style.top = newY + 'px';
}

function stopDrag() {
  isDragging = false;
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('touchmove', dragTouch);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchend', stopDrag);
  
  // Save position
  savePosition();
}

// Resizable functionality
let isResizing = false;
let startWidth, startHeight, startX, startY;

resizeHandle.addEventListener('mousedown', startResize);
resizeHandle.addEventListener('touchstart', startResizeTouch, { passive: false });

function startResize(e) {
  isResizing = true;
  startWidth = container.offsetWidth;
  startHeight = container.offsetHeight;
  startX = e.clientX;
  startY = e.clientY;
  
  document.addEventListener('mousemove', resize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
}

function startResizeTouch(e) {
  isResizing = true;
  const touch = e.touches[0];
  startWidth = container.offsetWidth;
  startHeight = container.offsetHeight;
  startX = touch.clientX;
  startY = touch.clientY;
  
  document.addEventListener('touchmove', resizeTouch, { passive: false });
  document.addEventListener('touchend', stopResize);
  e.preventDefault();
}

function resize(e) {
  if (!isResizing) return;
  
  const newWidth = Math.max(250, startWidth + (e.clientX - startX));
  const newHeight = Math.max(300, startHeight + (e.clientY - startY));
  
  container.style.width = newWidth + 'px';
}

function resizeTouch(e) {
  if (!isResizing) return;
  e.preventDefault();
  
  const touch = e.touches[0];
  const newWidth = Math.max(250, startWidth + (touch.clientX - startX));
  const newHeight = Math.max(300, startHeight + (touch.clientY - startY));
  
  container.style.width = newWidth + 'px';
}

function stopResize() {
  isResizing = false;
  document.removeEventListener('mousemove', resize);
  document.removeEventListener('touchmove', resizeTouch);
  document.removeEventListener('mouseup', stopResize);
  document.removeEventListener('touchend', stopResize);
}

// Minimize functionality
minimizeBtn.addEventListener('click', () => {
  container.classList.toggle('minimized');
  minimizeBtn.textContent = container.classList.contains('minimized') ? '□' : '−';
});

// Close functionality
closeBtn.addEventListener('click', () => {
  container.style.display = 'none';
  // You can add a way to reopen later
});

// Save position to storage
function savePosition() {
  const pos = {
    left: container.style.left,
    top: container.style.top,
    width: container.style.width
  };
  chrome.storage.local.set({ popupPosition: pos });
}

// Load saved position
chrome.storage.local.get(['popupPosition'], (result) => {
  if (result.popupPosition) {
    container.style.position = 'fixed';
    container.style.left = result.popupPosition.left || '50px';
    container.style.top = result.popupPosition.top || '50px';
    container.style.width = result.popupPosition.width || '320px';
  }
});

// Your existing functionality
toggleMeterBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    if (!tab.url || tab.url.startsWith('chrome://')) {
      alert('Cannot access this page. Try a regular website.');
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleMeter' 
    });
    
    console.log('Toggled meter on page');
    
  } catch (error) {
    console.error('Error toggling meter:', error);
    
    if (error.message.includes('Receiving end does not exist')) {
      await injectContentScript();
      alert('Meter activated! Refresh the page if needed.');
    }
  }
});

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

async function checkSyncStatus() {
  try {
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
    
  } catch (error) {
    syncStatusDiv.textContent = 'Sync: Error checking';
    syncStatusDiv.style.color = 'red';
  }
}

async function injectContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    });
    
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['style/styles.css']
    });
    
    console.log('Content script injected successfully');
    return true;
  } catch (error) {
    console.error('Failed to inject content script:', error);
    return false;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('Password Meter popup loaded');
  checkSyncStatus();
  
  // Add visual feedback for buttons
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

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message);
  
  if (message.type === 'syncUpdate') {
    checkSyncStatus();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
  }
  if (e.key === 'm' || e.key === 'M') {
    toggleMeterBtn.click();
  }
});