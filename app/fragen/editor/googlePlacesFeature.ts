export type GooglePlacesFeature = {
  available: boolean;
};

export function resolveGooglePlacesFeature(input: {
  apiKey: string | undefined;
  explicitlyEnabled: string | undefined;
}): GooglePlacesFeature {
  const apiKey = input.apiKey?.trim() ?? "";
  return {
    available:
      input.explicitlyEnabled?.trim().toLocaleLowerCase("en-US") === "true" &&
      apiKey.length >= 20,
  };
}
