import React, { useState } from "react";

function App() {
  const [serviceName, setServiceName] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [requestType, setRequestType] = useState("GET");
  const [headerKey, setHeaderKey] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [headers, setHeaders] = useState([]);
  const [bulkHeaders, setBulkHeaders] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [responseBody, setResponseBody] = useState("");
  const [responseCode, setResponseCode] = useState("200");
  const [generatedCode, setGeneratedCode] = useState("");

  // Add a single header key/value pair
  const addHeader = () => {
    if (headerKey.trim() && headerValue.trim()) {
      setHeaders([...headers, { key: headerKey.trim(), value: headerValue.trim() }]);
      setHeaderKey("");
      setHeaderValue("");
    }
  };

  // Bulk add headers from textarea (expects key:value per line)
  const bulkAddHeaders = () => {
    if (bulkHeaders.trim()) {
      const newHeaders = bulkHeaders
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.includes(":"))
          .map((line) => {
            const idx = line.indexOf(":");
            return {
              key: line.slice(0, idx).trim(),
              value: line.slice(idx + 1).trim(),
            };
          });
      setHeaders([...headers, ...newHeaders]);
      setBulkHeaders("");
    }
  };

  // Clear all form and output
  const clearAll = () => {
    setServiceName("");
    setApiEndpoint("");
    setRequestType("GET");
    setHeaderKey("");
    setHeaderValue("");
    setHeaders([]);
    setBulkHeaders("");
    setRequestBody("");
    setResponseBody("");
    setResponseCode("200");
    setGeneratedCode("");
  };

  // Format JSON string pretty or alert error
  const formatJson = (jsonStr, setter) => {
    try {
      if (!jsonStr.trim()) return;
      const parsed = JSON.parse(jsonStr);
      const pretty = JSON.stringify(parsed, null, 2);
      setter(pretty);
    } catch (e) {
      alert("Invalid JSON! Cannot format.");
    }
  };

  // Helper: capitalize first letter
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  // Detect Java type from JS value
  const detectType = (value) => {
    if (Array.isArray(value)) {
      if (value.length === 0) return "List<Object>";
      return "List<" + detectType(value[0]) + ">";
    }
    if (value === null) return "Object";
    switch (typeof value) {
      case "number":
        return Number.isInteger(value) ? "int" : "double";
      case "boolean":
        return "boolean";
      case "object":
        return null; // nested object to be handled recursively
      default:
        return "String";
    }
  };

  // Recursive function to generate classes from JSON object
  function generateClass(name, jsonObj, classes = {}, processed = new Set()) {
    if (processed.has(name)) return; // prevent circular references
    processed.add(name);

    let classCode = `public class ${name} {\n`;
    let gettersSetters = "";

    for (const [key, value] of Object.entries(jsonObj)) {
      let type = detectType(value);

      if (type === null) {
        // nested object → create new class
        const nestedClassName = capitalize(key);
        generateClass(nestedClassName, value, classes, processed);
        type = nestedClassName;
      } else if (type.startsWith("List<")) {
        // for arrays, check nested object type inside list
        const innerType = type.slice(5, -1);
        if (innerType === null) {
          // array of nested objects
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
            const nestedClassName = capitalize(key);
            generateClass(nestedClassName, value[0], classes, processed);
            type = `List<${nestedClassName}>`;
          } else {
            type = "List<Object>";
          }
        }
      }

      // Field declaration
      classCode += `    private ${type} ${key};\n`;

      // Getter
      gettersSetters +=
          `    public ${type} get${capitalize(key)}() {\n` +
          `        return ${key};\n` +
          `    }\n\n`;

      // Setter
      gettersSetters +=
          `    public void set${capitalize(key)}(${type} ${key}) {\n` +
          `        this.${key} = ${key};\n` +
          `    }\n\n`;
    }

    classCode += "\n" + gettersSetters + "}\n";

    classes[name] = classCode;
    return classes;
  }

  // Generate Java code based on inputs
  const generateCode = () => {
    if (!serviceName.trim()) {
      alert("Please enter Service Name");
      return;
    }
    if (!apiEndpoint.trim()) {
      alert("Please enter API Endpoint URL");
      return;
    }

    let requestPojoClasses = {};
    let responsePojoClasses = {};
    try {
      requestPojoClasses = requestBody.trim()
          ? generateClass("RequestBody", JSON.parse(requestBody))
          : {};
    } catch {
      alert("Invalid JSON in Request Body");
      return;
    }
    try {
      responsePojoClasses = responseBody.trim()
          ? generateClass("SuccessResponseData", JSON.parse(responseBody))
          : {};
    } catch {
      alert("Invalid JSON in Response Body");
      return;
    }

    // Combine all POJO classes as a string
    const requestPojo = Object.values(requestPojoClasses).join("\n");
    const responsePojo = Object.values(responsePojoClasses).join("\n");

    // Prepare headers map entries
    const headersMapEntries = headers.length
        ? headers.map((h) => `        headers.put("${h.key}", "${h.value}");`).join("\n")
        : "";

    const headersMapString = headers.length
        ? `Map<String, String> headers = new HashMap<>();\n${headersMapEntries}`
        : "";

    // Main service class template
    const mainCode = `import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import io.restassured.http.Headers;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class ${capitalize(serviceName)} extends BaseService {
    String endpointUrl = "${apiEndpoint}";

    public void ${capitalize(serviceName)}() {
        try {
            String appUrl = appConfig.get("yourfoldername", "configkey");
            hostAddress = new URL(appUrl);
        } catch (Exception ex) {
        }
    }

    public void setHeader(String key, String value) {
        headers.put(key, value);
    }

    public Response post() {
        RequestSpecification requestSpecification = new baseRequestSpec().headers(new Headers());
        Response response = post(requestSpecification, endpointUrl);
        return response;
    }

    public SuccessResponseData getSuccessResponseData(Response response) {
        return response.as(SuccessResponseData.class);
    }
}
`;

    // Final generated code output
    setGeneratedCode(
        [
          "import java.util.List;\n",
          requestPojo ? requestPojo + "\n\n" : "",
          responsePojo ? responsePojo + "\n\n" : "",
          mainCode,
        ].join("")
    );
  };

  // Download the generated code as a .java file
  const downloadCode = () => {
    if (!generatedCode) {
      alert("No code to download!");
      return;
    }
    const element = document.createElement("a");
    const file = new Blob([generatedCode], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${capitalize(serviceName) || "GeneratedService"}.java`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
      <div
          style={{
            maxWidth: 900,
            margin: "30px auto",
            padding: 20,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 6px 15px rgba(0,0,0,0.1)",
          }}
      >
        <h2>REST Assured Java Code Generator</h2>

        <div style={{ marginBottom: 15 }}>
          <label>Service Name</label>
          <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Enter service name"
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label>API Endpoint URL</label>
          <input
              type="url"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="/objects"
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label>Request Type</label>
          <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
            <option>PATCH</option>
            <option>HEAD</option>
            <option>OPTIONS</option>
          </select>
        </div>

        <fieldset>
          <legend>Request Headers</legend>

          <div className="components-headerinput__root" style={{ marginBottom: 8 }}>
            <input
                type="text"
                placeholder="Header Key"
                value={headerKey}
                onChange={(e) => setHeaderKey(e.target.value)}
            />
            <input
                type="text"
                placeholder="Header Value"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
            />
            <button type="button" onClick={addHeader}>
              Add Header
            </button>
          </div>

          <textarea
              rows={3}
              placeholder="Bulk add headers (key:value per line)"
              value={bulkHeaders}
              onChange={(e) => setBulkHeaders(e.target.value)}
              style={{ width: "100%", fontFamily: "monospace", marginBottom: 10 }}
          />
          <button type="button" onClick={bulkAddHeaders}>
            Bulk Add Headers
          </button>

          {headers.length > 0 && (
              <ul>
                {headers.map((h, i) => (
                    <li key={i}>
                      <b>{h.key}</b>: {h.value}
                    </li>
                ))}
              </ul>
          )}
        </fieldset>

        <fieldset>
          <legend>Request Body</legend>
          <textarea
              rows={10}
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              placeholder="Enter JSON request body here"
              style={{ width: "100%", fontFamily: "monospace" }}
          />
          <button type="button" onClick={() => formatJson(requestBody, setRequestBody)}>
            Format Request JSON
          </button>
        </fieldset>

        <fieldset>
          <legend>Response Body</legend>
          <textarea
              rows={10}
              value={responseBody}
              onChange={(e) => setResponseBody(e.target.value)}
              placeholder="Enter JSON response body here"
              style={{ width: "100%", fontFamily: "monospace" }}
          />
          <button type="button" onClick={() => formatJson(responseBody, setResponseBody)}>
            Format Response JSON
          </button>
        </fieldset>

        <div style={{ marginTop: 10 }}>
          <label>Response Code</label>
          <select value={responseCode} onChange={(e) => setResponseCode(e.target.value)}>
            {[
              100, 101, 102, 200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302,
              303, 304, 305, 307, 308, 400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410,
              411, 412, 413, 414, 415, 416, 417, 418, 422, 425, 426, 428, 429, 431, 451, 500,
              501, 502, 503, 504, 505, 506, 507, 508, 510, 511,
            ].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 20 }}>
          <button type="button" onClick={generateCode} style={{ marginRight: 10 }}>
            Generate Code
          </button>
          <button type="button" onClick={clearAll} style={{ marginRight: 10 }}>
            Clear
          </button>
          <button type="button" onClick={downloadCode} disabled={!generatedCode}>
            Download Code
          </button>
        </div>

        {generatedCode && (
            <fieldset style={{ marginTop: 20 }}>
              <legend>Generated Java Code</legend>
              <textarea
                  rows={25}
                  readOnly
                  value={generatedCode}
                  style={{ width: "100%", fontFamily: "monospace" }}
              />
            </fieldset>
        )}
      </div>
  );
}

export default App;
