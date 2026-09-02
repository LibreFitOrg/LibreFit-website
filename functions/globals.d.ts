// Allows importing raw HTML template files as strings (wrangler/esbuild inlines
// them as text at bundle time).
declare module '*.html' {
  const content: string;
  export default content;
}