'use client';

import React from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';

export default function Home() {
  const { control, status, errors } = useChatKit({
    api: {
      // This is the official approach - getClientSecret
      async getClientSecret(existing) {
        // If refreshing existing session
        if (existing) {
          console.log('[ChatKit] Refreshing session');
        } else {
          console.log('[ChatKit] Creating new session');
        }

        // Call your backend to create/get session
        const res = await fetch('/api/create-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          const error = await res.json();
          console.error('[ChatKit] Session creation failed:', error);
          throw new Error(error.error || 'Failed to create session');
        }

        const data = await res.json();
        console.log('[ChatKit] Session created successfully');
        
        // Return the client_secret from response
        return data.client_secret;
      },
    },
    // Optional: Event handlers
    onError: (error) => {
      console.error('[ChatKit] Error:', error);
    },
    onResponseEnd: () => {
      console.log('[ChatKit] Response complete');
    },
    onResponseStart: () => {
      console.log('[ChatKit] Response started');
    },
  });

  // Show loading state while initializing
  if (status === 'initializing') {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="mb-6">
            <div className="inline-block animate-bounce text-6xl">🤖</div>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">AI Assistant</h1>
          <p className="text-gray-600 animate-pulse">Connecting to your agent...</p>
        </div>
      </div>
    );
  }

  // Show errors if session or integration fails
  if (errors.session || errors.integration) {
    const error = errors.session || errors.integration;
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 p-4">
        <div className="w-full max-w-md rounded-xl border-2 border-red-200 bg-white p-8 shadow-lg">
          <div className="mb-4 text-center text-5xl">⚠️</div>
          <h2 className="mb-3 text-center text-xl font-bold text-red-600">
            Connection Error
          </h2>
          <p className="mb-4 text-center text-sm text-red-500">
            {error?.message || 'Failed to connect to AI agent'}
          </p>
          <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700">
            <p className="font-semibold mb-2">Troubleshooting:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check that OPENAI_API_KEY is set</li>
              <li>Check that NEXT_PUBLIC_CHATKIT_WORKFLOW_ID is set</li>
              <li>Verify your workflow is published in Agent Builder</li>
              <li>Ensure API key and workflow are in the same project</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Render the ChatKit component
  return (
    <div className="h-screen w-full bg-gray-50">
      <ChatKit
        control={control}
        className="h-full w-full"
      />
    </div>
  );
}
