export const STT_MODELS = ["@cf/openai/whisper", "@cf/openai/whisper-tiny-en"] as const;
export type STTModelId = (typeof STT_MODELS)[number];

export const LLM_MODELS = [
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3-8b-instruct",
  "@cf/meta/llama-2-7b-chat-int8",
  "@cf/mistral/mistral-7b-instruct-v0.1",
] as const;
export type LLMModelId = (typeof LLM_MODELS)[number];

export const TTS_MODELS = ["@cf/deepgram/aura-2-en", "@cf/deepgram/aura-1"] as const;
export type TTSModelId = (typeof TTS_MODELS)[number];

export const TTS_MODEL_VOICES = {
  "@cf/deepgram/aura-2-en": ["asteria", "luna", "arcas", "athena", "helios", "orpheus", "perseus", "angus"],
  "@cf/deepgram/aura-1": [
    "asteria",
    "luna",
    "stella",
    "athena",
    "hera",
    "orion",
    "arcas",
    "perseus",
    "angus",
    "orpheus",
    "helios",
    "zeus",
  ],
} as const satisfies Record<TTSModelId, readonly string[]>;

export type TtsVoiceForModel<T extends TTSModelId> = (typeof TTS_MODEL_VOICES)[T][number];
export type TtsVoiceId = (typeof TTS_MODEL_VOICES)[TTSModelId][number];

