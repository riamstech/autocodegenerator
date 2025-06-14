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
  const [errorResponseBody, setErrorResponseBody] = useState("");
  const [responseCode, setResponseCode] = useState("200");
  const [generatedCode, setGeneratedCode] = useState("");
  const [stepDefinition, setStepDefinition] = useState("");
  const [featureFile, setFeatureFile] = useState("");

  const addHeader = () => {
    if (headerKey.trim() && headerValue.trim()) {
      setHeaders([...headers, { key: headerKey.trim(), value: headerValue.trim() }]);
      setHeaderKey("");
      setHeaderValue("");
    }
  };

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
    setErrorResponseBody("");
    setResponseCode("200");
    setGeneratedCode("");
    setStepDefinition("");
    setFeatureFile("");
  };

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

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

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
        return null;
      default:
        return "String";
    }
  };

  function generateClass(name, jsonObj, classes = {}, processed = new Set()) {
    if (processed.has(name)) return;
    processed.add(name);

    let classCode = `public class ${name} {\n`;
    let gettersSetters = "";

    for (const [key, value] of Object.entries(jsonObj)) {
      let type = detectType(value);

      if (type === null) {
        const nestedClassName = capitalize(key);
        generateClass(nestedClassName, value, classes, processed);
        type = nestedClassName;
      } else if (type.startsWith("List<")) {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
          const nestedClassName = capitalize(key);
          generateClass(nestedClassName, value[0], classes, processed);
          type = `List<${nestedClassName}>`;
        } else {
          type = "List<Object>";
        }
      }

      classCode += `    private ${type} ${key};\n`;

      gettersSetters +=
          `    public ${type} get${capitalize(key)}() {\n` +
          `        return ${key};\n` +
          `    }\n\n`;

      gettersSetters +=
          `    public void set${capitalize(key)}(${type} ${key}) {\n` +
          `        this.${key} = ${key};\n` +
          `    }\n\n`;
    }

    classCode += "\n" + gettersSetters + "}\n";

    classes[name] = classCode;
    return classes;
  }

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
    let errorResponsePojoClasses = {};

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

    try {
      errorResponsePojoClasses = errorResponseBody.trim()
          ? generateClass("ErrorResponseData", JSON.parse(errorResponseBody))
          : {};
    } catch {
      alert("Invalid JSON in Error Response Body");
      return;
    }

    const requestPojo = Object.values(requestPojoClasses).join("\n");
    const responsePojo = Object.values(responsePojoClasses).join("\n");
    const errorResponsePojo = Object.values(errorResponsePojoClasses).join("\n");

    const methodLower = requestType.toLowerCase();

    const methodCode = `
    public Response ${methodLower}() {
        RequestSpecification requestSpecification = new baseRequestSpec().headers(new Headers());
        Response response = ${methodLower}(requestSpecification, endpointUrl);
        return response;
    }`;

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
${methodCode}

    public SuccessResponseData getSuccessResponseData(Response response) {
        return response.as(SuccessResponseData.class);
    }
    
    public ErrorResponseData getErrorResponseData(Response response) {
        return response.as(ErrorResponseData.class);
    }
}`;

    // Generate Step Definition
    const stepDefCode = `import io.cucumber.java.en.*;
import io.restassured.response.Response;
import static org.junit.Assert.*;

public class ${capitalize(serviceName)}Steps {
    private ${capitalize(serviceName)} ${serviceName.toLowerCase()} = new ${capitalize(serviceName)}();
    private Response response;
    private SuccessResponseData successResponse;
    private ErrorResponseData errorResponse;

    @Given("I set the API endpoint for ${serviceName}")
    public void setApiEndpoint() {
        // Endpoint is already set in the service class
    }

    @When("I send a ${requestType} request to ${serviceName}")
    public void sendRequest() {
        response = ${serviceName.toLowerCase()}.${methodLower}();
    }

    @Then("the response status code should be {int}")
    public void verifyStatusCode(int expectedStatusCode) {
        assertEquals(expectedStatusCode, response.getStatusCode());
    }

    @Then("the response should match the success schema")
    public void verifySuccessSchema() {
        successResponse = ${serviceName.toLowerCase()}.getSuccessResponseData(response);
        assertNotNull(successResponse);
    }

    @Then("the response should match the error schema")
    public void verifyErrorSchema() {
        errorResponse = ${serviceName.toLowerCase()}.getErrorResponseData(response);
        assertNotNull(errorResponse);
    }

    @Then("the success response body should contain valid data")
    public void verifySuccessResponseBody() {
        // Add specific assertions for success response fields here
        // Example: assertNotNull(successResponse.getFieldName());
    }

    @Then("the error response body should contain valid error details")
    public void verifyErrorResponseBody() {
        // Add specific assertions for error response fields here
        // Example: assertNotNull(errorResponse.getErrorMessage());
    }
}`;

    // Generate Feature File
    const featureCode = `Feature: ${capitalize(serviceName)} API Tests

  Scenario: Verify successful ${requestType} request to ${serviceName}
    Given I set the API endpoint for ${serviceName}
    When I send a ${requestType} request to ${serviceName}
    Then the response status code should be 200
    And the response should match the success schema
    And the success response body should contain valid data

  Scenario: Verify error response for ${requestType} request to ${serviceName}
    Given I set the API endpoint for ${serviceName}
    When I send a ${requestType} request to ${serviceName}
    Then the response status code should be 400
    And the response should match the error schema
    And the error response body should contain valid error details`;

    setGeneratedCode(
        [
          "import java.util.List;\n",
          requestPojo ? requestPojo + "\n\n" : "",
          responsePojo ? responsePojo + "\n\n" : "",
          errorResponsePojo ? errorResponsePojo + "\n\n" : "",
          mainCode,
        ].join("")
    );

    setStepDefinition(stepDefCode);
    setFeatureFile(featureCode);
  };

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

  const downloadStepDefinition = () => {
    if (!stepDefinition) {
      alert("No step definition to download!");
      return;
    }
    const element = document.createElement("a");
    const file = new Blob([stepDefinition], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${capitalize(serviceName) || "Generated"}Steps.java`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadFeatureFile = () => {
    if (!featureFile) {
      alert("No feature file to download!");
      return;
    }
    const element = document.createElement("a");
    const file = new Blob([featureFile], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${capitalize(serviceName) || "Generated"}APITests.feature`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
      <div style={{
        maxWidth: 1200,
        margin: "30px auto",
        padding: 20,
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 6px 15px rgba(0,0,0,0.1)"
      }}>
        <h2>API Code Generator</h2>

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
          <div style={{ marginBottom: 8 }}>
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
            <button type="button" onClick={addHeader}>Add Header</button>
          </div>
          <textarea
              rows={3}
              placeholder="Bulk add headers (key:value per line)"
              value={bulkHeaders}
              onChange={(e) => setBulkHeaders(e.target.value)}
              style={{ width: "100%", fontFamily: "monospace", marginBottom: 10 }}
          />
          <button type="button" onClick={bulkAddHeaders}>Bulk Add Headers</button>

          {headers.length > 0 && (
              <ul>
                {headers.map((h, i) => (
                    <li key={i}><b>{h.key}</b>: {h.value}</li>
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
          <button type="button" onClick={() => formatJson(requestBody, setRequestBody)}>Format Request JSON</button>
        </fieldset>

        <fieldset>
          <legend>Success Response Body</legend>
          <textarea
              rows={10}
              value={responseBody}
              onChange={(e) => setResponseBody(e.target.value)}
              placeholder="Enter JSON success response body here"
              style={{ width: "100%", fontFamily: "monospace" }}
          />
          <button type="button" onClick={() => formatJson(responseBody, setResponseBody)}>Format Response JSON</button>
        </fieldset>

        <fieldset>
          <legend>Error Response Body</legend>
          <textarea
              rows={10}
              value={errorResponseBody}
              onChange={(e) => setErrorResponseBody(e.target.value)}
              placeholder="Enter JSON error response body here"
              style={{ width: "100%", fontFamily: "monospace" }}
          />
          <button type="button" onClick={() => formatJson(errorResponseBody, setErrorResponseBody)}>Format Error Response JSON</button>
        </fieldset>

        <div style={{ marginTop: 10 }}>
          <label>Response Code</label>
          <select value={responseCode} onChange={(e) => setResponseCode(e.target.value)}>
            {[100, 101, 102, 200, 201, 202, 204, 400, 401, 403, 404, 500, 502, 503].map((code) => (
                <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 20 }}>
          <button type="button" onClick={generateCode} style={{ marginRight: 10 }}>Generate Code</button>
          <button type="button" onClick={clearAll} style={{ marginRight: 10 }}>Clear</button>
          <button type="button" onClick={downloadCode} disabled={!generatedCode}>Download Service Code</button>
        </div>

        {generatedCode && (
            <fieldset style={{ marginTop: 20 }}>
              <legend>Generated Java Service Code</legend>
              <textarea
                  rows={25}
                  readOnly
                  value={generatedCode}
                  style={{ width: "100%", fontFamily: "monospace" }}
              />
            </fieldset>
        )}

        {stepDefinition && (
            <fieldset style={{ marginTop: 20 }}>
              <legend>Step Definition File</legend>
              <textarea
                  rows={25}
                  readOnly
                  value={stepDefinition}
                  style={{ width: "100%", fontFamily: "monospace" }}
              />
              <button type="button" onClick={downloadStepDefinition} style={{ marginTop: 10 }}>Download Step Definition</button>
            </fieldset>
        )}

        {featureFile && (
            <fieldset style={{ marginTop: 20 }}>
              <legend>Feature File</legend>
              <textarea
                  rows={15}
                  readOnly
                  value={featureFile}
                  style={{ width: "100%", fontFamily: "monospace" }}
              />
              <button type="button" onClick={downloadFeatureFile} style={{ marginTop: 10 }}>Download Feature File</button>
            </fieldset>
        )}
      </div>
  );
}

export default App;