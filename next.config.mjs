/** @type {import('next').NextConfig} */
const nextConfig = {
  // Make sure the sideloaded Bible text ships with any server build.
  outputFileTracingIncludes: { "/": ["./app-data/**/*"] },
  // In development Next shows a small round indicator in a corner; the bottom left
  // corner belongs to the app's "?" help button, so keep the indicator away from it.
  devIndicators: { position: "bottom-right" },
};
export default nextConfig;
