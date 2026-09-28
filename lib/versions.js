// Shared by the server (which reads the chosen version's text) and the toolbar selector.
export const VERSIONS = [
  { id: "web", label: "WEB", name: "World English Bible" },
  { id: "kjv", label: "KJV", name: "King James Version" },
  { id: "bbe", label: "BBE", name: "Bible in Basic English" },
];
export const DEFAULT_VERSION = "web";
export const VERSION_COOKIE = "bible-linker-version";
export const versionOf = (id) => VERSIONS.find((v) => v.id === id) ?? VERSIONS[0];
