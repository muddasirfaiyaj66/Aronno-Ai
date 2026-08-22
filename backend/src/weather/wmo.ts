export type WeatherKind = 'sunny' | 'partly' | 'cloudy' | 'rainy' | 'storm';

export function kindFromWmo(code: number): WeatherKind {
  if (code === 0) return 'sunny';
  if (code <= 3) return 'partly';
  if (code <= 48) return 'cloudy';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rainy';
  return 'cloudy';
}

export function iconFromKind(kind: WeatherKind): string {
  if (kind === 'sunny') return 'sunny-outline';
  if (kind === 'partly') return 'partly-sunny-outline';
  if (kind === 'rainy') return 'rainy-outline';
  if (kind === 'storm') return 'thunderstorm-outline';
  return 'cloudy-outline';
}

export function kindFromPrecipMm(monthlyMm: number): WeatherKind {
  if (monthlyMm >= 280) return 'storm';
  if (monthlyMm >= 140) return 'rainy';
  if (monthlyMm >= 60) return 'cloudy';
  if (monthlyMm >= 25) return 'partly';
  return 'sunny';
}

export function conditionBn(kind: WeatherKind): string {
  if (kind === 'sunny') return 'রৌদ্রোজ্জ্বল';
  if (kind === 'partly') return 'আংশিক মেঘলা';
  if (kind === 'cloudy') return 'মেঘলা';
  if (kind === 'rainy') return 'বৃষ্টি';
  return 'বজ্রবৃষ্টি';
}

export function conditionEn(kind: WeatherKind): string {
  if (kind === 'sunny') return 'Sunny';
  if (kind === 'partly') return 'Partly cloudy';
  if (kind === 'cloudy') return 'Cloudy';
  if (kind === 'rainy') return 'Rain';
  return 'Thunderstorm';
}
