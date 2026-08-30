import { permanentRedirect } from 'next/navigation';

// /amazon is the attribution prefix for links printed in the Kindle titles. Every
// real link carries a per-book slug beneath it, so this bare path is only ever hit
// by a truncated or mistyped URL. It must not 404 a reader who paid for a book, and
// it must not be a sixth thin page competing with the five it would list, so it
// redirects to the catalogue rather than rendering an index. It is deliberately not
// in route_ownership.json: a redirect is not a URL to publish.
export default function Page(): never {
  permanentRedirect('/shop');
}
