/**
 * WelcomeEmbed.jsx — the personal welcome page, shown at the app's home route.
 *
 * The page is a self-contained document with its own styles, images and script, served
 * from the app's own assets, so its invitation buttons open the qualification flow
 * inside this app. The frame fills the screen with no app chrome around it, and the
 * page personalizes itself from the query string it is given.
 */
export default function WelcomeEmbed({ src }) {
  return (
    <iframe
      src={src}
      title="A personal welcome | Debt Advisors of America"
      className="h-screen w-full border-0 bg-white"
    />
  );
}