/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import { ShareniteAPI } from '@/utils/api';
import { OnboardingState } from '@/types';

const OnboardingSteps = [
  {
    title: 'Welcome to Sharenite Enhanced',
    description: 'A better way to view and manage your Sharenite library',
    instruction: 'Click anywhere to continue'
  },
  {
    title: 'Profile Visibility',
    description: 'Before we begin, please ensure your Sharenite profile is set to "Public"',
    instruction: 'This is required for the app to access your game data'
  },
  {
    title: 'Connect Your Profile',
    description: 'Enter your Sharenite profile URL to get started',
    instruction: 'You can find this in your browser address bar when viewing your profile'
  }
];

export default function Onboarding({ onComplete }: { onComplete: (username: string) => void }) {
  const [state, setState] = useState<OnboardingState>({
    step: 0,
    url: '',
    isChecking: false
  });

  const handleNext = async () => {
    if (state.step < OnboardingSteps.length - 1) {
        setState(prev => ({ ...prev, step: prev.step + 1 }));
        return;
    }

    if (!state.url) {
        setState(prev => ({ ...prev, error: 'Profile URL is required' }));
        return;
    }

    try {
        const url = new URL(state.url);
        
        const match = url.pathname.match(/\/profiles\/(.+?)\/games/);
        const username = match ? match[1] : null;

        if (!url.hostname.includes('sharenite.link') || !username) {
            setState(prev => ({ 
                ...prev, 
                error: 'Please enter a valid Sharenite profile URL',
                isChecking: false 
            }));
            return;
        }

        setState(prev => ({ ...prev, isChecking: true, error: undefined }));
        
        const api = new ShareniteAPI(username, state.url);
        const profile = await api.validateProfile();

        if (!profile) {
            setState(prev => ({ 
                ...prev, 
                error: 'Profile not found or not public',
                isChecking: false 
            }));
            return;
        }

        localStorage.setItem('sharenite-username', username);
        localStorage.setItem('sharenite-url', state.url);
        onComplete(username);
    } catch (error) {
        setState(prev => ({ 
            ...prev, 
            error: 'Please enter a valid URL',
            isChecking: false 
        }));
    }
  };

  const currentStep = OnboardingSteps[state.step];

  return (
    <div 
      className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col"
      onClick={() => state.step < 2 && handleNext()}
    >
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              {currentStep.title}
            </h1>
            <p className="text-xl text-zinc-400">
              {currentStep.description}
            </p>
            {state.step === 2 && (
              <div className="space-y-4 pt-8">
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-zinc-400 mb-2">
                    Profile URL
                  </label>
                  <input
                    id="url"
                    type="text"
                    className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             text-zinc-100"
                    placeholder="https://www.sharenite.link/profiles/username/games"
                    value={state.url}
                    onChange={(e) => setState(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  disabled={state.isChecking}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors
                             ${state.isChecking 
                               ? 'bg-zinc-700 text-zinc-400' 
                               : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  {state.isChecking ? 'Checking Profile...' : 'Continue'}
                </button>
                {state.error && (
                  <p className="text-red-500 text-sm mt-2">{state.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="p-8 text-center">
        <p className="text-sm text-zinc-500">{currentStep.instruction}</p>
      </div>
    </div>
  );
}