
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle');
  const statusDiv = document.createElement('div');
  const recordingsList = document.createElement('div');

  // Setup UI elements
  statusDiv.style.marginTop = '10px';
  recordingsList.style.marginTop = '15px';
  document.body.appendChild(statusDiv);
  document.body.appendChild(recordingsList);

  // Initialize recording state
  chrome.storage.local.get(['recording', 'recordings'], (data) => {
    const isRecording = data.recording || false;
    updateUI(isRecording);
    updateRecordingsList(data.recordings || []);
  });

  function updateUI(isRecording) {
    toggleBtn.innerText = isRecording ? 'Stop Recording' : 'Start Recording';
    statusDiv.textContent = isRecording ? 'Recording active' : 'Ready to record';
    toggleBtn.className = isRecording ? 'recording' : '';
  }

  function updateRecordingsList(recordings) {
    recordingsList.innerHTML = '';
    if (recordings.length > 0) {
      const title = document.createElement('h3');
      title.textContent = 'Recent Recordings';
      recordingsList.appendChild(title);

      recordings.forEach((recording, index) => {
        const item = document.createElement('div');
        item.className = 'recording-item';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `Recording ${index + 1}`;

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download';
        downloadBtn.onclick = () => downloadRecording(recording);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '❌';
        deleteBtn.onclick = () => deleteRecording(index);

        item.appendChild(nameSpan);
        item.appendChild(downloadBtn);
        item.appendChild(deleteBtn);
        recordingsList.appendChild(item);
      });
    }
  }

  async function downloadRecording(recordingData) {
    try {
      const blob = new Blob([recordingData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      statusDiv.textContent = 'Failed to download recording';
    }
  }

  async function deleteRecording(index) {
    try {
      const data = await chrome.storage.local.get('recordings');
      const recordings = data.recordings || [];
      recordings.splice(index, 1);
      await chrome.storage.local.set({ recordings });
      updateRecordingsList(recordings);
    } catch (err) {
      console.error('Delete failed:', err);
      statusDiv.textContent = 'Failed to delete recording';
    }
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

            // Update extension icon to recording state
            await chrome.action.setIcon({
              path: 'icon-recording.png'
            });
          } catch (err) {
            console.error('Injection failed:', err);
            const errorMessage = err.message.includes('Cannot access')
                ? 'Cannot record on this page'
                : 'Failed to start recording';
            statusDiv.textContent = errorMessage;
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

            // Update extension icon back to default
            await chrome.action.setIcon({
              path: 'icon-default.png'
            });

            // Save recording if available
            if (response.recording) {
              const data = await chrome.storage.local.get('recordings');
              const recordings = data.recordings || [];
              recordings.push(response.recording);
              await chrome.storage.local.set({ recordings });
              updateRecordingsList(recordings);
            }
          } catch (err) {
            console.error('Failed to stop recording:', err);
            let errorMessage = 'Error stopping recording';
            if (err.message === 'No response from content script') {
              errorMessage = 'Recording script not responding';
            } else if (err.message.includes('Could not establish connection')) {
              errorMessage = 'Connection to tab lost';
            }

            statusDiv.textContent = errorMessage;
            // Force stop by reloading the tab if needed
            await chrome.tabs.reload(tab.id);
            await chrome.storage.local.set({ recording: false });
            updateUI(false);

            // Reset icon to default
            await chrome.action.setIcon({
              path: 'icon16.png'
            });
          }
        }
      });
    } catch (error) {
      console.error('Toggle error:', error);
      statusDiv.textContent = 'Error toggling recording';
    }
  });
});