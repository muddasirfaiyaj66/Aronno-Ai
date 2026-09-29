import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors';
import type { TtsPort } from './ports';

const TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const FEMALE_VOICE = 'Kore';
const STYLE =
  'Warm Bangladeshi woman in her thirties. Natural Dhaka Bangla, calm caring neighbor, moderate pace, soft empathy, conversational. Not a news reader, not theatrical, not a child.';

type AudioPart = { type?: string; data?: string };
type InteractionBody = {
  output_audio?: { data?: string };
  steps?: { content?: AudioPart[] }[];
};

@Injectable()
export class GeminiTtsAdapter implements TtsPort {
  private readonly logger = new Logger(GeminiTtsAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(textBn: string): Promise<Buffer> {
    const key = this.config.get<string>('GEMINI_API_KEY')?.trim() ?? '';
    if (key.length < 8) throw Errors.aiUnavailable();

    const transcript = textBn.replace(/\s+/g, ' ').trim().slice(0, 700);
    if (!transcript) throw Errors.aiUnavailable();

    const model =
      this.config.get<string>('GEMINI_TTS_MODEL')?.trim() || TTS_MODEL;
    const voice =
      this.config.get<string>('GEMINI_TTS_VOICE')?.trim() || FEMALE_VOICE;

    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({
          model,
          input: [
            {
              type: 'user_input',
              content: [
                {
                  type: 'text',
                  text: transcript,
                  annotations: [{ type: 'speech_metadata', style: STYLE }],
                },
              ],
            },
          ],
          response_format: { type: 'audio' },
          generation_config: {
            speech_config: [{ voice }],
          },
        }),
      },
    );

    const raw = await res.text();
    if (!res.ok) {
      this.logger.warn(`Gemini TTS HTTP ${res.status}`);
      throw Errors.aiUnavailable();
    }

    let body: InteractionBody;
    try {
      body = JSON.parse(raw) as InteractionBody;
    } catch {
      throw Errors.aiUnavailable();
    }

    const audio = extractWav(body);
    if (!audio) throw Errors.aiUnavailable();
    return audio;
  }
}

function extractWav(body: InteractionBody): Buffer | null {
  const chunks = [
    body.output_audio?.data,
    ...(body.steps ?? []).flatMap((step) =>
      (step.content ?? [])
        .filter((part) => !part.type || part.type === 'audio')
        .map((part) => part.data),
    ),
  ].filter((value): value is string => !!value && value.length > 80);

  const data = chunks.at(-1);
  if (!data) return null;
  try {
    const bytes = Buffer.from(data, 'base64');
    return bytes.length > 44 ? bytes : null;
  } catch {
    return null;
  }
}
