import "./globals.css";

export const metadata = {
  title: "Gai's AO3 Bookmarks",
  description: "A personal archive of bookmarked Ao3 fics",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
