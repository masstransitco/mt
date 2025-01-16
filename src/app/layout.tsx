import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { ReduxProvider } from '@/providers/ReduxProvider';
import ChatWidget from '@/components/ChatWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'MTC | APP',
  description: 'A Next.js + Redux + LLM EV Transit Web Application'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReduxProvider>
          {children}
          <ChatWidget />
        </ReduxProvider>
      </body>
    </html>
  );
}
