import React, { useState, useRef, useEffect } from 'react';
import { Search, AlertCircle, Check } from 'lucide-react';

interface Field {
  name: string;
  label: string;
  type: 'text' | 'date';
}

interface Suggestion {
  name: string;
  label: string;
}

interface TokenPart {
  text: string;
  type: string;
}

interface ParsedCondition {
  field?: string;
  operator?: string;
  value?: string;
}

interface ParsedQuery {
  operator?: string;
  conditions?: (ParsedCondition | ParsedQuery)[];
}

const JQLLikeEditor: React.FC = () => {
  // Define all constants first
  const fields: Field[] = [
    { name: "text", label: "Text", type: "text" },
    { name: "created_date", label: "Created Date", type: "date" },
    { name: "updated_date", label: "Updated Date", type: "date" },
    { name: "kn_created", label: "Added to Kn", type: "date" },
    { name: "classifier", label: "Classifier", type: "text" },
    { name: "created_by", label: "Created By", type: "text" }
  ];

  const operators: Record<string, string[]> = {
    text: ["contains", "beginsWith", "endsWith", "doesNotContain", "doesNotBeginWith", "doesNotEndWith", "in", "notIn"],
    date: ["=", "!=", "<", ">", "<=", ">="]
  };

  const logicalOperators: string[] = ["AND", "OR", "NOT"];

  const tokenTypes: Record<string, string> = {
    field: 'text-blue-600',
    operator: 'text-purple-600',
    value: 'text-green-600',
    logical: 'text-orange-600',
    bracket: 'text-yellow-600',
    invalid: 'text-red-600',
    default: 'text-gray-700',
    space: ''
  };

  // Define state
  const [query, setQuery] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [suggestionType, setSuggestionType] = useState<'field' | 'operator' | 'logical' | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(0);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Helper functions
  const getTokenType = (token: string): string => {
    if (token === '(' || token === ')') return 'bracket';
    if (fields.some(f => f.name === token)) return 'field';
    if (Object.values(operators).flat().includes(token)) return 'operator';
    if (logicalOperators.includes(token)) return 'logical';
    if (token.match(/^["'].*["']$/)) return 'value';
    if (token.match(/^\d{4}-\d{2}-\d{2}$/)) return 'value';
    return 'invalid';
  };

  const parseQueryToJson = (queryStr: string): ParsedQuery | null => {
    try {
      const tokens = queryStr.match(/([()])|"[^"]*"|'[^']*'|\S+/g) || [];
      
      const parseExpression = (tokens: string[], startIndex = 0): [ParsedQuery[], number] => {
        let result: ParsedQuery[] = [];
        let currentCondition: ParsedCondition = {};
        let i = startIndex;
        
        while (i < tokens.length) {
          const token = tokens[i];
          
          if (token === '(') {
            const [subExpr, newIndex] = parseExpression(tokens, i + 1);
            result.push(subExpr[0]);
            i = newIndex;
          } else if (token === ')') {
            return [result, i];
          } else if (logicalOperators.includes(token)) {
            if (Object.keys(currentCondition).length > 0) {
              result.push(currentCondition);
              currentCondition = {};
            }
            if (result.length > 0) {
              result = [{
                operator: token,
                conditions: result
              }];
            }
          } else if (fields.some(f => f.name === token)) {
            if (Object.keys(currentCondition).length > 0) {
              result.push(currentCondition);
            }
            currentCondition = { field: token };
          } else if (Object.values(operators).flat().includes(token)) {
            currentCondition.operator = token;
          } else {
            currentCondition.value = token.replace(/^['"]|['"]$/g, '');
          }
          i++;
        }
        
        if (Object.keys(currentCondition).length > 0) {
          result.push(currentCondition);
        }
        
        return [result, i];
      };
      
      const [parsed] = parseExpression(tokens);
      setParsedQuery(parsed[0]);
      return parsed[0];
    } catch (error) {
      console.error('Error parsing query:', error);
      setParsedQuery(null);
      return null;
    }
  };

  const validateQuery = (queryString: string): void => {
    if (!queryString.trim()) {
      setError('');
      setIsValid(false);
      return;
    }

    try {
      const parsed = parseQueryToJson(queryString);
      setIsValid(true);
      setError('');
    } catch (e) {
      setIsValid(false);
      setError('Invalid query structure');
    }
  };

  const renderHighlightedContent = (): React.ReactNode => {
    if (!query) return null;
    
    const parts: TokenPart[] = [];
    let lastIndex = 0;
    const regex = /([()])|"[^"]*"|'[^']*'|\S+/g;
    let match;

    while ((match = regex.exec(query)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          text: query.substring(lastIndex, match.index),
          type: 'space'
        });
      }

      parts.push({
        text: match[0],
        type: getTokenType(match[0])
      });

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < query.length) {
      parts.push({
        text: query.substring(lastIndex),
        type: 'space'
      });
    }
    
    return parts.map((part, i) => {
      if (part.type === 'space') {
        return <span key={i} style={{ whiteSpace: 'pre' }}>{part.text}</span>;
      }
      return (
        <span key={i} className={tokenTypes[part.type]}>
          {part.text}
        </span>
      );
    });
  };

  const getSuggestions = (): Suggestion[] => {
    const beforeCursor = query.slice(0, cursorPosition);
    const currentToken = beforeCursor.split(/\s+/).pop() || '';
    const tokens = beforeCursor.split(/\s+/);
    const lastCompleteToken = tokens[tokens.length - 2] || '';
    
    if (suggestionType === 'field') {
      let suggestions = fields
        .filter(f => f.name.toLowerCase().includes(currentToken.toLowerCase()))
        .map(f => ({ name: f.name, label: f.label }));
      
      if (!fields.some(f => f.name === lastCompleteToken)) {
        suggestions = [
          ...suggestions,
          ...logicalOperators
            .filter(op => op.toLowerCase().includes(currentToken.toLowerCase()))
            .map(op => ({ name: op, label: op }))
        ];
      }
      
      return suggestions;
    } else if (suggestionType === 'operator') {
      const lastField = fields.find(f => f.name === lastCompleteToken);
      return lastField 
        ? operators[lastField.type]
          .filter(op => op.toLowerCase().includes(currentToken.toLowerCase()))
          .map(op => ({ name: op, label: op }))
        : [];
    } else if (suggestionType === 'logical') {
      return logicalOperators
        .filter(op => op.toLowerCase().includes(currentToken.toLowerCase()))
        .map(op => ({ name: op, label: op }));
    }
    return [];
  };

  const insertSuggestion = (suggestion: string): void => {
    const beforeCursor = query.slice(0, cursorPosition);
    const afterCursor = query.slice(cursorPosition);
    
    // Check if we're inside brackets
    const lastOpenBracket = beforeCursor.lastIndexOf('(');
    const nextCloseBracket = afterCursor.indexOf(')');
    const isInsideBrackets = lastOpenBracket !== -1 && nextCloseBracket !== -1;
    
    let newQuery: string;
    let newPosition: number;

    if (isInsideBrackets) {
      // Handle content inside brackets
      const bracketContentBefore = beforeCursor.slice(lastOpenBracket + 1).trim();
      const bracketContentAfter = afterCursor.slice(0, nextCloseBracket).trim();
      
      // Split into tokens and remove the last partial token
      const beforeTokens = bracketContentBefore.split(/\s+/);
      beforeTokens.pop(); // Remove partial token

      const isTextOperator = operators.text.includes(suggestion);
      const isLogicalOperator = logicalOperators.includes(suggestion);
      
      // Build new content
      if (isTextOperator) {
        // For text operators add empty quotes
        const newContent = [...beforeTokens, suggestion, '""'].join(' ');
        newQuery = beforeCursor.slice(0, lastOpenBracket + 1) + 
                  ' ' + newContent +
                  (bracketContentAfter ? ' ' + bracketContentAfter + ' ' : ' ') +
                  afterCursor.slice(nextCloseBracket);
        // Position cursor between the quotes
        newPosition = lastOpenBracket + 2 + newContent.length - 1;
      } else {
        // For other operators and logical operators, keep original behavior
        const shouldAddSpace = !isLogicalOperator;
        const newContent = [...beforeTokens, suggestion].join(' ') + (shouldAddSpace ? ' ' : '');
        newQuery = beforeCursor.slice(0, lastOpenBracket + 1) + 
                  ' ' + newContent +
                  (bracketContentAfter ? ' ' + bracketContentAfter + ' ' : ' ') +
                  afterCursor.slice(nextCloseBracket);
        newPosition = lastOpenBracket + 2 + newContent.length;
      }
    } else {
      // Handle content outside brackets
      const tokens = beforeCursor.split(/\s+/);
      tokens.pop(); // Remove partial token

      if (operators.text.includes(suggestion)) {
        // For text operators outside brackets, add empty quotes
        newQuery = [...tokens, suggestion, '""', ''].join(' ') + afterCursor;
        newPosition = newQuery.length - afterCursor.length - 2;
      } else {
        newQuery = [...tokens, suggestion, ''].join(' ') + afterCursor;
        newPosition = tokens.join(' ').length + suggestion.length + 1;
      }
    }

    setQuery(newQuery);
    setShowSuggestions(false); 
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPosition, newPosition);
        setCursorPosition(newPosition);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const beforeCursor = query.slice(0, cursorPosition);
    const afterCursor = query.slice(cursorPosition);
    const lastQuote = beforeCursor.lastIndexOf('"');
    const nextQuote = afterCursor.indexOf('"');
    const isInsideQuotes = lastQuote !== -1 && nextQuote !== -1;

    if (e.key === 'Enter' && isInsideQuotes && !showSuggestions) {
      e.preventDefault();
      const newPosition = cursorPosition + nextQuote + 2;
      setQuery(query + ' ');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newPosition, newPosition);
          setCursorPosition(newPosition);
        }
      }, 0);
      return;
    }

    // Handle bracket auto-closing
    if (e.key === '(' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const beforeCursor = query.slice(0, cursorPosition);
      const afterCursor = query.slice(cursorPosition);
      
      const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith(' ');
      const needsSpaceAfter = afterCursor.length > 0 && !afterCursor.startsWith(' ');
      
      const spaceBefore = needsSpaceBefore ? ' ' : '';
      const spaceAfter = needsSpaceAfter ? ' ' : '';
      
      const newQuery = beforeCursor + spaceBefore + '( )' + spaceAfter + afterCursor;
      setQuery(newQuery);
      
      const newPosition = cursorPosition + spaceBefore.length + 2;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newPosition, newPosition);
          setCursorPosition(newPosition);
          setSuggestionType('field');
          setShowSuggestions(true);
        }
      }, 0);
      return;
    }

    if (showSuggestions) {
      const suggestions = getSuggestions();
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedSuggestionIndex]) {
            insertSuggestion(suggestions[selectedSuggestionIndex].name);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const newValue = e.target.value;
    setQuery(newValue);
    validateQuery(newValue);
    
    const pos = e.target.selectionStart || 0;
    setCursorPosition(pos);
    
    const beforeCursor = newValue.slice(0, pos);
    const tokens = beforeCursor.split(/\s+/);
    const lastToken = tokens[tokens.length - 1] || '';
    const lastCompleteToken = tokens[tokens.length - 2] || '';
    const field = fields.find(f => f.name === tokens[tokens.length - 3]);

    if (lastToken === '(' || lastToken === ')') {
      setShowSuggestions(false);
    } else if (fields.some(f => f.name === lastCompleteToken)) {
      setSuggestionType('operator');
      setShowSuggestions(true);
    } else if (field && tokens.length >= 3 && lastCompleteToken && operators[field.type]?.includes(lastCompleteToken)) {
        setSuggestionType('logical');
        setShowSuggestions(true);
    } else {
      setSuggestionType('field');
      setShowSuggestions(true);
    }
  };

  // Effects
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [showSuggestions]);

  useEffect(() => {
    if (showSuggestions && suggestionsRef.current) {
      const suggestions = suggestionsRef.current.children;
      if (suggestions[selectedSuggestionIndex]) {
        suggestions[selectedSuggestionIndex].scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedSuggestionIndex]);

  return (
    <div className="w-full max-w-4xl relative space-y-4">
      <div className="relative">
        {/* Validation Status */}
        {query && (
          <div className={`absolute right-0 -top-6 flex items-center space-x-2 ${isValid ? 'text-green-600' : 'text-red-600'}`}>
            {isValid ? (
              <>
                <Check className="w-4 h-4" />
                <span className="text-sm">Valid query</span>
              </>
            ) : error ? (
              <>
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </>
            ) : null}
          </div>
        )}

        {/* Main Input Container */}
        <div className="relative flex items-center w-full rounded-lg border shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
          <div className="absolute inset-0 w-full p-3 pr-10 font-mono text-sm overflow-x-auto pointer-events-none">
            {!query && (
              <span className="text-gray-400">
                Enter your query (e.g., (text contains "example") AND (created_date `{'>'}` "2024-01-01"))
              </span>
            )}
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {renderHighlightedContent()}
            </div>
          </div>
          <Search className="absolute right-3 text-gray-400 w-5 h-5" />
          <textarea
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="w-full p-3 font-mono text-sm bg-transparent border-none outline-none resize-none text-transparent caret-black selection:bg-blue-200"
            spellCheck="false"
          />
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (
          <div 
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {getSuggestions().map((suggestion, index) => (
              <button
                key={suggestion.name}
                onClick={() => insertSuggestion(suggestion.name)}
                className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${
                  index === selectedSuggestionIndex ? 'bg-blue-100' : ''
                }`}
              >
                <span className="font-medium">{suggestion.label}</span>
                <span className="ml-2 text-sm text-gray-500">({suggestion.name})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Parsed Query Display */}
      {parsedQuery && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="font-medium mb-2">Parsed Query:</div>
          <pre className="text-sm overflow-x-auto">
            {JSON.stringify(parsedQuery, null, 2)}
          </pre>
        </div>
      )}

      {/* Quick Reference */}
      <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2">
        <div className="font-medium">Quick Reference:</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-blue-600 font-medium">Fields:</div>
            <div className="text-gray-600">{fields.map(f => f.name).join(', ')}</div>
          </div>
          <div>
            <div className="text-orange-600 font-medium">Logical Operators:</div>
            <div className="text-gray-600">{logicalOperators.join(', ')}</div>
          </div>
        </div>
        <div>
          <div className="text-purple-600 font-medium">Examples:</div>
          <div className="text-gray-600">
            (text contains "example") AND (created_date `{'>'}` "2024-01-01")
          </div>
        </div>
      </div>
    </div>
  );
};

export default JQLLikeEditor;