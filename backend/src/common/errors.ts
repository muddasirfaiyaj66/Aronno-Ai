import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super({ success: false, error: { code, message, details } }, status);
  }
}

export const Errors = {
  validation: (details?: unknown) =>
    new ApiError(
      'VALIDATION_ERROR',
      'অবৈধ তথ্য দেওয়া হয়েছে।',
      HttpStatus.BAD_REQUEST,
      details,
    ),
  unauthorized: () =>
    new ApiError('AUTH_INVALID', 'লগইন প্রয়োজন।', HttpStatus.UNAUTHORIZED),
  invalidCredentials: () =>
    new ApiError(
      'AUTH_INVALID',
      'ইমেইল বা পাসওয়ার্ড ভুল।',
      HttpStatus.UNAUTHORIZED,
    ),
  locked: () =>
    new ApiError(
      'AUTH_LOCKED',
      'অনেকবার ভুল চেষ্টা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।',
      HttpStatus.TOO_MANY_REQUESTS,
    ),
  forbidden: () =>
    new ApiError('FORBIDDEN', 'এই কাজের অনুমতি নেই।', HttpStatus.FORBIDDEN),
  notFound: (message = 'তথ্য পাওয়া যায়নি।') =>
    new ApiError('NOT_FOUND', message, HttpStatus.NOT_FOUND),
  conflict: (message: string) =>
    new ApiError('CONFLICT', message, HttpStatus.CONFLICT),
  unsupportedMedia: () =>
    new ApiError(
      'UNSUPPORTED_MEDIA',
      'এই ফাইলের ধরন গ্রহণযোগ্য নয়।',
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    ),
  payloadTooLarge: () =>
    new ApiError(
      'PAYLOAD_TOO_LARGE',
      'ফাইলের আকার খুব বড়।',
      HttpStatus.PAYLOAD_TOO_LARGE,
    ),
  csrf: () =>
    new ApiError('CSRF', 'নিরাপত্তা টোকেন মিলছে না।', HttpStatus.FORBIDDEN),
  aiUnavailable: () =>
    new ApiError(
      'AI_UNAVAILABLE',
      'AI সেবা এখন কাজ করছে না।',
      HttpStatus.SERVICE_UNAVAILABLE,
    ),
  weatherUnavailable: () =>
    new ApiError(
      'WEATHER_UNAVAILABLE',
      'আবহাওয়ার তথ্য পাওয়া যায়নি। কিছুক্ষণ পর চেষ্টা করুন।',
      HttpStatus.SERVICE_UNAVAILABLE,
    ),
  unverified: () =>
    new ApiError(
      'EMAIL_UNVERIFIED',
      'আগে ইমেইল যাচাই করুন। আপনার ইনবক্সে কোড পাঠানো হয়েছে।',
      HttpStatus.FORBIDDEN,
    ),
  otpInvalid: () =>
    new ApiError(
      'OTP_INVALID',
      'কোডটি ভুল। আবার চেক করুন বা নতুন কোড পাঠান।',
      HttpStatus.BAD_REQUEST,
    ),
  otpExpired: () =>
    new ApiError(
      'OTP_EXPIRED',
      'কোডের মেয়াদ শেষ। "আবার কোড পাঠান" চাপুন।',
      HttpStatus.BAD_REQUEST,
    ),
};
