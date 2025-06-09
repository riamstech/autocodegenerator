import React from "react";

export default function HeaderInput({ headerKey, headerValue, setHeaderKey, setHeaderValue, addHeader }) {
    return (
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input
                placeholder="Key"
                value={headerKey}
                onChange={(e) => setHeaderKey(e.target.value)}
                style={{ flex: 1 }}
            />
            <input
                placeholder="Value"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
                style={{ flex: 1 }}
            />
            <button onClick={addHeader}>Add</button>
        </div>
    );
}
