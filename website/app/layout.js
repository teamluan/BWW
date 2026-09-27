import './globals.css';

export const metadata = {
  title: 'BWW — Command Center',
  description: 'Live Dashboard für den BWW Discord Bot und seine verbundenen Server.'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07090d'
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
