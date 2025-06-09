export function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function jsonToPojo(name, json) {
    // Simple POJO generator for JSON object (only shallow, no nested objects or arrays)
    if (typeof json !== "object" || json === null) {
        return "";
    }

    let className = capitalize(name);
    let fields = Object.entries(json)
        .map(([key, value]) => {
            let type = "String";
            if (typeof value === "number") type = "int";
            else if (typeof value === "boolean") type = "boolean";
            else if (value === null) type = "Object";
            else if (Array.isArray(value)) type = "List<Object>"; // simplified
            return `    private ${type} ${key};\n\n    public ${type} get${capitalize(
                key
            )}() { return ${key}; }\n\n    public void set${capitalize(key)}(${type} ${key}) { this.${key} = ${key}; }`;
        })
        .join("\n\n");

    return `public class ${className} {\n\n${fields}\n\n}`;
}
