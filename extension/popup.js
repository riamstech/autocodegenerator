document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle');
  const statusDiv = document.createElement('div');
  statusDiv.style.marginTop = '10px';
  document.body.appendChild(statusDiv);

  // Initialize recording state
  chrome.storage.local.get('recording', (data) => {
    const isRecording = data.recording || false;
    updateUI(isRecording);
  });

  function updateUI(isRecording) {
    toggleBtn.innerText = isRecording ? 'Stop Recording' : 'Start Recording';
    statusDiv.textContent = isRecording ? 'Recording active' : 'Ready to record';
  }

  toggleBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        statusDiv.textContent = 'Error: No active tab found';
        return;
      }

      chrome.storage.local.get('recording', async (data) => {
        const isRecording = data.recording || false;
        const newRecording = !isRecording;

        await chrome.storage.local.set({ recording: newRecording });
        updateUI(newRecording);

        if (newRecording) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content-scripts/recorder.js']
            });
            statusDiv.textContent = 'Recording active - interact with the page';
          } catch (err) {
            console.error('Injection failed:', err);
            statusDiv.textContent = 'Failed to start recording';
            await chrome.storage.local.set({ recording: false });
            updateUI(false);
          }
        } else {
          try {
            const response = await chrome.tabs.sendMessage(tab.id, {
              action: 'stopRecording'
            });
            if (!response?.success) {
              throw new Error('No response from content script');
            }
            statusDiv.textContent = 'Recording stopped successfully';
          } catch (err) {
            console.error('Failed to stop recording:', err);
            statusDiv.textContent = 'Error stopping recording';
            // Force stop by reloading the tab if needed
            await chrome.tabs.reload(tab.id);
            await chrome.storage.local.set({ recording: false });
            updateUI(false);
          }
        }
      });
    } catch (error) {
      console.error('Toggle error:', error);
      statusDiv.textContent = 'Error toggling recording';
    }
  });
});