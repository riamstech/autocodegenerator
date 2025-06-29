// Content script that gets injected into the page
function initializeRecorder() {
    console.log('Initializing Selenium Recorder...');

    if (window.hasRecorder) {
        console.warn('Recorder already initialized');
        return;
    }
    window.hasRecorder = true;

    let isRecording = true;
    let lastFocusedInput = null;
    const eventListeners = [];

    // Define all handler functions first
    function handleFocusIn(e) {
        if (!isRecording) return;
        const el = e.target;
        if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
            lastFocusedInput = el;
        }
    }

    function handleFocusOut(e) {
        if (!isRecording) return;
        const el = e.target;
        if (el === lastFocusedInput && (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea')) {
            recordAction(el, 'sendKeys');
            lastFocusedInput = null;
        }
    }

    function handleClick(e) {
        if (!isRecording) return;
        const el = findClosestClickable(e.target);
        if (!el) return;
        recordAction(el, 'click');
    }

    function handleDoubleClick(e) {
        if (!isRecording) return;
        const el = e.target;
        recordAction(el, 'doubleClick');
    }

    function handleChange(e) {
        if (!isRecording) return;
        const el = e.target;
        if (el.tagName.toLowerCase() === 'select') {
            const selectedOption = el.options[el.selectedIndex];
            const value = selectedOption.value || selectedOption.text;
            recordAction(el, 'select', value);
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
        if (!el || !el.tagName) return false;

        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role');
        const hasPointerCursor = window.getComputedStyle(el).cursor === 'pointer';
        const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0 &&
            getComputedStyle(el).visibility !== 'hidden' &&
            getComputedStyle(el).display !== 'none';

        return (
            tag === 'button' ||
            tag === 'a' ||
            tag === 'input' ||
            tag === 'select' ||
            tag === 'textarea' ||
            tag === 'p' ||      // Paragraphs
            tag === 'div' ||    // Divs
            tag === 'span' ||   // Spans
            typeof el.onclick === 'function' ||
            el.hasAttribute('onclick') ||
            el.hasAttribute('href') ||
            role === 'button' ||
            role === 'link' ||
            hasPointerCursor
        ) && isVisible;
    }

    function recordAction(el, actionType, value = '') {
        if (!isRecording) return;

        const { locator, locatorType } = getLocator(el);
        const elementType = getElementType(el);
        const label = getElementLabel(el);
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
                value = el.value;
                break;
            case 'select':
                seleniumCode = `new Select(driver.findElement(${locatorType}("${locator}"))).selectByVisibleText("${value}");`;
                break;
        }

        const eventData = {
            timestamp: new Date().toISOString(),
            elementType,
            actionType,
            seleniumCode,
            value,
            elementLabel: label,
            href: el.tagName.toLowerCase() === 'a' ? el.href : undefined
        };

        console.log('Recording action:', eventData);
        sendAction(eventData);
    }

    function getElementLabel(el) {
        if (!el) return '';

        // Try to get associated label text
        if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`);
            if (label) return label.innerText.trim();
        }

        // Try to get parent label text
        if (el.parentElement?.tagName?.toLowerCase() === 'label') {
            return el.parentElement.innerText.trim();
        }

        // For links, use link text or title
        if (el.tagName.toLowerCase() === 'a') {
            return el.innerText.trim() || el.title || el.getAttribute('aria-label') || '';
        }

        // For paragraphs, use the text content
        if (el.tagName.toLowerCase() === 'p') {
            return el.innerText.trim();
        }

        // Fall back to element's own text or placeholder
        return el.innerText?.trim() || el.placeholder || el.getAttribute('aria-label') || '';
    }

    function getLocator(el) {
        if (!el) return { locator: '', locatorType: 'By.xpath' };

        // Prefer data-testid attributes if available
        if (el.dataset?.testid) {
            return { locator: el.dataset.testid, locatorType: 'By.cssSelector' };
        }

        if (el.id) {
            return { locator: el.id, locatorType: 'By.id' };
        }

        if (el.name) {
            return { locator: el.name, locatorType: 'By.name' };
        }

        // For links, try to use href or text
        if (el.tagName.toLowerCase() === 'a') {
            if (el.href) {
                return { locator: `a[href="${el.href}"]`, locatorType: 'By.cssSelector' };
            }
            if (el.innerText?.trim()) {
                return { locator: `a:contains("${el.innerText.trim()}")`, locatorType: 'By.cssSelector' };
            }
        }

        // For paragraphs, try to use text content
        if (el.tagName.toLowerCase() === 'p' && el.innerText?.trim()) {
            return { locator: `p:contains("${el.innerText.trim()}")`, locatorType: 'By.cssSelector' };
        }

        try {
            const selector = getCssSelector(el);
            if (selector) return { locator: selector, locatorType: 'By.cssSelector' };
        } catch {}

        const xpath = getXPath(el);
        return { locator: xpath, locatorType: 'By.xpath' };
    }

    function getXPath(el) {
        if (!el || el === document.body) return '/html/body';
        const ix = Array.from(el.parentNode.children)
            .filter(sib => sib.tagName === el.tagName)
            .indexOf(el) + 1;
        return `${getXPath(el.parentNode)}/${el.tagName.toLowerCase()}[${ix}]`;
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
        if (!el?.tagName) return 'unknown';

        const tag = el.tagName.toLowerCase();
        const type = el.type?.toLowerCase();

        if (tag === 'button' || type === 'submit' || type === 'button') return 'button';
        if (tag === 'label') return 'label';
        if (tag === 'input') {
            if (type === 'radio') return 'radio';
            if (type === 'checkbox') return 'checkbox';
            if (type === 'password') return 'password';
            return 'input';
        }
        if (tag === 'select') return 'select';
        if (tag === 'textarea') return 'textarea';
        if (tag === 'a') return 'link';
        if (tag === 'p') return 'paragraph';
        if (tag === 'div') return 'div';
        if (tag === 'span') return 'span';
        return 'element';
    }

    function sendAction(data) {
        if (!isRecording) return;

        fetch('http://localhost:3003/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
            .then(response => {
                if (!response.ok) {
                    console.error('Server error:', response.status);
                }
            })
            .catch(err => console.error("Failed to send action:", err));
    }

    function addEventListener(type, handler) {
        document.addEventListener(type, handler, true);
        eventListeners.push({ type, handler });
    }

    function removeEventListeners() {
        eventListeners.forEach(({ type, handler }) => {
            document.removeEventListener(type, handler, true);
        });
        eventListeners.length = 0;
    }

    function stopRecording() {
        if (!isRecording) return;

        console.log('Stopping recording...');
        isRecording = false;
        removeEventListeners();
        window.hasRecorder = false;
        console.log('Recording stopped successfully');
    }

    // Handle messages from the popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'stopRecording') {
            stopRecording();
            sendResponse({ success: true });
            return true; // Indicates we want to send a response asynchronously
        }
        return false;
    });

    // Initialize event listeners
    addEventListener('click', handleClick);
    addEventListener('dblclick', handleDoubleClick);
    addEventListener('change', handleChange);
    addEventListener('focusin', handleFocusIn);
    addEventListener('focusout', handleFocusOut);

    // Cleanup when page unloads
    window.addEventListener('beforeunload', stopRecording);

    console.log('Selenium Recorder initialized successfully');
}

// Start the recorder
initializeRecorder();