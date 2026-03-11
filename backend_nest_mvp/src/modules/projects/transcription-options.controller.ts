import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function envBool(v: string | undefined, def: boolean) {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'y', 'on'].includes(v.toLowerCase());
}

@Controller('transcription')
export class TranscriptionOptionsController {
  constructor(private readonly config: ConfigService) {}

  @Get('options')
  options() {
    return {
      models: ['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3', 'large-v3-turbo', 'large-v3', 'large-v3-turbo'],
      engines: ['faster-whisper', 'purfview-xxl', 'whisperx', 'script-align'],
      profiles: ['VE', 'VCAT'],
      defaults: {
        model: this.config.get('WHISPERX_MODEL', 'large-v3'),
        engine: this.config.get('WHISPERX_ENGINE', 'faster-whisper'),
        profile: this.config.get('WHISPERX_PROFILE', 'VE'),
        language: this.config.get('WHISPERX_LANGUAGE', ''),
        batchSize: Number(this.config.get('WHISPERX_BATCH_SIZE', '8')),
        device: this.config.get('WHISPERX_DEVICE', 'cpu'),
        diarization: envBool(this.config.get('WHISPERX_DIARIZATION'), true),
        offline: envBool(this.config.get('WHISPERX_OFFLINE'), false),
        timingFix: envBool(this.config.get('WHISPERX_TIMING_FIX'), true),
      },
    };
  }
}
