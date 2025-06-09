import React from 'react';
import { Highlight as SyntaxHighlighter } from 'prism-react-renderer';
import { themes } from 'prism-react-renderer';

const Highlight = ({ language, code }) => {
  return (
    <SyntaxHighlighter
      language={language}
      code={code}
      theme={themes.dracula}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={className} style={{...style, padding: '10px', borderRadius: '4px'}}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line, key: i })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token, key })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </SyntaxHighlighter>
  );
};

export default Highlight;