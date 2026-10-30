import Link from "next/link";

const HEADER_LOGO = "/brand/desk-logo-header.png";
const MARK = "/brand/desk-mark-white.jpg";

export function DeskLogo({
  variant = "header",
  href = "/",
}: {
  variant?: "header" | "mark";
  href?: string;
}) {
  if (variant === "mark") {
    const img = (
      <img
        src={MARK}
        alt=""
        width={32}
        height={32}
        className="h-7 w-7 shrink-0 rounded-md"
        aria-hidden
        decoding="async"
      />
    );
    if (href) {
      return (
        <Link href={href} className="inline-block shrink-0" aria-label="Desk">
          {img}
        </Link>
      );
    }
    return img;
  }

  return (
    <Link href={href} className="inline-block shrink-0">
      <img
        src={HEADER_LOGO}
        alt="Desk"
        width={200}
        height={56}
        className="h-9 w-auto md:h-10"
        decoding="async"
      />
    </Link>
  );
}
