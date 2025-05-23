import { useState, useEffect } from "react";

// Improve type definitions for Chrome TTS API
declare global {
  interface Window {
    chrome?: {
      tts?: {
        speak: (
          utterance: string,
          options: {
            voiceName: string;
            onEvent: (event: { type: string }) => void;
          },
          callback?: () => void
        ) => void;
        getVoices: (
          callback: (voices: Array<{ voiceName: string; lang: string }>) => void
        ) => void;
      };
    };
  }
}

interface Voice {
  name: string;
  lang: string;
  voiceURI: string;
}

function App() {
  const [text, setText] = useState<string>("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch available voices when component mounts
  useEffect(() => {
    const fetchVoices = () => {
      try {
        if (
          typeof window !== "undefined" &&
          window.chrome &&
          window.chrome.tts
        ) {
          window.chrome.tts.getVoices(
            (voiceList: Array<{ voiceName: string; lang: string }>) => {
              if (Array.isArray(voiceList) && voiceList.length > 0) {
                const formattedVoices = voiceList.map((voice) => ({
                  name: voice.voiceName || "Unknown",
                  lang: voice.lang || "Unknown",
                  voiceURI: voice.voiceName || "Unknown",
                }));
                setVoices(formattedVoices);
                // Set default voice
                if (formattedVoices.length > 0) {
                  setSelectedVoice(formattedVoices[0].voiceURI);
                }
              } else {
                console.warn("No voices found in Chrome TTS API");
                fallbackToWebSpeech();
              }
            }
          );
        } else {
          fallbackToWebSpeech();
        }
      } catch (error) {
        console.error("Error fetching voices:", error);
        fallbackToWebSpeech();
      }
    };

    const fallbackToWebSpeech = () => {
      try {
        // Fallback for development environment
        if (typeof window !== "undefined" && window.speechSynthesis) {
          const synth = window.speechSynthesis;
          let fetchedVoices = synth.getVoices();

          if (fetchedVoices.length > 0) {
            setVoices(fetchedVoices);
            setSelectedVoice(fetchedVoices[0].voiceURI);
          } else {
            // If voices aren't loaded yet, wait for them
            synth.onvoiceschanged = () => {
              const updatedVoices = synth.getVoices();
              setVoices(updatedVoices);
              if (updatedVoices.length > 0) {
                setSelectedVoice(updatedVoices[0].voiceURI);
              }
            };
          }
        } else {
          console.error("Neither Chrome TTS nor Web Speech API is available");
          setVoices([
            { name: "Default Voice", lang: "en-US", voiceURI: "default" },
          ]);
          setSelectedVoice("default");
        }
      } catch (error) {
        console.error("Error in Web Speech fallback:", error);
        setVoices([
          { name: "Default Voice", lang: "en-US", voiceURI: "default" },
        ]);
        setSelectedVoice("default");
      }
    };

    fetchVoices();
  }, []);

  const handlePlayClick = () => {
    if (!text.trim()) return;

    setIsLoading(true);

    try {
      if (typeof window !== "undefined" && window.chrome && window.chrome.tts) {
        // Chrome extension environment
        window.chrome.tts.speak(
          text,
          {
            voiceName: selectedVoice,
            onEvent: function (event: { type: string }) {
              if (event.type === "end" || event.type === "error") {
                setIsLoading(false);
              }
            },
          },
          () => {
            // This callback runs after the speech request is processed
            // Handle case where no event callback might fire
            setTimeout(() => {
              setIsLoading(false);
            }, 500);
          }
        );
      } else if (typeof window !== "undefined" && window.speechSynthesis) {
        // Fallback for development environment
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = voices.find((v) => v.voiceURI === selectedVoice);
        if (voice) {
          utterance.voice = voice as SpeechSynthesisVoice;
        }
        utterance.onend = () => setIsLoading(false);
        utterance.onerror = () => setIsLoading(false);

        // Make sure to cancel any ongoing speech
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);

        // Safety timeout in case events don't fire
        setTimeout(() => setIsLoading(false), 10000);
      } else {
        console.error("No speech synthesis available");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error in speech synthesis:", error);
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center p-12 min-h-screen bg-gray-50">
      <h1 className="font-black text-5xl mb-8 text-blue-600">Yabble</h1>
      <div className="w-full max-w-md space-y-4 bg-white p-6 rounded-lg shadow-md">
        <div className="form-group">
          <label
            htmlFor="voice-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Select Voice
          </label>
          <select
            id="voice-select"
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
          >
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label
            htmlFor="text-input"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Text to Speak
          </label>
          <textarea
            id="text-input"
            className="w-full p-2 border border-gray-300 rounded-md h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to be spoken..."
          />
        </div>

        <button
          onClick={handlePlayClick}
          disabled={isLoading || !text.trim()}
          className={`w-full py-2 px-4 rounded-md text-white font-medium flex items-center justify-center ${
            isLoading || !text.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              Play
            </>
          )}
        </button>
      </div>
    </main>
  );
}

export default App;
