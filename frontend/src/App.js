import React, { useState, useEffect, useRef } from 'react';
import Highlight from './components/Highlight';
import './App.css';

function App() {
  const [codeLines, setCodeLines] = useState([]);
  const [selectedLines, setSelectedLines] = useState([]);
  const [pageClasses, setPageClasses] = useState([]);
  const [currentPageName, setCurrentPageName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3003');

    ws.current.onopen = () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
      setError(null);
    };

    ws.current.onmessage = (event) => {
      try {
        const message = event.data;
        const lines = message.split('\n')
          .filter(line => line.trim() !== '')
          .map(line => line.trim());

        setCodeLines(prev => [...prev, ...lines]);
      } catch (err) {
        console.error('Error processing message:', err);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error. Please try again.');
    };

    ws.current.onclose = () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const toggleLineSelection = (index) => {
    setSelectedLines(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const deleteSelectedLines = () => {
    const updatedLines = codeLines.filter((_, idx) => !selectedLines.includes(idx));
    setCodeLines(updatedLines);
    setSelectedLines([]);
  };

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  const parseJsonLine = (line) => {
    try {
      const obj = JSON.parse(line);
      const { seleniumCode, elementType, elementLabel } = obj;
      const match = seleniumCode.match(/By\.(\w+)\(["'](.+?)["']\)/);
      if (!match) return null;
      const [_, byType, selector] = match;
      const locator = `By.${byType}("${selector}")`;

      // Helper to convert string with spaces to camelCase
      const toCamelCase = (str) => {
        return str
          .split(' ')
          .map((word, i) =>
            i === 0
              ? word.charAt(0).toLowerCase() + word.slice(1)
              : word.charAt(0).toUpperCase() + word.slice(1)
          )
          .join('');
      };

      let baseName = selector;

      if (elementLabel && elementLabel.trim() !== '') {
        baseName = toCamelCase(elementLabel.trim());
      } else {
        baseName = selector.replace(/[^a-zA-Z0-9]/g, '');
      }

      let prefix = 'element';

      if (elementType === 'input') {
        if (baseName.toLowerCase().includes('password')) prefix = 'tbPassword';
        else if (baseName.toLowerCase().includes('username') || baseName.toLowerCase().includes('email')) prefix = 'tbUserName';
        else prefix = 'tb' + capitalize(baseName);
      } else if (elementType === 'button') {
        prefix = 'btn' + capitalize(baseName);
      } else {
        prefix = 'element' + capitalize(baseName);
      }

      return {
        varName: prefix,
        locator,
        elementType,
        actionType: obj.actionType
      };
    } catch {
      return null;
    }
  };

  const generatePageClass = () => {
    if (!currentPageName || selectedLines.length === 0) return;

    const selectedCode = selectedLines.map(index => codeLines[index]);
    let guiMapLines = [];
    let methodLines = [];

    selectedCode.forEach(line => {
      const parsed = parseJsonLine(line);
      if (!parsed) return;

      guiMapLines.push(`        private static By ${parsed.varName} = ${parsed.locator};`);

      if (parsed.actionType === 'sendKeys') {
        const methodName = parsed.varName.includes('Password') ? 'setPassword' :
                           parsed.varName.includes('UserName') ? 'setUserName' :
                           'set' + capitalize(parsed.varName);
        methodLines.push(`    public void ${methodName}(String value) {\n        driver.findElement(GUIMap.${parsed.varName}).sendKeys(value);\n    }`);
      } else if (parsed.actionType === 'click') {
        const methodName = 'click' + capitalize(parsed.varName);
        methodLines.push(`    public void ${methodName}() {\n        driver.findElement(GUIMap.${parsed.varName}).click();\n    }`);
      }
    });

    const pageClassContent = `public class ${currentPageName} {\n\n    public static class GUIMap {\n${guiMapLines.join('\n')}\n    }\n\n${methodLines.join('\n\n')}\n}`;

    setPageClasses(prev => [...prev, {
      name: currentPageName,
      content: pageClassContent
    }]);

    setSelectedLines([]);
    setCurrentPageName('');
  };

  const clearAll = () => {
    setCodeLines([]);
    setSelectedLines([]);
    setPageClasses([]);
  };

  const exportToJavaFile = (content, fileName) => {
    const blob = new Blob([content], { type: 'text/x-java-source' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.java`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header>
        <h1>Selenium Auto Code Generator</h1>
        <div className="connection-status">
          WebSocket: {isConnected ?
            <span className="connected">Connected</span> :
            <span className="disconnected">Disconnected</span>}
          {error && <span className="error"> - {error}</span>}
        </div>
      </header>

      <div className="container">
        <div className="code-display">
          <h2>Received Selenium Code</h2>
          <div className="code-container">
            {codeLines.length === 0 ? (
              <p className="empty-state">No Record Action Performed yet</p>
            ) : (
              codeLines.map((line, index) => (
                <div
                  key={index}
                  className={`code-line ${selectedLines.includes(index) ? 'selected' : ''}`}
                  onClick={() => toggleLineSelection(index)}
                >
                  <Highlight language="java" code={line || ''} />
                </div>
              ))
            )}
          </div>
          <div className="button-group">
            <button onClick={clearAll} className="clear-btn">
              Clear All
            </button>
            <button onClick={deleteSelectedLines} disabled={selectedLines.length === 0} className="delete-btn">
              Delete Selected
            </button>
          </div>
        </div>

        <div className="controls">
          <h2>Generate Page Class</h2>
          <div className="input-group">
            <input
              type="text"
              value={currentPageName}
              onChange={(e) => setCurrentPageName(e.target.value)}
              placeholder="Enter page class name (e.g. LoginPage)"
              className="page-name-input"
            />
            <button
              onClick={generatePageClass}
              disabled={!currentPageName || selectedLines.length === 0}
              className="generate-btn"
            >
              Generate Page Class
            </button>
          </div>
          <div className="selection-info">
            {selectedLines.length} line(s) selected
          </div>
        </div>

        <div className="page-classes">
          <h2>Generated Page Classes</h2>
          {pageClasses.length === 0 ? (
            <p className="empty-state">No page classes generated yet</p>
          ) : (
            pageClasses.map((page, index) => (
              <div key={index} className="page-class">
                <h3>{page.name}.java</h3>
                <Highlight language="java" code={page.content || ''} />
                <div className="button-group">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(page.content);
                    }}
                    className="copy-btn"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => exportToJavaFile(page.content, page.name)}
                    className="export-btn"
                  >
                    Export to Java File
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
