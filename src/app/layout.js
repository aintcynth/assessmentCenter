import "./globals.css";

export const metadata = {
  title: "CACs Accreditation",
  description: "Apply for, review, and issue assessment center accreditation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
