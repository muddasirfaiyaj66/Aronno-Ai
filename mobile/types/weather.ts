export type WeatherKind = "sunny" | "partly" | "cloudy" | "rainy" | "storm";

export type CurrentWeather = {
  tempC: number;
  humidity: number;
  windKph: number;
  weatherCode: number;
  kind: WeatherKind;
  conditionBn: string;
  conditionEn: string;
  precipitationMm: number;
  precipProb: number;
  locationBn: string;
  source: string;
};

export function weatherKindFromIcon(icon: string): WeatherKind {
  if (icon.includes("thunder") || icon.includes("storm")) return "storm";
  if (icon.includes("rain")) return "rainy";
  if (icon.includes("partly")) return "partly";
  if (icon.includes("sunny") || icon.includes("sun")) return "sunny";
  return "cloudy";
}
