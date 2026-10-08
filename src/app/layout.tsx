import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const instant = false;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-50 text-gray-900 font-sans antialiased">
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200">
            <div className="flex items-center md:hidden">
              <div className="font-bold text-lg">Sorelin Moka</div>
            </div>
            <div className="hidden md:block">
              {/* Breadcrumb or Title placeholder */}
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center text-sm font-medium text-gray-600">
                A
              </div>
            </div>
          </header>

          {/* Main area */}
          <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
