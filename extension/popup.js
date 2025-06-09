document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle');

  chrome.storage.local.get('recording', (data) => {
    const isRecording = data.recording || false;
    toggleBtn.innerText = isRecording ? 'Stop Recording' : 'Start Recording';
  });

  toggleBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.storage.local.get('recording', (data) => {
      const isRecording = data.recording || false;
      const newRecording = !isRecording;

      chrome.storage.local.set({ recording: newRecording });
      toggleBtn.innerText = newRecording ? 'Stop Recording' : 'Start Recording';

      if (newRecording) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: recorderScript
        }).catch(err => console.error('Failed to inject script:', err));
      }
    });
  });
});

// The recorderScript function is declared globally here so that chrome.scripting.executeScript can inject it.

function recorderScript() {
  if (window.hasRecorder) return;
  window.hasRecorder = true;

  document.addEventListener('input', handleInput, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('dblclick', handleDoubleClick, true);
  document.addEventListener('change', handleChange, true);

  function handleClick(e) {
    const el = findClosestClickable(e.target);
    if (!el) return;
    recordAction(el, 'click');
  }

  function handleDoubleClick(e) {
    const el = e.target;
    recordAction(el, 'doubleClick');
  }

  function handleInput(e) {
    const el = e.target;
    if (el.tagName.toLowerCase() !== 'input' && el.tagName.toLowerCase() !== 'textarea') return;
    recordAction(el, 'sendKeys');
  }

  function handleChange(e) {
    const el = e.target;
    if (el.tagName.toLowerCase() === 'select') {
      recordAction(el, 'select');
    }
  }

  function findClosestClickable(el) {
    while (el && el !== document.body) {
      if (isClickable(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function isClickable(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    return (
      tag === 'button' ||
      tag === 'a' ||
      tag === 'input' ||
      typeof el.onclick === 'function' ||
      el.hasAttribute('onclick') ||
      role === 'button' ||
      role === 'link'
    );
  }

  function recordAction(el, actionType) {
    const { locator, locatorType } = getLocator(el);
    const elementType = getElementType(el);
    const label = el.innerText?.trim() || '';
    let seleniumCode = '';

    switch (actionType) {
      case 'click':
        seleniumCode = `driver.findElement(${locatorType}("${locator}")).click();`;
        break;
      case 'doubleClick':
        seleniumCode = `Actions actions = new Actions(driver);\nactions.doubleClick(driver.findElement(${locatorType}("${locator}"))).perform();`;
        break;
      case 'sendKeys':
        seleniumCode = `driver.findElement(${locatorType}("${locator}")).sendKeys("${el.value}");`;
        break;
      case 'select':
        seleniumCode = `new Select(driver.findElement(${locatorType}("${locator}"))).selectByValue("${el.value}");`;
        break;
    }

    const eventData = {
      timestamp: new Date().toISOString(),
      elementType,
      actionType,
      seleniumCode
    };

    if (label) {
      eventData.elementLabel = label;
    }

    sendAction(eventData);
  }

  function getLocator(el) {
    if (el.id) {
      return { locator: el.id, locatorType: 'By.id' };
    }

    if (el.name) {
      return { locator: el.name, locatorType: 'By.name' };
    }

    try {
      const selector = getCssSelector(el);
      if (selector) return { locator: selector, locatorType: 'By.cssSelector' };
    } catch {}

    const xpath = getXPath(el);
    return { locator: xpath, locatorType: 'By.xpath' };
  }

  function getXPath(el) {
    if (el === document.body) return '/html/body';
    const ix = Array.from(el.parentNode.children).filter(sib => sib.tagName === el.tagName).indexOf(el) + 1;
    return getXPath(el.parentNode) + '/' + el.tagName.toLowerCase() + '[' + ix + ']';
  }

  function getCssSelector(el) {
    if (!(el instanceof Element)) return null;

    const parts = [];
    while (el.parentNode && el !== document.body) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector += `#${el.id}`;
        parts.unshift(selector);
        break;
      } else {
        const siblings = Array.from(el.parentNode.children).filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(el) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      parts.unshift(selector);
      el = el.parentNode;
    }

    return parts.join(' > ');
  }

  function getElementType(el) {
    const tag = el.tagName.toLowerCase();
    const type = el.type?.toLowerCase();

    if (tag === 'button' || type === 'submit' || type === 'button') return 'button';
    if (tag === 'label') return 'label';
    if (tag === 'input') {
      if (type === 'radio') return 'radio';
      return 'input';
    }
    if (tag === 'select') return 'select';
    return 'unknown';
  }

  function sendAction(data) {
    fetch('http://localhost:3003/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => console.error("Backend not reachable"));
  }
}
