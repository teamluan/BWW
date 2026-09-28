import './globals.css';

export const metadata = {
  title: 'BWW — Command Center',
  description: 'Geschütztes Admin-Dashboard für den BWW Discord Bot.'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06080d'
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
