import "server-only";
import { CommerceError } from "../../../../packages/ui/src/commerce-store";

export async function placeSuggestions(query: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || query.length < 3) return [];
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text" }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ input: query, languageCode: "de", includedRegionCodes: ["at"],
      locationBias: { circle: { center: { latitude: 48.208, longitude: 16.372 }, radius: 20000 } } }),
  });
  if (!response.ok) throw new CommerceError(502, "Address suggestions are unavailable.");
  const data = await response.json() as { suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[] };
  return (data.suggestions ?? []).flatMap(result => result.placePrediction ? [{ id: result.placePrediction.placeId, text: result.placePrediction.text.text }] : []);
}

export async function placeDetails(id: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new CommerceError(503, "Address suggestions are not configured.");
  if (!/^[a-zA-Z0-9_-]{1,220}$/.test(id)) throw new CommerceError(400, "Invalid place identifier.");
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=de`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "addressComponents,location" }, signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new CommerceError(502, "Address details are unavailable.");
  const { addressComponents, location } = await response.json() as { location?: { latitude: number; longitude: number }; addressComponents: { longText: string; types: string[] }[] };
  const field = (name: string) => addressComponents?.find(item => item.types.includes(name))?.longText;
  return { line: [field("route"), field("street_number")].filter(Boolean).join(" "), city: field("locality") ?? field("administrative_area_level_1"),
    postalCode: field("postal_code"), country: field("country"), ...(location && { point: { lat: location.latitude, lng: location.longitude } }) };
}
