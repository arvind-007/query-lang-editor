import React from 'react';
import JQLLikeEditor from './components/JQLLikeEditor';
import QueryEditor from './components/QueryEditor';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">JQL Query Editor</h1>
        <JQLLikeEditor />
      </div>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">JQL Query Editor 1</h1>
        <QueryEditor />
      </div>
    </div>
  );
}

export default App;