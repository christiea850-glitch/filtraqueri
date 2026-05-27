const explicitDisplayLabels: Record<string, string> = {
  "artist(s) name": "Artist",
  "artists name": "Artist",
  "artist name": "Artist",
  "track name": "Track",
  "song name": "Song",
  "released year": "Release year",
  "release year": "Release year",
  "released month": "Release month",
  streams: "Streams",
  "sum streams": "Total streams",
  "avg streams": "Average streams",
  "count rows": "Records",
  "in spotify playlists": "Spotify playlists",
  "in spotify charts": "Spotify charts",
  "in apple playlists": "Apple playlists",
  "in apple charts": "Apple charts",
  "in deezer playlists": "Deezer playlists",
  "danceability %": "Danceability",
  "valence %": "Valence",
  "energy %": "Energy",
  "acousticness %": "Acousticness",
  "instrumentalness %": "Instrumentalness",
  "liveness %": "Liveness",
  "speechiness %": "Speechiness",
  "body temperature c": "Body temperature",
  "milk yield l": "Milk yield",
  "management system": "Management system",
  "climate zone": "Climate zone",
  "disease risk": "Disease risk",
  "monthly charges": "Monthly charges",
  "total charges": "Total charges",
  "internet service": "Internet service",
  "payment method": "Payment method",
};

const acronymLabels: Record<string, string> = {
  api: "API",
  bpm: "BPM",
  id: "ID",
  url: "URL",
};

const normalizeFieldName = (fieldName: string) =>
  fieldName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => acronymLabels[word] || word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const formatDisplayLabel = (fieldName: string) => {
  const normalizedFieldName = normalizeFieldName(fieldName);
  if (!normalizedFieldName) return fieldName;

  return explicitDisplayLabels[normalizedFieldName] || toTitleCase(normalizedFieldName);
};

export const formatMetricDisplayLabel = (fieldName: string) => {
  const normalizedFieldName = normalizeFieldName(fieldName);
  if (!normalizedFieldName) return fieldName;

  if (explicitDisplayLabels[normalizedFieldName]) return explicitDisplayLabels[normalizedFieldName];
  if (normalizedFieldName.startsWith("sum ")) {
    return `Total ${formatDisplayLabel(normalizedFieldName.slice(4)).toLowerCase()}`;
  }
  if (normalizedFieldName.startsWith("avg ")) {
    return `Average ${formatDisplayLabel(normalizedFieldName.slice(4)).toLowerCase()}`;
  }
  if (normalizedFieldName.startsWith("count ")) {
    return normalizedFieldName === "count rows"
      ? "Records"
      : `Count of ${formatDisplayLabel(normalizedFieldName.slice(6)).toLowerCase()}`;
  }

  return formatDisplayLabel(fieldName);
};

