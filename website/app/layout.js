import './globals.css';

export const metadata = {
  title: 'BWW Dashboard',
  description: 'Öffentliches Dashboard für den BWW Discord Bot'
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
