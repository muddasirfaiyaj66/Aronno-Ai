declare module "@siteed/sherpa-onnx.rn" {
  export type AsrModelConfig = {
    modelDir: string;
    modelType: string;
    streaming?: boolean;
    numThreads?: number;
    modelFiles?: {
      encoder?: string;
      decoder?: string;
      joiner?: string;
      tokens?: string;
    };
  };

  export type TtsModelConfig = {
    modelDir: string;
    ttsModelType: "vits" | "kokoro" | "matcha";
    modelFile: string;
    tokensFile: string;
    numThreads?: number;
    lexiconFile?: string;
    dataDir?: string;
  };

  export const ASR: {
    initialize: (
      config: AsrModelConfig,
    ) => Promise<{ success: boolean; error?: string }>;
    recognizeFromFile: (
      filePath: string,
    ) => Promise<{ text?: string }>;
    release: () => Promise<{ released: boolean }>;
  };

  export const TTS: {
    initialize: (
      config: TtsModelConfig,
    ) => Promise<{ success: boolean; error?: string; sampleRate?: number }>;
    generateSpeech: (
      text: string,
      options?: {
        speakerId?: number;
        speakingRate?: number;
        playAudio?: boolean;
      },
    ) => Promise<{ success: boolean; filePath?: string }>;
    release: () => Promise<{ released: boolean }>;
  };
}
