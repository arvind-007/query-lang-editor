import React, { useState, useRef, useEffect, KeyboardEvent, FocusEvent } from 'react';

interface Suggestion {
  tokenName: string;
  tokenLabel: string;
  tokenType: string;
  nextTokenType: string;
  nextValidValues: Array<string>;
}

interface Field {
  type: string
  name: string
  label: string
  value?: string
  nextTokenType?: string[],
  operators?: string
}

interface TokenValid {
  field: Array<string>;
  operator: Array<string>;
  combinator: Array<string>;
  group: Array<string>;
}

interface Token {
  type: string;
  name?: string;
  label?: string;
  value?: string;
  selectedType?: string;
  valid?: TokenValid;
}

interface TokenColorClasses {
  [key: string]: string;
}

interface Rule {
  field: string;
  operator: string;
  value: string;
}

interface RuleGroup {
  combinator: string;
  rules: (Rule | RuleGroup)[];
}

interface ParseToken extends HTMLSpanElement {
  getAttribute(name: string): string | null;
  innerText: string;
}

// Sample data 
const FIELDS: Field[] = [
  { name: "text", label: "Text", type: "text", operators: "contains,doesNotContains" },
  { name: "created_date", label: "Created Date", type: "date", operators: "=,!=,<,>,<=,>=" },
  { name: "updated_date", label: "Updated Date", type: "date", operators: "=,!=,<,>,<=,>=" },
  { name: "kn_created", label: "Added to Kn", type: "date", operators: "=,!=,<,>,<=,>=" },
  { name: "classifier", label: "Classifier", type: "text", operators: "contains,doesNotContains" },
  { name: "created_by", label: "Created By", type: "text", operators: "contains,doesNotContains" }
];

const ALL_OPERATORS = [
  { name: "contains", label: "contains" },
  { name: "doesNotContains", label: "does not contains" },
  { name: "beginsWith", label: "begins with" },
  { name: "doesNotBeginWith", label: "does not begin with" },
  { name: "endsWith", label: "ends with" },
  { name: "doesNotEndWith", label: "does not end with" },
  { name: "in", label: "in" },
  { name: "notIn", label: "not in" },
  { name: "=", label: "=" },
  { name: "!=", label: "!=" },
  { name: "<", label: "<" },
  { name: ">", label: ">" },
  { name: "<=", label: "<=" },
  { name: ">=", label: ">=" }
];

const COMBINATORS = ['AND', 'OR'];

const GROUPS = ['(', ')'];

const TOKEN_COLORS: TokenColorClasses = {
  field: 'text-blue-600',
  operator: 'text-purple-600',
  value: 'text-green-600',
  combinator: 'text-orange-600',
  group: 'text-yellow-600',
  invalid: 'text-red-600',
  default: 'text-gray-700',
  space: ''
};

const QueryEditor: React.FC = () => {
  const [tokens, setTokens] = useState<Token[]>([{
    type: 'field,group',
    valid: {
      "group": ["("],
      "field": [],
      "operator": [],
      "combinator": [],
    },
    selectedType: ''
  }]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [openBracket, setOpenBracket] = useState(false);
  const [focusedSpanOffsetLeft, setFocusedSpanOffsetLeft] = useState<any>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [focusedTokenIndex, setFocusedTokenIndex] = useState(0);
  const [jsonOutput, setJsonOutput] = useState({});

  const suggestionsContainerRef = useRef<HTMLDivElement>(null);
  const tokensRef = useRef<(HTMLSpanElement | null)[]>([]);

  const getNextTokenType = (currentType: string): string => {
    const typeMap: { [key: string]: string } = {
      'field': 'operator',
      'operator': 'value',
      'value': 'combinator,group',
      'combinator': 'field,group',
      'group': 'field,combinator,group'
    };
    return typeMap[currentType] || 'field';
  };

  const getSuggestions = (index: number, inputText: string = '') => {
    const token = tokens[index]
    //console.log(token)
    let suggestionList: Suggestion[] = [];
    //split tokenTypes by comma
    const tokenTypeArr = token.type.split(',');
    //If field is exists in tokenTypeArr then add fields to suggestionList
    if(tokenTypeArr.includes('field')) {
      let filteredFields = FIELDS;
      if(tokens[index-1] && tokens[index-1]?.name === ')'){
        filteredFields = [];
      }
      suggestionList = [
        ...suggestionList, 
        ...filteredFields.filter(field => field.label.toLowerCase().includes(inputText.toLowerCase()))
        .map(field => {
          return { 
            tokenName: field.name, 
            tokenLabel: field.label, 
            tokenType: "field", 
            nextTokenType: getNextTokenType("field"),
            nextValidValues: field.operators ? field.operators.split(',') : []
          }
        })
      ];
    }
    if(tokenTypeArr.includes('operator')) {
      let filteredOperators = ALL_OPERATORS;

      //Check if any valid operators list is defined than filter 
      
      if(token?.valid?.operator){
        filteredOperators = filteredOperators.filter(o => {
          //console.log(o)
          return token?.valid?.operator.includes(o.name)
        });
        console.log("Valid operators", filteredOperators)
      }
      suggestionList = [
        ...suggestionList, 
        ...filteredOperators.filter(operator => operator.label.toLowerCase().includes(inputText.toLowerCase()))
        .map(operator => {
          return { 
            tokenName: operator.name, 
            tokenLabel: operator.label, 
            tokenType: "operator", 
            nextTokenType: getNextTokenType("operator"),
            nextValidValues: []
          }
        })
      ];
    }
    if(tokenTypeArr.includes('combinator')) {
      console.log(tokens[index-1])
      let filteredCombinator = COMBINATORS;
      //Check if previous token is a closing bracket than do not suggest combinator 
      if(tokens[index-1]?.name == "("){
        filteredCombinator = [];
      }
      suggestionList = [
        ...suggestionList, 
        ...filteredCombinator.filter(comb => comb.toLowerCase().includes(inputText.toLowerCase()))
        .map(comb => {
          return { 
            tokenName: comb, 
            tokenLabel: comb, 
            tokenType: "combinator", 
            nextTokenType: getNextTokenType("combinator"),
            nextValidValues: []
          }
        })
      ];
    }

    if(tokenTypeArr.includes('group')) {
      let filteredGroups = GROUPS;
      //If previous token is closing bracket than do not suggest opening bracket
      if(tokens[index-1] && tokens[index-1]?.name === ')'){
        filteredGroups = filteredGroups.filter(grp => grp !== '(');
      }
      //Check if open bracket are more than closing bracket than suggest closing bracket
      const oB = tokens.filter(t => t.name === '(').length;
      const oC = tokens.filter(t => t.name === ')').length;
      console.log("Open/close bracket count: ", oB, oC)
      if(oB === oC){
        filteredGroups = filteredGroups.filter(grp => grp !== ')');
      }
      
      suggestionList = [
        ...suggestionList, 
        ...filteredGroups
          .filter(grp => 
            token?.valid?.group.includes(grp.toLowerCase())
          )
          .filter(grp => grp.toLowerCase().includes(inputText.toLowerCase()))
          .map(grp => {
            return { 
              tokenName: grp, 
              tokenLabel: grp, 
              tokenType: "group", 
              nextTokenType: getNextTokenType("group"),
              nextValidValues: []
            }
          })
      ];
    }
    
    //console.log("Suggestions: ", suggestionList)
    setSuggestions(suggestionList.filter(s => 
      inputText === '' || 
      s.tokenLabel.toLowerCase().includes(inputText.toLowerCase())
    ));
    setSelectedSuggestionIndex(0);
    setSuggestionsVisible(suggestionList.length > 0);
  };

  const setValids = (index: number) => {
    console.log(tokens[index])
  }

  const handleTokenFocus = (e: FocusEvent<HTMLSpanElement>, index: number) => {
    const focusedSpan = e.target;
    
    //Get the left position of the parent relative container
    const containerRect = focusedSpan.parentElement?.getBoundingClientRect();
    const focusedSpanOffsetLeft = focusedSpan.getBoundingClientRect().left - (containerRect?.left ?? 0);
    setFocusedSpanOffsetLeft(focusedSpanOffsetLeft);
    
    const tokenTypes = tokens[index].type;
    setFocusedTokenIndex(index);
    getSuggestions(index);
  };

  const addGroup = () => {
    const updatedTokens = [...tokens];
    const insertIndex = focusedTokenIndex;
    
    updatedTokens.splice(insertIndex, 0, 
      { type: 'group', name: '(', label: '(', selectedType: 'group' },
      { type: 'field,group' },
      { type: 'group', name: ')', label: ')', selectedType: 'group' }
    );
    
    setTokens(updatedTokens);
    setTimeout(() => {
      if (tokensRef.current[insertIndex + 1]) {
        focusEnd(tokensRef.current[insertIndex + 1]);
      }
    }, 0);
  };

  // get the valid values for a next token  
  //
  const getValidValues = (currentToken: Token, currentTokenIndex: number) => {
    const valids: TokenValid = {
      field: [],
      operator: [],
      combinator: [],
      group: []
    };
    const prevToken = tokens[currentTokenIndex-1];
    const nextToken = tokens[currentTokenIndex+1];
    //If field is exists in tokenTypeArr then add fields to suggestionList
    if(currentToken.selectedType === 'field') {
      console.log(currentToken, currentToken.label?.toLowerCase())
      const validFields = FIELDS.filter(f => f.label.toLowerCase() === currentToken.label?.toLowerCase());
      console.log(validFields)
      valids.operator = validFields[0].operators?.split(",") || [];
    }
    if(currentToken.selectedType === 'operator'){
    }
    if(currentToken.selectedType === 'combinator'){
      valids.group.push("(");
    }
    if(currentToken.selectedType === 'group'){
      valids.group.push("(");
    }
    if(currentToken.selectedType === 'value'){
      valids.group.push(")");
    }

    return valids;
  }

  const handleSuggestionSelect = (suggestion: string, tokenType: string = "value") => {
    setErrorMessage("");
    //console.log("selected suggestions: ", suggestion, tokenType, tokens)
    const selectedSuggestion = suggestions.find(s => s.tokenLabel.toLowerCase() === suggestion.toLowerCase());
    if (!selectedSuggestion && tokenType !== 'value') {
      setErrorMessage("Invalid suggestion selected");
      return;
    }
    //Update values in current token
    const updatedTokens = [...tokens];
    const currentToken = updatedTokens[focusedTokenIndex];
    currentToken.name = suggestion.trim();
    currentToken.label = suggestion.trim();
    currentToken.selectedType = tokenType;
    console.log("Current token", currentToken);
    updatedTokens[focusedTokenIndex] = { ...currentToken };

    console.log("All token", updatedTokens)
    //console.log(tokenType)
    const nextTokenType = getNextTokenType(tokenType);

    const nextTokenIndex = focusedTokenIndex + 1;
    
     // Create new token if token not exits or already exists and type is not same then 
     // insert a new token wthout delete existing token. shift all tokens to the right
     console.log("Existing token data ", updatedTokens[nextTokenIndex]?.type, nextTokenType)
    if(!updatedTokens[nextTokenIndex] || (updatedTokens[nextTokenIndex] && updatedTokens[nextTokenIndex].type.indexOf(nextTokenType) === -1)){
      updatedTokens.splice(nextTokenIndex, 0, { 
        type: nextTokenType, 
        selectedType: nextTokenType === "value"? "value" : "",
        valid: getValidValues(currentToken, focusedTokenIndex)
      });
    }else if(updatedTokens[nextTokenIndex].selectedType === tokenType){ //if token already exists and type is not same then insert a new token and shift all tokens to the right
      console.log("somethign ere ")
      updatedTokens[nextTokenIndex].selectedType = tokenType === "value"? "value" : "";
      updatedTokens[nextTokenIndex].valid = getValidValues(currentToken, focusedTokenIndex);
    }
    console.log("data is updated::", updatedTokens)
    setTokens(updatedTokens);
    setSuggestionsVisible(false);

    setTimeout(() => {
      if (tokensRef.current[nextTokenIndex]) {
        focusEnd(tokensRef.current[nextTokenIndex]);
      }
    }, 0);
  };

  const focusStart = (element: HTMLSpanElement | null) => {
    element?.focus();
    if (element && element.firstChild) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(element);
      range.collapse(true);
      //if element having property data-token-type as value that set cursor at second position
      const tokenType = element.getAttribute('data-token-type');
      if (tokenType === 'value') {
        range.setStart(element.firstChild, 1);
      } 
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const focusEnd = (element: HTMLSpanElement | null) => {
    element?.focus();
    if (element && element.firstChild) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(element);
      //range.collapse(false);
      const tokenType = element.getAttribute('data-token-type');
      if (tokenType === 'value') {
        const textLength = element.firstChild.nodeValue?.length || 0;
        range.setStart(element.firstChild, textLength - 1);
        range.setEnd(element.firstChild, textLength - 1);
      }else{
        range.collapse(false);
      }

      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const handleNavigationKeys = (e: KeyboardEvent<HTMLSpanElement>, index: number) => {
    const selection = window.getSelection();
    const position = selection?.anchorOffset || 0;
    const currentToken = tokens[index];
    const textLength = e.currentTarget.innerText.length;
    const isValueField = currentToken.type === 'value';

    // Special handling for value fields
    if (isValueField) {
      // Handle Enter key to move to next token
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSuggestionSelect(e.currentTarget.innerText, "value");
        return;
      }

      // Handle right arrow at the end of content (including quotes)
      else if (e.key === 'ArrowRight' && position >= textLength - 1) {
        e.preventDefault();
        //If next token exists then move to next
        if (tokens[index + 1]) {
          focusStart(tokensRef.current[index + 1]);
          setFocusedTokenIndex(index + 1);
          getSuggestions(index+1);
        }else{ //Other wise create a new token and move to it
          handleSuggestionSelect(e.currentTarget.innerText, "value");
        }
        return;
      }

      // Handle right arrow at the end of content (including quotes)
      else if (e.key === 'ArrowLeft' && position <= 1) {
        e.preventDefault();
        //If next token exists then move to next
        focusEnd(tokensRef.current[index - 1]);
        setFocusedTokenIndex(index - 1);
        getSuggestions(index - 1);
        return;
      }
      //check if space is pressed in the end of value field
      else if (e.key === ' ' && position >= textLength ) {
        e.preventDefault();
        handleSuggestionSelect(e.currentTarget.innerText.trim(), "value");
        return;
      }
      //Check if backspace is pressed in the start of the value or pressed delete in the end of the value field and the length of the value field is greater than 2
      else if (((e.key === 'Backspace' && position === 1) || (e.key === 'Delete' && position === textLength - 1)) && e.currentTarget.innerText.length > 2) {
        e.preventDefault();
        //show error message "You are not allow to delete quotes for the value"
        return;
      } 
      //Check if backspace is pressed in the start of the value or pressed delete in the end of the value field and text doest not have any value or other than just quotes 
      else if ((e.key === 'Backspace' || e.key === 'Delete') && index > 0 && (e.currentTarget.innerText === '""' || e.currentTarget.innerText === ''))  {
        e.preventDefault();

        //Remove the current token
        setTokens(prevTokens => prevTokens.filter((_, i) => i !== index));

        //Focus on the previous token
        focusEnd(tokensRef.current[index - 1]);
        return;
      }
    }

    //Special handling for group fields
    if (currentToken.type === 'group') {
      // Handle Enter key to move to next token
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSuggestionSelect(e.currentTarget.innerText, "group");
        return;
      }
    }

    // Regular navigation for other fields
    if (e.key === 'ArrowLeft' && position === 0 && index > 0) {
      e.preventDefault();
      focusEnd(tokensRef.current[index - 1]);
      setFocusedTokenIndex(index - 1);
      getSuggestions(index - 1);
    }
    if (e.key === 'ArrowRight' && position === textLength && index < tokens.length - 1) {
      e.preventDefault();
      focusStart(tokensRef.current[index + 1]);
      setFocusedTokenIndex(index + 1);
      getSuggestions(index + 1);
    }

    //Check if backspace is pressed in the start of the value or pressed delete in the end of the value field and the length of the value field is greater than 2
    if (((e.key === 'Backspace' && position === 0) || (e.key === 'Delete' && position === textLength)) && e.currentTarget.innerText.length > 2) 
    {
      e.preventDefault();
      //show error message "You are not allow to delete quotes for the value"
    }
    //Check if backspace is pressed in the start of the value or pressed delete in the end of the value field and text doest not have any value or other than just quotes 
    else if ((e.key === 'Backspace' || e.key === 'Delete') && index > 0 && (e.currentTarget.innerText === '\n' || e.currentTarget.innerText === ''))  {

      e.preventDefault();

      //Remove the current token
      setTokens(prevTokens => prevTokens.filter((_, i) => i !== index));

      //Focus on the previous token
      focusEnd(tokensRef.current[index - 1]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>, index: number) => {

    if (e.key === 'Enter') {
        e.preventDefault();
    }
    const currentToken = tokens[index];
    
    // Handle navigation for value fields and suggestions differently
    if (currentToken.type === 'value' && !suggestionsVisible) {
      handleNavigationKeys(e, index);
      return;
    }
    //If space is pressed in the end of a non-value field
    const currentText = e.currentTarget.innerText || '';
    //console.log("current text", currentText, `key: "${e.key}"`, currentToken.type, currentToken.label)
    
    //Hangle space in the end
    const sugg = suggestions.filter(suggestion => suggestion.tokenLabel.toLowerCase() === currentText.trim().toLowerCase());
    if(e.key === ' ' && sugg.length > 0) {
      handleSuggestionSelect(currentText.trim(), sugg[0].tokenType);
    }

    // Handle suggestion navigation
    if (suggestionsVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSuggestionSelect(suggestions[selectedSuggestionIndex].tokenLabel, suggestions[selectedSuggestionIndex].tokenType);
      }
    }

    handleNavigationKeys(e, index);
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLSpanElement>, index: number) => {
    if (e.key === 'Enter') {
        e.preventDefault();
    }
    const currentToken = tokens[index];
    const currentText = e.currentTarget.innerText || '';

    //If backspace or delete pressed
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key.length === 1) {
      getSuggestions(index, currentText);
    }

    // Handle space in the end of a value field
    if (currentToken.type === 'value' && !suggestionsVisible) {
      if (e.key === ' ' && currentText.endsWith(' ')) {
        handleSuggestionSelect(currentText.trim(), "value");
        return;
      }
    }

    const sugg = suggestions.filter(suggestion => suggestion.tokenLabel.toLowerCase() === currentText.trim().toLowerCase());
    if(e.key === ' ' && sugg.length > 0) {
      handleSuggestionSelect(currentText.trim(), sugg[0].tokenType);
    }
  };

  const handleTokenBlur = (e: React.FocusEvent<HTMLSpanElement>, index: number) => {
    const currentToken = tokens[index];
    const currentText = e.currentTarget.innerText || '';
    if(currentToken.type === 'value' && !(currentText === "" || currentText === '""')) {
      
      currentToken.name = currentText;
      currentToken.label = currentText;
      let newTokens = [...tokens];
      newTokens[index] = { ...currentToken };

      setTokens(newTokens);
    }
  }

  const mouseUp = (e: React.MouseEvent<HTMLElement>, index: number) => {
    
    e.preventDefault();

    const currentToken = tokens[index];
    if (currentToken.type === 'value') {
      const selection = window.getSelection();
      const position = selection?.anchorOffset || 0;
      const textLength = e.currentTarget.innerText.length;
      if (position === 0) {
        focusStart(tokensRef.current[index]);
      } else if (position === textLength) {
        focusEnd(tokensRef.current[index]);
      }
      setFocusedTokenIndex(index);
    }
  }

  const renderToken = (token: Token, index: number) => {
    const tokenClass = TOKEN_COLORS[token.selectedType || token.type] || TOKEN_COLORS.default;
    const isEditable = token.type !== 'group';

    return (
      <span
        key={index}
        ref={el => tokensRef.current[index] = el}
        contentEditable={isEditable}
        suppressContentEditableWarning
        className={`outline-none 
          ${tokenClass} 
          ${token.type === 'value' ? '' : ''}
          ${token.type === 'group' ? 'font-bold' : ''}`}
        onFocus={(e) => handleTokenFocus(e, index)}
        onKeyDown={(e) => handleKeyDown(e, index)}
        onKeyUp={(e) => handleKeyUp(e, index)}
        onMouseUp={(e)=>mouseUp(e, index)}
        onBlur={(e) => {
          const blurredElement = e.relatedTarget as HTMLSpanElement;
          handleTokenBlur(e, index);
        }}
        data-token-type={token.type}
        data-token-name={token.name}
        data-token-selected_type={token.selectedType}
      >
        {token.name?.trim() || (token.type === 'value' ? '""' : '')}
      </span>
    );
  };

  const parseQueryToJson = (container: HTMLElement): RuleGroup => {
    const spans = Array.from(container.getElementsByTagName('span')) as ParseToken[];
    
    const parseGroup = (tokens: ParseToken[], startIndex = 0): [RuleGroup, number] => {
      let currentIndex = startIndex;
      const rules: (Rule | RuleGroup)[] = [];
      let currentRule: Partial<Rule> = {};
      let currentCombinator = 'and';
      
      while (currentIndex < tokens.length) {
        const token = tokens[currentIndex];
        const tokenType = token.getAttribute('data-token-selected_type');
        const tokenText = token.innerText.toLowerCase();
        
        if (tokenText === '(') {
          const [groupRules, newIndex] = parseGroup(tokens, currentIndex + 1);
          rules.push(groupRules);
          currentIndex = newIndex;
          continue;
        }
        
        if (tokenText === ')') {
          return [{
            combinator: currentCombinator,
            rules: rules
          }, currentIndex];
        }
        
        if (tokenType === 'combinator') {
          if (Object.keys(currentRule).length > 0) {
            rules.push(currentRule as Rule);
            currentRule = {};
          }
          currentCombinator = tokenText.toLowerCase();
          currentIndex++;
          continue;
        }
        
        if (tokenType === 'field') {
          currentRule.field = tokenText;
        } else if (tokenType === 'operator') {
          currentRule.operator = tokenText;
        } else if (tokenType === 'value') {
          currentRule.value = tokenText.replace(/"/g, '');
        }
        
        if (currentRule.field && currentRule.operator && currentRule.value) {
          rules.push({...currentRule} as Rule);
          currentRule = {};
        }
        
        currentIndex++;
      }
      
      if (Object.keys(currentRule).length > 0 && currentRule.field && currentRule.operator && currentRule.value) {
        rules.push(currentRule as Rule);
      }
      
      return [{
        combinator: currentCombinator,
        rules: rules
      }, currentIndex];
    };
    
    const [result] = parseGroup(spans);
    return result;
  };

  // Render the query editor and suggestions
  return (
    <div className="relative w-full">
      <div className="mb-2 text-sm text-gray-600">
        Press Ctrl + ( to add a group
      </div>
      <div  ref={containerRef} className="border p-2 min-h-[50px] w-full rounded-md text-base bg-white 
                    cursor-text flex flex-wrap items-center gap-1 
                    focus:outline-none focus:ring-2 focus:ring-blue-500">
        {tokens.map(renderToken)}
      </div>
      //Add button to call parseQueryToJson function 
      <button className='bg-blue-500 text-white px-4 py-2 rounded' onClick={() => {
        if (containerRef.current) {
          const result = parseQueryToJson(containerRef.current);
          setJsonOutput(result);
        }
      }}>
        Parse
      </button>

      {suggestionsVisible && (
        <div ref={suggestionsContainerRef}
            className="absolute z-10 bg-white border rounded shadow-lg mt-1 max-h-60 overflow-y-auto"
            style={{ left: focusedSpanOffsetLeft }}>
          {suggestions.map((suggestion, index) => (
            <div key={suggestion.tokenLabel} 
                className={`p-2 cursor-pointer hover:bg-gray-100 
                          ${index === selectedSuggestionIndex ? 'bg-gray-200' : ''}`}
                onClick={() => handleSuggestionSelect(suggestion.tokenLabel, suggestion.tokenType)}>
              {suggestion.tokenLabel}
            </div>
          ))}
        </div>
      )}
      <span className='error'>{errorMessage}</span>
      <div className='mb-2 text-sm text-gray-600'>
        <div className="bg-gray-100 p-4 rounded-md">
          <h3 className="text-lg font-semibold mb-2">JSON Output:</h3>
          <pre className="whitespace-pre-wrap break-words">
            {jsonOutput ? JSON.stringify(jsonOutput, null, 2) : 'Processing...'}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default QueryEditor;