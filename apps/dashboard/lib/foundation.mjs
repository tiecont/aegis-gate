// Public, build-time facts only. Never insert tenant data in shared static output.
export const foundation = Object.freeze({
  phase: "Foundation",
  management: "Not configured",
  traffic: "Disabled",
  release: "Local development only",
});
